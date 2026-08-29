// Testes do pacote 1.4.3 (lotes e retentativa) e da montagem de payload
// (1.4.1/1.4.2). fetch é simulado — nada de rede de verdade, nem pro
// proxy nem pro Gemini.

import { test } from "node:test";
import assert from "node:assert/strict";

import { montarPayload, lerFatia, lerFatiasEmLotes } from "../js/leitura-semantica.js";

function frame(indice, tempoSegundos) {
  return { indice, tempoSegundos, miniaturaDataUrl: `data:image/png;base64,frame${indice}` };
}

function fatia(indice, frameChaveIndice, tempoSegundos, zonasEnvolvidas = []) {
  return { indice, frameChave: { indice: frameChaveIndice, tempoSegundos }, zonasEnvolvidas };
}

const CONTEXTO = {
  glossario: [{ nomeOficial: "Suporte L-32" }],
  verbosPermitidos: ["encaixar"],
  zonas: [{ id: "Z01", nomeOficial: "Escaninho L-32", tipo: "escaninho" }],
};

test("montarPayload pega o frame antes/chave/depois pelos vizinhos do índice", () => {
  const frames = [frame(0, 0), frame(1, 0.5), frame(2, 1)];
  const p = montarPayload(fatia(1, 1, 0.5), frames, CONTEXTO);
  assert.equal(p.frames.antes, "data:image/png;base64,frame0");
  assert.equal(p.frames.chave, "data:image/png;base64,frame1");
  assert.equal(p.frames.depois, "data:image/png;base64,frame2");
  assert.equal(p.tempoSegundos, 0.5);
});

test("montarPayload devolve null pra antes/depois nas pontas da lista de frames", () => {
  const frames = [frame(0, 0), frame(1, 0.5)];
  const primeiro = montarPayload(fatia(1, 0, 0), frames, CONTEXTO);
  assert.equal(primeiro.frames.antes, null);
  const ultimo = montarPayload(fatia(1, 1, 0.5), frames, CONTEXTO);
  assert.equal(ultimo.frames.depois, null);
});

test("montarPayload resolve a zona pelo primeiro id em zonasEnvolvidas", () => {
  const frames = [frame(0, 0)];
  const p = montarPayload(fatia(1, 0, 0, ["Z01"]), frames, CONTEXTO);
  assert.deepEqual(p.zona, { id: "Z01", nomeOficial: "Escaninho L-32", tipo: "escaninho" });
});

test("montarPayload sem zona envolvida manda zona null", () => {
  const frames = [frame(0, 0)];
  const p = montarPayload(fatia(1, 0, 0, []), frames, CONTEXTO);
  assert.equal(p.zona, null);
});

function fetchQueSempreFunciona(respostaCorpo) {
  return async () => ({ ok: true, status: 200, json: async () => respostaCorpo });
}

test("lerFatia devolve a resposta quando o fetch funciona de primeira", async () => {
  const frames = [frame(0, 0)];
  const resposta = await lerFatia(fatia(1, 0, 0), frames, CONTEXTO, {
    fetchImpl: fetchQueSempreFunciona({ verbo: "encaixar" }),
    atrasoBaseMs: 1,
  });
  assert.deepEqual(resposta, { verbo: "encaixar" });
});

test("lerFatia tenta de novo depois de uma falha e devolve o resultado da segunda tentativa", async () => {
  let chamadas = 0;
  const fetchImpl = async () => {
    chamadas++;
    if (chamadas === 1) return { ok: false, status: 502, json: async () => ({ erro: "instável" }) };
    return { ok: true, status: 200, json: async () => ({ verbo: "testar" }) };
  };
  const frames = [frame(0, 0)];
  const resposta = await lerFatia(fatia(1, 0, 0), frames, CONTEXTO, { fetchImpl, atrasoBaseMs: 1 });
  assert.equal(chamadas, 2);
  assert.deepEqual(resposta, { verbo: "testar" });
});

test("lerFatia desiste depois do número de tentativas configurado e propaga o erro", async () => {
  let chamadas = 0;
  const fetchImpl = async () => {
    chamadas++;
    return { ok: false, status: 500, json: async () => ({ erro: "fora do ar" }) };
  };
  const frames = [frame(0, 0)];
  await assert.rejects(
    () => lerFatia(fatia(1, 0, 0), frames, CONTEXTO, { fetchImpl, tentativas: 3, atrasoBaseMs: 1 }),
    /fora do ar/
  );
  assert.equal(chamadas, 3);
});

test("lerFatiasEmLotes processa tudo e chama onResultado pra cada fatia", async () => {
  const frames = [frame(0, 0), frame(1, 0.5), frame(2, 1)];
  const fatias = [fatia(1, 0, 0), fatia(2, 1, 0.5), fatia(3, 2, 1)];
  const resultados = {};
  await lerFatiasEmLotes(fatias, frames, CONTEXTO, {
    tamanhoLote: 2,
    fetchImpl: fetchQueSempreFunciona({ verbo: "encaixar" }),
    atrasoBaseMs: 1,
    onResultado: (indice, leitura) => {
      resultados[indice] = leitura;
    },
  });
  assert.equal(Object.keys(resultados).length, 3);
  assert.deepEqual(resultados[0], { verbo: "encaixar" });
  assert.deepEqual(resultados[2], { verbo: "encaixar" });
});

test("lerFatiasEmLotes chama onErro só pra fatia que falhou, sem travar as outras", async () => {
  const frames = [frame(0, 0), frame(1, 0.5)];
  const fatias = [fatia(1, 0, 0), fatia(2, 1, 0.5)];
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.tempoSegundos === 0.5) {
      return { ok: false, status: 500, json: async () => ({ erro: "quebrou nesta" }) };
    }
    return { ok: true, status: 200, json: async () => ({ verbo: "encaixar" }) };
  };
  const resultados = {};
  const erros = {};
  await lerFatiasEmLotes(fatias, frames, CONTEXTO, {
    tamanhoLote: 2,
    fetchImpl,
    tentativas: 1,
    atrasoBaseMs: 1,
    onResultado: (i, r) => { resultados[i] = r; },
    onErro: (i, e) => { erros[i] = e; },
  });
  assert.deepEqual(resultados[0], { verbo: "encaixar" });
  assert.ok(erros[1]);
  assert.match(erros[1].message, /quebrou nesta/);
});

test("lerFatiasEmLotes processa em grupos do tamanho configurado, não tudo de uma vez", async () => {
  const frames = Array.from({ length: 6 }, (_, i) => frame(i, i * 0.5));
  const fatias = frames.map((f, i) => fatia(i + 1, i, f.tempoSegundos));

  let emVooMaximo = 0;
  let emVooAgora = 0;
  const fetchImpl = async () => {
    emVooAgora++;
    emVooMaximo = Math.max(emVooMaximo, emVooAgora);
    await new Promise((r) => setTimeout(r, 5));
    emVooAgora--;
    return { ok: true, status: 200, json: async () => ({ verbo: "encaixar" }) };
  };

  await lerFatiasEmLotes(fatias, frames, CONTEXTO, { tamanhoLote: 3, fetchImpl, atrasoBaseMs: 1 });
  assert.ok(emVooMaximo <= 3, `esperado no máximo 3 chamadas simultâneas, teve ${emVooMaximo}`);
  assert.ok(emVooMaximo >= 2, `esperado alguma concorrência de verdade, teve só ${emVooMaximo}`);
});
