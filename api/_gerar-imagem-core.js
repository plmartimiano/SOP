// Núcleo puro da fase 13 (geração das imagens) — monta as "parts" da
// requisição pro Gemini e valida/extrai a imagem da resposta. Sem rede,
// sem req/res — só o handler em gerar-imagem.js fala HTTP. Prefixo "_":
// convenção do Vercel pra não virar rota própria em /api.
//
// CommonJS de propósito (não ESM), mesmo motivo de
// _leitura-semantica-core.js: a função de Vercel roda num runtime Node
// que nem sempre resolve "type":"module" sem package.json.

// Monta as partes da requisição: o prompt de texto, mais — se houver —
// a imagem de referência que este quadro deve manter consistente (o
// quadro-mestre, ou o elo anterior da cadeia), como inline_data, pro
// modelo editar/continuar a partir dela em vez de inventar do zero. Sem
// referência (o quadro-mestre em si), só o texto.
function montarPartes({ prompt, imagemReferenciaBase64 }) {
  const partes = [{ text: prompt }];
  if (imagemReferenciaBase64) {
    partes.push({ inline_data: { mime_type: "image/png", data: imagemReferenciaBase64 } });
  }
  return partes;
}

// Extrai a imagem (base64) da resposta do Gemini, ou explica por que não
// veio nenhuma — nunca finge sucesso com um resultado vazio (mesmo
// princípio de F06-04 na leitura semântica: não inventar dado que a
// resposta não trouxe).
function extrairImagem(respostaGemini) {
  const candidato = respostaGemini?.candidates?.[0];
  const partes = candidato?.content?.parts || [];
  const parteImagem = partes.find((p) => p.inline_data || p.inlineData);
  const dado = parteImagem?.inline_data || parteImagem?.inlineData;

  if (!dado || !dado.data) {
    const motivoBloqueio = candidato?.finishReason;
    return {
      erro: true,
      motivo: motivoBloqueio
        ? `o modelo não devolveu imagem (finishReason: ${motivoBloqueio})`
        : "o modelo não devolveu nenhuma imagem na resposta",
    };
  }

  return { erro: false, imagemBase64: dado.data, mimeType: dado.mime_type || dado.mimeType || "image/png" };
}

module.exports = { montarPartes, extrairImagem };
