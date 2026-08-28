// Testes do pacote 1.2.1 (formato) e 1.2.3 (exportar/importar).
// Rodar com: node --test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  FORMAT_VERSION,
  SECOES,
  criarDossieVazio,
  adicionarVersao,
  obterVersaoAtual,
  obterHistorico,
} from "../js/dossie.js";
import { validarDossie } from "../js/dossie-validar.js";
import {
  serializarDossie,
  importarDossieDeTexto,
  ErroImportacao,
} from "../js/dossie-io.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exemploPath = path.join(__dirname, "..", "fixtures", "dossie-exemplo.json");

test("dossiê vazio tem as dez seções do F01-01, todas sem versão", () => {
  const dossie = criarDossieVazio({ nome: "Estação teste" });
  assert.equal(dossie.formatVersion, FORMAT_VERSION);
  assert.equal(Object.keys(dossie.secoes).length, SECOES.length);
  for (const nome of SECOES) {
    assert.deepEqual(dossie.secoes[nome].versoes, []);
  }
  const { valido, erros } = validarDossie(dossie);
  assert.equal(valido, true, erros.join("; "));
});

test("adicionarVersao nunca sobrescreve: duas chamadas geram v1 e v2, ambas legíveis", () => {
  const dossie = criarDossieVazio({ nome: "Estação teste" });
  adicionarVersao(dossie, "passos", [{ numero: 1, titulo: "Primeira leitura" }]);
  adicionarVersao(dossie, "passos", [{ numero: 1, titulo: "Segunda leitura, corrigida" }]);

  const historico = obterHistorico(dossie, "passos");
  assert.equal(historico.length, 2);
  assert.equal(historico[0].versao, 1);
  assert.equal(historico[1].versao, 2);
  assert.equal(historico[0].dados[0].titulo, "Primeira leitura");
  assert.equal(historico[1].dados[0].titulo, "Segunda leitura, corrigida");

  const atual = obterVersaoAtual(dossie, "passos");
  assert.equal(atual.versao, 2);
});

test("adicionarVersao rejeita seção desconhecida", () => {
  const dossie = criarDossieVazio();
  assert.throws(() => adicionarVersao(dossie, "secao-que-nao-existe", {}), /Seção desconhecida/);
});

test("obterVersaoAtual devolve null quando a fase ainda não rodou", () => {
  const dossie = criarDossieVazio();
  assert.equal(obterVersaoAtual(dossie, "prompts"), null);
});

test("exemplo fictício em fixtures/dossie-exemplo.json comporta as dez seções e é válido", () => {
  const texto = readFileSync(exemploPath, "utf8");
  const dossie = JSON.parse(texto);
  const { valido, erros } = validarDossie(dossie);
  assert.equal(valido, true, erros.join("; "));
  for (const nome of SECOES) {
    assert.ok(nome in dossie.secoes, `seção ausente: ${nome}`);
  }
  // A seção "passos" do exemplo tem duas versões (correção da mesa de
  // validação) — prova que o formato aguenta reprocessamento sem apagar nada.
  assert.equal(dossie.secoes.passos.versoes.length, 2);
});

test("round-trip: serializar e importar de volta reproduz o mesmo dossiê", () => {
  const original = criarDossieVazio({ nome: "Estação 4" });
  adicionarVersao(original, "origemVideo", { arquivoNome: "video.mp4" });

  const texto = serializarDossie(original);
  const { dossie: reimportado, avisos } = importarDossieDeTexto(texto);

  assert.deepEqual(reimportado, original);
  assert.deepEqual(avisos, []);
});

test("importarDossieDeTexto rejeita JSON malformado com erro legível", () => {
  assert.throws(
    () => importarDossieDeTexto("{ isso não é json"),
    (err) => err instanceof ErroImportacao && /JSON válido/.test(err.message)
  );
});

test("importarDossieDeTexto rejeita estrutura que não é um dossiê, listando o motivo", () => {
  assert.throws(
    () => importarDossieDeTexto(JSON.stringify({ qualquerCoisa: true })),
    (err) => {
      assert.ok(err instanceof ErroImportacao);
      assert.ok(err.erros.length > 0);
      return true;
    }
  );
});

test("importarDossieDeTexto avisa (mas não bloqueia) quando formatVersion é diferente", () => {
  const dossie = criarDossieVazio();
  dossie.formatVersion = "0.9.0";
  const { avisos } = importarDossieDeTexto(JSON.stringify(dossie));
  assert.ok(avisos.some((a) => a.includes("0.9.0")));
});

test("o exemplo fictício sobrevive ao ciclo baixar → reabrir → carregar", () => {
  const textoOriginal = readFileSync(exemploPath, "utf8");
  const dossieOriginal = JSON.parse(textoOriginal);

  // "Baixar": serializa exatamente como exportarDossie faria.
  const textoExportado = serializarDossie(dossieOriginal);
  // "Fechar o navegador e reabrir" não muda o conteúdo do arquivo — só
  // simula que o texto agora vem de outra sessão, sem estado JS anterior.
  const { dossie: dossieCarregado } = importarDossieDeTexto(textoExportado);

  assert.deepEqual(dossieCarregado, dossieOriginal);
  // "Continuar de onde parou": dá para acrescentar uma fase nova.
  adicionarVersao(dossieCarregado, "prompts", [{ passoNumero: 1, texto: "..." }]);
  assert.equal(obterHistorico(dossieCarregado, "prompts").length, 1);
});
