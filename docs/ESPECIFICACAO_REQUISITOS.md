# 🌞 Plataforma de Gestão de Geração Distribuída (GD)

## Documento de Requisitos e Arquitetura

---

## 📋 Visão Geral

Plataforma SaaS para gestão completa de **Geração Distribuída (GD)** solar, conectando proprietários de usinas, gestores, beneficiários e usuários finais. A plataforma automatiza o processo de rateio de créditos, cobrança, contratos e relatórios.

### Modelo de Negócio
- **Receita**: R$ 0,xx por kWh movimentado na plataforma
- **Cobrança**: Retida automaticamente dos pagamentos dos beneficiários
- **Saques**: Gestores/Proprietários sacam saldo mediante emissão de NF

---

## 🎭 Perfis de Usuário

### Hierarquia de Papéis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPERADMIN                                     │
│  (Proprietário da Plataforma)                                           │
│  ▸ Acesso total a todos os dados                                        │
│  ▸ Gerencia usinas de quem pediu comercialização                        │
│  ▸ Aprova saques de gestores                                            │
│  ▸ Configura taxas, contratos, integrações                              │
│  ▸ Gerencia equipe de suporte                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│   PROPRIETÁRIO    │   │      GESTOR       │   │    USUÁRIO FINAL      │
│                   │   │                   │   │                       │
│ ▸ Dono de usina(s)│   │ ▸ Gateway entre   │   │ ▸ Pessoa física       │
│ ▸ Contrata gestor │   │   usina e         │   │ ▸ UCs próprias        │
│   OU gerencia     │   │   beneficiários   │   │ ▸ Visualiza/paga      │
│   sozinho         │   │ ▸ Gerencia várias │   │   faturas             │
│ ▸ Vê produção vs  │   │   usinas          │   │ ▸ Simula/compra       │
│   distribuição    │   │ ▸ Define rateio   │   │   produtos            │
│ ▸ Paga taxa/kWh   │   │ ▸ Cobra clientes  │   │ ▸ Pode oferecer       │
│                   │   │ ▸ Saca via NF     │   │   créditos p/ venda   │
└───────────────────┘   └───────────────────┘   └───────────────────────┘
        │                         │
        │    ┌────────────────────┘
        ▼    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BENEFICIÁRIO                                    │
│  ▸ Recebe créditos de energia                                           │
│  ▸ UC fica na titularidade da Geradora                                  │
│  ▸ Paga % da tarifa via plataforma                                      │
│  ▸ Vê de qual usina vem os créditos                                     │
│  ▸ Contrato com Gestor/Proprietário                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Regra: Um CPF = Múltiplos Papéis

Um mesmo usuário pode ter diferentes papéis simultaneamente:
- **Exemplo**: João é Proprietário da Usina A, Gestor contratado pela Usina B, e tem UCs próprias como Usuário Final
- **Navegação**: Seletor de contexto "Atuando como: [Papel]"

---

## 👤 Detalhamento por Perfil

### 1. SUPERADMIN (Proprietário da Plataforma)

#### Funcionalidades

| Módulo | Funcionalidades |
|--------|-----------------|
| **Gestão de Usuários** | Criar/editar/bloquear usuários, ver todos os dados |
| **Equipe de Suporte** | Gerenciar atendentes que podem "logar como" usuário |
| **Dashboard Financeiro** | kWh movimentados, receita, saques pendentes, inadimplência |
| **Aprovação de Saques** | Aprovar saques manuais após validação de NF |
| **Usinas Próprias** | Gerenciar usinas de quem pediu comercialização |
| **Marketplace** | Aprovar produtos cadastrados por gestores/parceiros |
| **Leads/CRM** | Acompanhar interessados em comprar usinas/energia |
| **Configurações** | Taxa por kWh, templates de contrato, notificações |
| **Relatórios** | Usinas totais, UCs, ranking gestores, projeção, churn |
| **Integrações** | Distribuidoras, inversores, gateway pagamento |
| **Suporte** | Módulo de tickets, FAQ/Base de conhecimento |

#### Dashboard Superadmin

```
┌─────────────────────────────────────────────────────────────────────┐
│  💰 FINANCEIRO                                                       │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│ kWh Mês     │ Receita Mês │ Saques Pend │ Inadimpl.   │ Saldo Plat. │
│ 1.250.000   │ R$ 12.500   │ R$ 45.000   │ R$ 3.200    │ R$ 89.000   │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  📊 OPERACIONAL                                                      │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│ Usinas      │ Gestores    │ Benefic.    │ UCs Total   │ Contratos   │
│ 150         │ 45          │ 2.300       │ 3.500       │ 2.450       │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

---

### 2. PROPRIETÁRIO DE USINA

#### Funcionalidades

| Módulo | Funcionalidades |
|--------|-----------------|
| **Minhas Usinas** | Lista de usinas próprias com produção e status |
| **Produção vs Distribuição** | Quanto gera vs quanto distribui |
| **Gestores** | Contratar/demitir gestores, ver contratos |
| **Beneficiários** | Ver quem recebe créditos (se gerencia sozinho) |
| **Rateio** | Definir/aprovar distribuição de créditos (parametrizável) |
| **Contratos** | Visualizar contratos com gestores e beneficiários |
| **Financeiro** | Quanto deve à plataforma, extrato de movimentação |
| **Relatórios** | Produção mensal, economia gerada, ranking beneficiários |

#### Dashboard Proprietário

```
┌─────────────────────────────────────────────────────────────────────┐
│  🌞 MINHAS USINAS                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Usina Solar Fazenda    │ 45.000 kWh/mês │ 12 beneficiários │ ✅    │
│  Usina Comercial Centro │ 22.000 kWh/mês │  8 beneficiários │ ✅    │
└─────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────┬──────────────────────────────────────┐
│  📈 PRODUÇÃO ESTE MÊS        │  💰 FINANCEIRO                       │
│  Total: 67.000 kWh           │  Taxa plataforma: R$ 670,00          │
│  Distribuído: 62.500 kWh     │  Economia gerada: R$ 48.500          │
│  Saldo: 4.500 kWh            │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
```

---

### 3. GESTOR

#### Funcionalidades

| Módulo | Funcionalidades |
|--------|-----------------|
| **Usinas Gerenciadas** | Lista de usinas sob sua gestão |
| **Beneficiários** | Cadastrar, editar, remover beneficiários |
| **Rateio** | Definir percentuais de distribuição de créditos |
| **Faturas** | Baixar PDFs, visualizar status, histórico |
| **Cobrança** | Gerar cobranças para beneficiários (% da tarifa) |
| **Contratos** | Gerar contratos automáticos, acompanhar vigência |
| **Financeiro** | Saldo disponível, solicitar saque (com NF) |
| **Relatórios** | Créditos distribuídos, inadimplência, ranking UCs |
| **Titularidade** | Solicitar troca de titularidade (entrada/saída) |

#### Dashboard Gestor

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 RESUMO                                                           │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│ Usinas      │ Benefic.    │ kWh Mês     │ A Receber   │ Saldo       │
│ 8           │ 156         │ 245.000     │ R$ 18.500   │ R$ 42.300   │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️ AÇÕES PENDENTES                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  • 12 faturas vencendo em 5 dias                                    │
│  • 3 contratos expirando este mês                                   │
│  • 2 solicitações de saída pendentes                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. BENEFICIÁRIO

#### Funcionalidades

| Módulo | Funcionalidades |
|--------|-----------------|
| **Meus Créditos** | Quanto recebe de cada usina |
| **Faturas** | Visualizar faturas da Energisa |
| **Pagamentos** | Pagar % da economia via plataforma |
| **Economia** | Quanto economizou com energia solar |
| **Contrato** | Visualizar contrato com gestor |
| **Histórico** | Evolução mensal de créditos e economia |

#### Dashboard Beneficiário

```
┌─────────────────────────────────────────────────────────────────────┐
│  🌞 CRÉDITOS RECEBIDOS                                               │
├─────────────────────────────────────────────────────────────────────┤
│  Usina Solar Fazenda    │ 850 kWh │ 15% do rateio │ Gestor: Maria  │
└─────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────┬──────────────────────────────────────┐
│  💰 ECONOMIA ESTE MÊS        │  📄 PAGAMENTO                        │
│  Créditos: 850 kWh           │  Valor: R$ 127,50                    │
│  Economia: R$ 595,00         │  Vencimento: 15/12/2025              │
│  Você paga: R$ 127,50 (15%)  │  Status: PENDENTE                    │
└──────────────────────────────┴──────────────────────────────────────┘
```

---

### 5. USUÁRIO FINAL

#### Funcionalidades

| Módulo | Funcionalidades |
|--------|-----------------|
| **Minhas UCs** | Lista de unidades consumidoras próprias |
| **Faturas** | Visualizar, baixar PDF, pagar |
| **Histórico** | Consumo mensal, gráficos |
| **Simulador** | Simular compra de usina ou energia compartilhada |
| **Marketplace** | Ver ofertas de usinas e energia |
| **Vender Créditos** | Oferecer créditos excedentes para comercialização |

#### Dashboard Usuário Final

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 MINHAS UCs                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  UC 12345678 │ Residência │ R$ 450,00 │ Vence 15/12 │ PENDENTE     │
│  UC 87654321 │ Comércio   │ R$ 1.200  │ Vence 20/12 │ PENDENTE     │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  💡 QUER ECONOMIZAR?                                                 │
│  Simule agora quanto você pode economizar com energia solar!        │
│                          [ SIMULAR AGORA ]                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxos Principais

### Fluxo 1: Cadastro e Vinculação

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Usuário    │────▶│  Cadastro   │────▶│  Verificação│
│  Acessa     │     │  (CPF/CNPJ) │     │  SMS/Email  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐
        │  Escolhe Papel        │
        │  ┌─────────────────┐  │
        │  │ Usuário Final   │  │──▶ Vincula UCs via Energisa
        │  │ Proprietário    │  │──▶ Cadastra Usina
        │  │ Gestor          │  │──▶ Aguarda contratação
        │  │ Beneficiário    │  │──▶ Recebe convite de Gestor
        │  └─────────────────┘  │
        └───────────────────────┘
```

### Fluxo 2: Contratação de Gestor

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Proprietário│────▶│  Busca      │────▶│  Envia      │
│             │     │  Gestores   │     │  Convite    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Gestor Aceita        │────▶│  Contrato   │
        │                       │     │  Gerado     │
        └───────────────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐
        │  Gestor assume        │
        │  gerenciamento        │
        └───────────────────────┘
```

### Fluxo 3: Entrada de Beneficiário

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Gestor      │────▶│  Cadastra   │────▶│  Contrato   │
│             │     │  Benefic.   │     │  Gerado     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Beneficiário         │────▶│  Assina     │
        │  Recebe convite       │     │  Contrato   │
        └───────────────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Solicitação de       │────▶│  UC passa   │
        │  troca titularidade   │     │  p/ Geradora│
        └───────────────────────┘     └─────────────┘
```

### Fluxo 4: Cobrança e Pagamento

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Fatura      │────▶│  Sistema    │────▶│  Calcula    │
│ Energisa    │     │  Importa    │     │  Economia   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Gera cobrança        │────▶│  Benefic.   │
        │  (% da economia)      │     │  Paga       │
        └───────────────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Plataforma retém     │────▶│  Saldo      │
        │  taxa (R$/kWh)        │     │  p/ Gestor  │
        └───────────────────────┘     └─────────────┘
```

### Fluxo 5: Saque do Gestor

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Gestor      │────▶│  Solicita   │────▶│  Upload     │
│             │     │  Saque      │     │  NF         │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Superadmin           │────▶│  Aprova     │
        │  Valida NF            │     │  Saque      │
        └───────────────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐
        │  Transferência        │
        │  (futuro: automática) │
        └───────────────────────┘
```

### Fluxo 6: Saída de Beneficiário

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Benefic.    │────▶│  Solicita   │────▶│  Verifica   │
│ ou Gestor   │     │  Rescisão   │     │  Contrato   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  Aplica cláusulas     │────▶│  Solicita   │
        │  de rescisão          │     │  Troca Tit. │
        └───────────────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐
        │  UC volta para        │
        │  nome do Beneficiário │
        └───────────────────────┘
```

---

## 📄 Contratos

### Tipos de Contrato

| Tipo | Partes | Gerado por | Cláusulas |
|------|--------|------------|-----------|
| **Proprietário ↔ Gestor** | Proprietário + Gestor | Sistema | Vigência, comissão, rescisão |
| **Gestor ↔ Beneficiário** | Gestor + Beneficiário | Sistema | Vigência, % economia, rescisão, titularidade |
| **Proprietário ↔ Beneficiário** | Proprietário + Beneficiário | Sistema | Quando proprietário gerencia sozinho |

### Assinatura
- **Digital**: Assinatura eletrônica na plataforma
- **Templates**: Configuráveis pelo Superadmin

---

## 💰 Modelo Financeiro

### Conceito Principal

O beneficiário **NÃO paga mais para a Energisa**. A UC dele está na titularidade da Geradora.
O Gestor oferece um **DESCONTO** sobre a tarifa da Energisa (ex: 30% de desconto).
A plataforma gera a cobrança completa para o beneficiário e **PAGA a fatura da Energisa**.

### Exemplo Prático Completo

**Dados do cenário:**
- Créditos recebidos: 850 kWh
- Tarifa Energisa: R$ 1,10138/kWh
- Desconto do Gestor: 30%
- Taxa Plataforma: 5% (sobre valor da energia com desconto)
- Tipo ligação: Bifásico
- Iluminação pública: R$ 25,00

**Cálculos:**

```
1. ENERGIA COM DESCONTO
   Tarifa Gestor = R$ 1,10138 × (1 - 30%) = R$ 0,77097/kWh
   Valor Energia = 850 kWh × R$ 0,77097 = R$ 655,32

