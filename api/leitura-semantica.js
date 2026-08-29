// Pacote EAP 1.4.1 — proxy para o Gemini. A PRIMEIRA das três funções
// serverless do projeto (as outras duas vieram bem depois: fase 13 —
// api/gerar-imagem.js — e fase 14 — api/verificar-imagem.js).
//
// Por que isto existe fora do navegador: a chave paga do Gemini nunca pode
// aparecer em código que roda no cliente (qualquer um com o DevTools aberto
// a veria e poderia gastar na conta). Esta função guarda a chave como
// variável de ambiente do lado do servidor (Vercel) — junto com as outras
// duas, são as únicas peças do projeto que saem do "100% no navegador",
// deliberado, só pras três chamadas pagas.
//
// Variáveis de ambiente exigidas (configurar no painel do projeto na
// Vercel, nunca commitadas no repositório):
//   GEMINI_API_KEY  (obrigatória)
//   GEMINI_MODEL    (opcional — ver aviso abaixo)
//
// AVISO: o nome exato do modelo de visão atual da conta paga do cliente
// NÃO foi confirmado. O ambiente onde este arquivo foi escrito não tem
// acesso de rede a domínios do Google, então o valor abaixo é um palpite
// razoável, não um fato verificado — confirme o modelo certo no Google AI
// Studio / painel de faturamento do Gemini antes de configurar
// GEMINI_MODEL em produção.
const MODELO_PADRAO = "gemini-2.5-flash"; // CONFIRME antes de usar em produção — não verificado

const { montarPrompt, sanitizarResposta } = require("./_leitura-semantica-core.js");

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
  const { frames, tempoSegundos, glossario = [], verbosPermitidos = [], zona = null } = corpo;
  if (!frames || !frames.chave) {
    res.status(400).json({ erro: "frames.chave (o frame de maior movimento da fatia) é obrigatório." });
    return;
  }

  const modelo = process.env.GEMINI_MODEL || MODELO_PADRAO;
  const prompt = montarPrompt({ glossario, verbosPermitidos, zona, tempoSegundos });

  const parts = [{ text: prompt }];
  for (const rotulo of ["antes", "chave", "depois"]) {
    const dataUrl = frames[rotulo];
    if (!dataUrl) continue;
    const virgula = dataUrl.indexOf(",");
    const cabecalho = dataUrl.slice(0, virgula);
    const base64 = dataUrl.slice(virgula + 1);
    const mimeType = (cabecalho.match(/data:(.*);base64/) || [])[1] || "image/png";
    parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
  }

  try {
    const respostaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

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

    const sanitizada = sanitizarResposta(respostaModelo, { verbosPermitidos, glossario });
    res.status(200).json(sanitizada);
  } catch (e) {
    res.status(502).json({ erro: `Falha ao chamar o Gemini: ${e.message}` });
  }
};
