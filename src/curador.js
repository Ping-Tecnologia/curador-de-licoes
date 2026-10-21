// Curador de Lições — núcleo sem dependências (Node 18+).
// Peças do ciclo de aprendizado "estilo Hermes" para qualquer plataforma de agentes:
//   1) autorrevisão: o agente anota <aprendizado> no fim de cada execução (gatilhos claros)
//   2) curador: lê conversas e entrega <licao-para agente="…" tipo="regra|licao"> ao agente certo
//   3) memória: uma linha por item "- (AAAA-MM-DD, origem) texto", sem repetir com outras palavras
//   4) fonte parada: agente que roda em cima de fonte que não muda há N dias vira uma decisão
// Você só precisa ligar 3 coisas da sua plataforma: ler/gravar a memória de um agente e listar os agentes.
'use strict';
const fs = require('fs');
const path = require('path');

const ORIGEM_REGRA = /regra de /i; // linhas com "regra de <quem>" são obrigatórias

function normalizar(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// "parecida" = 60%+ das palavras com 4+ letras iguais a uma linha que já existe
function palavras(t) { return new Set(normalizar(t).split(' ').filter((w) => w.length >= 4 && !/^\d+$/.test(w))); }
function parecidaComAlguma(licao, memoria) {
  const a = palavras(licao); if (a.size < 3) return false;
  return String(memoria || '').split(/\r?\n/).some((linha) => {
    const b = palavras(linha.replace(/^- \([^)]*\)\s*/, '')); if (b.size < 3) return false;
    let c = 0; a.forEach((w) => { if (b.has(w)) c += 1; });
    return c / Math.min(a.size, b.size) >= 0.6;
  });
}

function hoje(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * Acrescenta lições novas à memória (texto). Ignora repetidas e parecidas.
 * @returns {{memoria: string, novas: string[]}}
 */
function anexarMemoria(memoriaAtual, licoes, origem, opts) {
  const o = opts || {};
  const atual = String(memoriaAtual || '');
  const jaTem = normalizar(atual);
  const novas = (licoes || []).map((l) => String(l || '').replace(/^\s*[-*]\s*/, '').trim())
    .filter((l) => l.length >= 8 && l.length <= 600)
    .filter((l) => jaTem.indexOf(normalizar(l)) < 0)
    .filter((l) => !parecidaComAlguma(l, atual))
    .slice(0, o.max || 8);
  if (!novas.length) return { memoria: atual, novas: [] };
  const linhas = novas.map((l) => '- (' + hoje(o.tz) + ', ' + origem + ') ' + l).join('\n');
  return { memoria: (atual.trim() ? atual.trim() + '\n' : '') + linhas, novas };
}

/** Bloco de memória + instruções de autorrevisão para o system prompt do agente. */
function blocoMemoria(memoria, opts) {
  const o = opts || {};
  const linhas = String(memoria || '').split(/\r?\n/).filter((l) => /^\s*-/.test(l));
  const regras = linhas.filter((l) => ORIGEM_REGRA.test(l));
  const licoes = linhas.filter((l) => !ORIGEM_REGRA.test(l));
  const p = [];
  if (regras.length) {
    p.push('## REGRAS OBRIGATÓRIAS (ditas pelas pessoas — valem em TODA resposta)', ...regras,
      'Antes de entregar, confira item por item se cumpriu cada regra acima.', '');
  }
  p.push('## Sua memória — o que você aprendeu em execuções anteriores', licoes.length ? licoes.join('\n') : '(nada ainda)',
    'Use essas lições, mas corrija-as se os dados mostrarem o contrário. As regras sempre prevalecem.', '',
    '## Autorrevisão (no fim de TODA execução)',
    'Anote em <aprendizado> (uma lição por linha, no máximo 3) quando: você errou e corrigiu no caminho; a fonte estava em outro lugar ou formato; ' +
    'precisou de 5+ passos para algo que poderia ser direto; a pessoa corrigiu você; uma lição da memória se mostrou errada (escreva a certa começando com "CORRIGE:").',
    'Anote o CAMINHO que funcionou (arquivo, coluna, filtro), nunca o resultado do dia. Nada de senha, dado pessoal ou valor que fica velho. Se não aprendeu nada, não escreva o bloco.',
    '<aprendizado>', '- lição curta e específica', '</aprendizado>');
  if ((o.skills || []).length) {
    p.push('Se uma das suas skills (' + o.skills.join(', ') + ') estiver errada ou incompleta, proponha a correção (alguém aprova antes de valer):',
      '<sugestao-skill slug="nome-da-skill">o que acrescentar ou corrigir</sugestao-skill>');
  }
  return p.join('\n');
}

/** Tira <aprendizado> e <sugestao-skill> da resposta. */
function extrairAprendizado(texto) {
  const licoes = []; const sugestoes = [];
  let t = String(texto || '').replace(/<aprendizado>([\s\S]*?)<\/aprendizado>/gi, (m, corpo) => {
    corpo.split(/\r?\n/).forEach((l) => { const x = l.replace(/^\s*[-*\d.)]+\s*/, '').trim(); if (x) licoes.push(x); });
    return '';
  });
  t = t.replace(/<sugestao-skill\s+slug=["']?([a-z0-9-]+)["']?\s*>([\s\S]*?)<\/sugestao-skill>/gi, (m, slug, corpo) => {
    if (corpo.trim()) sugestoes.push({ slug, texto: corpo.trim() }); return '';
  });
  return { texto: t.replace(/\n{3,}/g, '\n\n').trim(), licoes: licoes.slice(0, 3), sugestoes: sugestoes.slice(0, 2) };
}

