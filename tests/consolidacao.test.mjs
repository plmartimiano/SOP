import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarRegraHomologada } from "../js/consolidacao.js";

function fatia({ causa, objeto, ferramenta = "nenhuma", inicio, fim }) {
  return { causa, leituraSemantica: { objeto, ferramenta }, inicioSegundos: inicio, fimSegundos: fim };
}

// Núcleo com 8 ações estáveis, iguais ao fixture usado na validação de
// navegador da fase 08 -- mesma base de dados, pra que os dois pacotes
// (prévia na 08, aplicação na 09) fiquem comparáveis.
const NUCLEO_8_ACOES = [
  { acao: "posicionar Suporte L-32", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Suporte L-32", inicio: 0, fim: 1 }) } },
  { acao: "encaixar Suporte L-32", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Suporte L-32", inicio: 1, fim: 2 }) } },
  { acao: "parafusar Suporte L-32", porCiclo: { 2: fatia({ causa: "troca_ferramenta", objeto: "Suporte L-32", ferramenta: "Chave de torque", inicio: 2, fim: 4 }) } },
  { acao: "testar Suporte L-32", porCiclo: { 2: fatia({ causa: "pausa_conferencia", objeto: "Suporte L-32", inicio: 4, fim: 5 }) } },
  { acao: "posicionar Parafuso M4", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Parafuso M4", inicio: 5, fim: 5.8 }) } },
  { acao: "parafusar Parafuso M4", porCiclo: { 2: fatia({ causa: "troca_ferramenta", objeto: "Parafuso M4", ferramenta: "Chave de torque", inicio: 5.8, fim: 7.3 }) } },
  { acao: "conectar Conector J3", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Conector J3", inicio: 7.3, fim: 8.5 }) } },
  { acao: "transferir Produto", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Produto", inicio: 8.5, fim: 9.5 }) } },
];

test("aplica o critério homologado e reduz a 6 passos, na ordem original", () => {
  const r = aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "ferramenta_compartilhada" });
  assert.equal(r.completo, true);
  assert.equal(r.passos.length, 6);
  assert.deepEqual(
    r.passos.map((p) => p.titulo),
    [
      "posicionar Suporte L-32 + encaixar Suporte L-32 + parafusar Suporte L-32",
      "testar Suporte L-32",
      "posicionar Parafuso M4",
      "parafusar Parafuso M4",
      "conectar Conector J3",
      "transferir Produto",
    ],
  );
});

test("marca como duvidosa a fusão que cruza causa diferente, e só essa", () => {
  const r = aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "ferramenta_compartilhada" });
  const duvidosos = r.passos.filter((p) => p.duvidosa).map((p) => p.titulo);
  assert.deepEqual(duvidosos, ["posicionar Suporte L-32 + encaixar Suporte L-32 + parafusar Suporte L-32"]);
});

test("a verificação de conferência nunca é fundida -- sobrevive como passo próprio", () => {
  const r = aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "ferramenta_compartilhada" });
  assert.equal(r.verificacoesNoNucleo, 1);
  assert.equal(r.verificacoesNosPassos, 1);
  assert.ok(r.passos.some((p) => p.titulo === "testar Suporte L-32" && !p.duvidosa));
});

test("critérios diferentes produzem agrupamentos diferentes sobre o mesmo núcleo", () => {
  const porFerramenta = aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "ferramenta_compartilhada" });
  const porTempo = aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "equilibrio_tempo" });
  assert.notDeepEqual(porFerramenta.passos.map((p) => p.titulo), porTempo.passos.map((p) => p.titulo));
  assert.equal(porTempo.criterioAplicado.nome, "Por equilíbrio de tempo");
});

test("critério desconhecido no dossiê não trava -- devolve erro legível em vez de exceção", () => {
  const r = aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "criterio_que_nao_existe" });
  assert.ok(r.erro);
  assert.match(r.erro, /criterio_que_nao_existe/);
});

test("com menos de 6 ações não força -- completo fica false, sem inventar passo", () => {
  const r = aplicarRegraHomologada(NUCLEO_8_ACOES.slice(0, 3), { criterioEscolhido: "ferramenta_compartilhada" });
  assert.equal(r.completo, false);
  assert.ok(r.passos.length < 6);
});
