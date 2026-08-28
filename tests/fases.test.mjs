// Testes do pacote 1.2.4 (interface por etapa) — só a integridade dos
// metadados estáticos. O comportamento na tela é coberto por checagem manual
// no navegador (ver browser-check no scratchpad da sessão).

import { test } from "node:test";
import assert from "node:assert/strict";

import { FASES } from "../js/fases.js";
import { SECOES } from "../js/dossie.js";

test("há exatamente 17 fases, numeradas 00 a 16 em ordem", () => {
  assert.equal(FASES.length, 17);
  FASES.forEach((fase, i) => {
    assert.equal(fase.numero, String(i).padStart(2, "0"));
  });
});

test("toda fase tem título, entra, sai e gate preenchidos", () => {
  for (const fase of FASES) {
    assert.ok(fase.titulo, `fase ${fase.numero} sem título`);
    assert.ok(fase.entra, `fase ${fase.numero} sem "entra"`);
    assert.ok(fase.sai, `fase ${fase.numero} sem "sai"`);
    assert.ok(fase.gate, `fase ${fase.numero} sem "gate"`);
    assert.ok(["padrao", "pago", "humano"].includes(fase.tipo), `fase ${fase.numero} com tipo inválido: ${fase.tipo}`);
  }
});

test("secaoDossie de cada fase é nula ou uma seção real do dossiê", () => {
  for (const fase of FASES) {
    if (fase.secaoDossie !== null) {
      assert.ok(SECOES.includes(fase.secaoDossie), `fase ${fase.numero} aponta para seção inexistente: ${fase.secaoDossie}`);
    }
  }
});

test("só a fase 01 é o container do dossiê", () => {
  const containers = FASES.filter((f) => f.ehContainer);
  assert.equal(containers.length, 1);
  assert.equal(containers[0].numero, "01");
});
