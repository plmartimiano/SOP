// Testes do pacote 1.5.1 + 1.5.2 + 1.5.3 (inventário, relatório,
// alternativas de agrupamento). Cenários pequenos e hand-verificados,
// desenhados pra separar claramente o que cada critério de fusão faz
// (o diagnóstico inicial usou dados que faziam "ferramenta" e "componente"
// coincidirem por acaso — os cenários aqui evitam isso de propósito).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  inventariarComponentes,
  inventariarFerramentas,
  contarFronteirasEstaveis,
  detectarPausasDeConferencia,
  gerarRelatorio,
  fundirAteSeis,
  proporAlternativas,
} from "../js/agrupamento.js";

function fatia(inicioSegundos, fimSegundos, causa, verbo, objeto, ferramenta) {
  return {
    inicioSegundos,
    fimSegundos,
    causa,
    leituraSemantica: { verbo, objeto, ferramenta: ferramenta || "nenhuma", mao: "direita", pontoDeAplicacao: "x", confianca: 90 },
  };
}

test("inventariarComponentes conta só fronteiras de componente_novo/combinada, por nome do objeto", () => {
  const porCiclo = [
    {
      cicloIndice: 1,
      fatias: [
        fatia(0, 1, "componente_novo", "posicionar", "Suporte L-32"),
        fatia(1, 2, "troca_ferramenta", "parafusar", "Suporte L-32", "Chave"),
        fatia(2, 3, "componente_novo", "posicionar", "Suporte L-32"),
        fatia(3, 4, "componente_novo", "posicionar", "Parafuso M4"),
      ],
    },
  ];
  const componentes = inventariarComponentes(porCiclo);
  assert.deepEqual(
    componentes.sort((a, b) => a.nomeOficial.localeCompare(b.nomeOficial)),
    [
      { nomeOficial: "Parafuso M4", ocorrencias: 1 },
      { nomeOficial: "Suporte L-32", ocorrencias: 2 },
    ]
  );
});

test("inventariarFerramentas soma tempo total e conta pegadas", () => {
  const porCiclo = [
    {
      cicloIndice: 1,
      fatias: [fatia(0, 2, "troca_ferramenta", "parafusar", "X", "Chave de torque"), fatia(2, 3.5, "troca_ferramenta", "parafusar", "X", "Chave de torque")],
    },
  ];
  const ferramentas = inventariarFerramentas(porCiclo);
  assert.deepEqual(ferramentas, [{ nomeOficial: "Chave de torque", pegadas: 2, tempoTotalSegundos: 3.5 }]);
});

function entradaNucleo(acao, causa, objeto, ferramenta, duracaoSegundos) {
  return {
    acao,
    percentual: 100,
    presentes: 1,
    porCiclo: { 1: fatia(0, duracaoSegundos, causa, acao, objeto, ferramenta) },
  };
}

test("contarFronteirasEstaveis totaliza e classifica por causa", () => {
  const nucleo = [
    entradaNucleo("a", "componente_novo", "X", null, 1),
    entradaNucleo("b", "componente_novo", "Y", null, 1),
    entradaNucleo("c", "pausa_conferencia", "X", null, 1),
  ];
  assert.deepEqual(contarFronteirasEstaveis(nucleo), { total: 3, porCausa: { componente_novo: 2, pausa_conferencia: 1 } });
});

test("detectarPausasDeConferencia pega só as entradas com essa causa", () => {
  const nucleo = [entradaNucleo("a", "componente_novo", "X", null, 1), entradaNucleo("b", "pausa_conferencia", "X", null, 1)];
  const pausas = detectarPausasDeConferencia(nucleo);
  assert.equal(pausas.length, 1);
  assert.equal(pausas[0].acao, "b");
});

test("gerarRelatorio escreve o número certo com o plural certo, singular quando é 1", () => {
  const texto = gerarRelatorio({
    componentes: [{ nomeOficial: "X" }],
    ferramentas: [{ nomeOficial: "Y" }, { nomeOficial: "Z" }],
    fronteiras: { total: 1 },
    pausasConferencia: [],
    duracaoCicloSegundos: 192,
  });
  assert.equal(texto, "Esta estação tem 1 componente, 2 ferramentas, 1 ação estável, 0 verificações, ciclo de 3min12s.");
});

test("fundirAteSeis não mexe se já tem 6 ou menos grupos", () => {
  const acoes = [1, 2, 3].map((i) => ({ rotulo: `a${i}`, causa: "x", ferramenta: null, objeto: null, duracaoMediaSegundos: 1, naoFundivel: false }));
  const { grupos, completo } = fundirAteSeis(acoes, () => 0, 6);
  assert.equal(grupos.length, 3);
  assert.equal(completo, false); // "completo" é sinônimo de "chegou exatamente em maxGrupos"
});

