#!/bin/bash

# Script de configuración de infraestructura Azure para TriskelGate Payment Platform
# Ejecutar: ./scripts/setup-azure-infrastructure.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
RESOURCE_GROUP="triskelgate-rg"
LOCATION="eastus2"
ACR_NAME="triskelgate"
APP_SERVICE_PLAN="triskelgate-plan"
STAGING_APP="triskelgate-platform-staging"
PROD_APP="triskelgate-platform-prod"
DB_SERVER="triskelgate-db"
INSIGHTS_NAME="triskelgate-insights"
LOG_WORKSPACE="triskelgate-logs"

echo -e "${BLUE}🚀 Configurando infraestructura Azure para TriskelGate Payment Platform...${NC}"

# Verificar que Azure CLI está instalado
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI no está instalado. Instálalo desde: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    exit 1
fi

# Login a Azure (si no está autenticado)
echo -e "${YELLOW}🔐 Verificando autenticación Azure...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Por favor, inicia sesión en Azure:${NC}"
    az login
fi

# Mostrar subscription actual
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}✅ Conectado a Azure subscription: ${SUBSCRIPTION}${NC}"

# Crear Resource Group
echo -e "${YELLOW}📦 Creando Resource Group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION --output table

# Crear Azure Container Registry
echo -e "${YELLOW}🐳 Creando Azure Container Registry...${NC}"
az acr create \
    --resource-group $RESOURCE_GROUP \
    --name $ACR_NAME \
    --sku Standard \
    --admin-enabled true \
    --output table

# Obtener credenciales de ACR
ACR_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

echo -e "${GREEN}✅ ACR creado: ${ACR_SERVER}${NC}"
echo -e "${GREEN}   Usuario: ${ACR_USERNAME}${NC}"
echo -e "${GREEN}   Password: [Guardado en variables]${NC}"

# Crear App Service Plan (Linux)
echo -e "${YELLOW}📱 Creando App Service Plan...${NC}"
az appservice plan create \
    --name $APP_SERVICE_PLAN \
    --resource-group $RESOURCE_GROUP \
    --sku P1V2 \
    --is-linux \
    --location $LOCATION \
    --output table

# Crear App Service para Staging
echo -e "${YELLOW}🏗️ Creando App Service Staging...${NC}"
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan $APP_SERVICE_PLAN \
    --name $STAGING_APP \
    --deployment-container-image-name "${ACR_SERVER}/triskelgate/payment-platform:latest-dev" \
    --output table

# Configurar settings para Staging
echo -e "${YELLOW}⚙️ Configurando settings Staging...${NC}"
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $STAGING_APP \
    --settings \
        NODE_ENV=staging \
        PORT=3001 \
        DATABASE_PATH=/app/data/platform.db \
        LOG_LEVEL=info \
        WEBSITES_PORT=3001 \
    --output table

# Configurar ACR para Staging
az webapp config container set \
    --resource-group $RESOURCE_GROUP \
    --name $STAGING_APP \
    --docker-custom-image-name "${ACR_SERVER}/triskelgate/payment-platform:latest-dev" \
    --docker-registry-server-url "https://${ACR_SERVER}" \
    --docker-registry-server-user $ACR_USERNAME \
    --docker-registry-server-password $ACR_PASSWORD \
    --output table

# Crear App Service para Production
echo -e "${YELLOW}🏭 Creando App Service Production...${NC}"
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan $APP_SERVICE_PLAN \
    --name $PROD_APP \
    --deployment-container-image-name "${ACR_SERVER}/triskelgate/payment-platform:latest" \
    --output table

# Crear deployment slot para Production (Blue-Green)
echo -e "${YELLOW}🔄 Creando deployment slot...${NC}"
az webapp deployment slot create \
    --resource-group $RESOURCE_GROUP \
    --name $PROD_APP \
    --slot staging \
    --output table

# Configurar settings para Production
echo -e "${YELLOW}⚙️ Configurando settings Production...${NC}"
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $PROD_APP \
    --settings \
        NODE_ENV=production \
        PORT=3001 \
        DATABASE_PATH=/app/data/platform.db \
        LOG_LEVEL=warn \
        WEBSITES_PORT=3001 \
    --output table

