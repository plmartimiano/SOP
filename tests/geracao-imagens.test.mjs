// Testes da fase 13 (geração das imagens) — fetch é simulado, nada de
// rede de verdade, nem pro proxy nem pro Gemini.

import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarUmaImagem, montarPlanoDeGeracao, gerarTodasAsImagens } from "../js/geracao-imagens.js";

const QUADRO_MESTRE = "PROMPT QUADRO MESTRE";
const PASSOS = [
  { numero: 1, prompt: "PROMPT PASSO 1" },
  { numero: 2, prompt: "PROMPT PASSO 2" },
];

function fetchQueSempreFunciona() {
  return async (url, opts) => {
    const payload = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ imagemBase64: `img-seed${payload.seed}` }) };
  };
}

test("gerarUmaImagem devolve a resposta quando o fetch funciona de primeira", async () => {
  const r = await gerarUmaImagem({ prompt: "x", seed: 1 }, { fetchImpl: fetchQueSempreFunciona(), atrasoBaseMs: 1 });
  assert.deepEqual(r, { imagemBase64: "img-seed1" });
});

test("gerarUmaImagem tenta de novo depois de uma falha", async () => {
  let chamadas = 0;
  const fetchImpl = async () => {
    chamadas++;
    if (chamadas === 1) return { ok: false, status: 502, json: async () => ({ erro: "instável" }) };
    return { ok: true, status: 200, json: async () => ({ imagemBase64: "ok" }) };
  };
  const r = await gerarUmaImagem({ prompt: "x" }, { fetchImpl, atrasoBaseMs: 1 });
  assert.equal(chamadas, 2);
  assert.deepEqual(r, { imagemBase64: "ok" });
});

test("gerarUmaImagem desiste depois do número de tentativas configurado", async () => {
  let chamadas = 0;
  const fetchImpl = async () => {
    chamadas++;
    return { ok: false, status: 500, json: async () => ({ erro: "fora do ar" }) };
  };
  await assert.rejects(() => gerarUmaImagem({ prompt: "x" }, { fetchImpl, tentativas: 3, atrasoBaseMs: 1 }), /fora do ar/);
  assert.equal(chamadas, 3);
});

test("montarPlanoDeGeracao gera 1 quadro-mestre + N passos x variações", () => {
  const plano = montarPlanoDeGeracao({ quadroMestre: QUADRO_MESTRE, passos: PASSOS }, { variacoesPorPasso: 3 });
  assert.equal(plano.length, 1 + PASSOS.length * 3);
  assert.equal(plano[0].tipo, "quadroMestre");
  assert.equal(plano[0].referenciaDe, null);
});

test("montarPlanoDeGeracao: passo 1 referencia o quadro-mestre; passo 2 referencia a âncora do passo 1", () => {
  const plano = montarPlanoDeGeracao({ quadroMestre: QUADRO_MESTRE, passos: PASSOS }, { variacoesPorPasso: 3 });
  const passo1 = plano.filter((p) => p.numero === 1);
  const passo2 = plano.filter((p) => p.numero === 2);
  assert.ok(passo1.every((p) => p.referenciaDe === "quadroMestre"));
  assert.ok(passo2.every((p) => p.referenciaDe === "passo:1:1")); // sempre a âncora (variação 1), nunca a 2 ou 3
});

test("montarPlanoDeGeracao dá sementes distintas pra cada item, determinísticas (mesma entrada, mesmo plano)", () => {
  const plano1 = montarPlanoDeGeracao({ quadroMestre: QUADRO_MESTRE, passos: PASSOS });
  const plano2 = montarPlanoDeGeracao({ quadroMestre: QUADRO_MESTRE, passos: PASSOS });
  assert.deepEqual(plano1.map((p) => p.seed), plano2.map((p) => p.seed));
  const sementes = plano1.map((p) => p.seed);
  assert.equal(new Set(sementes).size, sementes.length); // nenhuma repetida
});

test("gerarTodasAsImagens recusa gerar sem aprovacaoExiste -- a barreira do projeto vira checagem de código aqui", async () => {
  await assert.rejects(
    () => gerarTodasAsImagens({ quadroMestre: QUADRO_MESTRE, passos: PASSOS }, { aprovacaoExiste: false, fetchImpl: fetchQueSempreFunciona() }),
    /Nenhuma imagem é gerada antes do aceite humano/
  );
});

