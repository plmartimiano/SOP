// Testes do pacote 1.3.5 (detecção de ciclos). Funções puras, com dados
// sintéticos pequenos o bastante pra conferir o resultado esperado na mão.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  autocorrelacao,
  estimarDuracaoCiclo,
  matrizAutoSimilaridade,
  encontrarAncoras,
  cortarCiclos,
  detectarCiclos,
} from "../js/deteccao-ciclos.js";
import { montarCurva } from "../js/curva-movimento.js";

function frame(tempoSegundos, valor) {
  return { tempoSegundos, cinzas: Float64Array.from([valor]) };
}

// bloco [0,0,100,100] repetido `vezes` vezes — um sinal periódico simples,
// de período 4 amostras, fácil de verificar na mão.
function curvaPeriodica(vezes) {
  const valores = [];
  for (let i = 0; i < vezes; i++) valores.push(0, 0, 100, 100);
  return valores.map((v, i) => ({ tempoSegundos: i * 0.5, valorSuavizado: v }));
}

test("autocorrelacao de um sinal periódico tem pico em lag = período", () => {
  const ac = autocorrelacao(curvaPeriodica(4).map((p) => p.valorSuavizado));
  assert.equal(ac[0], 1); // energia total normalizada em lag 0
  assert.ok(ac[4] > ac[3] && ac[4] > ac[5], "deveria haver um pico local em lag=4");
});

test("estimarDuracaoCiclo acha o período certo (4 amostras = 2s a 2fps)", () => {
  const est = estimarDuracaoCiclo(curvaPeriodica(4), 2);
  assert.ok(est !== null);
  assert.equal(est.lagEmFrames, 4);
  assert.equal(est.duracaoSegundos, 2);
});

test("estimarDuracaoCiclo devolve null pra sinal sem repetição (monótono)", () => {
  const monotona = Array.from({ length: 20 }, (_, i) => ({ tempoSegundos: i * 0.5, valorSuavizado: i * 3 }));
  assert.equal(estimarDuracaoCiclo(monotona, 2), null);
});

test("estimarDuracaoCiclo devolve null pra sinal totalmente plano (zero movimento)", () => {
  const plana = Array.from({ length: 20 }, (_, i) => ({ tempoSegundos: i * 0.5, valorSuavizado: 0 }));
  assert.equal(estimarDuracaoCiclo(plana, 2), null);
});

test("estimarDuracaoCiclo devolve null com poucos pontos (não trava, não inventa)", () => {
  assert.equal(estimarDuracaoCiclo([{ tempoSegundos: 0, valorSuavizado: 5 }], 2), null);
});

test("matrizAutoSimilaridade é zero na diagonal e simétrica", () => {
  const frames = [frame(0, 10), frame(0.5, 90), frame(1, 10)];
  const m = matrizAutoSimilaridade(frames);
  assert.equal(m[0][0], 0);
  assert.equal(m[1][1], 0);
  assert.equal(m[0][1], m[1][0]);
  assert.equal(m[0][2], 0); // frame 0 e frame 2 são idênticos (valor 10)
});

test("encontrarAncoras acha as repetições do frame 0 espaçadas pelo período", () => {
  // frame 0 = valor 10 (âncora); a cada 4 frames o padrão repete o mesmo valor
  const valores = [10, 50, 80, 50, 10, 50, 80, 50, 10, 50, 80, 50, 10];
  const frames = valores.map((v, i) => frame(i * 0.5, v));
  const matriz = matrizAutoSimilaridade(frames);
  const ancoras = encontrarAncoras(matriz, frames.length, 4);
  assert.deepEqual(ancoras, [0, 4, 8, 12]);
});

test("cortarCiclos gera as durações certas e marca só as pontas como suspeitas", () => {
  const frames = Array.from({ length: 17 }, (_, i) => frame(i * 0.5, 0));
  const ciclos = cortarCiclos(frames, [0, 4, 8, 12, 16]);
  assert.equal(ciclos.length, 4);
  assert.deepEqual(ciclos.map((c) => c.duracaoSegundos), [2, 2, 2, 2]);
  assert.equal(ciclos[0].suspeito, true);
  assert.equal(ciclos[3].suspeito, true);
  assert.equal(ciclos[1].suspeito, false);
  assert.equal(ciclos[2].suspeito, false);
});

test("cortarCiclos com um único ciclo marca ele mesmo como suspeito, sem quebrar", () => {
  const frames = [frame(0, 0), frame(0.5, 0)];
  const ciclos = cortarCiclos(frames, [0, 1]);
  assert.equal(ciclos.length, 1);
  assert.equal(ciclos[0].suspeito, true);
});

test("detectarCiclos, de ponta a ponta: 4 ciclos de 2s cada, primeiro e último suspeitos", () => {
  const padrao = [0, 0, 0, 100];
  const frames = Array.from({ length: 17 }, (_, i) => frame(i * 0.5, padrao[i % 4]));
  const curva = montarCurva(frames);

  const resultado = detectarCiclos(frames, curva, 2);
  assert.equal(resultado.ciclos.length, 4);
  assert.deepEqual(resultado.ancoras, [0, 4, 8, 12, 16]);
  assert.ok(resultado.ciclos.every((c) => c.duracaoSegundos === 2));
  assert.equal(resultado.ciclos[0].suspeito, true);
  assert.equal(resultado.ciclos[3].suspeito, true);
});

test("detectarCiclos sem período detectável devolve ciclos vazio, não um ciclo fictício", () => {
  const frames = Array.from({ length: 20 }, (_, i) => frame(i * 0.5, i)); // cresce sem parar, sem repetir
  const curva = montarCurva(frames);
  const resultado = detectarCiclos(frames, curva, 2);
  assert.deepEqual(resultado.ciclos, []);
  assert.equal(resultado.estimativa, null);
  assert.ok(resultado.matriz); // a matriz ainda é útil pra olhar, mesmo sem ciclo detectado
});
