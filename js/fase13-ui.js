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

  container.innerHTML = `
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

  const botaoEl = container.querySelector("#gerarBotao");
  const progressoEl = container.querySelector("#gerarProgresso");
  const resultadoEl = container.querySelector("#gerarResultado");

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
          itensMeta.set(chave, { ...semPrompt(item), sucesso: true, tamanhoBytes: Math.round((resultado.imagemBase64.length * 3) / 4) });
          atualizarCartao(chave, resultado, null);
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
    const rodapeEl = document.createElement("div");
    rodapeEl.className = "row";
    rodapeEl.style.marginTop = "12px";
    rodapeEl.innerHTML = `
      <button class="act" id="gerarGravar">Gravar no dossiê</button>
      ${falhas > 0 ? `<span class="mono" style="font-size:12px;color:var(--alert)">${falhas} de ${plano.length} falharam</span>` : ""}`;
    resultadoEl.appendChild(rodapeEl);

    rodapeEl.querySelector("#gerarGravar").addEventListener("click", () => {
      onGravar({ itens: [...itensMeta.values()] }, mapaImagens);
    });
  });

  function atualizarCartao(chave, resultado, erro) {
    const el = resultadoEl.querySelector(`#img-${cssId(chave)}`);
    if (!el) return;
    if (erro) {
      el.querySelector(".imagem-corpo").innerHTML = `<div class="status show erro">${erro.message}</div>`;
    } else {
      el.querySelector(".imagem-corpo").innerHTML = `<img src="data:${resultado.mimeType || "image/png"};base64,${resultado.imagemBase64}" alt="">`;
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
