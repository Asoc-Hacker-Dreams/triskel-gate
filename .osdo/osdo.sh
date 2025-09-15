#!/bin/bash
# OSDO Master Tool - Orquestador de herramientas OSDO compliance
# Ejecuta todas las herramientas OSDO de forma coordinada

set -euo pipefail

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OSDO_DIR="$PROJECT_ROOT/.osdo"
TOOLS_DIR="$OSDO_DIR/tools"
RESULTS_DIR="$OSDO_DIR/results"
CONFIG_FILE="$OSDO_DIR/config.yml"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[OSDO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OSDO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[OSDO]${NC} $1"
}

log_error() {
    echo -e "${RED}[OSDO]${NC} $1"
}

log_header() {
    echo -e "\n${CYAN}${BOLD}$1${NC}"
    echo -e "${CYAN}$(printf '=%.0s' $(seq 1 ${#1}))${NC}"
}

# Verificar prerrequisitos
check_prerequisites() {
    log_info "Verificando prerrequisitos OSDO..."
    
    local missing_tools=()
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    # Verificar Node.js y npm
    if ! command -v node &> /dev/null; then
        missing_tools+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    # Verificar jq para procesamiento JSON
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Herramientas faltantes: ${missing_tools[*]}"
        log_info "Por favor instalar las herramientas faltantes antes de continuar"
        exit 1
    fi
    
    log_success "Todos los prerrequisitos están disponibles"
}

# Crear estructura de directorios
setup_directories() {
    log_info "Configurando estructura de directorios OSDO..."
    
    mkdir -p "$RESULTS_DIR"/{sast,sca,container,reports,compliance}
    mkdir -p "$OSDO_DIR"/{policies,templates,configs}
    
    # Crear archivo de estado
    cat > "$RESULTS_DIR/osdo-state.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "project": "TriskelGate Payment Platform",
    "version": "2.0.0",
    "osdo_version": "1.0.0",
    "status": "initialized",
    "tools": {
        "sast": "pending",
        "sca": "pending",
        "container": "pending",
        "buildah": "pending"
    }
}
EOF
    
    log_success "Estructura de directorios configurada"
}

# Ejecutar SAST (Static Application Security Testing)
run_sast() {
    log_header "🔒 EJECUTANDO SAST (Static Application Security Testing)"
    
    if [ -x "$TOOLS_DIR/sast.sh" ]; then
        "$TOOLS_DIR/sast.sh"
        update_tool_status "sast" "completed"
    else
        log_error "Script SAST no encontrado o no ejecutable"
        update_tool_status "sast" "failed"
        return 1
    fi
}

# Ejecutar SCA (Software Composition Analysis)
run_sca() {
    log_header "📦 EJECUTANDO SCA (Software Composition Analysis)"
    
    if [ -x "$TOOLS_DIR/sca.sh" ]; then
        "$TOOLS_DIR/sca.sh"
        update_tool_status "sca" "completed"
    else
        log_error "Script SCA no encontrado o no ejecutable"
        update_tool_status "sca" "failed"
        return 1
    fi
}

# Ejecutar Container Security
run_container_security() {
    log_header "🐳 EJECUTANDO Container Security Analysis"
    
    if [ -x "$TOOLS_DIR/container-scan.sh" ]; then
        "$TOOLS_DIR/container-scan.sh"
        update_tool_status "container" "completed"
    else
        log_error "Script Container Security no encontrado o no ejecutable"
        update_tool_status "container" "failed"
        return 1
    fi
}

# Ejecutar Buildah Build
run_buildah_build() {
    log_header "🔨 EJECUTANDO Buildah Build (Reemplazo de Docker)"
    
    if [ -x "$TOOLS_DIR/buildah-builder.sh" ]; then
        "$TOOLS_DIR/buildah-builder.sh" build both false
        update_tool_status "buildah" "completed"
    else
        log_error "Script Buildah Builder no encontrado o no ejecutable"
        update_tool_status "buildah" "failed"
        return 1
    fi
}

