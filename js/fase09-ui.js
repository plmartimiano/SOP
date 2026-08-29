// Controle de tela da fase 09 (Consolidação nos 6 passos). Diferente da
// fase 08, aqui não há escolha nem assinatura para colher: a regra já foi
// homologada, então esta tela só aplica ela de novo, sempre do mesmo
// jeito, sobre o núcleo atual do dossiê, e deixa gravar. Não depende de
// nada na sessão do navegador — só do dossiê — então funciona mesmo
// depois de recarregar a página.

import { aplicarRegraHomologada } from "./consolidacao.js";

// container: elemento onde a ferramenta é desenhada.
// nucleo: reconhecimento.nucleo (dossiê, versão da fase 07) ou null.
// regraHomologada: reconhecimento.regraHomologada (dossiê, versão da fase 08) ou null.
// onGravar: (dadosConsolidacao) => void — grava nova versão em "passos".
export function montarConsolidacao(container, { nucleo, regraHomologada, onGravar }) {
  if (!regraHomologada) {
    container.innerHTML = `<div class="vaziomsg">Homologue uma regra de agrupamento na fase 08 antes de consolidar.</div>`;
    return;
  }
  if (!nucleo || nucleo.length === 0) {
    container.innerHTML = `<div class="vaziomsg">O núcleo do procedimento (fase 07) está vazio — não há o que consolidar.</div>`;
    return;
  }

  const resultado = aplicarRegraHomologada(nucleo, regraHomologada);
  if (resultado.erro) {
    container.innerHTML = `<div class="status show erro">${resultado.erro}</div>`;
    return;
  }

  const { passos, completo, criterioAplicado, verificacoesNoNucleo, verificacoesNosPassos } = resultado;
  const verificacoesBatem = verificacoesNoNucleo === verificacoesNosPassos;

  container.innerHTML = `
    <div class="status show ${completo ? "ok" : "erro"}">
      ${completo ? `Consolidado em ${passos.length} passos` : `Resultou em ${passos.length} passos, não 6`}
      pela regra homologada ("${criterioAplicado.nome}").
    </div>
    <p class="grafico-legenda">
      Verificações no núcleo: ${verificacoesNoNucleo} · verificações nos passos finais: ${verificacoesNosPassos}
      — ${verificacoesBatem ? "nenhuma sumiu." : "ATENÇÃO: alguma verificação sumiu na consolidação."}
    </p>
    <p class="grafico-legenda">
      "4 dos 6 passos coincidem com o SOP feito à mão" não é verificado automaticamente aqui — exigiria comparar
      contra o documento manual da estação, que não está digitalizado no programa.
    </p>
    <ol class="alternativa-passos" id="passosConsolidados">
      ${passos.map((p) => `<li class="${p.duvidosa ? "passo-duvidoso" : ""}">${p.titulo}
        <span class="mono" style="color:var(--ink-soft);font-size:11px">(${p.duracaoMediaSegundos}s)</span>
        ${p.duvidosa ? `<span class="tag-duvidosa">fusão duvidosa</span>` : ""}</li>`).join("")}
    </ol>
    <div class="row" style="margin-top:12px">
      <button class="act" id="consolidacaoGravar">Gravar no dossiê</button>
    </div>`;

  container.querySelector("#consolidacaoGravar").addEventListener("click", () => {
    onGravar({ passos, completo, criterioAplicado, verificacoesNoNucleo, verificacoesNosPassos });
  });
}
