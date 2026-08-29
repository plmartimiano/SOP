// Pacote EAP 1.2.1 — Formato do dossiê. Este é o arquivo mais lido de todo
// o projeto: toda fase de 02 a 15 lê ou grava aqui, e js/app.js só sabe
// "o que rodou e o que falta" olhando este formato. Vale explicar o
// raciocínio por trás de cada decisão de forma, não só o que ela é.
//
// PASSO 1 — por que um arquivo único, e não um banco/backend.
// O MVP roda 100% no navegador (restrição fixada desde o início do
// projeto). Sem servidor de dados, o "banco" só pode ser um valor em
// memória que a pessoa exporta/importa como arquivo (pacote 1.2.3, em
// dossie-io.js). Isso significa que o dossiê PRECISA caber inteiro em RAM e
// em disco como um JSON — daí a regra de nunca guardar mídia em tamanho
// real aqui dentro (F01-01: vídeo e imagens vivem em sessao-midia.js, só
// na sessão do navegador; o dossiê guarda só os dados derivados, que são
// ordens de grandeza menores).
//
// PASSO 2 — por que dez seções fixas, e não uma lista dinâmica.
// Cada seção corresponde a um marco de saída do pipeline (F01-01): origem
// do vídeo, mapa de zonas, frames, ciclos, micro-ações, reconhecimento
// (a saída combinada das fases 07 e 08 — ver campoDistintivo em fases.js
// e a nota abaixo), os 6 passos, prompts, imagens, aprovações. Fixar essa
// lista (SECOES, congelada com Object.freeze pra pegar erro de digitação
// de nome de seção o quanto antes, em vez de silenciosamente criar uma
// seção nova por engano) significa que criarDossieVazio pode inicializar
// todas de uma vez — nenhuma fase precisa "criar sua seção na primeira
// vez que roda"; ela sempre já existe, vazia, esperando a primeira versão.
export const FORMAT_VERSION = "1.0.0";

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

// PASSO 3 — por que versão é sempre "acrescentar", nunca "substituir".
// Reprocessar um vídeo (ex.: refazer a fase 05 depois de mudar o mapa de
// zonas) não pode apagar silenciosamente o resultado anterior — é assim
// que se perde a rastreabilidade de "o que mudou e por quê" num
// documento de segurança. adicionarVersao por isso só sabe fazer
// push no histórico; não existe função "substituirVersao" no módulo.
// A REGRA de quando cada fase deve chamar isso (rodar de novo sempre cria
// versão? só quando o resultado muda?) é escopo do pacote 1.2.2, ainda
// não construído — aqui só a forma do arquivo já suporta o caso.
//
// meta.origem é opcional e existe só pra auditoria (qual pacote/fase
// gravou aquela versão) — cada fase.js/app.js já passa uma string fixa
// identificando a si mesma; não é validado contra nada, é texto livre.
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

// PASSO 4 — por que "versão atual" é simplesmente "a última do array".
// Isso funciona perfeitamente quando cada seção tem UM formato de dado
// ao longo de toda sua vida (o caso comum: fase04 grava "ciclos", só
// fase04 grava "ciclos"). Mas duas seções deste dossiê são gravadas por
// DUAS fases diferentes com formatos incompatíveis entre si:
// "reconhecimento" (fase 07 grava `nucleo`, fase 08 grava
// `regraHomologada`) e "imagens" (fase 13 grava `itens`, fase 14 grava
// `notas`/`ordem`/`continuidades`). obterVersaoAtual, por si só, devolve
// SEMPRE a versão mais recente da seção — que pode ser da fase "errada"
// se a pessoa quer especificamente o dado de UMA das duas. Por isso
// existe obterVersaoComCampo em js/app.js: ele varre o histórico de trás
// pra frente procurando a última versão que tem um campo específico (ver
// campoDistintivo em cada entrada de fases.js). Este módulo não sabe
// nada sobre isso — de propósito: dossie.js só entende "seção" e
// "versão", nunca o formato interno de `dados`.
export function obterVersaoAtual(dossie, secao) {
  if (!SECOES.includes(secao)) {
    throw new Error(`Seção desconhecida: "${secao}"`);
  }
  const historico = dossie.secoes[secao].versoes;
  if (historico.length === 0) return null;
  return historico[historico.length - 1];
}

// Todas as versões de uma seção, mais antiga primeiro — usada tanto pela
// tela "Estado no dossiê" (mostrar o histórico completo) quanto por
// obterVersaoComCampo (varrer de trás pra frente).
export function obterHistorico(dossie, secao) {
  if (!SECOES.includes(secao)) {
    throw new Error(`Seção desconhecida: "${secao}"`);
  }
  return dossie.secoes[secao].versoes;
}
