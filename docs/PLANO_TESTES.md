# Plano de Testes - Backend Plataforma GD

## Visão Geral

Este documento descreve o plano de testes para validar todos os módulos implementados do backend.

**URL Base**: `http://localhost:8000`
**Documentação Swagger**: `http://localhost:8000/docs`

---

## Pré-requisitos

### 1. Configuração do Ambiente

```bash
# Criar arquivo .env no diretório backend/
cp .env.example .env

# Editar .env com as credenciais do Supabase:
SUPABASE_URL=https://supabase.midwestengenharia.com.br
SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
JWT_SECRET_KEY=sua_chave_jwt_do_supabase
```

### 2. Instalar Dependências

```bash
cd backend
pip install -r requirements.txt
```

### 3. Iniciar o Servidor

```bash
# Opção 1: Diretamente
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Opção 2: Via Python
python -m backend.main
```

### 4. Verificar Health Check

```bash
curl http://localhost:8000/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "supabase": "connected"
  }
}
```

---

## 1. Testes do Módulo Auth (`/api/auth`)

### 1.1 Signup - Cadastrar Usuário

```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com",
    "password": "Senha123!",
    "nome_completo": "Usuário de Teste",
    "cpf": "529.982.247-25",
    "telefone": "(65) 99999-9999"
  }'
```

**Resposta esperada (201)**:
```json
{
  "message": "Usuário cadastrado com sucesso",
  "user": {
    "id": 1,
    "auth_id": "uuid...",
    "nome_completo": "Usuário de Teste",
    "email": "teste@exemplo.com",
    "perfis": ["usuario"]
  },
  "tokens": {
    "access_token": "eyJ...",
    "refresh_token": "...",
    "token_type": "bearer",
    "expires_in": 3600
  }
}
```

### 1.2 Signin - Login

```bash
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com",
    "password": "Senha123!"
  }'
```

**Resposta esperada (200)**:
```json
{
  "message": "Login realizado com sucesso",
  "user": {...},
  "tokens": {...},
  "perfis_disponiveis": ["usuario"]
}
```

### 1.3 Me - Dados do Usuário Logado

```bash
# Substitua TOKEN pelo access_token recebido no login
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### 1.4 Refresh Token

```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "seu_refresh_token"
  }'
```

### 1.5 Atualizar Perfil

```bash
curl -X PUT http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_completo": "Novo Nome",
    "telefone": "(65) 98888-8888"
  }'
```

### 1.6 Trocar Senha

```bash
curl -X POST http://localhost:8000/api/auth/me/senha \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "Senha123!",
    "new_password": "NovaSenha123!"
  }'
```

### 1.7 Listar Perfis

```bash
curl -X GET http://localhost:8000/api/auth/perfis \
  -H "Authorization: Bearer TOKEN"
```

### 1.8 Logout

```bash
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer TOKEN"
```

---

## 2. Testes do Módulo Energisa (`/api/energisa`)

### 2.1 Iniciar Simulação (Landing Page)

```bash
curl -X POST http://localhost:8000/api/energisa/simulacao/iniciar \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "529.982.247-25"
  }'
```

**Resposta esperada**:
```json
{
  "session_id": "uuid...",
  "status": "sms_required",
  "message": "SMS enviado para o celular cadastrado"
}
```

### 2.2 Validar SMS

```bash
curl -X POST http://localhost:8000/api/energisa/simulacao/validar-sms \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid...",
    "codigo_sms": "123456"
  }'
```

### 2.3 Listar UCs da Simulação

```bash
curl -X GET "http://localhost:8000/api/energisa/simulacao/ucs/SESSION_ID"
```

### 2.4 Obter Faturas da Simulação

```bash
curl -X GET "http://localhost:8000/api/energisa/simulacao/faturas/SESSION_ID/6-4242904-3"
```

### 2.5 Login Autenticado (3 etapas)

```bash
# Etapa 1: Iniciar
curl -X POST http://localhost:8000/api/energisa/login/start \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "529.982.247-25"}'

# Etapa 2: Selecionar opção de verificação
curl -X POST http://localhost:8000/api/energisa/login/select-option \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid...",
    "option_index": 0
  }'

