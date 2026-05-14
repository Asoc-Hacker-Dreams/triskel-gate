import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Chainable mock DB
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  set: jest.fn(),
  limit: jest.fn(),
  execute: jest.fn(),
  get: jest.fn()
};

// Make every method return mockDb for chaining
for (const key of Object.keys(mockDb)) {
  mockDb[key].mockReturnValue(mockDb);
}

jest.unstable_mockModule('../src/db/connection.js', () => ({
  db: mockDb
}));

jest.unstable_mockModule('../src/db/schema.js', () => ({
  staff: 'staff',
  events: 'events',
  tickets: 'tickets',
  ticketTypes: 'ticketTypes',
  orders: 'orders',
  validationLogs: 'validationLogs',
  salesStats: 'salesStats'
}));

jest.unstable_mockModule('drizzle-orm', () => ({
  eq: jest.fn((...args) => ({ op: 'eq', args })),
  and: jest.fn((...args) => ({ op: 'and', args })),
  or: jest.fn((...args) => ({ op: 'or', args })),
  sql: jest.fn()
}));

// Dynamic imports after mocks
let authRoutes, AuthService;
beforeAll(async () => {
  const authModule = await import('../src/middleware/auth.js');
  AuthService = authModule.AuthService;
  const routeModule = await import('../src/routes/auth.js');
  authRoutes = routeModule.default;
});

describe('Authentication Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    // Reset all mock implementations to return mockDb for chaining
    for (const key of Object.keys(mockDb)) {
      mockDb[key].mockClear();
      mockDb[key].mockReturnValue(mockDb);
    }
  });

  describe('POST /auth/login', () => {
    test('should login with valid credentials', async () => {
      // AuthService.login does: db.select().from(staff).where().limit()
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: global.testUtils.testPasswordHash,
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.role).toBe('admin');
    });

    test('should reject invalid credentials', async () => {
      // No user found
      mockDb.limit.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Credenciales inválidas');
    });

    test('should reject inactive user', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: global.testUtils.testPasswordHash,
        role: 'admin',
        permissions: '[]',
        isActive: false
      }]);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cuenta deshabilitada');
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
      // authenticate middleware does db.select().from(staff).where().limit()
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout exitoso. Token invalidado en el cliente.');
    });
  });
});

describe('Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(() => mockRes)
    };
    for (const key of Object.keys(mockDb)) {
      mockDb[key].mockClear();
      mockDb[key].mockReturnValue(mockDb);
    }
  });

  describe('AuthService.authenticate', () => {
    test('should authenticate valid token', async () => {
      const token = global.testUtils.generateTestToken();
      mockReq = {
        headers: { authorization: `Bearer ${token}` }
      };

      // Mock DB lookup for user
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      await AuthService.authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.email).toBe('test@example.com');
    });

    test('should reject missing token', async () => {
      mockReq = { headers: {} };

      await AuthService.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Token de autenticación requerido'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject invalid token format', async () => {
      mockReq = {
        headers: { authorization: 'InvalidFormat token123' }
      };

      await AuthService.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject expired token', async () => {
      const expiredToken = global.testUtils.generateTestToken({
        exp: Math.floor(Date.now() / 1000) - 3600
      });
      mockReq = {
        headers: { authorization: `Bearer ${expiredToken}` }
      };

      await AuthService.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('AuthService.requireRole', () => {
    test('should allow user with required role', () => {
      mockReq = { user: { role: 'admin' } };

      const middleware = AuthService.requireRole(['admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject user without required role', () => {
      mockReq = { user: { role: 'staff' } };

      const middleware = AuthService.requireRole(['admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'FORBIDDEN',
        message: 'Permisos insuficientes'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow multiple roles', () => {
      mockReq = { user: { role: 'staff' } };

      const middleware = AuthService.requireRole(['admin', 'staff']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