2. PISO REGULATÓRIO (maior entre Fio B e Taxa Mínima)
   Fio B = 850 kWh × R$ 0,185 × 45% (fator 2025) = R$ 70,76
   Taxa Mínima = 50 kWh × R$ 1,10138 = R$ 55,07
   Piso usado = R$ 70,76 (Fio B é maior)

3. COBRANÇA TOTAL PARA BENEFICIÁRIO
   Energia c/ desconto:    R$ 655,32
   Piso regulatório:       R$  70,76
   Iluminação pública:     R$  25,00
   ─────────────────────────────────
   TOTAL:                  R$ 751,08

4. ECONOMIA DO BENEFICIÁRIO
   Se pagasse Energisa: 850 × R$ 1,10138 + R$ 70,76 + R$ 25,00 = R$ 1.031,93
   Paga via plataforma: R$ 751,08
   Economia: R$ 280,85 (27%)
```

### Fluxo Financeiro Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│  👩 MARIA (Beneficiária)                                            │
│                                                                     │
│  ❌ NÃO paga Energisa (UC na titularidade da Geradora)              │
│  ✅ Paga via plataforma: R$ 751,08                                  │
│  📅 Vencimento: 1 dia ANTES da fatura Energisa                      │
│                                                                     │
│  Composição:                                                        │
│  • Energia c/ 30% desconto: R$ 655,32                               │
│  • Piso regulatório (Fio B): R$ 70,76                               │
│  • Iluminação pública: R$ 25,00                                     │
│                                                                     │
│  Economia: R$ 280,85/mês                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Paga R$ 751,08
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  🏢 PLATAFORMA                                                      │
│                                                                     │
│  1️⃣ RECEBE de Maria: R$ 751,08                                      │
│                                                                     │
│  2️⃣ PAGA fatura Energisa da UC Maria: R$ 200,00                     │
│     (taxa mínima + iluminação + resíduo)                            │
│                                                                     │
│  3️⃣ RETÉM taxa (5% sobre energia c/ desconto):                      │
│     R$ 655,32 × 5% = R$ 32,77                                       │
│                                                                     │
│  4️⃣ REPASSA ao Gestor:                                              │
│     R$ 751,08 - R$ 200,00 - R$ 32,77 = R$ 518,31                    │
│                                                                     │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐     │
│  │ Entrada      │ Paga Energisa│ Taxa Plataf. │ Saldo Gestor │     │
│  │ R$ 751,08    │ R$ 200,00    │ R$ 32,77     │ R$ 518,31    │     │
│  └──────────────┴──────────────┴──────────────┴──────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Saldo disponível
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  👨‍💼 PAULO (Gestor)                                                  │
│                                                                     │
│  Saldo acumulado: R$ 518,31                                         │
│                                                                     │
│  Para sacar: Solicita → Emite NF → Superadmin aprova → Recebe       │
└─────────────────────────────────────────────────────────────────────┘
```

### Resumo: Quem Ganha o Quê

| Participante | Recebe | Paga | Resultado |
|--------------|--------|------|-----------|
| **Beneficiário** | - | R$ 751,08 | Economiza R$ 280,85 (27%) |
| **Plataforma** | R$ 751,08 | R$ 200,00 (Energisa) | Lucro R$ 32,77 |
| **Gestor** | R$ 518,31 | - | Lucro R$ 518,31 |
| **Energisa** | R$ 200,00 | - | Recebe da plataforma |

### Fórmulas

```python
# 1. Tarifa do Gestor (com desconto)
tarifa_gestor = tarifa_energisa × (1 - desconto_gestor)

# 2. Valor Energia (o que beneficiário paga pela energia)
valor_energia = kwh × tarifa_gestor

# 3. Piso Regulatório (maior entre Fio B e Taxa Mínima)
fio_b = kwh × fio_b_base × fator_ano
taxa_minima = kwh_minimo × tarifa_energisa  # 30/50/100 kWh conforme ligação
piso = max(fio_b, taxa_minima)

# 4. Cobrança Total para Beneficiário
cobranca_beneficiario = valor_energia + piso + iluminacao_publica

# 5. Taxa da Plataforma (5% sobre valor energia)
taxa_plataforma = valor_energia × 0.05

# 6. Fatura Energisa (que a plataforma paga)
fatura_energisa = piso + iluminacao + residuo

# 7. Saldo do Gestor
saldo_gestor = cobranca_beneficiario - fatura_energisa - taxa_plataforma
```

### Configurações

| Parâmetro | Quem Configura | Exemplo | Descrição |
|-----------|----------------|---------|-----------|
| **Tarifa Energisa** | API ANEEL (automático) | R$ 1,10138/kWh | Atualizada automaticamente |
| **Fio B Base** | API ANEEL (automático) | R$ 0,185/kWh | Componente regulatório |
| **Fator Fio B** | Sistema (por ano) | 45% (2025) | Escalonamento ANEEL |
| **Taxa Mínima** | Sistema | 30/50/100 kWh | Mono/Bi/Trifásico |
| **% Desconto** | Gestor (default) | 30% | Pode variar por proposta |
| **Taxa Plataforma** | Superadmin | 5% | Sobre valor da energia |

### Fluxo de Datas

```
Dia 10: Fatura Energisa vence
Dia 09: Cobrança para beneficiário vence (1 dia antes)
Dia 08: Notificação de vencimento enviada
Dia 01-08: Beneficiário pode pagar
Dia 10: Plataforma paga Energisa automaticamente
```

---

## 🔔 Notificações

| Evento | Destinatário | Canal |
|--------|--------------|-------|
| Fatura vencendo (5 dias) | Todos | Email + Push |
| Fatura vencida | Todos | Email + Push |
| Novo gestor adicionado | Proprietário + Gestor | Email |
| Contrato expirando (30 dias) | Partes envolvidas | Email |
| Saque aprovado | Gestor | Email |
| Novo beneficiário | Gestor + Proprietário | Email |
| Solicitação de rescisão | Partes envolvidas | Email |

---

## 📊 Relatórios

### Por Perfil

| Relatório | Superadmin | Proprietário | Gestor | Benefic. | Usuário |
|-----------|------------|--------------|--------|----------|---------|
| Consumo mensal por UC | ✅ | ✅ | ✅ | ✅ | ✅ |
| Economia com solar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ranking de consumo | ✅ | ✅ | ✅ | - | - |
| Produção vs Distribuição | ✅ | ✅ | ✅ | - | - |
| Créditos distribuídos | ✅ | ✅ | ✅ | - | - |
| Inadimplência | ✅ | - | ✅ | - | - |
| Ranking gestores | ✅ | - | - | - | - |
| Projeção de receita | ✅ | - | - | - | - |
| Churn | ✅ | - | - | - | - |

### Exportação
- **Formatos**: Excel (.xlsx) e PDF
- **Período**: Mensal, trimestral, anual, personalizado

---

## 🏪 Marketplace

### Produtos

| Tipo | Cadastrado por | Aprovado por |
|------|----------------|--------------|
| Usina Solar (venda) | Gestor/Parceiro | Superadmin |
| Energia Compartilhada | Gestor/Proprietário | Superadmin |
| Créditos Excedentes | Usuário Final | Plataforma gerencia |

### Fluxo de Compra

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Interessado │────▶│  Simulação  │────▶│  Lead       │
│             │     │             │     │  gerado     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
        ┌───────────────────────┐     ┌─────────────┐
        │  CRM acompanha        │────▶│  Venda      │
        │                       │     │  fechada    │
        └───────────────────────┘     └─────────────┘
```

---

## 🎫 Suporte

### Módulos

| Módulo | Descrição |
|--------|-----------|
| **Tickets** | Usuários abrem chamados, equipe responde |
| **FAQ** | Base de conhecimento pública |
| **Atendimento** | Equipe pode "logar como" usuário para suporte |

### Categorias de Ticket

- Dúvidas sobre faturas
- Problemas com pagamento
- Solicitação de rescisão
- Dúvidas sobre contrato
- Problemas técnicos
- Outros

---

## 🔌 Integrações

### Atuais

| Sistema | Status | Descrição |
|---------|--------|-----------|
| **Energisa** | ✅ Ativo | Gateway próprio para faturas e UCs |

---

### API Gateway Energisa - Endpoints Principais

#### Autenticação (Fluxo SMS)
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/login/start` | POST | Inicia login, busca telefones pelo CPF |
| `/auth/login/select-option` | POST | Seleciona telefone para receber SMS |
| `/auth/login/finish` | POST | Valida código SMS e retorna tokens |

#### Unidades Consumidoras
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/ucs` | POST | Lista todas UCs do usuário autenticado |
| `/ucs/info` | POST | Informações detalhadas de uma UC específica |

**Resposta `/ucs` - Campo importante:**
```json
{
  "ucs": [
    {
      "cdc": 123456,
      "digitoVerificador": 1,
      "endereco": "Rua X, 123",
      "usuarioTitular": true,   // ⭐ TRUE = usuário é dono da UC
                                 // FALSE = usuário apenas gerencia
      ...
    }
  ]
}
```

#### Geração Distribuída (GD)
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/gd/info` | POST | ⭐ Retorna se UC é GERADORA ou BENEFICIÁRIA + lista de beneficiárias |
| `/gd/details` | POST | Histórico de créditos, saldo acumulado, energia injetada |
| `/gd/alterar-beneficiaria` | POST | Altera rateio de créditos entre beneficiárias |

**Resposta `/gd/info` - Estrutura:**
```json
{
  "tipoUC": "GERADORA",           // ou "BENEFICIARIA"
  "beneficiarias": [              // Lista de UCs que recebem créditos
    {
      "cdc": 654321,
      "percentualDistribuicao": 50.0,  // 50% dos créditos
      "endereco": "Rua Y, 456"
    },
    {
      "cdc": 789012,
      "percentualDistribuicao": 30.0,  // 30% dos créditos
      "endereco": "Rua Z, 789"
    }
  ],
  "percentualCompensacao": 100    // Total distribuído
}
```

**Resposta `/gd/details` - Histórico:**
```json
{
  "infos": [
    {
      "periodo": "202412",
      "energiaInjetada": 1200.50,      // kWh gerados
      "creditosAnteriores": 500.30,    // Saldo anterior
      "creditosGerados": 1200.50,      // Novos créditos
      "creditosUtilizados": 300.20,    // Consumidos pelas beneficiárias
      "saldoAtual": 1400.60            // ⭐ SALDO ACUMULADO
    }
  ]
}
```

#### Faturas
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/faturas/listar` | POST | Lista faturas de uma UC |
| `/faturas/pdf` | POST | Download PDF da fatura |

#### Anexos e Documentos
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/anexos/enviar` | POST | Upload de documentos (CPF, RG, etc) |

---

### Lógica de Detecção de Perfil (usando API)

```python
def detectar_perfil_por_api(usuario_id: int) -> list[str]:
    """
    Detecta perfis baseado nos dados da API Energisa
    """
    perfis = ['usuario']

    # 1. Busca UCs do usuário
    ucs = gateway.get_ucs(usuario.cpf)

    for uc in ucs:
        # 2. Verifica se é titular
        if uc['usuarioTitular'] == True:
            # 3. Verifica se é geradora
            gd_info = gateway.get_gd_info(uc['cdc'])

            if gd_info and gd_info['tipoUC'] == 'GERADORA':
                perfis.append('proprietario')  # Dono de usina
            else:
                # UC normal própria
                pass
        else:
            # Não é titular = está gerenciando UC de terceiro
            perfis.append('gestor')

    # 4. Verifica se é beneficiário (tabela local)
    if has_beneficiario_ativo(usuario_id):
        perfis.append('beneficiario')

    # 5. Superadmin é flag manual
    if usuario.is_superadmin:
        perfis.append('superadmin')

    return list(set(perfis))
```

---

### Futuras

| Sistema | Prioridade | Descrição |
|---------|------------|-----------|
| Outras distribuidoras | Alta | Estrutura preparada |
| Inversores solares | Média | API para produção real |
| Gateway de pagamento | Alta | PIX, Boleto |
| Transferência bancária | Média | Saques automáticos |

---

## 🖥️ Arquitetura Frontend

### Estrutura de Rotas

