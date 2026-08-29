// Fase 12 — prompts de ilustração ("o comando exato que a IA de imagem
// vai receber"). Lógica pura: monta os seis prompts (um por passo
// aprovado na fase 11) mais o quadro-mestre da bancada vazia, todos
// compartilhando a mesma camada de texto (estação + estilo visual +
// instrução negativa contra texto embutido) — só a camada específica de
// cada passo muda. Não chama nenhum modelo aqui: isso é a fase 13.
//
// "70% do texto idêntico entre eles" (a estimativa do plano original)
// não é um número que o código mede ou tenta bater — é só a consequência
// natural de reusar a MESMA string de camada compartilhada, literalmente
// idêntica, em todos os prompts. O que o código garante de verdade é essa
// igualdade estrutural, testada como tal, não uma porcentagem.

import { descreverEstiloVisual } from "./biblia-visual.js";

// Termos que, se aparecerem no texto final do prompt, indicam um pedido
// de texto/legenda dentro da imagem — o gate F12 ("nenhum pede texto
// dentro da imagem") proíbe isso. O template fixo abaixo nunca pede isso
// sozinho; o risco real vem de DADO EXTERNO (um campo de ficha corrigido
// à mão na fase 11 que descreva, sem querer, uma instrução de texto). É
// uma heurística por palavra-chave, não uma prova — documentado como tal.
const TERMOS_PEDIDO_DE_TEXTO = [
  "escreva",
  "escrever",
  "inscrição",
  "com a palavra",
  "com a legenda",
  "legenda dizendo",
  "número do passo",
  "texto dizendo",
  "rótulo com texto",
];

function descreverEstacao(nomeEstacao, zonas) {
  const listaZonas = zonas && zonas.length ? zonas.map((z) => `${z.nome} (${z.tipo})`).join(", ") : "sem zonas mapeadas";
  return `Estação: "${nomeEstacao || "sem nome"}". Bancada com as seguintes zonas: ${listaZonas}.`;
}

// A camada compartilhada: mesma string, byte a byte, em todos os 6
// prompts e no quadro-mestre. É ela que carrega a consistência visual
// entre os quadros (F12: "a bancada é reconhecidamente a mesma nos
// seis").
export function montarCamadaCompartilhada(nomeEstacao, zonas) {
  return [
    descreverEstacao(nomeEstacao, zonas),
    descreverEstiloVisual(),
    "Não inclua nenhum texto, letra, número, rótulo ou legenda dentro da imagem — a ilustração é só a cena, sem escrita nenhuma.",
  ].join(" ");
}

export function montarPromptQuadroMestre(camadaCompartilhada) {
  return `${camadaCompartilhada} Cena: a bancada vazia, sem nenhuma peça, sem mãos, sem operador — só o espaço de trabalho como referência para os seis passos que virão.`;
}

// ficha: o valor "final" (pós-correção) de uma ficha aprovada na fase 11.
// Nota deliberada: o campo `risco` NUNCA entra aqui. Risco é dado de
// segurança pra documentação (vai pro PDF final como texto sobreposto na
// fase 15), não uma instrução visual — não existe "desenhar risco de
// esmagamento" numa ilustração técnica da cena. Confirmado por um teste
// de navegador que checou isso de propósito (ver README).
function descreverPasso(ficha) {
  const maos = ficha.maos && ficha.maos.length ? ficha.maos.join(" e ") : "mãos não identificadas";
  const ferramenta = ficha.ferramentas && ficha.ferramentas.length ? `usando ${ficha.ferramentas.join(" e ")}` : "sem ferramenta";
  const pecas = ficha.pecas && ficha.pecas.length ? `com ${ficha.pecas.join(", ")}` : "sem peça nova neste passo";
  const antes = ficha.estadoProdutoAntes && ficha.estadoProdutoAntes.length ? ficha.estadoProdutoAntes.join(", ") : "nada instalado ainda";
  const depois = ficha.estadoProdutoDepois && ficha.estadoProdutoDepois.length ? ficha.estadoProdutoDepois.join(", ") : "nada instalado";

  return (
    `Passo ${ficha.numero}: "${ficha.titulo}". Ação feita com ${maos}, ${ferramenta}, ${pecas}. ` +
    `Estado do produto antes deste passo: ${antes}. Depois deste passo: ${depois}. ` +
    `Critério de conclusão mostrado na cena: ${ficha.criterioConclusao}`
  );
}

export function montarPromptPasso(ficha, camadaCompartilhada) {
  return `${camadaCompartilhada} Cena: ${descreverPasso(ficha)}`;
}

// fichas: as fichas "final" das 6 aprovações da fase 11 (nesta ordem).
// nomeEstacao, zonas: mapaDeZonas (fase 00).
export function gerarPrompts(fichas, nomeEstacao, zonas) {
  const camadaCompartilhada = montarCamadaCompartilhada(nomeEstacao, zonas);
  return {
    camadaCompartilhada,
    quadroMestre: montarPromptQuadroMestre(camadaCompartilhada),
    passos: fichas.map((f) => ({ numero: f.numero, titulo: f.titulo, prompt: montarPromptPasso(f, camadaCompartilhada) })),
  };
}

// Gate F12 "nenhum pede texto dentro da imagem" — devolve os termos
// encontrados (vazio = passou). Roda em qualquer texto de prompt, incluindo
// o quadro-mestre.
export function verificarSemPedidoDeTexto(promptTexto) {
  const textoMinusculo = promptTexto.toLowerCase();
  return TERMOS_PEDIDO_DE_TEXTO.filter((termo) => textoMinusculo.includes(termo));
}

// Gate F12 "lendo só o prompt você conseguiria desenhar a cena" —
// aproximado por cobertura: cada dado da ficha (mãos, ferramenta, peças,
// título) precisa aparecer no texto final do prompt. Devolve os campos
// que faltaram (vazio = passou). Não prova que o prompt é bem escrito,
// só que nenhum dado real da ficha ficou de fora do texto.
export function verificarCobertura(ficha, promptTexto) {
  const faltando = [];
  if (!promptTexto.includes(ficha.titulo)) faltando.push("titulo");
  for (const mao of ficha.maos || []) {
    if (!promptTexto.includes(mao)) faltando.push(`mao:${mao}`);
  }
  for (const ferramenta of ficha.ferramentas || []) {
    if (!promptTexto.includes(ferramenta)) faltando.push(`ferramenta:${ferramenta}`);
  }
  for (const peca of ficha.pecas || []) {
    if (!promptTexto.includes(peca)) faltando.push(`peca:${peca}`);
  }
  return faltando;
}
