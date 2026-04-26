import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { staff } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class AuthService {
  
  /**
   * Middleware de autenticación JWT (Supabase + Legacy dual-mode)
   */
  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Token de autenticación requerido'
        });
      }

      const token = authHeader.substring(7); // Remove "Bearer "
      
      let decoded;
      let authMode = 'legacy';

      // Strategy 1: Try Supabase JWT (new federated auth)
      const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
      if (supabaseJwtSecret) {
        try {
          decoded = jwt.verify(token, supabaseJwtSecret);
          authMode = 'supabase';
        } catch (_supaErr) {
          // Supabase token invalid; fall through to legacy
        }
      }

      // Strategy 2: Legacy self-issued JWT
      if (!decoded) {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        authMode = 'legacy';
      }

      if (authMode === 'supabase') {
        // Supabase tokens have .email and .sub (user UUID)
        const email = decoded.email;
        const supabaseUserId = decoded.sub;

        if (!email) {
          return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Token sin email válido' });
        }

        // Find or auto-create staff user by email
        let user = await db
          .select()
          .from(staff)
          .where(eq(staff.email, email.toLowerCase()))
          .limit(1);

        if (user.length === 0) {
          // Auto-provision user from Supabase identity
          const newUser = await db
            .insert(staff)
            .values({
              email: email.toLowerCase(),
              name: decoded.user_metadata?.full_name || email.split('@')[0],
              authProvider: 'supabase',
              authProviderId: supabaseUserId,
              role: 'staff',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .returning();
          user = newUser;
        }

        if (!user[0].isActive) {
          return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Usuario inactivo' });
        }

        // Update last login + provider ID if missing
        await db.update(staff).set({
          lastLoginAt: new Date().toISOString(),
          authProviderId: supabaseUserId,
          updatedAt: new Date().toISOString()
        }).where(eq(staff.id, user[0].id));

        req.user = {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          role: user[0].role,
          permissions: user[0].permissions ? JSON.parse(user[0].permissions) : []
        };

      } else {
        // Legacy mode: decoded has { id, email, role }
        const user = await db
          .select()
          .from(staff)
          .where(eq(staff.id, decoded.id))
          .limit(1);

        if (user.length === 0 || !user[0].isActive) {
          return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Usuario no válido o inactivo' });
        }

        req.user = {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          role: user[0].role,
          permissions: user[0].permissions ? JSON.parse(user[0].permissions) : []
        };
      }

      next();

    } catch (error) {
      console.error('Error de autenticación:', error);
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token inválido'
      });
    }
  }

  /**
   * Middleware de autorización por rol
   */
  static requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Autenticación requerida'
        });
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Permisos insuficientes'
        });
      }

      next();
    };
  }

  /**
   * Middleware de autorización por permiso específico
   */
  static requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Autenticación requerida'
        });
      }

      const userPermissions = req.user.permissions || [];
      
      if (!userPermissions.includes(permission) && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Permiso específico requerido'
        });
      }

      next();
    };
  }

  /**
   * Login de usuario
   */
  static async login(email, password) {
    try {
      const user = await db
        .select()
        .from(staff)
        .where(eq(staff.email, email.toLowerCase()))
        .limit(1);

      if (user.length === 0) {
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas'
        };
      }

      const userData = user[0];

      if (!userData.isActive) {
        return {
          success: false,
          error: 'ACCOUNT_DISABLED',
          message: 'Cuenta deshabilitada'
        };
      }

      const passwordMatch = await bcrypt.compare(password, userData.passwordHash);

      if (!passwordMatch) {
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas'
        };
      }

      // Actualizar último login
      await db
        .update(staff)
        .set({
          lastLoginAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(staff.id, userData.id));

      // Generar token JWT
      const token = jwt.sign(
        {
          id: userData.id,
          email: userData.email,
          role: userData.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        token,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          permissions: userData.permissions ? JSON.parse(userData.permissions) : []
        }
      };

    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        error: 'LOGIN_ERROR',
        message: 'Error durante el login'
      };
    }
  }

  /**
   * Crear usuario de staff
   */
  static async createStaffUser(userData) {
    try {
      const { email, name, password, role = 'staff', permissions = [] } = userData;

      // Verificar que el email no existe
      const existingUser = await db
        .select()
        .from(staff)
        .where(eq(staff.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        return {
          success: false,
          error: 'EMAIL_EXISTS',
          message: 'El email ya está registrado'
        };
      }

      // Hash del password
      const passwordHash = await bcrypt.hash(password, 12);

      // Crear usuario
      const newUser = await db
        .insert(staff)
        .values({
          email: email.toLowerCase(),
          name,
          passwordHash,
          role,
          permissions: JSON.stringify(permissions),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return {
        success: true,
        user: {
          id: newUser[0].id,
          email: newUser[0].email,
          name: newUser[0].name,
          role: newUser[0].role,
          permissions
        }
      };

    } catch (error) {
      console.error('Error creando usuario:', error);
      return {
        success: false,
        error: 'CREATE_USER_ERROR',
        message: 'Error creando usuario'
      };
    }
  }

  /**
   * Cambiar contraseña
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await db
        .select()
        .from(staff)
        .where(eq(staff.id, userId))
        .limit(1);

      if (user.length === 0) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        };
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user[0].passwordHash);

      if (!passwordMatch) {
        return {
          success: false,
          error: 'INVALID_PASSWORD',
          message: 'Contraseña actual incorrecta'
        };
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      await db
        .update(staff)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date().toISOString()
        })
        .where(eq(staff.id, userId));

      return {
        success: true,
        message: 'Contraseña actualizada correctamente'
      };

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      return {
        success: false,
        error: 'PASSWORD_CHANGE_ERROR',
        message: 'Error cambiando contraseña'
      };
    }
  }

  /**
   * Obtener información del usuario actual
   */
  static async getCurrentUser(userId) {
    try {
      const user = await db
        .select({
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: staff.role,
          permissions: staff.permissions,
          lastLoginAt: staff.lastLoginAt,
          createdAt: staff.createdAt
        })
        .from(staff)
        .where(eq(staff.id, userId))
        .limit(1);

      if (user.length === 0) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        };
      }

      return {
        success: true,
        user: {
          ...user[0],
          permissions: user[0].permissions ? JSON.parse(user[0].permissions) : []
        }
      };

    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return {
        success: false,
        error: 'GET_USER_ERROR',
        message: 'Error obteniendo información del usuario'
      };
    }
  }
}

// Exportar middleware como función por defecto
export default AuthService.authenticate;