# Actualizar estado de herramientas
update_tool_status() {
    local tool="$1"
    local status="$2"
    
    # Usar jq para actualizar el estado
    jq --arg tool "$tool" --arg status "$status" \
       '.tools[$tool] = $status | .last_updated = now | .last_updated_iso = (now | strftime("%Y-%m-%dT%H:%M:%SZ"))' \
       "$RESULTS_DIR/osdo-state.json" > "$RESULTS_DIR/osdo-state.tmp" && \
       mv "$RESULTS_DIR/osdo-state.tmp" "$RESULTS_DIR/osdo-state.json"
}

# Evaluar quality gates
evaluate_quality_gates() {
    log_header "🎯 EVALUANDO Quality Gates OSDO"
    
    local gates_passed=0
    local gates_total=4
    local gate_results=()
    
    # Gate 1: SAST completion
    if [ -f "$RESULTS_DIR/sast-report.html" ]; then
        gate_results+=("✅ SAST Analysis: PASS")
        ((gates_passed++))
    else
        gate_results+=("❌ SAST Analysis: FAIL")
    fi
    
    # Gate 2: SCA completion
    if [ -f "$RESULTS_DIR/sca-report.html" ]; then
        gate_results+=("✅ SCA Analysis: PASS")
        ((gates_passed++))
    else
        gate_results+=("❌ SCA Analysis: FAIL")
    fi
    
    # Gate 3: Container Security
    if [ -f "$RESULTS_DIR/container-security-report.html" ]; then
        gate_results+=("✅ Container Security: PASS")
        ((gates_passed++))
    else
        gate_results+=("❌ Container Security: FAIL")
    fi
    
    # Gate 4: Code Coverage (verificar si existe)
    if [ -f "$PROJECT_ROOT/coverage/lcov-report/index.html" ]; then
        gate_results+=("✅ Code Coverage: PASS")
        ((gates_passed++))
    else
        gate_results+=("❌ Code Coverage: FAIL")
    fi
    
    # Mostrar resultados
    for result in "${gate_results[@]}"; do
        log_info "$result"
    done
    
    local pass_rate=$((gates_passed * 100 / gates_total))
    
    # Guardar resultados de quality gates
    cat > "$RESULTS_DIR/quality-gates.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "gates_total": $gates_total,
    "gates_passed": $gates_passed,
    "pass_rate": $pass_rate,
    "status": "$([ $pass_rate -ge 75 ] && echo "PASS" || echo "FAIL")",
    "details": $(printf '%s\n' "${gate_results[@]}" | jq -R . | jq -s .)
}
EOF
    
    if [ $pass_rate -ge 75 ]; then
        log_success "🎉 Quality Gates: PASS ($gates_passed/$gates_total - ${pass_rate}%)"
        return 0
    else
        log_error "💥 Quality Gates: FAIL ($gates_passed/$gates_total - ${pass_rate}%)"
        return 1
    fi
}

