// Testes da fase 14 (verificação cega) — fetch é simulado, nada de rede
// de verdade, nem pro proxy nem pro Gemini.

import { test } from "node:test";
import assert from "node:assert/strict";
import { embaralharComRotulos, avaliarOrdemSugerida, rodarVerificacaoCega } from "../js/verificacao-cega.js";

const PASSOS = [1, 2, 3, 4, 5, 6].map((n) => ({ numero: n, imagemBase64: `img${n}`, mimeType: "image/png" }));

// rng => 0 sempre escolhe o índice 0 no Fisher-Yates -- dá uma rotação
// previsível e fácil de verificar na mão: A->2, B->3, C->4, D->5, E->6, F->1
// (conferido rodando a função antes de escrever esta asserção).
const RNG_FIXO = () => 0;

test("embaralharComRotulos nunca perde nem duplica um passo -- o mapa cobre todos os números reais", () => {
  const { itens, rotuloParaNumero } = embaralharComRotulos(PASSOS, { rng: RNG_FIXO });
  assert.equal(itens.length, 6);
  assert.deepEqual(new Set(Object.values(rotuloParaNumero)), new Set([1, 2, 3, 4, 5, 6]));
});

test("embaralharComRotulos com rng fixo dá uma ordem determinística e reproduzível", () => {
  const { rotuloParaNumero } = embaralharComRotulos(PASSOS, { rng: RNG_FIXO });
  assert.deepEqual(rotuloParaNumero, { A: 2, B: 3, C: 4, D: 5, E: 6, F: 1 });
});

test("avaliarOrdemSugerida reconhece a sequência perfeita como reconstruível", () => {
  const rotuloParaNumero = { A: 2, B: 3, C: 4, D: 5, E: 6, F: 1 };
  const ordemCorreta = ["F", "A", "B", "C", "D", "E"]; // F=1, A=2, B=3, C=4, D=5, E=6
  const r = avaliarOrdemSugerida(ordemCorreta, rotuloParaNumero, [1, 2, 3, 4, 5, 6]);
  assert.equal(r.sequenciaReconstruivel, true);
  assert.equal(r.totalAcertos, 6);
});

test("avaliarOrdemSugerida aponta exatamente as posições erradas quando a ordem não bate", () => {
  const rotuloParaNumero = { A: 2, B: 3, C: 4, D: 5, E: 6, F: 1 };
  const ordemComTrocaNoInicio = ["A", "F", "B", "C", "D", "E"]; // trocou as duas primeiras
  const r = avaliarOrdemSugerida(ordemComTrocaNoInicio, rotuloParaNumero, [1, 2, 3, 4, 5, 6]);
  assert.equal(r.sequenciaReconstruivel, false);
  assert.deepEqual(r.acertosPorPosicao, [false, false, true, true, true, true]);
  assert.equal(r.totalAcertos, 4);
});

function fetchMockado({ nota = 80, ordemSugerida, consistente = true } = {}) {
  return async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.tipo === "nota") return { ok: true, status: 200, json: async () => ({ nota, descricao: "cena clara" }) };
    if (payload.tipo === "ordem") return { ok: true, status: 200, json: async () => ({ ordemSugerida }) };
    return { ok: true, status: 200, json: async () => ({ consistente, motivo: "ok" }) };
  };
}

test("rodarVerificacaoCega pede nota do quadro-mestre + cada passo, uma ordem, e N-1 continuidades", async () => {
  const chamadasPorTipo = {};
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    chamadasPorTipo[payload.tipo] = (chamadasPorTipo[payload.tipo] || 0) + 1;
    if (payload.tipo === "nota") return { ok: true, status: 200, json: async () => ({ nota: 80, descricao: "x" }) };
    if (payload.tipo === "ordem") return { ok: true, status: 200, json: async () => ({ ordemSugerida: payload.imagens.map((i) => i.rotulo) }) };
    return { ok: true, status: 200, json: async () => ({ consistente: true, motivo: "x" }) };
  };
  await rodarVerificacaoCega(
    { quadroMestreImagem: { imagemBase64: "qm", mimeType: "image/png" }, passosComImagemAncora: PASSOS },
    { fetchImpl, atrasoBaseMs: 1, rng: RNG_FIXO }
  );
  assert.deepEqual(chamadasPorTipo, { nota: 7, ordem: 1, continuidade: 5 }); // 6 passos + quadro-mestre = 7; pares consecutivos = 5
});

