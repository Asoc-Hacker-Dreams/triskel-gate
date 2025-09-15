# Configuración de Azure DevOps para TriskelGate Payment Platform

## Service Connections Requeridas

### 1. Azure Resource Manager
- **Nombre**: `TriskelGate-Azure-Connection`
- **Tipo**: Azure Resource Manager
- **Scope**: Subscription
- **Subscription**: [Tu Azure Subscription]
- **Resource Group**: triskelgate-rg

### 2. Docker Registry (Azure Container Registry)
- **Nombre**: `TriskelGateACR`
- **Tipo**: Docker Registry
- **Registry URL**: triskelgate.azurecr.io
- **Username**: [ACR Username]
- **Password**: [ACR Password]

### 3. Slack Notifications (Opcional)
- **Nombre**: `TriskelGateSlack`
- **Tipo**: Incoming Webhook
- **URL**: [Slack Webhook URL]

## Variable Groups

### Shared Variables
```yaml
# Variable Group: TriskelGate-Shared
NODE_VERSION: 18.x
BUILD_CONFIGURATION: Release
DOCKER_REGISTRY: triskelgate.azurecr.io
```

### Staging Variables
```yaml
# Variable Group: TriskelGate-Staging
APP_NAME: triskelgate-platform-staging
RESOURCE_GROUP: triskelgate-staging-rg
JWT_SECRET: [Staging JWT Secret]
STRIPE_SECRET_KEY: [Staging Stripe Key]
STRIPE_PUBLISHABLE_KEY: [Staging Stripe Publishable Key]
DATABASE_URL: [Staging Database URL]
```

### Production Variables
```yaml
# Variable Group: TriskelGate-Production
APP_NAME: triskelgate-platform-prod
RESOURCE_GROUP: triskelgate-rg
JWT_SECRET: [Production JWT Secret] # Secured
STRIPE_SECRET_KEY: [Production Stripe Key] # Secured
STRIPE_PUBLISHABLE_KEY: [Production Stripe Publishable Key]
DATABASE_URL: [Production Database URL] # Secured
```

## Environments

### TriskelGate-Staging
- **Approval**: Automatic
- **Security**: None
- **Checks**: Health check after deployment

### TriskelGate-Production
- **Approval**: Manual (Required reviewers)
- **Security**: Manual validation required
- **Checks**: 
  - Health check
  - Performance baseline
  - Security scan results

## Branch Policies

### Main Branch
- **Require pull request**: Yes
- **Minimum reviewers**: 2
- **Check for linked work items**: Yes
- **Check for comment resolution**: Yes
- **Build validation**: Yes (azure-pipelines.yml)

### Develop Branch
- **Require pull request**: Yes
- **Minimum reviewers**: 1
- **Build validation**: Yes (azure-pipelines.yml)

## Azure Resources Required

### Resource Group: triskelgate-rg
```bash
# Crear resource group
az group create --name triskelgate-rg --location eastus2
```

### Azure Container Registry
```bash
# Crear ACR
az acr create --resource-group triskelgate-rg \
  --name triskelgate \
  --sku Standard \
  --admin-enabled true
```

### Azure App Service Plan
```bash
# Crear App Service Plan (Linux)
az appservice plan create --name triskelgate-plan \
  --resource-group triskelgate-rg \
  --sku P1V2 \
  --is-linux \
  --location eastus2
```

### Azure App Service (Staging)
```bash
# Crear App Service para Staging
az webapp create --resource-group triskelgate-rg \
  --plan triskelgate-plan \
  --name triskelgate-platform-staging \
  --deployment-container-image-name triskelgate.azurecr.io/triskelgate/payment-platform:latest-dev
```

### Azure App Service (Production)
```bash
# Crear App Service para Production con deployment slot
az webapp create --resource-group triskelgate-rg \
  --plan triskelgate-plan \
  --name triskelgate-platform-prod \
  --deployment-container-image-name triskelgate.azurecr.io/triskelgate/payment-platform:latest

# Crear staging slot para blue-green deployment
az webapp deployment slot create --resource-group triskelgate-rg \
  --name triskelgate-platform-prod \
  --slot staging
```

### Azure Database (Opcional - PostgreSQL)
```bash
# Si decides migrar de SQLite a PostgreSQL
az postgres server create --resource-group triskelgate-rg \
  --name triskelgate-db \
  --location eastus2 \
  --admin-user triskeladmin \
  --admin-password [SecurePassword] \
  --sku-name GP_Gen5_2
```

## Configuración de Monitoreo

### Application Insights
```bash
# Crear Application Insights
az monitor app-insights component create --app triskelgate-insights \
  --location eastus2 \
  --resource-group triskelgate-rg \
  --application-type web
```

### Log Analytics Workspace
```bash
# Crear Log Analytics Workspace
az monitor log-analytics workspace create --resource-group triskelgate-rg \
  --workspace-name triskelgate-logs \
  --location eastus2
```

## Pipeline Triggers

### Continuous Integration (CI)
- **Trigger**: Push to any branch
- **Paths**: Exclude documentation changes
- **Actions**: Build, Test, Security Analysis

### Continuous Deployment (CD)
- **Staging**: Automatic deployment from `develop` branch
- **Production**: Automatic deployment from `main` branch (with approval)

### Pull Request Validation
- **Trigger**: Pull requests to `main` or `develop`
- **Actions**: Build, Test, Security Analysis
- **Requirement**: All checks must pass before merge

## Configuración de Notificaciones

### Slack Integration
- **Build Success**: Notify #triskelgate-deployments
- **Build Failure**: Notify #triskelgate-alerts
- **Production Deployment**: Notify #triskelgate-production

### Email Notifications
- **Build Failure**: Notify development team
- **Security Issues**: Notify security team
- **Production Issues**: Notify operations team
