// Cliente compartilhado do Claude — cartão de handoff de 2026-08-29
// (terceiro no mesmo dia): o projeto larga o Gemini para leitura/visão
// (fases 06 e 14) e passa a usar o Claude (Anthropic) para as duas. A
// fase 13 (geração de imagem) CONTINUA no Gemini/Vertex AI — o Claude não
// gera imagem, só lê — então api/_auth-vertex.js e api/gerar-imagem.js
// não mudam.
//
// Por que uma dependência de verdade agora (@anthropic-ai/sdk), depois
// de tanto cuidado pra manter zero dependência no resto do projeto: a
// API do Claude é só HTTP, dava pra reimplementar à mão como se fez com
// o Vertex AI — mas ali a mão-própria se justificava (o fluxo OAuth2 é
// padrão estável, não específico do Gemini). Aqui não há esse mesmo
// argumento, e o SDK oficial cobre exatamente o que falta (tratamento de
// erro tipado, streaming, contagem de tokens) sem reinventar nada. Menor
// dependência (só uma), maior confiabilidade.
//
// Autenticação: `new Anthropic()` sem argumento já resolve
// ANTHROPIC_API_KEY do ambiente sozinho — nenhum código de auth próprio
// aqui, diferente do trabalho todo que _auth-vertex.js precisou fazer.

const Anthropic = require("@anthropic-ai/sdk");

const MODELO_PADRAO = "claude-opus-5";

let cliente = null;
function obterCliente() {
  if (!cliente) cliente = new Anthropic();
  return cliente;
}

function modelo() {
  return process.env.ANTHROPIC_MODEL || MODELO_PADRAO;
}

// Content block de imagem no formato que a Messages API espera —
// equivalente ao inline_data do Gemini, chamado a partir do mesmo
// {base64, mimeType} que os core files já produzem.
function parteImagem({ base64, mimeType }) {
  return { type: "image", source: { type: "base64", media_type: mimeType || "image/png", data: base64 } };
}

// Acha o primeiro bloco de TEXTO na resposta — não pode ser
// `response.content[0]`: com thinking adaptativo (ligado por padrão no
// Opus 5), o primeiro bloco costuma ser um bloco "thinking" (texto
// vazio, já que o projeto não pediu pra exibir o resumo), e o JSON só
// aparece no bloco de texto que vem depois.
function extrairTexto(resposta) {
  const bloco = (resposta.content || []).find((b) => b.type === "text");
  return bloco ? bloco.text : null;
}

// O prompt pede JSON puro, mas o Claude (sem structured outputs
// forçados) às vezes embrulha a resposta em ```json ... ``` — tira a
// cerca antes de tentar o parse, sem mudar nenhuma regra de validação
// (isso continua 100% em sanitizarResposta/sanitizarNota/etc., que já
// tratam JSON malformado como "indeterminado", nunca como erro fatal).
function extrairJson(texto) {
  if (!texto) return null;
  const semCerca = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(semCerca);
  } catch {
    return null;
  }
}

module.exports = { obterCliente, modelo, parteImagem, extrairTexto, extrairJson, MODELO_PADRAO };