test("fundirAteSeis nunca funde um grupo não-fundível, mesmo que seja o mais parecido", () => {
  const acoes = [
    { rotulo: "a", causa: "x", ferramenta: "F", objeto: null, duracaoMediaSegundos: 1, naoFundivel: false },
    { rotulo: "pausa", causa: "pausa_conferencia", ferramenta: null, objeto: null, duracaoMediaSegundos: 1, naoFundivel: true },
    { rotulo: "b", causa: "x", ferramenta: "F", objeto: null, duracaoMediaSegundos: 1, naoFundivel: false },
  ];
  // pede 1 grupo só -- a e b têm a mesma ferramenta (fundíveis um com o outro
  // não são vizinhos, então não fundem), e "pausa" bloqueia entre eles.
  const similaridade = (x, y) => (x.ferramenta && x.ferramenta === y.ferramenta ? 5 : 0);
  const { grupos } = fundirAteSeis(acoes, similaridade, 1);
  assert.equal(grupos.length, 3); // não conseguiu fundir nada -- "pausa" separa os dois únicos fundíveis
});

test("proporAlternativas: critério 'ferramenta compartilhada' funde só quem tem a mesma ferramenta", () => {
  // A e C têm a mesma ferramenta mas não são vizinhos -- só B/C são vizinhos com ferramentas iguais
  const nucleo = [
    entradaNucleo("um", "componente_novo", "P1", null, 1),
    entradaNucleo("dois", "troca_ferramenta", "P1", "Chave", 1),
    entradaNucleo("tres", "troca_ferramenta", "P2", "Chave", 1),
    entradaNucleo("quatro", "componente_novo", "P3", null, 1),
    entradaNucleo("cinco", "componente_novo", "P4", null, 1),
    entradaNucleo("seis", "componente_novo", "P5", null, 1),
    entradaNucleo("sete", "componente_novo", "P6", null, 1),
  ];
  const [alt] = proporAlternativas(nucleo, ["ferramenta_compartilhada"]);
  assert.equal(alt.totalPassos, 6);
  assert.equal(alt.passos[1].titulo, "dois + tres"); // os dois com "Chave", vizinhos, viram um passo só
});

test("proporAlternativas: critério 'equilíbrio de tempo' funde os vizinhos mais curtos primeiro", () => {
  const nucleo = [
    entradaNucleo("longo1", "componente_novo", "P1", null, 10),
    entradaNucleo("curto1", "componente_novo", "P2", null, 1),
    entradaNucleo("curto2", "componente_novo", "P3", null, 1),
    entradaNucleo("longo2", "componente_novo", "P4", null, 10),
    entradaNucleo("m1", "componente_novo", "P5", null, 5),
    entradaNucleo("m2", "componente_novo", "P6", null, 5),
    entradaNucleo("m3", "componente_novo", "P7", null, 5),
  ];
  const [alt] = proporAlternativas(nucleo, ["equilibrio_tempo"]);
  assert.equal(alt.totalPassos, 6);
  assert.equal(alt.passos[1].titulo, "curto1 + curto2"); // par mais curto (1+1=2s) funde primeiro
});

test("proporAlternativas sinaliza quando a fusão cruza causas diferentes (custo)", () => {
  const nucleo = [
    entradaNucleo("um", "componente_novo", "P1", null, 1),
    entradaNucleo("dois", "troca_ferramenta", "P1", "Chave", 1),
    entradaNucleo("tres", "componente_novo", "P2", null, 1),
    entradaNucleo("quatro", "componente_novo", "P3", null, 1),
    entradaNucleo("cinco", "componente_novo", "P4", null, 1),
    entradaNucleo("seis", "componente_novo", "P5", null, 1),
    entradaNucleo("sete", "componente_novo", "P6", null, 1),
  ];
  const [alt] = proporAlternativas(nucleo, ["mesmo_componente"]);
  assert.equal(alt.custos.length > 0, true);
  assert.match(alt.custos[0].motivo, /componente_novo.*troca_ferramenta|troca_ferramenta.*componente_novo/);
});

test("proporAlternativas com menos de 6 ações não força: totalPassos fica abaixo de 6 e completo é false", () => {
  const nucleo = [entradaNucleo("um", "componente_novo", "P1", null, 1), entradaNucleo("dois", "componente_novo", "P2", null, 1)];
  const [alt] = proporAlternativas(nucleo, ["mesmo_componente"]);
  assert.equal(alt.totalPassos, 2);
  assert.equal(alt.completo, false);
});