# Generar reporte consolidado OSDO
generate_consolidated_report() {
    log_header "📊 GENERANDO Reporte Consolidado OSDO"
    
    local timestamp=$(date)
    local total_tools=4
    local completed_tools=0
    
    # Contar herramientas completadas
    for tool in sast sca container buildah; do
        if jq -e ".tools.$tool == \"completed\"" "$RESULTS_DIR/osdo-state.json" >/dev/null 2>&1; then
            ((completed_tools++))
        fi
    done
    
    # Crear reporte HTML consolidado
    cat > "$RESULTS_DIR/osdo-consolidated-report.html" << EOF
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OSDO Compliance Report - TriskelGate</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.2rem; opacity: 0.9; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        .card:hover { transform: translateY(-5px); }
        .card h2 { color: #333; margin-bottom: 15px; font-size: 1.4rem; }
        .status-pass { background: #e8f5e8; border-left: 5px solid #4caf50; }
        .status-fail { background: #ffe8e8; border-left: 5px solid #f44336; }
        .status-warning { background: #fff8e1; border-left: 5px solid #ff9800; }
        .metric { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child { border-bottom: none; }
        .metric-value { font-weight: bold; font-size: 1.1rem; }
        .progress-bar { 
            width: 100%; 
            height: 20px; 
            background: #eee; 
            border-radius: 10px; 
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #4caf50, #8bc34a); 
            transition: width 0.3s ease;
        }
        .tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .tool-card { 
            background: #f9f9f9; 
            padding: 15px; 
            border-radius: 8px; 
            border: 1px solid #ddd;
        }
        .tool-status { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 0.9rem; 
            font-weight: bold;
        }
        .status-completed { background: #4caf50; color: white; }
        .status-failed { background: #f44336; color: white; }
        .status-pending { background: #ff9800; color: white; }
        .links-list { list-style: none; }
        .links-list li { margin: 8px 0; }
        .links-list a { 
            color: #667eea; 
            text-decoration: none; 
            display: flex; 
            align-items: center;
            padding: 5px 0;
        }
        .links-list a:hover { color: #764ba2; text-decoration: underline; }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding: 20px; 
            color: #666;
            font-size: 0.9rem;
        }
        .timestamp { color: #666; font-size: 0.9em; }
        @media (max-width: 768px) {
            .header h1 { font-size: 2rem; }
            .grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ OSDO Compliance Report</h1>
            <p>TriskelGate Payment Platform - Open Source Development & Operations</p>
            <p class="timestamp">Generated: $timestamp</p>
        </div>

        <div class="grid">
            <!-- Executive Summary -->
            <div class="card status-$([ $completed_tools -eq $total_tools ] && echo "pass" || echo "warning")">
                <h2>📋 Executive Summary</h2>
                <div class="metric">
                    <span>Project Status:</span>
                    <span class="metric-value">$([ $completed_tools -eq $total_tools ] && echo "COMPLIANT" || echo "IN PROGRESS")</span>
                </div>
                <div class="metric">
                    <span>Tools Completed:</span>
                    <span class="metric-value">$completed_tools/$total_tools</span>
                </div>
                <div class="metric">
                    <span>Completion Rate:</span>
                    <span class="metric-value">$(( completed_tools * 100 / total_tools ))%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: $(( completed_tools * 100 / total_tools ))%"></div>
                </div>
            </div>

            <!-- Security Analysis -->
            <div class="card">
                <h2>🔒 Security Analysis</h2>
                <div class="tools-grid">
                    <div class="tool-card">
                        <strong>SAST</strong><br>
                        <span class="tool-status status-$(jq -r '.tools.sast' "$RESULTS_DIR/osdo-state.json" | sed 's/completed/completed/;s/failed/failed/;s/pending/pending/')">$(jq -r '.tools.sast' "$RESULTS_DIR/osdo-state.json" | tr '[:lower:]' '[:upper:]')</span>
                        <br><small>Static Application Security Testing</small>
                    </div>
                    <div class="tool-card">
                        <strong>SCA</strong><br>
                        <span class="tool-status status-$(jq -r '.tools.sca' "$RESULTS_DIR/osdo-state.json" | sed 's/completed/completed/;s/failed/failed/;s/pending/pending/')">$(jq -r '.tools.sca' "$RESULTS_DIR/osdo-state.json" | tr '[:lower:]' '[:upper:]')</span>
                        <br><small>Software Composition Analysis</small>
                    </div>
                    <div class="tool-card">
                        <strong>Container</strong><br>
                        <span class="tool-status status-$(jq -r '.tools.container' "$RESULTS_DIR/osdo-state.json" | sed 's/completed/completed/;s/failed/failed/;s/pending/pending/')">$(jq -r '.tools.container' "$RESULTS_DIR/osdo-state.json" | tr '[:lower:]' '[:upper:]')</span>
                        <br><small>Container Security Scanning</small>
                    </div>
                    <div class="tool-card">
                        <strong>Buildah</strong><br>
                        <span class="tool-status status-$(jq -r '.tools.buildah' "$RESULTS_DIR/osdo-state.json" | sed 's/completed/completed/;s/failed/failed/;s/pending/pending/')">$(jq -r '.tools.buildah' "$RESULTS_DIR/osdo-state.json" | tr '[:lower:]' '[:upper:]')</span>
                        <br><small>Docker Replacement Build</small>
                    </div>
                </div>
            </div>

            <!-- Quality Gates -->
            <div class="card">
                <h2>🎯 Quality Gates</h2>
                <div id="quality-gates">
                    <p>Evaluating quality gates...</p>
                </div>
            </div>

            <!-- Reports & Artifacts -->
            <div class="card">
                <h2>📊 Reports & Artifacts</h2>
                <ul class="links-list">
                    <li><a href="sast-report.html">🔒 SAST Analysis Report</a></li>
                    <li><a href="sca-report.html">📦 SCA Analysis Report</a></li>
                    <li><a href="container-security-report.html">🐳 Container Security Report</a></li>
                    <li><a href="quality-gates.json">🎯 Quality Gates Results (JSON)</a></li>
                    <li><a href="osdo-state.json">📋 OSDO State (JSON)</a></li>
                    <li><a href="../coverage/lcov-report/index.html">📈 Code Coverage Report</a></li>
                </ul>
            </div>

            <!-- Compliance Status -->
            <div class="card">
                <h2>✅ OSDO Compliance Checklist</h2>
                <div class="metric">
                    <span>✅ Static Security Analysis (SAST)</span>
                    <span>$([ "$(jq -r '.tools.sast' "$RESULTS_DIR/osdo-state.json")" = "completed" ] && echo "DONE" || echo "PENDING")</span>
                </div>
                <div class="metric">
                    <span>✅ Software Composition Analysis (SCA)</span>
                    <span>$([ "$(jq -r '.tools.sca' "$RESULTS_DIR/osdo-state.json")" = "completed" ] && echo "DONE" || echo "PENDING")</span>
                </div>
                <div class="metric">
                    <span>✅ Container Security Scanning</span>
                    <span>$([ "$(jq -r '.tools.container' "$RESULTS_DIR/osdo-state.json")" = "completed" ] && echo "DONE" || echo "PENDING")</span>
                </div>
                <div class="metric">
                    <span>✅ Docker Replacement (Buildah)</span>
                    <span>$([ "$(jq -r '.tools.buildah' "$RESULTS_DIR/osdo-state.json")" = "completed" ] && echo "DONE" || echo "PENDING")</span>
                </div>
                <div class="metric">
                    <span>✅ Supply Chain Security</span>
                    <span>$([ -f "$RESULTS_DIR/sbom-prod.json" ] && echo "DONE" || echo "PENDING")</span>
                </div>
                <div class="metric">
                    <span>✅ License Compliance</span>
                    <span>$([ -f "$RESULTS_DIR/licenses.json" ] && echo "DONE" || echo "PENDING")</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🛡️ OSDO Compliance Report generated by TriskelGate OSDO Tools v1.0.0</p>
            <p>For more information, visit the project documentation.</p>
        </div>
    </div>
</body>
</html>
EOF

    # Crear resumen JSON
    cat > "$RESULTS_DIR/osdo-compliance-summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "project": {
        "name": "TriskelGate Payment Platform",
        "version": "2.0.0",
        "osdo_version": "1.0.0"
    },
    "compliance": {
        "tools_completed": $completed_tools,
        "tools_total": $total_tools,
        "completion_rate": $(( completed_tools * 100 / total_tools )),
        "status": "$([ $completed_tools -eq $total_tools ] && echo "COMPLIANT" || echo "IN_PROGRESS")"
    },
    "tools": $(jq '.tools' "$RESULTS_DIR/osdo-state.json"),
    "reports": {
        "sast": "sast-report.html",
        "sca": "sca-report.html",
        "container": "container-security-report.html",
        "consolidated": "osdo-consolidated-report.html"
    },
    "next_steps": [
        "Review all security reports",
        "Remediate high/critical vulnerabilities",
        "Implement security gates in CI/CD",
        "Schedule regular compliance checks"
    ]
}
EOF

    log_success "📊 Reporte consolidado generado: $RESULTS_DIR/osdo-consolidated-report.html"
}

# Mostrar resumen final
show_summary() {
    log_header "📋 RESUMEN FINAL OSDO"
    
    local state_file="$RESULTS_DIR/osdo-state.json"
    
    if [ -f "$state_file" ]; then
        echo
        log_info "🎯 Estado de herramientas OSDO:"
        jq -r '.tools | to_entries[] | "  • \(.key | ascii_upcase): \(.value | ascii_upcase)"' "$state_file"
        
        echo
        log_info "📊 Reportes generados:"
        log_info "  • Reporte consolidado: $RESULTS_DIR/osdo-consolidated-report.html"
        log_info "  • Estado OSDO: $RESULTS_DIR/osdo-state.json"
        log_info "  • Quality Gates: $RESULTS_DIR/quality-gates.json"
        
        echo
        local completion_rate=$(jq -r '.tools | to_entries | map(select(.value == "completed")) | length' "$state_file")
        local total_tools=$(jq -r '.tools | length' "$state_file")
        
        if [ "$completion_rate" -eq "$total_tools" ]; then
            log_success "🎉 ¡OSDO Compliance completado exitosamente!"
        else
            log_warning "⚠️  OSDO Compliance en progreso ($completion_rate/$total_tools completadas)"
        fi
    fi
}

# Función de ayuda
show_help() {
    cat << EOF
OSDO Master Tool - Orquestador de herramientas OSDO compliance

Uso: $0 [COMANDO] [OPCIONES]

COMANDOS:
    all                    Ejecutar todas las herramientas OSDO
    sast                   Ejecutar solo SAST (Static Application Security Testing)
    sca                    Ejecutar solo SCA (Software Composition Analysis)
    container              Ejecutar solo Container Security
    buildah                Ejecutar solo Buildah Build
    gates                  Evaluar solo Quality Gates
    report                 Generar solo reporte consolidado
    status                 Mostrar estado actual
    clean                  Limpiar resultados anteriores
    help                   Mostrar esta ayuda

EJEMPLOS:
    $0 all                 # Ejecutar análisis completo OSDO
    $0 sast                # Solo análisis estático de seguridad
    $0 status              # Ver estado actual
    $0 clean               # Limpiar y reiniciar

ARCHIVOS IMPORTANTES:
    .osdo/config.yml       # Configuración OSDO
    .osdo/results/         # Resultados y reportes
    .osdo/tools/           # Herramientas ejecutables

EOF
}

# Limpiar resultados anteriores
clean_results() {
    log_info "🧹 Limpiando resultados anteriores..."
    
    if [ -d "$RESULTS_DIR" ]; then
        rm -rf "$RESULTS_DIR"
        mkdir -p "$RESULTS_DIR"
    fi
    
    log_success "Resultados limpiados"
}

# Mostrar estado actual
show_status() {
    log_header "📊 ESTADO ACTUAL OSDO"
    
    if [ -f "$RESULTS_DIR/osdo-state.json" ]; then
        echo
        log_info "🎯 Estado de herramientas:"
        jq -r '.tools | to_entries[] | "  • \(.key | ascii_upcase): \(.value | ascii_upcase)"' "$RESULTS_DIR/osdo-state.json"
        
        echo
        log_info "📅 Última actualización:"
        jq -r '.last_updated_iso // "No disponible"' "$RESULTS_DIR/osdo-state.json"
        
        echo
        local completed=$(jq -r '.tools | to_entries | map(select(.value == "completed")) | length' "$RESULTS_DIR/osdo-state.json")
        local total=$(jq -r '.tools | length' "$RESULTS_DIR/osdo-state.json")
        log_info "📈 Progreso: $completed/$total herramientas completadas"
    else
        log_warning "No hay estado OSDO disponible. Ejecute '$0 all' para iniciar."
    fi
}

# Parser de comandos principal
main() {
    case "${1:-all}" in
        "all")
            check_prerequisites
            setup_directories
            run_sast
            run_sca
            run_container_security
            run_buildah_build
            evaluate_quality_gates
            generate_consolidated_report
            show_summary
            ;;
        "sast")
            check_prerequisites
            setup_directories
            run_sast
            ;;
        "sca")
            check_prerequisites
            setup_directories
            run_sca
            ;;
        "container")
            check_prerequisites
            setup_directories
            run_container_security
            ;;
        "buildah")
            check_prerequisites
            setup_directories
            run_buildah_build
            ;;
        "gates")
            evaluate_quality_gates
            ;;
        "report")
            generate_consolidated_report
            ;;
        "status")
            show_status
            ;;
        "clean")
            clean_results
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
}

# Banner de inicio
echo -e "${CYAN}${BOLD}"
cat << 'EOF'
   ____  _____ _____   ____    
  / __ \/ ____/  __ \ / __ \   
 | |  | | (___ | |  | | |  | |  
 | |  | |\___ \| |  | | |  | |  
 | |__| |____) | |__| | |__| |  
  \____/|_____/|_____/ \____/   
                                
 Open Source Development & Operations
 TriskelGate Payment Platform v2.0.0
EOF
echo -e "${NC}"

# Ejecutar función principal
main "$@"
