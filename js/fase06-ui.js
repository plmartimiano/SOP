// Controle de tela da fase 06 (Leitura semântica) — a primeira fase que
// chama um modelo pago (via api/leitura-semantica.js — nunca direto do
// navegador). Só é montada quando a fase 06 está selecionada (ver
// js/app.js). Depende dos frames extraídos ainda estarem na sessão
// (mesma situação das fases 03-05) e de já existir fatiamento da fase 05.
//
// ATUALIZADO (cartão de handoff de 2026-08-29): o cliente pediu pra
// testar sem gastar em nenhuma API paga por enquanto — mesmo pedido que
// já valeu pra fase 13. Modo manual novo (padrão agora): mostra as
// imagens e o prompt de cada fatia, com botão de copiar, e um campo pra
// colar de volta a resposta de um chat de graça (claude.ai, Gemini) —
// sem nenhuma chamada de rede daqui. O modo automático de sempre
// continua do lado, sem nenhuma mudança de lógica.
//
// montarPromptLeitura/sanitizarLeitura abaixo são cópias das mesmas
// funções em api/_leitura-semantica-core.js — precisam ficar iguais.
// Duplicadas de propósito (o core do servidor é CommonJS, não dá pra
// importar direto num módulo ES do navegador sem bundler) — mesma
// solução já usada nos arquivos teste-*.html entregues à parte.

import { VERBOS_PADRAO } from "./vocabulario-verbos.js";
import { lerFatiasEmLotes, montarPayload } from "./leitura-semantica.js";
import { copiarTexto, extrairJsonColado } from "./manual-ia.js";

