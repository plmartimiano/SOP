// Controle de tela da fase 10 (A ficha de cada passo). Não há escolha nem
// assinatura aqui (tipo "padrao") -- a ficha é derivada automaticamente
// dos passos que a fase 09 consolidou, cruzados com o núcleo (fase 07)
// pra reencontrar mãos, ferramenta, peças e o trecho de vídeo de cada
// ação original. Não depende de nada na sessão do navegador -- só do
// dossiê -- então funciona mesmo depois de recarregar a página.

import { gerarFichas, verificarCamposObrigatorios } from "./fichas.js";

// container: elemento onde a ferramenta é desenhada.
// passos: passos (dossiê, versão atual da seção "passos") ou null.
// nucleo: reconhecimento.nucleo (fase 07) ou null.
// cicloExemplarIndice: reconhecimento.cicloExemplarIndice (fase 07) ou null/undefined.
// onGravar: (dadosFichas) => void -- grava nova versão em "passos".
export function montarFichas(container, { passos, nucleo, cicloExemplarIndice, onGravar }) {
  if (!passos || passos.length === 0) {
    container.innerHTML = `<div class="vaziomsg">Consolide os 6 passos na fase 09 antes de gerar as fichas.</div>`;
    return;
  }
  if (!nucleo || nucleo.length === 0 || cicloExemplarIndice === null || cicloExemplarIndice === undefined) {
    container.innerHTML = `<div class="vaziomsg">Falta o núcleo do procedimento (fase 07) para reencontrar mãos, ferramenta e tempo de cada passo.</div>`;
    return;
  }

  const fichas = gerarFichas(passos, nucleo, cicloExemplarIndice);
  const problemas = fichas.flatMap((f) => verificarCamposObrigatorios(f).map((campo) => `passo ${f.numero}: ${campo}`));

  container.innerHTML = `
    ${
      problemas.length
        ? `<div class="status show erro">Campo obrigatório vazio: ${problemas.join(", ")}.</div>`
        : `<div class="status show ok">${fichas.length} fichas geradas, nenhum campo obrigatório vazio.</div>`
    }
    <p class="grafico-legenda">Mãos, ferramenta, peças e trecho de vídeo vêm da leitura semântica já registrada.
      Critério de conclusão é uma frase derivada da presença de verificação no passo. Risco não tem fonte de
      dado neste pipeline — fica marcado para revisão humana na fase 11.</p>
    <div class="fichas-grid">
      ${fichas.map(cartaoFicha).join("")}
    </div>
    <div class="row" style="margin-top:12px">
      <button class="act" id="fichasGravar">Gravar no dossiê</button>
    </div>`;

  container.querySelector("#fichasGravar").addEventListener("click", () => {
    // Grava sob a mesma chave "passos" que a fase 09 usa -- as fichas são
    // uma versão mais rica dos mesmos 6 passos, não uma seção paralela.
    // Isso mantém `.dados.passos` legível por qualquer leitor futuro
    // (inclusive esta própria tela, se rodar de novo sobre sua própria
    // saída) sem precisar de campoDistintivo — ao contrário de
    // "reconhecimento" (fases 07/08), aqui as duas gravações têm formatos
    // compatíveis (a da fase 10 é um superconjunto da da fase 09).
    onGravar({ passos: fichas });
  });
}

function cartaoFicha(f) {
  return `<div class="ficha-card">
    <h4>Passo ${f.numero} — ${f.titulo}${f.duvidosa ? ` <span class="tag-duvidosa">fusão duvidosa</span>` : ""}</h4>
    <dl class="ficha-campos">
      <dt>Mãos</dt><dd>${f.maos.join(", ")}</dd>
      <dt>Ferramenta</dt><dd>${f.ferramentas.length ? f.ferramentas.join(", ") : "nenhuma"}</dd>
      <dt>Peças</dt><dd>${f.pecas.length ? f.pecas.join(", ") : "nenhuma peça nova neste passo"}</dd>
      <dt>Critério de conclusão</dt><dd>${f.criterioConclusao}</dd>
      <dt>Risco</dt><dd class="ficha-risco">${f.risco}</dd>
      <dt>Estado do produto antes</dt><dd>${f.estadoProdutoAntes.length ? f.estadoProdutoAntes.join(", ") : "nenhuma peça instalada ainda"}</dd>
      <dt>Estado do produto depois</dt><dd>${f.estadoProdutoDepois.join(", ")}</dd>
      <dt>Trecho de vídeo</dt><dd class="mono">${f.trechoVideo ? `${f.trechoVideo.inicioSegundos}s – ${f.trechoVideo.fimSegundos}s` : "—"}</dd>
    </dl>
    ${f.usouCicloAlternativo ? `<p class="grafico-legenda">Uma ou mais ações deste passo não tinham dado no ciclo exemplar — usou outro ciclo disponível.</p>` : ""}
  </div>`;
}
