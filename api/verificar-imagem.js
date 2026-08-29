// Pacote da fase 14 — proxy para o Claude (verificação cega). Mesmo
// motivo de arquitetura das outras duas funções em api/: a chave paga
// não pode chegar ao navegador. Esta é a TERCEIRA chamada paga do
// projeto — o `tipo: "pago"` de fases.js já dizia isso desde antes desta
// fase existir.
//
// ATUALIZADO (cartão de handoff de 2026-08-29, terceira mudança no mesmo
// dia): mesma migração de api/leitura-semantica.js — o cliente decidiu
// não usar mais o Gemini. Verificação cega é LEITURA de imagem, não
// geração, então o Claude cobre isso tão bem quanto a fase 06. Ver
// api/_cliente-claude.js.
//
// Variável de ambiente exigida (configurar no serviço do Cloud Run, nunca
// commitada no repositório):
//   ANTHROPIC_API_KEY   (obrigatória — a mesma da fase 06)
//   ANTHROPIC_MODEL      (opcional — padrão claude-opus-5)
//
// _verificar-imagem-core.js (os três prompts e a validação de cada
// resposta) NÃO mudou — é lógica de texto pura, sem nada específico de
// provedor.

const {
  montarPromptNota,
  montarPromptOrdem,
  montarPromptContinuidade,
  sanitizarNota,
  sanitizarOrdem,
  sanitizarContinuidade,
} = require("./_verificar-imagem-core.js");
const { obterCliente, modelo, parteImagem, extrairTexto, extrairJson } = require("./_cliente-claude.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Use POST." });
    return;
  }

  const corpo = req.body || {};
  const { tipo } = corpo;

  let conteudo;
  // "ordem" compara e sequencia várias imagens (mais raciocínio de
  // verdade que uma nota ou uma comparação de par) — effort "medium" em
  // vez de "low" pelas outras duas, que são julgamentos mais diretos.
  let effort = "low";
  if (tipo === "nota") {
    if (!corpo.imagemBase64) {
      res.status(400).json({ erro: "imagemBase64 é obrigatório para tipo=nota." });
      return;
    }
    conteudo = [parteImagem(corpo), { type: "text", text: montarPromptNota() }];
  } else if (tipo === "ordem") {
    if (!Array.isArray(corpo.imagens) || corpo.imagens.length < 2) {
      res.status(400).json({ erro: "imagens (lista com pelo menos 2 itens) é obrigatório para tipo=ordem." });
      return;
    }
    effort = "medium";
    const rotulos = corpo.imagens.map((i) => i.rotulo);
    conteudo = [];
    for (const img of corpo.imagens) {
      conteudo.push({ type: "text", text: `Rótulo ${img.rotulo}:` });
      conteudo.push(parteImagem(img));
    }
    conteudo.push({ type: "text", text: montarPromptOrdem(rotulos) });
  } else if (tipo === "continuidade") {
    if (!corpo.imagemAntes || !corpo.imagemDepois) {
      res.status(400).json({ erro: "imagemAntes e imagemDepois são obrigatórios para tipo=continuidade." });
      return;
    }
    conteudo = [
      { type: "text", text: "Primeira imagem:" },
      parteImagem(corpo.imagemAntes),
      { type: "text", text: "Segunda imagem:" },
      parteImagem(corpo.imagemDepois),
      { type: "text", text: montarPromptContinuidade() },
    ];
  } else {
    res.status(400).json({ erro: `tipo "${tipo}" desconhecido — use "nota", "ordem" ou "continuidade".` });
    return;
  }

  try {
    const resposta = await obterCliente().messages.create({
      model: modelo(),
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort },
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
    res.status(502).json({ erro: `Falha ao chamar o Claude: ${e.message}` });
  }
};
