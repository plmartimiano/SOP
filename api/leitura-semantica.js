// Pacote EAP 1.4.1 — proxy para o Claude. A PRIMEIRA das três funções
// serverless do projeto (as outras duas vieram bem depois: fase 13 —
// api/gerar-imagem.js — e fase 14 — api/verificar-imagem.js).
//
// Por que isto existe fora do navegador: a chave paga nunca pode aparecer
// em código que roda no cliente (qualquer um com o DevTools aberto a
// veria e poderia gastar na conta). Esta função autentica do lado do
// servidor — junto com as outras duas, são as únicas peças do projeto que
// saem do "100% no navegador", deliberado, só pras três chamadas pagas.
//
// ATUALIZADO (cartão de handoff de 2026-08-29, terceira mudança no mesmo
// dia): o cliente decidiu não usar mais o Gemini — esta fase passa a
// chamar o Claude (Anthropic), que lê imagem tão bem quanto precisamos
// aqui. Só a fase 13 (geração de imagem, que o Claude não faz) continua
// no Gemini/Vertex AI. Ver api/_cliente-claude.js para o porquê de agora
// haver uma dependência de verdade (@anthropic-ai/sdk).
//
// Variável de ambiente exigida (configurar no serviço do Cloud Run, nunca
// commitada no repositório):
//   ANTHROPIC_API_KEY   (obrigatória)
//   ANTHROPIC_MODEL      (opcional — padrão claude-opus-5)
//
// _leitura-semantica-core.js (o prompt e a validação da resposta) NÃO
// mudou — é lógica de texto pura, sem nada específico de provedor.

const { montarPrompt, sanitizarResposta } = require("./_leitura-semantica-core.js");
const { obterCliente, modelo, parteImagem, extrairTexto, extrairJson } = require("./_cliente-claude.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Use POST." });
    return;
  }

  const corpo = req.body || {};
  const { frames, tempoSegundos, glossario = [], verbosPermitidos = [], zona = null } = corpo;
  if (!frames || !frames.chave) {
    res.status(400).json({ erro: "frames.chave (o frame de maior movimento da fatia) é obrigatório." });
    return;
  }

  const prompt = montarPrompt({ glossario, verbosPermitidos, zona, tempoSegundos });

  // Ordem importa pouco pro Claude, mas mantém a mesma sequência
  // antes/chave/depois do texto do prompt, pra continuidade de leitura.
  const conteudo = [];
  for (const rotulo of ["antes", "chave", "depois"]) {
    const dataUrl = frames[rotulo];
    if (!dataUrl) continue;
    const virgula = dataUrl.indexOf(",");
    const cabecalho = dataUrl.slice(0, virgula);
    const base64 = dataUrl.slice(virgula + 1);
    const mimeType = (cabecalho.match(/data:(.*);base64/) || [])[1] || "image/png";
    conteudo.push(parteImagem({ base64, mimeType }));
  }
  conteudo.push({ type: "text", text: prompt });

  try {
    const resposta = await obterCliente().messages.create({
      model: modelo(),
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      // "low": leitura de imagem contra um vocabulário fechado é uma
      // tarefa de classificação, não de raciocínio profundo — e esta
      // chamada roda por fatia de vídeo, então custo por chamada importa.
      output_config: { effort: "low" },
      messages: [{ role: "user", content: conteudo }],
    });

    if (resposta.stop_reason === "refusal") {
      res.status(502).json({ erro: `Claude recusou a resposta (${resposta.stop_details?.category || "motivo não informado"}).` });
      return;
    }

    const texto = extrairTexto(resposta);
    const respostaModelo = extrairJson(texto);
    if (respostaModelo === null) {
      res.status(502).json({ erro: "Resposta do Claude não veio em JSON válido." });
      return;
    }

    const sanitizada = sanitizarResposta(respostaModelo, { verbosPermitidos, glossario });
    res.status(200).json(sanitizada);
  } catch (e) {
    res.status(502).json({ erro: `Falha ao chamar o Claude: ${e.message}` });
  }
};
