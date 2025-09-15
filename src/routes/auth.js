import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../middleware/auth.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Rate limiting para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP por ventana
  message: {
    success: false,
    error: 'TOO_MANY_ATTEMPTS',
    message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de validación de errores
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Login de usuario
 */
router.post('/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email válido requerido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Contraseña debe tener al menos 6 caracteres')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      const statusCode = result.success ? 200 : 401;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        error: 'LOGIN_ERROR',
        message: 'Error interno durante el login'
      });
    }
  }
);

/**
 * Obtener información del usuario actual
 */
router.get('/me',
  authMiddleware,
  async (req, res) => {
    try {
      const result = await AuthService.getCurrentUser(req.user.id);

      if (result.success) {
        res.json({
          success: true,
          user: result.user
        });
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      res.status(500).json({
        success: false,
        error: 'GET_USER_ERROR',
        message: 'Error obteniendo información del usuario'
      });
    }
  }
);

/**
 * Cambiar contraseña
 */
router.put('/change-password',
  authMiddleware,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Contraseña actual requerida'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Nueva contraseña debe tener al menos 8 caracteres, incluyendo mayúscula, minúscula, número y símbolo'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Las contraseñas no coinciden');
        }
        return true;
      })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({
        success: false,
        error: 'PASSWORD_CHANGE_ERROR',
        message: 'Error interno cambiando contraseña'
      });
    }
  }
);

/**
 * Crear nuevo usuario de staff (solo administradores)
 */
router.post('/create-staff',
  authMiddleware,
  AuthService.requireRole(['admin']),
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email válido requerido'),
    body('name')
      .isLength({ min: 2 })
      .withMessage('Nombre debe tener al menos 2 caracteres'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Contraseña debe tener al menos 8 caracteres, incluyendo mayúscula, minúscula, número y símbolo'),
    body('role')
      .isIn(['admin', 'staff', 'validator'])
      .withMessage('Rol debe ser admin, staff o validator'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permisos deben ser un array')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, name, password, role, permissions } = req.body;

      const result = await AuthService.createStaffUser({
        email,
        name,
        password,
        role,
        permissions: permissions || []
      });

      const statusCode = result.success ? 201 : 400;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error creando usuario de staff:', error);
      res.status(500).json({
        success: false,
        error: 'CREATE_STAFF_ERROR',
        message: 'Error creando usuario de staff'
      });
    }
  }
);

/**
 * Logout (invalidar token - esto sería manejado en el frontend)
 */
router.post('/logout',
  authMiddleware,
  (req, res) => {
    // En un sistema JWT stateless, el logout se maneja en el frontend
    // eliminando el token del almacenamiento local
    res.json({
      success: true,
      message: 'Logout exitoso. Token invalidado en el cliente.'
    });
  }
);

/**
 * Verificar token
 */
router.get('/verify',
  authMiddleware,
  (req, res) => {
    res.json({
      success: true,
      message: 'Token válido',
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        permissions: req.user.permissions
      }
    });
  }
);

/**
 * Información de autenticación
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'TriskelGate Authentication Service',
    version: '1.0.0',
    endpoints: {
      'POST /auth/login': 'Iniciar sesión',
      'GET /auth/me': 'Obtener usuario actual',
      'PUT /auth/change-password': 'Cambiar contraseña',
      'POST /auth/create-staff': 'Crear usuario de staff (admin)',
      'POST /auth/logout': 'Cerrar sesión',
      'GET /auth/verify': 'Verificar token',
      'GET /auth/info': 'Información del servicio'
    },
    roles: {
      admin: 'Administrador total del sistema',
      staff: 'Personal de gestión',
      validator: 'Validador de tickets'
    },
    permissions: [
      'validate_tickets',
      'search_tickets',
      'manage_events',
      'process_refunds',
      'view_analytics',
      'manage_users',
      'system_admin'
    ],
    security: {
      'Rate Limiting': '5 intentos de login por 15 minutos',
      'Password Requirements': 'Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo',
      'JWT Expiration': '24 horas',
      'Token Type': 'Bearer JWT'
    }
  });
});

export default router;
