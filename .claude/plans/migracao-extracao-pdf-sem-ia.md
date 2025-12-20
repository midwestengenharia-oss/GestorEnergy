# Plano de Migração: Extração de PDF sem IA

## Contexto

### Sistema Atual
- **LLMWhisperer**: Extrai texto do PDF preservando layout (API paga, ~5-15s)
- **OpenAI GPT-4o-mini**: Parseia texto para JSON estruturado (API paga, ~5-20s)
- **Custo**: ~$0.02-0.03 por fatura
- **Latência**: 10-35 segundos por fatura

### Objetivo
Migrar para extração **determinística** (sem IA) usando pdfplumber + parsing estruturado.

### Benefícios Esperados
- **Custo**: $0 (vs ~$20-30/mês para 1000 faturas)
- **Latência**: ~100-500ms (vs 10-35s)
- **Disponibilidade**: Funciona offline, sem dependência de APIs externas
- **Consistência**: Resultados determinísticos, sem variação de IA

### Riscos
- Layout da Energisa pode mudar (requer manutenção)
- Diferentes tipos de fatura podem ter estruturas diferentes
- Casos edge não cobertos pelo parser determinístico

---

## Fases do Plano

### Fase 1: Análise e Validação (1-2 dias)
**Objetivo**: Confirmar viabilidade técnica com PDFs reais

#### 1.1 Coleta de Amostras
- [ ] Obter PDFs de diferentes tipos de UC (residencial, comercial, rural)
- [ ] Obter PDFs de diferentes grupos tarifários (A, B)
- [ ] Obter PDFs com e sem geração distribuída (GD)
- [ ] Obter PDFs de diferentes meses (verificar variações sazonais)

#### 1.2 Diagnóstico
- [ ] Executar `pdf_diagnostico.py` em todas as amostras
- [ ] Documentar viabilidade de cada tipo
- [ ] Identificar padrões comuns e variações

#### 1.3 Decisão Go/No-Go
- Se viabilidade ALTA em >80% das amostras → Prosseguir
- Se viabilidade MÉDIA → Avaliar complexidade adicional
- Se viabilidade BAIXA → Reavaliar abordagem ou manter LLM

---

### Fase 2: Desenvolvimento do Extrator (3-5 dias)
**Objetivo**: Implementar extrator template-based

#### 2.1 Estrutura do Novo Extrator
```
backend/faturas/
├── template_extractor.py      # NOVO: Extrator principal
├── template_regions.py        # NOVO: Definição de regiões/coordenadas
├── template_parsers.py        # NOVO: Parsers específicos por seção
├── pdf_extractor.py           # EXISTENTE: Manter como fallback
├── python_parser.py           # EXISTENTE: Pode ser reaproveitado
└── llm_extractor.py           # EXISTENTE: Manter para fallback
```

#### 2.2 Componentes a Implementar

**template_extractor.py**
```python
class EnergisaTemplateExtractor:
    """Extrator principal baseado em template"""

    def extrair(self, pdf_base64: str) -> FaturaExtraidaSchema:
        # 1. Abrir PDF com pdfplumber
        # 2. Identificar tipo de fatura (se houver variações)
        # 3. Extrair tabelas estruturadas
        # 4. Extrair texto de regiões específicas
        # 5. Montar schema de saída
        # 6. Validar dados básicos
        pass
```

**template_regions.py**
```python
class EnergisaLayoutV1:
    """Layout padrão das faturas Energisa (versão atual)"""

    # Regiões de texto (coordenadas ou âncoras)
    HEADER = {...}
    DADOS_CLIENTE = {...}
    DADOS_LEITURA = {...}
    TOTAIS = {...}

    # Identificadores de tabelas
    TABELA_ITENS_HEADER = ["Descrição", "Unid", "Quant", "Valor"]
    TABELA_LANCAMENTOS_HEADER = ["Descrição", "Valor"]
```

**template_parsers.py**
```python
class ItemFaturaParser:
    """Parser para linhas da tabela de itens"""

    def parse_linha(self, linha: list) -> dict:
        descricao = linha[0]

        # Classificar por tipo
        if "CONSUMO" in descricao.upper():
            return self._parse_consumo(linha)
        elif "INJETADA" in descricao.upper():
            return self._parse_energia_injetada(linha)
        # ...
```

#### 2.3 Testes Unitários
- [ ] Testes para cada tipo de item (consumo, injetada, lançamentos)
- [ ] Testes para diferentes layouts (se houver)
- [ ] Testes de comparação: resultado template vs resultado LLM