# Etapa 3: Finalizar com código
curl -X POST http://localhost:8000/api/energisa/login/finish \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid...",
    "verification_code": "123456"
  }'
```

### 2.6 Listar UCs (Autenticado)

```bash
curl -X POST http://localhost:8000/api/energisa/ucs \
  -H "Authorization: Bearer TOKEN"
```

### 2.7 Informações da UC

```bash
curl -X POST http://localhost:8000/api/energisa/ucs/info \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_uc": "6/4242904-3"
  }'
```

### 2.8 Listar Faturas

```bash
curl -X POST http://localhost:8000/api/energisa/faturas/listar \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_uc": "6/4242904-3"
  }'
```

### 2.9 Baixar PDF da Fatura

```bash
curl -X POST http://localhost:8000/api/energisa/faturas/pdf \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_uc": "6/4242904-3",
    "numero_fatura": 123456789
  }'
```

### 2.10 Informações GD

```bash
curl -X POST http://localhost:8000/api/energisa/gd/info \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_uc": "6/4242904-3"
  }'
```

### 2.11 Detalhes GD (Histórico)

```bash
curl -X POST http://localhost:8000/api/energisa/gd/details \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_uc": "6/4242904-3"
  }'
```

---

## 3. Testes do Módulo Usuarios (`/api/usuarios`)

> **Nota**: Requer perfil `superadmin` ou `gestor`

### 3.1 Listar Usuários

```bash
curl -X GET "http://localhost:8000/api/usuarios?page=1&per_page=10" \
  -H "Authorization: Bearer TOKEN"
```

### 3.2 Listar com Filtros

```bash
curl -X GET "http://localhost:8000/api/usuarios?nome=teste&ativo=true&perfil=usuario" \
  -H "Authorization: Bearer TOKEN"
```

### 3.3 Criar Usuário (Admin)

```bash
curl -X POST http://localhost:8000/api/usuarios \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_completo": "Novo Usuário",
    "email": "novo@exemplo.com",
    "cpf": "123.456.789-09",
    "telefone": "(65) 99999-0000",
    "is_superadmin": false,
    "perfis": ["usuario"]
  }'
```

### 3.4 Buscar Usuário por ID

```bash
curl -X GET http://localhost:8000/api/usuarios/UUID_DO_USUARIO \
  -H "Authorization: Bearer TOKEN"
```

### 3.5 Buscar por Perfil

```bash
curl -X GET "http://localhost:8000/api/usuarios/perfil/gestor?apenas_ativos=true" \
  -H "Authorization: Bearer TOKEN"
```

### 3.6 Atualizar Usuário

```bash
curl -X PUT http://localhost:8000/api/usuarios/UUID_DO_USUARIO \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_completo": "Nome Atualizado",
    "ativo": true
  }'
```

### 3.7 Desativar Usuário

```bash
curl -X POST http://localhost:8000/api/usuarios/UUID_DO_USUARIO/desativar \
  -H "Authorization: Bearer TOKEN"
```

### 3.8 Ativar Usuário

```bash
curl -X POST http://localhost:8000/api/usuarios/UUID_DO_USUARIO/ativar \
  -H "Authorization: Bearer TOKEN"
```

### 3.9 Listar Perfis do Usuário

```bash
curl -X GET http://localhost:8000/api/usuarios/UUID_DO_USUARIO/perfis \
  -H "Authorization: Bearer TOKEN"
```

### 3.10 Atribuir Perfil

```bash
curl -X POST http://localhost:8000/api/usuarios/UUID_DO_USUARIO/perfis \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "perfil": "gestor",
    "dados_perfil": {}
  }'
```

### 3.11 Remover Perfil

```bash
curl -X DELETE http://localhost:8000/api/usuarios/UUID_DO_USUARIO/perfis/gestor \
  -H "Authorization: Bearer TOKEN"
```

---

## 4. Testes do Módulo UCs (`/api/ucs`)

### 4.1 Listar UCs

```bash
curl -X GET "http://localhost:8000/api/ucs?page=1&per_page=20" \
  -H "Authorization: Bearer TOKEN"
```

### 4.2 Listar Minhas UCs

```bash
curl -X GET http://localhost:8000/api/ucs/minhas \
  -H "Authorization: Bearer TOKEN"
