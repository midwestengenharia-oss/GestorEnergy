# Usa a imagem oficial do Playwright
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

# Define diretório de trabalho
WORKDIR /app

# 1. Instala o Xvfb (Monitor Virtual)
RUN apt-get update && apt-get install -y xvfb

# Copia e instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instala o navegador
RUN playwright install chromium

# Copia o código
COPY . .

# Cria pasta de sessões
RUN mkdir -p sessions

# MUDANÇA 1: Expõe a porta 3000
EXPOSE 3000

# MUDANÇA 2: Comando de inicialização na porta 3000
CMD xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" uvicorn main:app --host 0.0.0.0 --port 3000