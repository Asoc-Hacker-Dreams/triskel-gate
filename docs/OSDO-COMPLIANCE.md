# 🛡️ OSDO Compliance Implementation - TriskelGate Payment Platform

## 📋 **OSDO Enhanced Implementation - v2.0**

### 🚀 **Nuevas Capacidades Implementadas (Junio 2025)**

#### **1. Compilación Obligatoria con Buildah**
- ✅ **Buildah exclusivo** para compilación local de containers
- ✅ **No Docker build** - eliminado escalado de privilegios
- ✅ **Isolation mode** configurado como `chroot` para máxima seguridad
- ✅ **Compatibilidad OCI** completa

#### **2. Análisis de Secretos Integrado**
- ✅ **GitLeaks** - Detección de secretos en código fuente
- ✅ **Semgrep Secrets** - Patrones específicos de API keys y tokens
- ✅ **Pipeline Integration** - Análisis automático en CI/CD
- ✅ **JSON Reports** - Resultados estructurados para evaluación

#### **3. SBOM con CycloneDX**
- ✅ **CycloneDX 1.5** - Estándar moderno de SBOM
- ✅ **Trivy SBOM** - Análisis de componentes y dependencias
- ✅ **Syft SBOM** - Análisis alternativo para comparación
- ✅ **SPDX Format** - Compatibilidad con múltiples estándares
- ✅ **Component Tracking** - Trazabilidad completa de componentes

#### **4. Análisis Mejorado de Containers**
- ✅ **Clair + Grype** - Análisis dual de vulnerabilidades
- ✅ **Buildah Inspect** - Metadatos detallados de imágenes
- ✅ **Enhanced Statistics** - Métricas de seguridad mejoradas
- ✅ **Multi-format Reports** - JSON, SARIF, HTML

---

## Qué es OSDO (Open Source Development & Operations)

OSDO es un conjunto de prácticas y herramientas para el desarrollo y operaciones de software de código abierto que enfatiza:

- **Transparencia** en el proceso de desarrollo
- **Seguridad** integrada desde el diseño
- **Compliance** con estándares de la industria
- **Automatización** de controles de calidad
- **Auditabilidad** de toda la cadena de suministro de software

## 🎯 Implementación en TriskelGate

### Herramientas OSDO Implementadas

#### 1. **SAST (Static Application Security Testing)**
```bash
# Ejecutar análisis SAST
npm run security:sast
# o directamente
./.osdo/tools/sast.sh
```

**Herramientas incluidas:**
- ESLint Security Rules
- Semgrep (via Docker)
- TruffleHog (secret scanning)
- Security Headers Check

**Reportes generados:**
- `.osdo/results/sast-report.html` - Reporte visual
- `.osdo/results/eslint-security.sarif` - Formato SARIF
- `.osdo/results/semgrep.sarif` - Análisis Semgrep

#### 2. **SCA (Software Composition Analysis)**
```bash
# Ejecutar análisis SCA
npm run security:sca
# o directamente
./.osdo/tools/sca.sh
```

**Herramientas incluidas:**
- npm audit
- Snyk (via Docker)
- Retire.js
- License Checker
- SBOM Generation (Syft)

**Reportes generados:**
- `.osdo/results/sca-report.html` - Reporte visual
- `.osdo/results/sbom.json` - Software Bill of Materials
- `.osdo/results/risk-score.json` - Puntuación de riesgo

#### 3. **Container Security - Proceso OSDO de 3 Pasos (Enhanced v2.0)**
```bash
# Ejecutar proceso OSDO completo de 3 pasos
npm run security:container
# o directamente
./.osdo/tools/container-scan.sh

# Con push al registry habilitado
./.osdo/tools/container-scan.sh --enable-push
```

**Proceso OSDO de 3 Pasos para Containers (Enhanced):**

**🔍 STEP 1: Análisis del Dockerfile + Secretos**
- **Hadolint** - Dockerfile linting y mejores prácticas
- **Trivy Config** - Análisis de configuración sin build
- **🆕 GitLeaks** - Detección de secretos en código fuente
- **🆕 Semgrep Secrets** - Patrones específicos de API keys y tokens
- ❌ **Bloquea** el proceso si encuentra issues críticos o secretos

