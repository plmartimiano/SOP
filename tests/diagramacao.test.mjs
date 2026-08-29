import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPaginasSOP, verificarProntoParaEntrega, calcularLayout } from "../js/diagramacao.js";

function ficha(overrides = {}) {
  return {
    numero: 1,
    titulo: "posicionar Suporte",
    maos: ["direita"],
    ferramentas: [],
    pecas: ["Suporte"],
    criterioConclusao: "Concluído ao finalizar.",
    risco: "Não avaliado automaticamente.",
    ...overrides,
  };
}

test("montarPaginasSOP monta uma página por ficha, na mesma ordem recebida", () => {
  const fichas = [ficha({ numero: 1 }), ficha({ numero: 2, titulo: "testar Suporte" })];
  const imagens = { 1: { imagemBase64: "a", mimeType: "image/png" }, 2: { imagemBase64: "b", mimeType: "image/png" } };
  const r = montarPaginasSOP(fichas, imagens, { nomeEstacao: "X", versaoDossie: "1.0.0" });
  assert.equal(r.paginas.length, 2);
  assert.deepEqual(r.paginas.map((p) => p.numero), [1, 2]);
});

test("montarPaginasSOP carrega o texto sobreposto certo de cada ficha", () => {
  const fichas = [ficha({ risco: "Risco de esmagamento." })];
  const r = montarPaginasSOP(fichas, { 1: { imagemBase64: "a", mimeType: "image/png" } }, { nomeEstacao: "X" });
  assert.equal(r.paginas[0].textoSobreposto.risco, "Risco de esmagamento.");
  assert.deepEqual(r.paginas[0].textoSobreposto.pecas, ["Suporte"]);
});

test("montarPaginasSOP marca temImagem=false quando a imagem do passo não está disponível, sem inventar um placeholder", () => {
  const fichas = [ficha({ numero: 1 }), ficha({ numero: 2 })];
  const r = montarPaginasSOP(fichas, { 1: { imagemBase64: "a", mimeType: "image/png" } }, { nomeEstacao: "X" });
  assert.equal(r.paginas[0].temImagem, true);
  assert.equal(r.paginas[1].temImagem, false);
  assert.equal(r.paginas[1].imagemBase64, null);
});

test("montarPaginasSOP registra cabeçalho com nome da estação e versão do dossiê", () => {
  const r = montarPaginasSOP([ficha()], { 1: { imagemBase64: "a", mimeType: "image/png" } }, { nomeEstacao: "Estação Y", versaoDossie: "2.0.0" });
  assert.equal(r.cabecalho.nomeEstacao, "Estação Y");
  assert.equal(r.cabecalho.versaoDossie, "2.0.0");
  assert.ok(r.cabecalho.dataGeracao);
});

test("montarPaginasSOP sem nome de estação não fica em branco silencioso", () => {
  const r = montarPaginasSOP([ficha()], { 1: { imagemBase64: "a", mimeType: "image/png" } }, {});
  assert.equal(r.cabecalho.nomeEstacao, "(sem nome)");
});

test("verificarProntoParaEntrega passa quando todas as páginas têm imagem", () => {
  const fichas = [ficha({ numero: 1 }), ficha({ numero: 2 })];
  const r = montarPaginasSOP(fichas, { 1: { imagemBase64: "a" }, 2: { imagemBase64: "b" } }, {});
  assert.deepEqual(verificarProntoParaEntrega(r.paginas), { pronto: true, paginasSemImagem: [] });
});

test("verificarProntoParaEntrega aponta exatamente os números das páginas sem imagem", () => {
  const fichas = [ficha({ numero: 1 }), ficha({ numero: 2 }), ficha({ numero: 3 })];
  const r = montarPaginasSOP(fichas, { 1: { imagemBase64: "a" } }, {});
  assert.deepEqual(verificarProntoParaEntrega(r.paginas), { pronto: false, paginasSemImagem: [2, 3] });
});

test("calcularLayout reserva exatamente 80% da altura pra imagem, 20% pro texto", () => {
  const l = calcularLayout(850, 1100);
  assert.equal(l.alturaImagem, 880);
  assert.equal(l.alturaTexto, 220);
  assert.equal(l.alturaImagem + l.alturaTexto, 1100); // não perde nem sobra pixel
  assert.equal(l.proporcaoImagem, 0.8);
});

test("calcularLayout arredonda pra pixel inteiro em alturas que não dividem exato", () => {
  const l = calcularLayout(600, 777);
  assert.equal(Number.isInteger(l.alturaImagem), true);
  assert.equal(l.alturaImagem + l.alturaTexto, 777);
});
