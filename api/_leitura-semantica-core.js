// Núcleo puro dos pacotes EAP 1.4.1 (módulo de leitura semântica) e 1.4.2
// (identificação por zona) — monta o prompt e valida/sanitiza a resposta
// do modelo. Sem rede, sem `req`/`res` — só o handler em
// leitura-semantica.js fala HTTP. Arquivo com "_" na frente: convenção do
// Vercel para não virar rota própria em /api.
//
// CommonJS de propósito (não ESM): função de Vercel roda em runtime Node
// que nem sempre resolve "type":"module" sem package.json, e este projeto
// não tem (nem precisa ter) package.json até agora.

const CAMPOS_OBRIGATORIOS = ["verbo", "objeto", "ferramenta", "mao", "pontoDeAplicacao", "confianca"];
const MAOS_VALIDAS = ["esquerda", "direita", "ambas"];

// PASSO — por que o glossário e os verbos são escritos por extenso dentro
// do prompt a cada chamada, em vez de confiar no que o modelo "já sabe"
// sobre montagem industrial em geral. O modelo não tem como saber que
// ESTA estação específica chama uma peça de "Suporte L-32" e não de
// outro jeito qualquer plausível — listar o vocabulário fechado (e
// pedir pra escolher só dali) é o que faz `sanitizarResposta` conseguir
// rejeitar com confiança o que sair da lista, em vez de aceitar
// qualquer nome que "parece razoável". Mesma lógica pro trio de imagens
// antes/chave/depois: uma imagem isolada do frame-chave já tem o
// instante de maior movimento, mas o antes/depois dá contexto de
// continuidade (o que estava acontecendo logo antes e logo depois) sem
// custo adicional de chamada — as três imagens vão na MESMA requisição.

// F06-01 + F06-02: entrega o trio de imagens (no chamador, não aqui — isto
// só monta o texto), o glossário fechado, os verbos permitidos e — decisivo
// — a zona que a mão visitou, como resposta pronta pro modelo confirmar ou
// contestar, não como pergunta em aberto.
function montarPrompt({ glossario, verbosPermitidos, zona, tempoSegundos }) {
  const listaGlossario = glossario.map((g) => `- ${g.nomeOficial}${g.codigoInterno ? ` (${g.codigoInterno})` : ""}`).join("\n");
  const listaVerbos = verbosPermitidos.join(", ");
  const zonaTexto = zona
    ? `A mão do operador acabou de visitar a zona "${zona.nomeOficial}" (tipo: ${zona.tipo}). Use isso como resposta, não como pergunta: confirme ou conteste se o que a mão segura é compatível com essa zona — não adivinhe do zero.`
    : "Não há informação de zona da bancada para este instante.";

  return `Você está descrevendo um instante de um vídeo de montagem industrial, no tempo ${Number(tempoSegundos).toFixed(1)}s.

Três imagens em sequência (algumas podem faltar nas pontas do vídeo): o frame de antes, o frame-chave (o instante de maior movimento dentro desta fatia) e o frame de depois.

Vocabulário fechado de componentes e ferramentas desta estação — não use nenhum nome fora desta lista:
${listaGlossario || "(nenhum item cadastrado)"}

Verbos permitidos (a ação tem que ser um destes, exatamente): ${listaVerbos}

${zonaTexto}

Responda em JSON, só com os campos abaixo, sem nenhum texto fora do JSON:
{
  "verbo": "um dos verbos permitidos",
  "objeto": "nome oficial exato de um item da lista acima",
  "ferramenta": "nome oficial de uma ferramenta da lista, ou \\"nenhuma\\"",
  "mao": "esquerda, direita ou ambas",
  "pontoDeAplicacao": "descrição curta de onde a ação aconteceu",
  "confianca": "número de 0 a 100"
}

Se a peça ou a ação não forem identificáveis com segurança nas imagens, não invente. Responda só:
{ "indeterminado": true, "motivo": "explicação curta de por que não dá para saber" }`;
}