test("rodarVerificacaoCega sem quadro-mestre pede nota só dos 6 passos", async () => {
  let notasChamadas = 0;
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.tipo === "nota") { notasChamadas++; return { ok: true, status: 200, json: async () => ({ nota: 80, descricao: "x" }) }; }
    if (payload.tipo === "ordem") return { ok: true, status: 200, json: async () => ({ ordemSugerida: payload.imagens.map((i) => i.rotulo) }) };
    return { ok: true, status: 200, json: async () => ({ consistente: true, motivo: "x" }) };
  };
  await rodarVerificacaoCega({ quadroMestreImagem: null, passosComImagemAncora: PASSOS }, { fetchImpl, atrasoBaseMs: 1, rng: RNG_FIXO });
  assert.equal(notasChamadas, 6);
});

test("rodarVerificacaoCega calcula o gate de ordem reconstruível a partir da resposta do modelo", async () => {
  // o modelo "acerta" -- devolve a ordem verdadeira em rótulos
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.tipo === "nota") return { ok: true, status: 200, json: async () => ({ nota: 80, descricao: "x" }) };
    if (payload.tipo === "ordem") {
      // reordena os rótulos recebidos pra bater com a ordem real 1..6, usando o mapa embutido no payload
      const porRotulo = Object.fromEntries(payload.imagens.map((i) => [i.rotulo, i]));
      // como não temos o número real aqui (só o rótulo), simulamos "acerto" devolvendo os rótulos na
      // mesma ordem em que vieram no payload -- isso só é a ordem certa se o embaralhamento é identidade,
      // então usamos rng fixo (RNG_FIXO) e resolvemos a ordem certa fora, no teste, comparando com avaliarOrdemSugerida.
      return { ok: true, status: 200, json: async () => ({ ordemSugerida: payload.imagens.map((i) => i.rotulo) }) };
    }
    return { ok: true, status: 200, json: async () => ({ consistente: true, motivo: "x" }) };
  };
  const resultado = await rodarVerificacaoCega(
    { quadroMestreImagem: null, passosComImagemAncora: PASSOS },
    { fetchImpl, atrasoBaseMs: 1, rng: RNG_FIXO }
  );
  // o mock devolveu os rótulos na ordem em que foram enviados -- ou seja, "nenhuma reordenação" --
  // então o gate só passa se essa ordem já bater com a ordem real, o que não é o caso do embaralhamento
  // com RNG_FIXO (A->2 primeiro, não A->1) -- confirma que o cálculo reflete isso, não sempre "true".
  assert.equal(resultado.ordem.sequenciaReconstruivel, false);
});

test("rodarVerificacaoCega: erro numa nota não impede as outras, nem a ordem, nem a continuidade", async () => {
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.tipo === "nota" && payload.imagemBase64 === "img3") {
      return { ok: false, status: 500, json: async () => ({ erro: "falhou nesta" }) };
    }
    if (payload.tipo === "nota") return { ok: true, status: 200, json: async () => ({ nota: 80, descricao: "x" }) };
    if (payload.tipo === "ordem") return { ok: true, status: 200, json: async () => ({ ordemSugerida: payload.imagens.map((i) => i.rotulo) }) };
    return { ok: true, status: 200, json: async () => ({ consistente: true, motivo: "x" }) };
  };
  const notasComErro = [];
  const resultado = await rodarVerificacaoCega(
    { quadroMestreImagem: null, passosComImagemAncora: PASSOS },
    { fetchImpl, tentativas: 1, atrasoBaseMs: 1, rng: RNG_FIXO, onNota: (chave, r, e) => { if (e) notasComErro.push(chave); } }
  );
  assert.deepEqual(notasComErro, ["passo:3"]);
  assert.equal(Object.keys(resultado.notas).length, 5); // as outras 5 notas foram
  assert.ok(resultado.ordem); // ordem não foi afetada pelo erro isolado na nota
  assert.equal(resultado.continuidades.length, 5);
});

test("rodarVerificacaoCega: continuidades ficam na ordem real dos pares, mesmo rodando em paralelo", async () => {
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.tipo === "nota") return { ok: true, status: 200, json: async () => ({ nota: 80, descricao: "x" }) };
    if (payload.tipo === "ordem") return { ok: true, status: 200, json: async () => ({ ordemSugerida: payload.imagens.map((i) => i.rotulo) }) };
    // atraso variável pra embaralhar a ordem de CHEGADA das respostas, e confirmar que o array de saída não segue isso
    const atraso = payload.imagemAntes.imagemBase64 === "img1" ? 15 : 1;
    await new Promise((r) => setTimeout(r, atraso));
    return { ok: true, status: 200, json: async () => ({ consistente: true, motivo: "x" }) };
  };
  const resultado = await rodarVerificacaoCega(
    { quadroMestreImagem: null, passosComImagemAncora: PASSOS },
    { fetchImpl, atrasoBaseMs: 1, rng: RNG_FIXO }
  );
  assert.deepEqual(
    resultado.continuidades.map((c) => c.entre),
    [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
  );
});
