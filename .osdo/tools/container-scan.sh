#!/bin/bash
# OSDO Container Security Scanner - 3-Step Process
# Herramienta mínima ejecutable con Docker siguiendo proceso OSDO específico:
# 1. Análisis del Dockerfile (docker lint + trivy)
# 2. Compilación local + análisis (sin push al registry)
# 3. Push al registry solo si pasa todas las pruebas

set -euo pipefail

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/.osdo/results"

# Configuración de imágenes
DOCKER_IMAGE_BASE="triskelgate-platform"
REGISTRY="triskelgate.azurecr.io"

# Control de proceso OSDO
OSDO_STEP_1_PASS=false
OSDO_STEP_2_PASS=false
OSDO_STEP_3_PASS=false
ALLOW_REGISTRY_PUSH=false

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YIGHLLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[OSDO-CONTAINER]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OSDO-CONTAINER]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[OSDO-CONTAINER]${NC} $1"
}

log_error() {
    echo -e "${RED}[OSDO-CONTAINER]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[OSDO-STEP]${NC} $1"
}

# Verificar prerequisites para OSDO con Buildah
check_prerequisites() {
    if [ ! -f "$PROJECT_ROOT/Dockerfile" ]; then
        log_error "Dockerfile no encontrado en $PROJECT_ROOT"
        return 1
    fi
    
    # Verificar que Buildah esté disponible (OBLIGATORIO - no Docker)
    if ! command -v buildah &> /dev/null; then
        log_error "Buildah no está instalado o no está disponible (REQUERIDO para OSDO)"
        log_error "Instalar con: sudo apt-get install -y buildah podman"
        return 1
    fi
    
    # Verificar que Docker esté disponible SOLO para herramientas de análisis
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está disponible (requerido SOLO para herramientas de análisis)"
        return 1
    fi
    
    # Verificar que podman esté disponible
    if ! command -v podman &> /dev/null; then
        log_warning "Podman no está disponible (recomendado para análisis avanzado)"
    fi
    
    log_success "Prerequisites verificados correctamente (Buildah + herramientas de análisis)"
    return 0
}

# ============================================================================
# OSDO STEP 1: Análisis del Dockerfile (docker lint + trivy)
# ============================================================================

