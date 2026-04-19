# Dockerfile para TriskelGate Payment Platform
FROM node:18-alpine AS base

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    sqlite \
    curl \
    dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S triskel -u 1001

# Configurar directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY .npmrc* ./

# Etapa de desarrollo
FROM base AS development

# Instalar todas las dependencias (incluyendo dev)
RUN npm install

# Copiar código fuente
COPY . .

# Cambiar permisos
RUN chown -R triskel:nodejs /app
USER triskel

# Exponer puerto
EXPOSE 3001

# Comando de desarrollo
CMD ["dumb-init", "npm", "run", "dev"]

# Etapa de construcción
FROM base AS builder

# Instalar dependencias de producción únicamente
RUN npm install --production=false && npm cache clean --force

# Copiar código fuente
COPY . .

# Construir aplicación (si es necesario)
RUN npm run build

# Limpiar archivos innecesarios
RUN rm -rf tests/ .git/ .github/ docs/ *.md

# Etapa de producción
FROM node:18-alpine AS production

# Instalar dumb-init para manejo de procesos
RUN apk add --no-cache dumb-init sqlite curl

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
    CMD curl -f http://localhost:3001/health || exit 1

# Comando de producción
CMD ["dumb-init", "node", "src/index.js"]
