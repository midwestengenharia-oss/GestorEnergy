FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Porta do Gestor (8000)
EXPOSE 8000

CMD ["uvicorn", "app_gestor:app", "--host", "0.0.0.0", "--port", "8000"]