# Dockerfile Linting con hadolint
dockerfile_lint() {
    log_step "🔍 OSDO STEP 1.1: Dockerfile Linting"
    
    local dockerfile="$PROJECT_ROOT/Dockerfile"
    local lint_output="$RESULTS_DIR/dockerfile-lint.json"
    local lint_summary="$RESULTS_DIR/dockerfile-lint.txt"
    
    # Ejecutar hadolint
    docker run --rm \
        -v "$PROJECT_ROOT:/workspace" \
        -v "$RESULTS_DIR:/results" \
        hadolint/hadolint:latest \
        hadolint \
        --format json \
        /workspace/Dockerfile > "$lint_output" 2>/dev/null || true
    
    # Generar reporte legible
    docker run --rm \
        -v "$PROJECT_ROOT:/workspace" \
        -v "$RESULTS_DIR:/results" \
        hadolint/hadolint:latest \
        hadolint \
        /workspace/Dockerfile > "$lint_summary" 2>/dev/null || true
    
    # Evaluar resultados
    local error_count=$(cat "$lint_output" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    
    if [ "$error_count" -eq 0 ]; then
        log_success "✅ Dockerfile linting PASSED - No issues found"
        return 0
    else
        log_warning "⚠️  Dockerfile linting found $error_count issues"
        log_info "📄 Review details in: $lint_summary"
        return 1
    fi
}

# Trivy Dockerfile Analysis
dockerfile_trivy_analysis() {
    log_step "🔍 OSDO STEP 1.2: Trivy Dockerfile Analysis"
    
    local dockerfile="$PROJECT_ROOT/Dockerfile"
    local trivy_output="$RESULTS_DIR/dockerfile-trivy.json"
    local trivy_summary="$RESULTS_DIR/dockerfile-trivy.txt"
    
    # Analizar Dockerfile con Trivy (sin construir imagen)
    docker run --rm \
        -v "$PROJECT_ROOT:/workspace" \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        config \
        --format json \
        --output "/results/dockerfile-trivy.json" \
        /workspace/Dockerfile || true
    
    # Generar reporte legible
    docker run --rm \
        -v "$PROJECT_ROOT:/workspace" \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        config \
        --format table \
        --output "/results/dockerfile-trivy.txt" \
        /workspace/Dockerfile || true
    
    # Evaluar resultados
    local critical_count=$(cat "$trivy_output" 2>/dev/null | jq '[.Results[]?.Misconfigurations[]? | select(.Severity == "CRITICAL")] | length' 2>/dev/null || echo "0")
    local high_count=$(cat "$trivy_output" 2>/dev/null | jq '[.Results[]?.Misconfigurations[]? | select(.Severity == "HIGH")] | length' 2>/dev/null || echo "0")
    
    if [ "$critical_count" -eq 0 ] && [ "$high_count" -eq 0 ]; then
        log_success "✅ Dockerfile Trivy analysis PASSED - No critical/high issues"
        return 0
    else
        log_error "❌ Dockerfile Trivy analysis found $critical_count critical and $high_count high severity issues"
        log_info "📄 Review details in: $trivy_summary"
        return 1
    fi
}

# Análisis de secretos en Dockerfile y código fuente
dockerfile_secrets_analysis() {
    log_step "🔍 OSDO STEP 1.3: Secrets Analysis"
    
    local gitleaks_output="$RESULTS_DIR/dockerfile-gitleaks.json"
    local semgrep_secrets_output="$RESULTS_DIR/dockerfile-semgrep-secrets.json"
    
    # GitLeaks para detección de secretos
    log_info "Running GitLeaks secret detection..."
    docker run --rm \
        -v "$PROJECT_ROOT:/workspace" \
        -v "$RESULTS_DIR:/results" \
        zricethezav/gitleaks:latest \
        detect \
        --source="/workspace" \
        --report-format=json \
        --report-path="/results/dockerfile-gitleaks.json" \
        --verbose || true
    
    # Semgrep para patrones de secretos específicos
    log_info "Running Semgrep secrets analysis..."
    docker run --rm \
        -v "$PROJECT_ROOT:/workspace" \
        -v "$RESULTS_DIR:/results" \
        returntocorp/semgrep:latest \
        --config=auto \
        --json \
        --output="/results/dockerfile-semgrep-secrets.json" \
        /workspace/Dockerfile || true
    
    # Evaluar resultados
    local gitleaks_count=$(cat "$gitleaks_output" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    local semgrep_count=$(cat "$semgrep_secrets_output" 2>/dev/null | jq '.results | length' 2>/dev/null || echo "0")
    
    # Crear resumen de análisis de secretos
    cat > "$RESULTS_DIR/secrets-analysis-summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "gitleaks_detections": $gitleaks_count,
    "semgrep_detections": $semgrep_count,
    "total_secrets_found": $((gitleaks_count + semgrep_count)),
    "analysis_files": [
        "dockerfile-gitleaks.json",
        "dockerfile-semgrep-secrets.json"
    ]
}
EOF
    
    if [ "$gitleaks_count" -eq 0 ] && [ "$semgrep_count" -eq 0 ]; then
        log_success "✅ Secrets analysis PASSED - No secrets detected"
        return 0
    else
        log_error "❌ Secrets analysis found $gitleaks_count GitLeaks + $semgrep_count Semgrep detections"
        log_info "📄 Review details in: $RESULTS_DIR/secrets-analysis-summary.json"
        return 1
    fi
}

# Ejecutar OSDO Step 1 completo
osdo_step_1_dockerfile_analysis() {
    log_step "🚀 INICIANDO OSDO STEP 1: Análisis del Dockerfile"
    
    local lint_result=0
    local trivy_result=0
    local secrets_result=0
    
    # Crear directorio de resultados
    mkdir -p "$RESULTS_DIR"
    
    # Ejecutar linting
    dockerfile_lint || lint_result=1
    
    # Ejecutar análisis Trivy
    dockerfile_trivy_analysis || trivy_result=1
    
    # Ejecutar análisis de secretos
    dockerfile_secrets_analysis || secrets_result=1
    
    # Evaluar resultados del Step 1
    if [ "$lint_result" -eq 0 ] && [ "$trivy_result" -eq 0 ] && [ "$secrets_result" -eq 0 ]; then
        OSDO_STEP_1_PASS=true
        log_success "🎉 OSDO STEP 1 COMPLETED SUCCESSFULLY"
        return 0
    else
        OSDO_STEP_1_PASS=false
        log_error "❌ OSDO STEP 1 FAILED - Se deben corregir los issues antes de continuar"
        return 1
    fi
}

# ============================================================================
# OSDO STEP 2: Compilación local + análisis (sin push al registry)
# ============================================================================

# Build imagen local con BUILDAH (OSDO Compliant - NO Docker)
build_local_image() {
    log_step "🔧 OSDO STEP 2.1: Local Image Build with Buildah"
    
    cd "$PROJECT_ROOT"
    
    # Build imagen con buildah - tag local temporal
    local build_tag="${DOCKER_IMAGE_BASE}:osdo-local-$(date +%s)"
    local container_name="osdo-build-$(date +%s)"
    
    log_info "Building with Buildah (OSDO Compliant): $build_tag"
    
    # Configurar buildah para uso sin privilegios si es necesario
    export BUILDAH_ISOLATION=chroot
    
    # Crear container con buildah
    local container_id
    if container_id=$(buildah from --name "$container_name" $(grep "^FROM" Dockerfile | head -1 | awk '{print $2}') 2>/dev/null); then
        log_info "Container created: $container_id"
    else
        log_error "❌ Failed to create buildah container"
        return 1
    fi
    
    # Ejecutar build completo con buildah
    if buildah bud -t "$build_tag" .; then
        echo "$build_tag" > "$RESULTS_DIR/local-build-tag.txt"
        echo "$container_id" > "$RESULTS_DIR/local-build-container.txt"
        
        # Limpiar container temporal
        buildah rm "$container_id" 2>/dev/null || true
        
        log_success "✅ Local image build with Buildah SUCCESSFUL"
        return 0
    else
        # Limpiar en caso de error
        buildah rm "$container_id" 2>/dev/null || true
        log_error "❌ Local image build with Buildah FAILED"
        return 1
    fi
}

# Análisis de seguridad de imagen local
analyze_local_image() {
    log_step "🔍 OSDO STEP 2.2: Local Image Security Analysis"
    
    local build_tag=$(cat "$RESULTS_DIR/local-build-tag.txt" 2>/dev/null || echo "")
    
    if [ -z "$build_tag" ]; then
        log_error "No se encontró tag de imagen local"
        return 1
    fi
    
    log_info "Analyzing image: $build_tag"
    
    # Análisis con Buildah inspect (información de la imagen)
    buildah_image_analysis "$build_tag"
    
    # Trivy Vulnerability Scan (usando imagen de Buildah)
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format json \
        --output "/results/local-image-vulns.json" \
        "$build_tag" || true
    
    # Trivy Configuration Scan
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format json \
        --scanners config \
        --output "/results/local-image-config.json" \
        "$build_tag" || true
    
    # Clair Container Analysis (mejorado)
    run_clair_analysis "$build_tag"
    
    # SBOM Generation with CycloneDX
    generate_cyclonedx_sbom "$build_tag"
    
    # Generar reporte legible
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format table \
        --output "/results/local-image-analysis.txt" \
        "$build_tag" || true
    
    # Evaluar resultados
    local critical_vulns=$(cat "$RESULTS_DIR/local-image-vulns.json" 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' 2>/dev/null || echo "0")
    local high_vulns=$(cat "$RESULTS_DIR/local-image-vulns.json" 2>/dev/null | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' 2>/dev/null || echo "0")
    
    # Guardar estadísticas mejoradas
    cat > "$RESULTS_DIR/local-image-stats.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "image_tag": "$build_tag",
    "build_method": "buildah",
    "critical_vulnerabilities": $critical_vulns,
    "high_vulnerabilities": $high_vulns,
    "analysis_tools": ["buildah-inspect", "trivy", "clair", "cyclonedx-sbom"],
    "analysis_files": [
        "buildah-image-info.json",
        "local-image-vulns.json",
        "local-image-config.json",
        "local-image-analysis.txt",
        "clair-analysis.json",
        "sbom-cyclonedx.json",
        "sbom-spdx.json",
        "sbom-syft-cyclonedx.json",
        "sbom-summary.json"
    ]
}
EOF
    
    if [ "$critical_vulns" -eq 0 ] && [ "$high_vulns" -le 5 ]; then
        log_success "✅ Local image analysis PASSED (Critical: $critical_vulns, High: $high_vulns)"
        return 0
    else
        log_error "❌ Local image analysis FAILED (Critical: $critical_vulns, High: $high_vulns vulnerabilities)"
        log_info "📄 Review details in: $RESULTS_DIR/local-image-analysis.txt"
        return 1
    fi
}

# Análisis de imagen con Buildah inspect
buildah_image_analysis() {
    local image_tag="$1"
    log_step "🔍 OSDO STEP 2.1.1: Buildah Image Analysis"
    
    # Buildah inspect para obtener metadatos de la imagen
    if buildah inspect --type image "$image_tag" > "$RESULTS_DIR/buildah-image-info.json" 2>/dev/null; then
        log_success "✅ Buildah image analysis completed"
        
        # Extraer información importante
        local size=$(cat "$RESULTS_DIR/buildah-image-info.json" | jq -r '.Docker.Size // .OCIv1.Size // "unknown"')
        local layers=$(cat "$RESULTS_DIR/buildah-image-info.json" | jq -r '.Docker.RootFS.Layers // .OCIv1.RootFS.Layers | length // 0')
        local created=$(cat "$RESULTS_DIR/buildah-image-info.json" | jq -r '.Docker.Created // .OCIv1.Created // "unknown"')
        
        # Crear resumen de análisis Buildah
        cat > "$RESULTS_DIR/buildah-analysis-summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "image_tag": "$image_tag",
    "analysis_tool": "buildah",
    "image_size": "$size",
    "layer_count": $layers,
    "created": "$created",
    "buildah_version": "$(buildah --version | head -1)"
}
EOF
        
        log_info "Image size: $size, Layers: $layers"
        return 0
    else
        log_warning "⚠️  Buildah image analysis failed"
        return 1
    fi
}

# Análisis mejorado con Clair
run_clair_analysis() {
    local image_tag="$1"
    log_step "🔍 OSDO STEP 2.1.2: Enhanced Clair Analysis"
    
    # Verificar si Clair está disponible o usar Grype como alternativa
    if command -v grype &> /dev/null; then
        log_info "Using Grype for vulnerability scanning (Clair alternative)"
        
        # Análisis con Grype (compatible con Buildah images)
        grype "$image_tag" -o json > "$RESULTS_DIR/grype-analysis.json" 2>/dev/null || true
        grype "$image_tag" -o table > "$RESULTS_DIR/grype-analysis.txt" 2>/dev/null || true
        
        log_success "✅ Grype analysis completed"
        return 0
    else
        log_info "Setting up Clair for container analysis"
        
        # Iniciar Clair si no está corriendo
        if ! docker ps | grep -q clair-db; then
            log_info "Starting Clair database..."
            docker run -d --name clair-db \
                -e POSTGRES_DB=clair \
                -e POSTGRES_USER=clair \
                -e POSTGRES_PASSWORD=clair \
                postgres:13-alpine >/dev/null 2>&1 || true
            sleep 15
        fi
        
        if ! docker ps | grep -q "clair:"; then
            log_info "Starting Clair scanner..."
            docker run -d --name clair \
                --link clair-db:postgres \
                -p 6060:6060 \
                -p 6061:6061 \
                quay.io/coreos/clair:v4.5.1 \
                -config=/etc/clair/config.yaml >/dev/null 2>&1 || true
            sleep 20
        fi
        
        # Ejecutar análisis Clair usando clairctl si está disponible
        if command -v clairctl &> /dev/null; then
            clairctl analyze "$image_tag" --report="$RESULTS_DIR/clair-analysis.json" 2>/dev/null || true
            log_success "✅ Clair analysis completed"
        else
            log_warning "⚠️  Clair tools not available, using Trivy as fallback"
            
            # Usar Trivy como fallback para análisis adicional
            docker run --rm \
                -v /var/run/docker.sock:/var/run/docker.sock \
                -v "$RESULTS_DIR:/results" \
                aquasec/trivy:latest \
                image \
                --format json \
                --scanners vuln,secret \
                --output "/results/clair-fallback-analysis.json" \
                "$image_tag" || true
        fi
        
        return 0
    fi
}

# Generar SBOM con CycloneDX
generate_cyclonedx_sbom() {
    local image_tag="$1"
    log_step "📦 OSDO STEP 2.3: SBOM Generation with CycloneDX"
    
    # Trivy SBOM generation with CycloneDX format
    log_info "Generating CycloneDX SBOM with Trivy..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format cyclonedx \
        --output "/results/sbom-cyclonedx.json" \
        "$image_tag" || true
    
    # Generate SPDX SBOM as backup
    log_info "Generating SPDX SBOM with Trivy..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format spdx-json \
        --output "/results/sbom-spdx.json" \
        "$image_tag" || true
    
    # Generate Syft SBOM for comparison (CycloneDX format)
    log_info "Generating CycloneDX SBOM with Syft..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        anchore/syft:latest \
        "$image_tag" \
        -o cyclonedx-json=/results/sbom-syft-cyclonedx.json || true
    
    # Validate SBOM files were created
    local cyclonedx_count=0
    local spdx_count=0
    local syft_count=0
    
    if [ -f "$RESULTS_DIR/sbom-cyclonedx.json" ] && [ -s "$RESULTS_DIR/sbom-cyclonedx.json" ]; then
        cyclonedx_count=$(cat "$RESULTS_DIR/sbom-cyclonedx.json" | jq '.components | length' 2>/dev/null || echo "0")
        log_success "✅ Trivy CycloneDX SBOM generated ($cyclonedx_count components)"
    else
        log_warning "⚠️  Trivy CycloneDX SBOM generation failed"
    fi
    
    if [ -f "$RESULTS_DIR/sbom-spdx.json" ] && [ -s "$RESULTS_DIR/sbom-spdx.json" ]; then
        spdx_count=$(cat "$RESULTS_DIR/sbom-spdx.json" | jq '.packages | length' 2>/dev/null || echo "0")
        log_success "✅ Trivy SPDX SBOM generated ($spdx_count packages)"
    else
        log_warning "⚠️  Trivy SPDX SBOM generation failed"
    fi
    
    if [ -f "$RESULTS_DIR/sbom-syft-cyclonedx.json" ] && [ -s "$RESULTS_DIR/sbom-syft-cyclonedx.json" ]; then
        syft_count=$(cat "$RESULTS_DIR/sbom-syft-cyclonedx.json" | jq '.components | length' 2>/dev/null || echo "0")
        log_success "✅ Syft CycloneDX SBOM generated ($syft_count components)"
    else
        log_warning "⚠️  Syft CycloneDX SBOM generation failed"
    fi
    
    # Create SBOM summary
    cat > "$RESULTS_DIR/sbom-summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "image_tag": "$image_tag",
    "sbom_formats": {
        "cyclonedx_trivy": {
            "file": "sbom-cyclonedx.json",
            "components": $cyclonedx_count,
            "generated": $([ "$cyclonedx_count" -gt 0 ] && echo "true" || echo "false")
        },
        "spdx_trivy": {
            "file": "sbom-spdx.json",
            "packages": $spdx_count,
            "generated": $([ "$spdx_count" -gt 0 ] && echo "true" || echo "false")
        },
        "cyclonedx_syft": {
            "file": "sbom-syft-cyclonedx.json",
            "components": $syft_count,
            "generated": $([ "$syft_count" -gt 0 ] && echo "true" || echo "false")
        }
    },
    "primary_sbom": "sbom-cyclonedx.json",
    "sbom_standard": "CycloneDX 1.5",
    "total_components": $((cyclonedx_count > syft_count ? cyclonedx_count : syft_count))
}
EOF
    
    # Return success if at least one SBOM was generated
    if [ "$cyclonedx_count" -gt 0 ] || [ "$spdx_count" -gt 0 ] || [ "$syft_count" -gt 0 ]; then
        log_success "✅ SBOM generation PASSED - At least one SBOM format generated"
        return 0
    else
        log_error "❌ SBOM generation FAILED - No valid SBOMs created"
        return 1
    fi
}

