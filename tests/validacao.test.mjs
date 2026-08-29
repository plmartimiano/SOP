import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularCorrecoes, aplicarCorrecoes, validarAssinatura, montarAprovacao } from "../js/validacao.js";

function fichaBase(overrides = {}) {
  return {
    numero: 1,
    titulo: "posicionar Suporte L-32",
    maos: ["direita"],
    ferramentas: [],
    pecas: ["Suporte L-32"],
    criterioConclusao: "Concluído ao finalizar a última ação do passo.",
    risco: "Não avaliado automaticamente — sem fonte de dado de risco no pipeline até aqui. Revisar na fase 11.",
    estadoProdutoAntes: [],
    estadoProdutoDepois: ["Suporte L-32"],
    ...overrides,
  };
}

test("calcularCorrecoes não acusa nada quando nada mudou", () => {
  const ficha = fichaBase();
  const correcoes = calcularCorrecoes(ficha, ficha);
  assert.deepEqual(correcoes, {});
});

test("calcularCorrecoes só registra o campo que de fato mudou", () => {
  const ficha = fichaBase();
  const editado = { ...ficha, risco: "Risco de esmagamento — usar EPI." };
  const correcoes = calcularCorrecoes(ficha, editado);
  assert.deepEqual(Object.keys(correcoes), ["risco"]);
  assert.deepEqual(correcoes.risco, { original: ficha.risco, corrigido: "Risco de esmagamento — usar EPI." });
});

test("calcularCorrecoes compara listas por conteúdo, não por identidade do array", () => {
  const ficha = fichaBase({ maos: ["direita"] });
  const editado = { ...ficha, maos: ["direita"] }; // array novo, mesmo conteúdo
  assert.deepEqual(calcularCorrecoes(ficha, editado), {});
});

test("calcularCorrecoes detecta mudança dentro de uma lista", () => {
  const ficha = fichaBase({ maos: ["direita"] });
  const editado = { ...ficha, maos: ["direita", "esquerda"] };
  const correcoes = calcularCorrecoes(ficha, editado);
  assert.deepEqual(correcoes.maos, { original: ["direita"], corrigido: ["direita", "esquerda"] });
});

test("calcularCorrecoes ignora titulo e estadoProduto -- não são campos editáveis", () => {
  const ficha = fichaBase();
  const editado = { ...ficha, titulo: "outro nome", estadoProdutoDepois: ["outra coisa"] };
  assert.deepEqual(calcularCorrecoes(ficha, editado), {});
});

test("aplicarCorrecoes nunca sobrescreve o original -- ele continua acessível na correção", () => {
  const ficha = fichaBase();
  const correcoes = calcularCorrecoes(ficha, { ...ficha, risco: "Corrigido." });
  const final = aplicarCorrecoes(ficha, correcoes);
  assert.equal(final.risco, "Corrigido.");
  assert.equal(correcoes.risco.original, ficha.risco); // original preservado, não sumiu
  assert.equal(ficha.risco, "Não avaliado automaticamente — sem fonte de dado de risco no pipeline até aqui. Revisar na fase 11.");
});

test("validarAssinatura exige nome e cargo, aceita espaço em branco como vazio", () => {
  assert.deepEqual(validarAssinatura({ nome: "", cargo: "" }), ["Nome é obrigatório.", "Cargo é obrigatório."]);
  assert.deepEqual(validarAssinatura({ nome: "   ", cargo: "QA" }), ["Nome é obrigatório."]);
  assert.deepEqual(validarAssinatura({ nome: "Ana", cargo: "QA" }), []);
});

test("montarAprovacao junta original + correções + final por ficha, e conta o total de correções", () => {
  const f1 = fichaBase({ numero: 1 });
  const f2 = fichaBase({ numero: 2, titulo: "testar Suporte L-32", risco: "Nenhum risco identificado." });
  const correcoesF1 = calcularCorrecoes(f1, { ...f1, risco: "Corrigido no passo 1." });
  const resultado = montarAprovacao([f1, f2], { 1: correcoesF1 }, { nome: "Ana", cargo: "QA" });

  assert.equal(resultado.fichas.length, 2);
  assert.equal(resultado.fichas[0].final.risco, "Corrigido no passo 1.");
  assert.equal(resultado.fichas[0].original.risco, f1.risco);
  assert.deepEqual(resultado.fichas[1].correcoes, {}); // passo 2 não teve correção
  assert.equal(resultado.fichas[1].final.risco, "Nenhum risco identificado.");
  assert.equal(resultado.aprovacao.responsavel, "Ana");
  assert.equal(resultado.aprovacao.cargo, "QA");
  assert.equal(resultado.aprovacao.totalCorrecoes, 1);
  assert.ok(resultado.aprovacao.dataHora);
});

test("montarAprovacao com zero correções ainda registra a aprovação -- aceitar como está é uma decisão válida", () => {
  const f1 = fichaBase();
  const resultado = montarAprovacao([f1], {}, { nome: "Ana", cargo: "QA" });
  assert.equal(resultado.aprovacao.totalCorrecoes, 0);
  assert.deepEqual(resultado.fichas[0].final, f1);
});
