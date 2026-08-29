// Controle de tela da fase 14 (Verificação cega) — a TERCEIRA chamada
// paga do projeto. Manda as imagens geradas, sozinhas e sem a ficha, de
// volta pro Gemini: uma nota por quadro, um teste de ordem embaralhada
// (o gate central da fase — "a sequência é reconstruível só pelas
// imagens") e uma checagem de continuidade entre pares consecutivos.
//
// Limitação herdada da fase 13: as imagens só existem na sessão do
// navegador (nunca no dossiê — F01-01), então esta fase só funciona na
// MESMA aba/sessão onde a fase 13 gerou as imagens.

import { rodarVerificacaoCega } from "./verificacao-cega.js";

// container: elemento onde a ferramenta é desenhada.
// passos: passos (dossiê, versão atual — pra saber os números 1..6 na ordem certa) ou null.
// imagensGeradas: Map chaveUnicaDoItem -> {imagemBase64, mimeType} (sessao-midia.js) ou null.
// onGravar: (dadosVerificacao) => void — grava nova versão em "imagens".
export function montarVerificacaoCega(container, { passos, imagensGeradas, onGravar }) {
  if (!passos || passos.length === 0) {
    container.innerHTML = `<div class="vaziomsg">Consolide os passos (fase 09/10) antes da verificação cega.</div>`;
    return;
  }
  if (!imagensGeradas) {
    container.innerHTML = `<div class="vaziomsg">As imagens da fase 13 não estão mais nesta sessão (a página foi recarregada, ou as imagens foram geradas em outra aba/sessão). Volte à fase 13 e gere de novo nesta mesma sessão.</div>`;
    return;
  }

  const quadroMestreItem = imagensGeradas.get("quadroMestre") || null;
  const passosComImagemAncora = passos
    .map((p) => {
      const img = imagensGeradas.get(`passo:${p.numero}:1`);
      return img ? { numero: p.numero, titulo: p.titulo, imagemBase64: img.imagemBase64, mimeType: img.mimeType } : null;
    })
    .filter(Boolean);

  if (passosComImagemAncora.length < passos.length) {
    container.innerHTML = `<div class="status show erro">
      ${passos.length - passosComImagemAncora.length} de ${passos.length} passos não têm imagem gerada nesta sessão.
      Volte à fase 13 e gere todas antes de continuar.
    </div>`;
    return;
  }

  const totalChamadas = passosComImagemAncora.length + (quadroMestreItem ? 1 : 0) + 1 + (passosComImagemAncora.length - 1);
  container.innerHTML = `
    <p class="grafico-legenda">
      Esta é a terceira chamada paga do projeto. Vai fazer ${totalChamadas} chamadas: uma nota por quadro
      (${passosComImagemAncora.length} passos${quadroMestreItem ? " + quadro-mestre" : ""}), um teste de ordem
      embaralhada (as imagens não levam número nem legenda — o modelo reconstrói a sequência só pelo que vê), e
      ${passosComImagemAncora.length - 1} checagens de continuidade entre pares consecutivos.
    </p>
    <div class="row">
      <button class="act" id="verificarBotao">Rodar verificação cega (Gemini)</button>
      <span class="mono" id="verificarProgresso"></span>
    </div>
    <div id="verificarResultado"></div>`;

  const botaoEl = container.querySelector("#verificarBotao");
  const progressoEl = container.querySelector("#verificarProgresso");
  const resultadoEl = container.querySelector("#verificarResultado");

  botaoEl.addEventListener("click", async () => {
    botaoEl.disabled = true;
    let feitas = 0;
    const marcarProgresso = () => {
      feitas++;
      progressoEl.textContent = `${feitas} / ${totalChamadas}`;
    };

    const resultado = await rodarVerificacaoCega(
      { quadroMestreImagem: quadroMestreItem, passosComImagemAncora },
      {
        onNota: () => marcarProgresso(),
        onOrdem: () => marcarProgresso(),
        onContinuidade: () => marcarProgresso(),
      }
    );

    botaoEl.disabled = false;
    resultadoEl.innerHTML = montarResultadoHtml(resultado, passosComImagemAncora, quadroMestreItem);

    resultadoEl.querySelector("#verificarGravar").addEventListener("click", () => {
      onGravar({
        notas: resultado.notas,
        ordem: resultado.ordem,
        continuidades: resultado.continuidades,
        gateSequenciaReconstruivel: resultado.ordem ? resultado.ordem.sequenciaReconstruivel : null,
      });
    });
  });
}

function montarResultadoHtml(resultado, passosComImagemAncora, quadroMestreItem) {
  const { notas, ordem, continuidades } = resultado;

  const linhasNota = [
    ...(quadroMestreItem ? [["quadroMestre", "Quadro-mestre"]] : []),
    ...passosComImagemAncora.map((p) => [`passo:${p.numero}`, `Passo ${p.numero} — ${p.titulo}`]),
  ]
    .map(([chave, titulo]) => {
      const n = notas[chave];
      return `<tr><td>${titulo}</td><td class="mono">${n ? `${n.nota}/100` : "erro"}</td><td>${n ? n.descricao : ""}</td></tr>`;
    })
    .join("");

  const ordemHtml = ordem
    ? `<div class="status show ${ordem.sequenciaReconstruivel ? "ok" : "erro"}">
        ${ordem.sequenciaReconstruivel ? "Gate F14 passou: a sequência é reconstruível só pelas imagens." : `Gate F14 falhou: só ${ordem.totalAcertos} de ${ordem.acertosPorPosicao.length} posições bateram com a ordem real.`}
      </div>`
    : `<div class="status show erro">Não foi possível rodar o teste de ordem embaralhada.</div>`;

  const linhasContinuidade = continuidades
    .map((c) =>
      c.erro
        ? `<tr><td>${c.entre[0]} → ${c.entre[1]}</td><td colspan="2" class="mono">erro: ${c.erro}</td></tr>`
        : `<tr><td>${c.entre[0]} → ${c.entre[1]}</td><td>${c.consistente ? "consistente" : "INCONSISTENTE"}</td><td>${c.motivo}</td></tr>`
    )
    .join("");
  const inconsistencias = continuidades.filter((c) => !c.erro && !c.consistente).length;

  return `
    <h4 style="margin:16px 0 6px">Nota por quadro</h4>
    <table class="ciclos-tabela"><thead><tr><th>Quadro</th><th>Nota</th><th>Descrição (o que o modelo viu, sem contexto)</th></tr></thead>
      <tbody>${linhasNota}</tbody></table>

    <h4 style="margin:16px 0 6px">Teste de ordem embaralhada</h4>
    ${ordemHtml}

    <h4 style="margin:16px 0 6px">Continuidade entre pares consecutivos</h4>
    ${inconsistencias > 0 ? `<p class="grafico-legenda">${inconsistencias} par(es) marcado(s) inconsistente pelo modelo — não bloqueia a gravação, mas vale revisar.</p>` : ""}
    <table class="ciclos-tabela"><thead><tr><th>Entre</th><th>Resultado</th><th>Motivo</th></tr></thead>
      <tbody>${linhasContinuidade}</tbody></table>

    <div class="row" style="margin-top:12px">
      <button class="act" id="verificarGravar">Gravar no dossiê</button>
    </div>`;
}
