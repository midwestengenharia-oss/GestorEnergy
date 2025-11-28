# 🔐 Corrigir Erro de Certificado SSL no Coolify

## Erro Atual:
```
POST https://app.midwestengenharia.com.br/gateway/public/simulacao/validar-sms
net::ERR_CERT_AUTHORITY_INVALID
```

## Causa:
O certificado SSL do domínio não é válido/confiável.

---

## ✅ Solução Passo-a-Passo

### Passo 1: Verificar Certificado no Coolify

1. Acesse o **Coolify Dashboard**
2. Vá no projeto/aplicação **frontend** ou **gateway**
3. Clique em **Domains & SSL**
4. Verifique o status do certificado SSL

**O que procurar:**
- ❌ "Certificate: Invalid" ou "Not Trusted"
- ❌ "Certificate: Self-signed"
- ❌ "Certificate: Expired"
- ✅ "Certificate: Valid (Let's Encrypt)"

---

### Passo 2: Regenerar Certificado Let's Encrypt

Se o certificado estiver inválido:

1. No Coolify, vá em **Domains & SSL**
2. Clique em **Delete Certificate** (se existir)
3. Clique em **Generate Let's Encrypt Certificate**
4. Aguarde 1-2 minutos
5. Verifique se aparece "Certificate: Valid"

**IMPORTANTE:** Certifique-se de que:
- O DNS do domínio `app.midwestengenharia.com.br` aponta para o IP do servidor Coolify
- As portas 80 e 443 estão abertas no firewall
- O Coolify consegue acessar o domínio externamente

---

### Passo 3: Verificar DNS

Abra o terminal e verifique se o DNS está correto:

```bash
# Verificar se o domínio aponta para o servidor correto
nslookup app.midwestengenharia.com.br

# Ou use dig
dig app.midwestengenharia.com.br
```

**Esperado:**
```
Name:   app.midwestengenharia.com.br
Address: <IP_DO_SERVIDOR_COOLIFY>
```

Se o IP estiver errado, corrija no seu provedor de DNS (Cloudflare, GoDaddy, etc).

---

### Passo 4: Testar Certificado

Após regenerar, teste em:
https://www.ssllabs.com/ssltest/analyze.html?d=app.midwestengenharia.com.br

**Esperado:** Grade A ou B

---

### Passo 5: Limpar Cache do Navegador

Após corrigir o certificado:

1. Abra o site no Chrome
2. Pressione **F12** (DevTools)
3. Clique com botão direito no ícone de **Reload**
4. Escolha **Empty Cache and Hard Reload**
5. Ou use Ctrl+Shift+R

---

## 🚨 Problema Comum: Domínio com Reverse Proxy

Se você está usando:
```
Frontend: https://app.midwestengenharia.com.br
Gateway: https://app.midwestengenharia.com.br/gateway/*
```

Você precisa configurar um **reverse proxy no Coolify**.

### Como configurar:

1. No Coolify, crie **2 serviços separados**:
   - `frontend` na porta 80
   - `gateway` na porta 3000

2. Configure **Custom Nginx** no Coolify:

```nginx
# No serviço frontend, adicione Custom Nginx Config:
location /gateway/ {
    proxy_pass http://gateway:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

3. Ou melhor ainda: use **subdomínios separados**:
   - Frontend: `https://app.midwestengenharia.com.br`
   - Gateway: `https://gateway.midwestengenharia.com.br`

Cada um com seu próprio certificado SSL.

---

## 📋 Checklist de Verificação

- [ ] DNS aponta para IP correto do servidor
- [ ] Portas 80 e 443 abertas no firewall
- [ ] Certificado Let's Encrypt gerado no Coolify
- [ ] Certificado aparece como "Valid" no Coolify
- [ ] Teste no SSL Labs retorna Grade A/B
- [ ] Cache do navegador limpo
- [ ] Reverse proxy configurado (se aplicável)
- [ ] Testado em navegador anônimo/privado

---

## 🆘 Se Nada Funcionar

### Opção 1: Usar Cloudflare (Recomendado)

1. Adicione o domínio ao **Cloudflare**
2. Configure DNS no Cloudflare
3. Ative **SSL/TLS: Full** (não "Full Strict" por enquanto)
4. Deixe Cloudflare gerar o certificado

**Vantagens:**
- Certificado gerenciado automaticamente
- CDN grátis
- Proteção DDoS
- WAF gratuito

### Opção 2: Certificado Manual

Se Let's Encrypt falhar, gere manualmente:

```bash
# No servidor Coolify
certbot certonly --standalone -d app.midwestengenharia.com.br
```

Depois, adicione o certificado manualmente no Coolify.

---

## 🔍 Debug Avançado

Se o problema persistir, colete informações:

```bash
# No servidor Coolify
docker ps | grep frontend
docker ps | grep gateway

# Verificar logs do Traefik (proxy do Coolify)
docker logs <traefik_container_id>

# Testar se o gateway responde localmente
curl -k https://localhost:3000/public/simulacao/iniciar
```

---

## 📞 Próximos Passos

1. Verifique e corrija o certificado SSL
2. Se necessário, mova gateway para subdomínio separado
3. Atualize a variável de ambiente no frontend:

```env
# frontend/.env
VITE_API_URL=https://gateway.midwestengenharia.com.br
```

4. Atualize ALLOWED_ORIGINS no gateway:

```env
# gateway/.env
ALLOWED_ORIGINS=https://app.midwestengenharia.com.br
```

---

**Última atualização:** 2025-11-28