---

### Fase 3: Integração Paralela (2-3 dias)
**Objetivo**: Rodar ambos os métodos em paralelo para validação

#### 3.1 Modo Dual
Modificar `service.py` para executar AMBOS os extratores:

```python
async def processar_extracao_fatura(self, fatura_id: int) -> dict:
    # 1. Tentar extração por template (novo)
    try:
        dados_template = template_extractor.extrair(pdf_base64)
        metodo = "TEMPLATE"
    except Exception as e:
        logger.warning(f"Template falhou: {e}")
        dados_template = None

    # 2. Executar LLM como referência (temporário)
    try:
        dados_llm = llm_extractor.extrair(pdf_base64)
    except:
        dados_llm = None

    # 3. Comparar resultados
    if dados_template and dados_llm:
        discrepancias = self._comparar_extracoes(dados_template, dados_llm)
        if discrepancias:
            logger.warning(f"Discrepâncias: {discrepancias}")

    # 4. Usar template se disponível, senão LLM
    dados_final = dados_template or dados_llm

    # 5. Salvar com metadado do método usado
    self.db.table("faturas").update({
        "dados_extraidos": dados_final,
        "extracao_metodo": metodo,  # NOVO campo
        # ...
    })
```

#### 3.2 Métricas de Comparação
- [ ] Taxa de sucesso do template vs LLM
- [ ] Campos com discrepâncias frequentes
- [ ] Tempo de execução comparativo
- [ ] Score de validação comparativo

#### 3.3 Dashboard de Monitoramento
- Adicionar página para visualizar métricas de extração
- Alertas para discrepâncias significativas

---

### Fase 4: Migração Gradual (1-2 semanas)
**Objetivo**: Transição segura para o novo método

#### 4.1 Feature Flag
```python
# config.py
EXTRACAO_METODO = os.getenv("EXTRACAO_METODO", "LLM")  # LLM | TEMPLATE | DUAL
```

#### 4.2 Rollout Gradual
1. **Semana 1**: 10% das faturas usam template
2. **Semana 2**: 50% das faturas usam template
3. **Semana 3**: 100% template, LLM apenas como fallback
4. **Semana 4**: Remover LLM (opcional, pode manter como fallback)

#### 4.3 Critérios de Sucesso
- [ ] Taxa de sucesso ≥ 95%
- [ ] Score médio de validação ≥ 85
- [ ] Nenhuma discrepância crítica em campos financeiros
- [ ] Tempo de extração < 1 segundo

---

### Fase 5: Limpeza e Documentação (1-2 dias)
**Objetivo**: Finalizar migração

#### 5.1 Código
- [ ] Remover código LLM (ou mover para fallback)
- [ ] Atualizar imports e dependências
- [ ] Remover variáveis de ambiente não utilizadas

#### 5.2 Documentação
- [ ] Atualizar README com novo processo
- [ ] Documentar estrutura do layout Energisa
- [ ] Criar guia de manutenção (como ajustar se layout mudar)

#### 5.3 Monitoramento
- [ ] Configurar alertas para falhas de extração
- [ ] Dashboard de métricas de extração

---

## Plano de Rollback

Se a migração falhar:

1. **Imediato**: Mudar `EXTRACAO_METODO=LLM` no .env
2. **Análise**: Identificar causa das falhas
3. **Correção**: Ajustar template ou regras de parsing
4. **Retry**: Tentar novamente com correções

---

## Estimativa de Tempo

| Fase | Duração | Dependências |
|------|---------|--------------|
| 1. Análise | 1-2 dias | PDFs de amostra |
| 2. Desenvolvimento | 3-5 dias | Resultado da análise |
| 3. Integração | 2-3 dias | Código desenvolvido |
| 4. Migração | 1-2 semanas | Validação em produção |
| 5. Limpeza | 1-2 dias | Migração concluída |

**Total estimado**: 2-4 semanas

---

## Próximos Passos Imediatos

1. [ ] Você fornece PDFs de amostra
2. [ ] Executar diagnóstico e documentar resultados
3. [ ] Decisão Go/No-Go baseada no diagnóstico
4. [ ] Se Go: Iniciar Fase 2 (desenvolvimento)

---

## Aprovação

- [ ] Plano revisado e aprovado
- [ ] Recursos alocados
- [ ] Cronograma definido
