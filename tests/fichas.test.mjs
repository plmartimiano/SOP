import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarFichas, verificarCamposObrigatorios } from "../js/fichas.js";
import { aplicarRegraHomologada } from "../js/consolidacao.js";

function fatia({ causa, objeto, ferramenta = "nenhuma", mao = "direita", inicio, fim }) {
  return {
    causa,
    leituraSemantica: { objeto, ferramenta, mao, pontoDeAplicacao: "bancada", confianca: 90 },
    inicioSegundos: inicio,
    fimSegundos: fim,
  };
}

// Mesmo núcleo de 8 ações usado nos testes de fase 08/09 -- comparável
// entre os três pacotes -- com mãos e ferramentas suficientes pra exercer
// os campos novos desta fase.
const NUCLEO_8_ACOES = [
  { acao: "posicionar Suporte L-32", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Suporte L-32", mao: "esquerda", inicio: 0, fim: 1 }) } },
  { acao: "encaixar Suporte L-32", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Suporte L-32", mao: "esquerda", inicio: 1, fim: 2 }) } },
  { acao: "parafusar Suporte L-32", porCiclo: { 2: fatia({ causa: "troca_ferramenta", objeto: "Suporte L-32", ferramenta: "Chave de torque", mao: "direita", inicio: 2, fim: 4 }) } },
  { acao: "testar Suporte L-32", porCiclo: { 2: fatia({ causa: "pausa_conferencia", objeto: "Suporte L-32", inicio: 4, fim: 5 }) } },
  { acao: "posicionar Parafuso M4", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Parafuso M4", inicio: 5, fim: 5.8 }) } },
  { acao: "parafusar Parafuso M4", porCiclo: { 2: fatia({ causa: "troca_ferramenta", objeto: "Parafuso M4", ferramenta: "Chave de torque", inicio: 5.8, fim: 7.3 }) } },
  { acao: "conectar Conector J3", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Conector J3", inicio: 7.3, fim: 8.5 }) } },
  { acao: "transferir Produto", porCiclo: { 2: fatia({ causa: "componente_novo", objeto: "Produto", inicio: 8.5, fim: 9.5 }) } },
];

function gerarPassos() {
  return aplicarRegraHomologada(NUCLEO_8_ACOES, { criterioEscolhido: "ferramenta_compartilhada" }).passos;
}

test("agrega mãos e ferramenta de todas as ações fundidas num passo", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  const passo1 = fichas[0]; // "posicionar + encaixar + parafusar Suporte L-32"
  assert.deepEqual(passo1.maos.sort(), ["direita", "esquerda"]);
  assert.deepEqual(passo1.ferramentas, ["Chave de torque"]);
  assert.deepEqual(passo1.pecas, ["Suporte L-32"]);
});

test("trechoVideo cobre do início da primeira ação ao fim da última do passo", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  assert.deepEqual(fichas[0].trechoVideo, { inicioSegundos: 0, fimSegundos: 4 });
});

test("critério de conclusão marca conferência quando o passo tem uma pausa_conferencia", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  const passoTeste = fichas.find((f) => f.titulo === "testar Suporte L-32");
  assert.match(passoTeste.criterioConclusao, /conferência visual/);
});

test("critério de conclusão sem pausa_conferencia cita a última ação do passo", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  const passoProduto = fichas.find((f) => f.titulo === "transferir Produto");
  assert.match(passoProduto.criterioConclusao, /transferir Produto/);
});

test("risco nunca é inventado -- sempre o mesmo texto de \"não avaliado\"", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  assert.ok(fichas.every((f) => /[Nn]ão avaliado automaticamente/.test(f.risco)));
});

test("estado do produto acumula peças na ordem dos passos, sem repetir", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  assert.deepEqual(fichas[0].estadoProdutoAntes, []);
  assert.deepEqual(fichas[0].estadoProdutoDepois, ["Suporte L-32"]);
  const ultimo = fichas[fichas.length - 1];
  assert.deepEqual(ultimo.estadoProdutoDepois, ["Suporte L-32", "Parafuso M4", "Conector J3", "Produto"]);
});

test("passo sem peça nova (ex: verificação) não altera o estado do produto", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  const passoTeste = fichas.find((f) => f.titulo === "testar Suporte L-32");
  assert.deepEqual(passoTeste.estadoProdutoAntes, passoTeste.estadoProdutoDepois);
});

test("usa o ciclo alternativo quando a ação não tem dado no ciclo exemplar pedido", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 999); // ciclo 999 não existe em nenhuma ação
  assert.ok(fichas.every((f) => f.usouCicloAlternativo === true));
  assert.deepEqual(fichas[0].trechoVideo, { inicioSegundos: 0, fimSegundos: 4 }); // mesmo assim acha o dado certo
});

test("verificarCamposObrigatorios não acusa nada numa ficha bem formada", () => {
  const fichas = gerarFichas(gerarPassos(), NUCLEO_8_ACOES, 2);
  for (const ficha of fichas) {
    assert.deepEqual(verificarCamposObrigatorios(ficha), []);
  }
});

test("verificarCamposObrigatorios acusa trechoVideo ausente quando a origem não resolve nenhuma fatia", () => {
  const ficha = {
    titulo: "passo fantasma",
    criterioConclusao: "x",
    risco: "y",
    trechoVideo: null,
  };
  assert.deepEqual(verificarCamposObrigatorios(ficha), ["trechoVideo"]);
});
