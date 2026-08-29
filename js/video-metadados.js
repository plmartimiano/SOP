// Pacote EAP 1.3.1 — Entrada de arquivo.
// Lê metadados do MP4 direto no navegador: duração, resolução, fps estimado
// e uma amostra de luminância (usada pela triagem em video-qualidade.js).
// Precisa de DOM real (elemento <video> + <canvas>) — por isso não é
// testado com node:test, e sim num navegador de verdade (ver
// tests-manuais/ no scratchpad da sessão e o README).

export function lerMetadadosBasicos(videoEl) {
  return {
    duracaoSegundos: videoEl.duration,
    resolucao: { largura: videoEl.videoWidth, altura: videoEl.videoHeight },
    orientacao: videoEl.videoHeight > videoEl.videoWidth ? "vertical" : "horizontal",
  };
}

// PASSO — por que medir fps decodificando de verdade, em vez de confiar
// nos metadados do contêiner MP4 (que às vezes trazem um "frame rate
// nominal" impreciso, ou nem trazem nada de jeito acessível via API do
// navegador). requestVideoFrameCallback dispara exatamente uma vez por
// quadro DECODIFICADO — contar quantas vezes ele disparou num intervalo
// de tempo real (metadata.mediaTime, o relógio do próprio vídeo, não
// Date.now()) dá o fps de verdade que o navegador está entregando,
// mesmo se o arquivo mentir sobre si mesmo ou a decodificação for mais
// lenta que o nominal. O preço é que o vídeo precisa ser reproduzido de
// verdade (daí videoEl.play()) por um intervalo (`janelaMs`, 1s por
// padrão) — inevitável pra medir algo que só existe durante reprodução.
//
// Conta quadros de verdade decodificados num intervalo curto. Sem
// requestVideoFrameCallback (Firefox, Safari antigo) devolve null — a
// triagem trata fps desconhecido como aviso, não como recusa. Um vídeo mais
// curto que a janela de amostragem termina (evento "ended") antes de gerar
// frame suficiente — sem tratar isso a promise nunca resolveria, porque não
// há mais frame nenhum para disparar o callback.
export function estimarFps(videoEl, janelaMs = 1000) {
  return new Promise((resolve) => {
    if (typeof videoEl.requestVideoFrameCallback !== "function") {
      resolve(null);
      return;
    }
    let contagem = 0;
    let inicioMedia = null;
    let resolvido = false;

    function finalizar(decorrido) {
      if (resolvido) return;
      resolvido = true;
      videoEl.removeEventListener("ended", aoTerminar);
      videoEl.pause();
      resolve(contagem >= 2 && decorrido > 0 ? Math.round(contagem / decorrido) : null);
    }

    function aoTerminar() {
      finalizar(inicioMedia === null ? 0 : videoEl.duration - inicioMedia);
    }

    function onFrame(_now, metadata) {
      if (resolvido) return;
      if (inicioMedia === null) inicioMedia = metadata.mediaTime;
      contagem++;
      const decorrido = metadata.mediaTime - inicioMedia;
      if (decorrido * 1000 < janelaMs) {
        videoEl.requestVideoFrameCallback(onFrame);
        return;
      }
      finalizar(decorrido);
    }

    videoEl.addEventListener("ended", aoTerminar, { once: true });
    videoEl.muted = true;
    videoEl.currentTime = 0;
    videoEl
      .play()
      .then(() => videoEl.requestVideoFrameCallback(onFrame))
      .catch(() => finalizar(0));
  });
}

// Exportada porque a extração de frames (frames-extrator.js, pacote 1.3.3)
// precisa do mesmo mecanismo de busca por tempo.
export function buscarTempo(videoEl, tempoSegundos) {
  return new Promise((resolve) => {
    videoEl.addEventListener("seeked", resolve, { once: true });
    videoEl.currentTime = tempoSegundos;
  });
}

// Luminância média (0–255) de um frame amostrado em miniatura — barato,
// mesmo espírito das miniaturas 64×64 da fase 03 (F03-02). Os pesos
// 0.299/0.587/0.114 em R/G/B (não uma média simples dos três) vêm da
// fórmula padrão de luminância perceptual (ITU-R BT.601): o olho humano
// é muito mais sensível a variação de verde que de azul, então pesar
// igual sub/superestimaria o quão "clara" a cena realmente parece pra
// uma pessoa — e é exatamente disso que a triagem de "vídeo escuro"
// precisa (video-qualidade.js), não de um brilho matematicamente médio.
export function medirLuminanciaMedia(videoEl, canvasEl) {
  const w = 64;
  const h = 64;
  canvasEl.width = w;
  canvasEl.height = h;
  const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(videoEl, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let soma = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    soma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return soma / n;
}

// Orquestra a leitura completa (F02-01): metadados básicos + fps + amostra
// de luminância no meio do vídeo. `videoEl`/`canvasEl` são elementos fora
// da tela reutilizados a cada chamada, injetados por quem chama.
export async function lerVideo(file, { videoEl, canvasEl }) {
  const url = URL.createObjectURL(file);
  try {
    videoEl.src = url;
    await new Promise((resolve, reject) => {
      videoEl.addEventListener("loadedmetadata", resolve, { once: true });
      videoEl.addEventListener(
        "error",
        () => reject(new Error("Não foi possível ler o vídeo. Confira se o arquivo é um MP4 válido.")),
        { once: true }
      );
    });

    const basicos = lerMetadadosBasicos(videoEl);
    const fps = await estimarFps(videoEl);
    await buscarTempo(videoEl, basicos.duracaoSegundos / 2);
    const luminanciaMedia = medirLuminanciaMedia(videoEl, canvasEl);

    return {
      arquivoNome: file.name,
      ...basicos,
      fps,
      luminanciaMedia,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
