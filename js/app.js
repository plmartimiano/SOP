// Liga os módulos de dossiê (1.2.1), exportar/importar (1.2.3) e a lista de
// fases (1.2.4) aos controles de index.html. A navegação usa o hash da URL
// (#fase-08) para que voltar/avançar no navegador e recarregar a página
// mantenham a fase selecionada — sem framework, sem build.

import { criarDossieVazio, adicionarVersao, obterVersaoAtual, obterHistorico, SECOES } from "./dossie.js";
import { exportarDossie, importarDossieDeArquivo, ErroImportacao } from "./dossie-io.js";
import { FASES } from "./fases.js";
import { montarMapaZonas } from "./fase00-ui.js";
import { montarIngestao } from "./fase02-ui.js";
import { montarExtracao } from "./fase03-ui.js";
import { montarDeteccaoCiclos } from "./fase04-ui.js";
import { montarFatiamento } from "./fase05-ui.js";
import { montarLeituraSemantica } from "./fase06-ui.js";
import { montarConsensoUI } from "./fase07-ui.js";
import { montarReconhecimento } from "./fase08-ui.js";
import { montarConsolidacao } from "./fase09-ui.js";
import { montarFichas } from "./fase10-ui.js";
import { definirVideoAprovado, obterVideoAprovado, obterFramesExtraidos, limparSessaoMidia } from "./sessao-midia.js";

let dossie = null;

const TITULO_FERRAMENTA = {
  "00": "Mapear zonas da bancada",
  "02": "Processar vídeo",
  "03": "Extrair frames",
  "04": "Detectar ciclos",
  "05": "Fatiar em micro-ações",
  "06": "Ler frames-chave",
  "07": "Calcular consenso",
  "08": "Reconhecer a estação",
  "09": "Consolidar nos 6 passos",
  "10": "Gerar a ficha de cada passo",
};

const sidebarEl = document.getElementById("sidebar");
const painelEl = document.getElementById("painelFase");
const jsonviewEl = document.getElementById("jsonview");
const jsontextEl = document.getElementById("jsontext");
const statusEl = document.getElementById("status");
const btnExportar = document.getElementById("btnExportar");

