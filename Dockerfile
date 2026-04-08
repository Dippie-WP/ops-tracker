FROM node:20-alpine

# Build deps needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer cache — only rebuilds if package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY server/ ./server/
COPY public/ ./public/

# Data volume mount point (db + uploads live here, outside the image)
RUN mkdir -p /data/uploads

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app /data
USER appuser

CMD ["node", "server/index.js"]
