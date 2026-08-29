// Controle de tela da fase 11 (Mesa de validação humana — "a barreira
// que não se automatiza"). Mostra cada ficha ao lado do trecho de vídeo
// que a gerou (quando o vídeo original ainda está na sessão do
// navegador — ver sessao-midia.js; se a página foi recarregada ou o
// dossiê veio de importação, mostra só os tempos do trecho, sem fingir
// que o vídeo está ali), deixa corrigir os campos com fonte de dado real
// (mãos, ferramenta, peças, critério de conclusão e — o mais importante —
// risco, que a fase 10 nunca avalia de verdade), preserva o valor
// original de qualquer campo corrigido, e só grava depois de uma
// assinatura (nome + cargo).
//
// Esta é a barreira fixada desde o início do projeto: nenhuma imagem é
// gerada antes do aceite humano das fichas dos 6 passos. Nenhuma fase de
// geração de imagem existe ainda neste programa — hoje o bloqueio é a
// própria ausência dessas fases, não uma checagem de código. Quando as
// fases 12/13 forem construídas, é ali que elas devem verificar se existe
// uma aprovação gravada em "aprovacoes" antes de rodar.

import { calcularCorrecoes, validarAssinatura, montarAprovacao } from "./validacao.js";
import { verificarCamposObrigatorios } from "./fichas.js";

// container: elemento onde a ferramenta é desenhada.
// fichas: passos (dossiê, versão atual, já no formato da fase 10) ou null.
// video: { file, dados } | null — sessao-midia.obterVideoAprovado().
// onGravar: (dadosAprovacao) => void — grava nova versão em "aprovacoes".
export function montarValidacao(container, { fichas, video, onGravar }) {
  if (!fichas || fichas.length === 0) {
    container.innerHTML = `<div class="vaziomsg">Gere as fichas na fase 10 antes da validação.</div>`;
    return;
  }
  if (!("risco" in fichas[0])) {
    container.innerHTML = `<div class="vaziomsg">A seção "passos" ainda está na versão da fase 09, sem os campos da ficha (mãos, ferramenta, risco...). Rode a fase 10 primeiro.</div>`;
    return;
  }

  // Uma única URL de blob para o vídeo inteiro, reusada pelos 6 <video>
  // (não uma por cartão) — criar seis URLs pro mesmo File é desperdício
  // sem motivo, e nenhuma delas jamais era revogada. Ainda fica viva
  // enquanto a tela existir (os elementos <video> continuam
  // referenciando-a), o que é o comportamento correto aqui.
  const videoUrl = video ? URL.createObjectURL(video.file) : null;

  container.innerHTML = `
    <p class="grafico-legenda">Corrija o que precisar — o valor original da fase 10 fica preservado ao lado
      de qualquer correção. O campo <b>risco</b> nunca foi avaliado automaticamente: é o mais importante de
      revisar aqui antes de assinar.</p>
    <div class="fichas-grid" id="fichasValidacao">
      ${fichas.map((f) => cartaoValidacao(f, videoUrl)).join("")}
    </div>
    <div class="mapa-form" style="margin-top:14px">
      <h4 style="margin:0 0 8px">Assinar aprovação</h4>
      <div class="row">
        <input type="text" id="validacaoNome" placeholder="Nome de quem valida" style="flex:1 1 200px">
        <input type="text" id="validacaoCargo" placeholder="Cargo" style="flex:1 1 160px">
      </div>
      <div class="row" style="margin-top:8px">
        <button class="act" id="validacaoAssinar">Assinar e gravar no dossiê</button>
      </div>
      <div id="validacaoErro"></div>
    </div>`;

  if (video) {
    for (const f of fichas) {
      if (!f.trechoVideo) continue;
      const el = container.querySelector(`#video-passo-${f.numero}`);
      if (!el) continue;
      const { inicioSegundos, fimSegundos } = f.trechoVideo;
      el.addEventListener("loadedmetadata", () => {
        el.currentTime = inicioSegundos;
      });
      el.addEventListener("timeupdate", () => {
        if (el.currentTime >= fimSegundos) {
          el.pause();
          el.currentTime = fimSegundos;
        }
      });
    }
  }

  container.querySelector("#validacaoAssinar").addEventListener("click", () => {
    const nome = container.querySelector("#validacaoNome").value.trim();
    const cargo = container.querySelector("#validacaoCargo").value.trim();
    const erros = validarAssinatura({ nome, cargo });
    if (erros.length) {
      container.querySelector("#validacaoErro").innerHTML = `<div class="status show erro">${erros.join(" ")}</div>`;
      return;
    }

    const correcoesPorNumero = {};
    const valoresFinaisPorNumero = {};
    for (const f of fichas) {
      const valoresFinais = lerValoresEditados(container, f.numero);
      valoresFinaisPorNumero[f.numero] = valoresFinais;
      const correcoes = calcularCorrecoes(f, valoresFinais);
      if (Object.keys(correcoes).length) correcoesPorNumero[f.numero] = correcoes;
    }

    // BUG CORRIGIDO: a pessoa podia apagar criterioConclusao ou risco no
    // formulário e ainda assinar — só nome/cargo eram checados antes.
    // Um campo obrigatório vazio aqui se propagaria calado pro prompt de
    // ilustração (fase 12) e pro PDF final (fase 15, "Conclusão: " /
    // "Risco: " em branco). Revalida o valor FINAL (pós-edição) de cada
    // ficha com o mesmo gate que a fase 10 usa — mesmo princípio de
    // "nenhum campo obrigatório vazio" aplicado de novo, depois que a
    // pessoa teve a chance de esvaziar algo sem querer.
    const camposFaltandoPorFicha = fichas
      .map((f) => ({ numero: f.numero, faltando: verificarCamposObrigatorios({ ...f, ...valoresFinaisPorNumero[f.numero] }) }))
      .filter((r) => r.faltando.length > 0);
    if (camposFaltandoPorFicha.length) {
      const detalhe = camposFaltandoPorFicha.map((r) => `passo ${r.numero}: ${r.faltando.join(", ")}`).join("; ");
      container.querySelector("#validacaoErro").innerHTML = `<div class="status show erro">Campo obrigatório vazio depois da edição — ${detalhe}. Preencha antes de assinar.</div>`;
      return;
    }

    const dadosAprovacao = montarAprovacao(fichas, correcoesPorNumero, { nome, cargo });
    onGravar(dadosAprovacao);
  });
}

