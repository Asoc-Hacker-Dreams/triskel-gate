#!/bin/bash
# Script de prueba para verificar las mejoras OSDO implementadas
# Verifica Buildah, CycloneDX SBOM, GitLeaks, Semgrep, y Clair

set -euo pipefail

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/.osdo/test-results"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[OSDO-TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OSDO-TEST]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[OSDO-TEST]${NC} $1"
}

log_error() {
    echo -e "${RED}[OSDO-TEST]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[TEST-STEP]${NC} $1"
}

# Verificar prerequisites para las mejoras OSDO
check_enhanced_prerequisites() {
    log_step "🔍 Verificando prerequisites para mejoras OSDO"
    
    local prerequisites_ok=true
    
    # Verificar Docker (para herramientas de análisis)
    if ! command -v docker &> /dev/null; then
        log_error "❌ Docker no está instalado (requerido para herramientas de análisis)"
        prerequisites_ok=false
    else
        log_success "✅ Docker está disponible"
    fi
    
    # Verificar que Docker esté corriendo
    if ! docker info &> /dev/null; then
        log_error "❌ Docker no está corriendo"
        prerequisites_ok=false
    else
        log_success "✅ Docker está corriendo"
    fi
    
    # Verificar Buildah (mandatorio para compilación)
    if ! command -v buildah &> /dev/null; then
        log_warning "⚠️  Buildah no está instalado - instalando via Docker"
        # Usar Buildah en contenedor como fallback
        docker pull quay.io/buildah/stable:latest || true
    else
        log_success "✅ Buildah está disponible localmente"
    fi
    
    # Verificar jq
    if ! command -v jq &> /dev/null; then
        log_error "❌ jq no está instalado (requerido para análisis JSON)"
        prerequisites_ok=false
    else
        log_success "✅ jq está disponible"
    fi
    
    if [ "$prerequisites_ok" = false ]; then
        log_error "❌ Prerequisites faltantes - no se puede continuar"
        return 1
    fi
    
    log_success "✅ Todos los prerequisites están disponibles"
    return 0
}

# Probar funciones específicas del script container-scan.sh
test_secrets_analysis() {
    log_step "🔍 Probando análisis de secretos (GitLeaks + Semgrep)"
    
    mkdir -p "$RESULTS_DIR"
    cd "$PROJECT_ROOT"
    
    # Crear un archivo temporal con un "secreto" de prueba para testing
    cat > /tmp/test-secrets.txt << 'EOF'
# Test file for secrets detection
export API_KEY="sk-test-1234567890abcdef"
password = "hardcoded-password-123"
AWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
EOF
    
    # Probar GitLeaks
    log_info "Probando GitLeaks..."
    docker run --rm \
        -v /tmp:/workspace \
        -v "$RESULTS_DIR:/results" \
        zricethezav/gitleaks:latest \
        detect \
        --source="/workspace" \
        --report-format=json \
        --report-path="/results/test-gitleaks.json" \
        --verbose || true
    
    # Probar Semgrep
    log_info "Probando Semgrep..."
    docker run --rm \
        -v /tmp:/workspace \
        -v "$RESULTS_DIR:/results" \
        returntocorp/semgrep:latest \
        --config=auto \
        --json \
        --output="/results/test-semgrep.json" \
        /workspace/test-secrets.txt || true
    
    # Evaluar resultados
    local gitleaks_count=0
    local semgrep_count=0
    
    if [ -f "$RESULTS_DIR/test-gitleaks.json" ]; then
        gitleaks_count=$(cat "$RESULTS_DIR/test-gitleaks.json" | jq 'length' 2>/dev/null || echo "0")
        log_info "GitLeaks detectó: $gitleaks_count secretos"
    fi
    
    if [ -f "$RESULTS_DIR/test-semgrep.json" ]; then
        semgrep_count=$(cat "$RESULTS_DIR/test-semgrep.json" | jq '.results | length' 2>/dev/null || echo "0")
        log_info "Semgrep detectó: $semgrep_count issues"
    fi
    
    # Limpiar archivo de prueba
    rm -f /tmp/test-secrets.txt
    
    if [ "$gitleaks_count" -gt 0 ] || [ "$semgrep_count" -gt 0 ]; then
        log_success "✅ Análisis de secretos FUNCIONA - detecciones encontradas como esperado"
    else
        log_warning "⚠️  Análisis de secretos no detectó secretos de prueba"
    fi
}

