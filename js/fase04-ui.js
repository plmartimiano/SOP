// Controle de tela da fase 04 (Ciclos e repetições). Só é montado quando a
// fase 04 está selecionada (ver js/app.js). Depende dos frames extraídos
// ainda estarem na memória da sessão (sessao-midia.js) — mesma situação do
// vídeo na fase 03: se a página foi recarregada, ou outro dossiê foi
// carregado, os frames com os pixels de verdade se perderam, e a tela
// pede para reprocessar em vez de fingir que ainda tem o dado.

import { montarCurva } from "./curva-movimento.js";
import { detectarCiclos } from "./deteccao-ciclos.js";

const FPS_EXTRACAO = 2; // mesma taxa usada em frames-extrator.js na fase 03

// container: elemento onde a ferramenta é desenhada.
// framesRodouNoDossie: bool — a fase 03 já gravou a seção "frames"?
// frames: os frames extraídos (com .cinzas) vindos de obterFramesExtraidos(), ou null.
// onGravar: (dadosCiclos) => void — grava a versão em "ciclos" e re-renderiza.
export function montarDeteccaoCiclos(container, { framesRodouNoDossie, frames, onGravar }) {
  if (!framesRodouNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Extraia os frames na fase 03 antes de detectar ciclos.</div>`;
    return;
  }
  if (!frames) {
    container.innerHTML = `<div class="vaziomsg">Os frames não estão mais disponíveis nesta sessão (a página foi recarregada, ou outro dossiê foi carregado depois). Volte à fase 03 e extraia de novo.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="row">
      <button class="act" id="ciclosBotao">Detectar ciclos</button>
    </div>
    <div id="ciclosResultado"></div>`;

  const botaoEl = container.querySelector("#ciclosBotao");
  const resultadoEl = container.querySelector("#ciclosResultado");

  botaoEl.addEventListener("click", () => {
    const curva = montarCurva(frames);
    const resultado = detectarCiclos(frames, curva, FPS_EXTRACAO);
    renderResultado(resultado);
  });

  function renderResultado(resultado) {
    const { ciclos, estimativa, matriz } = resultado;

    // A matriz é desenhada mesmo quando não há período detectado — de
    // propósito, não por sobra de código: ela é diagnóstico útil por si
    // só. Uma matriz sem diagonais paralelas visíveis prova pra quem está
    // olhando que o algoritmo não "errou" a detecção, é o vídeo mesmo que
    // não tem repetição — diferença importante pra quem for decidir se
    // regrava o vídeo ou se investiga o código.
    if (!estimativa) {
      resultadoEl.innerHTML = `
        <div class="status show erro">Nenhum padrão repetitivo detectado neste vídeo. Sem repetição, não há como validar o que é procedimento — grave o vídeo de novo com pelo menos 3 a 5 repetições completas do ciclo.</div>
        <div class="grafico-bloco">
          <h4>Matriz de auto-similaridade (diagnóstico)</h4>
          <canvas id="matrizCanvas" width="300" height="300"></canvas>
          <p class="grafico-legenda">Sem diagonais paralelas visíveis aqui, não há repetição para detectar — o problema não é do algoritmo.</p>
        </div>`;
      desenharMatriz(resultadoEl.querySelector("#matrizCanvas"), matriz);
      return;
    }

    const linhasCiclos = ciclos
      .map(
        (c) => `<tr class="${c.suspeito ? "ciclo-suspeito" : ""}">
          <td>${c.indice}</td>
          <td>${c.inicioSegundos.toFixed(1)}s</td>
          <td>${c.fimSegundos.toFixed(1)}s</td>
          <td>${c.duracaoSegundos.toFixed(1)}s</td>
          <td>${c.suspeito ? `⚠ ${c.motivoSuspeita}` : "—"}</td>
        </tr>`
      )
      .join("");

    resultadoEl.innerHTML = `
      <div class="status show ok">Duração de ciclo estimada: ${estimativa.duracaoSegundos.toFixed(1)}s (confiança ${(estimativa.confianca * 100).toFixed(0)}%). ${ciclos.length} ciclo${ciclos.length === 1 ? "" : "s"} detectado${ciclos.length === 1 ? "" : "s"}.</div>
      <div class="grafico-bloco">
        <h4>Matriz de auto-similaridade</h4>
        <canvas id="matrizCanvas" width="300" height="300"></canvas>
        <p class="grafico-legenda">Diagonais paralelas à diagonal principal são as repetições do ciclo.</p>
      </div>
      <table class="ciclos-tabela">
        <thead><tr><th>#</th><th>Início</th><th>Fim</th><th>Duração</th><th>Observação</th></tr></thead>
        <tbody>${linhasCiclos}</tbody>
      </table>
      <p class="mapa-instrucao">Ciclos suspeitos (primeiro e último) ficam marcados, não descartados — a decisão de usá-los ou não no consenso é da fase 07.</p>
      <div class="row" style="margin-top:12px">
        <button class="act" id="ciclosGravar">Gravar no dossiê</button>
      </div>`;

    desenharMatriz(resultadoEl.querySelector("#matrizCanvas"), matriz);

    resultadoEl.querySelector("#ciclosGravar").addEventListener("click", () => {
      onGravar({
        total: ciclos.length,
        duracaoEstimadaSegundos: estimativa.duracaoSegundos,
        lista: ciclos,
      });
    });
  }
}

function desenharMatriz(canvasEl, matriz) {
  const ctx = canvasEl.getContext("2d");
  const n = matriz.length;
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  if (n === 0) return;

  let maxValor = 0;
  for (const linha of matriz) for (const v of linha) if (v > maxValor) maxValor = v;
  if (maxValor === 0) maxValor = 1;

  const lado = w / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const intensidade = 255 - Math.round((matriz[i][j] / maxValor) * 255); // 0=diferente(escuro), 255=igual(claro)
      ctx.fillStyle = `rgb(${intensidade},${intensidade},${Math.min(255, intensidade + 30)})`;
      ctx.fillRect(j * lado, i * (h / n), Math.ceil(lado), Math.ceil(h / n));
    }
  }
}
