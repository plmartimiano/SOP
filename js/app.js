// Liga o módulo de dossiê (1.2.1) e o de exportar/importar (1.2.3) aos
// controles de index.html. Não é a "interface por etapa" do pacote 1.2.4 —
// é só a casca mínima para exercitar os dois pacotes em uso real no navegador.

import { SECOES, criarDossieVazio, obterVersaoAtual } from "./dossie.js";
import { exportarDossie, importarDossieDeArquivo, ErroImportacao } from "./dossie-io.js";

const ROTULOS_SECAO = {
  origemVideo: "Origem do vídeo",
  mapaDeZonas: "Mapa de zonas",
  frames: "Frames",
  ciclos: "Ciclos",
  microAcoes: "Micro-ações",
  reconhecimento: "Reconhecimento",
  passos: "Passos",
  prompts: "Prompts",
  imagens: "Imagens",
  aprovacoes: "Aprovações",
};

let dossie = null;

const resumoEl = document.getElementById("resumo");
const jsonviewEl = document.getElementById("jsonview");
const jsontextEl = document.getElementById("jsontext");
const statusEl = document.getElementById("status");
const btnExportar = document.getElementById("btnExportar");

function mostrarStatus(mensagem, tipo, detalhes = []) {
  statusEl.className = `status show ${tipo}`;
  statusEl.innerHTML = `<div>${mensagem}</div>` +
    (detalhes.length ? `<ul>${detalhes.map((d) => `<li>${d}</li>`).join("")}</ul>` : "");
}

function limparStatus() {
  statusEl.className = "status";
  statusEl.innerHTML = "";
}

function renderizar() {
  if (!dossie) {
    resumoEl.innerHTML = "";
    jsonviewEl.hidden = true;
    btnExportar.disabled = true;
    return;
  }

  resumoEl.innerHTML = SECOES.map((nome) => {
    const atual = obterVersaoAtual(dossie, nome);
    const vazia = atual === null;
    return `<div class="stat${vazia ? " vazia" : ""}">
      <div class="n">${vazia ? "—" : `v${atual.versao}`}</div>
      <div class="label">${ROTULOS_SECAO[nome]}</div>
    </div>`;
  }).join("");

  jsonviewEl.hidden = false;
  jsontextEl.textContent = JSON.stringify(dossie, null, 2);
  btnExportar.disabled = false;
}

document.getElementById("btnNovo").addEventListener("click", () => {
  dossie = criarDossieVazio({ nome: "Estação nova" });
  limparStatus();
  renderizar();
});

document.getElementById("btnExemplo").addEventListener("click", async () => {
  const resp = await fetch("fixtures/dossie-exemplo.json");
  dossie = await resp.json();
  limparStatus();
  renderizar();
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
    renderizar();
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

renderizar();