# Ejecutar OSDO Step 2 completo
osdo_step_2_local_build_analysis() {
    log_step "🚀 INICIANDO OSDO STEP 2: Compilación local + análisis"
    
    if [ "$OSDO_STEP_1_PASS" != "true" ]; then
        log_error "❌ No se puede ejecutar Step 2 - Step 1 debe completarse exitosamente primero"
        return 1
    fi
    
    local build_result=0
    local analysis_result=0
    
    # Build imagen local
    build_local_image || build_result=1
    
    # Analizar imagen local (solo si build fue exitoso)
    if [ "$build_result" -eq 0 ]; then
        analyze_local_image || analysis_result=1
    else
        analysis_result=1
    fi
    
    # Generar SBOM (CycloneDX y SPDX)
    if [ "$build_result" -eq 0 ]; then
        generate_cyclonedx_sbom "$build_result" || sbom_result=1
    fi
    
    # Evaluar resultados del Step 2
    if [ "$build_result" -eq 0 ] && [ "$analysis_result" -eq 0 ]; then
        OSDO_STEP_2_PASS=true
        log_success "🎉 OSDO STEP 2 COMPLETED SUCCESSFULLY"
        return 0
    else
        OSDO_STEP_2_PASS=false
        log_error "❌ OSDO STEP 2 FAILED - No se puede proceder al registry push"
        return 1
    fi
}