function faseAtualNumero() {
  const m = location.hash.match(/^#fase-(\d+)$/);
  return m ? m[1] : FASES[0].numero;
}

function irParaFase(numero) {
  location.hash = `#fase-${numero}`;
}

function mostrarStatus(mensagem, tipo, detalhes = []) {
  statusEl.className = `status show ${tipo}`;
  statusEl.innerHTML = `<div>${mensagem}</div>` +
    (detalhes.length ? `<ul>${detalhes.map((d) => `<li>${d}</li>`).join("")}</ul>` : "");
}

function limparStatus() {
  statusEl.className = "status";
  statusEl.innerHTML = "";
}

// Algumas fases compartilham seção (07 e 08 gravam as duas em
// "reconhecimento", com formatos diferentes). obterVersaoAtual pegaria a
// versão mais recente da seção, que pode ser da OUTRA fase — isso busca,
// de trás pra frente, a última versão que tem o campo que marca "isto é da
// fase que eu quero" (ver campoDistintivo em fases.js).
function obterVersaoComCampo(secao, campo) {
  if (!dossie) return null;
  const historico = obterHistorico(dossie, secao);
  for (let i = historico.length - 1; i >= 0; i--) {
    if (historico[i].dados[campo] !== undefined) return historico[i];
  }
  return null;
}

// Uma fase "rodou" quando a seção do dossiê que ela alimenta tem pelo menos
// uma versão. Fases sem seção própria (01, 15, 16) usam uma regra própria.
function faseRodou(fase) {
  if (fase.ehContainer) return dossie !== null;
  if (!fase.secaoDossie) return false;
  if (!dossie) return false;
  return obterVersaoAtual(dossie, fase.secaoDossie) !== null;
}

function renderSidebar() {
  const numeroAtual = faseAtualNumero();
  sidebarEl.innerHTML = FASES.map((fase) => {
    const ativa = fase.numero === numeroAtual;
    const rodou = faseRodou(fase);
    return `<button class="sidebar-item ${fase.tipo}${ativa ? " active" : ""}" data-numero="${fase.numero}">
      <span class="chip mono">${fase.numero}</span>
      <span class="titulo">${fase.titulo}</span>
      <span class="dot${rodou ? " rodou" : ""}" title="${rodou ? "já rodou" : "ainda não rodou"}"></span>
    </button>`;
  }).join("");

  sidebarEl.querySelectorAll(".sidebar-item").forEach((btn) => {
    btn.addEventListener("click", () => irParaFase(btn.dataset.numero));
  });
}

function renderEstadoDaFase(fase) {
  if (fase.ehContainer) {
    if (!dossie) {
      return `<div class="vaziomsg">Nenhum dossiê carregado — crie um novo ou carregue o exemplo acima.</div>`;
    }
    const linhas = SECOES.map((nome) => {
      const historico = obterHistorico(dossie, nome);
      return `<div>${historico.length ? `v${historico.length}` : "—"} · ${nome}</div>`;
    }).join("");
    return `<div class="rodou">Dossiê "${dossie.estacao.nome || "(sem nome)"}" — ${SECOES.filter((s) => obterHistorico(dossie, s).length).length} de ${SECOES.length} seções com dado.</div>
      <div style="font-size:13px">${linhas}</div>`;
  }

  if (!fase.secaoDossie) {
    return `<div class="vaziomsg">Esta fase não grava uma seção própria no dossiê (ver nota acima) — o pacote que a implementa ainda não existe.</div>`;
  }

  if (!dossie) {
    return `<div class="vaziomsg">Nenhum dossiê carregado — crie um novo ou carregue o exemplo acima.</div>`;
  }

  const atual = fase.campoDistintivo ? obterVersaoComCampo(fase.secaoDossie, fase.campoDistintivo) : obterVersaoAtual(dossie, fase.secaoDossie);
  if (!atual) {
    return `<div class="vaziomsg">Esta fase ainda não rodou (seção "${fase.secaoDossie}" sem versões${fase.campoDistintivo ? ` com o campo "${fase.campoDistintivo}"` : ""}).</div>`;
  }

  const historico = obterHistorico(dossie, fase.secaoDossie);
  return `<div class="rodou">v${atual.versao} de ${historico.length} · gravado em ${new Date(atual.data).toLocaleString("pt-BR")}${atual.origem ? ` · ${atual.origem}` : ""}</div>
    <pre class="jsontext mono">${JSON.stringify(atual.dados, null, 2)}</pre>`;
}

function renderPainel() {
  const numero = faseAtualNumero();
  const fase = FASES.find((f) => f.numero === numero) || FASES[0];

  painelEl.innerHTML = `
    <article class="fasecard ${fase.tipo}">
      <div class="fasehead">
        <div class="top">
          <span class="num mono">${fase.numero}</span>
          <h2>${fase.titulo}</h2>
          <span class="tag">${fase.tipo === "humano" ? "decisão humana" : fase.tipo === "pago" ? "chamada paga" : "automático"}</span>
        </div>
        <div class="sub">${fase.subtitulo}</div>
      </div>
      <div class="fasebody">
        <div class="io">
          <div><b>ENTRA</b><span>${fase.entra}</span></div>
          <div><b>SAI</b><span>${fase.sai}</span></div>
          ${fase.decide ? `<div><b>DECIDE</b><span>${fase.decide}</span></div>` : ""}
        </div>
        <div class="gatebar"><span>Passa se</span>${fase.gate}</div>
        ${fase.notaSecao ? `<div class="notasecao">${fase.notaSecao}</div>` : ""}
        ${["00", "02", "03", "04", "05", "06", "07", "08", "09", "10"].includes(fase.numero) ? `<div class="ferramenta"><h3>${TITULO_FERRAMENTA[fase.numero]}</h3><div id="faseFerramenta"></div></div>` : ""}
        <div class="estado">
          <h3>Estado no dossiê</h3>
          ${renderEstadoDaFase(fase)}
        </div>
      </div>
    </article>`;

  if (fase.numero === "00") {
    montarMapaZonas(document.getElementById("faseFerramenta"), {
      obterDossie: () => dossie,
      onGravar: (dadosMapaDeZonas) => {
        if (!dossie) return;
        adicionarVersao(dossie, "mapaDeZonas", dadosMapaDeZonas, { origem: "F00-03" });
        renderTudo();
        mostrarStatus(`Mapa de zonas gravado no dossiê (${dadosMapaDeZonas.zonas.length} zona${dadosMapaDeZonas.zonas.length === 1 ? "" : "s"}).`, "ok");
      },
    });
  }

  if (fase.numero === "02") {
    montarIngestao(document.getElementById("faseFerramenta"), {
      obterDossie: () => dossie,
      onGravar: (dadosOrigemVideo, file) => {
        if (!dossie) return;
        adicionarVersao(dossie, "origemVideo", dadosOrigemVideo, { origem: "F02-01/F02-02" });
        definirVideoAprovado(file, dadosOrigemVideo);
        renderTudo();
        mostrarStatus("Origem do vídeo gravada no dossiê (seção \"origemVideo\").", "ok");
      },
    });
  }

  if (fase.numero === "03") {
    const mapaDeZonasAtual = dossie ? obterVersaoAtual(dossie, "mapaDeZonas") : null;
    montarExtracao(document.getElementById("faseFerramenta"), {
      videoAprovadoNoDossie: dossie ? obterVersaoAtual(dossie, "origemVideo") !== null : false,
      video: obterVideoAprovado(),
      zonas: mapaDeZonasAtual ? mapaDeZonasAtual.dados.zonas : [],
      onGravar: (dadosFrames) => {
        if (!dossie) return;
        adicionarVersao(dossie, "frames", dadosFrames, { origem: "F03-01/F03-02" });
        renderTudo();
        mostrarStatus("Frames gravados no dossiê (seção \"frames\").", "ok");
      },
    });
  }

  if (fase.numero === "04") {
    montarDeteccaoCiclos(document.getElementById("faseFerramenta"), {
      framesRodouNoDossie: dossie ? obterVersaoAtual(dossie, "frames") !== null : false,
      frames: obterFramesExtraidos(),
      onGravar: (dadosCiclos) => {
        if (!dossie) return;
        adicionarVersao(dossie, "ciclos", dadosCiclos, { origem: "F04-01/F04-02/F04-03/F04-04/F04-05" });
        renderTudo();
        mostrarStatus(`Ciclos gravados no dossiê (${dadosCiclos.total} ciclo${dadosCiclos.total === 1 ? "" : "s"}).`, "ok");
      },
    });
  }

  if (fase.numero === "05") {
    const mapaDeZonasAtual = dossie ? obterVersaoAtual(dossie, "mapaDeZonas") : null;
    const ciclosAtual = dossie ? obterVersaoAtual(dossie, "ciclos") : null;
    montarFatiamento(document.getElementById("faseFerramenta"), {
      ciclosRodouNoDossie: ciclosAtual !== null,
      frames: obterFramesExtraidos(),
      ciclos: ciclosAtual ? ciclosAtual.dados.lista : [],
      zonas: mapaDeZonasAtual ? mapaDeZonasAtual.dados.zonas : [],
      onGravar: (dadosMicroAcoes) => {
        if (!dossie) return;
        adicionarVersao(dossie, "microAcoes", dadosMicroAcoes, { origem: "F05-01/F05-02/F05-03/F05-04/F05-05" });
        renderTudo();
        mostrarStatus("Micro-ações gravadas no dossiê (seção \"microAcoes\").", "ok");
      },
    });
  }

  if (fase.numero === "06") {
    const mapaDeZonasAtual = dossie ? obterVersaoAtual(dossie, "mapaDeZonas") : null;
    const microAcoesAtual = dossie ? obterVersaoAtual(dossie, "microAcoes") : null;
    montarLeituraSemantica(document.getElementById("faseFerramenta"), {
      microAcoesRodouNoDossie: microAcoesAtual !== null,
      frames: obterFramesExtraidos(),
      porCiclo: microAcoesAtual ? microAcoesAtual.dados.porCiclo : [],
      zonas: mapaDeZonasAtual ? mapaDeZonasAtual.dados.zonas : [],
      onGravar: (dadosMicroAcoes) => {
        if (!dossie) return;
        adicionarVersao(dossie, "microAcoes", dadosMicroAcoes, { origem: "F06-01/F06-02/F06-03/F06-04/F06-05" });
        renderTudo();
        mostrarStatus("Leitura semântica gravada no dossiê (nova versão de \"microAcoes\").", "ok");
      },
    });
  }

  if (fase.numero === "07") {
    const ciclosAtual = dossie ? obterVersaoAtual(dossie, "ciclos") : null;
    const microAcoesAtual = dossie ? obterVersaoAtual(dossie, "microAcoes") : null;
    montarConsensoUI(document.getElementById("faseFerramenta"), {
      ciclosRodouNoDossie: ciclosAtual !== null,
      microAcoesRodouNoDossie: microAcoesAtual !== null,
      porCiclo: microAcoesAtual ? microAcoesAtual.dados.porCiclo : [],
      listaCiclos: ciclosAtual ? ciclosAtual.dados.lista : [],
      onGravar: (dadosReconhecimento) => {
        if (!dossie) return;
        adicionarVersao(dossie, "reconhecimento", dadosReconhecimento, { origem: "F07-01/F07-02/F07-03/F07-05" });
        renderTudo();
        mostrarStatus(`Consenso gravado no dossiê (${dadosReconhecimento.nucleo.length} no núcleo, ${dadosReconhecimento.excecoes.length} em exceção).`, "ok");
      },
    });
  }

  if (fase.numero === "08") {
    const consensoFase07 = obterVersaoComCampo("reconhecimento", "nucleo");
    const microAcoesAtual = dossie ? obterVersaoAtual(dossie, "microAcoes") : null;
    const ciclosAtual = dossie ? obterVersaoAtual(dossie, "ciclos") : null;
    montarReconhecimento(document.getElementById("faseFerramenta"), {
      reconhecimentoRodouNoDossie: consensoFase07 !== null,
      porCiclo: microAcoesAtual ? microAcoesAtual.dados.porCiclo : [],
      nucleo: consensoFase07 ? consensoFase07.dados.nucleo : [],
      listaCiclos: ciclosAtual ? ciclosAtual.dados.lista : [],
      onGravar: (dadosReconhecimento) => {
        if (!dossie) return;
        adicionarVersao(dossie, "reconhecimento", dadosReconhecimento, { origem: "F08-01/F08-02/F08-03/F08-04/F08-05/F08-06/F08-07/F08-08" });
        renderTudo();
        mostrarStatus(`Regra homologada e gravada no dossiê ("${dadosReconhecimento.regraHomologada.nomeCriterio}").`, "ok");
      },
    });
  }

  if (fase.numero === "09") {
    const consensoFase07 = obterVersaoComCampo("reconhecimento", "nucleo");
    const homologacaoFase08 = obterVersaoComCampo("reconhecimento", "regraHomologada");
    montarConsolidacao(document.getElementById("faseFerramenta"), {
      nucleo: consensoFase07 ? consensoFase07.dados.nucleo : null,
      regraHomologada: homologacaoFase08 ? homologacaoFase08.dados.regraHomologada : null,
      onGravar: (dadosConsolidacao) => {
        if (!dossie) return;
        adicionarVersao(dossie, "passos", dadosConsolidacao, { origem: "1.5.4 (motor de consolidação, aplica F09-02 já homologado)" });
        renderTudo();
        mostrarStatus(`Consolidado em ${dadosConsolidacao.passos.length} passos e gravado no dossiê.`, "ok");
      },
    });
  }

  if (fase.numero === "10") {
    const passosAtual = dossie ? obterVersaoAtual(dossie, "passos") : null;
    const consensoFase07 = obterVersaoComCampo("reconhecimento", "nucleo");
    montarFichas(document.getElementById("faseFerramenta"), {
      passos: passosAtual ? passosAtual.dados.passos : null,
      nucleo: consensoFase07 ? consensoFase07.dados.nucleo : null,
      cicloExemplarIndice: consensoFase07 ? consensoFase07.dados.cicloExemplarIndice : null,
      onGravar: (dadosFichas) => {
        if (!dossie) return;
        adicionarVersao(dossie, "passos", dadosFichas, { origem: "1.6 (a ficha de cada passo)" });
        renderTudo();
        mostrarStatus(`${dadosFichas.passos.length} fichas geradas e gravadas no dossiê.`, "ok");
      },
    });
  }
}

function renderDossieToolbar() {
  if (!dossie) {
    jsonviewEl.hidden = true;
    btnExportar.disabled = true;
    return;
  }
  jsonviewEl.hidden = false;
  jsontextEl.textContent = JSON.stringify(dossie, null, 2);
  btnExportar.disabled = false;
}

function renderTudo() {
  renderDossieToolbar();
  renderSidebar();
  renderPainel();
}

document.getElementById("btnNovo").addEventListener("click", () => {
  dossie = criarDossieVazio({ nome: "Estação nova" });
  limparSessaoMidia();
  limparStatus();
  renderTudo();
});

document.getElementById("btnExemplo").addEventListener("click", async () => {
  const resp = await fetch("fixtures/dossie-exemplo.json");
  dossie = await resp.json();
  limparSessaoMidia();
  limparStatus();
  renderTudo();
});

document.getElementById("btnExportar").addEventListener("click", () => {
  if (!dossie) return;
  const nomeArquivo = exportarDossie(dossie);
  mostrarStatus(`Baixado como <span class="mono">${nomeArquivo}</span>.`, "ok");
});

document.getElementById("inputImportar").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const { dossie: carregado, avisos } = await importarDossieDeArquivo(file);
    dossie = carregado;
    limparSessaoMidia();
    renderTudo();
    if (avisos.length) {
      mostrarStatus("Dossiê carregado, com avisos:", "erro", avisos);
    } else {
      mostrarStatus("Dossiê carregado com sucesso. Continuando de onde parou.", "ok");
    }
  } catch (e) {
    if (e instanceof ErroImportacao) {
      mostrarStatus(e.message, "erro", e.erros);
    } else {
      mostrarStatus("Erro inesperado ao carregar o arquivo.", "erro", [String(e.message || e)]);
    }
  }
});

window.addEventListener("hashchange", () => {
  renderSidebar();
  renderPainel();
});

if (!location.hash) {
  location.hash = `#fase-${FASES[0].numero}`;
}
renderTudo();
