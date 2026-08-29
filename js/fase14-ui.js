// Controle de tela da fase 14 (Verificação cega) — a TERCEIRA chamada
// paga do projeto. Manda as imagens geradas, sozinhas e sem a ficha, de
// volta pro modelo: uma nota por quadro, um teste de ordem embaralhada
// (o gate central da fase — "a sequência é reconstruível só pelas
// imagens") e uma checagem de continuidade entre pares consecutivos.
//
// Limitação herdada da fase 13: as imagens só existem na sessão do
// navegador (nunca no dossiê — F01-01), então esta fase só funciona na
// MESMA aba/sessão onde a fase 13 gerou as imagens.
//
// ATUALIZADO (cartão de handoff de 2026-08-29): mesmo pedido das fases
// 06/13 — testar sem gastar em nenhuma API paga. Modo manual novo
// (padrão agora): mostra as imagens e o prompt de cada checagem, com
// botão de copiar, e um campo pra colar de volta a resposta de um chat
// de graça — sem nenhuma chamada de rede daqui. O modo automático de
// sempre continua do lado, sem nenhuma mudança de lógica.
//
// montarPromptNota/Ordem/Continuidade e sanitizarNota/Ordem/Continuidade
// abaixo são cópias das mesmas funções em api/_verificar-imagem-core.js
// — precisam ficar iguais (mesmo motivo de duplicação do core do
// servidor explicado em fase06-ui.js). embaralharComRotulos e
// avaliarOrdemSugerida NÃO são cópias — são as mesmas funções de
// verdade, importadas de verificacao-cega.js, reusadas nos dois modos.