```
/                           → Landing Page (público)
/login                      → Login
/cadastro                   → Cadastro
/app                        → App autenticado
  /app/selecionar-perfil    → Seletor de papel

  # Superadmin
  /app/admin                → Dashboard Admin
  /app/admin/usuarios       → Gestão de usuários
  /app/admin/financeiro     → Financeiro
  /app/admin/saques         → Aprovar saques
  /app/admin/usinas         → Usinas da plataforma
  /app/admin/marketplace    → Aprovar produtos
  /app/admin/leads          → CRM
  /app/admin/config         → Configurações
  /app/admin/suporte        → Tickets
  /app/admin/relatorios     → Relatórios gerenciais

  # Proprietário
  /app/proprietario                → Dashboard
  /app/proprietario/usinas         → Minhas usinas
  /app/proprietario/usinas/:id     → Detalhes usina
  /app/proprietario/gestores       → Gestores contratados
  /app/proprietario/beneficiarios  → Beneficiários (se gerencia)
  /app/proprietario/contratos      → Contratos
  /app/proprietario/financeiro     → Financeiro
  /app/proprietario/relatorios     → Relatórios

  # Gestor
  /app/gestor                      → Dashboard
  /app/gestor/usinas               → Usinas gerenciadas
  /app/gestor/usinas/:id           → Detalhes usina
  /app/gestor/beneficiarios        → Beneficiários
  /app/gestor/rateio               → Configurar rateio
  /app/gestor/faturas              → Faturas
  /app/gestor/cobrancas            → Cobranças
  /app/gestor/contratos            → Contratos
  /app/gestor/financeiro           → Saldo e saques
  /app/gestor/relatorios           → Relatórios

  # Beneficiário
  /app/beneficiario                → Dashboard
  /app/beneficiario/creditos       → Meus créditos
  /app/beneficiario/faturas        → Faturas Energisa
  /app/beneficiario/pagamentos     → Pagamentos
  /app/beneficiario/contrato       → Meu contrato
  /app/beneficiario/economia       → Histórico economia

  # Usuário Final
  /app/usuario                     → Dashboard
  /app/usuario/ucs                 → Minhas UCs
  /app/usuario/ucs/:id             → Detalhes UC
  /app/usuario/faturas             → Faturas
  /app/usuario/simulador           → Simulador
  /app/usuario/marketplace         → Ofertas
  /app/usuario/vender-creditos     → Oferecer créditos

  # Comum
  /app/perfil                      → Configurações do usuário
  /app/notificacoes                → Central de notificações
  /app/suporte                     → Abrir ticket
```

### Componentes Compartilhados

```
components/
├── layout/
│   ├── Sidebar.tsx           # Menu lateral (adapta por perfil)
│   ├── Header.tsx            # Cabeçalho com seletor de perfil
│   ├── ProfileSelector.tsx   # "Atuando como: [Papel]"
│   └── MainLayout.tsx        # Layout padrão
├── cards/
│   ├── MetricCard.tsx        # Card de métrica
│   ├── UsinaCard.tsx         # Card de usina
│   ├── UCCard.tsx            # Card de UC
│   └── ContratoCard.tsx      # Card de contrato
├── tables/
│   ├── FaturasTable.tsx      # Tabela de faturas
│   ├── BeneficiariosTable.tsx
│   └── TransacoesTable.tsx
├── modals/
│   ├── FaturaModal.tsx
│   ├── ContratoModal.tsx
│   ├── RateioModal.tsx
│   └── SaqueModal.tsx
├── charts/
│   ├── ConsumoChart.tsx
│   ├── ProducaoChart.tsx
│   └── EconomiaChart.tsx
└── forms/
    ├── CadastroForm.tsx
    ├── BeneficiarioForm.tsx
    └── UsinaForm.tsx
```

---

## 📱 Responsividade

- **Desktop**: Layout completo com sidebar
- **Tablet**: Sidebar colapsável
- **Mobile**: Menu hambúrguer, cards empilhados

---

## 🔐 Permissões

### Matriz de Acesso

| Recurso | Super | Prop. | Gestor | Benef. | Usuário |
|---------|-------|-------|--------|--------|---------|
| Ver todas usinas | ✅ | - | - | - | - |
| Ver suas usinas | ✅ | ✅ | ✅ | - | - |
| Editar rateio | ✅ | ✅* | ✅ | - | - |
| Ver beneficiários | ✅ | ✅ | ✅ | - | - |
| Cadastrar beneficiário | ✅ | ✅ | ✅ | - | - |
| Ver faturas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baixar PDF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aprovar saque | ✅ | - | - | - | - |
| Solicitar saque | - | ✅ | ✅ | - | - |
| Configurar plataforma | ✅ | - | - | - | - |

*Proprietário pode aprovar (parametrizável)

---

## 🔑 Estrutura de Tokens e Autenticação

### Tokens da Plataforma (JWT)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  JWT ACCESS TOKEN (curta duração)                                            │
│  - Expira em: 15 minutos                                                     │
│  - Usado em: Header Authorization: Bearer <token>                            │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Quando expira
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  JWT REFRESH TOKEN (longa duração)                                           │
│  - Expira em: 7 dias                                                         │
│  - Armazenado no banco (tabela tokens_usuario)                               │
│  - Endpoint: POST /api/auth/refresh                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tokens da Energisa (via Gateway)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOKENS ENERGISA (obtidos via fluxo SMS)                                     │
│                                                                              │
│  Tokens retornados pelo /auth/login/finish:                                  │
│  - utk (User Token)                                                          │
│  - rtk (Request Token)                                                       │
│  - udk (User Data Key)                                                       │
│  - refreshToken (para renovar)                                               │
│  - cpf, SM, CLID, etc. (cookies de sessão)                                   │
│                                                                              │
│  ⚠️ EXPIRA EM: 24 horas                                                      │
│  ✅ RENOVAÇÃO: Usar refreshToken para obter novos tokens                     │
└─────────────────────────────────────────────────────────────────────────────┘

Fluxo de Renovação:
1. Sistema detecta token expirado (erro 401)
2. Chama endpoint de refresh com refreshToken
3. Se refresh falhar → Notifica usuário para re-autenticar via SMS
4. Se refresh OK → Atualiza tokens no banco e retry da operação
```

### Tabela de Tokens Energisa (NOVA)
```sql
CREATE TABLE tokens_energisa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    -- Tokens principais
    utk TEXT,                    -- User Token
    rtk TEXT,                    -- Request Token
    udk TEXT,                    -- User Data Key
    refresh_token TEXT,          -- Para renovação

    -- Cookies de sessão (JSON com todos os cookies)
    cookies_json TEXT,

    -- Controle de expiração
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    expira_em DATETIME,          -- 24h após criação
    ultimo_uso DATETIME,
    renovacoes INTEGER DEFAULT 0,

    -- Status
    ativo BOOLEAN DEFAULT TRUE,
    erro_ultimo TEXT,            -- Último erro de renovação

    UNIQUE(usuario_id)
);
```

---

## 📋 Estrutura da UC (Unidade Consumidora)

### Formato de Exibição PADRÃO
**SEMPRE mostrar a UC no formato: `codigoEmpresaWeb/cdc-digitoVerificador`**

```
Exemplos:
- 6/4242904-3  (Empresa 6, CDC 4242904, DV 3)
- 6/4160693-0  (Empresa 6, CDC 4160693, DV 0)
- 6/5161501-1  (Empresa 6, CDC 5161501, DV 1)

Aplicar em:
✅ Cards de UC
✅ Tabelas de listagem
✅ Campos de busca/filtro
✅ Modais de seleção
✅ Relatórios
✅ Breadcrumbs
✅ Títulos de página
✅ Labels de gráficos
```

### Campos da UC (baseado no response /ucs)
```json
{
  "codigoEmpresaWeb": 6,           // ⭐ Código da distribuidora
  "numeroUc": 4242904,             // ⭐ CDC (Código do Cliente)
  "digitoVerificador": 3,          // ⭐ Dígito verificador
  "ucAtiva": true,
  "ucCortada": false,
  "ucDesligada": false,
  "contratoAtivo": true,
  "dataEncerramentoContrato": null,
  "codigoMunicipio": 59,
  "nomeMunicipio": "SINOP",
  "uf": "MT",
  "codigoLocalidade": 59,
  "localidade": "SINOP",
  "bairro": "JARDIM BOTANICO",
  "codigoEndereco": 24261,
  "endereco": "RUA DAS AZALEIAS",
  "numeroImovel": "242",
  "complemento": "0591301311000",
  "dataProximaLeitura": "10/12/2025 00:00:00",
  "dataProximaLeituraISO": "2025-12-10T00:00:00",
  "medidorInstalado": true,
  "indicadorCorte": false,
  "baixaRenda": false,
  "tarifaBranca": false,
  "usuarioTitular": false,          // ⭐ TRUE = dono | FALSE = gestor
  "faturaEmail": true,
  "nomeTitular": "JOAO OLEGARIO DOS SANTOS",
  "latitude": -11.867342,
  "longitude": -55.512012,
  "ultimaLeituraReal": 62780,
  "dataUltimaLeitura": "2025-11-11T00:00:00",
  "grupoLeitura": "B",
  "classeLeitura": "RESIDENCIAL",
  "geracaoDistribuida": null        // ⭐ Se preenchido, UC participa de GD
}
```

### Campos Adicionais de /ucs/info
```json
{
  "dadosUc": {
    "cpfCnpj": 29991560149,         // ⭐ CPF/CNPJ do titular
    "numeroUCAneel": 40741301799,   // Código ANEEL
    "tipoLigacao": "BIFASICO",      // ⭐ MONOFASICO, BIFASICO, TRIFASICO
    "diaVencimento": 11,            // Dia padrão de vencimento
    "valorMedioKWH": 621,           // Média de consumo kWh
    "email": "email@example.com",
    "telefone1": 66996622444
  },
  "dadosInstalacao": {
    "classeLeitura": "RESIDENCIAL",
    "grupoLeitura": "B",
    "tipoLigacao": "BIFASICO",
    "numeroMedidor": "00002724342"
  },
  "dadosEndereco": {
    "cep": "78550001",
    "longitude": -55.512012,
    "latitude": -11.867342
  }
}
```

---

## 📊 Histórico de Faturas (13 meses)

### Limitação da API Energisa
A Energisa retorna apenas os **últimos 13 meses** de faturas (índice 0 a 12).
Após esse período, as faturas não são mais acessíveis via API.

### Estratégia de Persistência
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SINCRONIZAÇÃO DE FATURAS                                                    │
│                                                                              │
│  1. Job diário/semanal busca faturas via API                                 │
│  2. Para cada fatura, verifica se já existe no banco                         │
│  3. Se nova: salva JSON COMPLETO + baixa PDF                                 │
│  4. Se existente: atualiza status de pagamento                               │
│                                                                              │
│  ⚠️ IMPORTANTE: Guardar TODO o JSON da fatura para histórico completo       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Campos da Fatura (baseado no response /faturas/listar)
```json
{
  "cdcVinculado": 4242904,
  "digitoVerificadorCdc": 0,
  "anoReferencia": 2025,
  "mesReferencia": 11,
  "numeroFatura": 23588158,
  "valorFatura": 114.04,
  "indicadorSituacao": 2,
  "dataLeitura": "11/11/2025 00:00:00",
  "dataVencimento": "11/12/2025 00:00:00",
  "dataPagamento": null,
  "indicadorPagamento": false,
  "situacaoPagamento": "Pendente",
  "consumo": 0,
  "leituraAtual": 62780,
  "leituraAnterior": 62225,
  "quantidadeDiaConsumo": 32,
  "mediaConsumo": 621,
  "valorLiquido": 79.89,
  "valorIluminacaoPublica": 34.15,
  "valorICMS": 0,
  "bandeiraTarifaria": "Vermelha",
  "qrCodePix": "00020101...",
  "detalhamentoFatura": {
    "servicoDistribuicaoEnergia": 26.69,
    "compraEnergia": 36.93,
    "servicoTransmissao": 4.34,
    "encargosSetoriais": 11.93,
    "impostosDiretosEncargos": 0.01
  },
  "indicadoresContinuidade": { ... }
}
```

---

## 🗄️ Modelagem do Banco de Dados

### Regras de Negócio para Cadastro

#### Detecção Automática de Perfil
O sistema detecta automaticamente o perfil do usuário baseado nas UCs vinculadas:

- **Usuário Final**: Tem UCs próprias (CPF igual), nenhuma é geradora
- **Proprietário**: Tem UC geradora (usina) em seu CPF/CNPJ
- **Gestor**: Gerencia UCs que NÃO são dele (CPF diferente do titular da UC)
- **Beneficiário**: Tem registro ativo na tabela `beneficiarios`
- **Superadmin**: Flag manual no banco (`is_superadmin = true`)

#### Fluxos de Cadastro

**Fluxo 1: Cadastro Básico**
```
1. Usuário acessa /cadastro
2. Preenche: nome, email, CPF, telefone, senha
3. Sistema cria Usuario (sem perfil definido ainda)
4. Usuário loga e vai para dashboard vazio
5. Usuário vincula UCs via "Vincular Conta Energisa"
6. Fluxo SMS: CPF → Telefone → SMS → Seleciona UCs
7. Sistema detecta perfil automaticamente:
   - UC.is_geradora=true E UC.cpf_cnpj=user.cpf → PROPRIETÁRIO
   - UC.cpf_cnpj ≠ user.cpf → GESTOR
   - Senão → USUÁRIO FINAL
