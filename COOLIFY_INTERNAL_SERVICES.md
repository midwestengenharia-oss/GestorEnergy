# 🏗️ Configuração Coolify - Serviços Internos

## Arquitetura do Seu Projeto

```
Internet (Usuários)
        ↓
https://app.midwestengenharia.com.br (SSL pelo Coolify)
        ↓
    [Frontend Container - Nginx]
        ↓
    ┌───┴───┐
    ↓       ↓
/api/    /gateway/
    ↓       ↓
[Gestor] [Gateway]  ← Containers internos (sem SSL público)
8000     3000
```

**Apenas o Frontend é exposto publicamente!**
Gateway e Gestor são **100% internos** e se comunicam via rede Docker.

---

## ✅ Configuração no Coolify

### 1. **Frontend** (Único com Domínio Público)

**No Coolify:**
- **Nome do Serviço:** `frontend`
- **Domínio:** `app.midwestengenharia.com.br`
- **Porta Interna:** 80
- **SSL:** ✅ Gerar certificado Let's Encrypt
- **Network:** `energisa` (ou a rede padrão do projeto)

**Build Args (se usar Docker Compose):**
```yaml
services:
  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: /api
        VITE_GATEWAY_URL: /gateway
    environment:
      - VITE_API_URL=/api
      - VITE_GATEWAY_URL=/gateway
```

**Variáveis de Ambiente no Coolify:**
```env
# Frontend usa paths relativos (proxy interno)
VITE_API_URL=/api
VITE_GATEWAY_URL=/gateway
```

---

### 2. **Gateway** (Interno - SEM Domínio)

**No Coolify:**
- **Nome do Serviço:** `gateway`
- **Domínio:** ❌ DEIXE EM BRANCO (interno)
- **Porta Interna:** 3000
- **SSL:** ❌ NÃO precisa
- **Network:** `energisa` (mesma do frontend)

**Variáveis de Ambiente:**
```env
API_SECRET_KEY=399678eb047a098115cc4d825dcbe828b7bd0ccc56df0614139757ff93a718f0
CRM_SECRET=cnOOJJCg8VK3W11xOo6vhaHd4RNTP-ALT06#cs#I
ALLOWED_ORIGINS=https://app.midwestengenharia.com.br,http://frontend,http://frontend:80
```

---

### 3. **Gestor** (Interno - SEM Domínio)

**No Coolify:**
- **Nome do Serviço:** `gestor`
- **Domínio:** ❌ DEIXE EM BRANCO (interno)
- **Porta Interna:** 8000
- **SSL:** ❌ NÃO precisa
- **Network:** `energisa` (mesma do frontend)

**Variáveis de Ambiente:**
```env
GATEWAY_URL=http://gateway:3000
CRM_SECRET=cnOOJJCg8VK3W11xOo6vhaHd4RNTP-ALT06#cs#I
```

---

## 🔒 Como a Segurança Funciona

### Fluxo de Requisição:

1. **Usuário no navegador** faz requisição:
   ```
   POST https://app.midwestengenharia.com.br/gateway/public/simulacao/iniciar
   ```

2. **Coolify (Traefik)** recebe e termina SSL:
   ```
   HTTPS → HTTP (interno)
   ```

3. **Nginx do Frontend** recebe e faz proxy:
   ```
   /gateway/* → http://gateway:3000/*
   ```

4. **Gateway responde** ao Nginx:
   ```
   Gateway:3000 → Nginx
   ```

5. **Nginx retorna** ao Coolify:
   ```
   Nginx → Traefik
   ```

6. **Coolify retorna** ao usuário com SSL:
   ```
   Traefik → Usuário (HTTPS)
   ```

### ✅ Vantagens dessa Arquitetura:

- 🔒 Gateway e Gestor **nunca expostos** publicamente
- 🔒 Apenas 1 certificado SSL necessário (frontend)
- 🚀 Comunicação interna rápida (mesma rede Docker)
- 💰 Economia de recursos (menos containers expostos)
- 🛡️ Camada extra de segurança (Nginx como gateway de entrada)

---

## 🔧 Configuração DNS

**Você SÓ precisa de 1 registro DNS:**

```
Tipo A | Nome: app | Valor: <IP_DO_SERVIDOR_COOLIFY>
```

**Exemplo:**
```
app.midwestengenharia.com.br → 203.0.113.50
```

---

## 🚀 Deploy no Coolify

### Passo 1: Criar Rede Docker (se não existir)

