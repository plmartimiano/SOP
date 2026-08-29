// Pacote da fase 14 — proxy para o Gemini (verificação cega). Mesmo
// motivo de arquitetura das outras duas funções em api/: a chave paga
// não pode chegar ao navegador. Esta é a TERCEIRA chamada paga do
// projeto — o `tipo: "pago"` de fases.js já dizia isso desde antes desta
// fase existir.
//
// ATUALIZADO (cartão de handoff de 2026-08-29): mesma migração das
// outras duas funções — o cliente usa Vertex AI, não a Gemini Developer
// API. Ver api/_auth-vertex.js.
//
// Variáveis de ambiente exigidas (painel do projeto na Vercel, nunca
// commitadas):
//   GOOGLE_SERVICE_ACCOUNT_JSON  (obrigatória — ver api/_auth-vertex.js,
//                                  mesma variável das fases 06 e 13)
//   GOOGLE_CLOUD_PROJECT         (obrigatória)
//   GOOGLE_CLOUD_LOCATION        (opcional, padrão "global")
//   GEMINI_MODEL                 (opcional — reusa a mesma variável e o
//                                  mesmo modelo da fase 06: verificação
//                                  cega é LEITURA de imagem, não geração,
//                                  então o modelo certo aqui é o
//                                  multimodal de texto+visão, não o de
//                                  imagem da fase 13. Mesma ressalva de
//                                  "não confirmado".)
const MODELO_PADRAO = "gemini-2.5-flash"; // CONFIRME antes de usar em produção — não verificado

const {
  montarPromptNota,
  montarPromptOrdem,
  montarPromptContinuidade,
  sanitizarNota,
  sanitizarOrdem,
  sanitizarContinuidade,
} = require("./_verificar-imagem-core.js");
const { obterTokenDeAcesso, montarUrlVertex, lerProjetoELocation } = require("./_auth-vertex.js");

function parteImagem({ imagemBase64, mimeType }) {
  return { inline_data: { mime_type: mimeType || "image/png", data: imagemBase64 } };
}

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
  const { tipo } = corpo;
  const modelo = process.env.GEMINI_MODEL || MODELO_PADRAO;

  let parts;
  if (tipo === "nota") {
    if (!corpo.imagemBase64) {
      res.status(400).json({ erro: "imagemBase64 é obrigatório para tipo=nota." });
      return;
    }
    parts = [{ text: montarPromptNota() }, parteImagem(corpo)];
  } else if (tipo === "ordem") {
    if (!Array.isArray(corpo.imagens) || corpo.imagens.length < 2) {
      res.status(400).json({ erro: "imagens (lista com pelo menos 2 itens) é obrigatório para tipo=ordem." });
      return;
    }
    const rotulos = corpo.imagens.map((i) => i.rotulo);
    parts = [{ text: montarPromptOrdem(rotulos) }];
    for (const img of corpo.imagens) {
      parts.push({ text: `Rótulo ${img.rotulo}:` });
      parts.push(parteImagem(img));
    }
  } else if (tipo === "continuidade") {
    if (!corpo.imagemAntes || !corpo.imagemDepois) {
      res.status(400).json({ erro: "imagemAntes e imagemDepois são obrigatórios para tipo=continuidade." });
      return;
    }
    parts = [
      { text: montarPromptContinuidade() },
      { text: "Primeira imagem:" },
      parteImagem(corpo.imagemAntes),
      { text: "Segunda imagem:" },
      parteImagem(corpo.imagemDepois),
    ];
  } else {
    res.status(400).json({ erro: `tipo "${tipo}" desconhecido — use "nota", "ordem" ou "continuidade".` });
    return;
  }

  try {
    const respostaGemini = await fetch(montarUrlVertex({ projeto, location, modelo }), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }),
    });

    if (!respostaGemini.ok) {
      const corpoErro = await respostaGemini.text();
      res.status(502).json({ erro: `Gemini respondeu ${respostaGemini.status}: ${corpoErro.slice(0, 300)}` });
      return;
    }

    const dadosGemini = await respostaGemini.json();
    const texto = dadosGemini?.candidates?.[0]?.content?.parts?.[0]?.text;

    let respostaModelo;
    try {
      respostaModelo = JSON.parse(texto);
    } catch {
      res.status(502).json({ erro: "Resposta do Gemini não veio em JSON válido." });
      return;
    }

    let sanitizada;
    if (tipo === "nota") sanitizada = sanitizarNota(respostaModelo);
    else if (tipo === "ordem") sanitizada = sanitizarOrdem(respostaModelo, corpo.imagens.map((i) => i.rotulo));
    else sanitizada = sanitizarContinuidade(respostaModelo);

    if (sanitizada.erro) {
      res.status(502).json({ erro: sanitizada.motivo });
      return;
    }
    res.status(200).json(sanitizada);
  } catch (e) {
    res.status(502).json({ erro: `Falha ao chamar o Gemini: ${e.message}` });
  }
};
