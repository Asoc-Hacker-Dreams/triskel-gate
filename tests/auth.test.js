import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth.js';
import { authenticateToken, requireRole } from '../../src/middleware/auth.js';

// Mock de la base de datos
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  from: jest.fn(() => mockDb),
  where: jest.fn(() => mockDb),
  values: jest.fn(() => mockDb),
  execute: jest.fn(),
  get: jest.fn()
};

jest.unstable_mockModule('../../src/db/connection.js', () => ({
  db: mockDb
}));

describe('Authentication Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    test('should login with valid credentials', async () => {
      // Mock user found in database
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        username: 'testuser',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        role: 'admin',
        isActive: true
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe('testuser');
      expect(response.body.user.role).toBe('admin');
    });

    test('should reject invalid credentials', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'wronguser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Credenciales inválidas');
    });

    test('should reject inactive user', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        username: 'testuser',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        role: 'admin',
        isActive: false
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Usuario desactivado');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout exitoso');
    });
  });
});

describe('Authentication Middleware', () => {
  let app, mockReq, mockRes, mockNext;

  beforeEach(() => {
    app = express();
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(() => mockRes)
    };
  });

  describe('authenticateToken', () => {
    test('should authenticate valid token', async () => {
      const token = global.testUtils.generateTestToken();
      mockReq = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.username).toBe('testuser');
    });

    test('should reject missing token', () => {
      mockReq = { headers: {} };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token de acceso requerido'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject invalid token format', () => {
      mockReq = {
        headers: {
          authorization: 'InvalidFormat token123'
        }
      };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject expired token', () => {
      const expiredToken = global.testUtils.generateTestToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
      mockReq = {
        headers: {
          authorization: `Bearer ${expiredToken}`
        }
      };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    test('should allow user with required role', () => {
      mockReq = {
        user: { role: 'admin' }
      };

      const middleware = requireRole(['admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject user without required role', () => {
      mockReq = {
        user: { role: 'staff' }
      };

      const middleware = requireRole(['admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Permisos insuficientes'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow multiple roles', () => {
      mockReq = {
        user: { role: 'staff' }
      };

      const middleware = requireRole(['admin', 'staff']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
