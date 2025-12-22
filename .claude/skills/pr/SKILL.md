---
name: pr
description: |
  Criar Pull Requests no GitHub. Use quando o usuario pedir para criar PR, abrir pull request, enviar para revisao, ou submeter mudancas para merge.
---

# Criar Pull Request

Criar PRs padronizados no GitHub para o projeto GestorEnergy.

## Workflow

1. Verificar branch atual e commits:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" status
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" log origin/main..HEAD --oneline
   ```

2. Verificar se ha commits para push:
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" log origin/main..HEAD --oneline
   ```

3. Push para remote (se necessario):
   ```bash
   git -C "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy" push -u origin <branch>
   ```

4. Criar PR com gh CLI:
   ```bash
   gh pr create --title "titulo" --body "$(cat <<'EOF'
   ## Summary
   - Ponto 1
   - Ponto 2

   ## Test plan
   - [ ] Teste 1
   - [ ] Teste 2

   Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

## Template de PR

```markdown
## Summary
<1-3 bullet points descrevendo as mudancas>

## Test plan
- [ ] Testes unitarios passando
- [ ] Build do frontend sem erros
- [ ] Testado manualmente em dev

## Screenshots (se aplicavel)
<capturas de tela das mudancas visuais>

Generated with [Claude Code](https://claude.com/claude-code)
```

## Comandos Uteis

```bash
# Ver PRs abertos
gh pr list

# Ver PR especifico
gh pr view <numero>

# Ver checks de CI
gh pr checks <numero>

# Merge PR
gh pr merge <numero>

# Fechar PR
gh pr close <numero>
```

## Boas Praticas

1. **Titulo claro**: Usar prefixo (feat, fix, docs, etc.)
2. **Descricao completa**: Explicar o que e por que
3. **PRs pequenos**: Maximo ~400 linhas alteradas
4. **Testes**: Incluir testes para novas features
5. **Screenshots**: Para mudancas visuais

## Branch Naming

- `feat/nome-feature` - Nova funcionalidade
- `fix/descricao-bug` - Correcao de bug
- `docs/descricao` - Documentacao
- `refactor/descricao` - Refatoracao
