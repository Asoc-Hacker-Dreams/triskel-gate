import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    qrPath: {
      type: 'string',
      example: '/qr-codes/TRISKELGATE-2025-001.png'
    },enapi: '3.0.0',
    info: {
      title: 'TriskelGate Payment Platform API',
      version: '1.0.0',
      description: `
        Plataforma de pago y validación de tickets superior a Eventbrite.
        
        ## Características principales
        - 🎫 Validación de tickets con códigos QR únicos
        - 💳 Procesamiento seguro de pagos con Stripe  
        - 🔍 Búsqueda avanzada de tickets
        - 📊 Estadísticas en tiempo real
        - 🔐 Sistema de autenticación JWT
        - 👥 Gestión de roles y permisos
        - 📱 PWA con soporte offline
        - 🔄 API RESTful completa
        
        ## Autenticación
        La mayoría de endpoints requieren autenticación JWT. Incluye el token en el header:
        \`Authorization: Bearer <token>\`
        
        ## Códigos de estado
        - \`200\` - Éxito
        - \`400\` - Error de validación
        - \`401\` - No autorizado
        - \`403\` - Permisos insuficientes
        - \`404\` - No encontrado
        - \`429\` - Rate limit excedido
        - \`500\` - Error interno del servidor
      `,
      contact: {
        name: 'TriskelGate Team',
        email: 'tech@triskelgate.com',
        url: 'https://triskelgate.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://payments.triskelgate.com',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido del endpoint de login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'ERROR_CODE'
            }
          }
        },
        Ticket: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            code: {
              type: 'string',
              example: 'TRISKELGATE-2025-001'
            },
            eventId: {
              type: 'integer',
              example: 1
            },
            ticketTypeId: {
              type: 'integer',
              example: 1
            },
            orderId: {
              type: 'integer',
              example: 1
            },
            holderName: {
              type: 'string',
              example: 'John Doe'
            },
            holderEmail: {
              type: 'string',
              example: 'john@example.com'
            },
            isUsed: {
              type: 'boolean',
              example: false
            },
            usedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: null
            },
            qrCodePath: {
              type: 'string',
              example: '/qr-codes/triskelgate-2025-001.png'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-06-09T12:00:00Z'
            }
          }
        },
        Event: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            name: {
              type: 'string',
              example: 'TriskelGate 2025'
            },
            description: {
              type: 'string',
              example: 'El evento de hacking más importante de Barcelona'
            },
            date: {
              type: 'string',
              format: 'date-time',
              example: '2025-12-31T20:00:00Z'
            },
            venue: {
              type: 'string',
              example: 'Palau de la Música Catalana'
            },
            maxCapacity: {
              type: 'integer',
              example: 500
            },
            isActive: {
              type: 'boolean',
              example: true
            }
          }
        },
        TicketType: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            name: {
              type: 'string',
              example: 'General'
            },
            description: {
              type: 'string',
              example: 'Entrada general al evento'
            },
            price: {
              type: 'number',
              format: 'float',
              example: 50.00
            },
            maxQuantity: {
              type: 'integer',
              example: 300
            },
            soldQuantity: {
              type: 'integer',
              example: 150
            },
            isAvailable: {
              type: 'boolean',
              example: true
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            username: {
              type: 'string',
              example: 'admin'
            },
            email: {
              type: 'string',
              example: 'admin@triskelgate.com'
            },
            role: {
              type: 'string',
              enum: ['admin', 'staff', 'validator'],
              example: 'admin'
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['validate_tickets', 'search_tickets', 'manage_events']
            }
          }
        },
        ValidationStats: {
          type: 'object',
          properties: {
            totalTickets: {
              type: 'integer',
              example: 500
            },
            usedTickets: {
              type: 'integer',
              example: 150
            },
            todayValidations: {
              type: 'integer',
              example: 25
            },
            totalValidations: {
              type: 'integer',
              example: 150
            },
            recentValidations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticketCode: {
                    type: 'string',
                    example: 'TRISKELGATE-2025-001'
                  },
                  holderName: {
                    type: 'string',
                    example: 'John Doe'
                  },
                  validatedAt: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-06-09T12:00:00Z'
                  },
                  validatorName: {
                    type: 'string',
                    example: 'Admin User'
                  }
                }
              }
            },
            ticketTypeStats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticketType: {
                    type: 'string',
                    example: 'General'
                  },
                  total: {
                    type: 'integer',
                    example: 300
                  },
                  used: {
                    type: 'integer',
                    example: 90
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints de autenticación y autorización'
      },
      {
        name: 'Tickets',
        description: 'Validación y gestión de tickets'
      },
      {
        name: 'Events',
        description: 'Información de eventos públicos'
      },
      {
        name: 'Admin',
        description: 'Endpoints administrativos'
      },
      {
        name: 'Health',
        description: 'Monitoreo y health checks'
      }
    ]
  },
  apis: [
    './src/routes/*.js', // Rutas con documentación
    './src/index.js'     // Archivo principal
  ]
};

const specs = swaggerJsdoc(options);

export { specs };

export const setupSwagger = (app) => {
  // Endpoint para servir la documentación Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info hgroup.main h2 { color: #4338ca }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 10px; border-radius: 8px; }
    `,
    customSiteTitle: 'TriskelGate Payment Platform API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    }
  }));

  // Endpoint para obtener el JSON spec
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Endpoint de información de la API
  app.get('/api/info', (req, res) => {
    res.json({
      name: 'TriskelGate Payment Platform API',
      version: '1.0.0',
      description: 'Plataforma de pago y validación de tickets superior a Eventbrite',
      documentation: {
        swagger: '/api/docs',
        json: '/api/docs.json',
        postman: '/api/postman'
      },
      endpoints: {
        health: '/health',
        ready: '/ready',
        auth: {
          login: 'POST /auth/login',
          logout: 'POST /auth/logout'
        },
        tickets: {
          validate: 'POST /api/validate',
          search: 'GET /api/search',
          stats: 'GET /api/stats'
        },
        events: {
          list: 'GET /api/events',
          ticketTypes: 'GET /api/events/:id/ticket-types'
        }
      },
      features: [
        'Validación de tickets QR',
        'Procesamiento de pagos',
        'Búsqueda avanzada',
        'Estadísticas en tiempo real',
        'PWA con soporte offline',
        'Sistema de roles',
        'API RESTful'
      ]
    });
  });

  console.log('📖 Swagger documentation available at /api/docs');
};
