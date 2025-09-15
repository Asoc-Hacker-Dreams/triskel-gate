# 🚀 Guía de Despliegue Rápido - TriskelGate Payment Platform

## Opciones de Despliegue

TriskelGate soporta múltiples opciones de despliegue, desde desarrollo local hasta producción en Azure.

## 🖥️ Desarrollo Local

### Requisitos
- Node.js 18+
- npm/yarn
- Git

### Instalación Rápida
```bash
# Clonar repositorio
git clone <repository-url>
cd triskel-gate

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Inicializar base de datos
npm run db:migrate
npm run db:seed

# Iniciar servidor de desarrollo
npm run dev
```

### URLs de Desarrollo
- **API**: http://localhost:3001
- **Documentación**: http://localhost:3001/api/docs
- **Validator**: http://localhost:3001/validator.html
- **Health Check**: http://localhost:3001/health

## 🐳 Docker (Recomendado para Producción)

### Docker Compose - Desarrollo
```bash
# Construir e iniciar contenedores
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Docker - Producción
```bash
# Construir imagen de producción
npm run build:docker:prod

# Ejecutar contenedor
docker run -d \
  --name triskelgate-prod \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-jwt-secret \
  -e STRIPE_SECRET_KEY=sk_live_... \
  triskelgate-platform:prod
```

## ☁️ Azure Cloud (Altamente Recomendado)

### Configuración Automática
```bash
# 1. Instalar Azure CLI
# https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# 2. Autenticarse
az login

# 3. Ejecutar script de configuración
npm run azure:setup
```

### Configuración Manual de Azure

#### 1. Resource Group
```bash
az group create --name triskelgate-rg --location eastus2
```

#### 2. Container Registry
```bash
az acr create \
  --resource-group triskelgate-rg \
  --name triskelgate \
  --sku Standard \
  --admin-enabled true
```

#### 3. App Service Plan
```bash
az appservice plan create \
  --name triskelgate-plan \
  --resource-group triskelgate-rg \
  --sku P1V2 \
  --is-linux \
  --location eastus2
```

#### 4. App Services
```bash
# Staging
az webapp create \
  --resource-group triskelgate-rg \
  --plan triskelgate-plan \
  --name triskelgate-platform-staging \
  --deployment-container-image-name triskelgate.azurecr.io/triskelgate/payment-platform:staging

# Production
az webapp create \
  --resource-group triskelgate-rg \
  --plan triskelgate-plan \
  --name triskelgate-platform-prod \
  --deployment-container-image-name triskelgate.azurecr.io/triskelgate/payment-platform:latest

# Crear staging slot para blue-green deployment
az webapp deployment slot create \
  --name triskelgate-platform-prod \
  --resource-group triskelgate-rg \
  --slot staging
```

#### 5. Application Insights
```bash
az monitor app-insights component create \
  --app triskelgate-insights \
  --location eastus2 \
  --resource-group triskelgate-rg \
  --application-type web
```

## 🔄 CI/CD Pipeline

### Azure DevOps (Recomendado)
1. **Importar código** a Azure DevOps
2. **Configurar Service Connections**:
   - Azure Resource Manager
   - Azure Container Registry
3. **Crear Variable Groups**:
   - TriskelGate-Shared
   - TriskelGate-Staging  
   - TriskelGate-Production
4. **Configurar Environments**:
   - TriskelGate-Staging (automático)
   - TriskelGate-Production (aprobación manual)
5. **Ejecutar Pipeline**: `azure-pipelines.yml`

### GitHub Actions (Alternativa)
1. **Configurar Secrets** en GitHub:
   ```
   AZURE_CREDENTIALS
   REGISTRY_LOGIN_SERVER
   REGISTRY_USERNAME
   REGISTRY_PASSWORD
   ```
2. **Push a main/develop** activa automáticamente el workflow
3. **Archivo**: `.github/workflows/ci-cd.yml`

## 🔐 Variables de Entorno

### Desarrollo
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-change-in-production
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
LOG_LEVEL=info
```

### Producción
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
DATABASE_PATH=/app/data/platform.db
LOG_LEVEL=warn
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## 📊 Monitoreo y Logs

### Azure Application Insights
```bash
# Configurar Application Insights en Azure
az monitor app-insights component create \
  --app triskelgate-insights \
  --location eastus2 \
  --resource-group triskelgate-rg
```

### Logs de Aplicación
```bash
# Logs en desarrollo
npm run dev  # logs en consola

# Logs en Docker
docker-compose logs -f

# Logs en Azure
az webapp log tail --name triskelgate-platform-prod --resource-group triskelgate-rg
```

## 🧪 Testing y Validación

### Tests Locales
```bash
# Ejecutar todos los tests
npm test

# Tests con cobertura
npm run test:coverage

# Tests de integración
npm run test:integration

# Linting
npm run lint
```

### Health Checks
```bash
# Health check básico
curl http://localhost:3001/health

# Readiness probe
curl http://localhost:3001/ready

# API info
curl http://localhost:3001/api/info
```

## 🔧 Solución de Problemas

### Problemas Comunes

#### Error: "Cannot connect to database"
```bash
# Verificar permisos de archivos
sudo chown -R node:node /app/data/

# Recrear base de datos
rm data/platform.db*
npm run db:migrate
npm run db:seed
```

#### Error: "Port 3001 already in use"
```bash
# Buscar proceso usando el puerto
lsof -i :3001

# Matar proceso
kill -9 <PID>

# O usar otro puerto
PORT=3002 npm start
```

#### Error de Azure CLI
```bash
# Re-autenticar
az login

# Verificar suscripción
az account show

# Cambiar suscripción
az account set --subscription "subscription-name"
```

## 📞 Soporte

- **Documentación**: http://localhost:3001/api/docs
- **Issues**: Crear issue en el repositorio
- **Email**: soporte@triskelgate.com

## 🎯 Siguientes Pasos

1. ✅ **Configurar Azure** con `npm run azure:setup`
2. ✅ **Configurar CI/CD** en Azure DevOps
3. ✅ **Configurar monitoring** con Application Insights
4. ✅ **Configurar dominio** personalizado
5. ✅ **Configurar SSL** (automático en Azure)
6. ✅ **Configurar backup** de base de datos
7. ✅ **Testing en producción** con datos reales

---

**🎫 TriskelGate - Superior a Eventbrite en todo sentido** ✨
