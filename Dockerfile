# Multi-stage Dockerfile for AICTE FDR Setu
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend assets
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/services ./src/services
COPY --from=builder /app/src/types.ts ./src/types.ts
COPY --from=builder /app/src/data ./src/data
COPY tsconfig.json ./

# Expose standard port 3000
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