```

**Fluxo 2: Cadastro de Beneficiário**
```
1. Gestor acessa área de beneficiários
2. Clica "Adicionar Beneficiário"
3. Preenche: CPF, nome, email, telefone, UC, % rateio, % desconto
4. Sistema valida UC via Energisa
5. Sistema cria registro Beneficiario (status=PENDENTE)
6. Sistema cria Convite com token único
7. Email enviado para beneficiário com link
8. Beneficiário clica no link → /cadastro?convite=TOKEN
9. Beneficiário preenche apenas senha (dados já preenchidos)
10. Sistema cria Usuario, vincula ao Beneficiario, gera Contrato
11. Beneficiário assina contrato digitalmente
12. Status muda para ATIVO
```

**Regras Adicionais:**
- Gestor NÃO precisa de aprovação do Superadmin
- Proprietário é validado automaticamente via API Energisa
- Gestor pode gerenciar usinas de VÁRIOS proprietários diferentes
- Beneficiário PRECISA ter conta na plataforma

---

### Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODELO RELACIONAL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     Usuario      │       │   PerfilUsuario  │       │      Empresa     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │──┐    │ id (PK)          │       │ id (PK)          │
│ email            │  │    │ usuario_id (FK)  │◄──────│ proprietario_id  │
│ senha_hash       │  │    │ perfil (enum)    │       │ cnpj             │
│ nome_completo    │  └───►│ ativo            │       │ razao_social     │
│ cpf              │       │ dados_perfil_json│       │ nome_fantasia    │
│ telefone         │       │ criado_em        │       │ ...              │
│ is_superadmin    │       └──────────────────┘       └──────────────────┘
│ ativo            │                                           │
│ email_verificado │       ┌──────────────────┐                │
│ criado_em        │       │      Usina       │◄───────────────┘
└──────────────────┘       ├──────────────────┤
         │                 │ id (PK)          │
         │                 │ empresa_id (FK)  │
         │                 │ uc_geradora_id   │────────┐
         │                 │ nome             │        │
         │                 │ capacidade_kwp   │        │
         │                 │ tipo_geracao     │        │
         │                 │ status           │        │
         │                 │ desconto_padrao  │        │
         │                 └──────────────────┘        │
         │                          │                  │
         │                 ┌────────▼─────────┐        │
         │                 │  GestorUsina     │        │
         │                 ├──────────────────┤        │
         │                 │ id (PK)          │        │
         │                 │ usina_id (FK)    │        │
         │                 │ gestor_id (FK)   │◄───────┼──── Usuario
         │                 │ ativo            │        │
         │                 │ comissao_percent │        │
         │                 └──────────────────┘        │
         │                                             │
         │                 ┌────────────────────────┐        │
         └────────────────►│   UnidadeConsumid.     │◄───────┘
                           ├────────────────────────┤
                           │ id (PK)                │
                           │ usuario_id (FK)        │ (dono)
                           │ cod_empresa            │ (6=EMT)
                           │ cdc                    │ (numeroUc)
                           │ digito_verif           │
                           │ endereco               │
                           │ is_geradora            │
                           │ usuario_titular        │ (bool)
                           │ tipo_ligacao           │
                           │ dados_api_json         │
                           │ geradora_id (FK)       │──┐
                           │ percentual_rateio      │  │
                           │ saldo_acumulado        │  │
                           └────────────────────────┘◄─┘
                                    │
                           ┌────────▼─────────┐
                           │  Beneficiario    │
                           ├──────────────────┤
                           │ id (PK)          │
                           │ usuario_id (FK)  │──► Usuario
                           │ uc_id (FK)       │──► UnidadeConsumidora
                           │ usina_id (FK)    │──► Usina
                           │ contrato_id (FK) │──► Contrato
                           │ percentual       │
                           │ desconto         │
                           │ status           │
                           └──────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    Contrato      │       │    Cobranca      │       │    Convite       │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ tipo             │       │ beneficiario_id  │       │ email            │
│ parte_a_id       │       │ fatura_id (FK)   │       │ cpf              │
│ parte_b_id       │       │ valor_energia    │       │ uc_id (FK)       │
│ usina_id         │       │ valor_piso       │       │ usina_id (FK)    │
│ conteudo_html    │       │ valor_iluminacao │       │ gestor_id (FK)   │
│ assinado_a_em    │       │ valor_total      │       │ token            │
│ assinado_b_em    │       │ vencimento       │       │ status           │
│ status           │       │ status           │       │ expira_em        │
│ vigencia_inicio  │       │ pago_em          │       │ aceito_em        │
│ vigencia_fim     │       └──────────────────┘       └──────────────────┘
└──────────────────┘

┌────────────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│        Fatura          │   │      Saque       │   │   Notificacao    │
├────────────────────────┤   ├──────────────────┤   ├──────────────────┤
│ id (PK)                │   │ id (PK)          │   │ id (PK)          │
│ uc_id (FK)             │   │ usuario_id (FK)  │   │ usuario_id (FK)  │
│ numero_fatura          │   │ valor            │   │ tipo             │
│ mes_referencia         │   │ nf_path          │   │ titulo           │
│ ano_referencia         │   │ status           │   │ mensagem         │
│ valor_fatura           │   │ aprovado_por     │   │ lida             │
│ valor_liquido          │   │ aprovado_em      │   │ criado_em        │
│ consumo                │   └──────────────────┘   └──────────────────┘
│ vencimento             │
│ status_pagamento       │
│ pago_em                │
│ pdf_path               │
│ dados_api_json (FULL)  │  ← JSON completo da API
└────────────────────────┘

┌──────────────────┐       ┌──────────────────┐
│      Lead        │       │  ConfigPlataforma│
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ cpf              │       │ chave            │
│ nome             │       │ valor            │
│ telefone         │       │ tipo             │
│ email            │       │ descricao        │
│ dados_simulacao  │       │ atualizado_em    │
│ status           │       └──────────────────┘
│ usina_id (FK)    │
│ gestor_id (FK)   │
└──────────────────┘
```

---

### Tabelas PostgreSQL (Supabase)

> **IMPORTANTE**: Todas as tabelas abaixo são para PostgreSQL/Supabase.
> O banco SQLite anterior será descontinuado.

#### Convenções:
- `SERIAL` para IDs auto-incrementais
- `TIMESTAMPTZ` para datas com timezone
- `JSONB` para dados JSON (melhor performance que TEXT)
- `DECIMAL(10,2)` para valores monetários
- Índices criados para campos de busca frequente
- RLS (Row Level Security) será configurado no Supabase

---

#### 1. usuarios
```sql
-- Tabela principal de usuários (integrada com Supabase Auth)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,  -- Supabase Auth

    -- Dados pessoais
    nome_completo VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefone VARCHAR(20),

    -- Avatar e preferências
    avatar_url VARCHAR(500),
    preferencias JSONB DEFAULT '{}',

    -- Controle de acesso
    is_superadmin BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    email_verificado BOOLEAN DEFAULT FALSE,

    -- Timestamps
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    ultimo_acesso TIMESTAMPTZ
);

CREATE INDEX idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_auth_id ON usuarios(auth_id);
```

#### 2. perfis_usuario
```sql
-- Perfis disponíveis para cada usuário (um usuário pode ter múltiplos perfis)
CREATE TYPE perfil_tipo AS ENUM ('superadmin', 'proprietario', 'gestor', 'beneficiario', 'usuario', 'parceiro');

-- PERFIS:
-- superadmin    = Administrador da plataforma
-- proprietario  = Dono de usina geradora (GD)
-- gestor        = Gerencia usinas de terceiros (GD)
-- beneficiario  = Recebe créditos de energia (GD)
-- usuario       = Usuário comum (apenas visualiza suas UCs)
-- parceiro      = Integrador/empresa que vende projetos solares (Marketplace)

CREATE TABLE perfis_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    perfil perfil_tipo NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    dados_perfil JSONB DEFAULT '{}',

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(usuario_id, perfil)
);

CREATE INDEX idx_perfis_usuario_id ON perfis_usuario(usuario_id);
```

#### 3. tokens_energisa
```sql
-- Tokens de autenticação da Energisa (expira em 24h)
CREATE TABLE tokens_energisa (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    -- Tokens principais
    utk TEXT,                    -- User Token
    rtk TEXT,                    -- Request Token
    udk TEXT,                    -- User Data Key
    refresh_token TEXT,          -- Para renovação

    -- Cookies de sessão (todos os cookies como JSON)
    cookies JSONB,

    -- Controle de expiração
    expira_em TIMESTAMPTZ,       -- 24h após criação
    ultimo_uso TIMESTAMPTZ,
    renovacoes INTEGER DEFAULT 0,

    -- Status
    ativo BOOLEAN DEFAULT TRUE,
    erro_ultimo TEXT,
    requer_reautenticacao BOOLEAN DEFAULT FALSE,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(usuario_id)
);

CREATE INDEX idx_tokens_energisa_usuario ON tokens_energisa(usuario_id);
CREATE INDEX idx_tokens_energisa_expira ON tokens_energisa(expira_em);
```

#### 4. tokens_plataforma
```sql
-- Refresh tokens JWT da plataforma
CREATE TABLE tokens_plataforma (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    refresh_token TEXT NOT NULL UNIQUE,
    device_info VARCHAR(500),    -- User-Agent, IP, etc

    expira_em TIMESTAMPTZ NOT NULL,
    ultimo_uso TIMESTAMPTZ,
    revogado BOOLEAN DEFAULT FALSE,
    revogado_em TIMESTAMPTZ,

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tokens_plataforma_usuario ON tokens_plataforma(usuario_id);
CREATE INDEX idx_tokens_plataforma_token ON tokens_plataforma(refresh_token);
```

#### 5. unidades_consumidoras
```sql
-- Unidades Consumidoras (UCs) - baseado nos responses reais da API Energisa
CREATE TABLE unidades_consumidoras (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),

    -- ⭐ Identificação da UC (formato exibição: cod_empresa/cdc-digito_verificador)
    cod_empresa INTEGER NOT NULL DEFAULT 6,    -- codigoEmpresaWeb (6 = Energisa MT)
    cdc INTEGER NOT NULL,                       -- numeroUc (CDC)
    digito_verificador INTEGER NOT NULL,        -- digitoVerificador

    -- Dados do titular
    cpf_cnpj_titular VARCHAR(20),               -- CPF/CNPJ do titular real da UC
    nome_titular VARCHAR(200),                   -- Nome do titular
    usuario_titular BOOLEAN NOT NULL,            -- ⭐ true = dono, false = gestor

    -- Endereço
    endereco VARCHAR(300),
    numero_imovel VARCHAR(20),
    complemento VARCHAR(200),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    cep VARCHAR(10),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),

    -- Dados técnicos
    tipo_ligacao VARCHAR(20),                   -- MONOFASICO, BIFASICO, TRIFASICO
    classe_leitura VARCHAR(50),                 -- RESIDENCIAL, COMERCIAL, etc
    grupo_leitura VARCHAR(10),                  -- A, B
    numero_medidor VARCHAR(50),

    -- Status
    uc_ativa BOOLEAN DEFAULT TRUE,
    uc_cortada BOOLEAN DEFAULT FALSE,
    contrato_ativo BOOLEAN DEFAULT TRUE,
    baixa_renda BOOLEAN DEFAULT FALSE,

    -- GD (Geração Distribuída)
    is_geradora BOOLEAN DEFAULT FALSE,
    geradora_id INTEGER REFERENCES unidades_consumidoras(id),  -- Self-reference
    percentual_rateio DECIMAL(5, 2),            -- % de rateio na geradora
    saldo_acumulado INTEGER DEFAULT 0,          -- kWh acumulado

    -- Snapshot completo da API
    dados_api JSONB,
    ultima_sincronizacao TIMESTAMPTZ,

    -- Timestamps
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(cod_empresa, cdc, digito_verificador)
);

CREATE INDEX idx_uc_usuario ON unidades_consumidoras(usuario_id);
CREATE INDEX idx_uc_formato ON unidades_consumidoras(cod_empresa, cdc, digito_verificador);
CREATE INDEX idx_uc_geradora ON unidades_consumidoras(geradora_id);
CREATE INDEX idx_uc_is_geradora ON unidades_consumidoras(is_geradora);
```

#### 6. empresas
```sql
-- Empresas (proprietárias de usinas)
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    proprietario_id UUID NOT NULL REFERENCES usuarios(id),

    cnpj VARCHAR(18) UNIQUE,
    razao_social VARCHAR(200),
    nome_fantasia VARCHAR(200),
    inscricao_estadual VARCHAR(20),

    -- Endereço
    endereco VARCHAR(300),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    cep VARCHAR(10),

    -- Contato
    telefone VARCHAR(20),
    email VARCHAR(100),

    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_empresas_proprietario ON empresas(proprietario_id);
CREATE INDEX idx_empresas_cnpj ON empresas(cnpj);
```

#### 7. usinas
```sql
-- Usinas de geração distribuída
CREATE TABLE usinas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER REFERENCES empresas(id),
    uc_geradora_id INTEGER NOT NULL REFERENCES unidades_consumidoras(id),

    nome VARCHAR(200),
    capacidade_kwp DECIMAL(10, 2),              -- Capacidade em kWp
    tipo_geracao VARCHAR(50) DEFAULT 'SOLAR',   -- SOLAR, EOLICA, etc
    data_conexao DATE,

    -- Configurações
    desconto_padrao DECIMAL(5, 4) DEFAULT 0.30, -- 30% desconto padrão

    -- Status
    status VARCHAR(20) DEFAULT 'ATIVA',         -- ATIVA, INATIVA, PENDENTE

    -- Localização
    endereco VARCHAR(300),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usinas_empresa ON usinas(empresa_id);
CREATE INDEX idx_usinas_uc_geradora ON usinas(uc_geradora_id);
```

#### 8. gestores_usina
```sql
-- Relacionamento gestor <-> usina
CREATE TABLE gestores_usina (
    id SERIAL PRIMARY KEY,
    usina_id INTEGER NOT NULL REFERENCES usinas(id) ON DELETE CASCADE,
    gestor_id UUID NOT NULL REFERENCES usuarios(id),

    ativo BOOLEAN DEFAULT TRUE,
    comissao_percentual DECIMAL(5, 4) DEFAULT 0,  -- % de comissão
    contrato_id INTEGER,  -- FK será adicionada depois

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    desativado_em TIMESTAMPTZ,

    UNIQUE(usina_id, gestor_id)
);

CREATE INDEX idx_gestores_usina_usina ON gestores_usina(usina_id);
CREATE INDEX idx_gestores_usina_gestor ON gestores_usina(gestor_id);
```

