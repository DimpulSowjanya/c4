# ==========================================
# STAGE 1: Build Next.js Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Build Express Backend
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ==========================================
# STAGE 3: Run Production Server
# ==========================================
FROM node:20-alpine
WORKDIR /app

# Copy built backend modules and source
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --only=production

COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Set default ports and runtime environment
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "backend/dist/server.js"]
