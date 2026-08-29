// Controle de tela da fase 06 (Leitura semântica) — a primeira fase que
// chama um modelo pago (Gemini, via api/leitura-semantica.js — nunca
// direto do navegador). Só é montada quando a fase 06 está selecionada
// (ver js/app.js). Depende dos frames extraídos ainda estarem na sessão
// (mesma situação das fases 03-05) e de já existir fatiamento da fase 05.

import { VERBOS_PADRAO } from "./vocabulario-verbos.js";
import { lerFatiasEmLotes } from "./leitura-semantica.js";

// container: elemento onde a ferramenta é desenhada.
// microAcoesRodouNoDossie: bool — a fase 05 já gravou a seção "microAcoes"?
// frames: os frames extraídos (com .cinzas/.miniaturaDataUrl), ou null.
// porCiclo: [{cicloIndice, fatias}] vindo do dossiê (fase 05).
// zonas: zonas do mapa da bancada — hoje é a fonte do glossário (ver README).
// onGravar: (dadosMicroAcoes) => void — grava nova versão em "microAcoes".
export function montarLeituraSemantica(container, { microAcoesRodouNoDossie, frames, porCiclo, zonas = [], onGravar }) {
  if (!microAcoesRodouNoDossie) {
    container.innerHTML = `<div class="vaziomsg">Fatie em micro-ações na fase 05 antes de ler os frames-chave.</div>`;
    return;
  }
  if (!frames) {
    container.innerHTML = `<div class="vaziomsg">Os frames não estão mais disponíveis nesta sessão (a página foi recarregada, ou outro dossiê foi carregado depois). Volte à fase 03 e extraia de novo.</div>`;
    return;
  }

  const glossario = zonas.map((z) => ({ nomeOficial: z.nomeOficial, codigoInterno: z.codigoInterno }));
  const todasFatias = [];
  porCiclo.forEach((c) => c.fatias.forEach((f) => todasFatias.push({ ...f, __cicloIndice: c.cicloIndice })));

  container.innerHTML = `
    ${
      zonas.length === 0
        ? `<p class="grafico-legenda">Sem mapa de zonas, o glossário desta leitura fica vazio — praticamente toda fatia vai voltar "indeterminado" (F06-04: sem nome conhecido, o modelo não pode confirmar o objeto). Mapeie zonas na fase 00 primeiro.</p>`
        : `<p class="grafico-legenda">Glossário desta leitura: os ${zonas.length} nome${zonas.length === 1 ? "" : "s"} já cadastrados no mapa de zonas — ainda não é o glossário completo do pacote 1.1.3 (que também levaria foto de referência).</p>`
    }
    <div class="row">
      <button class="act" id="lerBotao">Ler ${todasFatias.length} frame${todasFatias.length === 1 ? "" : "s"}-chave (Gemini)</button>
      <span class="mono" id="lerProgresso"></span>
    </div>
    <div id="lerResultado"></div>`;

  const botaoEl = container.querySelector("#lerBotao");
  const progressoEl = container.querySelector("#lerProgresso");
  const resultadoEl = container.querySelector("#lerResultado");

  botaoEl.addEventListener("click", async () => {
    botaoEl.disabled = true;
    const leituras = new Array(todasFatias.length);
    let feitos = 0;

    resultadoEl.innerHTML = `<table class="ciclos-tabela" id="leituraTabela"><thead>
        <tr><th>#</th><th>Ciclo</th><th>Causa (fase 05)</th><th>Leitura (fase 06)</th></tr>
      </thead><tbody>${todasFatias
        .map((f, i) => `<tr id="linhaLeitura-${i}"><td>${f.indice}</td><td>${f.__cicloIndice}</td><td>${f.causa}</td><td class="mono">lendo…</td></tr>`)
        .join("")}</tbody></table>`;

    await lerFatiasEmLotes(
      todasFatias,
      frames,
      { glossario, verbosPermitidos: VERBOS_PADRAO, zonas },
      {
        onResultado: (i, leitura) => {
          leituras[i] = leitura;
          feitos++;
          progressoEl.textContent = `${feitos} / ${todasFatias.length}`;
          atualizarLinha(i, leitura);
        },
        onErro: (i, erro) => {
          leituras[i] = { indeterminado: true, motivo: `falha ao chamar o modelo: ${erro.message}` };
          feitos++;
          progressoEl.textContent = `${feitos} / ${todasFatias.length}`;
          atualizarLinha(i, leituras[i]);
        },
      }
    );

    botaoEl.disabled = false;

    const rodapeEl = document.createElement("div");
    rodapeEl.className = "row";
    rodapeEl.style.marginTop = "12px";
    const contagemIndeterminado = leituras.filter((l) => l.indeterminado).length;
    rodapeEl.innerHTML = `
      <button class="act" id="lerGravar">Gravar no dossiê</button>
      ${contagemIndeterminado > 0 ? `<span class="mono" style="font-size:12px">${contagemIndeterminado} de ${leituras.length} vieram indeterminadas</span>` : ""}`;
    resultadoEl.appendChild(rodapeEl);

    rodapeEl.querySelector("#lerGravar").addEventListener("click", () => {
      onGravar({ porCiclo: reagruparPorCiclo(porCiclo, todasFatias, leituras) });
    });
  });

  function atualizarLinha(i, leitura) {
    const linha = resultadoEl.querySelector(`#linhaLeitura-${i}`);
    if (!linha) return;
    const celula = linha.children[3];
    if (leitura.indeterminado) {
      celula.innerHTML = `<span title="${leitura.motivo}">indeterminado</span>`;
      linha.classList.add("ciclo-suspeito");
    } else {
      celula.textContent = `${leitura.verbo} · ${leitura.objeto} · ${leitura.mao} · ${leitura.confianca}%`;
    }
  }
}

function reagruparPorCiclo(porCicloOriginal, todasFatias, leituras) {
  return porCicloOriginal.map((c) => ({
    cicloIndice: c.cicloIndice,
    fatias: c.fatias.map((fatiaOriginal) => {
      const i = todasFatias.findIndex((f) => f.__cicloIndice === c.cicloIndice && f.indice === fatiaOriginal.indice);
      return { ...fatiaOriginal, leituraSemantica: leituras[i] };
    }),
  }));
}