#### 9. beneficiarios
```sql
-- Beneficiários de geração distribuída
CREATE TABLE beneficiarios (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),     -- NULL até criar conta
    uc_id INTEGER NOT NULL REFERENCES unidades_consumidoras(id),
    usina_id INTEGER NOT NULL REFERENCES usinas(id),
    contrato_id INTEGER,  -- FK será adicionada depois

    -- Dados cadastrais (preenchidos antes de criar conta)
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(200),
    email VARCHAR(100),
    telefone VARCHAR(20),

    -- Configurações do benefício
    percentual_rateio DECIMAL(5, 2) NOT NULL,   -- % do rateio
    desconto DECIMAL(5, 4) NOT NULL,            -- % desconto oferecido

    -- Status
    status VARCHAR(20) DEFAULT 'PENDENTE',      -- PENDENTE, ATIVO, SUSPENSO, CANCELADO
    convite_enviado_em TIMESTAMPTZ,
    ativado_em TIMESTAMPTZ,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(uc_id, usina_id)
);

CREATE INDEX idx_beneficiarios_usuario ON beneficiarios(usuario_id);
CREATE INDEX idx_beneficiarios_uc ON beneficiarios(uc_id);
CREATE INDEX idx_beneficiarios_usina ON beneficiarios(usina_id);
CREATE INDEX idx_beneficiarios_cpf ON beneficiarios(cpf);
```

#### 10. convites
```sql
-- Convites para beneficiários e gestores
CREATE TYPE convite_tipo AS ENUM ('BENEFICIARIO', 'GESTOR');
CREATE TYPE convite_status AS ENUM ('PENDENTE', 'ACEITO', 'EXPIRADO', 'CANCELADO');

CREATE TABLE convites (
    id SERIAL PRIMARY KEY,
    tipo convite_tipo NOT NULL,

    email VARCHAR(100) NOT NULL,
    cpf VARCHAR(14),
    nome VARCHAR(200),

    beneficiario_id INTEGER REFERENCES beneficiarios(id),
    usina_id INTEGER REFERENCES usinas(id),
    convidado_por_id UUID NOT NULL REFERENCES usuarios(id),

    token VARCHAR(100) UNIQUE NOT NULL,
    expira_em TIMESTAMPTZ NOT NULL,

    status convite_status DEFAULT 'PENDENTE',
    aceito_em TIMESTAMPTZ,
    usuario_criado_id UUID REFERENCES usuarios(id),

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_convites_token ON convites(token);
CREATE INDEX idx_convites_email ON convites(email);
```

#### 11. contratos
```sql
-- Contratos entre partes
CREATE TYPE contrato_tipo AS ENUM ('GESTOR_PROPRIETARIO', 'GESTOR_BENEFICIARIO', 'PROPRIETARIO_BENEFICIARIO');
CREATE TYPE contrato_status AS ENUM ('RASCUNHO', 'AGUARDANDO_ASSINATURA', 'ATIVO', 'EXPIRADO', 'CANCELADO');

CREATE TABLE contratos (
    id SERIAL PRIMARY KEY,
    tipo contrato_tipo NOT NULL,

    parte_a_id UUID NOT NULL REFERENCES usuarios(id),
    parte_b_id UUID NOT NULL REFERENCES usuarios(id),
    usina_id INTEGER REFERENCES usinas(id),
    beneficiario_id INTEGER REFERENCES beneficiarios(id),

    -- Documento
    template_id INTEGER,
    conteudo_html TEXT,
    hash_documento VARCHAR(64),

    -- Assinaturas
    assinado_a_em TIMESTAMPTZ,
    assinado_b_em TIMESTAMPTZ,
    ip_assinatura_a INET,
    ip_assinatura_b INET,

    -- Vigência
    status contrato_status DEFAULT 'RASCUNHO',
    vigencia_inicio DATE,
    vigencia_fim DATE,

    -- Valores do contrato
    percentual_rateio DECIMAL(5, 2),
    desconto DECIMAL(5, 4),
    comissao DECIMAL(5, 4),

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar FK nos gestores_usina e beneficiarios
ALTER TABLE gestores_usina ADD CONSTRAINT fk_gestores_contrato
    FOREIGN KEY (contrato_id) REFERENCES contratos(id);
ALTER TABLE beneficiarios ADD CONSTRAINT fk_beneficiarios_contrato
    FOREIGN KEY (contrato_id) REFERENCES contratos(id);

CREATE INDEX idx_contratos_parte_a ON contratos(parte_a_id);
CREATE INDEX idx_contratos_parte_b ON contratos(parte_b_id);
CREATE INDEX idx_contratos_usina ON contratos(usina_id);
```

#### 12. faturas
```sql
-- Faturas da Energisa (histórico completo - API só retorna 13 meses)
CREATE TABLE faturas (
    id SERIAL PRIMARY KEY,
    uc_id INTEGER NOT NULL REFERENCES unidades_consumidoras(id),

    -- Identificação (da API)
    numero_fatura BIGINT UNIQUE,                -- numeroFatura
    mes_referencia INTEGER NOT NULL,            -- mesReferencia (1-12)
    ano_referencia INTEGER NOT NULL,            -- anoReferencia

    -- Valores principais
    valor_fatura DECIMAL(10, 2) NOT NULL,       -- valorFatura
    valor_liquido DECIMAL(10, 2),               -- valorLiquido
    consumo INTEGER,                            -- consumo (kWh)
    leitura_atual INTEGER,                      -- leituraAtual
    leitura_anterior INTEGER,                   -- leituraAnterior
    media_consumo INTEGER,                      -- mediaConsumo
    quantidade_dias INTEGER,                    -- quantidadeDiaConsumo

    -- Impostos e taxas
    valor_iluminacao_publica DECIMAL(10, 2),   -- valorIluminacaoPublica
    valor_icms DECIMAL(10, 2),                 -- valorICMS
    bandeira_tarifaria VARCHAR(20),            -- bandeiraTarifaria

    -- Datas
    data_leitura DATE,                         -- dataLeitura
    data_vencimento DATE NOT NULL,             -- dataVencimento
    data_pagamento DATE,                       -- dataPagamento

    -- Status
    indicador_situacao INTEGER,                -- indicadorSituacao
    indicador_pagamento BOOLEAN,               -- indicadorPagamento
    situacao_pagamento VARCHAR(30),            -- situacaoPagamento ("Pendente", "Pago no prazo", etc)

    -- Detalhamento (campos do detalhamentoFatura)
    servico_distribuicao DECIMAL(10, 2),
    compra_energia DECIMAL(10, 2),
    servico_transmissao DECIMAL(10, 2),
    encargos_setoriais DECIMAL(10, 2),
    impostos_encargos DECIMAL(10, 2),

    -- PIX/Boleto
    qr_code_pix TEXT,                          -- qrCodePix
    codigo_barras VARCHAR(100),                -- codigoBarra

    -- PDF
    pdf_path VARCHAR(500),
    pdf_baixado_em TIMESTAMPTZ,

    -- ⭐ JSON completo da API (GUARDAR TUDO para histórico permanente)
    dados_api JSONB NOT NULL,

    -- Controle
    sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(uc_id, mes_referencia, ano_referencia)
);

CREATE INDEX idx_faturas_uc ON faturas(uc_id);
CREATE INDEX idx_faturas_referencia ON faturas(ano_referencia, mes_referencia);
CREATE INDEX idx_faturas_vencimento ON faturas(data_vencimento);
CREATE INDEX idx_faturas_numero ON faturas(numero_fatura);
```

#### 13. historico_gd
```sql
-- Histórico de créditos GD (endpoint /gd/details)
CREATE TABLE historico_gd (
    id SERIAL PRIMARY KEY,
    uc_id INTEGER NOT NULL REFERENCES unidades_consumidoras(id),

    -- Referência
    mes_referencia INTEGER NOT NULL,
    ano_referencia INTEGER NOT NULL,

    -- Saldos e valores (campos do gd_details)
    saldo_anterior_conv INTEGER,               -- saldoAnteriorConv
    injetado_conv INTEGER,                     -- injetadoConv (energia gerada)
    total_recebido_rede INTEGER,               -- totalRecebidoRede
    consumo_recebido_conv INTEGER,             -- consumoRecebidoConv
    consumo_injetado_compensado INTEGER,       -- consumoInjetadoCompensadoConv
    consumo_transferido_conv INTEGER,          -- consumoTransferidoConv
    consumo_compensado_conv INTEGER,           -- consumoCompensadoConv
    saldo_compensado_anterior INTEGER,         -- saldoCompensadoAnteriorConv

    -- Composição da energia (JSON arrays)
    composicao_energia JSONB,                  -- composicaoEnergiaInjetadas
    discriminacao_energia JSONB,               -- discriminacaoEnergiaInjetadas

    -- Metadados
    chave_primaria VARCHAR(50),                -- chavePrimaria (ex: "4242904.2025.11")
    data_modificacao_registro TIMESTAMPTZ,     -- dataModificacaoRegistro

    -- ⭐ JSON completo da API
    dados_api JSONB NOT NULL,

    sincronizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(uc_id, mes_referencia, ano_referencia)
);

CREATE INDEX idx_historico_gd_uc ON historico_gd(uc_id);
CREATE INDEX idx_historico_gd_referencia ON historico_gd(ano_referencia, mes_referencia);
```

#### 14. cobrancas
```sql
-- Cobranças geradas para beneficiários
CREATE TYPE cobranca_status AS ENUM ('PENDENTE', 'PAGA', 'VENCIDA', 'CANCELADA');

CREATE TABLE cobrancas (
    id SERIAL PRIMARY KEY,
    beneficiario_id INTEGER NOT NULL REFERENCES beneficiarios(id),
    fatura_id INTEGER REFERENCES faturas(id),

    mes INTEGER NOT NULL,
    ano INTEGER NOT NULL,

    -- Valores calculados
    kwh_creditado INTEGER NOT NULL,
    tarifa_energisa DECIMAL(10, 6) NOT NULL,
    desconto_aplicado DECIMAL(5, 4) NOT NULL,

    valor_energia DECIMAL(10, 2) NOT NULL,
    valor_piso DECIMAL(10, 2) NOT NULL,
    valor_iluminacao DECIMAL(10, 2) NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    valor_sem_desconto DECIMAL(10, 2),
    economia DECIMAL(10, 2),

    -- Pagamento
    vencimento DATE NOT NULL,
    status cobranca_status DEFAULT 'PENDENTE',
    pago_em TIMESTAMPTZ,
    forma_pagamento VARCHAR(20),
    comprovante_path VARCHAR(500),

    -- Boleto/PIX
    codigo_barras VARCHAR(100),
    pix_copia_cola TEXT,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(beneficiario_id, mes, ano)
);

CREATE INDEX idx_cobrancas_beneficiario ON cobrancas(beneficiario_id);
CREATE INDEX idx_cobrancas_vencimento ON cobrancas(vencimento);
CREATE INDEX idx_cobrancas_status ON cobrancas(status);
```

#### 15. saques
```sql
-- Solicitações de saque
CREATE TYPE saque_status AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'PAGO');

CREATE TABLE saques (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),

    valor DECIMAL(10, 2) NOT NULL,

    -- Dados bancários
    banco VARCHAR(100),
    agencia VARCHAR(10),
    conta VARCHAR(20),
    tipo_conta VARCHAR(20),
    pix_chave VARCHAR(100),

    -- Nota fiscal
    nf_numero VARCHAR(50),
    nf_path VARCHAR(500),
    nf_validada BOOLEAN DEFAULT FALSE,

    -- Status
    status saque_status DEFAULT 'PENDENTE',
    aprovado_por_id UUID REFERENCES usuarios(id),
    aprovado_em TIMESTAMPTZ,
    motivo_rejeicao TEXT,
    pago_em TIMESTAMPTZ,
    comprovante_path VARCHAR(500),

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saques_usuario ON saques(usuario_id);
CREATE INDEX idx_saques_status ON saques(status);
```

#### 16. notificacoes
```sql
-- Notificações do sistema
CREATE TYPE notificacao_tipo AS ENUM ('FATURA', 'CONTRATO', 'SAQUE', 'CONVITE', 'COBRANCA', 'GD', 'SISTEMA');

CREATE TABLE notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),

    tipo notificacao_tipo NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensagem TEXT,
    link VARCHAR(500),
    acao VARCHAR(50),

    -- Referência opcional a outra entidade
    referencia_tipo VARCHAR(50),
    referencia_id INTEGER,

    lida BOOLEAN DEFAULT FALSE,
    lida_em TIMESTAMPTZ,

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_lida ON notificacoes(usuario_id, lida);
```

#### 17. config_plataforma
```sql
-- Configurações globais da plataforma
CREATE TABLE config_plataforma (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'STRING',         -- STRING, NUMBER, BOOLEAN, JSON
    descricao TEXT,
    editavel BOOLEAN DEFAULT TRUE,

    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_por_id UUID REFERENCES usuarios(id)
);

-- Configurações iniciais
INSERT INTO config_plataforma (chave, valor, tipo, descricao) VALUES
('taxa_plataforma_percentual', '0.05', 'NUMBER', 'Taxa da plataforma sobre valor energia (5%)'),
('dias_vencimento_antes_energisa', '1', 'NUMBER', 'Dias antes do vencimento Energisa'),
('template_contrato_beneficiario', '', 'STRING', 'Template HTML do contrato'),
('notificacao_vencimento_dias', '5', 'NUMBER', 'Dias antes para notificar vencimento');
```