test("gerarTodasAsImagens recusa mesmo se aprovacaoExiste vier undefined (omitido por engano)", async () => {
  await assert.rejects(() => gerarTodasAsImagens({ quadroMestre: QUADRO_MESTRE, passos: PASSOS }, { fetchImpl: fetchQueSempreFunciona() }));
});

test("gerarTodasAsImagens faz exatamente 1 + passos*variacoes chamadas, e cada passo recebe a imagem do elo anterior como referência", async () => {
  const chamadas = [];
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    chamadas.push(payload);
    return { ok: true, status: 200, json: async () => ({ imagemBase64: `img-seed${payload.seed}` }) };
  };
  await gerarTodasAsImagens({ quadroMestre: QUADRO_MESTRE, passos: PASSOS }, { aprovacaoExiste: true, fetchImpl, atrasoBaseMs: 1 });

  assert.equal(chamadas.length, 1 + PASSOS.length * 3);
  const chamadaQuadroMestre = chamadas.find((c) => c.prompt === QUADRO_MESTRE);
  assert.equal(chamadaQuadroMestre.imagemReferenciaBase64, null);

  const chamadasPasso1 = chamadas.filter((c) => c.prompt === "PROMPT PASSO 1");
  assert.ok(chamadasPasso1.every((c) => c.imagemReferenciaBase64 === `img-seed${chamadaQuadroMestre.seed}`));

  const chamadasPasso2 = chamadas.filter((c) => c.prompt === "PROMPT PASSO 2");
  const seedAncoraPasso1 = chamadasPasso1.find((c) => c.imagemReferenciaBase64 !== undefined).seed; // a primeira gerada é a âncora
  const anchorReal = chamadasPasso1[0].seed; // ordem de geração == ordem do plano == variação 1 primeiro
  assert.ok(chamadasPasso2.every((c) => c.imagemReferenciaBase64 === `img-seed${anchorReal}`));
});

test("gerarTodasAsImagens gera as variações de um mesmo passo em paralelo, não uma de cada vez", async () => {
  let emVooMaximo = 0;
  let emVooAgora = 0;
  const fetchImpl = async (url, opts) => {
    emVooAgora++;
    emVooMaximo = Math.max(emVooMaximo, emVooAgora);
    await new Promise((r) => setTimeout(r, 5));
    emVooAgora--;
    const payload = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ imagemBase64: `img-seed${payload.seed}` }) };
  };
  await gerarTodasAsImagens({ quadroMestre: QUADRO_MESTRE, passos: [{ numero: 1, prompt: "P1" }] }, {
    aprovacaoExiste: true,
    fetchImpl,
    atrasoBaseMs: 1,
    variacoesPorPasso: 3,
  });
  assert.ok(emVooMaximo >= 2, `esperado alguma concorrência de verdade entre as 3 variações, teve só ${emVooMaximo}`);
});

test("gerarTodasAsImagens: erro numa variação não trava as outras nem o resto da cadeia", async () => {
  const fetchImpl = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (payload.seed === 1011) {
      // a segunda variação do passo 1 (seed 1010, 1011, 1012)
      return { ok: false, status: 500, json: async () => ({ erro: "quebrou nesta variação" }) };
    }
    return { ok: true, status: 200, json: async () => ({ imagemBase64: `img-seed${payload.seed}` }) };
  };
  const resultados = [];
  const erros = [];
  await gerarTodasAsImagens({ quadroMestre: QUADRO_MESTRE, passos: PASSOS }, {
    aprovacaoExiste: true,
    fetchImpl,
    tentativas: 1,
    atrasoBaseMs: 1,
    onResultado: (item, r) => resultados.push({ item, r }),
    onErro: (item, e) => erros.push({ item, e }),
  });
  assert.equal(erros.length, 1);
  assert.equal(erros[0].item.numero, 1);
  assert.equal(erros[0].item.variacao, 2);
  assert.match(erros[0].e.message, /quebrou nesta variação/);
  // o resto da cadeia (inclusive o passo 2, que depende da âncora do passo 1 -- não da variação que quebrou) segue normal
  assert.equal(resultados.length, 1 + PASSOS.length * 3 - 1);
});