function normalizar(texto) {
  return String(texto ?? "").trim().toLowerCase();
}

// F06-04: proibir invenção, de verdade — não só por instrução de prompt
// (o modelo pode ignorar), mas checado em código. Verbo fora da lista ou
// objeto fora do glossário nunca vira dado gravado: vira indeterminado,
// com o motivo exato de por que a resposta foi rejeitada.
function sanitizarResposta(resposta, { verbosPermitidos, glossario }) {
  if (!resposta || typeof resposta !== "object") {
    return { indeterminado: true, motivo: "resposta do modelo não veio em formato reconhecível" };
  }
  if (resposta.indeterminado === true) {
    return { indeterminado: true, motivo: resposta.motivo || "motivo não informado pelo modelo" };
  }

  const faltando = CAMPOS_OBRIGATORIOS.filter(
    (campo) => resposta[campo] === undefined || resposta[campo] === null || resposta[campo] === ""
  );
  if (faltando.length > 0) {
    return { indeterminado: true, motivo: `campos obrigatórios ausentes na resposta: ${faltando.join(", ")}` };
  }

  const verbosNormalizados = verbosPermitidos.map(normalizar);
  if (!verbosNormalizados.includes(normalizar(resposta.verbo))) {
    return { indeterminado: true, motivo: `verbo "${resposta.verbo}" fora da lista permitida` };
  }

  // BUG CORRIGIDO (achado numa revisão de código): o objeto/ferramenta
  // eram validados contra o glossário de forma insensível a maiúsculas
  // (normalizar), mas gravados com o CASING CRU que o modelo devolveu —
  // só verbo e mão eram canonizados. Como js/consenso-ciclos.js usa
  // `verbo:objeto` como assinatura de igualdade no alinhamento entre
  // ciclos, a mesma ação real lida em dois ciclos diferentes com casing
  // diferente do modelo ("Suporte L-32" vs "suporte l-32" — as duas
  // válidas pelo glossário) virava duas assinaturas DIFERENTES,
  // derrubando silenciosamente o bônus de match exato do alinhamento.
  // A correção: gravar sempre o nomeOficial EXATO do item do glossário
  // que bateu na comparação normalizada — nunca o texto cru do modelo.
  function nomeOficialCorrespondente(valor) {
    const item = glossario.find((g) => normalizar(g.nomeOficial) === normalizar(valor));
    return item ? item.nomeOficial : valor;
  }

  const nomesConhecidos = glossario.map((g) => normalizar(g.nomeOficial));
  if (!nomesConhecidos.includes(normalizar(resposta.objeto))) {
    return { indeterminado: true, motivo: `objeto "${resposta.objeto}" não está no glossário desta estação` };
  }
  if (normalizar(resposta.ferramenta) !== "nenhuma" && !nomesConhecidos.includes(normalizar(resposta.ferramenta))) {
    return { indeterminado: true, motivo: `ferramenta "${resposta.ferramenta}" não está no glossário desta estação` };
  }

  if (!MAOS_VALIDAS.includes(normalizar(resposta.mao))) {
    return { indeterminado: true, motivo: `mão "${resposta.mao}" inválida (esperado: ${MAOS_VALIDAS.join(", ")})` };
  }

  const confianca = Number(resposta.confianca);
  if (!Number.isFinite(confianca) || confianca < 0 || confianca > 100) {
    return { indeterminado: true, motivo: `confiança "${resposta.confianca}" fora da faixa 0–100` };
  }

  return {
    verbo: normalizar(resposta.verbo),
    objeto: nomeOficialCorrespondente(resposta.objeto),
    ferramenta: normalizar(resposta.ferramenta) === "nenhuma" ? "nenhuma" : nomeOficialCorrespondente(resposta.ferramenta),
    mao: normalizar(resposta.mao),
    pontoDeAplicacao: String(resposta.pontoDeAplicacao),
    confianca: Math.round(confianca),
  };
}

module.exports = { montarPrompt, sanitizarResposta, CAMPOS_OBRIGATORIOS, MAOS_VALIDAS };
