// Controle de tela da fase 13 (Geração das imagens) — a SEGUNDA e última
// chamada paga planejada até aqui, e a fase que aplica de verdade a
// barreira "nenhuma imagem antes do aceite humano" (ver js/geracao-imagens.js:
// gerarTodasAsImagens recusa rodar sem aprovacaoExiste, mesmo que esta
// tela por algum bug deixasse clicar em gerar).
//
// As imagens em si nunca entram no dossiê (mesmo risco de tamanho do
// vídeo — F01-01); ficam em sessao-midia.js, só nesta aba. O dossiê grava
// metadados: prompt usado, semente, o que cada item referenciou, e se
// deu certo ou não — o suficiente pra auditar sem guardar megabytes de
// imagem em JSON.
//
// ATUALIZADO (cartão de handoff de 2026-08-29): o cliente decidiu não
// automatizar a chamada ao Gemini por enquanto — quer um passo manual
// (pegar o prompt, colar num Gemini à parte, trazer a imagem de volta)
// antes de ligar a chamada automática de novo. As duas telas convivem
// aqui: "manual" (novo, padrão agora) e "automático" (o código que já
// existia, sem nenhuma mudança de lógica — só passou a desenhar dentro
// de uma sub-área em vez do container inteiro, pra caber o alternador
// dos dois modos). Trocar de volta pro automático é só clicar no botão —
// nenhum dado se perde, os dois modos gravam no dossiê do mesmo jeito
// (mesmo formato de onGravar), então o resto do app (fases 14, 15) não
// enxerga diferença nenhuma entre uma imagem que veio da API ou de um
// upload manual.

import { gerarTodasAsImagens, montarPlanoDeGeracao, chaveUnicaDoItem } from "./geracao-imagens.js";