const MAOS_VALIDAS = ["esquerda", "direita", "ambas"];

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

  let modo = "manual";
  render();

  function render() {
    container.innerHTML = `
      ${
        zonas.length === 0
          ? `<p class="grafico-legenda">Sem mapa de zonas, o glossário desta leitura fica vazio — praticamente toda fatia vai voltar "indeterminado" (F06-04: sem nome conhecido, o modelo não pode confirmar o objeto). Mapeie zonas na fase 00 primeiro.</p>`
          : `<p class="grafico-legenda">Glossário desta leitura: os ${zonas.length} nome${zonas.length === 1 ? "" : "s"} já cadastrados no mapa de zonas — ainda não é o glossário completo do pacote 1.1.3 (que também levaria foto de referência).</p>`
      }
      <div class="row">
        <button class="act ${modo === "manual" ? "" : "secondary"}" id="modoManualBotao" type="button">Modo manual (colar de um chat de graça)</button>
        <button class="act ${modo === "automatico" ? "" : "secondary"}" id="modoAutoBotao" type="button">Modo automático (chamar a API)</button>
      </div>
      <div id="areaModo" style="margin-top:14px"></div>`;

    container.querySelector("#modoManualBotao").addEventListener("click", () => {
      if (modo === "manual") return;
      modo = "manual";
      render();
    });
    container.querySelector("#modoAutoBotao").addEventListener("click", () => {
      if (modo === "automatico") return;
      modo = "automatico";
      render();
    });

    const areaEl = container.querySelector("#areaModo");
    if (modo === "manual") montarModoManual(areaEl);
    else montarModoAutomatico(areaEl);
  }

  // ===================== MODO MANUAL =====================
  function montarModoManual(areaEl) {
    const leituras = new Array(todasFatias.length).fill(null);
    const payloads = todasFatias.map((f) => montarPayload(f, frames, { glossario, verbosPermitidos: VERBOS_PADRAO, zonas }));
    const prompts = payloads.map((p) => montarPromptLeitura(p));

    areaEl.innerHTML = `
      <p class="grafico-legenda">
        Pra cada fatia: copie o prompt, cole numa conversa de chat de graça (claude.ai, Gemini) junto com as
        imagens mostradas, e cole a resposta JSON de volta no campo abaixo.
      </p>
      <table class="ciclos-tabela" id="leituraTabela"><thead>
          <tr><th>#</th><th>Ciclo</th><th>Causa (fase 05)</th><th>Colar do chat</th><th>Leitura (fase 06)</th></tr>
        </thead><tbody>${todasFatias
          .map(
            (f, i) => `<tr id="linhaLeitura-${i}">
              <td>${f.indice}</td><td>${f.__cicloIndice}</td><td>${f.causa}</td>
              <td>${celulaManual(i, payloads[i], prompts[i])}</td>
              <td class="mono" id="resultadoLeitura-${i}">pendente</td>
            </tr>`
          )
          .join("")}</tbody></table>
      <div class="row" style="margin-top:12px">
        <button class="act" id="lerGravarManual" type="button">Gravar no dossiê</button>
        <span class="mono" id="progressoManual"></span>
      </div>`;

    atualizarProgresso();

    todasFatias.forEach((_, i) => {
      const linha = areaEl.querySelector(`#linhaLeitura-${i}`);
      linha.querySelector(".copiarPrompt").addEventListener("click", async () => {
        try {
          await copiarTexto(prompts[i]);
          mostrarStatusLinha(linha, "ok", "Prompt copiado.");
        } catch {
          mostrarStatusLinha(linha, "erro", "Não consegui copiar automaticamente — selecione o texto do prompt e copie na mão.");
        }
      });
      linha.querySelector(".validarBotao").addEventListener("click", () => {
        const textoColado = linha.querySelector(".colarResposta").value;
        const respostaModelo = extrairJsonColado(textoColado);
        if (respostaModelo === null) {
          mostrarStatusLinha(linha, "erro", "Não achei um JSON válido no texto colado.");
          return;
        }
        const sanitizada = sanitizarLeitura(respostaModelo, { verbosPermitidos: VERBOS_PADRAO, glossario });
        leituras[i] = sanitizada;
        mostrarStatusLinha(linha, "ok", "Validado e salvo.");
        atualizarLinha(areaEl, i, sanitizada);
        atualizarProgresso();
      });
    });

    areaEl.querySelector("#lerGravarManual").addEventListener("click", () => {
      const leiturasCompletas = leituras.map((l) => l || { indeterminado: true, motivo: "não processado neste modo manual" });
      onGravar({ porCiclo: reagruparPorCiclo(porCiclo, todasFatias, leiturasCompletas) });
    });

    function atualizarProgresso() {
      const feitos = leituras.filter(Boolean).length;
      areaEl.querySelector("#progressoManual").textContent = `${feitos} / ${todasFatias.length} validadas`;
    }
  }

  function celulaManual(indice, payload, prompt) {
    const imgs = [
      payload.frames.antes ? { rotulo: "antes", src: payload.frames.antes } : null,
      { rotulo: "chave", src: payload.frames.chave },
      payload.frames.depois ? { rotulo: "depois", src: payload.frames.depois } : null,
    ].filter(Boolean);
    return `<details>
      <summary class="mono" style="font-size:11px">colar do chat</summary>
      <div style="padding:8px 0;min-width:220px">
        <div class="row">${imgs
          .map(
            (im) =>
              `<span><span class="mono" style="font-size:10px;display:block">${im.rotulo}</span><img src="${im.src}" alt="" style="max-width:80px;border:1px solid var(--line)"></span>`
          )
          .join("")}</div>
        <details style="margin-top:6px"><summary class="mono" style="font-size:11px">prompt</summary><pre class="jsontext" style="white-space:pre-wrap;font-size:11px">${prompt}</pre></details>
        <div class="row" style="margin-top:6px"><button class="act secondary copiarPrompt" type="button">Copiar prompt</button></div>
        <textarea class="colarResposta" placeholder="cole aqui a resposta (JSON)" style="width:100%;min-height:56px;margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11px"></textarea>
        <div class="row" style="margin-top:6px"><button class="act validarBotao" type="button">Validar e salvar</button></div>
        <div class="status" style="margin-top:4px"></div>
      </div>
    </details>`;
  }

  function mostrarStatusLinha(linha, tipo, texto) {
    const el = linha.querySelector(".status");
    el.className = `status show ${tipo}`;
    el.textContent = texto;
  }

  function atualizarLinha(areaEl, i, leitura) {
    const celula = areaEl.querySelector(`#resultadoLeitura-${i}`);
    if (!celula) return;
    if (leitura.indeterminado) {
      celula.innerHTML = `<span title="${leitura.motivo}">indeterminado</span>`;
    } else {
      celula.textContent = `${leitura.verbo} · ${leitura.objeto} · ${leitura.mao} · ${leitura.confianca}%`;
    }
  }

  // ===================== MODO AUTOMÁTICO =====================
  // Código original desta tela, sem nenhuma mudança de lógica — só
  // desenha dentro de areaEl em vez do container inteiro.
  function montarModoAutomatico(areaEl) {
    areaEl.innerHTML = `
      <div class="row">
        <button class="act" id="lerBotao">Ler ${todasFatias.length} frame${todasFatias.length === 1 ? "" : "s"}-chave (Gemini)</button>
        <span class="mono" id="lerProgresso"></span>
      </div>
      <div id="lerResultado"></div>`;

    const botaoEl = areaEl.querySelector("#lerBotao");
    const progressoEl = areaEl.querySelector("#lerProgresso");
    const resultadoEl = areaEl.querySelector("#lerResultado");

    botaoEl.addEventListener("click", async () => {
      botaoEl.disabled = true;
      const leituras = new Array(todasFatias.length);
      let feitos = 0;

      resultadoEl.innerHTML = `<table class="ciclos-tabela" id="leituraTabelaAuto"><thead>
          <tr><th>#</th><th>Ciclo</th><th>Causa (fase 05)</th><th>Leitura (fase 06)</th></tr>
        </thead><tbody>${todasFatias
          .map((f, i) => `<tr id="linhaLeituraAuto-${i}"><td>${f.indice}</td><td>${f.__cicloIndice}</td><td>${f.causa}</td><td class="mono">lendo…</td></tr>`)
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
            atualizarLinhaAuto(i, leitura);
          },
          onErro: (i, erro) => {
            leituras[i] = { indeterminado: true, motivo: `falha ao chamar o modelo: ${erro.message}` };
            feitos++;
            progressoEl.textContent = `${feitos} / ${todasFatias.length}`;
            atualizarLinhaAuto(i, leituras[i]);
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

    function atualizarLinhaAuto(i, leitura) {
      const linha = resultadoEl.querySelector(`#linhaLeituraAuto-${i}`);
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

// ===================== cópias do núcleo (ver aviso no topo do arquivo) =====================
function montarPromptLeitura({ glossario, verbosPermitidos, zona, tempoSegundos }) {
  const listaGlossario = glossario.map((g) => `- ${g.nomeOficial}${g.codigoInterno ? ` (${g.codigoInterno})` : ""}`).join("\n");
  const listaVerbos = verbosPermitidos.join(", ");
  const zonaTexto = zona
    ? `A mão do operador acabou de visitar a zona "${zona.nomeOficial}" (tipo: ${zona.tipo}). Use isso como resposta, não como pergunta: confirme ou conteste se o que a mão segura é compatível com essa zona — não adivinhe do zero.`
    : "Não há informação de zona da bancada para este instante.";

  return `Você está descrevendo um instante de um vídeo de montagem industrial, no tempo ${Number(tempoSegundos).toFixed(1)}s.

Três imagens em sequência (algumas podem faltar nas pontas do vídeo): o frame de antes, o frame-chave (o instante de maior movimento dentro desta fatia) e o frame de depois.

Vocabulário fechado de componentes e ferramentas desta estação — não use nenhum nome fora desta lista:
${listaGlossario || "(nenhum item cadastrado)"}

Verbos permitidos (a ação tem que ser um destes, exatamente): ${listaVerbos}

${zonaTexto}

Responda em JSON, só com os campos abaixo, sem nenhum texto fora do JSON:
{
  "verbo": "um dos verbos permitidos",
  "objeto": "nome oficial exato de um item da lista acima",
  "ferramenta": "nome oficial de uma ferramenta da lista, ou \\"nenhuma\\"",
  "mao": "esquerda, direita ou ambas",
  "pontoDeAplicacao": "descrição curta de onde a ação aconteceu",
  "confianca": "número de 0 a 100"
}

Se a peça ou a ação não forem identificáveis com segurança nas imagens, não invente. Responda só:
{ "indeterminado": true, "motivo": "explicação curta de por que não dá para saber" }`;
}

function normalizar(texto) {
  return String(texto ?? "").trim().toLowerCase();
}

function sanitizarLeitura(resposta, { verbosPermitidos, glossario }) {
  if (!resposta || typeof resposta !== "object") {
    return { indeterminado: true, motivo: "resposta do modelo não veio em formato reconhecível" };
  }
  if (resposta.indeterminado === true) {
    return { indeterminado: true, motivo: resposta.motivo || "motivo não informado pelo modelo" };
  }
  const obrigatorios = ["verbo", "objeto", "ferramenta", "mao", "pontoDeAplicacao", "confianca"];
  const faltando = obrigatorios.filter((c) => resposta[c] === undefined || resposta[c] === null || resposta[c] === "");
  if (faltando.length > 0) {
    return { indeterminado: true, motivo: `campos obrigatórios ausentes na resposta: ${faltando.join(", ")}` };
  }
  const verbosNormalizados = verbosPermitidos.map(normalizar);
  if (!verbosNormalizados.includes(normalizar(resposta.verbo))) {
    return { indeterminado: true, motivo: `verbo "${resposta.verbo}" fora da lista permitida` };
  }
  function nomeOficialCorrespondente(valor) {
    const item = glossario.find((g) => normalizar(g.nomeOficial) === normalizar(valor));
    return item ? item.nomeOficial : valor;
  }
  const nomesConhecidos = glossario.map((g) => normalizar(g.nomeOficial));
  if (!nomesConhecidos.includes(normalizar(resposta.objeto))) {
    return { indeterminado: true, motivo: `objeto "${resposta.objeto}" não está no glossário desta estação` };
  }
  if (normalizar(resposta.ferramenta) !== "nenhuma" && !nomesConhecidos.includes(normalizar(resposta.ferramenta))) {
    return { indeterminado: true, motivo: `ferramenta "${resposta.ferramenta}" não está no glossário desta estação` };
  }
  if (!MAOS_VALIDAS.includes(normalizar(resposta.mao))) {
    return { indeterminado: true, motivo: `mão "${resposta.mao}" inválida (esperado: ${MAOS_VALIDAS.join(", ")})` };
  }
  const confianca = Number(resposta.confianca);
  if (!Number.isFinite(confianca) || confianca < 0 || confianca > 100) {
    return { indeterminado: true, motivo: `confiança "${resposta.confianca}" fora da faixa 0–100` };
  }
  return {
    verbo: normalizar(resposta.verbo),
    objeto: nomeOficialCorrespondente(resposta.objeto),
    ferramenta: normalizar(resposta.ferramenta) === "nenhuma" ? "nenhuma" : nomeOficialCorrespondente(resposta.ferramenta),
    mao: normalizar(resposta.mao),
    pontoDeAplicacao: String(resposta.pontoDeAplicacao),
    confianca: Math.round(confianca),
  };
}
