// Controle de tela da fase 08 (Reconhecimento da estação — a fase-chave do
// plano). Só é montada quando a fase 08 está selecionada (ver js/app.js).
// Não depende de nada na sessão do navegador — só do dossiê (núcleo da
// fase 07 + micro-ações da fase 05) — então funciona mesmo depois de
// recarregar a página.
//
// F08-09 (a regra virar padrão automático das próximas estações) e F08-10
// (detectar quando a regra não serve numa estação específica) NÃO estão
// implementados — os dois dependem de infraestrutura que ainda não existe
// (biblioteca de estações reusável entre vídeos, pacote 1.8.4, e o motor
// de consolidação de verdade da fase 09). Aqui a homologação vale só para
// o dossiê atual.

import {
  inventariarComponentes,
  inventariarFerramentas,
  contarFronteirasEstaveis,
  detectarPausasDeConferencia,
  gerarRelatorio,
  proporAlternativas,
} from "./agrupamento.js";

// container: elemento onde a ferramenta é desenhada.
// reconhecimentoRodouNoDossie: bool — a fase 07 já gravou "reconhecimento"?
// porCiclo: microAcoes.porCiclo (dossiê, versão atual) — para os inventários.
// nucleo: reconhecimento.nucleo (dossiê, versão atual) — para as alternativas.
// listaCiclos: ciclos.lista (dossiê, versão atual) — para a duração média do ciclo.
// onGravar: (dadosReconhecimento) => void — grava nova versão em "reconhecimento".
export function montarReconhecimento(container, { reconhecimentoRodouNoDossie, porCiclo, nucleo, listaCiclos, onGravar }) {
  if (!reconhecimentoRodouNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Calcule o consenso na fase 07 antes do reconhecimento.</div>`;
    return;
  }
  if (!nucleo || nucleo.length === 0) {
    container.innerHTML = `<div class="vaziomsg">O núcleo do procedimento (fase 07) está vazio — nenhuma ação chegou a 80% de presença. Não há o que reconhecer.</div>`;
    return;
  }

  const componentes = inventariarComponentes(porCiclo);
  const ferramentas = inventariarFerramentas(porCiclo);
  const fronteiras = contarFronteirasEstaveis(nucleo);
  const pausas = detectarPausasDeConferencia(nucleo);
  const duracaoCicloSegundos = listaCiclos.length ? listaCiclos.reduce((s, c) => s + c.duracaoSegundos, 0) / listaCiclos.length : 0;
  const relatorio = gerarRelatorio({ componentes, ferramentas, fronteiras, pausasConferencia: pausas, duracaoCicloSegundos });
  const alternativas = proporAlternativas(nucleo);

  container.innerHTML = `
    <div class="status show ok">${relatorio}</div>
    <div class="alternativas-grid" id="alternativasGrid">
      ${alternativas.map((alt) => cartaoAlternativa(alt)).join("")}
    </div>
    <div id="homologacaoArea"></div>`;

  const radios = container.querySelectorAll('input[name="alternativaEscolhida"]');
  radios.forEach((radio) => {
    radio.addEventListener("change", () => montarHomologacao(radio.value));
  });

  function montarHomologacao(chaveEscolhida) {
    const alt = alternativas.find((a) => a.chave === chaveEscolhida);
    const areaEl = container.querySelector("#homologacaoArea");
    areaEl.innerHTML = `
      <div class="mapa-form" style="margin-top:14px">
        <h4 style="margin:0 0 8px">Homologar "${alt.nome}"</h4>
        ${!alt.completo ? `<p class="grafico-legenda">Esta alternativa resultou em ${alt.totalPassos} passos, não 6 — considere se o padrão de 6 está sendo cumprido só formalmente, ou regrave com mais repetições antes de homologar.</p>` : ""}
        <div class="row">
          <input type="text" id="homologNome" placeholder="Nome de quem homologa" style="flex:1 1 200px">
          <input type="text" id="homologCargo" placeholder="Cargo" style="flex:1 1 160px">
        </div>
        <div class="row" style="margin-top:8px">
          <input type="text" id="homologJustificativa" placeholder="Justificativa (opcional)" style="flex:1 1 100%">
        </div>
        <div class="row" style="margin-top:8px">
          <button class="act" id="homologAssinar">Assinar e gravar no dossiê</button>
        </div>
        <div id="homologErro"></div>
      </div>`;

    areaEl.querySelector("#homologAssinar").addEventListener("click", () => {
      const nome = areaEl.querySelector("#homologNome").value.trim();
      const cargo = areaEl.querySelector("#homologCargo").value.trim();
      const justificativa = areaEl.querySelector("#homologJustificativa").value.trim();
      if (!nome || !cargo) {
        areaEl.querySelector("#homologErro").innerHTML = `<div class="status show erro">Nome e cargo são obrigatórios — SOP é documento de segurança, ninguém homologa sem se identificar.</div>`;
        return;
      }
      onGravar({
        relatorio,
        componentes,
        ferramentas,
        acoesEstaveis: fronteiras.total,
        verificacoes: pausas.length,
        cicloDuracaoSegundos: Number(duracaoCicloSegundos.toFixed(2)),
        alternativasApresentadas: alternativas.map((a) => ({ chave: a.chave, nome: a.nome, totalPassos: a.totalPassos, completo: a.completo })),
        regraHomologada: {
          criterioEscolhido: alt.chave,
          nomeCriterio: alt.nome,
          responsavel: nome,
          cargo,
          justificativa,
          dataHora: new Date().toISOString(),
          passos: alt.passos,
        },
      });
    });
  }
}

function cartaoAlternativa(alt) {
  return `<div class="alternativa-card">
    <label class="alternativa-cabecalho">
      <input type="radio" name="alternativaEscolhida" value="${alt.chave}">
      <span><b>${alt.nome}</b><br><span style="font-size:12.5px;color:var(--ink-soft)">${alt.descricao}</span></span>
    </label>
    <ol class="alternativa-passos">
      ${alt.passos.map((p) => `<li>${p.titulo} <span class="mono" style="color:var(--ink-soft);font-size:11px">(${p.duracaoMediaSegundos}s)</span></li>`).join("")}
    </ol>
    ${!alt.completo ? `<div class="status show erro" style="margin-top:8px">Resultou em ${alt.totalPassos} passos, não 6.</div>` : ""}
    ${alt.custos.length ? `<div class="grafico-legenda"><b>O que esta alternativa esconde:</b><ul style="margin:4px 0 0 18px">${alt.custos.map((c) => `<li>${c.motivo}</li>`).join("")}</ul></div>` : ""}
  </div>`;
}
