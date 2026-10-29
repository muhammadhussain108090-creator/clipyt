# Multi-stage production build for ClipForge AI
# Stage 1: Build Frontend Assets
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Runtime with FFmpeg & Python
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies: FFmpeg with libass and fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libass-dev \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for hybrid runtime
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files and built frontend
COPY . .
COPY --from=frontend-builder /app/dist ./dist

# Create storage directories
RUN mkdir -p storage/uploads storage/jobs storage/samples

# Environment configuration
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "--loader", "tsx", "server.ts"]
