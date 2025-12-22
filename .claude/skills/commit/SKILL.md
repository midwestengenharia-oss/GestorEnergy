---
name: commit
description: |
  Criar commits Git padronizados para o projeto GestorEnergy. Use quando o usuario pedir para fazer commit, salvar alteracoes, ou commitar mudancas. Segue o padrao Conventional Commits com prefixos feat/fix/docs/style/refactor/test/chore.
---

# Commit Padronizado

Criar commits seguindo Conventional Commits para o projeto GestorEnergy.

## Workflow

1. Verificar status do git:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" status --short
   ```

2. Ver diff das mudancas:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" diff --stat
   ```

3. Ver commits recentes para manter estilo:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" log --oneline -5
   ```

4. Adicionar arquivos relevantes:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" add <arquivos>
   ```

5. Criar commit com mensagem padronizada:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" commit -m "$(cat <<'EOF'
   <tipo>: <descricao curta>

   <corpo opcional com detalhes>

   Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

## Tipos de Commit

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correcao de bug |
| `docs` | Documentacao |
| `style` | Formatacao, espacos |
| `refactor` | Refatoracao sem mudanca de comportamento |
| `test` | Testes |
| `chore` | Build, config, deps |

## Regras

- Mensagem em portugues
- Primeira linha max 72 caracteres
- Usar imperativo: "adiciona", "corrige", "remove"
- Corpo opcional para detalhes
- NAO fazer push automaticamente (perguntar ao usuario)
- NAO usar `--amend` a menos que explicitamente solicitado
