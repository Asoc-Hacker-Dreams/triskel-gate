# Dockerfile para TriskelGate Payment Platform
FROM node:20-alpine AS base

# Usar tini como init process (ya incluido en el contenedor)
# No necesitamos instalar paquetes adicionales para funcionalidad básica

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S triskel -u 1001

# Configurar directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Etapa de desarrollo
FROM base AS development

# Instalar todas las dependencias (incluyendo dev)
RUN npm ci

# Copiar código fuente
COPY . .

# Cambiar permisos
RUN chown -R triskel:nodejs /app
USER triskel

# Exponer puerto
EXPOSE 3001

# Comando de desarrollo
CMD ["npm", "run", "dev"]

# Etapa de construcción
FROM base AS builder

# Copiar código fuente primero
COPY . .

# Instalar dependencias de producción únicamente
RUN npm ci --omit=dev && npm cache clean --force

# Construir aplicación (si es necesario)
RUN npm run build

# Limpiar archivos innecesarios
RUN rm -rf tests/ .git/ .github/ docs/ *.md

# Etapa de producción
FROM node:20-alpine AS production

# Usar tini para manejo de procesos (ya incluido en node:alpine)
# No es necesario instalar paquetes adicionales

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S triskel -u 1001

# Configurar directorio de trabajo
WORKDIR /app

# Copiar aplicación construida desde builder
COPY --from=builder --chown=triskel:nodejs /app .

# Crear directorios necesarios
RUN mkdir -p data logs public/qr-codes coverage
RUN chown -R triskel:nodejs /app

# Cambiar a usuario no-root
USER triskel

# Variables de entorno de producción
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/platform.db

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Comando de producción
CMD ["node", "src/index.js"]