import { rodarVerificacaoCega, embaralharComRotulos, avaliarOrdemSugerida } from "./verificacao-cega.js";
import { copiarTexto, extrairJsonColado } from "./manual-ia.js";

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

  let modo = "manual";
  render();

  function render() {
    container.innerHTML = `
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
    const notas = {};
    let ordemResultado = null;
    const continuidades = new Array(passosComImagemAncora.length - 1).fill(null);

    const itensParaNota = [
      ...(quadroMestreItem ? [{ chave: "quadroMestre", titulo: "Quadro-mestre", ...quadroMestreItem }] : []),
      ...passosComImagemAncora.map((p) => ({ chave: `passo:${p.numero}`, titulo: `Passo ${p.numero} — ${p.titulo}`, imagemBase64: p.imagemBase64, mimeType: p.mimeType })),
    ];

    // Embaralha uma vez só (persiste enquanto a tela não recarrega) —
    // igual ao modo automático: o modelo nunca deve ver o número real
    // do passo, só os rótulos A–F.
    const { itens: itensEmbaralhados, rotuloParaNumero } = embaralharComRotulos(passosComImagemAncora);
    const promptOrdem = montarPromptOrdem(itensEmbaralhados.map((i) => i.rotulo));

    const paresConsecutivos = [];
    for (let i = 0; i < passosComImagemAncora.length - 1; i++) {
      paresConsecutivos.push([passosComImagemAncora[i], passosComImagemAncora[i + 1]]);
    }

    areaEl.innerHTML = `
      <p class="grafico-legenda">
        Pra cada checagem: copie o prompt, cole numa conversa de chat de graça junto com a(s) imagem(ns)
        mostrada(s), e cole a resposta JSON de volta no campo abaixo.
      </p>

      <h4 style="margin:16px 0 6px">Nota por quadro</h4>
      <div class="fichas-grid" id="notaGrid">
        ${itensParaNota.map((item) => cartaoNota(item)).join("")}
      </div>

      <h4 style="margin:16px 0 6px">Teste de ordem embaralhada</h4>
      <p class="grafico-legenda">As imagens abaixo estão na ordem embaralhada e rotuladas A–F — é assim que
        devem ir pro chat, sem revelar a ordem real.</p>
      <div class="row" id="ordemImagens">
        ${itensEmbaralhados.map((item) => `<span><span class="mono" style="font-size:10px;display:block">${item.rotulo}</span><img src="data:${item.mimeType};base64,${item.imagemBase64}" alt="" style="max-width:90px;border:1px solid var(--line)"></span>`).join("")}
      </div>
      <details style="margin-top:6px"><summary class="mono" style="font-size:11px">prompt</summary><pre class="jsontext" style="white-space:pre-wrap;font-size:11px">${promptOrdem}</pre></details>
      <div class="row" style="margin-top:6px"><button class="act secondary" id="copiarOrdem" type="button">Copiar prompt</button></div>
      <textarea id="colarOrdem" placeholder="cole aqui a resposta (JSON)" style="width:100%;min-height:56px;margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px"></textarea>
      <div class="row" style="margin-top:6px"><button class="act" id="validarOrdem" type="button">Validar e salvar</button></div>
      <div class="status" id="statusOrdem" style="margin-top:6px"></div>

      <h4 style="margin:16px 0 6px">Continuidade entre pares consecutivos</h4>
      <div class="fichas-grid" id="continuidadeGrid">
        ${paresConsecutivos.map((par, i) => cartaoContinuidade(par, i)).join("")}
      </div>

      <div class="row" style="margin-top:16px">
        <button class="act" id="verificarGravarManual" type="button">Gravar no dossiê</button>
        <span class="mono" id="progressoManual"></span>
      </div>`;

    atualizarProgresso();

    // --- nota ---
    itensParaNota.forEach((item) => {
      const cardEl = areaEl.querySelector(`#nota-${cssId(item.chave)}`);
      cardEl.querySelector(".copiarPrompt").addEventListener("click", async () => {
        try {
          await copiarTexto(montarPromptNota());
          mostrarStatusCard(cardEl, "ok", "Prompt copiado.");
        } catch {
          mostrarStatusCard(cardEl, "erro", "Não consegui copiar automaticamente — copie o texto na mão.");
        }
      });
      cardEl.querySelector(".validarBotao").addEventListener("click", () => {
        const respostaModelo = extrairJsonColado(cardEl.querySelector(".colarResposta").value);
        if (respostaModelo === null) return mostrarStatusCard(cardEl, "erro", "Não achei um JSON válido no texto colado.");
        const sanitizada = sanitizarNota(respostaModelo);
        if (sanitizada.erro) return mostrarStatusCard(cardEl, "erro", sanitizada.motivo);
        notas[item.chave] = sanitizada;
        mostrarStatusCard(cardEl, "ok", `Salvo: nota ${sanitizada.nota}/100.`);
        atualizarProgresso();
      });
    });

    // --- ordem ---
    areaEl.querySelector("#copiarOrdem").addEventListener("click", async () => {
      try {
        await copiarTexto(promptOrdem);
        mostrarStatusEl(areaEl.querySelector("#statusOrdem"), "ok", "Prompt copiado.");
      } catch {
        mostrarStatusEl(areaEl.querySelector("#statusOrdem"), "erro", "Não consegui copiar automaticamente — copie o texto na mão.");
      }
    });
    areaEl.querySelector("#validarOrdem").addEventListener("click", () => {
      const statusEl = areaEl.querySelector("#statusOrdem");
      const respostaModelo = extrairJsonColado(areaEl.querySelector("#colarOrdem").value);
      if (respostaModelo === null) return mostrarStatusEl(statusEl, "erro", "Não achei um JSON válido no texto colado.");
      const rotulos = itensEmbaralhados.map((i) => i.rotulo);
      const sanitizada = sanitizarOrdem(respostaModelo, rotulos);
      if (sanitizada.erro) return mostrarStatusEl(statusEl, "erro", sanitizada.motivo);
      ordemResultado = avaliarOrdemSugerida(
        sanitizada.ordemSugerida,
        rotuloParaNumero,
        passosComImagemAncora.map((p) => p.numero)
      );
      mostrarStatusEl(
        statusEl,
        ordemResultado.sequenciaReconstruivel ? "ok" : "erro",
        ordemResultado.sequenciaReconstruivel
          ? "Salvo: gate F14 passou, sequência reconstruível."
          : `Salvo: gate F14 falhou (${ordemResultado.totalAcertos}/${ordemResultado.acertosPorPosicao.length} posições bateram).`
      );
      atualizarProgresso();
    });

    // --- continuidade ---
    paresConsecutivos.forEach((par, i) => {
      const cardEl = areaEl.querySelector(`#continuidade-${i}`);
      const prompt = montarPromptContinuidade();
      cardEl.querySelector(".copiarPrompt").addEventListener("click", async () => {
        try {
          await copiarTexto(prompt);
          mostrarStatusCard(cardEl, "ok", "Prompt copiado.");
        } catch {
          mostrarStatusCard(cardEl, "erro", "Não consegui copiar automaticamente — copie o texto na mão.");
        }
      });
      cardEl.querySelector(".validarBotao").addEventListener("click", () => {
        const respostaModelo = extrairJsonColado(cardEl.querySelector(".colarResposta").value);
        if (respostaModelo === null) return mostrarStatusCard(cardEl, "erro", "Não achei um JSON válido no texto colado.");
        const sanitizada = sanitizarContinuidade(respostaModelo);
        if (sanitizada.erro) return mostrarStatusCard(cardEl, "erro", sanitizada.motivo);
        continuidades[i] = { entre: [par[0].numero, par[1].numero], ...sanitizada };
        mostrarStatusCard(cardEl, "ok", sanitizada.consistente ? "Salvo: consistente." : "Salvo: INCONSISTENTE.");
        atualizarProgresso();
      });
    });

    areaEl.querySelector("#verificarGravarManual").addEventListener("click", () => {
      const continuidadesCompletas = continuidades.map((c, i) => {
        if (c) return c;
        const par = paresConsecutivos[i];
        return { entre: [par[0].numero, par[1].numero], erro: "não processado neste modo manual" };
      });
      onGravar({
        notas,
        ordem: ordemResultado,
        continuidades: continuidadesCompletas,
        gateSequenciaReconstruivel: ordemResultado ? ordemResultado.sequenciaReconstruivel : null,
      });
    });

    function atualizarProgresso() {
      const total = itensParaNota.length + 1 + paresConsecutivos.length;
      const feitos = Object.keys(notas).length + (ordemResultado ? 1 : 0) + continuidades.filter(Boolean).length;
      areaEl.querySelector("#progressoManual").textContent = `${feitos} / ${total} validados`;
    }

    function cartaoNota(item) {
      return `<div class="ficha-card" id="nota-${cssId(item.chave)}">
        <h4>${item.titulo}</h4>
        <img src="data:${item.mimeType};base64,${item.imagemBase64}" alt="" style="max-width:100%;border:1px solid var(--line)">
        <details style="margin-top:6px"><summary class="mono" style="font-size:11px">prompt</summary><pre class="jsontext" style="white-space:pre-wrap;font-size:11px">${montarPromptNota()}</pre></details>
        <div class="row" style="margin-top:6px"><button class="act secondary copiarPrompt" type="button">Copiar prompt</button></div>
        <textarea class="colarResposta" placeholder="cole aqui a resposta (JSON)" style="width:100%;min-height:56px;margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11px"></textarea>
        <div class="row" style="margin-top:6px"><button class="act validarBotao" type="button">Validar e salvar</button></div>
        <div class="status" style="margin-top:4px"></div>
      </div>`;
    }

    function cartaoContinuidade(par, i) {
      const [antes, depois] = par;
      return `<div class="ficha-card" id="continuidade-${i}">
        <h4>Passo ${antes.numero} → Passo ${depois.numero}</h4>
        <div class="row">
          <span><span class="mono" style="font-size:10px;display:block">antes</span><img src="data:${antes.mimeType};base64,${antes.imagemBase64}" alt="" style="max-width:90px;border:1px solid var(--line)"></span>
          <span><span class="mono" style="font-size:10px;display:block">depois</span><img src="data:${depois.mimeType};base64,${depois.imagemBase64}" alt="" style="max-width:90px;border:1px solid var(--line)"></span>
        </div>
        <details style="margin-top:6px"><summary class="mono" style="font-size:11px">prompt</summary><pre class="jsontext" style="white-space:pre-wrap;font-size:11px">${montarPromptContinuidade()}</pre></details>
        <div class="row" style="margin-top:6px"><button class="act secondary copiarPrompt" type="button">Copiar prompt</button></div>
        <textarea class="colarResposta" placeholder="cole aqui a resposta (JSON)" style="width:100%;min-height:56px;margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11px"></textarea>
        <div class="row" style="margin-top:6px"><button class="act validarBotao" type="button">Validar e salvar</button></div>
        <div class="status" style="margin-top:4px"></div>
      </div>`;
    }
  }

  function mostrarStatusCard(cardEl, tipo, texto) {
    mostrarStatusEl(cardEl.querySelector(".status"), tipo, texto);
  }
  function mostrarStatusEl(el, tipo, texto) {
    el.className = `status show ${tipo}`;
    el.textContent = texto;
  }
  function cssId(chave) {
    return chave.replace(/[^a-zA-Z0-9]/g, "-");
  }

  // ===================== MODO AUTOMÁTICO =====================
  // Código original desta tela, sem nenhuma mudança de lógica — só
  // desenha dentro de areaEl em vez do container inteiro.
  function montarModoAutomatico(areaEl) {
    const totalChamadas = passosComImagemAncora.length + (quadroMestreItem ? 1 : 0) + 1 + (passosComImagemAncora.length - 1);
    areaEl.innerHTML = `
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

    const botaoEl = areaEl.querySelector("#verificarBotao");
    const progressoEl = areaEl.querySelector("#verificarProgresso");
    const resultadoEl = areaEl.querySelector("#verificarResultado");

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

// ===================== cópias do núcleo (ver aviso no topo do arquivo) =====================
function montarPromptNota() {
  return `Você está vendo uma única ilustração técnica de um passo de montagem industrial, sem nenhum texto ou contexto além da própria imagem. Descreva em uma frase curta o que você vê acontecendo na cena, e dê uma nota de 0 a 100 para o quão claramente essa imagem sozinha comunica UMA ação específica (mãos, peça, ferramenta).

Responda só em JSON: {"descricao": "...", "nota": 0}`;
}
function montarPromptOrdem(rotulos) {
  return `Você está vendo ${rotulos.length} ilustrações de passos de uma montagem industrial, rotuladas ${rotulos.join(", ")}, em ordem ALEATÓRIA. Olhando só para o que está sendo montado em cada imagem (peças aparecendo, ferramentas em uso), reconstrua a ordem cronológica correta da montagem, do primeiro passo ao último.

Responda só em JSON: {"ordemSugerida": ["<rótulo>", "<rótulo>", ...]} com todos os ${rotulos.length} rótulos, cada um exatamente uma vez.`;
}
function montarPromptContinuidade() {
  return `Você está vendo duas ilustrações da mesma bancada de montagem industrial, em sequência. Confirme se a peça/ação da primeira imagem está visivelmente presente e consistente na segunda (mesmo ângulo, mesma bancada, nada desaparecendo sem explicação).

Responda só em JSON: {"consistente": true ou false, "motivo": "explicação curta"}`;
}
function normalizarNota(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}
function sanitizarNota(resposta) {
  const nota = normalizarNota(resposta?.nota);
  if (nota === null) return { erro: true, motivo: `nota "${resposta?.nota}" não é um número válido entre 0 e 100` };
  return { erro: false, nota, descricao: String(resposta?.descricao || "") };
}
function sanitizarOrdem(resposta, rotulosEsperados) {
  const ordem = resposta?.ordemSugerida;
  if (!Array.isArray(ordem)) return { erro: true, motivo: "ordemSugerida não veio como lista" };
  const setEsperado = new Set(rotulosEsperados);
  const setRecebido = new Set(ordem);
  const valida = ordem.length === rotulosEsperados.length && setRecebido.size === ordem.length && [...setEsperado].every((r) => setRecebido.has(r));
  if (!valida) return { erro: true, motivo: `ordemSugerida não é uma permutação válida de [${rotulosEsperados.join(", ")}] — veio [${ordem.join(", ")}]` };
  return { erro: false, ordemSugerida: ordem };
}
function sanitizarContinuidade(resposta) {
  if (typeof resposta?.consistente !== "boolean") return { erro: true, motivo: `consistente "${resposta?.consistente}" não é um booleano` };
  return { erro: false, consistente: resposta.consistente, motivo: String(resposta?.motivo || "") };
}
