import { test } from "node:test";
import assert from "node:assert/strict";

// api/_cliente-claude.js é CommonJS — Node ESM importa via interop.
import { parteImagem, extrairTexto, extrairJson, modelo, MODELO_PADRAO } from "../api/_cliente-claude.js";

test("parteImagem monta o content block de imagem no formato da Messages API", () => {
  const bloco = parteImagem({ base64: "abc123", mimeType: "image/jpeg" });
  assert.deepEqual(bloco, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "abc123" } });
});

test("parteImagem usa image/png como padrão quando mimeType não vem", () => {
  const bloco = parteImagem({ base64: "abc123" });
  assert.equal(bloco.source.media_type, "image/png");
});

test("extrairTexto pula blocos de thinking e pega o primeiro bloco de texto", () => {
  const resposta = {
    content: [
      { type: "thinking", thinking: "" }, // display "omitted" — texto vazio, mas ainda assim não é o bloco certo
      { type: "text", text: '{"verbo":"posicionar"}' },
    ],
  };
  assert.equal(extrairTexto(resposta), '{"verbo":"posicionar"}');
});

test("extrairTexto devolve null quando não há nenhum bloco de texto (ex.: recusa)", () => {
  assert.equal(extrairTexto({ content: [{ type: "thinking", thinking: "" }] }), null);
  assert.equal(extrairTexto({ content: [] }), null);
});

test("extrairJson faz parse de JSON puro", () => {
  assert.deepEqual(extrairJson('{"nota": 80}'), { nota: 80 });
});

test("extrairJson tira a cerca de código (```json ... ```) antes do parse", () => {
  const texto = '```json\n{"nota": 80, "descricao": "ok"}\n```';
  assert.deepEqual(extrairJson(texto), { nota: 80, descricao: "ok" });
});

test("extrairJson tira cerca sem a palavra 'json'", () => {
  assert.deepEqual(extrairJson('```\n{"consistente": true}\n```'), { consistente: true });
});

test("extrairJson devolve null (não trava) em JSON malformado", () => {
  assert.equal(extrairJson("isso não é json"), null);
});

test("extrairJson devolve null em texto vazio/nulo", () => {
  assert.equal(extrairJson(null), null);
  assert.equal(extrairJson(""), null);
});

test("modelo() usa claude-opus-5 como padrão", () => {
  const original = process.env.ANTHROPIC_MODEL;
  delete process.env.ANTHROPIC_MODEL;
  try {
    assert.equal(modelo(), "claude-opus-5");
    assert.equal(MODELO_PADRAO, "claude-opus-5");
  } finally {
    if (original !== undefined) process.env.ANTHROPIC_MODEL = original;
  }
});

test("modelo() respeita ANTHROPIC_MODEL quando configurada", () => {
  const original = process.env.ANTHROPIC_MODEL;
  process.env.ANTHROPIC_MODEL = "claude-sonnet-5";
  try {
    assert.equal(modelo(), "claude-sonnet-5");
  } finally {
    if (original !== undefined) process.env.ANTHROPIC_MODEL = original; else delete process.env.ANTHROPIC_MODEL;
  }
});
