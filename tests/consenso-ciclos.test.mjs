// Testes do pacote 1.4.4 + 1.4.5 (consenso entre ciclos). Cenários
// pequenos e hand-verificados: os valores esperados vêm de rodar as
// funções num script de diagnóstico antes de escrever as asserções, não
// de contas feitas de cabeça.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alinharPar,
  alinharCiclos,
  calcularFrequencias,
  separarNucleoEExcecoes,
  escolherCicloExemplar,
  montarConsenso,
} from "../js/consenso-ciclos.js";

function fatia(indice, causa, objeto) {
  return { indice, causa, leituraSemantica: objeto ? { verbo: "encaixar", objeto, indeterminado: undefined } : { indeterminado: true, motivo: "x" } };
}

test("alinharPar de sequências idênticas casa tudo, sem lacuna", () => {
  const r = alinharPar(["A", "B", "C"], ["A", "B", "C"]);
  assert.deepEqual(r, [[0, 0], [1, 1], [2, 2]]);
});

test("alinharPar marca lacuna do lado que não tem o item", () => {
  // b não tem "B" -- Y deve ficar sem par em b
  const r = alinharPar(["A", "B", "C"], ["A", "C"]);
  assert.deepEqual(r, [[0, 0], [1, null], [2, 1]]);
});

test("alinharCiclos usa o ciclo com mais fatias como referência", () => {
  const c1 = { cicloIndice: 1, fatias: [fatia(1, "a", "X")] };
  const c2 = { cicloIndice: 2, fatias: [fatia(1, "a", "X"), fatia(2, "b", "Y")] };
  const { cicloReferenciaIndice } = alinharCiclos([c1, c2]);
  assert.equal(cicloReferenciaIndice, 2);
});

test("alinharCiclos monta uma coluna por ação da referência, com lacuna visível quando falta", () => {
  const c1 = { cicloIndice: 1, fatias: [fatia(1, "a", "X"), fatia(2, "b", "Y"), fatia(3, "c", "Z")] };
  const c2 = { cicloIndice: 2, fatias: [fatia(1, "a", "X"), fatia(2, "c", "Z")] }; // falta Y
  const { colunas } = alinharCiclos([c1, c2]);
  assert.equal(colunas.length, 3);
  assert.equal(colunas[0][2].leituraSemantica.objeto, "X");
  assert.equal(colunas[1][2], null); // lacuna: Y não existe no ciclo 2
  assert.equal(colunas[2][2].leituraSemantica.objeto, "Z");
});

test("calcularFrequencias conta presença por coluna, incluindo lacunas explícitas", () => {
  const colunas = [{ 1: fatia(1, "a", "X"), 2: fatia(1, "a", "X"), 3: fatia(1, "a", "X") }, { 1: fatia(2, "b", "Y"), 2: null, 3: fatia(2, "b", "Y") }];
  const freq = calcularFrequencias(colunas, 3);
  assert.deepEqual(freq, [
    { presentes: 3, totalCiclos: 3, percentual: 100 },
    { presentes: 2, totalCiclos: 3, percentual: 67 },
  ]);
});

test("separarNucleoEExcecoes usa o corte de 80% por padrão", () => {
  const colunas = [{ a: 1 }, { a: 1 }];
  const frequencias = [
    { presentes: 3, totalCiclos: 3, percentual: 100 },
    { presentes: 2, totalCiclos: 3, percentual: 67 },
  ];
  const { nucleo, excecoes } = separarNucleoEExcecoes(colunas, frequencias);
  assert.equal(nucleo.length, 1);
  assert.equal(excecoes.length, 1);
  assert.equal(nucleo[0].frequencia.percentual, 100);
  assert.equal(excecoes[0].frequencia.percentual, 67);
});

