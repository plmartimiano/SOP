import { test } from "node:test";
import assert from "node:assert/strict";

// api/_verificar-imagem-core.js é CommonJS (module.exports) — Node ESM
// importa isso normalmente via interop.
import { sanitizarNota, sanitizarOrdem, sanitizarContinuidade } from "../api/_verificar-imagem-core.js";

test("sanitizarNota aceita nota dentro da faixa 0-100", () => {
  const r = sanitizarNota({ nota: 85, descricao: "clara" });
  assert.deepEqual(r, { erro: false, nota: 85, descricao: "clara" });
});

test("sanitizarNota arredonda e satura na faixa 0-100 (dado real, não inventado além do clamp)", () => {
  assert.equal(sanitizarNota({ nota: 150 }).nota, 100);
  assert.equal(sanitizarNota({ nota: -5 }).nota, 0);
  assert.equal(sanitizarNota({ nota: 77.6 }).nota, 78);
});

test("sanitizarNota rejeita valor não numérico, sem inventar dado", () => {
  const r = sanitizarNota({ nota: "muito boa" });
  assert.equal(r.erro, true);
  assert.match(r.motivo, /não é um número válido/);
});

test("sanitizarOrdem aceita uma permutação exata dos rótulos esperados", () => {
  const r = sanitizarOrdem({ ordemSugerida: ["C", "A", "B"] }, ["A", "B", "C"]);
  assert.deepEqual(r, { erro: false, ordemSugerida: ["C", "A", "B"] });
});

test("sanitizarOrdem rejeita rótulo repetido", () => {
  const r = sanitizarOrdem({ ordemSugerida: ["A", "A", "C"] }, ["A", "B", "C"]);
  assert.equal(r.erro, true);
});

test("sanitizarOrdem rejeita rótulo faltando ou a mais", () => {
  assert.equal(sanitizarOrdem({ ordemSugerida: ["A", "B"] }, ["A", "B", "C"]).erro, true);
  assert.equal(sanitizarOrdem({ ordemSugerida: ["A", "B", "C", "D"] }, ["A", "B", "C"]).erro, true);
});

test("sanitizarOrdem rejeita quando ordemSugerida não é lista", () => {
  const r = sanitizarOrdem({ ordemSugerida: "A,B,C" }, ["A", "B", "C"]);
  assert.equal(r.erro, true);
  assert.match(r.motivo, /não veio como lista/);
});

test("sanitizarContinuidade aceita consistente true/false com motivo", () => {
  assert.deepEqual(sanitizarContinuidade({ consistente: true, motivo: "x" }), { erro: false, consistente: true, motivo: "x" });
  assert.deepEqual(sanitizarContinuidade({ consistente: false, motivo: "y" }), { erro: false, consistente: false, motivo: "y" });
});

test("sanitizarContinuidade rejeita consistente que não é booleano", () => {
  const r = sanitizarContinuidade({ consistente: "sim" });
  assert.equal(r.erro, true);
  assert.match(r.motivo, /não é um booleano/);
});
