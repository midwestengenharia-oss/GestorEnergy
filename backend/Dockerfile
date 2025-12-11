# Usa imagem Python oficial
FROM python:3.11-slim

# Define diretorio de trabalho
WORKDIR /app

# Instala dependencias do sistema para PDF, OCR e Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    libpoppler-cpp-dev \
    # Dependências do Playwright/Chromium
    wget \
    gnupg \
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
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # Xvfb para rodar navegador em modo headed sem display físico
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements primeiro (para cache de layers)
COPY requirements.txt .

# Instala dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Instala navegadores do Playwright (Chromium)
RUN playwright install chromium

# Copia o codigo para /app/backend (mantem estrutura de imports)
COPY . ./backend/

# Variaveis de ambiente
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app
ENV DISPLAY=:99

# Expoe a porta 8000
EXPOSE 8000

# Comando de inicializacao com Xvfb
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset & uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