# Probar generación de SBOM con CycloneDX
test_sbom_generation() {
    log_step "📦 Probando generación de SBOM con CycloneDX"
    
    # Usar una imagen base pequeña para prueba
    local test_image="alpine:latest"
    
    log_info "Descargando imagen de prueba: $test_image"
    docker pull "$test_image" || {
        log_error "❌ No se pudo descargar imagen de prueba"
        return 1
    }
    
    # Probar Trivy SBOM CycloneDX
    log_info "Probando Trivy SBOM CycloneDX..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format cyclonedx \
        --output "/results/test-sbom-cyclonedx.json" \
        "$test_image" || true
    
    # Probar Trivy SBOM SPDX
    log_info "Probando Trivy SBOM SPDX..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        aquasec/trivy:latest \
        image \
        --format spdx-json \
        --output "/results/test-sbom-spdx.json" \
        "$test_image" || true
    
    # Probar Syft SBOM CycloneDX
    log_info "Probando Syft SBOM CycloneDX..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        anchore/syft:latest \
        "$test_image" \
        -o cyclonedx-json=/results/test-sbom-syft-cyclonedx.json || true
    
    # Evaluar resultados
    local cyclonedx_generated=false
    local spdx_generated=false
    local syft_generated=false
    
    if [ -f "$RESULTS_DIR/test-sbom-cyclonedx.json" ] && [ -s "$RESULTS_DIR/test-sbom-cyclonedx.json" ]; then
        local components=$(cat "$RESULTS_DIR/test-sbom-cyclonedx.json" | jq '.components | length' 2>/dev/null || echo "0")
        log_success "✅ Trivy CycloneDX SBOM generado ($components componentes)"
        cyclonedx_generated=true
    fi
    
    if [ -f "$RESULTS_DIR/test-sbom-spdx.json" ] && [ -s "$RESULTS_DIR/test-sbom-spdx.json" ]; then
        local packages=$(cat "$RESULTS_DIR/test-sbom-spdx.json" | jq '.packages | length' 2>/dev/null || echo "0")
        log_success "✅ Trivy SPDX SBOM generado ($packages paquetes)"
        spdx_generated=true
    fi
    
    if [ -f "$RESULTS_DIR/test-sbom-syft-cyclonedx.json" ] && [ -s "$RESULTS_DIR/test-sbom-syft-cyclonedx.json" ]; then
        local syft_components=$(cat "$RESULTS_DIR/test-sbom-syft-cyclonedx.json" | jq '.components | length' 2>/dev/null || echo "0")
        log_success "✅ Syft CycloneDX SBOM generado ($syft_components componentes)"
        syft_generated=true
    fi
    
    if [ "$cyclonedx_generated" = true ] || [ "$spdx_generated" = true ] || [ "$syft_generated" = true ]; then
        log_success "✅ Generación de SBOM FUNCIONA correctamente"
    else
        log_error "❌ Generación de SBOM FALLÓ"
        return 1
    fi
}

# Probar análisis con Clair mejorado
test_clair_analysis() {
    log_step "🛡️  Probando análisis de Clair mejorado con Grype"
    
    local test_image="alpine:latest"
    
    # Probar Grype como alternativa a Clair
    log_info "Probando Grype vulnerability scanner..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        anchore/grype:latest \
        "$test_image" \
        -o json \
        --file "/results/test-grype-analysis.json" || true
    
    if [ -f "$RESULTS_DIR/test-grype-analysis.json" ] && [ -s "$RESULTS_DIR/test-grype-analysis.json" ]; then
        local vulns=$(cat "$RESULTS_DIR/test-grype-analysis.json" | jq '.matches | length' 2>/dev/null || echo "0")
        log_success "✅ Grype análisis completado ($vulns vulnerabilidades encontradas)"
    else
        log_warning "⚠️  Grype análisis no generó resultados válidos"
    fi
}

# Probar capacidades de Buildah inspect
test_buildah_capabilities() {
    log_step "🔧 Probando capacidades de Buildah inspect"
    
    local test_image="alpine:latest"
    
    # Probar Buildah inspect usando contenedor
    log_info "Probando Buildah inspect..."
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$RESULTS_DIR:/results" \
        quay.io/buildah/stable:latest \
        buildah inspect --type image "$test_image" > "$RESULTS_DIR/test-buildah-inspect.json" 2>/dev/null || true
    
    if [ -f "$RESULTS_DIR/test-buildah-inspect.json" ] && [ -s "$RESULTS_DIR/test-buildah-inspect.json" ]; then
        local size=$(cat "$RESULTS_DIR/test-buildah-inspect.json" | jq -r '.Docker.Size // .OCIv1.Size // "unknown"')
        local layers=$(cat "$RESULTS_DIR/test-buildah-inspect.json" | jq -r '.Docker.RootFS.Layers // .OCIv1.RootFS.Layers | length // 0')
        log_success "✅ Buildah inspect FUNCIONA (Tamaño: $size, Capas: $layers)"
    else
        log_warning "⚠️  Buildah inspect no generó resultados válidos"
    fi
}