**🔧 STEP 2: Compilación Local + Análisis (Buildah Exclusive)**
- **🆕 Buildah Build** - Construcción con `buildah bud` (NO Docker build)
- **🆕 Buildah Inspect** - Metadatos detallados de imagen OCI
- **Trivy Image** - Escaneo de vulnerabilidades de imagen
- **🆕 Clair + Grype** - Análisis dual de vulnerabilidades
- **🆕 CycloneDX SBOM** - Generación de Software Bill of Materials
- **🆕 SPDX SBOM** - Formato alternativo de SBOM
- **🆕 Syft SBOM** - Análisis comparativo de componentes
- ❌ **NO hace push** al registry en este paso

**📤 STEP 3: Push al Registry (Condicional)**
- **Solo ejecuta** si Steps 1 y 2 pasan exitosamente
- **Login automático** al registry configurado
- **Push versionado** y latest tag
- **Requiere** `ALLOW_REGISTRY_PUSH=true`

**Reportes generados (Enhanced):**
- `.osdo/results/osdo-container-report.html` - Reporte visual OSDO
- `.osdo/results/osdo-summary.json` - Resumen JSON de los 3 pasos
- `.osdo/results/dockerfile-lint.json` - Resultados Hadolint
- `.osdo/results/dockerfile-trivy.json` - Análisis Trivy del Dockerfile
- **🆕** `.osdo/results/secrets-analysis-summary.json` - Resumen de secretos detectados
- **🆕** `.osdo/results/gitleaks-secrets.json` - Detecciones GitLeaks
- **🆕** `.osdo/results/semgrep-secrets.json` - Detecciones Semgrep
- **🆕** `.osdo/results/buildah-image-info.json` - Metadatos Buildah
- **🆕** `.osdo/results/sbom-cyclonedx.json` - SBOM en formato CycloneDX
- **🆕** `.osdo/results/sbom-spdx.json` - SBOM en formato SPDX
- **🆕** `.osdo/results/sbom-syft-cyclonedx.json` - SBOM Syft CycloneDX
- **🆕** `.osdo/results/sbom-summary.json` - Resumen de análisis SBOM
- **🆕** `.osdo/results/grype-analysis.json` - Análisis Grype de vulnerabilidades
- `.osdo/results/local-image-vulns.json` - Vulnerabilidades de imagen
- `.osdo/results/registry-push-info.json` - Información de push (si aplica)

#### 4. **Buildah Builder (Reemplazo de Docker)**
```bash
# Build con buildah (OSDO compliant)
npm run buildah:build:dev    # Imagen desarrollo
npm run buildah:build:prod   # Imagen producción
npm run buildah:build        # Ambas imágenes

# o directamente
./.osdo/tools/buildah-builder.sh build dev
./.osdo/tools/buildah-builder.sh build prod
```

**Características:**
- Build sin Docker daemon
- Firma de imágenes con cosign
- Generación automática de SBOM
- Usuario no-root por defecto
- Supply chain security

### 🎮 Herramienta Master OSDO

```bash
# Ejecutar análisis completo OSDO
npm run osdo:all

# Ejecutar herramientas individuales
npm run osdo:sast      # Solo SAST
npm run osdo:sca       # Solo SCA
npm run osdo:container # Solo Container Security
npm run osdo:buildah   # Solo Buildah Build

# Gestión de compliance
npm run osdo:gates     # Evaluar quality gates
npm run osdo:report    # Generar reporte consolidado
npm run osdo:status    # Ver estado actual
npm run osdo:clean     # Limpiar resultados
```

## 🏗️ Integración en CI/CD

### Azure DevOps Pipeline

El pipeline actualizado (`azure-pipelines.yml`) incluye:

1. **Stage 1: Build & Test** - Tests tradicionales
2. **Stage 2: OSDO Security Analysis** - Análisis SAST y SCA
3. **Stage 3: Buildah Container Build** - Build con buildah
4. **Stage 4: OSDO Quality Gates** - Evaluación de gates
5. **Stage 5: Deployment** - Deploy solo si pasa quality gates

```yaml
# Ejemplo de stage OSDO
- stage: OSDOSecurityAnalysis
  displayName: 'OSDO Security Analysis'
  jobs:
    - job: OSDOCompliance
      steps:
        - script: ./.osdo/tools/sast.sh
          displayName: 'OSDO SAST Analysis'
        - script: ./.osdo/tools/sca.sh
          displayName: 'OSDO SCA Analysis'
```

### Quality Gates Configurados

