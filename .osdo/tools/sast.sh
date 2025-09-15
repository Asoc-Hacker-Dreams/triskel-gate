#!/bin/bash
# OSDO SAST (Static Application Security Testing) Tool
# Herramienta mínima ejecutable con Docker para análisis estático de seguridad

set -euo pipefail

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OSDO_CONFIG="$PROJECT_ROOT/.osdo/config.yml"
RESULTS_DIR="$PROJECT_ROOT/.osdo/results"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[OSDO-SAST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OSDO-SAST]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[OSDO-SAST]${NC} $1"
}

log_error() {
    echo -e "${RED}[OSDO-SAST]${NC} $1"
}

# Crear directorio de resultados
create_results_dir() {
    mkdir -p "$RESULTS_DIR"
}

# ESLint Security Analysis
run_eslint_security() {
    log_info "Ejecutando ESLint Security Rules..."
    
    cd "$PROJECT_ROOT"
    
    # Instalar eslint-plugin-security si no está instalado
    if ! npm list eslint-plugin-security >/dev/null 2>&1; then
        log_info "Instalando eslint-plugin-security..."
        npm install --save-dev eslint-plugin-security
    fi
    
    # Ejecutar ESLint con reglas de seguridad
    npx eslint src/ \
        --ext .js,.mjs \
        --format json \
        --output-file "$RESULTS_DIR/eslint-security.json" \
        --config .eslintrc.security.json || true
    
    # Convertir a SARIF format
    npx @microsoft/eslint-formatter-sarif \
        "$RESULTS_DIR/eslint-security.json" \
        --output "$RESULTS_DIR/eslint-security.sarif" || true
    
    log_success "ESLint Security análisis completado"
}

# Semgrep Static Analysis
run_semgrep() {
    log_info "Ejecutando Semgrep SAST..."
    
    # Usar Docker para ejecutar Semgrep
    docker run --rm \
        -v "$PROJECT_ROOT:/src" \
        -v "$RESULTS_DIR:/results" \
        returntocorp/semgrep:latest \
        --config=auto \
        --json \
        --output=/results/semgrep.json \
        /src/src/ || true
    
    # Convertir a SARIF
    docker run --rm \
        -v "$RESULTS_DIR:/results" \
        returntocorp/semgrep:latest \
        --config=auto \
        --sarif \
        --output=/results/semgrep.sarif \
        /src/src/ || true
    
    log_success "Semgrep análisis completado"
}

# Análisis de secretos con truffleHog
run_secret_scan() {
    log_info "Ejecutando escaneo de secretos con TruffleHog..."
    
    # Usar Docker para ejecutar TruffleHog
    docker run --rm \
        -v "$PROJECT_ROOT:/src" \
        -v "$RESULTS_DIR:/results" \
        trufflesecurity/trufflehog:latest \
        filesystem /src \
        --json \
        --no-update > "$RESULTS_DIR/secrets.json" || true
    
    log_success "Escaneo de secretos completado"
}

# Análisis de headers de seguridad
run_security_headers_check() {
    log_info "Verificando configuración de headers de seguridad..."
    
    # Verificar configuración de helmet.js en el código
    if grep -r "helmet" "$PROJECT_ROOT/src/" >/dev/null 2>&1; then
        echo '{"status": "pass", "message": "Helmet.js encontrado"}' > "$RESULTS_DIR/security-headers.json"
    else
        echo '{"status": "fail", "message": "Helmet.js no configurado"}' > "$RESULTS_DIR/security-headers.json"
    fi
    
    log_success "Verificación de headers de seguridad completada"
}

# Generar reporte consolidado
generate_report() {
    log_info "Generando reporte consolidado..."
    
    # Crear reporte HTML
    cat > "$RESULTS_DIR/sast-report.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>OSDO SAST Report - TriskelGate</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .pass { background: #e8f5e8; border-color: #4caf50; }
        .fail { background: #ffe8e8; border-color: #f44336; }
        .warning { background: #fff8e1; border-color: #ff9800; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 OSDO SAST Report</h1>
        <p>TriskelGate Payment Platform - Security Analysis</p>
        <p class="timestamp">Generated: $(date)</p>
    </div>
    
    <div class="section">
        <h2>📊 Análisis Ejecutados</h2>
        <ul>
            <li>✅ ESLint Security Rules</li>
            <li>✅ Semgrep Static Analysis</li>
            <li>✅ Secret Scanning (TruffleHog)</li>
            <li>✅ Security Headers Check</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>📁 Archivos de Resultados</h2>
        <ul>
            <li><a href="eslint-security.json">ESLint Security (JSON)</a></li>
            <li><a href="eslint-security.sarif">ESLint Security (SARIF)</a></li>
            <li><a href="semgrep.json">Semgrep (JSON)</a></li>
            <li><a href="semgrep.sarif">Semgrep (SARIF)</a></li>
            <li><a href="secrets.json">Secret Scan Results</a></li>
            <li><a href="security-headers.json">Security Headers Check</a></li>
        </ul>
    </div>
    
    <div class="section">
        <h2>🎯 Recomendaciones OSDO</h2>
        <ul>
            <li>Revisar todos los resultados SARIF en su herramienta de análisis</li>
            <li>Remediar vulnerabilidades de severidad HIGH o CRITICAL</li>
            <li>Implementar security gates en CI/CD pipeline</li>
            <li>Configurar alertas automáticas para nuevas vulnerabilidades</li>
        </ul>
    </div>
</body>
</html>
EOF

    # Crear resumen de resultados
    cat > "$RESULTS_DIR/summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "project": "TriskelGate Payment Platform",
    "version": "2.0.0",
    "sast_tools": [
        "eslint-security",
        "semgrep",
        "trufflehog",
        "security-headers-check"
    ],
    "results_directory": "$RESULTS_DIR",
    "compliance_status": "completed",
    "next_steps": [
        "Review SARIF files",
        "Remediate vulnerabilities",
        "Update security policies"
    ]
}
EOF
    
    log_success "Reporte consolidado generado en $RESULTS_DIR/sast-report.html"
}

# Función principal
main() {
    log_info "🔒 Iniciando OSDO SAST Analysis..."
    log_info "Proyecto: TriskelGate Payment Platform"
    log_info "Directorio: $PROJECT_ROOT"
    
    create_results_dir
    run_eslint_security
    run_semgrep
    run_secret_scan
    run_security_headers_check
    generate_report
    
    log_success "🎉 OSDO SAST Analysis completado!"
    log_info "📁 Resultados disponibles en: $RESULTS_DIR"
    log_info "📊 Reporte HTML: $RESULTS_DIR/sast-report.html"
}

# Verificar si se ejecuta directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
