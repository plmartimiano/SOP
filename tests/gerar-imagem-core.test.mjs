import { test } from "node:test";
import assert from "node:assert/strict";

// api/_gerar-imagem-core.js é CommonJS (module.exports) — Node ESM
// importa isso normalmente via interop.
import { montarPartes, extrairImagem } from "../api/_gerar-imagem-core.js";

test("montarPartes com referência inclui o texto e a imagem inline", () => {
  const partes = montarPartes({ prompt: "desenhe X", imagemReferenciaBase64: "abc123" });
  assert.deepEqual(partes, [{ text: "desenhe X" }, { inline_data: { mime_type: "image/png", data: "abc123" } }]);
});

test("montarPartes sem referência (quadro-mestre) manda só o texto", () => {
  const partes = montarPartes({ prompt: "bancada vazia", imagemReferenciaBase64: null });
  assert.deepEqual(partes, [{ text: "bancada vazia" }]);
});

test("extrairImagem pega a imagem de inline_data (snake_case)", () => {
  const resposta = { candidates: [{ content: { parts: [{ inline_data: { data: "xyz", mime_type: "image/png" } }] } }] };
  const r = extrairImagem(resposta);
  assert.deepEqual(r, { erro: false, imagemBase64: "xyz", mimeType: "image/png" });
});

test("extrairImagem pega a imagem de inlineData (camelCase)", () => {
  const resposta = { candidates: [{ content: { parts: [{ inlineData: { data: "xyz", mimeType: "image/jpeg" } }] } }] };
  const r = extrairImagem(resposta);
  assert.deepEqual(r, { erro: false, imagemBase64: "xyz", mimeType: "image/jpeg" });
});

test("extrairImagem sem nenhuma parte de imagem explica o motivo, sem inventar dado", () => {
  const resposta = { candidates: [{ content: { parts: [{ text: "não consigo desenhar isso" }] }, finishReason: "SAFETY" }] };
  const r = extrairImagem(resposta);
  assert.equal(r.erro, true);
  assert.match(r.motivo, /SAFETY/);
});

test("extrairImagem com resposta vazia/malformada não trava, devolve motivo genérico", () => {
  const r = extrairImagem({});
  assert.equal(r.erro, true);
  assert.match(r.motivo, /não devolveu nenhuma imagem/);
});
