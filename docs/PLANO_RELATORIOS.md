# PLANO DEFINITIVO: Sistema de Relatórios - PROJETO_ENERGISA

> Documento criado em: 2025-12-11

---

## DIAGNÓSTICO ATUAL

| Componente | Status | Observações |
|------------|--------|-------------|
| **ReportGeneratorV3** | ✅ Implementado | Gera HTML de cobranças individuais (profissional, PIX, comparativos) |
| **Admin Reports** | ⚠️ Parcial | Retorna JSON, falta PDF/XLSX/CSV |
| **Frontend relatorio.ts** | ⚠️ Isolado | Simulação/proposta, não integrado ao sistema principal |
| **Export PDF** | ❌ Faltando | Não há conversão HTML→PDF no backend |
| **Export XLSX/CSV** | ❌ Faltando | Não implementado |
| **Email Cobrança** | ⚠️ TODO | Estrutura existe, envio não implementado |
| **Relatórios Consolidados** | ❌ Faltando | Múltiplos beneficiários, usinas |

---

## PLANO DE IMPLEMENTAÇÃO

### FASE 1: Infraestrutura de Exportação
> Criar base para exportar relatórios em múltiplos formatos

**Tarefas:**
1. **Criar módulo `backend/reports/`** - Centralizar toda lógica de relatórios
   - `base.py` - Classe base abstrata para geradores
   - `html_generator.py` - Geração HTML (migrar ReportGeneratorV3)
   - `pdf_generator.py` - Conversão HTML→PDF (WeasyPrint ou html2pdf)
   - `excel_generator.py` - Geração XLSX (openpyxl)
   - `csv_generator.py` - Geração CSV

2. **Adicionar dependências:**
   ```
   weasyprint==60.1  # ou pdfkit
   openpyxl==3.1.2
   ```

3. **Criar endpoint genérico de exportação:**
   ```
   GET /api/relatorios/{tipo}/{id}/export?formato=pdf|xlsx|csv|html
   ```

---

### FASE 2: Relatórios de Cobrança
> Completar o fluxo de cobranças

**Tarefas:**
1. **PDF da Cobrança Individual**
   - Converter HTML existente (ReportGeneratorV3) para PDF
   - Endpoint: `GET /api/cobrancas/{id}/relatorio.pdf`

2. **Envio de Email**
   - Integrar SendGrid/AWS SES/SMTP
   - Anexar PDF ao email
   - Usar template HTML responsivo

3. **Relatório Consolidado por Usina**
   - Todas as cobranças do mês de uma usina
   - Totalização e resumo
   - Endpoint: `GET /api/usinas/{id}/cobrancas/relatorio?mes=12&ano=2025`

4. **Extrato do Beneficiário**
   - Histórico de cobranças
   - Economia acumulada
   - Gráfico de evolução
   - Endpoint: `GET /api/beneficiarios/{id}/extrato?periodo=12m`

---

### FASE 3: Relatórios Administrativos
> Expandir relatórios do admin

**Tarefas:**
1. **Exportação em múltiplos formatos**
   - Converter JSON existente para PDF/XLSX
   - Manter estrutura atual de `gerar_relatorio()`

2. **Novos tipos de relatório:**
   - **Inadimplência**: Cobranças vencidas, aging
   - **Performance de Usinas**: Geração vs consumo, eficiência
   - **Comparativo Mensal**: YoY, MoM
   - **DRE Simplificado**: Receitas vs despesas por usina

3. **Dashboard PDF**
   - Snapshot do dashboard em PDF
   - Para envio mensal automático

---

### FASE 4: Relatórios de Proposta/Simulação
> Integrar simulador existente

**Tarefas:**
1. **Migrar `relatorio.ts` para backend**
   - Buscar tarifas ANEEL no servidor
   - Gerar HTML profissional
   - Converter para PDF

2. **Endpoint de Simulação:**
   ```
   POST /api/simulacao/relatorio
   Body: { nome, consumo, tipo_ligacao, iluminacao, bandeiras }
   Response: { pdf_base64, html }
   ```

