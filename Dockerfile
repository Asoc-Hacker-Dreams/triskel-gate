FROM node:20-alpine

RUN apk add --no-cache curl dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S -u 1001 -G nodejs triskell

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline

# Use --chown on COPY to avoid a separate chown layer that duplicates node_modules
COPY --chown=triskell:nodejs src ./src
COPY --chown=triskell:nodejs public ./public

# Only chown the small runtime-writable dirs (not node_modules)
RUN mkdir -p logs public/qr-codes \
    && chown triskell:nodejs logs public/qr-codes

USER triskell

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["dumb-init", "node", "src/index.js"]
