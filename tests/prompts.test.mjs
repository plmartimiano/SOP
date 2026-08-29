import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarCamadaCompartilhada,
  montarPromptQuadroMestre,
  montarPromptPasso,
  gerarPrompts,
  verificarSemPedidoDeTexto,
  verificarCobertura,
} from "../js/prompts.js";

function ficha(overrides = {}) {
  return {
    numero: 1,
    titulo: "posicionar Suporte L-32",
    maos: ["esquerda", "direita"],
    ferramentas: ["Chave de torque"],
    pecas: ["Suporte L-32"],
    estadoProdutoAntes: [],
    estadoProdutoDepois: ["Suporte L-32"],
    criterioConclusao: "Concluído ao finalizar a última ação do passo.",
    ...overrides,
  };
}

const ZONAS = [
  { nome: "Escaninho A", tipo: "escaninho" },
  { nome: "Bancada central", tipo: "area_trabalho" },
];

test("a camada compartilhada é byte a byte idêntica no quadro-mestre e em todos os prompts de passo", () => {
  const r = gerarPrompts([ficha({ numero: 1 }), ficha({ numero: 2, titulo: "outro passo" })], "Estação X", ZONAS);
  assert.ok(r.quadroMestre.startsWith(r.camadaCompartilhada));
  for (const p of r.passos) {
    assert.ok(p.prompt.startsWith(r.camadaCompartilhada));
  }
});

test("o quadro-mestre descreve a bancada vazia, sem peça/mão/operador", () => {
  const camada = montarCamadaCompartilhada("Estação X", ZONAS);
  const quadroMestre = montarPromptQuadroMestre(camada);
  assert.match(quadroMestre, /bancada vazia/);
  assert.match(quadroMestre, /sem nenhuma peça, sem mãos, sem operador/);
});

test("o prompt do passo cobre mãos, ferramenta e peças da ficha", () => {
  const camada = montarCamadaCompartilhada("Estação X", ZONAS);
  const f = ficha();
  const prompt = montarPromptPasso(f, camada);
  assert.equal(verificarCobertura(f, prompt).length, 0);
});

test("verificarCobertura acusa exatamente o que falta no texto do prompt", () => {
  const f = ficha({ pecas: ["Peça Não Mencionada"] });
  const promptSemAPeca = "um texto qualquer sem menção à peça";
  const faltando = verificarCobertura(f, promptSemAPeca);
  assert.ok(faltando.includes("peca:Peça Não Mencionada"));
});

test("nenhum prompt gerado pelo template pede texto dentro da imagem", () => {
  const r = gerarPrompts([ficha()], "Estação X", ZONAS);
  assert.deepEqual(verificarSemPedidoDeTexto(r.quadroMestre), []);
  assert.deepEqual(verificarSemPedidoDeTexto(r.passos[0].prompt), []);
});

test("verificarSemPedidoDeTexto pega um pedido de texto vindo de dado da ficha (não do template)", () => {
  const camada = montarCamadaCompartilhada("Estação X", ZONAS);
  const fichaComPedido = ficha({ criterioConclusao: "Escreva OK na etiqueta da peça." });
  const prompt = montarPromptPasso(fichaComPedido, camada);
  assert.deepEqual(verificarSemPedidoDeTexto(prompt), ["escreva"]);
});

test("gerarPrompts preserva a ordem e o número dos passos recebidos", () => {
  const r = gerarPrompts([ficha({ numero: 3, titulo: "c" }), ficha({ numero: 1, titulo: "a" })], "Estação X", ZONAS);
  assert.deepEqual(r.passos.map((p) => p.numero), [3, 1]); // a fase 12 não reordena -- confia na ordem da fase 11
});

test("o campo risco nunca entra no prompt -- é dado de segurança/documentação, não instrução visual", () => {
  const camada = montarCamadaCompartilhada("Estação X", ZONAS);
  const f = ficha({ risco: "Risco de esmagamento dos dedos -- usar luva." });
  const prompt = montarPromptPasso(f, camada);
  assert.ok(!prompt.includes("esmagamento"), "o texto do risco não deveria aparecer numa instrução de ilustração");
});

test("estação sem zonas mapeadas não quebra -- descreve isso em vez de listar vazio silenciosamente", () => {
  const camada = montarCamadaCompartilhada("Estação sem mapa", []);
  assert.match(camada, /sem zonas mapeadas/);
});
