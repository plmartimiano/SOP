// Núcleo puro da fase 14 (verificação cega) — monta os prompts pros três
// tipos de checagem (nota por quadro, ordem embaralhada, continuidade
// entre pares) e sanitiza a resposta do modelo. Sem rede, sem req/res —
// só o handler em verificar-imagem.js fala HTTP.
//
// CommonJS de propósito, mesmo motivo dos outros núcleos em api/.

// F14: a mesma disciplina de F06-04 (nunca inventar dado) — cada
// sanitizador devolve {erro: true, motivo} em vez de aceitar um formato
// que a resposta não trouxe de verdade.

function montarPromptNota() {
  return `Você está vendo uma única ilustração técnica de um passo de montagem industrial, sem nenhum texto ou contexto além da própria imagem. Descreva em uma frase curta o que você vê acontecendo na cena, e dê uma nota de 0 a 100 para o quão claramente essa imagem sozinha comunica UMA ação específica (mãos, peça, ferramenta).

Responda só em JSON: {"descricao": "...", "nota": 0}`;
}

function montarPromptOrdem(rotulos) {
  return `Você está vendo ${rotulos.length} ilustrações de passos de uma montagem industrial, rotuladas ${rotulos.join(", ")}, em ordem ALEATÓRIA. Olhando só para o que está sendo montado em cada imagem (peças aparecendo, ferramentas em uso), reconstrua a ordem cronológica correta da montagem, do primeiro passo ao último.

Responda só em JSON: {"ordemSugerida": ["<rótulo>", "<rótulo>", ...]} com todos os ${rotulos.length} rótulos, cada um exatamente uma vez.`;
}

function montarPromptContinuidade() {
  return `Você está vendo duas ilustrações da mesma bancada de montagem industrial, em sequência. Confirme se a peça/ação da primeira imagem está visivelmente presente e consistente na segunda (mesmo ângulo, mesma bancada, nada desaparecendo sem explicação).

Responda só em JSON: {"consistente": true ou false, "motivo": "explicação curta"}`;
}

function normalizarNota(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

function sanitizarNota(resposta) {
  const nota = normalizarNota(resposta?.nota);
  if (nota === null) {
    return { erro: true, motivo: `nota "${resposta?.nota}" não é um número válido entre 0 e 100` };
  }
  return { erro: false, nota, descricao: String(resposta?.descricao || "") };
}

// rotulosEsperados: os rótulos que foram mandados na requisição — a
// resposta precisa ser exatamente uma permutação deles, nada a mais,
// nada a menos, nada repetido.
function sanitizarOrdem(resposta, rotulosEsperados) {
  const ordem = resposta?.ordemSugerida;
  if (!Array.isArray(ordem)) {
    return { erro: true, motivo: "ordemSugerida não veio como lista" };
  }
  const setEsperado = new Set(rotulosEsperados);
  const setRecebido = new Set(ordem);
  const ehPermutacaoValida =
    ordem.length === rotulosEsperados.length && setRecebido.size === ordem.length && [...setEsperado].every((r) => setRecebido.has(r));
  if (!ehPermutacaoValida) {
    return {
      erro: true,
      motivo: `ordemSugerida não é uma permutação válida de [${rotulosEsperados.join(", ")}] — veio [${ordem.join(", ")}]`,
    };
  }
  return { erro: false, ordemSugerida: ordem };
}

function sanitizarContinuidade(resposta) {
  if (typeof resposta?.consistente !== "boolean") {
    return { erro: true, motivo: `consistente "${resposta?.consistente}" não é um booleano` };
  }
  return { erro: false, consistente: resposta.consistente, motivo: String(resposta?.motivo || "") };
}

module.exports = {
  montarPromptNota,
  montarPromptOrdem,
  montarPromptContinuidade,
  sanitizarNota,
  sanitizarOrdem,
  sanitizarContinuidade,
};
