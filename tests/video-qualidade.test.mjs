// Testes do pacote 1.3.2 (triagem de qualidade). A função é pura — não toca
// vídeo nem DOM — então roda direto no Node. A leitura de metadados de
// verdade (1.3.1, video-metadados.js) precisa de navegador e foi conferida
// manualmente (ver README).

import { test } from "node:test";
import assert from "node:assert/strict";

import { triarQualidade } from "../js/video-qualidade.js";

const BOM = {
  duracaoSegundos: 40,
  resolucao: { largura: 1280, altura: 720 },
  fps: 30,
  luminanciaMedia: 120,
};

test("vídeo bom passa sem motivos de recusa", () => {
  const r = triarQualidade(BOM);
  assert.equal(r.aprovado, true);
  assert.deepEqual(r.motivos, []);
});

test("recusa resolução abaixo de 720p, nos dois sentidos (paisagem e retrato)", () => {
  const paisagem = triarQualidade({ ...BOM, resolucao: { largura: 640, altura: 480 } });
  assert.equal(paisagem.aprovado, false);
  assert.match(paisagem.motivos[0], /Resolução muito baixa/);

  const retrato = triarQualidade({ ...BOM, resolucao: { largura: 480, altura: 854 } });
  assert.equal(retrato.aprovado, false);
});

test("aceita resolução vertical 720×1280 (lado menor bate os 720p)", () => {
  const r = triarQualidade({ ...BOM, resolucao: { largura: 720, altura: 1280 } });
  assert.equal(r.aprovado, true);
});

test("recusa fps abaixo de 20", () => {
  const r = triarQualidade({ ...BOM, fps: 12 });
  assert.equal(r.aprovado, false);
  assert.match(r.motivos[0], /Taxa de quadros baixa/);
});

test("fps desconhecido gera aviso, não recusa", () => {
  const r = triarQualidade({ ...BOM, fps: null });
  assert.equal(r.aprovado, true);
  assert.ok(r.avisos.some((a) => /não foi possível medir os quadros/i.test(a)));
});

test("recusa vídeo escuro demais", () => {
  const r = triarQualidade({ ...BOM, luminanciaMedia: 10 });
  assert.equal(r.aprovado, false);
  assert.match(r.motivos[0], /escuro demais/);
});

test("recusa vídeo curto demais (sanidade básica de duração)", () => {
  const r = triarQualidade({ ...BOM, duracaoSegundos: 0.5 });
  assert.equal(r.aprovado, false);
  assert.match(r.motivos[0], /muito curto/);
});

test("acumula todos os motivos quando o vídeo falha em mais de um critério", () => {
  const r = triarQualidade({
    duracaoSegundos: 0.5,
    resolucao: { largura: 320, altura: 240 },
    fps: 10,
    luminanciaMedia: 5,
  });
  assert.equal(r.aprovado, false);
  assert.equal(r.motivos.length, 4);
});

test("sempre avisa que a checagem de 3 ciclos (F02-02) ainda não está implementada", () => {
  const r = triarQualidade(BOM);
  assert.ok(r.avisos.some((a) => /ciclos/i.test(a)));
});