| Gate | Criterio | Estado |
|------|----------|--------|
| SAST Analysis | Completado exitosamente | ✅ |
| SCA Analysis | Sin vulnerabilidades CRITICAL | ✅ |
| Container OSDO Step 1 | Dockerfile analysis PASSED | ✅ |
| Container OSDO Step 2 | Local build + analysis PASSED | ✅ |
| Container OSDO Step 3 | Registry push (opcional) | ✅ |
| Overall OSDO Compliance | Todos los gates anteriores | ✅ |
| SCA Analysis | Vulnerabilidades < HIGH | ✅ |
| Container Security | Sin vulnerabilidades CRITICAL | ✅ |
| Code Coverage | > 80% | ✅ |

## 📊 Reportes y Compliance

### Reporte Consolidado
Accesible en: `.osdo/results/osdo-consolidated-report.html`

Incluye:
- Executive Summary
- Security Analysis Results
- Quality Gates Status
- Compliance Checklist
- Links a reportes detallados

### Artefactos Generados

```
.osdo/
├── config.yml                    # Configuración OSDO
├── osdo.sh                      # Herramienta master
├── tools/                       # Herramientas ejecutables
│   ├── sast.sh                 # Static security analysis
│   ├── sca.sh                  # Software composition analysis
│   ├── container-scan.sh       # Container security
│   └── buildah-builder.sh      # Buildah container builder
└── results/                     # Resultados y reportes
    ├── osdo-consolidated-report.html
    ├── sast-report.html
    ├── sca-report.html
    ├── container-security-report.html
    ├── quality-gates.json
    ├── osdo-state.json
    ├── sbom-*.json
    └── *.sarif                 # Resultados en formato SARIF
```

## 🚨 Security Gates y Políticas

### Políticas de Vulnerabilidades
- **CRITICAL**: ❌ Bloquea deployment
- **HIGH**: ⚠️ Requiere aprobación manual
- **MEDIUM**: ℹ️ Genera warning
- **LOW**: ✅ Permitido

### License Compliance
**Licencias permitidas:**
- MIT
- Apache-2.0
- BSD-3-Clause
- ISC

**Licencias prohibidas:**
- GPL-3.0
- AGPL-3.0

### Container Security Policies
- ✅ No ejecutar como root
- ✅ Usar imágenes base mínimas
- ✅ Escanear vulnerabilidades
- ✅ Firmar imágenes en producción

## 🔧 Configuración y Customización

### Archivo de Configuración
Editar `.osdo/config.yml` para customizar:

```yaml
security:
  sast:
    severity_threshold: 'medium'
  sca:
    vulnerability_threshold: 'high'
  container:
    enabled: true

quality_gates:
  code_coverage:
    minimum: 80
  vulnerability_score:
    maximum: 7.0
```

### Variables de Entorno

```bash
# Registry de containers
export REGISTRY="triskelgate.azurecr.io"
export IMAGE_NAME="triskelgate-platform"

# Configuración de firma
export COSIGN_KEY_PATH="$HOME/.cosign/cosign.key"

# Umbral de vulnerabilidades
export VULN_THRESHOLD="high"
```

## 🆘 Troubleshooting

### Problemas Comunes

#### 1. Buildah no funciona en macOS
```bash
# Usar Docker como fallback
export USE_DOCKER_FALLBACK=true
npm run buildah:build
```

#### 2. Permisos de Docker en CI/CD
```bash
# Agregar usuario a grupo docker
sudo usermod -aG docker $USER
```

#### 3. Semgrep timeout
```bash
# Aumentar timeout en .osdo/tools/sast.sh
docker run --rm -v "$PROJECT_ROOT:/src" \
  --timeout 300 \
  returntocorp/semgrep:latest
```

### Logs y Debugging
```bash
# Ver logs detallados
DEBUG=true npm run osdo:all

# Verificar estado de herramientas
npm run osdo:status

# Limpiar y reiniciar
npm run osdo:clean
npm run osdo:all
```

## 📈 Métricas y KPIs

### Métricas de Seguridad
- Tiempo de detección de vulnerabilidades: < 24h
- Tiempo de remediación: < 72h para CRITICAL, < 1 semana para HIGH
- Cobertura de análisis: 100% del código

### Métricas de Compliance
- Percentage de builds que pasan quality gates: > 95%
- Tiempo de generación de reportes OSDO: < 10 minutos
- Actualización de dependencies: Semanal para CRITICAL