#### 18. leads
```sql
-- Leads capturados da landing page (simulação)
CREATE TYPE lead_status AS ENUM ('NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO', 'PERDIDO');

CREATE TABLE leads (
    id SERIAL PRIMARY KEY,

    -- Dados do lead
    cpf VARCHAR(14),
    nome VARCHAR(200),
    email VARCHAR(100),
    telefone VARCHAR(20),

    -- Dados da simulação
    consumo_medio INTEGER,                   -- kWh médio informado
    valor_conta_media DECIMAL(10, 2),        -- Valor médio da conta
    tipo_ligacao VARCHAR(20),                -- MONOFASICO, BIFASICO, TRIFASICO
    cidade VARCHAR(100),
    uf VARCHAR(2),

    -- Resultado da simulação (JSON)
    dados_simulacao JSONB,

    -- Atribuição
    usina_id INTEGER REFERENCES usinas(id),
    gestor_id UUID REFERENCES usuarios(id),

    -- Status e acompanhamento
    status lead_status DEFAULT 'NOVO',
    origem VARCHAR(50),                       -- landing_page, indicacao, etc
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Histórico de interações (JSON array)
    interacoes JSONB DEFAULT '[]',

    convertido_em TIMESTAMPTZ,
    usuario_convertido_id UUID REFERENCES usuarios(id),

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_cpf ON leads(cpf);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_gestor ON leads(gestor_id);
```

---

### 🏪 MÓDULO MARKETPLACE & GESTÃO DE PROJETOS

> Este módulo transforma a plataforma em um ecossistema completo para o setor solar,
> permitindo que parceiros/integradores vendam projetos e gerenciem todo o ciclo de venda.

#### 19. parceiros
```sql
-- Parceiros/Integradores que vendem projetos solares
CREATE TYPE parceiro_status AS ENUM ('PENDENTE', 'ATIVO', 'SUSPENSO', 'INATIVO');

CREATE TABLE parceiros (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),  -- Usuário responsável

    -- Dados da empresa
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    razao_social VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    inscricao_estadual VARCHAR(20),

    -- Endereço
    endereco VARCHAR(300),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    cep VARCHAR(10),

    -- Contato
    telefone VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(200),

    -- Configurações
    logo_url VARCHAR(500),
    descricao TEXT,
    areas_atuacao JSONB,                     -- ["MT", "MS", "GO"]
    tipos_projeto JSONB,                      -- ["residencial", "comercial", "industrial"]

    -- Financeiro
    comissao_plataforma DECIMAL(5, 4) DEFAULT 0.05,  -- 5% padrão
    dados_bancarios JSONB,

    -- Status
    status parceiro_status DEFAULT 'PENDENTE',
    aprovado_por_id UUID REFERENCES usuarios(id),
    aprovado_em TIMESTAMPTZ,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parceiros_usuario ON parceiros(usuario_id);
CREATE INDEX idx_parceiros_cnpj ON parceiros(cnpj);
CREATE INDEX idx_parceiros_status ON parceiros(status);
```

#### 20. equipe_parceiro
```sql
-- Membros da equipe do parceiro
CREATE TYPE membro_papel AS ENUM ('ADMIN', 'VENDEDOR', 'TECNICO', 'FINANCEIRO', 'VISUALIZADOR');

CREATE TABLE equipe_parceiro (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),

    papel membro_papel NOT NULL,
    permissoes JSONB DEFAULT '{}',           -- Permissões específicas

    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(parceiro_id, usuario_id)
);

CREATE INDEX idx_equipe_parceiro ON equipe_parceiro(parceiro_id);
CREATE INDEX idx_equipe_usuario ON equipe_parceiro(usuario_id);
```

#### 21. produtos_marketplace
```sql
-- Produtos anunciados no marketplace
CREATE TYPE produto_tipo AS ENUM ('PROJETO_SOLAR', 'ENERGIA_COMPARTILHADA', 'KIT_EQUIPAMENTOS', 'SERVICO');
CREATE TYPE produto_status AS ENUM ('RASCUNHO', 'PENDENTE', 'ATIVO', 'PAUSADO', 'REPROVADO', 'VENDIDO');

CREATE TABLE produtos_marketplace (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id),

    -- Identificação
    tipo produto_tipo NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    slug VARCHAR(200) UNIQUE,

    -- Para PROJETO_SOLAR
    potencia_kwp DECIMAL(10, 2),             -- Potência do sistema
    producao_estimada INTEGER,                -- kWh/mês estimados
    economia_estimada DECIMAL(10, 2),         -- R$/mês economia

    -- Para ENERGIA_COMPARTILHADA
    usina_id INTEGER REFERENCES usinas(id),
    desconto_oferecido DECIMAL(5, 4),
    kwh_disponiveis INTEGER,

    -- Preço
    preco DECIMAL(12, 2),
    preco_kwp DECIMAL(10, 2),                 -- Preço por kWp
    aceita_financiamento BOOLEAN DEFAULT TRUE,
    parcelas_max INTEGER DEFAULT 60,

    -- Mídia
    imagens JSONB DEFAULT '[]',               -- URLs das imagens
    video_url VARCHAR(500),
    documentos JSONB DEFAULT '[]',            -- PDFs, datasheet

    -- Localização (para projetos)
    cidade VARCHAR(100),
    uf VARCHAR(2),
    cep VARCHAR(10),

    -- Status e aprovação
    status produto_status DEFAULT 'RASCUNHO',
    aprovado_por_id UUID REFERENCES usuarios(id),
    aprovado_em TIMESTAMPTZ,
    motivo_reprovacao TEXT,

    -- Métricas
    visualizacoes INTEGER DEFAULT 0,
    leads_gerados INTEGER DEFAULT 0,

    -- Destaque
    destaque BOOLEAN DEFAULT FALSE,
    destaque_ate TIMESTAMPTZ,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_produtos_parceiro ON produtos_marketplace(parceiro_id);
CREATE INDEX idx_produtos_tipo ON produtos_marketplace(tipo);
CREATE INDEX idx_produtos_status ON produtos_marketplace(status);
CREATE INDEX idx_produtos_uf ON produtos_marketplace(uf);
CREATE INDEX idx_produtos_destaque ON produtos_marketplace(destaque) WHERE destaque = TRUE;
```

#### 22. kanban_pipelines
```sql
-- Pipelines customizáveis (cada parceiro pode criar seus próprios)
CREATE TABLE kanban_pipelines (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,

    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    padrao BOOLEAN DEFAULT FALSE,            -- Pipeline padrão do parceiro

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(parceiro_id, nome)
);

CREATE INDEX idx_pipelines_parceiro ON kanban_pipelines(parceiro_id);
```

#### 23. kanban_colunas
```sql
-- Colunas/etapas do pipeline (totalmente customizáveis)
CREATE TABLE kanban_colunas (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER NOT NULL REFERENCES kanban_pipelines(id) ON DELETE CASCADE,

    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    cor VARCHAR(7) DEFAULT '#3b82f6',        -- Cor hex
    icone VARCHAR(50),

    ordem INTEGER NOT NULL,                   -- Ordem de exibição
    limite_cards INTEGER,                     -- WIP limit (opcional)

    -- Ações automáticas
    automacoes JSONB DEFAULT '{}',           -- Ex: enviar email, notificar

    criado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(pipeline_id, ordem)
);

CREATE INDEX idx_colunas_pipeline ON kanban_colunas(pipeline_id);
```

#### 24. formularios_dinamicos
```sql
-- Formulários customizáveis por etapa/coluna
CREATE TABLE formularios_dinamicos (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    coluna_id INTEGER REFERENCES kanban_colunas(id) ON DELETE SET NULL,

    nome VARCHAR(100) NOT NULL,
    descricao TEXT,

    -- Campos do formulário (JSON Schema)
    campos JSONB NOT NULL,
    /*
    Exemplo de campos:
    [
        {
            "id": "nome_cliente",
            "tipo": "text",
            "label": "Nome do Cliente",
            "obrigatorio": true,
            "placeholder": "Digite o nome completo"
        },
        {
            "id": "consumo_medio",
            "tipo": "number",
            "label": "Consumo Médio (kWh)",
            "obrigatorio": true,
            "min": 0
        },
        {
            "id": "tipo_telhado",
            "tipo": "select",
            "label": "Tipo de Telhado",
            "opcoes": ["Cerâmico", "Metálico", "Fibrocimento", "Laje"]
        },
        {
            "id": "fotos_local",
            "tipo": "file",
            "label": "Fotos do Local",
            "multiplo": true,
            "aceita": ["image/*"]
        }
    ]
    */

    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_formularios_parceiro ON formularios_dinamicos(parceiro_id);
CREATE INDEX idx_formularios_coluna ON formularios_dinamicos(coluna_id);
```

#### 25. projetos
```sql
-- Projetos solares em andamento
CREATE TYPE projeto_status AS ENUM (
    'LEAD', 'QUALIFICADO', 'ORCAMENTO', 'PROPOSTA', 'NEGOCIACAO',
    'VENDA', 'DOCUMENTACAO', 'INSTALACAO', 'HOMOLOGACAO', 'CONCLUIDO',
    'PERDIDO', 'CANCELADO'
);

CREATE TABLE projetos (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id),
    pipeline_id INTEGER NOT NULL REFERENCES kanban_pipelines(id),
    coluna_id INTEGER NOT NULL REFERENCES kanban_colunas(id),
    produto_id INTEGER REFERENCES produtos_marketplace(id),

    -- Origem
    lead_id INTEGER REFERENCES leads(id),
    origem VARCHAR(50),                       -- marketplace, indicacao, landing_page

    -- Cliente
    cliente_nome VARCHAR(200) NOT NULL,
    cliente_cpf_cnpj VARCHAR(18),
    cliente_email VARCHAR(100),
    cliente_telefone VARCHAR(20),
    cliente_endereco VARCHAR(300),
    cliente_cidade VARCHAR(100),
    cliente_uf VARCHAR(2),
    cliente_cep VARCHAR(10),

    -- Dados técnicos do projeto
    potencia_kwp DECIMAL(10, 2),
    producao_estimada INTEGER,
    consumo_medio INTEGER,
    tipo_instalacao VARCHAR(50),              -- Residencial, Comercial, Rural
    tipo_telhado VARCHAR(50),
    area_disponivel DECIMAL(10, 2),

    -- Equipamentos (JSON)
    equipamentos JSONB,
    /*
    {
        "modulos": { "marca": "Canadian", "modelo": "CS6W-550MB-AG", "quantidade": 10 },
        "inversor": { "marca": "Growatt", "modelo": "MIN 5000TL-X", "quantidade": 1 },
        "estrutura": { "tipo": "Perfil de alumínio", "quantidade": 10 }
    }
    */

    -- Valores
    valor_total DECIMAL(12, 2),
    custo_equipamentos DECIMAL(12, 2),
    custo_instalacao DECIMAL(12, 2),
    margem DECIMAL(12, 2),
    desconto DECIMAL(10, 2),
    valor_final DECIMAL(12, 2),

    -- Financiamento
    financiado BOOLEAN DEFAULT FALSE,
    banco_financiamento VARCHAR(100),
    parcelas INTEGER,
    valor_parcela DECIMAL(10, 2),
    taxa_juros DECIMAL(5, 4),

    -- Status
    status projeto_status DEFAULT 'LEAD',
    probabilidade INTEGER DEFAULT 50,         -- % de chance de fechar

    -- Responsáveis
    vendedor_id UUID REFERENCES usuarios(id),
    tecnico_id UUID REFERENCES usuarios(id),

    -- Datas importantes
    data_visita TIMESTAMPTZ,
    data_proposta TIMESTAMPTZ,
    data_venda TIMESTAMPTZ,
    data_instalacao_prevista DATE,
    data_instalacao_real DATE,
    data_homologacao DATE,
    previsao_conclusao DATE,

    -- Formulários preenchidos (respostas)
    formularios_dados JSONB DEFAULT '{}',

    -- Arquivos
    arquivos JSONB DEFAULT '[]',
    /*
    [
        { "tipo": "proposta", "url": "...", "nome": "Proposta_001.pdf" },
        { "tipo": "contrato", "url": "...", "nome": "Contrato_assinado.pdf" }
    ]
    */

    -- Observações
    observacoes TEXT,

    -- Comissão da plataforma
    comissao_plataforma DECIMAL(10, 2),
    comissao_paga BOOLEAN DEFAULT FALSE,
    comissao_paga_em TIMESTAMPTZ,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projetos_parceiro ON projetos(parceiro_id);
CREATE INDEX idx_projetos_pipeline ON projetos(pipeline_id);
CREATE INDEX idx_projetos_coluna ON projetos(coluna_id);
CREATE INDEX idx_projetos_status ON projetos(status);
CREATE INDEX idx_projetos_vendedor ON projetos(vendedor_id);
CREATE INDEX idx_projetos_cliente_cpf ON projetos(cliente_cpf_cnpj);
```

#### 26. projeto_historico
```sql
-- Histórico de movimentações do projeto
CREATE TABLE projeto_historico (
    id SERIAL PRIMARY KEY,
    projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id),

    -- Tipo de evento
    tipo VARCHAR(50) NOT NULL,               -- coluna_alterada, status_alterado, comentario, arquivo, etc
    descricao TEXT,

    -- Dados da alteração
    dados_anteriores JSONB,
    dados_novos JSONB,

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historico_projeto ON projeto_historico(projeto_id);
CREATE INDEX idx_historico_criado ON projeto_historico(criado_em);
```

