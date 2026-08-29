// Utilidades pequenas e compartilhadas pelo "modo manual" das fases 06,
// 13 e 14 — cartão de handoff de 2026-08-29: o cliente pediu pra testar
// sem gastar em nenhuma API paga por enquanto (nem Claude, nem Gemini).
// O modo manual troca a chamada automática por "copie o prompt, cole
// numa conversa de chat de graça (claude.ai, Gemini), cole a resposta de
// volta aqui" — cada tela (fase06-ui.js, fase13-ui.js, verificacao-cega.js)
// monta seu próprio prompt e sua própria validação (são específicos de
// cada fase), mas as dessa peças aqui — copiar pro clipboard e ler o
// JSON que a pessoa colou de volta — são idênticas nas três, daí ficarem
// num arquivo só.

export async function copiarTexto(texto) {
  await navigator.clipboard.writeText(texto);
}

// O texto colado geralmente é a resposta inteira do chat, não só o JSON
// — pode vir com frase antes/depois, ou dentro de uma cerca de código
// (```json ... ```). Tenta achar o primeiro bloco que parece JSON válido
// antes de desistir; nunca lança — quem chama decide o que fazer com
// `null` (mesma disciplina de nunca inventar dado das fases 06/14: uma
// colagem que não vira JSON é "ainda não validado", não um erro fatal).
export function extrairJsonColado(textoColado) {
  if (!textoColado) return null;
  const bruto = textoColado.trim();

  try {
    return JSON.parse(bruto);
  } catch {
    /* segue pras tentativas abaixo */
  }

  const semCerca = bruto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(semCerca);
  } catch {
    /* segue */
  }

  // último recurso: o primeiro trecho entre a primeira "{" e a última "}"
  // — pega o caso de "Claro, aqui está: {...} Espero ter ajudado!".
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(bruto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}
