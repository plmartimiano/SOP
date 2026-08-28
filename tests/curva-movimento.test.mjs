// Testes do pacote 1.3.4 (curva de movimento — parte geral). Funções puras,
// com frames sintéticos (arrays de "cinzas" pequenos, não miniaturas de
// verdade) — não precisa de navegador.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calcularCurvaMovimento,
  suavizarCurva,
  montarCurva,
  indicesDaZona,
  calcularCurvaPorZona,
  montarCurvaPorZona,
} from "../js/curva-movimento.js";

function frame(tempoSegundos, valores) {
  return { tempoSegundos, cinzas: Float64Array.from(valores) };
}

test("frames idênticos dão movimento zero", () => {
  const frames = [frame(0, [10, 20, 30]), frame(0.5, [10, 20, 30]), frame(1, [10, 20, 30])];
  const curva = calcularCurvaMovimento(frames);
  assert.equal(curva.length, 2); // um a menos que os frames, o primeiro não tem "anterior"
  assert.ok(curva.every((p) => p.valor === 0));
});

test("mudança total de preto pra branco dá o valor máximo (255)", () => {
  const preto = new Array(64).fill(0);
  const branco = new Array(64).fill(255);
  const frames = [frame(0, preto), frame(0.5, branco)];
  const curva = calcularCurvaMovimento(frames);
  assert.equal(curva[0].valor, 255);
});

test("curva tem um ponto por par de frames vizinhos, com o tempo do frame mais recente", () => {
  const frames = [frame(0, [0]), frame(0.5, [50]), frame(1, [50]), frame(1.5, [200])];
  const curva = calcularCurvaMovimento(frames);
  assert.deepEqual(
    curva.map((p) => p.tempoSegundos),
    [0.5, 1, 1.5]
  );
  assert.deepEqual(
    curva.map((p) => p.valor),
    [50, 0, 150]
  );
});

test("suavizar preserva o comprimento e reduz um pico isolado", () => {
  const pontos = [0, 1, 2, 3, 4].map((t) => ({ tempoSegundos: t, valor: t === 2 ? 100 : 0 }));
  const suave = suavizarCurva(pontos, 3);
  assert.equal(suave.length, pontos.length);
  assert.ok(suave[2].valor < 100 && suave[2].valor > 0, `pico deveria ser atenuado, veio ${suave[2].valor}`);
});

test("suavizar preserva um vale sustentado (não some, só limpa ruído pontual)", () => {
  // um "vale" real dura vários frames seguidos — a suavização não deve apagá-lo.
  const valores = [80, 80, 5, 5, 5, 80, 80];
  const pontos = valores.map((v, i) => ({ tempoSegundos: i * 0.5, valor: v }));
  const suave = suavizarCurva(pontos, 3);
  const meio = suave[3].valor; // centro do vale
  assert.ok(meio < 40, `centro do vale deveria continuar baixo, veio ${meio}`);
});

test("montarCurva combina crua e suavizada com o mesmo tempo", () => {
  const frames = [frame(0, [0, 0]), frame(0.5, [10, 10]), frame(1, [200, 200])];
  const curva = montarCurva(frames);
  assert.equal(curva.length, 2);
  for (const p of curva) {
    assert.ok("valorCru" in p);
    assert.ok("valorSuavizado" in p);
    assert.ok(typeof p.tempoSegundos === "number");
  }
});

// A partir daqui: curva por zona (F03-04), grade pequena (4×4=16 células)
// pra dar pra conferir os índices na mão.

test("indicesDaZona pega as células cujo centro cai dentro do retângulo", () => {
  const zonaSuperiorEsquerda = { retangulo: { x: 0, y: 0, largura: 0.5, altura: 0.5 } };
  const indices = indicesDaZona(zonaSuperiorEsquerda, 4).sort((a, b) => a - b);
  assert.deepEqual(indices, [0, 1, 4, 5]); // linhas 0–1, colunas 0–1 da grade 4×4
});

test("indicesDaZona não pega nada de uma zona fora da grade (x >= 1)", () => {
  const zonaForaDoFrame = { retangulo: { x: 1, y: 0, largura: 0.2, altura: 0.2 } };
  assert.deepEqual(indicesDaZona(zonaForaDoFrame, 4), []);
});

test("calcularCurvaPorZona isola o movimento por região — mudança numa zona não vaza pra outra", () => {
  const lado = 4;
  const parado = new Array(lado * lado).fill(0);
  // muda só as células do canto superior-esquerdo (índices 0,1,4,5)
  const mudouNoCanto = parado.map((v, i) => ([0, 1, 4, 5].includes(i) ? 100 : 0));
  const frames = [frame(0, parado), frame(0.5, mudouNoCanto)];

  const zonaSuperior = { id: "ZA", retangulo: { x: 0, y: 0, largura: 0.5, altura: 0.5 } };
  const zonaInferior = { id: "ZB", retangulo: { x: 0.5, y: 0.5, largura: 0.5, altura: 0.5 } };
  const curvas = calcularCurvaPorZona(frames, [zonaSuperior, zonaInferior], lado);

  assert.equal(curvas.ZA[0].valor, 100);
  assert.equal(curvas.ZB[0].valor, 0);
});

test("montarCurvaPorZona devolve crua+suavizada por zona, indexado pelo id", () => {
  const lado = 4;
  const frames = [frame(0, new Array(16).fill(0)), frame(0.5, new Array(16).fill(50)), frame(1, new Array(16).fill(50))];
  const zona = { id: "Z01", retangulo: { x: 0, y: 0, largura: 1, altura: 1 } };

  const resultado = montarCurvaPorZona(frames, [zona], 3, lado);
  assert.ok("Z01" in resultado);
  assert.equal(resultado.Z01.length, 2);
  for (const p of resultado.Z01) {
    assert.ok("valorCru" in p);
    assert.ok("valorSuavizado" in p);
  }
});