No Coolify, crie uma **Network** chamada `energisa`:
1. Vá em **Networks**
2. **Create Network**
3. Nome: `energisa`

### Passo 2: Deploy dos Serviços

**Ordem recomendada:**
1. Deploy **gestor** primeiro
2. Deploy **gateway** segundo
3. Deploy **frontend** por último

### Passo 3: Conectar na Mesma Rede

Para cada serviço no Coolify:
1. Vá em **Network**
2. Selecione `energisa`
3. Salve

**Ou usando Docker Compose:**
```yaml
networks:
  energisa:
    external: true

services:
  frontend:
    networks:
      - energisa

  gateway:
    networks:
      - energisa

  gestor:
    networks:
      - energisa
```

### Passo 4: Configurar Domínio do Frontend

1. Vá no serviço **frontend**
2. Em **Domains**, adicione: `app.midwestengenharia.com.br`
3. Clique em **Generate Let's Encrypt Certificate**
4. Aguarde 1-2 minutos

---

## ✅ Verificação Pós-Deploy

### Teste 1: SSL do Frontend
```bash
curl -I https://app.midwestengenharia.com.br
```

Deve retornar:
```
HTTP/2 200
content-type: text/html
```

### Teste 2: Proxy para Gateway
```bash
curl https://app.midwestengenharia.com.br/gateway/public/simulacao/iniciar \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12345678900"}'
```

Deve funcionar (não retornar erro de CORS ou SSL)

### Teste 3: Proxy para Gestor
```bash
curl https://app.midwestengenharia.com.br/api/health
```

Deve retornar resposta do gestor.

---

## 🐛 Troubleshooting

### Erro: 502 Bad Gateway ao acessar /gateway/*

**Causa:** Containers não estão na mesma rede Docker

**Solução:**
1. Verifique se todos os serviços estão na rede `energisa`
2. Reinicie os containers:
   ```bash
   docker restart frontend gateway gestor
   ```

### Erro: ERR_CERT_AUTHORITY_INVALID

**Causa:** Certificado SSL do frontend não foi gerado

**Solução:**
1. No Coolify, vá em **Domains** do frontend
2. Verifique se certificado está "Valid"
3. Se não, delete e regenere certificado

### Erro: CORS ao acessar /gateway/*

**Causa:** ALLOWED_ORIGINS do gateway não inclui o domínio

**Solução:**
Adicione no gateway/.env:
```env
ALLOWED_ORIGINS=https://app.midwestengenharia.com.br,http://frontend,http://frontend:80
```

Reinicie o gateway.

### Erro: 504 Gateway Timeout

**Causa:** Nginx timeout muito baixo (Playwright demora)

**Solução:** Já corrigido no nginx.conf:
```nginx
proxy_read_timeout 600s;  # 10 minutos
```

---

## 📊 Monitoramento

### Ver Logs de Cada Serviço

**No Coolify:**
1. Clique no serviço
2. Vá em **Logs**
3. Ative "Follow logs"

**Via Docker (se tiver acesso SSH):**
```bash
docker logs -f <container_name>

# Exemplos:
docker logs -f frontend
docker logs -f gateway --tail 100
docker logs -f gestor
```

### Verificar Comunicação Interna

```bash
# SSH no servidor Coolify
docker exec -it frontend sh

# Dentro do container frontend
curl http://gateway:3000/public/simulacao/iniciar
curl http://gestor:8000/health
```

Ambos devem responder.

---

## 🎯 Checklist Final

- [ ] Rede Docker `energisa` criada
- [ ] Gestor rodando na porta 8000 (sem domínio)
- [ ] Gateway rodando na porta 3000 (sem domínio)
- [ ] Frontend rodando na porta 80 com domínio configurado
- [ ] Certificado SSL do frontend válido (Let's Encrypt)
- [ ] Todos os serviços na mesma rede Docker
- [ ] nginx.conf do frontend com proxies configurados
- [ ] ALLOWED_ORIGINS do gateway inclui o domínio do frontend
- [ ] Testado fluxo completo (login, simulação, etc)

---

## 🔐 Segurança Adicional

Como gateway e gestor são internos, adicione regras de firewall no servidor:

```bash
# Bloquear acesso externo às portas 3000 e 8000
sudo ufw deny 3000
sudo ufw deny 8000

# Apenas portas 80 e 443 devem estar abertas
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Assim, mesmo que alguém descubra o IP do servidor, não consegue acessar gateway/gestor diretamente!

---

**Última atualização:** 2025-11-28