## 🔄 Roadmap OSDO

### Fase 1 - Implementado ✅
- [x] Herramientas SAST básicas
- [x] Análisis SCA completo
- [x] Container security scanning
- [x] Buildah integration
- [x] Quality gates

### Fase 2 - Próximas Mejoras
- [ ] DAST (Dynamic Application Security Testing)
- [ ] Fuzzing automatizado
- [ ] Advanced threat modeling
- [ ] SLSA compliance level 3
- [ ] Automated dependency updates

### Fase 3 - Futuro
- [ ] AI-powered vulnerability assessment
- [ ] Zero-trust security model
- [ ] Advanced supply chain verification
- [ ] Runtime security monitoring

---

## 📞 Soporte

Para problemas con la implementación OSDO:

1. **Verificar logs**: `npm run osdo:status`
2. **Documentación**: Este archivo y `.osdo/config.yml`
3. **Issues**: Reportar en el repositorio del proyecto

**Última actualización**: Junio 2025  
**Versión OSDO**: 1.0.0

## 🔧 **Requisitos Técnicos para OSDO Enhanced v2.0**

### **Prerequisites Obligatorios**

#### **1. Buildah (Mandatory)**
```bash
# Instalación en Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y buildah

# Verificar instalación
buildah --version
```

**Configuración requerida:**
- `BUILDAH_ISOLATION=chroot` - Modo de aislamiento seguro
- Soporte para OCI containers
- Compatibilidad con registries estándar

#### **2. Docker (Solo para herramientas de análisis)**
```bash
# Docker se usa exclusivamente para:
# - GitLeaks container
# - Semgrep container  
# - Trivy vulnerability scanner
# - Syft SBOM generator
# - Grype vulnerability scanner

# ❌ NO se usa para: docker build
# ✅ Solo para: herramientas de análisis en containers
```

#### **3. Herramientas de Análisis**
```bash
# Verificar disponibilidad de herramientas
docker pull zricethezav/gitleaks:latest          # Secrets
docker pull returntocorp/semgrep:latest          # Code analysis
docker pull aquasec/trivy:latest                 # Vulnerabilities + SBOM
docker pull anchore/syft:latest                  # SBOM generation
docker pull anchore/grype:latest                 # Vulnerability scanning
docker pull quay.io/buildah/stable:latest        # Buildah container
```

#### **4. Utilidades del Sistema**
```bash
# Requeridas para procesamiento de resultados
sudo apt-get install -y jq curl

# jq - Para procesamiento JSON
# curl - Para descargas de herramientas
```

### **Variables de Entorno**

```bash
# Configuración de Buildah
export BUILDAH_ISOLATION=chroot
export BUILDAH_FORMAT=oci

# Configuración de registry
export REGISTRY="your-registry.azurecr.io"
export IMAGE_NAME="your-app-name"

# Control de proceso OSDO
export ALLOW_REGISTRY_PUSH=false  # true solo en main/develop
export SKIP_CLEANUP=false         # true para debugging
```

### **Archivos de Configuración**

#### **.osdo/config/secrets-patterns.json** (Opcional)
```json
{
  "custom_patterns": [
    {
      "pattern": "TRISKEL_API_KEY_[A-Za-z0-9]{32}",
      "description": "TriskelGate API Key"
    }
  ]
}
```

#### **.osdo/config/sbom-config.json** (Opcional)
```json
{
  "sbom_formats": ["cyclonedx", "spdx"],
  "include_dependencies": true,
  "include_vulnerabilities": true,
  "output_compression": false
}
```

---

## 📁 Estructura de Archivos OSDO

```
.osdo/
├── config.yml                    # Configuración OSDO
├── osdo.sh                      # Herramienta master
├── tools/                       # Herramientas ejecutables
│   ├── sast.sh                 # Static security analysis
│   ├── sca.sh                  # Software composition analysis
│   ├── container-scan.sh       # Container security
│   └── buildah-builder.sh      # Buildah container builder
└── results/                     # Resultados y reportes
    ├── osdo-consolidated-report.html
    ├── sast-report.html
    ├── sca-report.html
    ├── container-security-report.html
    ├── quality-gates.json
    ├── osdo-state.json
    ├── sbom-*.json
    └── *.sarif                 # Resultados en formato SARIF
```
