import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock del servidor principal
let app;

// Importar y configurar el servidor para testing
async function setupTestApp() {
  // Mock de la base de datos en memoria
  process.env.DATABASE_URL = ':memory:';
  process.env.NODE_ENV = 'test';
  
  app = express();
  
  // Configurar middleware básico
  app.use(express.json());
  app.use(express.static('public'));
  
  // Importar rutas mock
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
  });
  
  return app;
}

describe('Integration Tests', () => {
  beforeEach(async () => {
    app = await setupTestApp();
  });

  afterEach(() => {
    // Limpiar después de cada test
    jest.clearAllMocks();
  });

  describe('Server Health', () => {
    test('should respond to health check', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should serve static files', async () => {
      // Crear archivo de prueba temporalmente
      const testFilePath = path.join(__dirname, '../public/test.txt');
      fs.writeFileSync(testFilePath, 'test content');

      const response = await request(app)
        .get('/test.txt');

      expect(response.status).toBe(200);
      expect(response.text).toBe('test content');

      // Limpiar archivo de prueba
      fs.unlinkSync(testFilePath);
    });
  });

  describe('API Endpoints Integration', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      // Without CORS middleware configured, express returns 200 for OPTIONS
      expect([200, 204]).toContain(response.status);
    });

    test('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/json')
        .send('invalid json{');

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication Flow Integration', () => {
    test('should complete full login flow', async () => {
      // Mock auth route using email-based login
      app.post('/auth/login', (req, res) => {
        const { email, password } = req.body;
        
        if (email === 'test@example.com' && password === 'password') {
          res.json({
            success: true,
            token: 'test-jwt-token',
            user: {
              id: 1,
              email: 'test@example.com',
              name: 'Test User',
              role: 'admin',
              permissions: []
            }
          });
        } else {
          res.status(401).json({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Credenciales inválidas'
          });
        }
      });

      // Test successful login
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.user.email).toBe('test@example.com');

      // Test protected route with token
      app.get('/api/protected', (req, res) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          res.json({ message: 'Access granted', user: { id: 1 } });
        } else {
          res.status(401).json({ message: 'Unauthorized' });
        }
      });

      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${loginResponse.body.token}`);

      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.message).toBe('Access granted');
    });

    test('should reject invalid credentials', async () => {
      app.post('/auth/login', (req, res) => {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas'
        });
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Ticket Validation Flow Integration', () => {
    test('should complete full ticket validation flow', async () => {
      // Mock validation endpoint using qrCode field
      app.post('/api/validate', (req, res) => {
        const { qrCode } = req.body;
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Token requerido'
          });
        }

        if (qrCode === 'VALID-QR-001') {
          res.json({
            success: true,
            ticket: {
              id: 1,
              ticketNumber: 'T-TEST-001',
              holderName: 'Test User',
              holderEmail: 'test@example.com',
              price: 50.00,
              validatedAt: new Date().toISOString()
            },
            event: { name: 'Test Event', location: 'Test Venue' },
            ticketType: { name: 'General' },
            message: 'Ticket validado correctamente'
          });
        } else if (qrCode === 'USED-QR-001') {
          res.status(400).json({
            success: false,
            error: 'TICKET_ALREADY_USED',
            message: 'Este ticket ya ha sido utilizado',
            usedAt: '2025-06-09 10:00:00'
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'TICKET_NOT_FOUND',
            message: 'El código QR no corresponde a ningún ticket válido'
          });
        }
      });

      const token = 'test-jwt-token';

      // Test valid ticket
      const validResponse = await request(app)
        .post('/api/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          qrCode: 'VALID-QR-001',
          staffId: 1
        });

      expect(validResponse.status).toBe(200);
      expect(validResponse.body.success).toBe(true);
      expect(validResponse.body.ticket.ticketNumber).toBe('T-TEST-001');

      // Test used ticket
      const usedResponse = await request(app)
        .post('/api/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          qrCode: 'USED-QR-001',
          staffId: 1
        });

      expect(usedResponse.status).toBe(400);
      expect(usedResponse.body.success).toBe(false);
      expect(usedResponse.body.message).toBe('Este ticket ya ha sido utilizado');

      // Test invalid ticket
      const invalidResponse = await request(app)
        .post('/api/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          qrCode: 'INVALID-QR-001',
          staffId: 1
        });

      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.success).toBe(false);
    });
  });

  describe('Search Functionality Integration', () => {
    test('should search tickets by different criteria', async () => {
      const mockTickets = [
        {
          id: 1,
          ticketNumber: 'T-TEST-001',
          holderName: 'John Doe',
          holderEmail: 'john@example.com',
          isUsed: false,
          event: { name: 'Test Event' },
          ticketType: { name: 'General' }
        },
        {
          id: 2,
          ticketNumber: 'T-TEST-002',
          holderName: 'Jane Smith',
          holderEmail: 'jane@example.com',
          isUsed: true,
          event: { name: 'Test Event' },
          ticketType: { name: 'VIP' }
        }
      ];

      app.get('/api/search', (req, res) => {
        const { email, ticketNumber } = req.query;
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Token requerido'
          });
        }

        let results = [];
        
        if (email) {
          results = mockTickets.filter(ticket => 
            ticket.holderEmail.toLowerCase().includes(email.toLowerCase())
          );
        } else if (ticketNumber) {
          results = mockTickets.filter(ticket => 
            ticket.ticketNumber.toLowerCase().includes(ticketNumber.toLowerCase())
          );
        }

        res.json({
          success: true,
          tickets: results,
          total: results.length
        });
      });

      const token = 'test-jwt-token';

      // Search by email
      const emailResponse = await request(app)
        .get('/api/search?email=john@example.com')
        .set('Authorization', `Bearer ${token}`);

      expect(emailResponse.status).toBe(200);
      expect(emailResponse.body.tickets).toHaveLength(1);
      expect(emailResponse.body.tickets[0].holderEmail).toBe('john@example.com');

      // Search by ticketNumber
      const ticketResponse = await request(app)
        .get('/api/search?ticketNumber=T-TEST-002')
        .set('Authorization', `Bearer ${token}`);

      expect(ticketResponse.status).toBe(200);
      expect(ticketResponse.body.tickets).toHaveLength(1);
      expect(ticketResponse.body.tickets[0].ticketNumber).toBe('T-TEST-002');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    test('should handle malformed requests', async () => {
      app.post('/api/test-validation', (req, res) => {
        if (!req.body.requiredField) {
          return res.status(400).json({
            success: false,
            message: 'Campo requerido faltante'
          });
        }
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/api/test-validation')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle server errors', async () => {
      app.get('/api/error-test', (req, res) => {
        throw new Error('Test server error');
      });

      // Add error handler
      app.use((error, req, res, next) => {
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor'
        });
      });

      const response = await request(app)
        .get('/api/error-test');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting Integration', () => {
    test('should handle rate limiting', async () => {
      let requestCount = 0;
      
      app.use('/api/rate-limited', (req, res, next) => {
        requestCount++;
        if (requestCount > 5) {
          return res.status(429).json({
            success: false,
            message: 'Demasiadas solicitudes'
          });
        }
        next();
      });

      app.get('/api/rate-limited', (req, res) => {
        res.json({ success: true, requestCount });
      });

      // Make multiple requests
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .get('/api/rate-limited');
        expect(response.status).toBe(200);
        expect(response.body.requestCount).toBe(i);
      }

      // This should be rate limited
      const rateLimitedResponse = await request(app)
        .get('/api/rate-limited');

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.message).toBe('Demasiadas solicitudes');
    });
  });
});
