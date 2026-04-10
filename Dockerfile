FROM node:20-alpine3.19

# Build deps needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++ su-exec

WORKDIR /app

# Install dependencies first (layer cache — only rebuilds if package.json changes)
COPY package*.json ./
RUN npm ci

# Copy app source
COPY server/ ./server/
COPY public/ ./public/
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# Data volume mount point (db + uploads live here, outside the image)
RUN mkdir -p /data/uploads

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
