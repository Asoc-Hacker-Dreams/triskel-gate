#!/bin/bash
# Script de Limpieza de Infraestructura Azure - TriskelGate Payment Platform
# Elimina recursos de Azure creados para testing/staging de forma segura

set -euo pipefail

# Configuración
RESOURCE_GROUP="triskelgate-rg"
LOCATION="eastus2"
SUBSCRIPTION_ID=""

# Nombres de recursos
ACR_NAME="triskelgate"
APP_SERVICE_PLAN="triskelgate-plan"
STAGING_APP="triskelgate-platform-staging"
PROD_APP="triskelgate-platform-prod"
INSIGHTS_NAME="triskelgate-insights"
LOG_ANALYTICS_NAME="triskelgate-logs"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[CLEANUP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CLEANUP]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[CLEANUP]${NC} $1"
}

log_error() {
    echo -e "${RED}[CLEANUP]${NC} $1"
}

log_header() {
    echo -e "\n${BOLD}${BLUE}$1${NC}"
    echo -e "${BLUE}$(printf '=%.0s' $(seq 1 ${#1}))${NC}"
}

# Verificar autenticación con Azure
check_azure_auth() {
    log_info "Verificando autenticación con Azure..."
    
    if ! az account show >/dev/null 2>&1; then
        log_error "No está autenticado con Azure. Ejecute: az login"
        exit 1
    fi
    
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    local account_name=$(az account show --query name -o tsv)
    
    log_success "Autenticado con Azure"
    log_info "Subscription: $account_name ($SUBSCRIPTION_ID)"
}

# Verificar si el resource group existe
check_resource_group() {
    log_info "Verificando si existe el resource group: $RESOURCE_GROUP"
    
    if az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
        log_success "Resource group encontrado: $RESOURCE_GROUP"
        return 0
    else
        log_warning "Resource group no encontrado: $RESOURCE_GROUP"
        return 1
    fi
}

# Listar recursos en el resource group
list_resources() {
    log_header "📋 LISTANDO RECURSOS A ELIMINAR"
    
    local resources=$(az resource list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name, Type:type, Location:location}' -o table 2>/dev/null || echo "")
    
    if [ -n "$resources" ]; then
        echo "$resources"
        echo
        local count=$(az resource list --resource-group "$RESOURCE_GROUP" --query 'length(@)' -o tsv 2>/dev/null || echo "0")
        log_info "Total de recursos encontrados: $count"
    else
        log_warning "No se encontraron recursos en el resource group"
    fi
}

# Función de confirmación interactiva
confirm_deletion() {
    local resource_type="$1"
    local resource_name="$2"
    
    echo -e "\n${YELLOW}¿Está seguro de que desea eliminar ${BOLD}$resource_type${NC}${YELLOW}: ${BOLD}$resource_name${NC}${YELLOW}?${NC}"
    echo -e "${RED}Esta acción NO se puede deshacer.${NC}"
    
    read -p "Escriba 'yes' para confirmar o cualquier otra cosa para saltar: " confirmation
    
    if [ "$confirmation" = "yes" ]; then
        return 0
    else
        log_warning "Eliminación cancelada por el usuario"
        return 1
    fi
}

# Función de confirmación para el resource group completo
confirm_full_deletion() {
    echo -e "\n${RED}${BOLD}⚠️  ADVERTENCIA: ELIMINACIÓN COMPLETA ⚠️${NC}"
    echo -e "${RED}Está a punto de eliminar TODO el resource group: ${BOLD}$RESOURCE_GROUP${NC}"
    echo -e "${RED}Esto incluye:${NC}"
    echo -e "${RED}  • Container Registry y todas las imágenes${NC}"
    echo -e "${RED}  • App Services (staging y production)${NC}"
    echo -e "${RED}  • Application Insights y logs${NC}"
    echo -e "${RED}  • Todos los datos y configuraciones${NC}"
    echo
    echo -e "${RED}${BOLD}ESTA ACCIÓN NO SE PUEDE DESHACER${NC}"
    echo
    
    read -p "Para confirmar la eliminación completa, escriba exactamente 'DELETE-EVERYTHING': " confirmation
    
    if [ "$confirmation" = "DELETE-EVERYTHING" ]; then
        return 0
    else
        log_warning "Eliminación completa cancelada"
        return 1
    fi
}

# Eliminar App Services
delete_app_services() {
    log_header "🌐 ELIMINANDO APP SERVICES"
    
    # Eliminar staging app
    if az webapp show --name "$STAGING_APP" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        if confirm_deletion "App Service (Staging)" "$STAGING_APP"; then
            log_info "Eliminando App Service: $STAGING_APP"
            az webapp delete --name "$STAGING_APP" --resource-group "$RESOURCE_GROUP"
            log_success "App Service eliminado: $STAGING_APP"
        fi
    else
        log_info "App Service no encontrado: $STAGING_APP"
    fi
    
    # Eliminar production app
    if az webapp show --name "$PROD_APP" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        if confirm_deletion "App Service (Production)" "$PROD_APP"; then
            log_info "Eliminando App Service: $PROD_APP"
            az webapp delete --name "$PROD_APP" --resource-group "$RESOURCE_GROUP"
            log_success "App Service eliminado: $PROD_APP"
        fi
    else
        log_info "App Service no encontrado: $PROD_APP"
    fi
}