```

### 4.3 Listar UCs Geradoras

```bash
curl -X GET http://localhost:8000/api/ucs/geradoras \
  -H "Authorization: Bearer TOKEN"
```

### 4.4 Vincular UC

```bash
curl -X POST http://localhost:8000/api/ucs/vincular \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cod_empresa": 6,
    "cdc": 4242904,
    "digito_verificador": 3,
    "usuario_titular": true
  }'
```

### 4.5 Vincular UC por Formato

```bash
curl -X POST http://localhost:8000/api/ucs/vincular-formato \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "uc_formatada": "6/4242904-3",
    "usuario_titular": false
  }'
```

### 4.6 Buscar UC por ID

```bash
curl -X GET http://localhost:8000/api/ucs/1 \
  -H "Authorization: Bearer TOKEN"
```

### 4.7 Atualizar UC

```bash
curl -X PUT http://localhost:8000/api/ucs/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_titular": "Nome do Titular",
    "cidade": "Cuiabá",
    "uf": "MT"
  }'
```

### 4.8 Configurar GD

```bash
curl -X POST http://localhost:8000/api/ucs/1/gd \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_geradora": true,
    "geradora_id": null,
    "percentual_rateio": null
  }'
```

### 4.9 Obter Info GD

```bash
curl -X GET http://localhost:8000/api/ucs/1/gd \
  -H "Authorization: Bearer TOKEN"
```

### 4.10 Listar Beneficiárias

```bash
curl -X GET http://localhost:8000/api/ucs/1/beneficiarias \
  -H "Authorization: Bearer TOKEN"
```

### 4.11 Desvincular UC

```bash
curl -X DELETE http://localhost:8000/api/ucs/1 \
  -H "Authorization: Bearer TOKEN"
```

---

## 5. Testes do Módulo Usinas (`/api/usinas`)

### 5.1 Listar Usinas

```bash
curl -X GET "http://localhost:8000/api/usinas?page=1&per_page=20" \
  -H "Authorization: Bearer TOKEN"
```

### 5.2 Listar Minhas Usinas

```bash
curl -X GET http://localhost:8000/api/usinas/minhas \
  -H "Authorization: Bearer TOKEN"
```

### 5.3 Criar Usina

```bash
curl -X POST http://localhost:8000/api/usinas \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Usina Solar Teste",
    "uc_geradora_id": 1,
    "capacidade_kwp": 100.5,
    "tipo_geracao": "SOLAR",
    "desconto_padrao": 0.30,
    "endereco": "Rua das Usinas, 123"
  }'
```

### 5.4 Buscar Usina

```bash
curl -X GET http://localhost:8000/api/usinas/1 \
  -H "Authorization: Bearer TOKEN"
```

### 5.5 Atualizar Usina

```bash
curl -X PUT http://localhost:8000/api/usinas/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Usina Solar Atualizada",
    "capacidade_kwp": 150.0,
    "status": "ATIVA"
  }'
```

### 5.6 Listar Gestores

```bash
curl -X GET http://localhost:8000/api/usinas/1/gestores \
  -H "Authorization: Bearer TOKEN"
```

### 5.7 Adicionar Gestor

```bash
curl -X POST http://localhost:8000/api/usinas/1/gestores \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gestor_id": "uuid-do-usuario",
    "comissao_percentual": 0.05
  }'
```

### 5.8 Remover Gestor

```bash
curl -X DELETE http://localhost:8000/api/usinas/1/gestores/uuid-do-gestor \
  -H "Authorization: Bearer TOKEN"
```

### 5.9 Listar Beneficiários da Usina

```bash
curl -X GET http://localhost:8000/api/usinas/1/beneficiarios \
  -H "Authorization: Bearer TOKEN"
```

---

## 6. Testes do Módulo Beneficiários (`/api/beneficiarios`)

### 6.1 Listar Beneficiários

```bash
curl -X GET "http://localhost:8000/api/beneficiarios?page=1&per_page=20" \
  -H "Authorization: Bearer TOKEN"
```

### 6.2 Listar com Filtros

```bash
curl -X GET "http://localhost:8000/api/beneficiarios?usina_id=1&status=ATIVO" \
  -H "Authorization: Bearer TOKEN"
