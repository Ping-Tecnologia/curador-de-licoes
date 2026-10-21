# 🧠 Curador de Lições

**Faça seus agentes de IA aprenderem com as conversas que você já tem com a IA.**

O dono do negócio passa o dia decidindo coisas no chat com a IA: "pedido não é faturamento", "tarefa de venda vai direto pro vendedor", "relatório começa pelo que exige ação". Essas decisões ficam perdidas na conversa, e os agentes automáticos da empresa continuam errando do mesmo jeito.

O **Curador de Lições** fecha esse ciclo. Toda noite, as conversas do dia viram um resumo só com o que é durável. De manhã, um agente curador lê esse resumo e entrega cada decisão, correção ou regra para a **memória do agente certo**.

Inspirado no ciclo de aprendizado do [Hermes Agent](https://hermes-agent.nousresearch.com/) (Nous Research) e nas skills abertas *reflect* e *extract-learnings*, só que pensado para um **time de agentes de empresa** em vez de um assistente pessoal.

> Nasceu no **Portal Ping**, a plataforma interna de agentes da **Ping Tecnologia e Segurança** (Dourados/MS, Brasil), onde roda em produção com 20+ agentes.
> Criado por **Eder Soffa** (Gerente Geral da Ping), construído junto com o **Claude** (Anthropic).

---

## A dor que resolve

| Sem o Curador | Com o Curador |
|---|---|
| Você explica a mesma regra várias vezes, em conversas diferentes | A regra dita uma vez vira **REGRA OBRIGATÓRIA** do agente que precisa dela |
| O agente repete o erro que você já corrigiu no chat | A correção chega na memória dele no dia seguinte |
| Agente roda todo dia em cima de uma fonte que morreu, gastando sua atenção | Ele mesmo pergunta: "fonte parada há 9 dias, pauso?" |
| A memória do agente só cresce e vira bagunça | Lição repetida com outras palavras não entra |

## Como funciona

```
 ┌──────────────────────┐   21:40   ┌───────────────────────────┐   06:50   ┌──────────────────────┐
 │ Conversas do dia     │ ────────► │ conversas/AAAA-MM-DD.md   │ ────────► │ 🧠 Curador de Lições │
 │ (chat com a IA)      │  resumo   │ só decisões, correções,   │  só roda  │ skill                │
 └──────────────────────┘  diário   │ regras e caminhos         │  se chegou│ minerar-conversas    │
                                    └───────────────────────────┘  arquivo  └──────────┬───────────┘
                                                                                       │ <licao-para agente="…" tipo="regra|licao">
          ┌────────────────────────────────────────────────────────────────────────────┼──────────────────┐
          ▼                                   ▼                                        ▼                  ▼
   Agente Financeiro                  Agente Comercial                         Agente Auditor      (sem agente → o
   memória: regras + lições           memória: regras + lições                 memória …           dono decide se cria)
          │
          └─► a cada execução: autorrevisão → <aprendizado> (o próprio agente anota o caminho que funcionou)
```

### As 4 peças

1. **Resumo diário das conversas** (`skills/resumo-diario-conversas`). Uma tarefa agendada lê as conversas do dia e grava uma nota só com o que é de trabalho e durável. Não entram vida pessoal, senhas, valores do dia nem ideias que não foram decididas.
2. **Curador de Lições** (`skills/minerar-conversas` + `src/curador.js`). Um agente que lê as notas novas e responde com blocos `<licao-para>`. O código distribui cada bloco para a memória do agente certo, sem repetir o que já está lá com outras palavras.
3. **Autorrevisão** (`blocoMemoria`). No fim de toda execução, cada agente anota uma lição quando aconteceu algo que vale guardar:
   - errou e corrigiu no caminho;
   - achou a fonte em outro lugar;
   - precisou de 5 ou mais passos para algo que poderia ser direto;
   - foi corrigido pela pessoa;
   - viu que uma lição antiga estava errada (`CORRIGE:`).
4. **Fonte parada** (`decisaoFonteParada`). É uma checagem sem IA: se o agente roda em cima de uma fonte que não muda há 7 dias ou mais, ele deixa **uma** decisão pronta: pausar, rodar semanal ou manter.

### Formato da memória

Uma linha por item, legível e editável por humanos:

```
- (2026-10-21, regra de Eder (conversa)) (21/10/2026) Pedido não é faturamento: só conta nota emitida.
- (2026-10-21, conversa) (21/10/2026) Propostas ficam em propostas/<cliente>/.
- (2026-10-19, auto) A coluna de vendedor no ERP é VEND_COD, não VENDEDOR.
```

| origem | quem escreveu | peso |
|---|---|---|
| `auto` | o próprio agente (autorrevisão) | lição: pode ser corrigida |
| `conversa` | Curador: caminho que funcionou ou preferência | lição |
| `regra de <dono> (conversa)` | Curador: decisão ou correção do dono | **obrigatória** |
| `regra de <pessoa>` | aprovação/recusa com motivo, 👎 com correção | **obrigatória** |

## Começando

Requer Node 18+. Sem dependências.

```bash
git clone https://github.com/Ping-Tecnologia/curador-de-licoes
cd curador-de-licoes
node examples/exemplo.js      # demonstração + testes
```

### Ligando na sua plataforma de agentes

```js
const curador = require('./src/curador');

// 1) No system prompt de TODO agente: memória + autorrevisão
systemPrompt += curador.blocoMemoria(agente.memoria, { skills: agente.skills });

// 2) Depois de cada execução: guarda o que ele aprendeu sozinho
const { texto, licoes } = curador.extrairAprendizado(resposta);
agente.memoria = curador.anexarMemoria(agente.memoria, licoes, 'auto').memoria;

// 3) No agente Curador (skill minerar-conversas no contexto):
systemPrompt += curador.promptCurador(meusAgentes);           // quem recebe
pedido += curador.arquivosNovos('./conversas', ultimaRodada).join('\n'); // o que ler
const r = curador.distribuir(respostaDoCurador, {
  listarAgentes: () => meusAgentes,                 // [{ nome, descricao }]
  lerMemoria: (nome) => banco.memoria(nome),
  gravarMemoria: (nome, texto) => banco.salvarMemoria(nome, texto),
}, { dono: 'Ana', tz: 'America/Sao_Paulo' });

// 4) No agendador, quando a pré-checagem pula o agente:
const decisao = curador.decisaoFonteParada(agente, ultimaMudancaDaFonte);
if (decisao) caixaDeAprovacao.registrar(decisao);
```

### Skills

As pastas em `skills/` seguem o formato aberto de skills (`SKILL.md` com `name` e `description`) e funcionam no Claude Code, no Claude.ai, no Hermes Agent ou em qualquer plataforma que carregue skills:

- `minerar-conversas`: o que vira lição, o que não vira, para quem mandar e o formato.
- `resumo-diario-conversas`: a rotina noturna que transforma as conversas do dia em nota.

## Boas práticas (aprendidas em produção)

- **Só o Curador grava na memória dos outros.** Os demais agentes só gravam na própria memória.
- **Decisão mais nova vence.** Uma lição com `SUBSTITUI:` troca a anterior.
- **Privacidade primeiro.** O resumo diário descarta vida pessoal, projetos fora do negócio, segredos e dados sensíveis antes de qualquer agente ver.
- **Custo zero quando nada mudou.** O Curador só chama a IA se chegou arquivo novo.
- **Tudo desfazível.** A memória é texto simples, então dá para apagar uma linha na tela do agente.

## English summary

**Lessons Curator** turns your everyday chats with an AI into durable memory for a *team* of business agents. A nightly job distills the day's conversations into decisions, corrections, business rules and working paths. Each morning, a curator agent routes each item to the right agent's memory, as an obligatory rule or as a lesson. Every agent also self-reviews after each run, and agents running on stale sources ask to be paused. The code is dependency-free Node.js, the skills follow the open `SKILL.md` format, and the license is MIT. Inspired by the learning loop of Nous Research's Hermes Agent.

## Autores

- **Eder Soffa**, Ping Tecnologia e Segurança: ideia, regras de negócio e uso em produção.
- **Claude** (Anthropic): arquitetura e código, construídos em conversa com o Eder.

## Licença

MIT. Veja [LICENSE](LICENSE).