# Eliminar Container Registry
delete_container_registry() {
    log_header "🐳 ELIMINANDO CONTAINER REGISTRY"
    
    if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        # Listar imágenes en el registry
        log_info "Listando imágenes en el registry..."
        local images=$(az acr repository list --name "$ACR_NAME" -o tsv 2>/dev/null || echo "")
        
        if [ -n "$images" ]; then
            echo -e "${YELLOW}Imágenes encontradas:${NC}"
            echo "$images" | while read -r image; do
                echo "  • $image"
            done
        fi
        
        if confirm_deletion "Container Registry" "$ACR_NAME.azurecr.io"; then
            log_info "Eliminando Container Registry: $ACR_NAME"
            az acr delete --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --yes
            log_success "Container Registry eliminado: $ACR_NAME"
        fi
    else
        log_info "Container Registry no encontrado: $ACR_NAME"
    fi
}

# Eliminar Application Insights
delete_application_insights() {
    log_header "📊 ELIMINANDO APPLICATION INSIGHTS"
    
    if az monitor app-insights component show --app "$INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        if confirm_deletion "Application Insights" "$INSIGHTS_NAME"; then
            log_info "Eliminando Application Insights: $INSIGHTS_NAME"
            az monitor app-insights component delete --app "$INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP"
            log_success "Application Insights eliminado: $INSIGHTS_NAME"
        fi
    else
        log_info "Application Insights no encontrado: $INSIGHTS_NAME"
    fi
}

# Eliminar Log Analytics Workspace
delete_log_analytics() {
    log_header "📝 ELIMINANDO LOG ANALYTICS WORKSPACE"
    
    if az monitor log-analytics workspace show --workspace-name "$LOG_ANALYTICS_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        if confirm_deletion "Log Analytics Workspace" "$LOG_ANALYTICS_NAME"; then
            log_info "Eliminando Log Analytics Workspace: $LOG_ANALYTICS_NAME"
            az monitor log-analytics workspace delete --workspace-name "$LOG_ANALYTICS_NAME" --resource-group "$RESOURCE_GROUP" --yes --force
            log_success "Log Analytics Workspace eliminado: $LOG_ANALYTICS_NAME"
        fi
    else
        log_info "Log Analytics Workspace no encontrado: $LOG_ANALYTICS_NAME"
    fi
}

# Eliminar App Service Plan
delete_app_service_plan() {
    log_header "📋 ELIMINANDO APP SERVICE PLAN"
    
    if az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
        if confirm_deletion "App Service Plan" "$APP_SERVICE_PLAN"; then
            log_info "Eliminando App Service Plan: $APP_SERVICE_PLAN"
            az appservice plan delete --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" --yes
            log_success "App Service Plan eliminado: $APP_SERVICE_PLAN"
        fi
    else
        log_info "App Service Plan no encontrado: $APP_SERVICE_PLAN"
    fi
}

# Eliminar resource group completo
delete_resource_group() {
    log_header "🗑️  ELIMINANDO RESOURCE GROUP COMPLETO"
    
    if confirm_full_deletion; then
        log_info "Eliminando resource group completo: $RESOURCE_GROUP"
        log_warning "Esta operación puede tardar varios minutos..."
        
        az group delete --name "$RESOURCE_GROUP" --yes --no-wait
        
        log_success "Eliminación del resource group iniciada en background"
        log_info "Puede verificar el progreso con: az group show --name $RESOURCE_GROUP"
    fi
}

# Modo dry-run (simular sin eliminar)
dry_run() {
    log_header "🔍 MODO DRY-RUN (SIMULACIÓN)"
    log_info "Simulando eliminación sin ejecutar cambios reales..."
    
    if ! check_resource_group; then
        log_warning "No hay recursos para eliminar"
        return
    fi
    
    list_resources
    
    echo -e "\n${YELLOW}En modo real se eliminarían:${NC}"
    echo "  • App Services: $STAGING_APP, $PROD_APP"
    echo "  • Container Registry: $ACR_NAME.azurecr.io"
    echo "  • Application Insights: $INSIGHTS_NAME"
    echo "  • Log Analytics: $LOG_ANALYTICS_NAME"
    echo "  • App Service Plan: $APP_SERVICE_PLAN"
    echo "  • Resource Group: $RESOURCE_GROUP"
    
    echo -e "\n${GREEN}Para ejecutar la eliminación real, use: $0 --delete${NC}"
}

