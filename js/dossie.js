// Pacote EAP 1.2.1 — Formato do dossiê.
// Dossiê = único arquivo que atravessa todas as fases do pipeline (ver F01-01).
// Cada seção guarda um histórico de versões (array "versoes"), nunca sobrescrito
// aqui: quem decide QUANDO acrescentar uma versão nova é a fase que produziu o
// dado (a aplicação estrita da regra "reprocessar nunca sobrescreve" é escopo
// do pacote 1.2.2). Este módulo só garante que a forma do arquivo comporta isso.

export const FORMAT_VERSION = "1.0.0";

// Nomes oficiais das dez seções do dossiê (F01-01): origem do vídeo, mapa de
// zonas, frames, ciclos, micro-ações, relatório de reconhecimento, os 6
// passos, prompts, imagens, aprovações.
export const SECOES = Object.freeze([
  "origemVideo",
  "mapaDeZonas",
  "frames",
  "ciclos",
  "microAcoes",
  "reconhecimento",
  "passos",
  "prompts",
  "imagens",
  "aprovacoes",
]);

function agoraISO() {
  return new Date().toISOString();
}

// Cria um dossiê novo, vazio: todas as seções presentes, nenhuma com versão
// ainda. `estacao` é só identificação (nome, linha) — os dados de verdade
// entram via adicionarVersao à medida que cada fase roda.
export function criarDossieVazio(estacao = {}) {
  const criadoEm = agoraISO();
  const secoes = {};
  for (const nome of SECOES) {
    secoes[nome] = { versoes: [] };
  }
  return {
    formatVersion: FORMAT_VERSION,
    criadoEm,
    atualizadoEm: criadoEm,
    estacao: {
      nome: estacao.nome ?? "",
      linha: estacao.linha ?? "",
    },
    secoes,
  };
}

// Acrescenta uma nova versão a uma seção. Nunca apaga as anteriores — é o
// mecanismo que a fase 09, por exemplo, usa para gravar "passos_v2" ao lado
// de "passos_v1" sem perder o histórico (F01-02, aplicado por quem chama).
export function adicionarVersao(dossie, secao, dados, meta = {}) {
  if (!SECOES.includes(secao)) {
    throw new Error(`Seção desconhecida: "${secao}"`);
  }
  const historico = dossie.secoes[secao].versoes;
  const proximaVersao = historico.length + 1;
  historico.push({
    versao: proximaVersao,
    data: agoraISO(),
    ...(meta.origem ? { origem: meta.origem } : {}),
    dados,
  });
  dossie.atualizadoEm = agoraISO();
  return dossie;
}

// Última versão gravada de uma seção, ou null se a fase ainda não rodou.
export function obterVersaoAtual(dossie, secao) {
  if (!SECOES.includes(secao)) {
    throw new Error(`Seção desconhecida: "${secao}"`);
  }
  const historico = dossie.secoes[secao].versoes;
  if (historico.length === 0) return null;
  return historico[historico.length - 1];
}

// Todas as versões de uma seção, mais antiga primeiro.
export function obterHistorico(dossie, secao) {
  if (!SECOES.includes(secao)) {
    throw new Error(`Seção desconhecida: "${secao}"`);
  }
  return dossie.secoes[secao].versoes;
}
