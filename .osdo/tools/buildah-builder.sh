#!/bin/bash
# OSDO Buildah Builder - Reemplazo de Docker para OSDO Compliance
# Construye containers usando buildah en lugar de Docker

set -euo pipefail

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="triskelgate-platform"
REGISTRY="triskelgate.azurecr.io"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[OSDO-BUILDAH]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OSDO-BUILDAH]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[OSDO-BUILDAH]${NC} $1"
}

log_error() {
    echo -e "${RED}[OSDO-BUILDAH]${NC} $1"
}

# Verificar que buildah está instalado
check_buildah() {
    if ! command -v buildah &> /dev/null; then
        log_error "buildah no está instalado"
        log_info "Para instalar buildah:"
        log_info "  Ubuntu/Debian: sudo apt-get install buildah"
        log_info "  RHEL/CentOS: sudo yum install buildah"
        log_info "  macOS: brew install buildah"
        exit 1
    fi
    
    log_success "buildah está disponible: $(buildah --version)"
}

# Construir imagen base con buildah
build_base_image() {
    local target="$1"
    local tag="$2"
    
    log_info "Construyendo imagen base $target con buildah..."
    
    cd "$PROJECT_ROOT"
    
    # Crear container base
    local container=$(buildah from node:20-alpine)
    
    # Configurar metadata
    buildah config --label maintainer="TriskelGate Team" "$container"
    buildah config --label version="2.0.0" "$container"
    buildah config --label description="TriskelGate Payment Platform" "$container"
    buildah config --label osdo.compliant="true" "$container"
    buildah config --created-by="OSDO Buildah Builder" "$container"
    
    # Instalar dependencias del sistema
    buildah run "$container" -- apk add --no-cache dumb-init sqlite curl
    
    # Crear usuario no-root para seguridad
    buildah run "$container" -- addgroup -g 1001 -S nodejs
    buildah run "$container" -- adduser -S triskel -u 1001
    
    # Configurar directorio de trabajo
    buildah config --workingdir /app "$container"
    
    # Copiar package files
    buildah copy "$container" package*.json ./
    
    if [ "$target" = "development" ]; then
        # Instalación para desarrollo
        buildah run "$container" -- npm ci
        buildah copy "$container" . .
        buildah config --env NODE_ENV=development "$container"
    else
        # Instalación para producción
        buildah run "$container" -- npm ci --only=production
        buildah run "$container" -- npm cache clean --force
        buildah copy "$container" . .
        buildah run "$container" -- npm run build
        
        # Limpiar archivos innecesarios en producción
        buildah run "$container" -- rm -rf tests/ .git/ .github/ docs/ *.md
        buildah config --env NODE_ENV=production "$container"
    fi
    
    # Crear directorios necesarios
    buildah run "$container" -- mkdir -p data logs public/qr-codes coverage
    buildah run "$container" -- chown -R triskel:nodejs /app
    
    # Configurar usuario no-root
    buildah config --user triskel "$container"
    
    # Configurar variables de entorno
    buildah config --env PORT=3001 "$container"
    buildah config --env NODE_ENV="$target" "$container"
    buildah config --env DATABASE_URL="sqlite:./data/triskelgate.db" "$container"
    
    # Configurar healthcheck
    buildah config --healthcheck "CMD curl -f http://localhost:3001/health || exit 1" "$container"
    buildah config --healthcheck-interval 30s "$container"
    buildah config --healthcheck-timeout 10s "$container"
    buildah config --healthcheck-retries 3 "$container"
    
    # Configurar puerto
    buildah config --port 3001 "$container"
    
    # Configurar entrypoint y comando
    buildah config --entrypoint '["dumb-init", "--"]' "$container"
    buildah config --cmd '["node", "src/index.js"]' "$container"
    
    # Commit la imagen
    buildah commit "$container" "$tag"
    
    # Limpiar container temporal
    buildah rm "$container"
    
    log_success "Imagen $tag construida exitosamente con buildah"
}

# Firmar imagen (para supply chain security)
sign_image() {
    local image="$1"
    
    log_info "Firmando imagen $image..."
    
    # Verificar si cosign está disponible
    if command -v cosign &> /dev/null; then
        # Generar claves si no existen
        if [ ! -f "$HOME/.cosign/cosign.key" ]; then
            log_info "Generando claves de firma..."
            mkdir -p "$HOME/.cosign"
            cosign generate-key-pair --output-key-prefix "$HOME/.cosign/cosign"
        fi
        
        # Firmar imagen
        cosign sign --key "$HOME/.cosign/cosign.key" "$image"
        log_success "Imagen firmada exitosamente"
    else
        log_warning "cosign no está instalado - saltando firma de imagen"
        log_info "Para instalar cosign: curl -O -L https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
    fi
}

# Generar SBOM (Software Bill of Materials)
generate_sbom() {
    local image="$1"
    local output_file="$2"
    
    log_info "Generando SBOM para $image..."
    
    # Usar syft para generar SBOM
    if command -v syft &> /dev/null; then
        syft "$image" -o json > "$output_file"
        log_success "SBOM generado: $output_file"
    else
        log_warning "syft no está instalado - saltando generación de SBOM"
        log_info "Para instalar syft: curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin"
    fi
}

