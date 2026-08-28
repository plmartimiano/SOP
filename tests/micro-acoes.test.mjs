// Testes do pacote 1.3.6 (fatiamento em micro-ações). Dados sintéticos
// pequenos o bastante pra conferir o resultado esperado na mão.

import { test } from "node:test";
import assert from "node:assert/strict";

import { acharVales, filtrarValesProximos, classificarFronteira, montarFatias, fatiarCiclos } from "../js/micro-acoes.js";

const TEMPOS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const VALORES = [50, 80, 10, 80, 10, 80, 10, 80, 50]; // três vales nítidos em t=1, t=2, t=3

function curvaTeste() {
  return TEMPOS.map((t, i) => ({ tempoSegundos: t, valorSuavizado: VALORES[i] }));
}

test("acharVales encontra os três mínimos locais nítidos", () => {
  assert.deepEqual(acharVales(curvaTeste(), 0, 4), [1, 2, 3]);
});

test("acharVales ignora fora do intervalo do ciclo", () => {
  assert.deepEqual(acharVales(curvaTeste(), 0, 1.5), [1]);
});

test("filtrarValesProximos mantém vales já espaçados o bastante", () => {
  assert.deepEqual(filtrarValesProximos([1, 2, 3], 0.5), [1, 2, 3]);
});

test("filtrarValesProximos junta vales mais próximos que a distância mínima", () => {
  assert.deepEqual(filtrarValesProximos([1, 1.2, 1.3, 3], 0.5), [1, 3]);
});

test("filtrarValesProximos com lista vazia devolve lista vazia", () => {
  assert.deepEqual(filtrarValesProximos([], 0.5), []);
});

function zonasTeste() {
  return [
    { id: "Z01", tipo: "escaninho", nomeOficial: "Escaninho A" },
    { id: "Z02", tipo: "ferramenta", nomeOficial: "Ferramenta B" },
  ];
}

function curvaPorZonaTeste() {
  return {
    Z01: TEMPOS.map((t) => ({ tempoSegundos: t, valorSuavizado: Math.abs(t - 1) < 0.3 ? 100 : 2 })),
    Z02: TEMPOS.map((t) => ({ tempoSegundos: t, valorSuavizado: Math.abs(t - 2) < 0.3 ? 100 : 2 })),
  };
}

test("classificarFronteira acha componente_novo quando o pico é numa zona de escaninho", () => {
  const r = classificarFronteira(1, curvaPorZonaTeste(), zonasTeste());
  assert.equal(r.causa, "componente_novo");
  assert.deepEqual(r.zonasEnvolvidas, ["Z01"]);
});

test("classificarFronteira acha troca_ferramenta quando o pico é numa zona de ferramenta", () => {
  const r = classificarFronteira(2, curvaPorZonaTeste(), zonasTeste());
  assert.equal(r.causa, "troca_ferramenta");
});

test("classificarFronteira acha pausa_conferencia sem sinal de zona nenhuma", () => {
  const r = classificarFronteira(3, curvaPorZonaTeste(), zonasTeste());
  assert.equal(r.causa, "pausa_conferencia");
  assert.deepEqual(r.zonasEnvolvidas, []);
});

test("classificarFronteira acha combinada quando escaninho e ferramenta pico no mesmo instante", () => {
  const zonas = zonasTeste();
  const curvaPorZona = {
    Z01: TEMPOS.map((t) => ({ tempoSegundos: t, valorSuavizado: Math.abs(t - 1) < 0.3 ? 100 : 2 })),
    Z02: TEMPOS.map((t) => ({ tempoSegundos: t, valorSuavizado: Math.abs(t - 1) < 0.3 ? 100 : 2 })),
  };
  const r = classificarFronteira(1, curvaPorZona, zonas);
  assert.equal(r.causa, "combinada");
});

test("classificarFronteira sem zonas nenhuma sempre dá pausa_conferencia", () => {
  const r = classificarFronteira(1, {}, []);
  assert.equal(r.causa, "pausa_conferencia");
});

function frame(tempoSegundos, valor) {
  return { tempoSegundos, cinzas: Float64Array.from([valor]) };
}

test("montarFatias corta em 4 fatias nos vales encontrados, com fronteiras certas", () => {
  const frames = TEMPOS.map((t, i) => frame(t, VALORES[i]));
  const ciclo = { indice: 1, inicioSegundos: 0, fimSegundos: 4 };
  const fatias = montarFatias(frames, curvaTeste(), ciclo, { curvaPorZona: curvaPorZonaTeste(), zonas: zonasTeste() });

  assert.equal(fatias.length, 4);
  assert.deepEqual(
    fatias.map((f) => [f.inicioSegundos, f.fimSegundos]),
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]
  );
  assert.deepEqual(
    fatias.map((f) => f.causa),
    ["pausa_conferencia", "componente_novo", "troca_ferramenta", "pausa_conferencia"]
  );
});

test("montarFatias escolhe como frame-chave o instante de maior movimento dentro da fatia", () => {
  const frames = TEMPOS.map((t, i) => frame(t, VALORES[i]));
  const ciclo = { indice: 1, inicioSegundos: 0, fimSegundos: 4 };
  const fatias = montarFatias(frames, curvaTeste(), ciclo, {});

  // fatia [0,1]: pontos em t=0(50), t=0.5(80), t=1(10) -- pico em t=0.5
  assert.equal(fatias[0].frameChave.tempoSegundos, 0.5);
  // fatia [1,2]: pontos em t=1(10), t=1.5(80), t=2(10) -- pico em t=1.5
  assert.equal(fatias[1].frameChave.tempoSegundos, 1.5);
});

test("montarFatias guarda o contexto de antes/depois do frame-chave", () => {
  const frames = TEMPOS.map((t, i) => frame(t, VALORES[i]));
  const ciclo = { indice: 1, inicioSegundos: 0, fimSegundos: 4 };
  const fatias = montarFatias(frames, curvaTeste(), ciclo, {});
  const primeira = fatias[0]; // frame-chave em t=0.5 -> antes t=0, depois t=1
  assert.equal(primeira.contextoAntesSegundos, 0);
  assert.equal(primeira.contextoDepoisSegundos, 1);
});

test("montarFatias sem vale nenhum dá uma única fatia cobrindo o ciclo inteiro", () => {
  const curvaPlana = TEMPOS.map((t) => ({ tempoSegundos: t, valorSuavizado: 5 }));
  const frames = TEMPOS.map((t) => frame(t, 5));
  const ciclo = { indice: 1, inicioSegundos: 0, fimSegundos: 4 };
  const fatias = montarFatias(frames, curvaPlana, ciclo, {});
  assert.equal(fatias.length, 1);
  assert.equal(fatias[0].inicioSegundos, 0);
  assert.equal(fatias[0].fimSegundos, 4);
});

test("fatiarCiclos processa vários ciclos e devolve uma entrada por cicloIndice", () => {
  const frames = TEMPOS.map((t, i) => frame(t, VALORES[i]));
  const curva = curvaTeste();
  const ciclos = [
    { indice: 1, inicioSegundos: 0, fimSegundos: 2 },
    { indice: 2, inicioSegundos: 2, fimSegundos: 4 },
  ];
  const resultado = fatiarCiclos(frames, curva, ciclos, { zonas: zonasTeste(), curvaPorZona: curvaPorZonaTeste() });
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].cicloIndice, 1);
  assert.equal(resultado[1].cicloIndice, 2);
  assert.ok(resultado[0].fatias.length >= 1);
  assert.ok(resultado[1].fatias.length >= 1);
});
