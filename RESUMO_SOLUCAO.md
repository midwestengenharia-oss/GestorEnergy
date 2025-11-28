# ✅ Solução do Erro ERR_CERT_AUTHORITY_INVALID

## 🎯 Problema Original

```
POST https://app.midwestengenharia.com.br/gateway/public/simulacao/validar-sms
net::ERR_CERT_AUTHORITY_INVALID
```

---

## 💡 Causa Raiz

Você tem a arquitetura correta (gateway e gestor internos), mas faltava:
1. ✅ Headers de proxy corretos no nginx.conf
2. ✅ ALLOWED_ORIGINS do gateway incluindo o domínio do frontend
3. ✅ Timeout adequado para Playwright (600s)

---

## 🔧 Mudanças Realizadas

### 1. **Atualizado `frontend/nginx.conf`**

Adicionados headers essenciais para o proxy funcionar com SSL:
- `X-Forwarded-For` - IP real do cliente
- `X-Forwarded-Proto` - Protocolo (https)
- `X-Forwarded-Host` - Host original
- Timeouts aumentados (600s para gateway)

### 2. **Atualizado `gateway/.env`**

```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80,https://app.midwestengenharia.com.br,http://frontend,http://frontend:80
```

Agora aceita requisições vindas do próprio frontend (via proxy interno).

### 3. **Criados Guias de Configuração**

- `COOLIFY_INTERNAL_SERVICES.md` - Setup completo
- `FIX_SSL_COOLIFY.md` - Troubleshooting SSL
- `SECURITY.md` - Documentação de segurança
- `DEPLOYMENT_SECURITY.md` - Checklist de deploy

---

## 🚀 Próximos Passos no Coolify

### Passo 1: Regenerar Certificado SSL do Frontend

1. Acesse o **Coolify**
2. Vá no serviço **frontend**
3. Clique em **Domains**
4. Se o certificado estiver "Invalid":
   - Clique em **Delete Certificate**
   - Clique em **Generate Let's Encrypt Certificate**
5. Aguarde 1-2 minutos

### Passo 2: Rebuild do Frontend

1. No Coolify, vá no serviço **frontend**
2. Clique em **Redeploy** ou **Rebuild**
3. Aguarde o build completar
4. Verifique logs

### Passo 3: Verificar Conectividade Interna

Certifique-se de que todos os serviços estão na **mesma rede Docker**:

1. No Coolify, crie/verifique a rede `energisa`
2. Conecte frontend, gateway e gestor nessa rede
3. Reinicie os serviços se necessário

### Passo 4: Testar

1. Acesse `https://app.midwestengenharia.com.br`
2. Abra **DevTools (F12) → Console**
3. Tente fazer login ou iniciar simulação
4. **NÃO** deve aparecer erro SSL ou CORS

---

## 🏗️ Arquitetura Final

```
Internet (Usuários)
        ↓
https://app.midwestengenharia.com.br
        ↓ [Coolify Traefik - SSL Termination]
        ↓
    Frontend Container (Nginx:80)
        ↓
    ┌───┴───────┐
    ↓           ↓
/api/        /gateway/
    ↓           ↓
Gestor:8000  Gateway:3000
    ↑           ↑
    └───────────┘
  (Rede Docker interna)
```

**Apenas 1 certificado SSL necessário!** (frontend)

---

## ✅ Checklist de Configuração

### No Coolify:

- [ ] Certificado SSL do frontend válido
- [ ] Gateway **SEM** domínio (interno)
- [ ] Gestor **SEM** domínio (interno)
- [ ] Todos na mesma rede Docker (`energisa`)
- [ ] Frontend rebuilded com nginx.conf atualizado
- [ ] ALLOWED_ORIGINS do gateway atualizado

### No DNS:

- [ ] Apenas 1 registro: `app.midwestengenharia.com.br → IP_SERVIDOR`

### Variáveis de Ambiente:

**Frontend:**
```env
VITE_API_URL=/api
VITE_GATEWAY_URL=/gateway
```

**Gateway:**
```env
ALLOWED_ORIGINS=https://app.midwestengenharia.com.br,http://frontend,http://frontend:80
```

**Gestor:**
```env
GATEWAY_URL=http://gateway:3000
```

---

## 🐛 Se Ainda Apresentar Erro

### Erro: 502 Bad Gateway

**Solução:**
```bash
# SSH no servidor Coolify
docker ps | grep -E "frontend|gateway|gestor"

# Verificar se estão na mesma rede
docker inspect frontend | grep NetworkMode
docker inspect gateway | grep NetworkMode
docker inspect gestor | grep NetworkMode

# Devem retornar a mesma rede
```

### Erro: CORS

**Solução:**
```bash
# Verifique logs do gateway
docker logs gateway --tail 50

# Procure por:
# "Origin ... not allowed"
```

Se aparecer, adicione a origem em `ALLOWED_ORIGINS`.

### Erro: 504 Timeout

**Solução:**
O nginx.conf já está configurado com timeout de 600s.
Se ainda der timeout, aumente ainda mais:

```nginx
proxy_read_timeout 900s;  # 15 minutos
```

---

## 📞 Teste Rápido

Após fazer o deploy, teste:

```bash
# Teste SSL
curl -I https://app.midwestengenharia.com.br

# Teste proxy gateway
curl https://app.midwestengenharia.com.br/gateway/public/simulacao/iniciar \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"cpf":"00000000000"}'

# Deve retornar JSON (não erro SSL/CORS)
```

---

## 🎉 Resultado Esperado

Depois dessas mudanças:

✅ Frontend acessível via HTTPS com certificado válido
✅ Gateway e Gestor internos (sem certificado próprio)
✅ Proxy funcionando (frontend → gateway/gestor)
✅ Sem erros de SSL
✅ Sem erros de CORS
✅ Sistema 100% funcional

---

**Última atualização:** 2025-11-28
**Status:** Pronto para deploy no Coolify
