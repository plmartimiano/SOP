// Pacote da fase 13 — proxy para o Gemini (geração de imagem). Mesmo
// motivo de api/leitura-semantica.js: a chave paga nunca pode aparecer em
// código que roda no navegador. Esta é a SEGUNDA chamada paga do projeto.
//
// ATUALIZADO (cartão de handoff de 2026-08-29): mesma migração de
// api/leitura-semantica.js — o cliente usa Vertex AI, não a Gemini
// Developer API. Ver api/_auth-vertex.js.
//
// Variáveis de ambiente exigidas (painel do projeto na Vercel, nunca
// commitadas):
//   GOOGLE_SERVICE_ACCOUNT_JSON  (obrigatória — ver api/_auth-vertex.js)
//   GOOGLE_CLOUD_PROJECT         (obrigatória)
//   GOOGLE_CLOUD_LOCATION        (opcional, padrão "global")
//   GEMINI_IMAGE_MODEL           (opcional — ver aviso abaixo)
//
// AVISO 1: o nome exato do modelo de IMAGEM da conta do cliente no Vertex
// AI não foi confirmado — confirme no console do Vertex AI / Model
// Garden antes de configurar GEMINI_IMAGE_MODEL em produção.
// AVISO 2 (achado numa busca durante esta mesma rodada de handoff, não
// só "não confirmado" — uma data real): o modelo abaixo,
// gemini-2.5-flash-image, tem desligamento anunciado para 02/10/2026.
// Se essa migração ainda não aconteceu quando alguém for configurar isto
// em produção, CONFIRME o modelo sucessor no Vertex AI antes de seguir —
// não assuma que o valor padrão abaixo ainda está disponível.
const MODELO_PADRAO = "gemini-2.5-flash-image"; // CONFIRME antes de usar em produção — não verificado, e desliga em 02/10/2026

const { montarPartes, extrairImagem } = require("./_gerar-imagem-core.js");
const { obterTokenDeAcesso, montarUrlVertex, lerProjetoELocation } = require("./_auth-vertex.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Use POST." });
    return;
  }

  let token, projeto, location;
  try {
    ({ projeto, location } = lerProjetoELocation());
    token = await obterTokenDeAcesso();
  } catch (e) {
    res.status(500).json({ erro: e.message });
    return;
  }

  const corpo = req.body || {};
  const { prompt, imagemReferenciaBase64 = null, seed = null } = corpo;
  if (!prompt) {
    res.status(400).json({ erro: "prompt é obrigatório." });
    return;
  }

  const modelo = process.env.GEMINI_IMAGE_MODEL || MODELO_PADRAO;
  const partes = montarPartes({ prompt, imagemReferenciaBase64 });

  try {
    const respostaGemini = await fetch(montarUrlVertex({ projeto, location, modelo }), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        contents: [{ parts: partes }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          ...(seed !== null ? { seed } : {}),
        },
      }),
    });

    if (!respostaGemini.ok) {
      const corpoErro = await respostaGemini.text();
      res.status(502).json({ erro: `Gemini respondeu ${respostaGemini.status}: ${corpoErro.slice(0, 300)}` });
      return;
    }

    const dadosGemini = await respostaGemini.json();
    const extraida = extrairImagem(dadosGemini);
    if (extraida.erro) {
      res.status(502).json({ erro: extraida.motivo });
      return;
    }

    res.status(200).json({ imagemBase64: extraida.imagemBase64, mimeType: extraida.mimeType });
  } catch (e) {
    res.status(502).json({ erro: `Falha ao chamar o Gemini: ${e.message}` });
  }
};