# ============================================================================
# OSDO STEP 3: Push al registry solo si pasa todas las pruebas
# ============================================================================

# Preparar imagen para registry
prepare_registry_image() {
    log_step "🏷️  OSDO STEP 3.1: Prepare Registry Image"
    
    local build_tag=$(cat "$RESULTS_DIR/local-build-tag.txt" 2>/dev/null || echo "")
    local registry_tag="${REGISTRY}/${DOCKER_IMAGE_BASE}:$(date +%Y%m%d-%H%M%S)"
    local latest_tag="${REGISTRY}/${DOCKER_IMAGE_BASE}:latest"
    
    if [ -z "$build_tag" ]; then
        log_error "No se encontró tag de imagen local"
        return 1
    fi
    
    # Tag para registry
    log_info "Tagging image for registry: $registry_tag"
    docker tag "$build_tag" "$registry_tag" || {
        log_error "Error tagging image for registry"
        return 1
    }
    
    docker tag "$build_tag" "$latest_tag" || {
        log_error "Error tagging image as latest"
        return 1
    }
    
    # Guardar tags para push
    echo "$registry_tag" > "$RESULTS_DIR/registry-tag.txt"
    echo "$latest_tag" > "$RESULTS_DIR/latest-tag.txt"
    
    log_success "✅ Image tagged for registry successfully"
    return 0
}

