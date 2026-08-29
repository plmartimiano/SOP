// Testes do pacote 1.4.1 + 1.4.2 (núcleo puro: prompt e sanitização da
// resposta). Roda no Node — nada de rede, nada de Gemini de verdade.

import { test } from "node:test";
import assert from "node:assert/strict";

// api/_leitura-semantica-core.js é CommonJS (module.exports) — Node ESM
// importa isso normalmente via interop.
import { montarPrompt, sanitizarResposta } from "../api/_leitura-semantica-core.js";

const GLOSSARIO = [
  { nomeOficial: "Suporte L-32", codigoInterno: "COMP-L32" },
  { nomeOficial: "Chave de torque", codigoInterno: "FERR-TORQ-01" },
];
const VERBOS = ["posicionar", "encaixar", "parafusar", "conectar", "testar", "transferir"];

test("montarPrompt inclui o glossário, os verbos e o tempo", () => {
  const prompt = montarPrompt({ glossario: GLOSSARIO, verbosPermitidos: VERBOS, zona: null, tempoSegundos: 12.3 });
  assert.match(prompt, /Suporte L-32/);
  assert.match(prompt, /Chave de torque/);
  assert.match(prompt, /posicionar, encaixar, parafusar, conectar, testar, transferir/);
  assert.match(prompt, /12\.3s/);
});

test("montarPrompt usa a zona como resposta, não como pergunta (F06-02)", () => {
  const prompt = montarPrompt({
    glossario: GLOSSARIO,
    verbosPermitidos: VERBOS,
    zona: { nomeOficial: "Escaninho suporte L-32", tipo: "escaninho" },
    tempoSegundos: 1,
  });
  assert.match(prompt, /acabou de visitar a zona "Escaninho suporte L-32"/);
  assert.match(prompt, /confirme ou conteste/);
});

test("montarPrompt sem zona explica que não há informação de zona", () => {
  const prompt = montarPrompt({ glossario: GLOSSARIO, verbosPermitidos: VERBOS, zona: null, tempoSegundos: 1 });
  assert.match(prompt, /Não há informação de zona/);
});

test("sanitizarResposta aceita uma resposta bem formada", () => {
  const r = sanitizarResposta(
    { verbo: "Encaixar", objeto: "Suporte L-32", ferramenta: "nenhuma", mao: "Direita", pontoDeAplicacao: "base", confianca: 87 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, undefined);
  assert.equal(r.verbo, "encaixar");
  assert.equal(r.objeto, "Suporte L-32");
  assert.equal(r.mao, "direita");
  assert.equal(r.confianca, 87);
});

test("sanitizarResposta repassa indeterminado do próprio modelo", () => {
  const r = sanitizarResposta({ indeterminado: true, motivo: "mão oclui a peça" }, { verbosPermitidos: VERBOS, glossario: GLOSSARIO });
  assert.equal(r.indeterminado, true);
  assert.equal(r.motivo, "mão oclui a peça");
});

test("sanitizarResposta vira indeterminado quando falta campo obrigatório", () => {
  const r = sanitizarResposta({ verbo: "encaixar", objeto: "Suporte L-32" }, { verbosPermitidos: VERBOS, glossario: GLOSSARIO });
  assert.equal(r.indeterminado, true);
  assert.match(r.motivo, /campos obrigatórios ausentes/);
});

test("sanitizarResposta vira indeterminado (não erro) quando o verbo está fora da lista — F06-04", () => {
  const r = sanitizarResposta(
    { verbo: "girar", objeto: "Suporte L-32", ferramenta: "nenhuma", mao: "direita", pontoDeAplicacao: "x", confianca: 90 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, true);
  assert.match(r.motivo, /verbo "girar" fora da lista/);
});

test("sanitizarResposta vira indeterminado quando o objeto não está no glossário — F06-04 (proibir invenção)", () => {
  const r = sanitizarResposta(
    { verbo: "encaixar", objeto: "Peça inventada", ferramenta: "nenhuma", mao: "direita", pontoDeAplicacao: "x", confianca: 90 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, true);
  assert.match(r.motivo, /objeto "Peça inventada" não está no glossário/);
});

test("sanitizarResposta vira indeterminado quando a ferramenta não está no glossário", () => {
  const r = sanitizarResposta(
    { verbo: "parafusar", objeto: "Suporte L-32", ferramenta: "Chave de fenda mágica", mao: "direita", pontoDeAplicacao: "x", confianca: 90 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, true);
  assert.match(r.motivo, /ferramenta "Chave de fenda mágica" não está no glossário/);
});

test("sanitizarResposta aceita ferramenta 'nenhuma' sem checar contra o glossário", () => {
  const r = sanitizarResposta(
    { verbo: "posicionar", objeto: "Suporte L-32", ferramenta: "nenhuma", mao: "ambas", pontoDeAplicacao: "x", confianca: 50 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, undefined);
  assert.equal(r.ferramenta, "nenhuma");
});

test("sanitizarResposta vira indeterminado com mão inválida", () => {
  const r = sanitizarResposta(
    { verbo: "testar", objeto: "Suporte L-32", ferramenta: "nenhuma", mao: "pé", pontoDeAplicacao: "x", confianca: 50 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, true);
  assert.match(r.motivo, /mão "pé" inválida/);
});

test("sanitizarResposta vira indeterminado com confiança fora de 0-100", () => {
  const r = sanitizarResposta(
    { verbo: "testar", objeto: "Suporte L-32", ferramenta: "nenhuma", mao: "direita", pontoDeAplicacao: "x", confianca: 150 },
    { verbosPermitidos: VERBOS, glossario: GLOSSARIO }
  );
  assert.equal(r.indeterminado, true);
  assert.match(r.motivo, /confiança "150" fora da faixa/);
});

test("sanitizarResposta vira indeterminado se a resposta não é um objeto (JSON quebrado)", () => {
  assert.equal(sanitizarResposta(null, { verbosPermitidos: VERBOS, glossario: GLOSSARIO }).indeterminado, true);
  assert.equal(sanitizarResposta("texto solto", { verbosPermitidos: VERBOS, glossario: GLOSSARIO }).indeterminado, true);
});
