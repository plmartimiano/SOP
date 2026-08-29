// Controle de tela da fase 12 (Prompts de ilustração). Tipo "padrao" —
// sem escolha nem assinatura: monta os seis prompts (um por passo
// aprovado na fase 11) mais o quadro-mestre da bancada vazia, todos a
// partir da MESMA camada de texto compartilhada (estação + estilo visual
// + instrução contra texto embutido — ver js/prompts.js e
// js/biblia-visual.js), e roda os dois gates da fase antes de deixar
// gravar: nenhum prompt pede texto dentro da imagem, e cada prompt cobre
// os dados reais da ficha (mãos, ferramenta, peças).

import { gerarPrompts, verificarSemPedidoDeTexto, verificarCobertura } from "./prompts.js";

// container: elemento onde a ferramenta é desenhada.
// fichasAprovadas: aprovacoes.fichas (dossiê, versão atual) — cada uma com
//   .final já pronto (pós-correção da fase 11) — ou null.
// nomeEstacao: dossie.estacao.nome.
// zonas: mapaDeZonas.zonas (fase 00) ou [].
// onGravar: (dadosPrompts) => void — grava nova versão em "prompts".
export function montarPrompts(container, { fichasAprovadas, nomeEstacao, zonas, onGravar }) {
  if (!fichasAprovadas || fichasAprovadas.length === 0) {
    container.innerHTML = `<div class="vaziomsg">Aprove as fichas na fase 11 antes de montar os prompts.</div>`;
    return;
  }

  const fichasFinais = fichasAprovadas.map((f) => f.final);
  const resultado = gerarPrompts(fichasFinais, nomeEstacao, zonas);

  const problemasQuadroMestre = verificarSemPedidoDeTexto(resultado.quadroMestre);
  const problemasPorPasso = resultado.passos.map((p) => {
    const ficha = fichasFinais.find((f) => f.numero === p.numero);
    return {
      numero: p.numero,
      pedidoDeTexto: verificarSemPedidoDeTexto(p.prompt),
      coberturaFaltando: verificarCobertura(ficha, p.prompt),
    };
  });
  const totalProblemas =
    problemasQuadroMestre.length + problemasPorPasso.reduce((s, p) => s + p.pedidoDeTexto.length + p.coberturaFaltando.length, 0);

  container.innerHTML = `
    ${
      totalProblemas === 0
        ? `<div class="status show ok">${resultado.passos.length + 1} prompts gerados (6 passos + quadro-mestre), nenhum pede texto dentro da imagem, nenhum dado da ficha ficou de fora.</div>`
        : `<div class="status show erro">${totalProblemas} problema${totalProblemas === 1 ? "" : "s"} encontrado${totalProblemas === 1 ? "" : "s"} nos gates da fase — ver abaixo.</div>`
    }
    <p class="grafico-legenda">A parte em cinza de cada prompt é a camada compartilhada — o mesmo texto, idêntico,
      em todos os sete prompts (é o que garante a bancada reconhecível nos seis quadros). A parte em preto é a
      cena específica daquele passo.</p>
    <div class="fichas-grid">
      ${cartaoPrompt("Quadro-mestre (bancada vazia)", resultado.quadroMestre, resultado.camadaCompartilhada, problemasQuadroMestre, [])}
      ${resultado.passos
        .map((p, i) =>
          cartaoPrompt(
            `Passo ${p.numero} — ${p.titulo}`,
            p.prompt,
            resultado.camadaCompartilhada,
            problemasPorPasso[i].pedidoDeTexto,
            problemasPorPasso[i].coberturaFaltando
          )
        )
        .join("")}
    </div>
    <div class="row" style="margin-top:12px">
      <button class="act" id="promptsGravar">Gravar no dossiê</button>
    </div>`;

  container.querySelector("#promptsGravar").addEventListener("click", () => {
    onGravar({
      camadaCompartilhada: resultado.camadaCompartilhada,
      quadroMestre: resultado.quadroMestre,
      passos: resultado.passos,
      gatesOk: totalProblemas === 0,
    });
  });
}

function cartaoPrompt(titulo, promptCompleto, camadaCompartilhada, pedidoDeTexto, coberturaFaltando) {
  const parteCompartilhada = promptCompleto.slice(0, camadaCompartilhada.length);
  const parteEspecifica = promptCompleto.slice(camadaCompartilhada.length);
  const problemas = [...pedidoDeTexto.map((t) => `pede texto: "${t}"`), ...coberturaFaltando.map((c) => `falta no texto: ${c}`)];

  return `<div class="ficha-card">
    <h4>${titulo}</h4>
    <p class="prompt-texto"><span class="prompt-compartilhado">${parteCompartilhada}</span><span class="prompt-especifico">${parteEspecifica}</span></p>
    ${problemas.length ? `<div class="status show erro" style="margin-top:8px">${problemas.join("; ")}.</div>` : ""}
  </div>`;
}