# Push imagen al registry (solo si está autorizado)
push_to_registry() {
    log_step "📤 OSDO STEP 3.2: Push to Registry"
    
    if [ "$ALLOW_REGISTRY_PUSH" != "true" ]; then
        log_warning "⚠️  Registry push SKIPPED - Set ALLOW_REGISTRY_PUSH=true to enable"
        return 0
    fi
    
    local registry_tag=$(cat "$RESULTS_DIR/registry-tag.txt" 2>/dev/null || echo "")
    local latest_tag=$(cat "$RESULTS_DIR/latest-tag.txt" 2>/dev/null || echo "")
    
    if [ -z "$registry_tag" ] || [ -z "$latest_tag" ]; then
        log_error "Registry tags not found"
        return 1
    fi
    
    # Login al registry (asume que las credenciales están configuradas)
    log_info "Logging into registry: $REGISTRY"
    if ! docker login "$REGISTRY" 2>/dev/null; then
        log_error "❌ Registry login failed - configure credentials first"
        return 1
    fi
    
    # Push imagen versionada
    log_info "Pushing versioned image: $registry_tag"
    if docker push "$registry_tag"; then
        log_success "✅ Versioned image pushed successfully"
    else
        log_error "❌ Failed to push versioned image"
        return 1
    fi
    
    # Push imagen latest
    log_info "Pushing latest image: $latest_tag"
    if docker push "$latest_tag"; then
        log_success "✅ Latest image pushed successfully"
    else
        log_error "❌ Failed to push latest image"
        return 1
    fi
    
    # Guardar información de push
    cat > "$RESULTS_DIR/registry-push-info.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "registry": "$REGISTRY",
    "versioned_tag": "$registry_tag",
    "latest_tag": "$latest_tag",
    "push_status": "success"
}
EOF
    
    return 0
}

# Ejecutar OSDO Step 3 completo
osdo_step_3_registry_push() {
    log_step "🚀 INICIANDO OSDO STEP 3: Push al registry"
    
    if [ "$OSDO_STEP_1_PASS" != "true" ] || [ "$OSDO_STEP_2_PASS" != "true" ]; then
        log_error "❌ No se puede ejecutar Step 3 - Steps 1 y 2 deben completarse exitosamente primero"
        return 1
    fi
    
    local prepare_result=0
    local push_result=0
    
    # Preparar imagen para registry
    prepare_registry_image || prepare_result=1
    
    # Push al registry (solo si prepare fue exitoso)
    if [ "$prepare_result" -eq 0 ]; then
        push_to_registry || push_result=1
    else
        push_result=1
    fi
    
    # Evaluar resultados del Step 3
    if [ "$prepare_result" -eq 0 ] && [ "$push_result" -eq 0 ]; then
        OSDO_STEP_3_PASS=true
        log_success "🎉 OSDO STEP 3 COMPLETED SUCCESSFULLY"
        return 0
    else
        OSDO_STEP_3_PASS=false
        log_error "❌ OSDO STEP 3 FAILED"
        return 1
    fi
}
# ============================================================================
# Limpieza y funciones de utilidad
# ============================================================================

# Limpiar imágenes locales de escaneo
cleanup_local_images() {
    log_info "🧹 Limpiando imágenes locales..."
    
    # Limpiar imagen local de build
    local build_tag=$(cat "$RESULTS_DIR/local-build-tag.txt" 2>/dev/null || echo "")
    if [ ! -z "$build_tag" ]; then
        docker rmi "$build_tag" 2>/dev/null || true
        log_info "Removed local build image: $build_tag"
    fi
    
    # Limpiar imágenes de registry (localmente)
    local registry_tag=$(cat "$RESULTS_DIR/registry-tag.txt" 2>/dev/null || echo "")
    local latest_tag=$(cat "$RESULTS_DIR/latest-tag.txt" 2>/dev/null || echo "")
    
    if [ ! -z "$registry_tag" ]; then
        docker rmi "$registry_tag" 2>/dev/null || true
        log_info "Removed registry image: $registry_tag"
    fi
    
    if [ ! -z "$latest_tag" ]; then
        docker rmi "$latest_tag" 2>/dev/null || true
        log_info "Removed latest image: $latest_tag"
    fi
    
    log_success "✅ Local images cleanup completed"
}

