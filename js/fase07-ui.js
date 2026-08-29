// Controle de tela da fase 07 (Consenso entre ciclos). Só é montada quando
// a fase 07 está selecionada (ver js/app.js). Diferente das fases
// anteriores, não depende de nada na sessão (frames, vídeo) — só do que já
// está gravado no dossiê (ciclos da fase 04, micro-ações da fase 05,
// enriquecidas ou não pela leitura semântica da fase 06). Por isso funciona
// até depois de recarregar a página ou trocar de sessão, desde que o
// dossiê tenha essas duas seções.

import { montarConsenso } from "./consenso-ciclos.js";

function descreverAcao(coluna) {
  const fatia = Object.values(coluna).find(Boolean);
  if (!fatia) return "?";
  const leitura = fatia.leituraSemantica;
  return leitura && !leitura.indeterminado ? `${leitura.verbo} ${leitura.objeto}` : fatia.causa;
}

function paraFormatoDossie(consenso) {
  function converter(entrada) {
    return {
      acao: descreverAcao(entrada.coluna),
      percentual: entrada.frequencia.percentual,
      presentes: entrada.frequencia.presentes,
      porCiclo: entrada.coluna,
    };
  }
  return {
    cicloReferenciaIndice: consenso.cicloReferenciaIndice,
    cicloExemplarIndice: consenso.cicloExemplarIndice,
    ciclosConsiderados: consenso.ciclosConsiderados,
    nucleo: consenso.nucleo.map(converter),
    excecoes: consenso.excecoes.map(converter),
  };
}

function linhaTabela(entrada, listaCiclos) {
  const celulas = listaCiclos
    .map((c) => {
      if (c.suspeito) return `<td class="mono" style="color:var(--ink-soft)">—</td>`;
      const fatia = entrada.coluna[c.indice];
      if (!fatia) return `<td class="mono" style="color:var(--alert)">lacuna</td>`;
      const leitura = fatia.leituraSemantica;
      const rotulo = leitura && !leitura.indeterminado ? `${leitura.verbo} ${leitura.objeto}` : fatia.causa;
      return `<td>${rotulo}</td>`;
    })
    .join("");
  return `<tr><td><b>${descreverAcao(entrada.coluna)}</b></td>${celulas}<td class="mono">${entrada.frequencia.percentual}%</td></tr>`;
}

// container: elemento onde a ferramenta é desenhada.
// ciclosRodouNoDossie / microAcoesRodouNoDossie: bool.
// porCiclo: microAcoes.porCiclo (dossiê, versão atual).
// listaCiclos: ciclos.lista (dossiê, versão atual) — com .suspeito e .duracaoSegundos.
// onGravar: (dadosReconhecimento) => void — grava nova versão em "reconhecimento".
export function montarConsensoUI(container, { ciclosRodouNoDossie, microAcoesRodouNoDossie, porCiclo, listaCiclos, onGravar }) {
  if (!ciclosRodouNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Detecte os ciclos na fase 04 antes do consenso.</div>`;
    return;
  }
  if (!microAcoesRodouNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Fatie em micro-ações na fase 05 antes do consenso.</div>`;
    return;
  }

  const naoSuspeitos = listaCiclos.filter((c) => !c.suspeito);
  container.innerHTML = `
    <div class="row">
      <button class="act" id="consensoBotao">Calcular consenso (${naoSuspeitos.length} de ${listaCiclos.length} ciclos, sem os suspeitos)</button>
    </div>
    <div id="consensoResultado"></div>`;

  container.querySelector("#consensoBotao").addEventListener("click", () => {
    const consenso = montarConsenso(porCiclo, listaCiclos);
    renderResultado(consenso);
  });

  function renderResultado(consenso) {
    const resultadoEl = container.querySelector("#consensoResultado");

    if (consenso.totalCiclosConsiderados === 0) {
      resultadoEl.innerHTML = `<div class="status show erro">Nenhum ciclo não suspeito disponível — sem ciclo, não há consenso possível.</div>`;
      return;
    }

    const avisoPoucosCiclos =
      consenso.totalCiclosConsiderados < 3
        ? `<div class="status show erro">Só ${consenso.totalCiclosConsiderados} ciclo${consenso.totalCiclosConsiderados === 1 ? "" : "s"} não suspeito${consenso.totalCiclosConsiderados === 1 ? "" : "s"} disponível. Consenso com tão poucos ciclos é frágil (risco do plano: "consenso de dois é frágil") — trate este resultado com reserva até regravar com mais repetições.</div>`
        : "";

    const cabecalhoCiclos = listaCiclos.map((c) => `<th>Ciclo ${c.indice}${c.suspeito ? " ⚠" : ""}</th>`).join("");
    const linhasNucleo = consenso.nucleo.map((e) => linhaTabela(e, listaCiclos)).join("");
    const linhasExcecoes = consenso.excecoes.map((e) => linhaTabela(e, listaCiclos)).join("");

    resultadoEl.innerHTML = `
      ${avisoPoucosCiclos}
      <div class="status show ok">Ciclo de referência: ${consenso.cicloReferenciaIndice ?? "—"} · Ciclo exemplar: ${consenso.cicloExemplarIndice ?? "—"} (o mais próximo da mediana de duração entre os aderentes ao núcleo).</div>
      <h4 style="margin:14px 0 8px">Núcleo do procedimento — presente em 80% ou mais dos ciclos considerados</h4>
      <table class="ciclos-tabela"><thead><tr><th>Ação</th>${cabecalhoCiclos}<th>%</th></tr></thead>
        <tbody>${linhasNucleo || `<tr><td colspan="${listaCiclos.length + 2}">nenhuma ação chegou a 80%</td></tr>`}</tbody></table>
      <h4 style="margin:14px 0 8px">Exceções — abaixo de 80%, decisão humana</h4>
      <table class="ciclos-tabela"><thead><tr><th>Ação</th>${cabecalhoCiclos}<th>%</th></tr></thead>
        <tbody>${linhasExcecoes || `<tr><td colspan="${listaCiclos.length + 2}">nenhuma exceção</td></tr>`}</tbody></table>
      <div class="row" style="margin-top:12px"><button class="act" id="consensoGravar">Gravar no dossiê</button></div>`;

    resultadoEl.querySelector("#consensoGravar").addEventListener("click", () => {
      onGravar(paraFormatoDossie(consenso));
    });
  }
}
