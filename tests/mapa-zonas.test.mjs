// Testes do pacote 1.1.2 (mapa de zonas). Geometria e validação são puras —
// o desenho em canvas/upload de imagem só se testa no navegador.

import { test } from "node:test";
import assert from "node:assert/strict";

import { gerarIdZona, validarZona, criarZona, renumerarZonas, TIPOS_ZONA } from "../js/mapa-zonas.js";

test("gerarIdZona numera a partir de Z01, com dois dígitos", () => {
  assert.equal(gerarIdZona(0), "Z01");
  assert.equal(gerarIdZona(9), "Z10");
});

test("validarZona recusa nome vazio", () => {
  const r = validarZona({ nomeOficial: "  ", tipo: "escaninho", retangulo: { x: 0, y: 0, largura: 0.1, altura: 0.1 } });
  assert.equal(r.valido, false);
  assert.match(r.erros[0], /Nome oficial/);
});

test("validarZona recusa tipo fora da lista fechada", () => {
  const r = validarZona({ nomeOficial: "Suporte L-32", tipo: "gaveta", retangulo: { x: 0, y: 0, largura: 0.1, altura: 0.1 } });
  assert.equal(r.valido, false);
  assert.match(r.erros[0], /Tipo precisa ser um de/);
});

test("validarZona recusa retângulo sem área", () => {
  const r = validarZona({ nomeOficial: "Suporte L-32", tipo: "escaninho", retangulo: { x: 0, y: 0, largura: 0, altura: 0.1 } });
  assert.equal(r.valido, false);
  assert.match(r.erros[0], /área desenhada/);
});

test("validarZona aceita zona bem formada, para todos os tipos permitidos", () => {
  for (const tipo of TIPOS_ZONA) {
    const r = validarZona({ nomeOficial: "Zona X", tipo, retangulo: { x: 0.1, y: 0.1, largura: 0.2, altura: 0.2 } });
    assert.equal(r.valido, true, `tipo ${tipo} deveria ser válido`);
  }
});

test("criarZona monta o objeto com id e nome/código sem espaços nas pontas", () => {
  const zona = criarZona(2, {
    nomeOficial: "  Suporte L-32  ",
    codigoInterno: " COMP-L32 ",
    tipo: "escaninho",
    retangulo: { x: 0.1, y: 0.2, largura: 0.3, altura: 0.4 },
  });
  assert.equal(zona.id, "Z03");
  assert.equal(zona.nomeOficial, "Suporte L-32");
  assert.equal(zona.codigoInterno, "COMP-L32");
  assert.equal(zona.tipo, "escaninho");
  assert.deepEqual(zona.retangulo, { x: 0.1, y: 0.2, largura: 0.3, altura: 0.4 });
});

test("renumerarZonas corrige a numeração depois de remover uma zona do meio", () => {
  const zonas = [
    criarZona(0, { nomeOficial: "A", tipo: "escaninho", retangulo: { x: 0, y: 0, largura: 0.1, altura: 0.1 } }),
    criarZona(1, { nomeOficial: "B", tipo: "escaninho", retangulo: { x: 0, y: 0, largura: 0.1, altura: 0.1 } }),
    criarZona(2, { nomeOficial: "C", tipo: "escaninho", retangulo: { x: 0, y: 0, largura: 0.1, altura: 0.1 } }),
  ];
  const semB = zonas.filter((z) => z.nomeOficial !== "B");
  const renumerado = renumerarZonas(semB);
  assert.deepEqual(renumerado.map((z) => z.id), ["Z01", "Z02"]);
  assert.deepEqual(renumerado.map((z) => z.nomeOficial), ["A", "C"]);
});
