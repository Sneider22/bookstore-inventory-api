# ──────────────────────────────────────────────
# Frontend – React + Vite  →  nginx (SPA)
# Multi-stage build
# ──────────────────────────────────────────────

# ── Etapa 1: build ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias (usa el lockfile exacto)
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar fuentes y construir
COPY . .

# VITE_API_URL se inyecta en build-time.
# docker-compose lo pasa como ARG → ENV → Vite lo incrusta en el bundle.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Etapa 2: servidor estático (nginx) ────────
FROM nginx:alpine

# Copiar el bundle generado por Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración nginx con SPA fallback (try_files → index.html)
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Compresión gzip para assets\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Cache largo para assets con hash en el nombre\n\
    location /assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