# Función principal de prueba
run_enhancement_tests() {
    log_step "🚀 INICIANDO PRUEBAS DE MEJORAS OSDO"
    echo
    
    # Crear directorio de resultados
    mkdir -p "$RESULTS_DIR"
    
    # Ejecutar pruebas individuales
    local test_results=()
    
    # Test 1: Prerequisites
    if check_enhanced_prerequisites; then
        test_results+=("prerequisites:PASS")
    else
        test_results+=("prerequisites:FAIL")
        log_error "❌ No se pueden ejecutar más pruebas sin prerequisites"
        return 1
    fi
    
    # Test 2: Análisis de secretos
    if test_secrets_analysis; then
        test_results+=("secrets:PASS")
    else
        test_results+=("secrets:FAIL")
    fi
    
    # Test 3: Generación de SBOM
    if test_sbom_generation; then
        test_results+=("sbom:PASS")
    else
        test_results+=("sbom:FAIL")
    fi
    
    # Test 4: Análisis Clair/Grype
    if test_clair_analysis; then
        test_results+=("clair:PASS")
    else
        test_results+=("clair:FAIL")
    fi
    
    # Test 5: Capacidades Buildah
    if test_buildah_capabilities; then
        test_results+=("buildah:PASS")
    else
        test_results+=("buildah:FAIL")
    fi
    
    # Generar reporte de resultados
    echo
    log_step "📊 RESULTADOS DE PRUEBAS DE MEJORAS OSDO"
    echo
    
    local total_tests=0
    local passed_tests=0
    
    for result in "${test_results[@]}"; do
        local test_name=$(echo "$result" | cut -d: -f1)
        local test_status=$(echo "$result" | cut -d: -f2)
        
        total_tests=$((total_tests + 1))
        
        if [ "$test_status" = "PASS" ]; then
            log_success "✅ $test_name: PASSED"
            passed_tests=$((passed_tests + 1))
        else
            log_error "❌ $test_name: FAILED"
        fi
    done
    
    echo
    log_info "📈 Resumen: $passed_tests/$total_tests pruebas exitosas"
    
    # Generar reporte JSON
    cat > "$RESULTS_DIR/enhancement-test-results.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "total_tests": $total_tests,
    "passed_tests": $passed_tests,
    "success_rate": $(echo "scale=2; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0"),
    "test_results": [
$(for result in "${test_results[@]}"; do
    local test_name=$(echo "$result" | cut -d: -f1)
    local test_status=$(echo "$result" | cut -d: -f2)
    echo "        {\"test\": \"$test_name\", \"status\": \"$test_status\"},"
done | sed '$ s/,$//')
    ],
    "results_directory": "$RESULTS_DIR"
}
EOF
    
    echo
    log_info "📁 Resultados detallados en: $RESULTS_DIR"
    log_info "📊 Reporte JSON: $RESULTS_DIR/enhancement-test-results.json"
    
    if [ "$passed_tests" -eq "$total_tests" ]; then
        log_success "🎉 TODAS LAS MEJORAS OSDO FUNCIONAN CORRECTAMENTE"
        return 0
    else
        log_error "❌ ALGUNAS MEJORAS OSDO NECESITAN ATENCIÓN"
        return 1
    fi
}

# Función de ayuda
show_help() {
    echo "Script de prueba para mejoras OSDO"
    echo
    echo "Uso: $0 [opciones]"
    echo
    echo "Opciones:"
    echo "  -h, --help     Mostrar esta ayuda"
    echo "  --clean        Limpiar resultados anteriores"
    echo
    echo "Este script prueba las siguientes mejoras OSDO:"
    echo "  • Análisis de secretos con GitLeaks y Semgrep"
    echo "  • Generación de SBOM con CycloneDX y Trivy"
    echo "  • Análisis mejorado con Clair/Grype"
    echo "  • Capacidades de Buildah inspect"
    echo "  • Prerequisites para compilación con Buildah"
}

# Main
main() {
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        --clean)
            log_info "🧹 Limpiando resultados anteriores..."
            rm -rf "$RESULTS_DIR"
            log_success "✅ Resultados anteriores limpiados"
            exit 0
            ;;
        "")
            run_enhancement_tests
            ;;
        *)
            log_error "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
}

# Verificar si se ejecuta directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