function listaDeInput(valor) {
  return valor
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function lerValoresEditados(container, numero) {
  const valor = (campo) => container.querySelector(`#campo-${campo}-${numero}`).value;
  return {
    maos: listaDeInput(valor("maos")),
    ferramentas: listaDeInput(valor("ferramentas")),
    pecas: listaDeInput(valor("pecas")),
    criterioConclusao: valor("criterioConclusao"),
    risco: valor("risco"),
  };
}

function cartaoValidacao(f, videoUrl) {
  const trecho = f.trechoVideo;
  const videoHtml =
    videoUrl && trecho
      ? `<video id="video-passo-${f.numero}" src="${videoUrl}" controls style="width:100%;max-height:160px;background:#000;display:block;margin-bottom:8px"></video>`
      : `<p class="grafico-legenda">${
          trecho
            ? `Vídeo não disponível nesta sessão — mostrando só o trecho: ${trecho.inicioSegundos}s – ${trecho.fimSegundos}s.`
            : "Sem trecho de vídeo registrado para este passo."
        }</p>`;

  return `<div class="ficha-card">
    <h4>Passo ${f.numero} — ${f.titulo}${f.duvidosa ? ` <span class="tag-duvidosa">fusão duvidosa</span>` : ""}</h4>
    ${videoHtml}
    <dl class="ficha-campos">
      <dt>Mãos</dt><dd><input type="text" id="campo-maos-${f.numero}" value="${f.maos.join(", ")}"></dd>
      <dt>Ferramenta</dt><dd><input type="text" id="campo-ferramentas-${f.numero}" value="${f.ferramentas.join(", ")}"></dd>
      <dt>Peças</dt><dd><input type="text" id="campo-pecas-${f.numero}" value="${f.pecas.join(", ")}"></dd>
      <dt>Critério de conclusão</dt><dd><textarea id="campo-criterioConclusao-${f.numero}" rows="2">${f.criterioConclusao}</textarea></dd>
      <dt>Risco</dt><dd><textarea id="campo-risco-${f.numero}" rows="2" class="ficha-risco-input">${f.risco}</textarea></dd>
      <dt>Estado do produto antes</dt><dd>${f.estadoProdutoAntes.length ? f.estadoProdutoAntes.join(", ") : "nenhuma peça instalada ainda"}</dd>
      <dt>Estado do produto depois</dt><dd>${f.estadoProdutoDepois.join(", ")}</dd>
    </dl>
  </div>`;
}
