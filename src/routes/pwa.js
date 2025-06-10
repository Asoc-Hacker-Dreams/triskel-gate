import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * @swagger
 * /pwa:
 *   get:
 *     summary: Servir aplicación PWA
 *     description: Sirve la aplicación web progresiva de validación de tickets
 *     tags: [PWA]
 *     responses:
 *       200:
 *         description: Aplicación PWA cargada
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/validator.html'));
});

/**
 * @swagger
 * /pwa/manifest.json:
 *   get:
 *     summary: Obtener manifest de PWA
 *     description: Sirve el archivo manifest.json para la PWA
 *     tags: [PWA]
 *     responses:
 *       200:
 *         description: Manifest de la PWA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/manifest.json'));
});

/**
 * @swagger
 * /pwa/sw.js:
 *   get:
 *     summary: Obtener Service Worker
 *     description: Sirve el archivo service worker para la PWA
 *     tags: [PWA]
 *     responses:
 *       200:
 *         description: Service Worker script
 *         content:
 *           application/javascript:
 *             schema:
 *               type: string
 */
router.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../../public/sw.js'));
});

// Ruta para obtener información de la PWA
router.get('/info', (req, res) => {
  res.json({
    name: 'TriskelGate Ticket Validator',
    version: '1.0.0',
    type: 'Progressive Web App',
    features: {
      offline: true,
      notifications: true,
      qrScanner: true,
      installable: true,
      responsive: true
    },
    capabilities: {
      cameraAccess: 'Para escaneo de códigos QR',
      localStorage: 'Para funcionamiento offline',
      serviceWorker: 'Para cache y sincronización',
      notifications: 'Para alertas de validación',
      wakeLock: 'Para mantener pantalla activa'
    },
    endpoints: {
      app: '/pwa',
      manifest: '/pwa/manifest.json',
      serviceWorker: '/pwa/sw.js'
    }
  });
});

export default router;