```

### 6.3 Meus Benefícios

```bash
curl -X GET http://localhost:8000/api/beneficiarios/meus \
  -H "Authorization: Bearer TOKEN"
```

### 6.4 Beneficiários por Usina

```bash
curl -X GET "http://localhost:8000/api/beneficiarios/usina/1?page=1" \
  -H "Authorization: Bearer TOKEN"
```

### 6.5 Criar Beneficiário

```bash
curl -X POST http://localhost:8000/api/beneficiarios \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "usina_id": 1,
    "uc_id": 2,
    "cpf": "123.456.789-09",
    "nome": "Beneficiário Teste",
    "email": "beneficiario@exemplo.com",
    "telefone": "(65) 99999-0000",
    "percentual_rateio": 25.0,
    "desconto": 0.30
  }'
```

### 6.6 Buscar Beneficiário

```bash
curl -X GET http://localhost:8000/api/beneficiarios/1 \
  -H "Authorization: Bearer TOKEN"
```

### 6.7 Atualizar Beneficiário

```bash
curl -X PUT http://localhost:8000/api/beneficiarios/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Nome Atualizado",
    "percentual_rateio": 30.0,
    "desconto": 0.25
  }'
```

### 6.8 Enviar Convite

```bash
curl -X POST http://localhost:8000/api/beneficiarios/1/convite \
  -H "Authorization: Bearer TOKEN"
```

### 6.9 Ativar Beneficiário

```bash
curl -X POST http://localhost:8000/api/beneficiarios/1/ativar \
  -H "Authorization: Bearer TOKEN"
```

### 6.10 Suspender Beneficiário

```bash
curl -X POST http://localhost:8000/api/beneficiarios/1/suspender \
  -H "Authorization: Bearer TOKEN"
```

### 6.11 Cancelar Beneficiário

```bash
curl -X POST http://localhost:8000/api/beneficiarios/1/cancelar \
  -H "Authorization: Bearer TOKEN"
```

---

## 7. Testes do Módulo Faturas (`/api/faturas`)

### 7.1 Listar Faturas

```bash
curl -X GET "http://localhost:8000/api/faturas?page=1&per_page=20" \
  -H "Authorization: Bearer TOKEN"
```

### 7.2 Listar com Filtros

```bash
curl -X GET "http://localhost:8000/api/faturas?uc_id=1&ano_referencia=2024&mes_referencia=11" \
  -H "Authorization: Bearer TOKEN"
```

### 7.3 Faturas por UC

```bash
curl -X GET "http://localhost:8000/api/faturas/uc/1?page=1&per_page=13" \
  -H "Authorization: Bearer TOKEN"
```

### 7.4 Estatísticas de Faturas

```bash
curl -X GET "http://localhost:8000/api/faturas/uc/1/estatisticas?ano=2024" \
  -H "Authorization: Bearer TOKEN"
```

### 7.5 Comparativo Mensal

```bash
curl -X GET "http://localhost:8000/api/faturas/uc/1/comparativo?meses=12" \
  -H "Authorization: Bearer TOKEN"
```

### 7.6 Histórico GD

```bash
curl -X GET "http://localhost:8000/api/faturas/uc/1/gd?page=1&per_page=12" \
  -H "Authorization: Bearer TOKEN"
```

### 7.7 Fatura por Referência

```bash
curl -X GET http://localhost:8000/api/faturas/uc/1/2024/11 \
  -H "Authorization: Bearer TOKEN"
```

### 7.8 Buscar Fatura por ID

```bash
curl -X GET http://localhost:8000/api/faturas/1 \
  -H "Authorization: Bearer TOKEN"
```

### 7.9 Criar Fatura Manual

```bash
curl -X POST http://localhost:8000/api/faturas/manual \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "uc_id": 1,
    "mes_referencia": 11,
    "ano_referencia": 2024,
    "valor_fatura": 350.50,
    "data_vencimento": "2024-12-10",
    "consumo": 250,
    "valor_iluminacao_publica": 25.00
  }'
```

---

## 8. Testes de Validação

### 8.1 Teste de CPF Inválido

```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com",
    "password": "Senha123!",
    "nome_completo": "Teste",
    "cpf": "111.111.111-11"
  }'
