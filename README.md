# 🎫 TriskelGate Payment Platform

> **Plataforma de pago y validación de tickets superior a Eventbrite**

Una plataforma completa de gestión de eventos con validación QR en tiempo real, procesamiento seguro de pagos, PWA con soporte offline y panel administrativo avanzado.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen.svg)

## 🚀 Características Principales

### ✅ **Funcionalidades Implementadas**

- 🎫 **Validación de tickets QR único** - Códigos QR únicos por ticket con validación en tiempo real
- 💳 **Procesamiento seguro de pagos** - Integración completa con Stripe
- 🔍 **Búsqueda avanzada** - Búsqueda por código, email, nombre con paginación
- 📊 **Estadísticas en tiempo real** - Dashboard con métricas de validación
- 🔐 **Sistema de autenticación JWT** - Roles granulares (admin/staff/validator)
- 👥 **Gestión de usuarios** - Permisos específicos por rol
- 📱 **PWA con soporte offline** - Progressive Web App installable
- 🔄 **API RESTful completa** - Documentación OpenAPI/Swagger
- 📖 **Documentación interactiva** - Swagger UI integrado
- 🐳 **Configuración Docker** - Contenedores para desarrollo y producción
- 🧪 **Suite completa de tests** - Cobertura de código >80%
- 📈 **CI/CD Pipeline** - GitHub Actions configurado
- 🔒 **Seguridad avanzada** - Rate limiting, CORS, Helmet
- 📄 **Generación de PDFs** - Tickets automáticos con QR
- 💸 **Sistema de reembolsos** - Gestión completa de devoluciones

## 🏗️ Arquitectura

```
payment-platform/
├── src/
│   ├── index.js              # Servidor Express principal
│   ├── config/
│   │   └── swagger.js         # Configuración OpenAPI
│   ├── db/
│   │   ├── connection.js      # Conexión SQLite + migraciones
│   │   └── schema.js          # Esquema de base de datos
│   ├── middleware/
│   │   └── auth.js            # JWT y autorización
│   ├── routes/
│   │   ├── api.js             # Endpoints públicos/privados
│   │   ├── auth.js            # Autenticación
│   │   ├── admin.js           # Panel administrativo
│   │   └── pwa.js             # Progressive Web App
│   └── services/
│       ├── ticketValidation.js # Validación de tickets
│       └── payment.js          # Procesamiento de pagos
├── public/
│   ├── validator.html         # Aplicación web de validación
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── icons/                 # Iconos PWA
├── tests/                     # Suite completa de pruebas
├── data/                      # Base de datos SQLite
└── docker-compose.yml         # Configuración Docker
```

## 🛠️ Instalación y Configuración

### Prerrequisitos

- Node.js >= 18.0.0
- npm o yarn
- Git

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/triskelgate/payment-platform.git
cd payment-platform

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Configurar base de datos
npm run db:migrate
npm run db:seed

# Generar tickets de prueba
npm run test:tickets
```

### Variables de Entorno

```env
# Servidor
NODE_ENV=development
PORT=3001

# Base de datos
DATABASE_PATH=./data/platform.db

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Logging
LOG_LEVEL=debug

# Admin por defecto
ADMIN_EMAIL=admin@triskelgate.com
ADMIN_PASSWORD=TriskelGate2025!Admin
```

## 🚀 Ejecución

### Desarrollo

```bash
# Servidor de desarrollo (con hot reload)
npm run dev

# Ejecutar tests
npm test

# Tests con cobertura
npm run test:coverage

# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Linting y formato
npm run lint
npm run format
```

### Producción

```bash
# Ejecutar en producción
npm start

# Con Docker
docker-compose up -d

