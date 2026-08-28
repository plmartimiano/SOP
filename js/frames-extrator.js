// Pacote EAP 1.3.3 — Extração de frames.
// Amostra o vídeo a 2 quadros por segundo (F03-01) e gera, de cada frame,
// uma miniatura 64×64 em tons de cinza (F03-02) — é sobre os valores de
// cinza dela que curva-movimento.js (pacote 1.3.4) calcula a diferença
// quadro a quadro, sem custo nenhum de modelo.
//
// Usa busca por tempo (seek) em vez de tocar o vídeo e capturar em tempo
// real. O risco anotado no cartão F03-01 é que isso é impreciso em alguns
// arquivos ("prefira avançar a reprodução e capturar em intervalos"); se
// isso se confirmar em vídeos reais, é o primeiro ponto a trocar aqui —
// por ora, simples e determinístico.

import { buscarTempo } from "./video-metadados.js";

// Devolve tanto o PNG (pra exibir) quanto o array plano de valores de cinza
// (pra diferença quadro a quadro barata, sem decodificar PNG de volta).
export function capturarMiniaturaCinza(videoEl, canvasEl, lado = 64) {
  canvasEl.width = lado;
  canvasEl.height = lado;
  const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(videoEl, 0, 0, lado, lado);
  const imagem = ctx.getImageData(0, 0, lado, lado);
  const dados = imagem.data;
  const cinzas = new Float64Array(lado * lado);
  for (let i = 0, p = 0; i < dados.length; i += 4, p++) {
    const cinza = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
    dados[i] = cinza;
    dados[i + 1] = cinza;
    dados[i + 2] = cinza;
    cinzas[p] = cinza;
  }
  ctx.putImageData(imagem, 0, 0);
  return { dataUrl: canvasEl.toDataURL("image/png"), cinzas };
}

// videoEl já precisa estar com o vídeo carregado (loadedmetadata disparado).
export async function extrairFrames(videoEl, canvasEl, { fps = 2, onProgresso } = {}) {
  const duracao = videoEl.duration;
  const passo = 1 / fps;
  const totalEsperado = Math.max(1, Math.ceil(duracao / passo));
  const frames = [];

  for (let indice = 0; indice < totalEsperado; indice++) {
    const tempoSegundos = Math.min(indice * passo, duracao);
    await buscarTempo(videoEl, tempoSegundos);
    const { dataUrl, cinzas } = capturarMiniaturaCinza(videoEl, canvasEl);
    frames.push({
      indice,
      tempoSegundos: Number(tempoSegundos.toFixed(3)),
      miniaturaDataUrl: dataUrl,
      cinzas,
    });
    onProgresso?.(frames.length, totalEsperado);
  }

  return frames;
}