#### 27. projeto_tarefas
```sql
-- Tarefas/atividades do projeto
CREATE TYPE tarefa_status AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');
CREATE TYPE tarefa_prioridade AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

CREATE TABLE projeto_tarefas (
    id SERIAL PRIMARY KEY,
    projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,

    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    prioridade tarefa_prioridade DEFAULT 'MEDIA',

    responsavel_id UUID REFERENCES usuarios(id),
    data_vencimento DATE,

    status tarefa_status DEFAULT 'PENDENTE',
    concluida_em TIMESTAMPTZ,
    concluida_por_id UUID REFERENCES usuarios(id),

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tarefas_projeto ON projeto_tarefas(projeto_id);
CREATE INDEX idx_tarefas_responsavel ON projeto_tarefas(responsavel_id);
CREATE INDEX idx_tarefas_status ON projeto_tarefas(status);
```

#### 28. transacoes_marketplace
```sql
-- Transações financeiras do marketplace
CREATE TYPE transacao_tipo AS ENUM ('VENDA', 'COMISSAO', 'REPASSE', 'ESTORNO');
CREATE TYPE transacao_status AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHOU', 'ESTORNADA');

CREATE TABLE transacoes_marketplace (
    id SERIAL PRIMARY KEY,
    projeto_id INTEGER REFERENCES projetos(id),
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id),

    tipo transacao_tipo NOT NULL,
    valor DECIMAL(12, 2) NOT NULL,
    descricao TEXT,

    -- Para comissões
    percentual_comissao DECIMAL(5, 4),
    valor_base DECIMAL(12, 2),

    status transacao_status DEFAULT 'PENDENTE',
    processado_em TIMESTAMPTZ,
    comprovante_url VARCHAR(500),

    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transacoes_projeto ON transacoes_marketplace(projeto_id);
CREATE INDEX idx_transacoes_parceiro ON transacoes_marketplace(parceiro_id);
CREATE INDEX idx_transacoes_status ON transacoes_marketplace(status);
```

---

### Função de Detecção de Perfil

```python
def detectar_perfis(usuario_id: UUID) -> list[str]:
    """
    Detecta automaticamente os perfis disponíveis para o usuário
    baseado nas UCs vinculadas, participação em parceiros e beneficiários

    PERFIS (6 tipos):
    - superadmin    → Flag manual no banco
    - proprietario  → Tem UC geradora + usuarioTitular=true
    - gestor        → Gerencia UC de terceiros (usuarioTitular=false)
    - beneficiario  → Registro ativo na tabela beneficiarios
    - usuario       → Todos começam com este perfil
    - parceiro      → Registro ativo na tabela parceiros ou equipe_parceiro
    """
    perfis = ['usuario']  # todo mundo começa como usuário

    usuario = get_usuario(usuario_id)
    ucs = get_ucs_do_usuario(usuario_id)

    # =============================================
    # PERFIS DE GD (Geração Distribuída)
    # =============================================
    for uc in ucs:
        # ⭐ REGRA BASEADA NO CAMPO usuarioTitular DA API
        # usuarioTitular = true → usuário é DONO da UC
        # usuarioTitular = false → usuário está GERENCIANDO (gestor)

        if uc.usuario_titular:
            # É dono da UC
            if uc.is_geradora:
                # É PROPRIETÁRIO se tem UC geradora em seu nome
                perfis.append('proprietario')
            # senão é só usuário final (já adicionado)
        else:
            # NÃO é titular, está gerenciando UC de terceiro
            perfis.append('gestor')

    # É beneficiário se tem registro ativo na tabela beneficiarios
    if has_beneficiario_ativo(usuario_id):
        perfis.append('beneficiario')

    # =============================================
    # PERFIL DE MARKETPLACE
    # =============================================
    # É parceiro se:
    # 1. É dono de uma empresa parceira (tabela parceiros)
    # 2. Faz parte da equipe de um parceiro (tabela equipe_parceiro)
    if is_parceiro(usuario_id) or is_membro_equipe_parceiro(usuario_id):
        perfis.append('parceiro')

    # =============================================
    # SUPERADMIN
    # =============================================
    # Flag manual no banco - não é detectado automaticamente
    if usuario.is_superadmin:
        perfis.append('superadmin')

    return list(set(perfis))


def is_parceiro(usuario_id: UUID) -> bool:
    """Verifica se usuário é dono de algum parceiro ativo"""
    return db.query(Parceiro).filter(
        Parceiro.usuario_id == usuario_id,
        Parceiro.status == 'ATIVO'
    ).count() > 0


def is_membro_equipe_parceiro(usuario_id: UUID) -> bool:
    """Verifica se usuário faz parte de alguma equipe de parceiro"""
    return db.query(EquipeParceiro).filter(
        EquipeParceiro.usuario_id == usuario_id,
        EquipeParceiro.ativo == True
    ).count() > 0


def formatar_uc(cod_empresa: int, cdc: int, digito_verificador: int) -> str:
    """
    Formata UC no padrão de exibição
    Exemplo: 6/4242904-3
    """
    return f"{cod_empresa}/{cdc}-{digito_verificador}"


def parse_uc(uc_formatada: str) -> tuple[int, int, int]:
    """
    Parse de UC formatada para seus componentes
    Exemplo: "6/4242904-3" -> (6, 4242904, 3)
    """
    empresa, resto = uc_formatada.split('/')
    cdc, dv = resto.split('-')
    return int(empresa), int(cdc), int(dv)
```

---

## 🚀 Roadmap de Implementação

---

### 📅 SPRINT 1: Infraestrutura Base

**Objetivo**: Preparar arquitetura modular e sistema de perfis

#### Backend
- [ ] Criar modelo `UserProfile` (relaciona user → perfis disponíveis)
- [ ] Endpoint `GET /api/user/profiles` (retorna perfis do usuário logado)
- [ ] Endpoint `POST /api/user/switch-profile` (troca perfil ativo)
- [ ] Middleware de permissões por perfil

#### Frontend
- [ ] Instalar `react-router-dom`
- [ ] Criar estrutura de pastas (`routes/`, `pages/`, `contexts/`)
- [ ] Criar `PerfilContext.tsx` (perfil ativo + troca)
- [ ] Criar `routes/index.tsx` (rotas principais)
- [ ] Criar `MainLayout.tsx` (estrutura base)
- [ ] Criar `ProfileSelector.tsx` ("Atuando como: [X]")
- [ ] Criar `SelecionarPerfilPage.tsx`

**Entregável**: Usuário loga → Seleciona perfil → Navega para dashboard correto

---

### 📅 SPRINT 2: Layout e Navegação

**Objetivo**: Interface funcional com menu adaptável por perfil

#### Frontend
- [ ] Criar `Sidebar.tsx` com menus por perfil
- [ ] Criar `Header.tsx` (logo, perfil, notificações, tema)
- [ ] Definir menus por perfil em `lib/navigation.ts`
- [ ] Implementar toggle de tema (dark/light)
- [ ] Refatorar `App.tsx` para usar BrowserRouter
- [ ] Criar `ProtectedRoute.tsx` (redireciona se não logado)

#### Componentes Base
- [ ] `MetricCard.tsx` (card de métrica genérico)
- [ ] `PageHeader.tsx` (título + breadcrumb)
- [ ] `LoadingSpinner.tsx`
- [ ] `EmptyState.tsx`

**Entregável**: Aplicação navegável com sidebar, header e troca de perfil funcional

---

### 📅 SPRINT 3: Perfil Usuário Final

**Objetivo**: Funcionalidades completas para usuário final (mais simples)

#### Backend
- [ ] Endpoint `GET /api/usuario/ucs` (lista UCs do usuário)
- [ ] Endpoint `GET /api/usuario/ucs/:id` (detalhes UC)
- [ ] Endpoint `GET /api/usuario/faturas` (faturas das UCs)
- [ ] Endpoint `GET /api/usuario/dashboard` (métricas resumo)

#### Frontend - Páginas
- [ ] `UsuarioDashboard.tsx` (resumo UCs, faturas pendentes)
- [ ] `MinhasUCsPage.tsx` (lista de UCs)
- [ ] `UCDetalhePage.tsx` (histórico, gráficos consumo)
- [ ] `FaturasPage.tsx` (lista faturas, download PDF)

#### Componentes
- [ ] `UCCard.tsx`
- [ ] `FaturasTable.tsx`
- [ ] `ConsumoChart.tsx` (gráfico de consumo mensal)

**Entregável**: Usuário Final consegue ver UCs, faturas e histórico de consumo

---

### 📅 SPRINT 4: Perfil Beneficiário

**Objetivo**: Beneficiário visualiza créditos e paga via plataforma

#### Backend
- [ ] Endpoint `GET /api/beneficiario/creditos` (créditos recebidos)
- [ ] Endpoint `GET /api/beneficiario/cobrancas` (cobranças da plataforma)
- [ ] Endpoint `GET /api/beneficiario/economia` (histórico economia)
- [ ] Endpoint `GET /api/beneficiario/contrato` (contrato ativo)
- [ ] Endpoint `GET /api/beneficiario/dashboard` (métricas resumo)

#### Frontend - Páginas
- [ ] `BeneficiarioDashboard.tsx` (créditos, economia, próximo pagamento)
- [ ] `MeusCreditosPage.tsx` (de qual usina, percentual)
- [ ] `PagamentosPage.tsx` (histórico pagamentos)
- [ ] `ContratoPage.tsx` (visualizar contrato)
- [ ] `EconomiaPage.tsx` (quanto economizou ao longo do tempo)

#### Componentes
- [ ] `CreditoCard.tsx` (mostra créditos de uma usina)
- [ ] `EconomiaChart.tsx` (gráfico economia mensal)
- [ ] `CobrancaCard.tsx` (cobrança pendente)

**Entregável**: Beneficiário vê créditos, economia e pode visualizar cobranças

---

### 📅 SPRINT 5: Perfil Gestor - Parte 1

**Objetivo**: Gestor gerencia usinas e beneficiários

#### Backend
- [ ] Endpoint `GET /api/gestor/usinas` (usinas gerenciadas)
- [ ] Endpoint `GET /api/gestor/usinas/:id` (detalhes usina)
- [ ] Endpoint `GET /api/gestor/beneficiarios` (todos beneficiários)
- [ ] Endpoint `POST /api/gestor/beneficiarios` (cadastrar beneficiário)
- [ ] Endpoint `PUT /api/gestor/beneficiarios/:id` (editar)
- [ ] Endpoint `DELETE /api/gestor/beneficiarios/:id` (remover)
- [ ] Endpoint `GET /api/gestor/dashboard` (métricas)

#### Frontend - Páginas
- [ ] `GestorDashboard.tsx` (resumo usinas, beneficiários, financeiro)
- [ ] `UsinasGerenciadasPage.tsx` (lista usinas)
- [ ] `UsinaDetalhePage.tsx` (detalhes + beneficiários)
- [ ] `BeneficiariosPage.tsx` (lista/cadastro/edição)

#### Componentes
- [ ] `UsinaCard.tsx`
- [ ] `BeneficiariosTable.tsx`
- [ ] `BeneficiarioForm.tsx` (modal cadastro/edição)
- [ ] `GDTree.tsx` (já existe - árvore de relacionamentos)

**Entregável**: Gestor gerencia usinas e cadastra/edita beneficiários

---

### 📅 SPRINT 6: Gestor - Rateio e Faturas

**Objetivo**: Gestor define rateio e visualiza faturas

#### Backend
- [ ] Endpoint `GET /api/gestor/rateio/:usina_id` (rateio atual)
- [ ] Endpoint `PUT /api/gestor/rateio/:usina_id` (atualizar rateio)
- [ ] Endpoint `GET /api/gestor/faturas` (faturas de todos beneficiários)
- [ ] Endpoint `GET /api/gestor/faturas/:id/pdf` (download PDF)
- [ ] Validação: soma percentuais não pode exceder 100%

#### Frontend - Páginas
- [ ] `RateioPage.tsx` (configurar percentuais por UC)
- [ ] `FaturasPage.tsx` (lista faturas, filtros, download)

#### Componentes
- [ ] `RateioForm.tsx` (formulário de rateio com validação)
- [ ] `RateioChart.tsx` (gráfico pizza do rateio)
- [ ] `FaturaModal.tsx` (detalhes fatura)

**Entregável**: Gestor configura rateio e visualiza faturas dos beneficiários

---

### 📅 SPRINT 7: Gestor - Financeiro e Contratos

**Objetivo**: Gestor vê saldo, solicita saque, gera contratos

#### Backend
- [ ] Endpoint `GET /api/gestor/financeiro` (saldo, extrato)
- [ ] Endpoint `POST /api/gestor/saques` (solicitar saque)
- [ ] Endpoint `GET /api/gestor/contratos` (lista contratos)
- [ ] Endpoint `POST /api/gestor/contratos` (gerar contrato)
- [ ] Endpoint `GET /api/gestor/contratos/:id/pdf` (download)
- [ ] Template de contrato (gestor ↔ beneficiário)

#### Frontend - Páginas
- [ ] `FinanceiroPage.tsx` (saldo, extrato, solicitar saque)
- [ ] `ContratosPage.tsx` (lista contratos, gerar novo)
- [ ] `CobrancasPage.tsx` (cobranças geradas)

#### Componentes
- [ ] `SaqueModal.tsx` (upload NF, valor)
- [ ] `ContratoCard.tsx`
- [ ] `ExtratoTable.tsx`
- [ ] `ContratoModal.tsx` (visualizar contrato)

**Entregável**: Gestor gerencia financeiro completo e contratos

---

### 📅 SPRINT 8: Perfil Proprietário

**Objetivo**: Proprietário gerencia usinas e contrata gestores

