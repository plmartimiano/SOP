import { test } from "node:test";
import assert from "node:assert/strict";

import { extrairJsonColado } from "../js/manual-ia.js";

test("extrairJsonColado faz parse de JSON puro", () => {
  assert.deepEqual(extrairJsonColado('{"nota": 80}'), { nota: 80 });
});

test("extrairJsonColado tira cerca de código (```json ... ```)", () => {
  assert.deepEqual(extrairJsonColado('```json\n{"nota": 80}\n```'), { nota: 80 });
});

test("extrairJsonColado tira cerca sem a palavra 'json'", () => {
  assert.deepEqual(extrairJsonColado('```\n{"consistente": true}\n```'), { consistente: true });
});

test("extrairJsonColado acha o JSON mesmo com texto em volta (resposta de chat)", () => {
  const texto = 'Claro! Aqui está a análise:\n\n{"verbo": "posicionar", "confianca": 90}\n\nEspero ter ajudado!';
  assert.deepEqual(extrairJsonColado(texto), { verbo: "posicionar", confianca: 90 });
});

test("extrairJsonColado devolve null (não trava) quando não há JSON nenhum", () => {
  assert.equal(extrairJsonColado("isso não tem json nenhum"), null);
});

test("extrairJsonColado devolve null em texto vazio/nulo", () => {
  assert.equal(extrairJsonColado(null), null);
  assert.equal(extrairJsonColado(""), null);
  assert.equal(extrairJsonColado(undefined), null);
});

test("extrairJsonColado devolve null quando o JSON está malformado mesmo sem cerca nem texto em volta", () => {
  assert.equal(extrairJsonColado("{ isso não fecha"), null);
});
