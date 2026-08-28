// Controle de tela da fase 02 (Ingestão do vídeo) — o primeiro pedaço do
// pipeline com processamento de verdade. Liga video-metadados.js (1.3.1) e
// video-qualidade.js (1.3.2) ao DOM. Só é montado quando a fase 02 está
// selecionada (ver js/app.js).

import { lerVideo } from "./video-metadados.js";
import { triarQualidade } from "./video-qualidade.js";

function formatarResolucao(r) {
  return `${r.largura}×${r.altura}`;
}

function linhaMeta(rotulo, valor) {
  return `<div><b>${rotulo}</b><span>${valor}</span></div>`;
}

// container: elemento onde a ferramenta é desenhada.
// obterDossie: () => dossiê atual ou null.
// onGravar: (dadosOrigemVideo) => void — grava a versão no dossiê e re-renderiza a tela.
export function montarIngestao(container, { obterDossie, onGravar }) {
  container.innerHTML = `
    <div class="ingestao">
      <div class="row">
        <label class="act secondary" style="cursor:pointer">
          Escolher vídeo MP4
          <input type="file" id="ingestaoArquivo" accept="video/mp4,.mp4" style="display:none">
        </label>
        <span class="mono" id="ingestaoNomeArquivo"></span>
      </div>
      <div id="ingestaoResultado"></div>
      <video id="ingestaoVideo" muted playsinline style="display:none"></video>
      <canvas id="ingestaoCanvas" style="display:none"></canvas>
    </div>`;

  const inputEl = container.querySelector("#ingestaoArquivo");
  const nomeEl = container.querySelector("#ingestaoNomeArquivo");
  const resultadoEl = container.querySelector("#ingestaoResultado");
  const videoEl = container.querySelector("#ingestaoVideo");
  const canvasEl = container.querySelector("#ingestaoCanvas");

  function renderCarregando(nome) {
    resultadoEl.innerHTML = `<div class="ingestao-carregando">Lendo metadados de <span class="mono">${nome}</span>…</div>`;
  }

  function renderErro(mensagem) {
    resultadoEl.innerHTML = `<div class="status show erro">${mensagem}</div>`;
  }

  function renderResultado(dados, triagem) {
    const linhas = [
      linhaMeta("Duração", `${dados.duracaoSegundos.toFixed(1)}s`),
      linhaMeta("Resolução", formatarResolucao(dados.resolucao)),
      linhaMeta("Orientação", dados.orientacao),
      linhaMeta("FPS", dados.fps === null ? "não medido" : `${dados.fps}fps`),
      linhaMeta("Luminância", dados.luminanciaMedia === null ? "não medida" : `${dados.luminanciaMedia.toFixed(0)} / 255`),
    ].join("");

    const motivos = triagem.motivos.map((m) => `<li>${m}</li>`).join("");
    const avisos = triagem.avisos.map((a) => `<li>${a}</li>`).join("");

    resultadoEl.innerHTML = `
      <div class="io" style="margin-top:12px">${linhas}</div>
      <div class="status show ${triagem.aprovado ? "ok" : "erro"}">
        <div>${triagem.aprovado ? "Aprovado na triagem." : "Recusado na triagem — regrave o vídeo:"}</div>
        ${motivos ? `<ul>${motivos}</ul>` : ""}
      </div>
      ${avisos ? `<details class="jsonview"><summary>Avisos (${triagem.avisos.length})</summary><ul style="padding:12px 12px 12px 28px;margin:0">${avisos}</ul></details>` : ""}
      <div class="row" style="margin-top:12px">
        <button class="act" id="ingestaoGravar" ${triagem.aprovado && obterDossie() ? "" : "disabled"}>Gravar no dossiê</button>
        ${!obterDossie() ? '<span class="mono" style="font-size:12px">crie ou carregue um dossiê primeiro</span>' : ""}
      </div>`;

    const btnGravar = resultadoEl.querySelector("#ingestaoGravar");
    if (btnGravar) {
      btnGravar.addEventListener("click", () => onGravar(dados));
    }
  }

  inputEl.addEventListener("change", async () => {
    const file = inputEl.files[0];
    inputEl.value = "";
    if (!file) return;
    nomeEl.textContent = file.name;
    renderCarregando(file.name);
    try {
      const dados = await lerVideo(file, { videoEl, canvasEl });
      const triagem = triarQualidade(dados);
      renderResultado(dados, triagem);
    } catch (e) {
      renderErro(e.message || "Erro inesperado ao ler o vídeo.");
    }
  });
}
