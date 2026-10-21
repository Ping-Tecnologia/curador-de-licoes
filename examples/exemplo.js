// Exemplo completo e testável: node examples/exemplo.js
// Simula uma plataforma com 2 agentes guardando a memória num objeto.
'use strict';
const assert = require('assert');
const c = require('../src/curador');

const memorias = {
  'Auditor do ERP': '',
  'Comercial': '- (2026-10-01, auto) Propostas ficam na pasta propostas/<cliente>/',
};
const plataforma = {
  listarAgentes: () => [
    { nome: 'Auditor do ERP', descricao: 'Aponta lançamentos errados no ERP' },
    { nome: 'Comercial', descricao: 'Acompanha propostas em aberto' },
  ],
  lerMemoria: (nome) => memorias[nome],
  gravarMemoria: (nome, texto) => { memorias[nome] = texto; },
};

// 1) prompt do Curador (vai no system prompt junto com a skill minerar-conversas)
console.log(c.promptCurador(plataforma.listarAgentes()).split('\n').slice(0, 4).join('\n'), '\n…');

// 2) resposta que o modelo devolveria depois de ler as conversas
const resposta = `Li 2 conversas.
<licao-para agente="Auditor do ERP" tipo="regra">(21/10/2026) Pedido não é faturamento: só conta nota emitida.</licao-para>
<licao-para agente="comercial" tipo="licao">(21/10/2026) Propostas ficam na pasta propostas/<cliente>/ do cérebro</licao-para>
<licao-para agente="Financeiro" tipo="regra">(21/10/2026) Agente que não existe</licao-para>
Placar: 1 regra · 1 lição repetida · 1 sem agente.`;

const r = c.distribuir(resposta, plataforma, { dono: 'Eder', tz: 'America/Cuiaba' });
console.log('\nTexto para a pessoa:\n' + r.texto);
console.log('\nGravadas:', r.feitos.length, '· agente não encontrado:', r.naoAchou);
console.log('\nMemória do Auditor:\n' + memorias['Auditor do ERP']);

assert.strictEqual(r.feitos.length, 1, 'só a regra nova entra (a lição do Comercial é parecida com a que já existe)');
assert.deepStrictEqual(r.naoAchou, ['Financeiro']);
assert.ok(/regra de Eder \(conversa\)/.test(memorias['Auditor do ERP']));
assert.ok(c.blocoMemoria(memorias['Auditor do ERP']).includes('REGRAS OBRIGATÓRIAS'));

// 3) autorrevisão do próprio agente
const ex = c.extrairAprendizado('Relatório pronto.\n<aprendizado>\n- A coluna de vendedor no ERP é VEND_COD, não VENDEDOR\n</aprendizado>');
assert.deepStrictEqual(ex.licoes, ['A coluna de vendedor no ERP é VEND_COD, não VENDEDOR']);
assert.strictEqual(ex.texto, 'Relatório pronto.');

// 4) fonte parada
const d = c.decisaoFonteParada({ nome: 'Assistente do Técnico' }, Date.now() - 9 * 864e5);
assert.ok(d && d.titulo.includes('9 dias'));
assert.strictEqual(c.decisaoFonteParada({ nome: 'X' }, Date.now() - 2 * 864e5), null);

console.log('\n✅ todos os testes passaram');