// container: elemento onde a ferramenta é desenhada.
// prompts: prompts (dossiê, versão atual — camadaCompartilhada, quadroMestre, passos) ou null.
// aprovacaoExiste: bool — existe uma versão gravada em "aprovacoes"?
// onGravar: (dadosImagens, mapaImagens) => void — grava metadados em "imagens"
//   e guarda o mapa de imagens de verdade na sessão (via sessao-midia.js, no chamador).
export function montarGeracaoImagens(container, { prompts, aprovacaoExiste, onGravar }) {
  if (!prompts) {
    container.innerHTML = `<div class="vaziomsg">Monte os prompts na fase 12 antes de gerar as imagens.</div>`;
    return;
  }
  if (!aprovacaoExiste) {
    container.innerHTML = `<div class="status show erro">
      Bloqueado: não existe aprovação gravada na fase 11. Nenhuma imagem é gerada antes do aceite humano das
      fichas dos 6 passos — regra fixada desde o início do projeto, aplicada aqui de verdade, não só sugerida.
      Volte à fase 11 e assine a aprovação antes de continuar.
    </div>`;
    return;
  }

  const plano = montarPlanoDeGeracao({ quadroMestre: prompts.quadroMestre, passos: prompts.passos });
  let modo = "manual";

  render();

  function render() {
    container.innerHTML = `
      <div class="row">
        <button class="act ${modo === "manual" ? "" : "secondary"}" id="modoManualBotao" type="button">Modo manual (colar do Gemini)</button>
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
    const mapaImagens = new Map(); // chaveUnicaDoItem -> { imagemBase64, mimeType }

    areaEl.innerHTML = `
      <p class="grafico-legenda">
        Gere cada imagem fora do app (por exemplo, no Gemini/AI Studio): copie o prompt do cartão, cole na
        conversa com o Gemini e — se o cartão mostrar uma imagem de referência — anexe-a também, pra manter a
        bancada reconhecível entre os quadros. Depois, suba o arquivo que o Gemini devolveu no campo do
        próprio cartão. ${plano.length} imagens no total (1 quadro-mestre + ${prompts.passos.length} passos ×
        3 variações).
      </p>
      <div class="fichas-grid" id="imagensGridManual">
        ${plano.map((item) => cartaoManual(item)).join("")}
      </div>
      <div class="row" style="margin-top:12px">
        <button class="act" id="gravarManualBotao" type="button">Gravar no dossiê</button>
        <span class="mono" id="progressoManual"></span>
      </div>`;

    atualizarProgresso();

    for (const item of plano) {
      const chave = chaveUnicaDoItem(item);
      const cardEl = areaEl.querySelector(`#img-${cssId(chave)}`);

      cardEl.querySelector(".copiarPrompt").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.prompt);
          mostrarStatusCard(cardEl, "ok", "Prompt copiado.");
        } catch {
          mostrarStatusCard(cardEl, "erro", "Não consegui copiar automaticamente — selecione o texto do prompt acima e copie manualmente.");
        }
      });

      cardEl.querySelector(".uploadImagem").addEventListener("change", async (ev) => {
        const arquivo = ev.target.files[0];
        if (!arquivo) return;
        try {
          const { base64, mimeType } = await arquivoParaBase64(arquivo);
          mapaImagens.set(chave, { imagemBase64: base64, mimeType });
          cardEl.querySelector(".imagem-corpo").innerHTML = `<img src="data:${mimeType};base64,${base64}" alt="" style="max-width:100%;border:1px solid var(--line)">`;
          mostrarStatusCard(cardEl, "ok", "Imagem recebida.");
          atualizarReferenciasQueApontamPara(chave, { imagemBase64: base64, mimeType });
          atualizarProgresso();
        } catch (e) {
          mostrarStatusCard(cardEl, "erro", e.message);
        }
      });
    }

    areaEl.querySelector("#gravarManualBotao").addEventListener("click", () => {
      const itens = plano.map((item) => {
        const chave = chaveUnicaDoItem(item);
        const imagem = mapaImagens.get(chave);
        return imagem
          ? { ...semPrompt(item), sucesso: true, tamanhoBytes: Math.round((imagem.imagemBase64.length * 3) / 4) }
          : { ...semPrompt(item), sucesso: false, erro: "imagem não enviada neste modo manual" };
      });
      onGravar({ itens }, mapaImagens);
    });

    function atualizarReferenciasQueApontamPara(chave, imagem) {
      areaEl.querySelectorAll(`[data-referencia-de="${chave}"] .referencia-preview`).forEach((el) => {
        el.innerHTML = referenciaHtml(imagem);
      });
    }

    function atualizarProgresso() {
      areaEl.querySelector("#progressoManual").textContent = `${mapaImagens.size} / ${plano.length} enviadas`;
    }

    function cartaoManual(item) {
      const titulo = item.tipo === "quadroMestre" ? "Quadro-mestre" : `Passo ${item.numero} — variação ${item.variacao}`;
      const referenciaExistente = item.referenciaDe ? mapaImagens.get(item.referenciaDe) : null;
      return `<div class="ficha-card" id="img-${cssId(chaveUnicaDoItem(item))}" data-referencia-de="${item.referenciaDe || ""}">
        <h4>${titulo}</h4>
        ${item.referenciaDe ? `<div class="referencia-preview">${referenciaHtml(referenciaExistente)}</div>` : ""}
        <details><summary>Prompt</summary><pre class="jsontext" style="white-space:pre-wrap">${item.prompt}</pre></details>
        <div class="row" style="margin-top:8px">
          <button class="act secondary copiarPrompt" type="button">Copiar prompt</button>
          <input type="file" accept="image/*" class="uploadImagem">
        </div>
        <div class="imagem-corpo" style="margin-top:8px"></div>
        <div class="status" style="margin-top:6px"></div>
      </div>`;
    }
  }

  function referenciaHtml(imagem) {
    if (!imagem) {
      return `<p class="mono" style="font-size:11px;color:var(--ink-soft)">Anexe a imagem do item anterior da cadeia como referência no Gemini — envie primeiro a imagem desse item anterior aqui na tela pra ela aparecer.</p>`;
    }
    return `<p class="mono" style="font-size:11px;color:var(--ink-soft)">Anexe esta imagem como referência no Gemini, junto com o prompt:</p>
      <img src="data:${imagem.mimeType};base64,${imagem.imagemBase64}" alt="referência" style="max-width:140px;border:1px solid var(--line);display:block">`;
  }

  function mostrarStatusCard(cardEl, tipo, texto) {
    const el = cardEl.querySelector(".status");
    el.className = `status show ${tipo}`;
    el.textContent = texto;
  }

  function arquivoParaBase64(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        const dataUrl = leitor.result;
        const virgula = dataUrl.indexOf(",");
        resolve({ base64: dataUrl.slice(virgula + 1), mimeType: arquivo.type || "image/png" });
      };
      leitor.onerror = () => reject(new Error("falha ao ler o arquivo " + arquivo.name));
      leitor.readAsDataURL(arquivo);
    });
  }

  // ===================== MODO AUTOMÁTICO =====================
  // Código original desta tela, sem nenhuma mudança de lógica — só
  // desenha dentro de areaEl em vez do container inteiro.
  function montarModoAutomatico(areaEl) {
    areaEl.innerHTML = `
      <p class="grafico-legenda">
        Esta é a segunda e última chamada paga do projeto. Vai gerar ${plano.length} imagens
        (1 quadro-mestre + ${prompts.passos.length} passos × 3 variações), em cadeia — cada passo referencia a
        variação-âncora do elo anterior, pra manter a bancada reconhecível nos seis quadros.
      </p>
      <div class="row">
        <button class="act" id="gerarBotao">Gerar ${plano.length} imagens (Gemini)</button>
        <span class="mono" id="gerarProgresso"></span>
      </div>
      <div id="gerarResultado"></div>`;

    const botaoEl = areaEl.querySelector("#gerarBotao");
    const progressoEl = areaEl.querySelector("#gerarProgresso");
    const resultadoEl = areaEl.querySelector("#gerarResultado");

    botaoEl.addEventListener("click", async () => {
      botaoEl.disabled = true;
      const mapaImagens = new Map(); // chaveUnicaDoItem -> { imagemBase64, mimeType }
      const itensMeta = new Map(); // chaveUnicaDoItem -> metadado (sem a imagem)
      let feitos = 0;

      resultadoEl.innerHTML = `<div class="fichas-grid" id="imagensGrid">
        ${plano.map((item) => cartaoVazio(item)).join("")}
      </div>`;

      await gerarTodasAsImagens(
        { quadroMestre: prompts.quadroMestre, passos: prompts.passos },
        {
          aprovacaoExiste,
          onResultado: (item, resultado) => {
            feitos++;
            progressoEl.textContent = `${feitos} / ${plano.length}`;
            const chave = chaveUnicaDoItem(item);
            mapaImagens.set(chave, { imagemBase64: resultado.imagemBase64, mimeType: resultado.mimeType || "image/png" });
            itensMeta.set(chave, {
              ...semPrompt(item),
              sucesso: true,
              tamanhoBytes: Math.round((resultado.imagemBase64.length * 3) / 4),
            });
            // Chamada teve sucesso, mas se a variação-âncora do elo
            // anterior falhou, esta imagem foi gerada SEM a referência
            // esperada (ver referenciaQuebrada em geracao-imagens.js) —
            // ainda assim "sucesso" tecnicamente, mas a cadeia de
            // consistência visual quebrou a partir daqui. Avisa em vez de
            // mostrar como um card normal.
            atualizarCartao(chave, resultado, null, item.referenciaQuebrada);
          },
          onErro: (item, erro) => {
            feitos++;
            progressoEl.textContent = `${feitos} / ${plano.length}`;
            const chave = chaveUnicaDoItem(item);
            itensMeta.set(chave, { ...semPrompt(item), sucesso: false, erro: erro.message });
            atualizarCartao(chave, null, erro);
          },
        }
      );

      botaoEl.disabled = false;

      const falhas = [...itensMeta.values()].filter((m) => !m.sucesso).length;
      const comReferenciaQuebrada = [...itensMeta.values()].filter((m) => m.referenciaQuebrada).length;
      const rodapeEl = document.createElement("div");
      rodapeEl.className = "row";
      rodapeEl.style.marginTop = "12px";
      rodapeEl.innerHTML = `
        <button class="act" id="gerarGravar">Gravar no dossiê</button>
        ${falhas > 0 ? `<span class="mono" style="font-size:12px;color:var(--alert)">${falhas} de ${plano.length} falharam</span>` : ""}
        ${comReferenciaQuebrada > 0 ? `<span class="mono" style="font-size:12px;color:var(--alert)">${comReferenciaQuebrada} geradas sem a referência esperada (cadeia quebrada)</span>` : ""}`;
      resultadoEl.appendChild(rodapeEl);

      rodapeEl.querySelector("#gerarGravar").addEventListener("click", () => {
        onGravar({ itens: [...itensMeta.values()] }, mapaImagens);
      });
    });

    function atualizarCartao(chave, resultado, erro, referenciaQuebrada = false) {
      const el = resultadoEl.querySelector(`#img-${cssId(chave)}`);
      if (!el) return;
      if (erro) {
        el.querySelector(".imagem-corpo").innerHTML = `<div class="status show erro">${erro.message}</div>`;
        return;
      }
      const avisoReferencia = referenciaQuebrada
        ? `<p class="status show erro" style="margin-top:6px">Gerada sem a referência esperada — a variação-âncora anterior da cadeia falhou. A consistência visual pode ter quebrado a partir daqui.</p>`
        : "";
      el.querySelector(".imagem-corpo").innerHTML = `<img src="data:${resultado.mimeType || "image/png"};base64,${resultado.imagemBase64}" alt="">${avisoReferencia}`;
    }
  }
}

function semPrompt(item) {
  const { prompt, ...resto } = item;
  return resto;
}

function cssId(chave) {
  return chave.replace(/[^a-zA-Z0-9]/g, "-");
}

function cartaoVazio(item) {
  const titulo = item.tipo === "quadroMestre" ? "Quadro-mestre" : `Passo ${item.numero} — variação ${item.variacao}`;
  return `<div class="ficha-card" id="img-${cssId(chaveUnicaDoItem(item))}">
    <h4>${titulo}</h4>
    <div class="imagem-corpo"><span class="mono" style="font-size:11px;color:var(--ink-soft)">gerando…</span></div>
  </div>`;
}