# Build para producción
docker build -t triskelgate-platform .
```

## 📖 API Documentation

### Endpoints Principales

#### Autenticación
- `POST /auth/login` - Login con credenciales
- `POST /auth/logout` - Cerrar sesión

#### Validación de Tickets
- `POST /api/validate` - Validar ticket por código QR
- `GET /api/search` - Buscar tickets
- `GET /api/stats` - Estadísticas de validación

#### Eventos Públicos
- `GET /api/events` - Lista de eventos activos
- `GET /api/events/:id/ticket-types` - Tipos de tickets

#### Monitoreo
- `GET /health` - Health check
- `GET /ready` - Readiness probe

### Documentación Interactiva

- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI JSON**: http://localhost:3001/api/docs.json
- **API Info**: http://localhost:3001/api/info

## 📱 Progressive Web App (PWA)

### Funcionalidades PWA

- 📱 **Installable** - Se puede instalar como app nativa
- 🔄 **Offline Support** - Funciona sin conexión
- 📷 **QR Scanner** - Escáner de cámara nativo
- 🔔 **Push Notifications** - Notificaciones de validación
- 💾 **Local Storage** - Cache de datos offline
- 🌐 **Service Worker** - Sincronización en background

### Acceso a la PWA

- **Web App**: http://localhost:3001/validator.html
- **PWA Route**: http://localhost:3001/pwa
- **Manifest**: http://localhost:3001/manifest.json

## 🧪 Testing

### Suite de Pruebas

```bash
# Ejecutar todas las pruebas
npm test

# Solo pruebas unitarias
npm run test:unit

# Solo pruebas de integración
npm run test:integration

# Cobertura de código
npm run test:coverage

# Tests en modo watch
npm run test:watch

# CI/CD tests
npm run test:ci
```

### Cobertura de Código

- **Functions**: >80%
- **Lines**: >80%
- **Branches**: >80%
- **Statements**: >80%

### Reportes

- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **JSON**: `coverage/coverage-final.json`

## 🐳 Docker

### Desarrollo

```bash
# Ejecutar con Docker Compose
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down
```

### Producción

```bash
# Build imagen de producción
docker build -t triskelgate-platform:prod --target production .

# Ejecutar contenedor
docker run -d \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_PATH=/app/data/platform.db \
  -e JWT_SECRET=your-production-secret \
  triskelgate-platform:prod
```

## 🗄️ Base de Datos

### Esquema

La plataforma utiliza SQLite con las siguientes tablas:

- **events** - Información de eventos
- **ticket_types** - Tipos de tickets por evento
- **orders** - Órdenes de compra
- **tickets** - Tickets individuales con QR
- **staff** - Usuarios del sistema
- **validation_logs** - Registro de validaciones
- **sales_stats** - Estadísticas de ventas
- **settings** - Configuración del sistema

### Migraciones

```bash
# Generar nueva migración
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Poblar con datos de prueba
npm run db:seed

# Administrador de BD (web)
npm run db:studio
```

## 🔒 Seguridad

### Medidas Implementadas

- 🔐 **JWT Authentication** - Tokens seguros con expiración
- 🛡️ **Helmet.js** - Headers de seguridad HTTP
- 🚦 **Rate Limiting** - Protección contra ataques DDoS
- 🌐 **CORS** - Control de acceso cross-origin
- 🔍 **Input Validation** - Validación de datos de entrada
- 📝 **Audit Logging** - Registro de todas las acciones
- 🔄 **Hash de Passwords** - bcrypt para contraseñas
- 🚫 **SQL Injection Prevention** - Consultas parametrizadas

## 📊 Monitoreo y Logging

### Health Checks

- `GET /health` - Estado general del servidor
- `GET /ready` - Readiness para Kubernetes

### Logging

- **Winston Logger** configurado
- Logs estructurados en JSON
- Rotación automática de archivos
- Niveles: error, warn, info, debug

### Métricas

- Memoria y CPU usage
- Tiempo de respuesta de APIs
- Estadísticas de validación
- Errores y excepciones

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor con hot reload
npm run build            # Build (no requerido para Node.js)

# Testing
npm test                 # Todas las pruebas
npm run test:unit        # Solo pruebas unitarias
npm run test:integration # Solo pruebas de integración
npm run test:coverage    # Con reporte de cobertura
npm run test:watch       # Modo watch
npm run test:ci          # Para CI/CD

# Base de datos
npm run db:migrate       # Ejecutar migraciones
npm run db:generate      # Generar nueva migración
npm run db:seed          # Poblar con datos de prueba
npm run db:studio        # Administrador web

# Calidad de código
npm run lint             # ESLint
npm run lint:fix         # Fix automático
npm run format           # Prettier

# Utilidades
npm run health           # Health check
npm run validate         # Lint + test
npm run test:tickets     # Generar tickets de prueba
```