3. **Salvar simulações**
   - Tabela `simulacoes` para histórico
   - Converter lead em beneficiário

---

### FASE 5: Automação e Agendamento
> Envio automático de relatórios

**Tarefas:**
1. **Scheduler de Relatórios**
   - Envio mensal de extratos
   - Relatório semanal para gestores
   - Alertas de inadimplência

2. **Fila de Processamento**
   - Celery/RQ para geração assíncrona
   - Relatórios grandes em background

3. **Histórico de Relatórios Gerados**
   - Tabela `relatorios_gerados`
   - Log de envios e downloads

---

## ESTRUTURA DE ARQUIVOS PROPOSTA

```
backend/
├── reports/
│   ├── __init__.py
│   ├── base.py              # BaseReportGenerator
│   ├── html_generator.py    # HTML templates
│   ├── pdf_generator.py     # WeasyPrint conversion
│   ├── excel_generator.py   # openpyxl
│   ├── csv_generator.py     # CSV export
│   ├── email_sender.py      # Envio de emails
│   ├── templates/           # Templates HTML
│   │   ├── cobranca.html
│   │   ├── extrato.html
│   │   ├── consolidado.html
│   │   └── proposta.html
│   ├── generators/
│   │   ├── cobranca_report.py
│   │   ├── extrato_report.py
│   │   ├── usina_report.py
│   │   ├── admin_report.py
│   │   └── proposta_report.py
│   ├── router.py            # Endpoints centralizados
│   ├── service.py           # Lógica de negócio
│   └── schemas.py           # Pydantic models
```

---

## ENDPOINTS FINAIS

| Endpoint | Método | Descrição | Formatos |
|----------|--------|-----------|----------|
| `/api/cobrancas/{id}/relatorio` | GET | Relatório de cobrança | html, pdf |
| `/api/cobrancas/{id}/enviar-email` | POST | Envia cobrança por email | - |
| `/api/beneficiarios/{id}/extrato` | GET | Extrato do beneficiário | html, pdf, xlsx |
| `/api/usinas/{id}/relatorio` | GET | Relatório da usina | html, pdf, xlsx |
| `/api/usinas/{id}/cobrancas/consolidado` | GET | Cobranças consolidadas | html, pdf, xlsx |
| `/api/admin/relatorios/export` | POST | Relatórios admin | json, pdf, xlsx, csv |
| `/api/simulacao/relatorio` | POST | Proposta de economia | html, pdf |
| `/api/dashboard/export` | GET | Dashboard em PDF | pdf |

---

## PRIORIZAÇÃO SUGERIDA

| Prioridade | Item | Justificativa |
|------------|------|---------------|
| 🔴 Alta | PDF de Cobrança | Clientes precisam baixar/imprimir |
| 🔴 Alta | Envio de Email | Automação do fluxo de cobrança |
| 🟡 Média | Extrato Beneficiário | Transparência para clientes |
| 🟡 Média | Consolidado Usina | Gestão mensal |
| 🟢 Baixa | Simulação PDF | Marketing/Vendas |
| 🟢 Baixa | Agendamento | Automação avançada |

---

## DECISÕES TÉCNICAS PENDENTES

1. **Biblioteca PDF**: WeasyPrint vs pdfkit vs Playwright?
2. **Serviço de Email**: SendGrid vs AWS SES vs SMTP próprio?
3. **Fila de Processamento**: Celery vs RQ vs APScheduler?
4. **Armazenamento**: Salvar PDFs no Supabase Storage ou gerar on-demand?

---

## ARQUIVOS RELACIONADOS

- `backend/cobrancas/report_generator_v3.py` - Gerador HTML atual
- `backend/cobrancas/calculator.py` - Cálculos de cobrança
- `backend/cobrancas/service.py` - Serviço de cobranças
- `backend/admin/service.py` - Relatórios admin (JSON)
- `frontend/src/lib/relatorio.ts` - Simulação frontend