/** Bloco extra do system prompt do Curador: quem recebe e como entregar. agentes = [{nome, descricao}] */
function promptCurador(agentes) {
  return ['## AGENTES QUE RECEBEM LIÇÕES (nome exato · função)',
    (agentes || []).map((a) => '- ' + a.nome + ' · ' + String(a.descricao || '').slice(0, 160)).join('\n'), '',
    '## Como entregar cada lição',
    '<licao-para agente="Nome exato do agente" tipo="regra">(dd/mm/aaaa) texto</licao-para>',
    'tipo="regra" = decisão, correção ou regra de negócio dita pelo dono (vira REGRA OBRIGATÓRIA). tipo="licao" = caminho que funcionou ou preferência de formato.',
    'Uma lição por bloco, até 300 caracteres. No máximo 40 blocos. Siga a skill minerar-conversas.'].join('\n');
}

/**
 * Tira os blocos <licao-para> da resposta do Curador.
 * @param {string} texto resposta do Curador
 * @param {string[]} nomes nomes dos agentes que podem receber
 * @returns {{texto: string, licoes: {agente: string, tipo: 'regra'|'licao', texto: string}[], naoAchou: string[]}}
 */
function extrairLicoesPara(texto, nomes, opts) {
  const max = (opts && opts.max) || 40;
  const porNome = new Map((nomes || []).map((n) => [normalizar(n), n]));
  const licoes = []; const naoAchou = []; let n = 0;
  const t = String(texto || '').replace(/<licao-para\s+agente=["']([^"']+)["'](?:\s+tipo=["']?(regra|licao)["']?)?\s*>([\s\S]*?)<\/licao-para>/gi,
    (m, nome, tipo, corpo) => {
      n += 1; if (n > max) return '';
      const alvo = porNome.get(normalizar(nome));
      const l = String(corpo || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      if (!alvo) { naoAchou.push(nome); return ''; }
      if (l.length >= 8) licoes.push({ agente: alvo, tipo: tipo === 'regra' ? 'regra' : 'licao', texto: l });
      return '';
    });
  return { texto: t.replace(/\n{3,}/g, '\n\n').trim(), licoes, naoAchou: Array.from(new Set(naoAchou)) };
}

/**
 * Distribui as lições do Curador usando as funções da sua plataforma.
 * plataforma = { listarAgentes(): [{nome, descricao}], lerMemoria(nome): string, gravarMemoria(nome, texto) }
 */
function distribuir(textoCurador, plataforma, opts) {
  const nomes = plataforma.listarAgentes().map((a) => a.nome);
  const r = extrairLicoesPara(textoCurador, nomes, opts);
  const feitos = [];
  r.licoes.forEach((x) => {
    const origem = x.tipo === 'regra' ? 'regra de ' + ((opts && opts.dono) || 'dono') + ' (conversa)' : 'conversa';
    const a = anexarMemoria(plataforma.lerMemoria(x.agente), [x.texto], origem, opts);
    if (a.novas.length) { plataforma.gravarMemoria(x.agente, a.memoria); feitos.push(x); }
  });
  return { texto: r.texto, feitos, naoAchou: r.naoAchou };
}

/** Arquivos .md da pasta de conversas modificados depois de `desdeMs` (ignora "_*" e "00_*"). */
function arquivosNovos(pasta, desdeMs, max) {
  const out = [];
  (function walk(d, prof) {
    if (prof > 3) return;
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    es.forEach((e) => {
      if (e.name.startsWith('.') || e.name.startsWith('_')) return;
      const f = path.join(d, e.name);
      if (e.isDirectory()) return walk(f, prof + 1);
      if (!e.name.endsWith('.md') || /^00_/.test(e.name)) return;
      const st = fs.statSync(f); if (st.mtimeMs > (desdeMs || 0)) out.push({ f, m: st.mtimeMs });
    });
  })(pasta, 0);
  return out.sort((a, b) => a.m - b.m).slice(0, max || 40).map((x) => x.f);
}

/**
 * Autorrevisão sem IA: a fonte do agente não muda há `dias`+ dias? Devolve uma decisão pronta (ou null).
 * Use uma chave estável para não repetir a mesma pergunta todo dia.
 */
function decisaoFonteParada(agente, ultimaMudancaMs, opts) {
  const limite = (opts && opts.dias) || 7;
  const dias = Math.floor((Date.now() - ultimaMudancaMs) / 864e5);
  if (!ultimaMudancaMs || dias < limite) return null;
  return {
    tipo: 'decisao', chave: 'autorrevisao-fonte-parada-' + normalizar(agente.nome).replace(/ /g, '-'),
    titulo: agente.nome + ': fonte parada há ' + dias + ' dias — pausar o agente?',
    porque: 'Nenhuma fonte do agente mudou há ' + dias + ' dias e ele segue rodando e repetindo a mesma resposta.',
    opcoes: [
      { letra: 'a', texto: 'Pausar a rodada automática', acao: 'pausar' },
      { letra: 'b', texto: 'Rodar só uma vez por semana', acao: 'semanal' },
      { letra: 'c', texto: 'Manter como está', acao: 'manter' },
    ],
    recomendada: 'a',
  };
}

module.exports = {
  normalizar, parecidaComAlguma, anexarMemoria, blocoMemoria, extrairAprendizado,
  promptCurador, extrairLicoesPara, distribuir, arquivosNovos, decisaoFonteParada,
};
