---
name: deploy
description: |
  Deploy do sistema GestorEnergy (frontend e/ou backend). Use quando o usuario pedir para fazer deploy, publicar, subir para producao, ou atualizar o sistema em producao.
---

# Deploy GestorEnergy

Deploy do frontend React e backend FastAPI.

## Pre-requisitos

Verificar antes do deploy:
```bash
# Frontend - verificar build
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/frontend" && npm run build

# Backend - verificar sintaxe
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/backend" && python -m py_compile main.py
```

## Deploy Frontend

O frontend usa React + Vite. Build gera pasta `dist/`.

```bash
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/frontend"
npm install
npm run build
```

Arquivos de build em: `frontend/dist/`

## Deploy Backend

O backend usa FastAPI + Uvicorn.

```bash
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/backend"
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docker Compose

Para deploy completo com Docker:

```bash
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy"
docker-compose up -d --build
```

## Checklist Pre-Deploy

1. [ ] Todos os testes passando
2. [ ] Build do frontend sem erros
3. [ ] Variaveis de ambiente configuradas
4. [ ] Migrations do banco aplicadas
5. [ ] Commit das mudancas feito

## Variaveis de Ambiente

Frontend (`.env`):
- `VITE_API_URL` - URL do backend
- `VITE_SUPABASE_URL` - URL do Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave anonima Supabase

Backend (`.env`):
- `SUPABASE_URL` - URL do Supabase
- `SUPABASE_SERVICE_KEY` - Chave de servico
- `OPENAI_API_KEY` - Chave OpenAI
- `ENERGISA_*` - Credenciais Energisa
- `PIX_SANTANDER_*` - Credenciais PIX
