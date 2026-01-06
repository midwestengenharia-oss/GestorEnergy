# API Samples - Amostras da API Energisa

> Diretório para armazenar amostras reais de retorno das APIs da Energisa.

## Propósito

Documentar os retornos reais da API Energisa para:
- Referência durante desenvolvimento
- Testes e mocks
- Entender estrutura de dados

## Como Capturar

### Via API (Produção)

```bash
# 1. Verificar se há sessão ativa
GET /api/debug/session-status/{cpf}

# 2. Capturar amostras
POST /api/debug/capture-api-samples
{
  "cpf": "12345678900",
  "salvar_arquivo": true
}
```

**Requer:** Usuário `superadmin` autenticado

### Categorias Capturadas

O sampler busca 1 amostra de cada combinação:

| Tipo GD | Ligação | Categoria |
|---------|---------|-----------|
| Sem GD | Monofásico | `sem_gd_monofasico` |
| Sem GD | Bifásico | `sem_gd_bifasico` |
| Sem GD | Trifásico | `sem_gd_trifasico` |
| Beneficiária | Monofásico | `gd_beneficiaria_monofasico` |
| Beneficiária | Bifásico | `gd_beneficiaria_bifasico` |
| Beneficiária | Trifásico | `gd_beneficiaria_trifasico` |
| Geradora | Monofásico | `gd_geradora_monofasico` |
| Geradora | Bifásico | `gd_geradora_bifasico` |
| Geradora | Trifásico | `gd_geradora_trifasico` |

### Dados Capturados por UC

Para cada UC selecionada:

1. **uc_raw** - Dados básicos da UC
2. **uc_info** - Dados cadastrais detalhados
3. **gd_info** - Informações de Geração Distribuída
4. **gd_details** - Histórico de créditos (se GD)
5. **faturas** - Lista de faturas + 1 exemplo

### Dados Removidos Automaticamente

- Tokens de autenticação
- Strings base64 (PDFs, imagens)
- Senhas e secrets

## Estrutura dos Arquivos

```
api-samples/
├── README.md
├── amostras_2026-01-06_14-30-00.json  # Captura completa
├── sem_gd_monofasico.json              # Amostra individual
└── ...
```

## Uso no Desenvolvimento

```python
import json

# Carregar amostra
with open("docs/api-samples/amostras_2026-01-06.json") as f:
    samples = json.load(f)

# Acessar categoria específica
gd_geradora = samples["amostras"]["gd_geradora_bifasico"]
print(gd_geradora["gd_details"])
```

## Observações

- **NÃO commitar dados sensíveis** - Arquivos são gitignored
- Amostras são sanitizadas automaticamente
- CPFs são mascarados nos logs