# Configurar ACR para Production
az webapp config container set \
    --resource-group $RESOURCE_GROUP \
    --name $PROD_APP \
    --docker-custom-image-name "${ACR_SERVER}/triskelgate/payment-platform:latest" \
    --docker-registry-server-url "https://${ACR_SERVER}" \
    --docker-registry-server-user $ACR_USERNAME \
    --docker-registry-server-password $ACR_PASSWORD \
    --output table

# Configurar ACR para Production staging slot
az webapp config container set \
    --resource-group $RESOURCE_GROUP \
    --name $PROD_APP \
    --slot staging \
    --docker-custom-image-name "${ACR_SERVER}/triskelgate/payment-platform:latest" \
    --docker-registry-server-url "https://${ACR_SERVER}" \
    --docker-registry-server-user $ACR_USERNAME \
    --docker-registry-server-password $ACR_PASSWORD \
    --output table

# Crear Application Insights
echo -e "${YELLOW}📊 Creando Application Insights...${NC}"
az monitor app-insights component create \
    --app $INSIGHTS_NAME \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --application-type web \
    --output table

# Obtener Instrumentation Key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
    --app $INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query instrumentationKey -o tsv)

# Configurar Application Insights en las apps
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $STAGING_APP \
    --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY \
    --output none

az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $PROD_APP \
    --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY \
    --output none

# Crear Log Analytics Workspace
echo -e "${YELLOW}📝 Creando Log Analytics Workspace...${NC}"
az monitor log-analytics workspace create \
    --resource-group $RESOURCE_GROUP \
    --workspace-name $LOG_WORKSPACE \
    --location $LOCATION \
    --output table

# Habilitar continuous deployment webhook (opcional)
echo -e "${YELLOW}🔗 Configurando webhooks...${NC}"
az webapp deployment container config \
    --resource-group $RESOURCE_GROUP \
    --name $STAGING_APP \
    --enable-cd true \
    --output table

az webapp deployment container config \
    --resource-group $RESOURCE_GROUP \
    --name $PROD_APP \
    --enable-cd true \
    --output table

# Obtener URLs de las aplicaciones
STAGING_URL=$(az webapp show --resource-group $RESOURCE_GROUP --name $STAGING_APP --query defaultHostName -o tsv)
PROD_URL=$(az webapp show --resource-group $RESOURCE_GROUP --name $PROD_APP --query defaultHostName -o tsv)

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ✅ INFRAESTRUCTURA CREADA                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  📦 Resource Group: $RESOURCE_GROUP"
echo "║  🐳 Container Registry: $ACR_SERVER"
echo "║  🏗️  Staging App: https://$STAGING_URL"
echo "║  🏭 Production App: https://$PROD_URL"
echo "║  📊 Application Insights: $INSIGHTS_NAME"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}📋 PRÓXIMOS PASOS:${NC}"
echo -e "${GREEN}1. Configurar Service Connections en Azure DevOps:${NC}"
echo -e "   - Azure Resource Manager: TriskelGate-Azure-Connection"
echo -e "   - Docker Registry: TriskelGateACR"
echo -e "   - Registry URL: $ACR_SERVER"
echo -e "   - Username: $ACR_USERNAME"
echo -e "   - Password: [Ver Azure Portal]"
echo ""
echo -e "${GREEN}2. Configurar Variable Groups en Azure DevOps:${NC}"
echo -e "   - TriskelGate-Shared"
echo -e "   - TriskelGate-Staging"
echo -e "   - TriskelGate-Production"
echo ""
echo -e "${GREEN}3. Configurar secrets en Azure DevOps:${NC}"
echo -e "   - JWT_SECRET_STAGING"
echo -e "   - JWT_SECRET_PROD"
echo -e "   - STRIPE_SECRET_KEY_STAGING"
echo -e "   - STRIPE_SECRET_KEY_PROD"
echo ""
echo -e "${GREEN}4. Configurar Environments:${NC}"
echo -e "   - TriskelGate-Staging (automatic)"
echo -e "   - TriskelGate-Production (manual approval)"
echo ""
echo -e "${BLUE}🎉 ¡Infraestructura Azure lista para TriskelGate!${NC}"
