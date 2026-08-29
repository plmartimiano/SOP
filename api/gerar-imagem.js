// Pacote da fase 13 — proxy para o Gemini (geração de imagem). Mesmo
// motivo de api/leitura-semantica.js: a chave paga nunca pode aparecer em
// código que roda no navegador. Esta é a SEGUNDA e última chamada paga
// planejada até aqui.
//
// Variáveis de ambiente exigidas (painel do projeto na Vercel, nunca
// commitadas):
//   GEMINI_API_KEY       (obrigatória — a mesma variável da fase 06)
//   GEMINI_IMAGE_MODEL   (opcional — ver aviso abaixo)
//
// AVISO: o nome exato do modelo de IMAGEM da conta paga do cliente NÃO
// foi confirmado — mesma limitação documentada em leitura-semantica.js:
// o ambiente onde este arquivo foi escrito não tem acesso de rede a
// domínios do Google. O valor abaixo é o modelo multimodal de
// geração/edição de imagem do Gemini mais recente conhecido no momento
// da escrita, não um fato verificado. Confirme no Google AI Studio antes
// de configurar GEMINI_IMAGE_MODEL em produção.
const MODELO_PADRAO = "gemini-2.5-flash-image"; // CONFIRME antes de usar em produção — não verificado

const { montarPartes, extrairImagem } = require("./_gerar-imagem-core.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Use POST." });
    return;
  }

  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    res.status(500).json({ erro: "GEMINI_API_KEY não configurada no servidor." });
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
    const respostaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: partes }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            ...(seed !== null ? { seed } : {}),
          },
        }),
      }
    );

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
