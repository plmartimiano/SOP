// Controle de tela da fase 05 (Micro-ações). Só é montado quando a fase 05
// está selecionada (ver js/app.js). Depende dos frames extraídos ainda
// estarem na memória da sessão (mesma situação das fases 03/04) e de já
// existirem ciclos detectados na fase 04.

import { montarCurva, montarCurvaPorZona } from "./curva-movimento.js";
import { fatiarCiclos } from "./micro-acoes.js";

const ROTULO_CAUSA = {
  componente_novo: "componente novo",
  troca_ferramenta: "troca de ferramenta",
  combinada: "combinada",
  pausa_conferencia: "pausa",
};

// container: elemento onde a ferramenta é desenhada.
// ciclosRodouNoDossie: bool — a fase 04 já gravou a seção "ciclos"?
// frames: os frames extraídos (com .cinzas), vindos de obterFramesExtraidos(), ou null.
// ciclos: a lista de ciclos gravada no dossiê (dossie.secoes.ciclos, versão atual).
// zonas: zonas do mapa da bancada, [] se a fase 00 não rodou.
// onGravar: (dadosMicroAcoes) => void — grava a versão em "microAcoes" e re-renderiza.
export function montarFatiamento(container, { ciclosRodouNoDossie, frames, ciclos, zonas = [], onGravar }) {
  if (!ciclosRodouNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Detecte os ciclos na fase 04 antes de fatiar em micro-ações.</div>`;
    return;
  }
  if (!frames) {
    container.innerHTML = `<div class="vaziomsg">Os frames não estão mais disponíveis nesta sessão (a página foi recarregada, ou outro dossiê foi carregado depois). Volte à fase 03 e extraia de novo.</div>`;
    return;
  }
  if (!ciclos || ciclos.length === 0) {
    container.innerHTML = `<div class="vaziomsg">Nenhum ciclo foi detectado na fase 04 — sem ciclo, não há o que fatiar.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="row">
      <button class="act" id="fatiarBotao">Fatiar em micro-ações</button>
    </div>
    <div id="fatiarResultado"></div>`;

  const botaoEl = container.querySelector("#fatiarBotao");
  const resultadoEl = container.querySelector("#fatiarResultado");

  botaoEl.addEventListener("click", () => {
    const curvaGeral = montarCurva(frames);
    const curvaPorZona = zonas.length ? montarCurvaPorZona(frames, zonas) : {};
    const porCiclo = fatiarCiclos(frames, curvaGeral, ciclos, { curvaPorZona, zonas });
    renderResultado(porCiclo);
  });

  function renderResultado(porCiclo) {
    const semZonaAviso = zonas.length === 0
      ? `<p class="grafico-legenda">Sem mapa de zonas — toda fronteira sem sinal de zona cai em "pausa". Mapeie zonas na fase 00 pra classificações mais específicas.</p>`
      : "";

    const blocos = porCiclo
      .map((c) => {
        const total = c.fatias.length;
        const foraDaFaixa = total < 6 || total > 15;
        const linhas = c.fatias
          .map((f) => {
            const frameChave = frames[f.frameChave.indice];
            return `<div class="fatia-item">
              <img src="${frameChave.miniaturaDataUrl}" width="48" height="48" title="frame-chave em ${f.frameChave.tempoSegundos}s">
              <div class="fatia-info">
                <span class="mono">#${f.indice}</span> ${f.inicioSegundos.toFixed(1)}s–${f.fimSegundos.toFixed(1)}s ·
                <span class="fatia-causa">${ROTULO_CAUSA[f.causa] || f.causa}</span>
              </div>
            </div>`;
          })
          .join("");

        return `<div class="ciclo-bloco">
          <h4>Ciclo ${c.cicloIndice} — ${total} fatia${total === 1 ? "" : "s"}${
          foraDaFaixa ? ' <span class="fatia-aviso">fora da faixa de 6–15 esperada em vídeo real (normal em vídeo curto de teste)</span>' : ""
        }</h4>
          <div class="fatia-lista">${linhas}</div>
        </div>`;
      })
      .join("");

    resultadoEl.innerHTML = `
      <div class="status show ok">${porCiclo.length} ciclo${porCiclo.length === 1 ? "" : "s"} fatiado${porCiclo.length === 1 ? "" : "s"} em micro-ações.</div>
      ${semZonaAviso}
      ${blocos}
      <div class="row" style="margin-top:12px">
        <button class="act" id="fatiarGravar">Gravar no dossiê</button>
      </div>`;

    resultadoEl.querySelector("#fatiarGravar").addEventListener("click", () => {
      onGravar({ porCiclo });
    });
  }
}