## 📋 Testing de la Plataforma

### Script de Testing Automático

```bash
# Ejecutar suite completa de tests de la plataforma
./scripts/test-platform.sh
```

Este script prueba:
- ✅ Health checks y endpoints básicos
- ✅ Documentación Swagger
- ✅ Funcionalidades PWA
- ✅ Autenticación y autorización
- ✅ Validación de tickets
- ✅ Búsqueda y estadísticas
- ✅ Rate limiting
- ✅ Archivos estáticos

## 🛠️ Desarrollo

### Contribuir

1. Fork el repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

### Estructura de Commits

```
tipo(alcance): descripción

[cuerpo opcional]

[footer opcional]
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Code Style

- ESLint configurado con reglas estrictas
- Prettier para formato automático
- Comentarios JSDoc para funciones públicas
- Tests obligatorios para nuevas funcionalidades

## 🚦 CI/CD

### GitHub Actions

Pipeline automático que incluye:

1. **Test Stage**
   - Lint del código
   - Pruebas unitarias
   - Pruebas de integración
   - Cobertura de código

2. **Security Stage**
   - Audit de dependencias
   - Análisis de vulnerabilidades

3. **Build Stage**
   - Build de aplicación
   - Generación de artefactos

4. **Deploy Stage**
   - Deploy a staging (rama develop)
   - Deploy a producción (rama main)

## 🏆 Comparación con Eventbrite

| Característica | TriskelGate Platform | Eventbrite |
|----------------|------------------|------------|
| Validación QR en tiempo real | ✅ | ⚠️ Limited |
| PWA con soporte offline | ✅ | ❌ |
| API RESTful completa | ✅ | ⚠️ Limited |
| Código abierto | ✅ | ❌ |
| Personalización total | ✅ | ❌ |
| Sin comisiones por transacción | ✅ | ❌ |
| Búsqueda avanzada | ✅ | ⚠️ Basic |
| Sistema de roles granular | ✅ | ⚠️ Limited |
| Documentación completa | ✅ | ⚠️ Limited |
| Tests automatizados | ✅ | ❌ |

## 🎯 Casos de Uso

### Eventos Soportados

- 🎤 **Conferencias** - Charlas técnicas, keynotes
- 🏆 **Hackathons** - Competencias de programación
- 🎓 **Workshops** - Talleres educativos
- 🍕 **Meetups** - Encuentros comunidad
- 🎪 **Festivales** - Eventos culturales

### Roles del Sistema

- **Admin** - Acceso completo al sistema
- **Staff** - Gestión de eventos y usuarios
- **Validator** - Solo validación de tickets

## 📞 Soporte

### Documentación

- 📖 **API Docs**: `/api/docs`
- 📋 **README**: Este archivo
- 🔧 **Setup Guide**: Sección instalación
- 🧪 **Testing Guide**: Sección testing

### Contacto

- **Email**: tech@triskelgate.com
- **GitHub Issues**: Para reportar bugs
- **Slack**: #triskelgate-platform

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

## 🙏 Reconocimientos

- **Express.js** - Framework web
- **Stripe** - Procesamiento de pagos
- **SQLite** - Base de datos
- **Jest** - Framework de testing
- **Swagger** - Documentación API
- **PWA Technologies** - Progressive Web App

---

<div align="center">

**🎉 ¡Plataforma superior a Eventbrite lista para TriskelGate 2025! 🎉**

![TriskelGate](https://img.shields.io/badge/TriskelGate-2025-blue.svg)
![Status](https://img.shields.io/badge/status-production%20ready-green.svg)

</div>