#### Backend
- [ ] Endpoint `GET /api/proprietario/usinas` (usinas próprias)
- [ ] Endpoint `POST /api/proprietario/usinas` (cadastrar usina)
- [ ] Endpoint `GET /api/proprietario/gestores` (gestores contratados)
- [ ] Endpoint `POST /api/proprietario/gestores/convidar` (enviar convite)
- [ ] Endpoint `GET /api/proprietario/financeiro`
- [ ] Endpoint `GET /api/proprietario/dashboard`

#### Frontend - Páginas
- [ ] `ProprietarioDashboard.tsx` (resumo usinas, produção, financeiro)
- [ ] `MinhasUsinasPage.tsx` (lista usinas próprias)
- [ ] `UsinaDetalhePage.tsx` (detalhes + gestores + beneficiários)
- [ ] `GestoresPage.tsx` (gestores contratados, convites)
- [ ] `FinanceiroPage.tsx` (quanto paga de taxa)
- [ ] `RelatoriosPage.tsx`

#### Componentes
- [ ] `UsinaForm.tsx` (cadastro/edição usina)
- [ ] `GestorCard.tsx`
- [ ] `ConviteGestorModal.tsx`
- [ ] `ProducaoChart.tsx` (produção vs distribuição)

**Entregável**: Proprietário cadastra usinas e gerencia gestores

---

### 📅 SPRINT 9: Perfil Superadmin - Parte 1

**Objetivo**: Admin gerencia usuários e vê visão geral

#### Backend
- [ ] Endpoint `GET /api/admin/usuarios` (todos usuários, paginado)
- [ ] Endpoint `PUT /api/admin/usuarios/:id` (editar/bloquear)
- [ ] Endpoint `GET /api/admin/usinas` (todas usinas)
- [ ] Endpoint `GET /api/admin/dashboard` (métricas globais)
- [ ] Endpoint `GET /api/admin/financeiro` (receita, kWh, inadimplência)

#### Frontend - Páginas
- [ ] `AdminDashboard.tsx` (visão 360º da plataforma)
- [ ] `UsuariosPage.tsx` (CRUD usuários, busca, filtros)
- [ ] `UsinasPlataformaPage.tsx` (todas usinas)
- [ ] `FinanceiroPage.tsx` (receita, projeção, inadimplência)

#### Componentes
- [ ] `UsuariosTable.tsx`
- [ ] `UsuarioModal.tsx` (editar usuário)
- [ ] `KPICard.tsx` (card KPI grande)

**Entregável**: Superadmin tem visão global de usuários, usinas e financeiro

---

### 📅 SPRINT 10: Superadmin - Saques e Configurações

**Objetivo**: Admin aprova saques e configura plataforma

#### Backend
- [ ] Endpoint `GET /api/admin/saques` (saques pendentes)
- [ ] Endpoint `PUT /api/admin/saques/:id/aprovar` (aprovar saque)
- [ ] Endpoint `PUT /api/admin/saques/:id/rejeitar` (rejeitar)
- [ ] Endpoint `GET /api/admin/config` (configurações)
- [ ] Endpoint `PUT /api/admin/config` (atualizar)
- [ ] Configurações: taxa por kWh, templates contrato, emails

#### Frontend - Páginas
- [ ] `SaquesPage.tsx` (lista saques pendentes, aprovar/rejeitar)
- [ ] `ConfigPage.tsx` (configurações da plataforma)

#### Componentes
- [ ] `SaquesTable.tsx`
- [ ] `SaqueAprovacaoModal.tsx` (ver NF, aprovar/rejeitar)
- [ ] `ConfigForm.tsx`

**Entregável**: Superadmin aprova saques e configura taxas/templates

---

### 📅 SPRINT 11: Sistema de Cobrança

**Objetivo**: Automatizar cobrança para beneficiários

#### Backend
- [ ] Criar modelo `Cobranca` (beneficiário, valor, vencimento, status)
- [ ] Job/Cron: gerar cobranças mensais automaticamente
- [ ] Endpoint `POST /api/cobrancas/gerar` (gerar cobranças manuais)
- [ ] Calcular cobrança conforme fórmula (desconto + piso + iluminação)
- [ ] Endpoint `PUT /api/cobrancas/:id/pagar` (marcar como paga)

#### Frontend
- [ ] Tela de cobrança no perfil Beneficiário (visualizar/pagar)
- [ ] Tela de cobranças no perfil Gestor (ver todas, status)
- [ ] Notificação de vencimento (5 dias antes, no dia)

#### Integração Futura
- [ ] Preparar estrutura para gateway de pagamento (PIX/Boleto)

**Entregável**: Sistema gera cobranças automáticas, beneficiários visualizam

---

### 📅 SPRINT 12: Contratos Digitais

**Objetivo**: Geração e assinatura de contratos

#### Backend
- [ ] Template de contrato em Markdown/HTML
- [ ] Endpoint `POST /api/contratos/gerar` (gera PDF a partir de template)
- [ ] Endpoint `POST /api/contratos/:id/assinar` (registra assinatura)
- [ ] Campos substituíveis: nome, CPF, valores, datas
- [ ] Armazenar contratos em storage (S3/local)

#### Frontend
- [ ] Visualizador de contrato (preview antes de assinar)
- [ ] Modal de assinatura (checkbox aceite + botão assinar)
- [ ] Download PDF do contrato assinado

**Entregável**: Contratos gerados automaticamente e assinados digitalmente

---

### 📅 SPRINT 13: Notificações e Relatórios

**Objetivo**: Sistema de notificações e relatórios exportáveis

#### Backend
- [ ] Modelo `Notificacao` (tipo, título, mensagem, lida)
- [ ] Endpoint `GET /api/notificacoes` (notificações do usuário)
- [ ] Endpoint `PUT /api/notificacoes/:id/ler` (marcar como lida)
- [ ] Job: enviar notificações (fatura vencendo, contrato expirando)
- [ ] Endpoints de relatório com filtros de data
- [ ] Exportação Excel/PDF

#### Frontend
- [ ] `NotificacoesPage.tsx` (central de notificações)
- [ ] Badge de notificações no Header
- [ ] Dropdown de notificações rápidas
- [ ] `RelatoriosPage.tsx` (filtros, preview, exportar)

**Entregável**: Notificações funcionais e relatórios exportáveis

---

### 📅 SPRINT 14: Marketplace e Simulador

**Objetivo**: Usuários simulam economia e veem ofertas

#### Backend
- [ ] Modelo `Produto` (usina, tipo, preço, descrição)
- [ ] Endpoint `GET /api/marketplace/produtos`
- [ ] Endpoint `POST /api/marketplace/interesse` (gera lead)
- [ ] Endpoint `POST /api/simulador/calcular` (simula economia)

#### Frontend - Páginas
- [ ] `MarketplacePage.tsx` (lista ofertas de energia)
- [ ] `SimuladorPage.tsx` (calculadora de economia)
- [ ] `LeadsPage.tsx` (admin - ver interessados)

#### Componentes
- [ ] `ProdutoCard.tsx`
- [ ] `SimuladorForm.tsx`
- [ ] `ResultadoSimulacao.tsx`

**Entregável**: Usuários simulam economia e demonstram interesse em ofertas

---

### 📅 SPRINT 15: Suporte e Polimento

**Objetivo**: Sistema de tickets e refinamentos finais

#### Backend
- [ ] Modelo `Ticket` (título, descrição, categoria, status)
- [ ] Endpoint `POST /api/suporte/tickets` (abrir ticket)
- [ ] Endpoint `GET /api/suporte/tickets` (meus tickets)
- [ ] Endpoint `GET /api/admin/suporte/tickets` (todos tickets)
- [ ] Endpoint `POST /api/suporte/tickets/:id/responder`

#### Frontend - Páginas
- [ ] `SuportePage.tsx` (abrir ticket, ver histórico)
- [ ] `SuporteAdminPage.tsx` (gerenciar tickets)
- [ ] FAQ estático

#### Polimento
- [ ] Testes de todas as rotas
- [ ] Testes de troca de perfil
- [ ] Responsividade mobile
- [ ] Loading states e error handling
- [ ] Remover código legado do App.tsx

**Entregável**: Suporte funcional e aplicação pronta para produção

---

### 📅 SPRINT 16: Integrações (Futuro)

**Objetivo**: Expandir para outras distribuidoras e automação

#### Gateway de Pagamento
- [ ] Integração Asaas/Stripe/PagSeguro
- [ ] Geração de boleto/PIX automático
- [ ] Webhook de confirmação de pagamento

#### Outras Distribuidoras
- [ ] Abstrair interface de distribuidora
- [ ] Implementar para CEMAT, Enel, etc.

#### Inversores Solares
- [ ] API para produção real-time
- [ ] Dashboard de produção em tempo real

#### Transferência Automática
- [ ] Integração bancária para saques
- [ ] Pagamento automático para gestores

**Entregável**: Plataforma escalável com múltiplas integrações

---

## 📊 Resumo do Roadmap

| Sprint | Foco | Páginas | Endpoints |
|--------|------|---------|-----------|
| 1 | Infraestrutura | 2 | 2 |
| 2 | Layout | 0 | 0 |
| 3 | Usuário Final | 4 | 4 |
| 4 | Beneficiário | 5 | 5 |
| 5 | Gestor (básico) | 4 | 7 |
| 6 | Gestor (rateio) | 2 | 4 |
| 7 | Gestor (financeiro) | 3 | 6 |
| 8 | Proprietário | 6 | 6 |
| 9 | Admin (básico) | 4 | 5 |
| 10 | Admin (saques) | 2 | 5 |
| 11 | Cobrança | 2 | 3 |
| 12 | Contratos | 1 | 3 |
| 13 | Notificações | 2 | 4 |
| 14 | Marketplace | 3 | 3 |
| 15 | Suporte | 2 | 4 |
| 16 | Integrações | - | - |

**Total**: ~42 páginas, ~61 endpoints

---

## 🎯 Priorização Sugerida

### MVP (Sprints 1-7)
Funcionalidade mínima para operar:
- Usuário Final, Beneficiário, Gestor funcionais
- Cobrança manual (sem gateway)
- Rateio e faturas

### V1.0 (Sprints 8-12)
Plataforma completa:
- Proprietário e Admin
- Contratos digitais
- Sistema de cobranças automático

### V1.5 (Sprints 13-15)
Polimento:
- Notificações
- Relatórios
- Suporte
- Marketplace básico

### V2.0 (Sprint 16+)
Escala:
- Pagamentos automáticos
- Outras distribuidoras
- Inversores em tempo real

---

## ✅ STATUS DE IMPLEMENTAÇÃO (Dezembro 2025)

### Backend - CONCLUÍDO ✅

**Módulos Implementados (12 módulos, ~120 endpoints):**

| Módulo | Status | Endpoints |
|--------|--------|-----------|
| **auth** | ✅ Completo | signup, signin, logout, refresh, me, perfis, update-profile, change-password |
| **ucs** | ✅ Completo | listar, minhas, buscar, cadastrar, vincular-energisa, sincronizar, faturas |
| **usinas** | ✅ Completo | listar, criar, buscar, atualizar, beneficiarios, estatisticas, dashboard |
| **beneficiarios** | ✅ Completo | listar, criar, buscar, atualizar, por-usina, meus, ativar, desativar |
| **faturas** | ✅ Completo | listar, buscar, por-uc, por-referencia, estatisticas, comparativo, historico-gd, sincronizar |
| **contratos** | ✅ Completo | listar, criar, buscar, atualizar, assinar, meus, por-usina, cancelar |
| **cobrancas** | ✅ Completo | listar, criar, buscar, minhas, pagar, cancelar, estatisticas |
| **saques** | ✅ Completo | listar, criar, buscar, meus, aprovar, rejeitar, pagar, saldo, comissoes |
| **leads** | ✅ Completo | captura (público), simular (público), listar, buscar, atualizar, converter, funil, estatisticas |
| **notificacoes** | ✅ Completo | listar, buscar, criar, marcar-lida, marcar-todas, contador, preferencias |
| **admin** | ✅ Completo | dashboard, stats, usuarios, configuracoes, logs, relatorios, integracoes, health |
| **energisa** | ✅ Completo | login, sms, validar-sms, ucs, faturas, gd-details |

**Arquitetura:**
- FastAPI + Python 3.13
- Supabase (PostgreSQL + Auth + Storage)
- JWT Authentication
- Row Level Security (RLS)
- 6 perfis de usuário com permissões

**Testes:**
- 66 testes passando
- 53 testes de autenticação (skipped sem credenciais)
- 0 falhas

**Banco de Dados:**
- 28+ tabelas criadas
- Enums configurados
- RLS policies implementadas
- Migrations em `supabase/migrations/`

### Frontend - EM DESENVOLVIMENTO 🔄

**Estrutura atual:**
- React + Vite + TypeScript
- Tailwind CSS configurado
- Supabase Client configurado
- Componentes base existentes

**Próximos passos:**
1. Integrar endpoints de autenticação
2. Implementar sistema de perfis
3. Criar dashboards por perfil
4. Implementar navegação e menus

---

## 📝 Notas Técnicas

### Stack Sugerida

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React + TypeScript + Tailwind |
| **Roteamento** | React Router v6 |
| **Estado** | Context API + React Query |
| **Backend** | FastAPI (Python) |
| **Banco** | PostgreSQL (produção) |
| **Pagamentos** | Stripe / Asaas / PagSeguro |
| **Assinatura** | DocuSign / Autentique / D4Sign |

### Segurança

- JWT com refresh token
- RBAC (Role-Based Access Control)
- Audit log de todas as ações
- Criptografia de dados sensíveis
- 2FA opcional

---

*Documento gerado em: Dezembro 2025*
*Versão: 1.0*
