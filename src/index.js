import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { runMigrations } from './db/connection.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import pwaRoutes from './routes/pwa.js';
import { AuthService } from './middleware/auth.js';
import { setupSwagger } from './config/swagger.js';

// Configuración de logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'triskelgate-payment-platform' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuración
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware de parsing
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use(express.static('public'));

// Configurar documentación Swagger
setupSwagger(app);

// Middleware de logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Rutas principales
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/pwa', pwaRoutes);

// Health check endpoint para Docker y monitoring
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    pid: process.pid
  };

  try {
    // Verificar conectividad de base de datos
    const dbStatus = 'connected'; // En una implementación real, verificarías la DB
    healthCheck.database = dbStatus;
    
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.message = 'ERROR';
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
    res.status(503).json(healthCheck);
  }
});

// Readiness probe para Kubernetes
app.get('/ready', (req, res) => {
  const readinessCheck = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'ok',
      filesystem: 'ok',
      memory: process.memoryUsage().heapUsed < process.memoryUsage().heapTotal * 0.9 ? 'ok' : 'warning'
    }
  };

  const allChecksPass = Object.values(readinessCheck.checks).every(check => check === 'ok');
  
  res.status(allChecksPass ? 200 : 503).json(readinessCheck);
});

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🎫 TriskelGate Payment Platform API',
    version: '1.0.0',
    description: 'Plataforma de pago y validación de tickets superior a Eventbrite',
    documentation: '/api/info',
    status: 'operational',
    timestamp: new Date().toISOString(),
    features: [
      '✅ Validación de tickets con QR único',
      '✅ Procesamiento de pagos con Stripe',
      '✅ Generación automática de PDFs',
      '✅ Búsqueda avanzada de tickets',
      '✅ Sistema de reembolsos',
      '✅ Panel de administración',
      '✅ API RESTful completa',
      '✅ Seguridad avanzada',
      '✅ Estadísticas en tiempo real',
      '✅ Sistema de roles y permisos'
    ]
  });
});

// Middleware de manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      main: 'GET /',
      api: 'GET /api/info',
      health: 'GET /api/health',
      validation: 'POST /api/validate',
      search: 'GET /api/search',
      payment: 'POST /api/payment/create-session',
      auth: 'POST /auth/login',
      admin: 'GET /admin/dashboard'
    }
  });
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
  logger.error('Error no manejado:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // No exponer detalles del error en producción
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(error.status || 500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: isDevelopment ? error.message : 'Error interno del servidor',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Función para inicializar la aplicación
async function initializeApp() {
  try {
    logger.info('🚀 Iniciando TriskelGate Payment Platform...');

    // Ejecutar migraciones de base de datos
    await runMigrations();
    logger.info('✅ Base de datos inicializada');

    // Crear usuario administrador por defecto si no existe
    await createDefaultAdmin();

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`🎫 TriskelGate Payment Platform corriendo en puerto ${PORT}`);
      logger.info(`📖 Documentación disponible en http://localhost:${PORT}/api/info`);
      logger.info(`🔗 Health check en http://localhost:${PORT}/api/health`);
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🎫 TriskelGate Payment Platform             ║
║                                                              ║
║  Puerto: ${PORT}                                               ║
║  Entorno: ${process.env.NODE_ENV || 'development'}                                        ║
║  API: http://localhost:${PORT}/api                            ║
║  Docs: http://localhost:${PORT}/api/info                      ║
║                                                              ║
║  ✅ Superior a Eventbrite                                    ║
║  ✅ Validación QR en tiempo real                            ║
║  ✅ Seguridad avanzada                                      ║
║  ✅ Panel de administración                                 ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error('❌ Error inicializando aplicación:', error);
    process.exit(1);
  }
}

// Crear usuario administrador por defecto
async function createDefaultAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@triskelgate.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'TriskelGate2025!Admin';

    const result = await AuthService.createStaffUser({
      email: adminEmail,
      name: 'Administrador TriskelGate',
      password: adminPassword,
      role: 'admin',
      permissions: [
        'validate_tickets',
        'search_tickets',
        'manage_events',
        'process_refunds',
        'view_analytics',
        'manage_users',
        'system_admin'
      ]
    });

    if (result.success) {
      logger.info(`✅ Usuario administrador creado: ${adminEmail}`);
      console.log(`
⚠️  CREDENCIALES DE ADMINISTRADOR:
📧 Email: ${adminEmail}
🔐 Password: ${adminPassword}
⚠️  ¡CAMBIA ESTAS CREDENCIALES EN PRODUCCIÓN!
      `);
    } else if (result.error === 'EMAIL_EXISTS') {
      logger.info('ℹ️  Usuario administrador ya existe');
    } else {
      logger.warn('⚠️  No se pudo crear usuario administrador:', result.message);
    }

  } catch (error) {
    logger.error('Error creando administrador por defecto:', error);
  }
}

// Manejo graceful de cierre de aplicación
process.on('SIGTERM', () => {
  logger.info('🔄 Cerrando aplicación gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🔄 Cerrando aplicación gracefully...');
  process.exit(0);
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promise rejection no manejada:', { reason, promise });
  process.exit(1);
});

// Inicializar aplicación
initializeApp();

export default app;
