FROM node:18-alpine AS builder

ARG APP_VERSION=0.0.0

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace root and package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy application files
COPY . .

# Build shared package and backend
RUN npx tsc --project packages/shared/tsconfig.json && \
    npx tsc --project backend/tsconfig.json

# --- Production stage ---
FROM node:18-alpine

ARG APP_VERSION=0.0.0
ENV APP_VERSION=${APP_VERSION}

WORKDIR /app

# Install dependencies for native modules and curl for health checks
RUN apk add --no-cache python3 make g++ curl

# Copy workspace root and package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (tsx needed at runtime for mixed JS/TS)
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy runtime files (configs, non-TS source for JS routes still in migration)
COPY backend/src ./backend/src
COPY packages/shared/src ./packages/shared/src

# Create directories for uploads and APKs
RUN mkdir -p uploads apks && \
    chmod 755 uploads apks

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Use tsx to run (handles mixed JS/TS during migration)
CMD ["npx", "tsx", "backend/src/server.js"]
