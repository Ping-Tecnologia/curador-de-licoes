---
name: resumo-diario-conversas
description: Usar numa tarefa agendada (toda noite) para ler as conversas do dia com a IA e gravar um resumo só com decisões, correções, regras e caminhos de trabalho, que alimenta o Curador de Lições.
---

# Resumo diário das conversas

Rode uma vez por dia, no fim do expediente, numa sessão que tenha acesso ao histórico de conversas (ex.: ferramentas `recent_chats` / `read_conversation` do claude.ai) e a um lugar para gravar notas.

## Passos
1. Pegue a data de hoje no fuso da empresa.
2. Liste as conversas atualizadas hoje. Leia cada uma focando nos pedidos e respostas do dono (cerca de 30 turnos por conversa bastam).
3. Extraia só o que é **durável e de trabalho**: decisões, correções, regras de negócio, caminhos que funcionaram, preferências de formato.
4. Descarte: vida pessoal, projetos fora do negócio, senhas/chaves/tokens, documentos pessoais, dados de saúde, valores do dia e ideias não decididas.
5. Grave **uma** nota `conversas/AAAA-MM-DD.md`:

```markdown
---
name: conversas-AAAA-MM-DD
description: Decisões, regras e lições de trabalho das conversas de DD/MM/AAAA — fonte do Curador de Lições
tags: [conversas, aprendizado, curador]
---
# Conversas de DD/MM/AAAA

## <título curto da conversa>
- (DD/MM/AAAA) regra ou lição, uma por linha, dizendo o assunto.
```

6. Nada de trabalho hoje? Não grave nota (o Curador não roda e não gasta).
7. Falhou a leitura das conversas? Grave `conversas/_aviso-AAAA-MM-DD.md`. Arquivos que começam com `_` ou `00_` são ignorados pelo Curador.
