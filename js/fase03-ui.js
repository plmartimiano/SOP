// Controle de tela da fase 03 (Extração de frames). Só é montado quando a
// fase 03 está selecionada (ver js/app.js). Depende do vídeo aprovado ainda
// estar na memória da sessão (sessao-midia.js) — se a página foi
// recarregada ou outro dossiê foi carregado, pede para reprocessar na fase
// 02 em vez de fingir que tem o vídeo.

import { extrairFrames } from "./frames-extrator.js";
import { montarCurva } from "./curva-movimento.js";
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
      const curva = montarCurva(frames);
      renderResultado(frames, curva);
    } catch (e) {
      resultadoEl.innerHTML = `<div class="status show erro">${e.message || "Erro inesperado ao extrair frames."}</div>`;
    } finally {
      URL.revokeObjectURL(url);
      botaoEl.disabled = false;
      progressoEl.textContent = "";
    }
  });

  function renderResultado(frames, curva) {
    const tiras = frames
      .map((f) => `<img src="${f.miniaturaDataUrl}" width="64" height="64" title="${f.tempoSegundos}s" alt="frame em ${f.tempoSegundos}s">`)
      .join("");

    resultadoEl.innerHTML = `
      <div class="status show ok">${frames.length} frames extraídos a 2 quadros/segundo (miniaturas 64×64, tons de cinza).</div>
      <div class="filmstrip">${tiras}</div>
      <div class="grafico-bloco">
        <h4>Curva de movimento — crua (cinza) e suavizada (azul)</h4>
        <canvas id="curvaCanvas" width="640" height="140"></canvas>
        <p class="grafico-legenda">Curva por zona da bancada ainda não existe — depende do mapa de zonas (pacote 1.1.2), não implementado.</p>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="act" id="extracaoGravar">Gravar no dossiê</button>
      </div>`;

    desenharGrafico(resultadoEl.querySelector("#curvaCanvas"), curva);

    resultadoEl.querySelector("#extracaoGravar").addEventListener("click", () => {
      onGravar({
        taxaAmostragemFps: 2,
        total: frames.length,
        tempos: frames.map((f) => f.tempoSegundos),
        curvaMovimento: curva,
      });
    });
  }
}

function desenharGrafico(canvasEl, curva) {
  const ctx = canvasEl.getContext("2d");
  const w = canvasEl.width;
  const h = canvasEl.height;
  const margem = 8;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  if (curva.length < 2) {
    ctx.fillStyle = "#565A60";
    ctx.font = "12px monospace";
    ctx.fillText("frames insuficientes para desenhar curva", margem, h / 2);
    return;
  }

  const valorMax = Math.max(1, ...curva.map((p) => Math.max(p.valorCru, p.valorSuavizado)));
  const x = (i) => margem + (i / (curva.length - 1)) * (w - margem * 2);
  const y = (v) => h - margem - (v / valorMax) * (h - margem * 2);

  function linha(chave, cor, largura) {
    ctx.beginPath();
    curva.forEach((p, i) => {
      const px = x(i);
      const py = y(p[chave]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = cor;
    ctx.lineWidth = largura;
    ctx.stroke();
  }

  linha("valorCru", "#C6C8C1", 1);
  linha("valorSuavizado", "#24425F", 2);
}
