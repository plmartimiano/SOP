// Controle de tela da fase 03 (Extração de frames). Só é montado quando a
// fase 03 está selecionada (ver js/app.js). Depende do vídeo aprovado ainda
// estar na memória da sessão (sessao-midia.js) — se a página foi
// recarregada ou outro dossiê foi carregado, pede para reprocessar na fase
// 02 em vez de fingir que tem o vídeo.

import { extrairFrames } from "./frames-extrator.js";
import { definirFramesExtraidos } from "./sessao-midia.js";

// container: elemento onde a ferramenta é desenhada.
// videoAprovadoNoDossie: bool — a fase 02 já gravou origemVideo?
// video: { file, dados } | null — vindo de obterVideoAprovado().
// onGravar: (dadosFrames) => void — grava a versão em "frames" e re-renderiza.
export function montarExtracao(container, { videoAprovadoNoDossie, video, onGravar }) {
  if (!videoAprovadoNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Grave um vídeo aprovado na fase 02 antes de extrair frames.</div>`;
    return;
  }
  if (!video) {
    container.innerHTML = `<div class="vaziomsg">O vídeo original não está mais disponível nesta sessão (a página foi recarregada, ou outro dossiê foi carregado depois). Volte à fase 02 e reprocesse o mesmo arquivo para poder extrair frames.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="row">
      <button class="act" id="extracaoBotao">Extrair frames (2/s)</button>
      <span class="mono" id="extracaoProgresso"></span>
    </div>
    <div id="extracaoResultado"></div>
    <video id="extracaoVideo" muted playsinline style="display:none"></video>
    <canvas id="extracaoCanvas" style="display:none"></canvas>`;

  const botaoEl = container.querySelector("#extracaoBotao");
  const progressoEl = container.querySelector("#extracaoProgresso");
  const resultadoEl = container.querySelector("#extracaoResultado");
  const videoEl = container.querySelector("#extracaoVideo");
  const canvasEl = container.querySelector("#extracaoCanvas");

  botaoEl.addEventListener("click", async () => {
    botaoEl.disabled = true;
    progressoEl.textContent = "preparando…";
    resultadoEl.innerHTML = "";

    const url = URL.createObjectURL(video.file);
    try {
      videoEl.src = url;
      await new Promise((resolve, reject) => {
        videoEl.addEventListener("loadedmetadata", resolve, { once: true });
        videoEl.addEventListener("error", () => reject(new Error("Não foi possível reabrir o vídeo.")), { once: true });
      });

      const frames = await extrairFrames(videoEl, canvasEl, {
        fps: 2,
        onProgresso: (feito, total) => {
          progressoEl.textContent = `${feito} / ${total} frames`;
        },
      });

      definirFramesExtraidos(frames);
      renderResultado(frames);
    } catch (e) {
      resultadoEl.innerHTML = `<div class="status show erro">${e.message || "Erro inesperado ao extrair frames."}</div>`;
    } finally {
      URL.revokeObjectURL(url);
      botaoEl.disabled = false;
      progressoEl.textContent = "";
    }
  });

  function renderResultado(frames) {
    const tiras = frames
      .map((f) => `<img src="${f.miniaturaDataUrl}" width="64" height="64" title="${f.tempoSegundos}s" alt="frame em ${f.tempoSegundos}s">`)
      .join("");

    resultadoEl.innerHTML = `
      <div class="status show ok">${frames.length} frames extraídos a 2 quadros/segundo (miniaturas 64×64, tons de cinza).</div>
      <div class="filmstrip">${tiras}</div>
      <div class="row" style="margin-top:12px">
        <button class="act" id="extracaoGravar">Gravar no dossiê</button>
      </div>`;

    resultadoEl.querySelector("#extracaoGravar").addEventListener("click", () => {
      onGravar({
        taxaAmostragemFps: 2,
        total: frames.length,
        tempos: frames.map((f) => f.tempoSegundos),
      });
    });
  }
}