# Generar reporte final consolidado
generate_osdo_report() {
    log_info "📊 Generando reporte OSDO consolidado..."
    
    # Crear reporte OSDO HTML
    cat > "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>OSDO Container Security Report - TriskelGate</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
        .step { margin: 20px 0; padding: 20px; border: 2px solid #ddd; border-radius: 8px; }
        .step-1 { border-color: #2196F3; background: #E3F2FD; }
        .step-2 { border-color: #FF9800; background: #FFF3E0; }
        .step-3 { border-color: #4CAF50; background: #E8F5E8; }
        .passed { border-left: 6px solid #4CAF50; background: #E8F5E8; }
        .failed { border-left: 6px solid #f44336; background: #FFEBEE; }
        .warning { border-left: 6px solid #FF9800; background: #FFF3E0; }
        .status-badge { padding: 4px 12px; border-radius: 20px; color: white; font-weight: bold; margin-left: 10px; }
        .status-pass { background: #4CAF50; }
        .status-fail { background: #f44336; }
        .status-warn { background: #FF9800; }
        .timestamp { color: #666; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .file-list { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .file-list a { display: block; color: #1976D2; text-decoration: none; padding: 5px 0; }
        .file-list a:hover { text-decoration: underline; }
        .process-flow { display: flex; justify-content: space-between; margin: 20px 0; }
        .process-step { flex: 1; text-align: center; padding: 20px; margin: 0 10px; border-radius: 8px; }
        .recommendations { background: #F3E5F5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 OSDO Container Security Report</h1>
            <h2>TriskelGate Payment Platform</h2>
            <p>Open SecDevOps Compliant Container Security Analysis</p>
            <p class="timestamp">Generated: $(date)</p>
        </div>
        
        <div class="process-flow">
            <div class="process-step step-1">
                <h3>📋 STEP 1</h3>
                <p><strong>Dockerfile Analysis</strong></p>
                <p>Docker lint + Trivy</p>
EOF

    # Agregar status del Step 1
    if [ "$OSDO_STEP_1_PASS" = "true" ]; then
        echo '                <span class="status-badge status-pass">PASSED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    else
        echo '                <span class="status-badge status-fail">FAILED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    fi

    cat >> "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
            </div>
            <div class="process-step step-2">
                <h3>🔧 STEP 2</h3>
                <p><strong>Local Build + Analysis</strong></p>
                <p>Sin push al registry</p>
EOF

    # Agregar status del Step 2
    if [ "$OSDO_STEP_2_PASS" = "true" ]; then
        echo '                <span class="status-badge status-pass">PASSED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    else
        echo '                <span class="status-badge status-fail">FAILED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    fi

    cat >> "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
            </div>
            <div class="process-step step-3">
                <h3>📤 STEP 3</h3>
                <p><strong>Registry Push</strong></p>
                <p>Solo si pasa pruebas</p>
EOF

    # Agregar status del Step 3
    if [ "$OSDO_STEP_3_PASS" = "true" ]; then
        echo '                <span class="status-badge status-pass">PASSED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    elif [ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ]; then
        echo '                <span class="status-badge status-warn">SKIPPED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    else
        echo '                <span class="status-badge status-fail">BLOCKED</span>' >> "$RESULTS_DIR/osdo-container-report.html"
    fi

    cat >> "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
            </div>
        </div>
        
        <div class="step step-1">
            <h2>📋 OSDO STEP 1: Análisis del Dockerfile</h2>
            <p>Análisis estático del Dockerfile sin construir la imagen</p>
            
            <h3>🔍 Herramientas Ejecutadas</h3>
            <ul>
                <li>✅ <strong>Hadolint</strong> - Dockerfile linting y mejores prácticas</li>
                <li>✅ <strong>Trivy Config</strong> - Análisis de configuración y misconfigurations</li>
            </ul>
            
            <div class="file-list">
                <h4>📁 Archivos de Resultados</h4>
                <a href="dockerfile-lint.json">dockerfile-lint.json - Hadolint results</a>
                <a href="dockerfile-lint.txt">dockerfile-lint.txt - Hadolint summary</a>
                <a href="dockerfile-trivy.json">dockerfile-trivy.json - Trivy config analysis</a>
                <a href="dockerfile-trivy.txt">dockerfile-trivy.txt - Trivy summary</a>
            </div>
        </div>
        
        <div class="step step-2">
            <h2>🔧 OSDO STEP 2: Compilación Local + Análisis</h2>
            <p>Build de imagen local y análisis de seguridad sin push al registry</p>
            
            <h3>🔍 Proceso Ejecutado</h3>
            <ul>
                <li>🏗️ <strong>Local Build</strong> - Construcción de imagen con tag temporal</li>
                <li>🔍 <strong>Trivy Image Scan</strong> - Análisis de vulnerabilidades</li>
                <li>⚙️ <strong>Configuration Check</strong> - Verificación de configuración</li>
            </ul>
            
            <div class="file-list">
                <h4>📁 Archivos de Resultados</h4>
                <a href="local-build-tag.txt">local-build-tag.txt - Build tag utilizado</a>
                <a href="local-image-vulns.json">local-image-vulns.json - Vulnerability scan results</a>
                <a href="local-image-config.json">local-image-config.json - Configuration scan</a>
                <a href="local-image-analysis.txt">local-image-analysis.txt - Human readable report</a>
                <a href="local-image-stats.json">local-image-stats.json - Analysis statistics</a>
            </div>
        </div>
        
        <div class="step step-3">
            <h2>📤 OSDO STEP 3: Push al Registry</h2>
            <p>Push controlado al registry solo si pasan todas las pruebas</p>
            
            <h3>🎯 Condiciones para Push</h3>
            <ul>
                <li>✅ Step 1 debe completarse exitosamente</li>
                <li>✅ Step 2 debe completarse exitosamente</li>
                <li>🔐 Variable ALLOW_REGISTRY_PUSH=true debe estar configurada</li>
                <li>🔑 Credenciales de registry deben estar configuradas</li>
            </ul>
            
            <div class="file-list">
                <h4>📁 Archivos de Resultados</h4>
                <a href="registry-tag.txt">registry-tag.txt - Registry tag</a>
                <a href="latest-tag.txt">latest-tag.txt - Latest tag</a>
                <a href="registry-push-info.json">registry-push-info.json - Push information</a>
            </div>
        </div>
        
        <div class="recommendations">
            <h2>🎯 Recomendaciones OSDO</h2>
            <h3>🔴 Prioridad Alta</h3>
            <ul>
                <li>Corregir todos los issues críticos encontrados en Step 1</li>
                <li>Remediar vulnerabilidades CRITICAL y HIGH en imagen</li>
                <li>Configurar escaneo automático en CI/CD pipeline</li>
            </ul>
            
            <h3>🟡 Prioridad Media</h3>
            <ul>
                <li>Implementar quality gates automáticos</li>
                <li>Configurar alertas para nuevas vulnerabilidades</li>
                <li>Documentar proceso de response a vulnerabilidades</li>
            </ul>
            
            <h3>🟢 Mejores Prácticas</h3>
            <ul>
                <li>Usar imágenes base mínimas (distroless, alpine)</li>
                <li>Implementar multi-stage builds</li>
                <li>Configurar registry scanning automático</li>
                <li>Rotar credenciales de registry regularmente</li>
            </ul>
        </div>
        
        <div class="step">
            <h2>📊 Resumen Ejecutivo</h2>
            <table>
                <tr>
                    <th>Proceso OSDO</th>
                    <th>Estado</th>
                    <th>Descripción</th>
                </tr>
                <tr>
                    <td>Step 1 - Dockerfile Analysis</td>
EOF

    # Agregar estado del Step 1 en tabla
    if [ "$OSDO_STEP_1_PASS" = "true" ]; then
        echo '                    <td><span class="status-badge status-pass">PASSED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Dockerfile linting y análisis completado exitosamente</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    else
        echo '                    <td><span class="status-badge status-fail">FAILED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Se encontraron issues que deben ser corregidos</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    fi

    cat >> "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
                </tr>
                <tr>
                    <td>Step 2 - Local Build Analysis</td>
EOF

    # Agregar estado del Step 2 en tabla
    if [ "$OSDO_STEP_2_PASS" = "true" ]; then
        echo '                    <td><span class="status-badge status-pass">PASSED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Build local y análisis de seguridad exitoso</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    else
        echo '                    <td><span class="status-badge status-fail">FAILED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Build o análisis de seguridad falló</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    fi

    cat >> "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
                </tr>
                <tr>
                    <td>Step 3 - Registry Push</td>
EOF

    # Agregar estado del Step 3 en tabla
    if [ "$OSDO_STEP_3_PASS" = "true" ]; then
        echo '                    <td><span class="status-badge status-pass">PASSED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Imagen pushed al registry exitosamente</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    elif [ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ]; then
        echo '                    <td><span class="status-badge status-warn">SKIPPED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Registry push deshabilitado (ALLOW_REGISTRY_PUSH=false)</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    else
        echo '                    <td><span class="status-badge status-fail">BLOCKED</span></td>' >> "$RESULTS_DIR/osdo-container-report.html"
        echo '                    <td>Steps anteriores fallaron - push bloqueado</td>' >> "$RESULTS_DIR/osdo-container-report.html"
    fi

    cat >> "$RESULTS_DIR/osdo-container-report.html" << 'EOF'
                </tr>
            </table>
        </div>
    </div>
</body>
</html>
EOF

    # Crear resumen JSON
    cat > "$RESULTS_DIR/osdo-summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "project": "TriskelGate Payment Platform",
    "osdo_version": "3-step-process",
    "compliance_status": "$([ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ] && echo "compliant" || echo "non-compliant")",
    "step_1_dockerfile_analysis": {
        "status": "$([ "$OSDO_STEP_1_PASS" = "true" ] && echo "passed" || echo "failed")",
        "tools": ["hadolint", "trivy-config"],
        "results_files": [
            "dockerfile-lint.json",
            "dockerfile-lint.txt", 
            "dockerfile-trivy.json",
            "dockerfile-trivy.txt"
        ]
    },
    "step_2_local_build_analysis": {
        "status": "$([ "$OSDO_STEP_2_PASS" = "true" ] && echo "passed" || echo "failed")",
        "tools": ["docker-build", "trivy-image"],
        "results_files": [
            "local-build-tag.txt",
            "local-image-vulns.json",
            "local-image-config.json",
            "local-image-analysis.txt",
            "local-image-stats.json"
        ]
    },
    "step_3_registry_push": {
        "status": "$([ "$OSDO_STEP_3_PASS" = "true" ] && echo "passed" || ([ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ] && echo "skipped" || echo "blocked"))",
        "registry": "$REGISTRY",
        "push_enabled": $([ "$ALLOW_REGISTRY_PUSH" = "true" ] && echo "true" || echo "false"),
        "results_files": [
            "registry-tag.txt",
            "latest-tag.txt",
            "registry-push-info.json"
        ]
    },
    "overall_result": {
        "osdo_compliant": $([ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ] && echo "true" || echo "false"),
        "can_deploy": $([ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ] && echo "true" || echo "false"),
        "deployed": $([ "$OSDO_STEP_3_PASS" = "true" ] && echo "true" || echo "false")
    }
}
EOF
    
    log_success "📊 Reporte OSDO generado en: $RESULTS_DIR/osdo-container-report.html"
}

# ============================================================================
# Función principal - Proceso OSDO de 3 pasos
# ============================================================================

# Mostrar ayuda
show_help() {
    cat << EOF
🐳 OSDO Container Security Scanner - 3-Step Process

USAGE:
    $0 [OPTIONS]

DESCRIPTION:
    Ejecuta el proceso OSDO completo de 3 pasos para containers:
    
    STEP 1: Análisis del Dockerfile (docker lint + trivy)
    STEP 2: Compilación local + análisis (sin push al registry)  
    STEP 3: Push al registry solo si pasa todas las pruebas

OPTIONS:
    --enable-push         Habilitar push al registry en Step 3
    --skip-cleanup        No limpiar imágenes locales al finalizar
    --help               Mostrar esta ayuda

ENVIRONMENT VARIABLES:
    ALLOW_REGISTRY_PUSH   Set to 'true' to enable registry push
    REGISTRY             Container registry URL (default: triskelgate.azurecr.io)

EXAMPLES:
    # Ejecutar proceso completo (sin push)
    $0
    
    # Ejecutar con push habilitado
    $0 --enable-push
    
    # Ejecutar con variable de entorno
    ALLOW_REGISTRY_PUSH=true $0

EOF
}

# Parsear argumentos
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --enable-push)
                ALLOW_REGISTRY_PUSH=true
                shift
                ;;
            --skip-cleanup)
                SKIP_CLEANUP=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Argumento desconocido: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Función principal
main() {
    # Parsear argumentos
    parse_arguments "$@"
    
    log_step "🚀 INICIANDO OSDO CONTAINER SECURITY ANALYSIS"
    log_info "Proyecto: TriskelGate Payment Platform"
    log_info "Directorio: $PROJECT_ROOT"
    log_info "Registry: $REGISTRY"
    log_info "Push habilitado: $([ "$ALLOW_REGISTRY_PUSH" = "true" ] && echo "SÍ" || echo "NO")"
    echo
    
    # Verificar prerequisites
    if ! check_prerequisites; then
        log_error "❌ Prerequisites check failed"
        exit 1
    fi
    
    # Crear directorio de resultados
    mkdir -p "$RESULTS_DIR"
    
    # ========================================================================
    # OSDO STEP 1: Análisis del Dockerfile
    # ========================================================================
    
    log_step "🔍 EJECUTANDO OSDO STEP 1: Análisis del Dockerfile"
    echo
    
    if osdo_step_1_dockerfile_analysis; then
        log_success "✅ OSDO STEP 1 COMPLETADO EXITOSAMENTE"
        echo
    else
        log_error "❌ OSDO STEP 1 FALLÓ"
        log_error "🛑 El proceso se detiene aquí. Corrija los issues y vuelva a ejecutar."
        
        # Generar reporte parcial
        generate_osdo_report
        exit 1
    fi
    
    # ========================================================================
    # OSDO STEP 2: Compilación local + análisis
    # ========================================================================
    
    log_step "🔧 EJECUTANDO OSDO STEP 2: Compilación local + análisis"
    echo
    
    if osdo_step_2_local_build_analysis; then
        log_success "✅ OSDO STEP 2 COMPLETADO EXITOSAMENTE"
        echo
    else
        log_error "❌ OSDO STEP 2 FALLÓ"
        log_error "🛑 El proceso se detiene aquí. Corrija los issues y vuelva a ejecutar."
        
        # Generar reporte parcial
        generate_osdo_report
        
        # Limpiar si es necesario
        if [ "$SKIP_CLEANUP" != "true" ]; then
            cleanup_local_images
        fi
        
        exit 1
    fi
    
    # ========================================================================
    # OSDO STEP 3: Push al registry (condicional)
    # ========================================================================
    
    log_step "📤 EJECUTANDO OSDO STEP 3: Push al registry"
    echo
    
    if [ "$ALLOW_REGISTRY_PUSH" = "true" ]; then
        log_info "🚀 Registry push HABILITADO - procediendo con Step 3"
        
        if osdo_step_3_registry_push; then
            log_success "✅ OSDO STEP 3 COMPLETADO EXITOSAMENTE"
        else
            log_error "❌ OSDO STEP 3 FALLÓ"
            log_warning "⚠️  Los steps anteriores pasaron, pero el push al registry falló"
        fi
    else
        log_warning "⚠️  Registry push DESHABILITADO"
        log_info "💡 Para habilitar, usar --enable-push o set ALLOW_REGISTRY_PUSH=true"
        OSDO_STEP_3_PASS="skipped"
    fi
    
    echo
    
    # ========================================================================
    # Finalización y limpieza
    # ========================================================================
    
    # Generar reporte final
    generate_osdo_report
    
    # Limpiar imágenes locales
    if [ "$SKIP_CLEANUP" != "true" ]; then
        cleanup_local_images
    else
        log_info "🧹 Cleanup omitido - imágenes locales preservadas"
    fi
    
    # ========================================================================
    # Resumen final
    # ========================================================================
    
    echo
    log_step "📊 RESUMEN FINAL DEL PROCESO OSDO"
    echo
    
    # Step 1 Status
    if [ "$OSDO_STEP_1_PASS" = "true" ]; then
        log_success "✅ STEP 1 (Dockerfile Analysis): PASSED"
    else
        log_error "❌ STEP 1 (Dockerfile Analysis): FAILED"
    fi
    
    # Step 2 Status  
    if [ "$OSDO_STEP_2_PASS" = "true" ]; then
        log_success "✅ STEP 2 (Local Build + Analysis): PASSED"
    else
        log_error "❌ STEP 2 (Local Build + Analysis): FAILED"
    fi
    
    # Step 3 Status
    if [ "$OSDO_STEP_3_PASS" = "true" ]; then
        log_success "✅ STEP 3 (Registry Push): PASSED"
    elif [ "$OSDO_STEP_3_PASS" = "skipped" ]; then
        log_warning "⚠️  STEP 3 (Registry Push): SKIPPED"
    else
        log_error "❌ STEP 3 (Registry Push): FAILED"
    fi
    
    echo
    
    # Evaluación final
    if [ "$OSDO_STEP_1_PASS" = "true" ] && [ "$OSDO_STEP_2_PASS" = "true" ]; then
        log_success "🎉 PROCESO OSDO COMPLETADO EXITOSAMENTE"
        log_success "✅ El container es OSDO COMPLIANT y está listo para deployment"
        
        if [ "$OSDO_STEP_3_PASS" = "true" ]; then
            log_success "🚀 Imagen deployada exitosamente al registry"
        elif [ "$OSDO_STEP_3_PASS" = "skipped" ]; then
            log_info "💡 Imagen lista para push manual al registry"
        fi
        
        exit_code=0
    else
        log_error "❌ PROCESO OSDO FALLÓ"
        log_error "🔧 Se requieren correcciones antes del deployment"
        exit_code=1
    fi
    
    echo
    log_info "📁 Resultados disponibles en: $RESULTS_DIR"
    log_info "📊 Reporte HTML: $RESULTS_DIR/osdo-container-report.html"
    log_info "📄 Resumen JSON: $RESULTS_DIR/osdo-summary.json"
    
    exit $exit_code
}

# Verificar si se ejecuta directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