```

**Esperado**: Erro 422 - CPF inválido

### 8.2 Teste de Email Duplicado

```bash
# Tentar criar usuário com email já existente
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com",
    "password": "Senha123!",
    "nome_completo": "Outro Teste",
    "cpf": "529.982.247-25"
  }'
```

**Esperado**: Erro 409 - Email já cadastrado

### 8.3 Teste de Token Inválido

```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer token_invalido"
```

**Esperado**: Erro 401 - Token inválido

### 8.4 Teste de Permissão Negada

```bash
# Usuário comum tentando acessar rota de admin
curl -X GET http://localhost:8000/api/usuarios \
  -H "Authorization: Bearer TOKEN_DE_USUARIO_COMUM"
```

**Esperado**: Erro 403 - Acesso negado

### 8.5 Teste de Recurso Não Encontrado

```bash
curl -X GET http://localhost:8000/api/usuarios/uuid-inexistente \
  -H "Authorization: Bearer TOKEN"
```

**Esperado**: Erro 404 - Usuário não encontrado

---

## 9. Testes de Performance

### 9.1 Teste de Carga Básico

```bash
# Usando Apache Bench (ab)
ab -n 100 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/ucs/minhas
```

### 9.2 Teste de Listagem Grande

```bash
curl -X GET "http://localhost:8000/api/faturas?per_page=100" \
  -H "Authorization: Bearer TOKEN"
```

---

## 10. Checklist de Validação

### Módulo Auth
- [ ] Signup funciona com dados válidos
- [ ] Signup rejeita CPF inválido
- [ ] Signup rejeita email duplicado
- [ ] Signin funciona com credenciais corretas
- [ ] Signin rejeita credenciais erradas
- [ ] Refresh token renova access token
- [ ] Logout invalida sessão
- [ ] /me retorna dados do usuário
- [ ] PUT /me atualiza perfil
- [ ] Troca de senha funciona

### Módulo Energisa
- [ ] Simulação inicia corretamente
- [ ] SMS é enviado
- [ ] Validação de SMS funciona
- [ ] UCs são listadas
- [ ] Faturas são retornadas
- [ ] Login autenticado funciona (3 etapas)
- [ ] Informações de GD são retornadas

### Módulo Usuarios
- [ ] Listagem funciona com paginação
- [ ] Filtros funcionam
- [ ] Criação de usuário funciona
- [ ] Atribuição de perfil funciona
- [ ] Ativação/desativação funciona
- [ ] Permissões são respeitadas

### Módulo UCs
- [ ] Vinculação de UC funciona
- [ ] Vinculação por formato funciona
- [ ] Listagem mostra apenas UCs do usuário
- [ ] Configuração de GD funciona
- [ ] Desvinculação funciona

### Módulo Usinas
- [ ] Criação de usina funciona
- [ ] UC é marcada como geradora
- [ ] Gestores podem ser adicionados/removidos
- [ ] Beneficiários são listados corretamente

### Módulo Beneficiários
- [ ] Criação funciona com validação de percentual
- [ ] Convite é gerado corretamente
- [ ] Status pode ser alterado
- [ ] Percentual não excede 100%

### Módulo Faturas
- [ ] Listagem por UC funciona
- [ ] Estatísticas são calculadas
- [ ] Comparativo mensal funciona
- [ ] Fatura manual pode ser criada
- [ ] Histórico GD é retornado

---

## Notas Importantes

1. **Tokens**: Todos os tokens têm validade de 1 hora. Use refresh token para renovar.

2. **Permissões**:
   - `superadmin`: Acesso total
   - `proprietario`: Gerencia suas usinas
   - `gestor`: Gerencia usinas que administra
   - `beneficiario`: Visualiza seus benefícios
   - `usuario`: Acesso básico

3. **CPFs de Teste**: Use CPFs válidos (geradores online) ou os seguintes:
   - `529.982.247-25`
   - `123.456.789-09`

4. **Formato UC**: Sempre `cod_empresa/cdc-digito` (ex: `6/4242904-3`)

5. **Datas**: Formato ISO 8601 (`2024-12-10`)

6. **Decimais**: Use ponto como separador (`0.30`, não `0,30`)