# Escanear imagen con buildah
scan_image() {
    local image="$1"
    
    log_info "Escaneando imagen $image con buildah..."
    
    # Información de la imagen
    buildah inspect "$image" > "/tmp/buildah-inspect-${image//[^a-zA-Z0-9]/-}.json"
    
    # Verificar configuración de seguridad
    log_info "Verificando configuración de seguridad..."
    
    # Verificar que no corre como root
    local user=$(buildah inspect "$image" | jq -r '.OCIv1.config.User // empty')
    if [ -z "$user" ] || [ "$user" = "root" ] || [ "$user" = "0" ]; then
        log_warning "⚠️  Imagen corre como root - riesgo de seguridad"
    else
        log_success "✅ Imagen corre como usuario no-root: $user"
    fi
    
    # Verificar puertos expuestos
    local ports=$(buildah inspect "$image" | jq -r '.OCIv1.config.ExposedPorts // {} | keys[]' 2>/dev/null || echo "")
    if [ -n "$ports" ]; then
        log_info "Puertos expuestos: $ports"
    fi
    
    log_success "Escaneo de configuración completado"
}

# Push a registry
push_image() {
    local image="$1"
    local registry_image="$2"
    
    log_info "Subiendo imagen a registry: $registry_image"
    
    # Tag para registry
    buildah tag "$image" "$registry_image"
    
    # Push
    buildah push "$registry_image"
    
    log_success "Imagen subida exitosamente: $registry_image"
}

# Limpiar imágenes locales
cleanup() {
    log_info "Limpiando imágenes locales..."
    
    buildah rmi "${IMAGE_NAME}:dev" 2>/dev/null || true
    buildah rmi "${IMAGE_NAME}:prod" 2>/dev/null || true
    buildah rmi "${REGISTRY}/${IMAGE_NAME}:dev" 2>/dev/null || true
    buildah rmi "${REGISTRY}/${IMAGE_NAME}:prod" 2>/dev/null || true
    
    # Limpiar containers dangling
    buildah container prune -f 2>/dev/null || true
    
    log_success "Limpieza completada"
}

# Función principal de build
build_images() {
    local environment="${1:-both}"
    local push_to_registry="${2:-false}"
    
    log_info "🔨 Iniciando build con buildah..."
    log_info "Ambiente: $environment"
    log_info "Push a registry: $push_to_registry"
    
    check_buildah
    
    case "$environment" in
        "development"|"dev")
            build_base_image "development" "${IMAGE_NAME}:dev"
            scan_image "${IMAGE_NAME}:dev"
            generate_sbom "${IMAGE_NAME}:dev" ".osdo/results/sbom-dev.json"
            
            if [ "$push_to_registry" = "true" ]; then
                push_image "${IMAGE_NAME}:dev" "${REGISTRY}/${IMAGE_NAME}:dev"
                sign_image "${REGISTRY}/${IMAGE_NAME}:dev"
            fi
            ;;
        "production"|"prod")
            build_base_image "production" "${IMAGE_NAME}:prod"
            scan_image "${IMAGE_NAME}:prod"
            generate_sbom "${IMAGE_NAME}:prod" ".osdo/results/sbom-prod.json"
            
            if [ "$push_to_registry" = "true" ]; then
                push_image "${IMAGE_NAME}:prod" "${REGISTRY}/${IMAGE_NAME}:prod"
                sign_image "${REGISTRY}/${IMAGE_NAME}:prod"
            fi
            ;;
        "both"|"all")
            # Build desarrollo
            build_base_image "development" "${IMAGE_NAME}:dev"
            scan_image "${IMAGE_NAME}:dev"
            generate_sbom "${IMAGE_NAME}:dev" ".osdo/results/sbom-dev.json"
            
            # Build producción
            build_base_image "production" "${IMAGE_NAME}:prod"
            scan_image "${IMAGE_NAME}:prod"
            generate_sbom "${IMAGE_NAME}:prod" ".osdo/results/sbom-prod.json"
            
            if [ "$push_to_registry" = "true" ]; then
                push_image "${IMAGE_NAME}:dev" "${REGISTRY}/${IMAGE_NAME}:dev"
                push_image "${IMAGE_NAME}:prod" "${REGISTRY}/${IMAGE_NAME}:prod"
                sign_image "${REGISTRY}/${IMAGE_NAME}:dev"
                sign_image "${REGISTRY}/${IMAGE_NAME}:prod"
            fi
            ;;
        *)
            log_error "Ambiente no válido: $environment"
            log_info "Ambientes válidos: development, production, both"
            exit 1
            ;;
    esac
    
    log_success "🎉 Build completado con buildah!"
}

# Función de ayuda
show_help() {
    cat << EOF
OSDO Buildah Builder - Reemplazo de Docker para OSDO Compliance

Uso: $0 [COMANDO] [OPCIONES]

COMANDOS:
    build [ENV] [PUSH]     Construir imágenes (dev|prod|both) [true|false]
    scan IMAGE             Escanear imagen específica
    push IMAGE             Subir imagen a registry
    cleanup                Limpiar imágenes locales
    help                   Mostrar esta ayuda

EJEMPLOS:
    $0 build dev           # Construir imagen de desarrollo
    $0 build prod true     # Construir y subir imagen de producción
    $0 build both          # Construir ambas imágenes
    $0 scan triskelgate-platform:dev
    $0 cleanup

VARIABLES DE ENTORNO:
    REGISTRY              Registry de containers (default: triskelgate.azurecr.io)
    IMAGE_NAME           Nombre de la imagen (default: triskelgate-platform)
EOF
}

# Parser de argumentos
case "${1:-build}" in
    "build")
        mkdir -p ".osdo/results"
        build_images "${2:-both}" "${3:-false}"
        ;;
    "scan")
        if [ -z "${2:-}" ]; then
            log_error "Debe especificar una imagen para escanear"
            exit 1
        fi
        scan_image "$2"
        ;;
    "push")
        if [ -z "${2:-}" ]; then
            log_error "Debe especificar una imagen para subir"
            exit 1
        fi
        push_image "$2" "${REGISTRY}/$2"
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Comando no reconocido: $1"
        show_help
        exit 1
        ;;
esac
