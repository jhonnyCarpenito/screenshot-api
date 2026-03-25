# Imagen base con Node 20 (Debian Bookworm para dependencias de Chromium)
FROM node:20-bookworm-slim

WORKDIR /app

# Instalar dependencias del sistema para Chromium (Playwright)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias
COPY package.json package-lock.json* ./

# Instalar dependencias de producción (npm ci si hay lock, sino npm install)
RUN npm install --omit=dev

# Instalar Chromium para Playwright (sin deps adicionales, ya las instalamos)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
RUN npx playwright install chromium

# Copiar código
COPY . .

# CapRover inyecta PORT; por defecto 80
ENV PORT=80
# Define REDIS_URL en App Configs de CapRover para habilitar caché compartida.
ENV REDIS_URL=""
EXPOSE 80

# Healthcheck para CapRover
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "(async()=>{try{const r=await fetch('http://localhost:'+(process.env.PORT||80)+'/health');process.exit(r.ok?0:1)}catch(e){process.exit(1)}})()"

CMD ["node", "src/index.js"]