test("escolherCicloExemplar prioriza aderência ao núcleo, desempata pela duração mais próxima da mediana", () => {
  const c1 = { cicloIndice: 1, fatias: [fatia(1, "a", "X"), fatia(2, "b", "Z")] };
  const c2 = { cicloIndice: 2, fatias: [fatia(1, "a", "X"), fatia(2, "b", "Z")] };
  const nucleo = [{ coluna: { 1: fatia(1, "a", "X"), 2: fatia(1, "a", "X") } }, { coluna: { 1: fatia(2, "b", "Z"), 2: fatia(2, "b", "Z") } }];
  const listaCiclos = [
    { indice: 1, duracaoSegundos: 10 },
    { indice: 2, duracaoSegundos: 10.5 },
  ];
  const exemplar = escolherCicloExemplar([c1, c2], listaCiclos, nucleo);
  // ambos têm a mesma aderência (2/2); o desempate é a duração mais próxima da
  // "mediana" (o elemento do meio da lista ordenada, não a média — com 2
  // ciclos isso é o maior dos dois, 10.5), que é exatamente a duração do
  // ciclo 2 (distância zero) contra 0.5 do ciclo 1.
  assert.equal(exemplar, 2);
});

test("montarConsenso exclui ciclos suspeitos — 'não usar no consenso' vira exclusão de verdade (F04-05)", () => {
  const c1 = { cicloIndice: 1, fatias: [fatia(1, "a", "X")] };
  const c2 = { cicloIndice: 2, fatias: [fatia(1, "a", "X")] };
  const c3 = { cicloIndice: 3, fatias: [fatia(1, "a", "X")] };
  const listaCiclos = [
    { indice: 1, suspeito: true, duracaoSegundos: 5 },
    { indice: 2, suspeito: false, duracaoSegundos: 10 },
    { indice: 3, suspeito: true, duracaoSegundos: 20 },
  ];
  const consenso = montarConsenso([c1, c2, c3], listaCiclos);
  assert.deepEqual(consenso.ciclosConsiderados.sort(), [2]);
  assert.equal(consenso.totalCiclosConsiderados, 1);
  assert.equal(consenso.cicloReferenciaIndice, 2);
});

test("regressão: montarConsenso escolhe o exemplar pela mediana dos ciclos NÃO suspeitos, não a lista completa", () => {
  // Aderência igual nos dois ciclos considerados (mesma única ação no
  // núcleo) -- o desempate cai 100% na duração mais próxima da mediana.
  // Mediana só dos NÃO suspeitos ([10, 20], correto) = 20 -> ciclo 3
  // vence. Mediana da lista completa ([5, 10, 20], o bug antigo,
  // contaminada pelo ciclo suspeito) = 10 -> ciclo 2 venceria em vez.
  const c1 = { cicloIndice: 1, fatias: [fatia(1, "a", "X")] };
  const c2 = { cicloIndice: 2, fatias: [fatia(1, "a", "X")] };
  const c3 = { cicloIndice: 3, fatias: [fatia(1, "a", "X")] };
  const listaCiclos = [
    { indice: 1, suspeito: true, duracaoSegundos: 5 },
    { indice: 2, suspeito: false, duracaoSegundos: 10 },
    { indice: 3, suspeito: false, duracaoSegundos: 20 },
  ];
  const consenso = montarConsenso([c1, c2, c3], listaCiclos);
  assert.equal(consenso.cicloExemplarIndice, 3);
});

test("montarConsenso com todos os ciclos limpos: X e Z no núcleo, Y na exceção", () => {
  const c1 = { cicloIndice: 1, fatias: [fatia(1, "a", "X"), fatia(2, "b", "Y"), fatia(3, "c", "Z")] };
  const c2 = { cicloIndice: 2, fatias: [fatia(1, "a", "X"), fatia(2, "c", "Z")] };
  const c3 = { cicloIndice: 3, fatias: [fatia(1, "a", "X"), fatia(2, "b", "Y"), fatia(3, "c", "Z")] };
  const listaCiclos = [
    { indice: 1, suspeito: false, duracaoSegundos: 10 },
    { indice: 2, suspeito: false, duracaoSegundos: 8 },
    { indice: 3, suspeito: false, duracaoSegundos: 10.5 },
  ];
  const consenso = montarConsenso([c1, c2, c3], listaCiclos);
  assert.equal(consenso.nucleo.length, 2);
  assert.equal(consenso.excecoes.length, 1);
  assert.deepEqual(
    consenso.nucleo.map((n) => Object.values(n.coluna)[0].leituraSemantica.objeto).sort(),
    ["X", "Z"]
  );
  assert.equal(Object.values(consenso.excecoes[0].coluna).find(Boolean).leituraSemantica.objeto, "Y");
  assert.equal(consenso.cicloExemplarIndice, 1);
});