# Eliminar recursos seleccionados
selective_deletion() {
    log_header "🎯 ELIMINACIÓN SELECTIVA DE RECURSOS"
    
    if ! check_resource_group; then
        log_warning "Resource group no existe, no hay nada que eliminar"
        return
    fi
    
    list_resources
    
    delete_app_services
    delete_container_registry
    delete_application_insights
    delete_log_analytics
    delete_app_service_plan
    
    # Preguntar si eliminar el resource group vacío
    echo -e "\n${YELLOW}¿Desea eliminar también el resource group vacío?${NC}"
    read -p "Escriba 'yes' para eliminar el resource group: " rg_confirmation
    
    if [ "$rg_confirmation" = "yes" ]; then
        az group delete --name "$RESOURCE_GROUP" --yes --no-wait
        log_success "Resource group marcado para eliminación"
    else
        log_info "Resource group conservado"
    fi
}

# Generar reporte de limpieza
generate_cleanup_report() {
    local action="$1"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local report_file="cleanup-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "timestamp": "$timestamp",
    "action": "$action",
    "subscription_id": "$SUBSCRIPTION_ID",
    "resource_group": "$RESOURCE_GROUP",
    "location": "$LOCATION",
    "resources": {
        "container_registry": "$ACR_NAME.azurecr.io",
        "app_service_plan": "$APP_SERVICE_PLAN",
        "staging_app": "$STAGING_APP.azurewebsites.net",
        "production_app": "$PROD_APP.azurewebsites.net",
        "application_insights": "$INSIGHTS_NAME",
        "log_analytics": "$LOG_ANALYTICS_NAME"
    },
    "status": "$([ "$action" = "dry-run" ] && echo "simulated" || echo "executed")",
    "operator": "$(whoami)",
    "script_version": "1.0.0"
}
EOF
    
    log_success "Reporte de limpieza generado: $report_file"
}

# Función de ayuda
show_help() {
    cat << EOF
Script de Limpieza de Infraestructura Azure - TriskelGate Payment Platform

Uso: $0 [OPCIÓN]

OPCIONES:
    --dry-run              Simular eliminación sin ejecutar cambios (por defecto)
    --delete               Eliminar recursos de forma selectiva con confirmaciones
    --delete-all           Eliminar TODO el resource group (PELIGROSO)
    --list                 Solo listar recursos existentes
    --help, -h             Mostrar esta ayuda

EJEMPLOS:
    $0                     # Modo dry-run (simulación)
    $0 --dry-run           # Simulación explícita
    $0 --delete            # Eliminación selectiva con confirmaciones
    $0 --delete-all        # Eliminación completa (requiere confirmación especial)
    $0 --list              # Solo listar recursos

RECURSOS QUE SE ELIMINARÁN:
    • Resource Group: $RESOURCE_GROUP
    • Container Registry: $ACR_NAME.azurecr.io
    • App Service Plan: $APP_SERVICE_PLAN
    • Staging App: $STAGING_APP.azurewebsites.net
    • Production App: $PROD_APP.azurewebsites.net
    • Application Insights: $INSIGHTS_NAME
    • Log Analytics Workspace: $LOG_ANALYTICS_NAME

NOTAS DE SEGURIDAD:
    • Siempre se ejecuta dry-run por defecto
    • Todas las eliminaciones requieren confirmación explícita
    • Se genera un reporte de cada operación
    • La eliminación completa requiere escribir 'DELETE-EVERYTHING'

EOF
}

# Banner de inicio
echo -e "${RED}${BOLD}"
cat << 'EOF'
   _____ _                            
  / ____| |                           
 | |    | | ___  __ _ _ __  _   _ _ __  
 | |    | |/ _ \/ _` | '_ \| | | | '_ \ 
 | |____| |  __/ (_| | | | | |_| | |_) |
  \_____|_|\___|\__,_|_| |_|\__,_| .__/ 
                                | |    
                                |_|    
 Azure Infrastructure Cleanup Tool
 TriskelGate Payment Platform
EOF
echo -e "${NC}"

# Parser de argumentos
case "${1:-dry-run}" in
    "--dry-run"|"dry-run"|"")
        check_azure_auth
        dry_run
        generate_cleanup_report "dry-run"
        ;;
    "--delete"|"delete")
        check_azure_auth
        selective_deletion
        generate_cleanup_report "selective-delete"
        ;;
    "--delete-all"|"delete-all")
        check_azure_auth
        list_resources
        delete_resource_group
        generate_cleanup_report "full-delete"
        ;;
    "--list"|"list")
        check_azure_auth
        if check_resource_group; then
            list_resources
        fi
        ;;
    "--help"|"-h"|"help")
        show_help
        ;;
    *)
        log_error "Opción no reconocida: $1"
        show_help
        exit 1
        ;;
esac

log_info "🎉 Script de limpieza completado"
