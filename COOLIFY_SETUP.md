# 🚀 Configuração Completa no Coolify

## 📋 Configuração de Domínios e SSL

Você tem 3 serviços para configurar:

### 1. **Frontend** (React)
- **Domínio:** `app.midwestengenharia.com.br`
- **Porta:** 80
- **Dockerfile:** `frontend/Dockerfile`

**No Coolify:**
1. Vá em **Domains**
2. Adicione: `app.midwestengenharia.com.br`
3. Clique em **Generate Let's Encrypt Certificate**
4. Aguarde certificado ser gerado

**Variáveis de Ambiente:**
```env
VITE_API_URL=https://api.midwestengenharia.com.br
VITE_GATEWAY_URL=https://gateway.midwestengenharia.com.br
```

---

### 2. **Gateway** (FastAPI + Playwright)
- **Domínio:** `gateway.midwestengenharia.com.br`
- **Porta:** 3000
- **Dockerfile:** `gateway/Dockerfile`

**No Coolify:**
1. Vá em **Domains**
2. Adicione: `gateway.midwestengenharia.com.br`
3. Clique em **Generate Let's Encrypt Certificate**
4. Aguarde certificado ser gerado

**Variáveis de Ambiente:**
```env
API_SECRET_KEY=399678eb047a098115cc4d825dcbe828b7bd0ccc56df0614139757ff93a718f0
CRM_SECRET=cnOOJJCg8VK3W11xOo6vhaHd4RNTP-ALT06#cs#I
CLIENT_FIN_PASS=senha_do_financeiro
ALLOWED_ORIGINS=https://app.midwestengenharia.com.br
```

---

### 3. **Gestor** (FastAPI Backend)
- **Domínio:** `api.midwestengenharia.com.br`
- **Porta:** 8000
- **Dockerfile:** `gestor/Dockerfile`

**No Coolify:**
1. Vá em **Domains**
2. Adicione: `api.midwestengenharia.com.br`
3. Clique em **Generate Let's Encrypt Certificate**
4. Aguarde certificado ser gerado

**Variáveis de Ambiente:**
```env
GATEWAY_URL=https://gateway.midwestengenharia.com.br
CRM_SECRET=cnOOJJCg8VK3W11xOo6vhaHd4RNTP-ALT06#cs#I
```

---

## 🌐 Configuração de DNS

No seu provedor de DNS (Cloudflare, GoDaddy, etc), adicione estes registros:

```
Tipo  | Nome     | Valor
------|----------|------------------
A     | app      | <IP_DO_SERVIDOR>
A     | gateway  | <IP_DO_SERVIDOR>
A     | api      | <IP_DO_SERVIDOR>
```

**Exemplo com IP 203.0.113.50:**
```
A     app.midwestengenharia.com.br      → 203.0.113.50
A     gateway.midwestengenharia.com.br  → 203.0.113.50
A     api.midwestengenharia.com.br      → 203.0.113.50
```

---

## ✅ Verificação Pós-Deploy

### Teste 1: Certificados SSL

Acesse cada domínio no navegador e verifique o cadeado verde:
- ✅ https://app.midwestengenharia.com.br
- ✅ https://gateway.midwestengenharia.com.br/public/simulacao/iniciar
- ✅ https://api.midwestengenharia.com.br/docs

### Teste 2: CORS

Abra o frontend e abra o DevTools (F12):
1. Vá em **Console**
2. Tente fazer login ou iniciar simulação
3. **NÃO** deve aparecer erro de CORS

Se aparecer erro de CORS:
```
Access to fetch at 'https://gateway...' has been blocked by CORS policy
```

**Solução:** Verifique se `ALLOWED_ORIGINS` está correto no gateway.

### Teste 3: Fluxo Completo

1. Acesse https://app.midwestengenharia.com.br
2. Faça login
3. Cadastre uma empresa
4. Conecte com a Energisa
5. Selecione telefone e valide SMS
6. Verifique se sincroniza UCs

---

## 🔧 Troubleshooting

### Erro: ERR_CERT_AUTHORITY_INVALID

**Causa:** Certificado SSL não gerado ou inválido

**Solução:**
1. No Coolify, vá em Domains do serviço
2. Delete o certificado existente
3. Clique em **Generate Let's Encrypt Certificate**
4. Aguarde 1-2 minutos
5. Recarregue a página (Ctrl+Shift+R)

### Erro: DNS_PROBE_FINISHED_NXDOMAIN

**Causa:** DNS não está configurado corretamente

**Solução:**
1. Verifique se os registros A foram criados no provedor de DNS
2. Aguarde propagação (pode levar até 24h, mas geralmente é rápido)
3. Teste com: `nslookup app.midwestengenharia.com.br`

### Erro: CORS

**Causa:** `ALLOWED_ORIGINS` não inclui o domínio do frontend

**Solução:**
1. No Coolify, vá no serviço **gateway**
2. Vá em **Environment Variables**
3. Adicione ou edite:
   ```
   ALLOWED_ORIGINS=https://app.midwestengenharia.com.br
   ```
4. Salve e reinicie o serviço

### Erro: 502 Bad Gateway

**Causa:** Serviço está offline ou não está respondendo

**Solução:**
1. No Coolify, verifique se todos os serviços estão **Running**
2. Verifique os logs de cada serviço
3. Reinicie o serviço problemático

---

## 📊 Arquitetura Final

```
Usuário
   ↓
https://app.midwestengenharia.com.br (Frontend React)
   ↓
   ├─→ https://api.midwestengenharia.com.br (Gestor Backend)
   │   └─→ SQLite Database
   │
   └─→ https://gateway.midwestengenharia.com.br (Gateway + Playwright)
       └─→ Energisa Website (scraping)
```

---

## 🔒 Checklist de Segurança

- [ ] Certificados SSL válidos em todos os domínios
- [ ] HTTPS forçado (sem HTTP)
- [ ] `ALLOWED_ORIGINS` configurado no gateway
- [ ] Variáveis de ambiente sensíveis não expostas
- [ ] Firewall configurado (portas 80, 443 abertas)
- [ ] Backup do banco de dados configurado
- [ ] Monitoramento de logs ativo

---

## 📞 Suporte

Se encontrar problemas:

1. **Verifique logs no Coolify:**
   - Clique no serviço
   - Vá em **Logs**
   - Procure por erros

2. **Teste localmente primeiro:**
   ```bash
   docker-compose up --build
   ```

3. **Verifique conectividade:**
   ```bash
   curl -I https://gateway.midwestengenharia.com.br/public/simulacao/iniciar
   ```

---

**Última atualização:** 2025-11-28
