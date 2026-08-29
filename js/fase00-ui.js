// Controle de tela da fase 00 (Fundação — mapa de zonas). Só é montado
// quando a fase 00 está selecionada (ver js/app.js). A foto/frame usada
// para desenhar não entra no dossiê (mesmo motivo do vídeo e das
// miniaturas — ver sessao-midia.js): fica só na memória desta montagem da
// tela. Sair da fase e voltar limpa o desenho em andamento; zonas já
// gravadas continuam no dossiê normalmente.
//
// PASSO 1 — o ciclo de coordenadas de uma zona: pixel do canvas (onde o
// mouse arrastou) → normalizado 0–1 (o que é salvo, ver mapa-zonas.js) →
// pixel de novo (pra redesenhar, já que o canvas pode ter sido
// redimensionado desde a última vez — paraPixels multiplica de volta pela
// largura/altura ATUAIS do canvas, não a de quando a zona foi criada).
// Nunca se guarda pixel bruto em `zonas` — só o resultado de
// paraNormalizado(retanguloPx) — exatamente pra essa reconversão em
// desenharTudo funcionar mesmo que a imagem mude de escala.
//
// PASSO 2 — por que um limite de 8px em vez de zero pra distinguir
// "arrastou" de "clicou sem querer". A mão humana não solta o mouse
// exatamente onde apertou; um clique simples ainda produz um `mousedown`
// e `mouseup` com uns poucos pixels de diferença. Sem esse limiar, um
// clique acidental abriria o formulário de nova zona com um retângulo de
// área quase nula — pior ainda, validarZona já rejeitaria isso mais
// abaixo no fluxo, mas só depois de a pessoa preencher o formulário.
// Cortar aqui, antes de abrir o formulário, poupa esse ciclo inteiro.

import { TIPOS_ZONA, RETULO_TIPO_ZONA, validarZona, criarZona, renumerarZonas } from "./mapa-zonas.js";

const LARGURA_MAXIMA_CANVAS = 640;

// O "soltar o mouse" precisa ouvir a janela inteira (o arrasto pode terminar
// fora do canvas), mas cada nova montagem da tela — reabrir a fase 00, ou
// trocar de foto na mesma visita — não pode empilhar um listener novo em
// cima do antigo. Guardado fora de montarMapaZonas porque o módulo é
// carregado uma vez só; a variável sobrevive entre montagens.
let mouseupHandlerAtivo = null;

// container: elemento onde a ferramenta é desenhada.
// obterDossie: () => dossiê atual ou null.
// onGravar: (dadosMapaDeZonas) => void — grava a versão em "mapaDeZonas" e re-renderiza.
export function montarMapaZonas(container, { obterDossie, onGravar }) {
  container.innerHTML = `
    <div class="row">
      <label class="act secondary" style="cursor:pointer">
        Escolher foto/frame da bancada
        <input type="file" id="mapaArquivo" accept="image/*" style="display:none">
      </label>
      <span class="mono" id="mapaNomeArquivo"></span>
    </div>
    <div id="mapaArea"></div>`;

  const inputEl = container.querySelector("#mapaArquivo");
  const nomeEl = container.querySelector("#mapaNomeArquivo");
  const areaEl = container.querySelector("#mapaArea");

  let nomeArquivo = null;
  let imagemEl = null;
  let canvasEl = null;
  let zonas = [];
  let arrastando = null; // {x0,y0,x1,y1} em pixels de canvas, durante o drag

  inputEl.addEventListener("change", () => {
    const file = inputEl.files[0];
    inputEl.value = "";
    if (!file) return;
    nomeArquivo = file.name;
    nomeEl.textContent = file.name;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      imagemEl = img;
      zonas = [];
      montarCanvas();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      areaEl.innerHTML = `<div class="status show erro">Não foi possível abrir essa imagem.</div>`;
    };
    img.src = url;
  });

  function montarCanvas() {
    const escala = Math.min(1, LARGURA_MAXIMA_CANVAS / imagemEl.naturalWidth);
    const largura = Math.round(imagemEl.naturalWidth * escala);
    const altura = Math.round(imagemEl.naturalHeight * escala);

    areaEl.innerHTML = `
      <p class="mapa-instrucao">Arraste sobre a imagem para marcar uma zona (escaninho, ferramenta, área de trabalho ou saída).</p>
      <canvas id="mapaCanvas" width="${largura}" height="${altura}"></canvas>
      <div id="mapaFormulario"></div>
      <div id="mapaLista"></div>
      <div class="row" style="margin-top:12px">
        <button class="act" id="mapaGravar" disabled>Gravar no dossiê</button>
        ${!obterDossie() ? '<span class="mono" style="font-size:12px">crie ou carregue um dossiê primeiro</span>' : ""}
      </div>`;

    canvasEl = areaEl.querySelector("#mapaCanvas");
    desenharTudo();

    canvasEl.addEventListener("mousedown", (ev) => {
      const p = posicaoNoCanvas(ev);
      arrastando = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    });
    canvasEl.addEventListener("mousemove", (ev) => {
      if (!arrastando) return;
      const p = posicaoNoCanvas(ev);
      arrastando.x1 = p.x;
      arrastando.y1 = p.y;
      desenharTudo();
    });
    if (mouseupHandlerAtivo) {
      window.removeEventListener("mouseup", mouseupHandlerAtivo);
    }
    mouseupHandlerAtivo = () => {
      if (!arrastando) return;
      const retanguloPx = normalizarArrasto(arrastando);
      arrastando = null;
      if (retanguloPx.largura < 8 || retanguloPx.altura < 8) {
        desenharTudo();
        return; // arrasto minúsculo, provavelmente um clique — ignora
      }
      abrirFormularioNovaZona(retanguloPx);
    };
    window.addEventListener("mouseup", mouseupHandlerAtivo);

    atualizarLista();
    atualizarBotaoGravar();
  }

  function posicaoNoCanvas(ev) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvasEl.width, ev.clientX - rect.left)),
      y: Math.max(0, Math.min(canvasEl.height, ev.clientY - rect.top)),
    };
  }

  function normalizarArrasto(a) {
    return {
      x: Math.min(a.x0, a.x1),
      y: Math.min(a.y0, a.y1),
      largura: Math.abs(a.x1 - a.x0),
      altura: Math.abs(a.y1 - a.y0),
    };
  }

  function paraNormalizado(retanguloPx) {
    return {
      x: Number((retanguloPx.x / canvasEl.width).toFixed(4)),
      y: Number((retanguloPx.y / canvasEl.height).toFixed(4)),
      largura: Number((retanguloPx.largura / canvasEl.width).toFixed(4)),
      altura: Number((retanguloPx.altura / canvasEl.height).toFixed(4)),
    };
  }

  function paraPixels(retangulo) {
    return {
      x: retangulo.x * canvasEl.width,
      y: retangulo.y * canvasEl.height,
      largura: retangulo.largura * canvasEl.width,
      altura: retangulo.altura * canvasEl.height,
    };
  }

  function desenharTudo() {
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(imagemEl, 0, 0, canvasEl.width, canvasEl.height);

    ctx.lineWidth = 2;
    ctx.font = "11px monospace";
    zonas.forEach((zona) => {
      const r = paraPixels(zona.retangulo);
      ctx.strokeStyle = "#E8B004";
      ctx.strokeRect(r.x, r.y, r.largura, r.altura);
      ctx.fillStyle = "rgba(232,176,4,0.85)";
      const rotulo = `${zona.id} ${zona.nomeOficial}`;
      const largTexto = ctx.measureText(rotulo).width + 6;
      ctx.fillRect(r.x, r.y, largTexto, 14);
      ctx.fillStyle = "#14161A";
      ctx.fillText(rotulo, r.x + 3, r.y + 11);
    });

    if (arrastando) {
      const r = normalizarArrasto(arrastando);
      ctx.strokeStyle = "#24425F";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(r.x, r.y, r.largura, r.altura);
      ctx.setLineDash([]);
    }
  }

  function abrirFormularioNovaZona(retanguloPx) {
    const formEl = areaEl.querySelector("#mapaFormulario");
    formEl.innerHTML = `
      <div class="mapa-form">
        <div class="row">
          <input type="text" id="mapaNome" placeholder="Nome oficial (ex.: Escaninho suporte L-32)" style="flex:1 1 240px">
          <input type="text" id="mapaCodigo" placeholder="Código interno (opcional)" style="flex:0 1 160px">
          <select id="mapaTipo">
            ${TIPOS_ZONA.map((t) => `<option value="${t}">${RETULO_TIPO_ZONA[t]}</option>`).join("")}
          </select>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="act" id="mapaAdicionar">Adicionar zona</button>
          <button class="act secondary" id="mapaCancelar">Cancelar</button>
        </div>
        <div id="mapaFormErro"></div>
      </div>`;

    formEl.querySelector("#mapaCancelar").addEventListener("click", () => {
      formEl.innerHTML = "";
      desenharTudo();
    });

    formEl.querySelector("#mapaAdicionar").addEventListener("click", () => {
      const nomeOficial = formEl.querySelector("#mapaNome").value;
      const codigoInterno = formEl.querySelector("#mapaCodigo").value;
      const tipo = formEl.querySelector("#mapaTipo").value;
      const retangulo = paraNormalizado(retanguloPx);

      const { valido, erros } = validarZona({ nomeOficial, tipo, retangulo });
      if (!valido) {
        formEl.querySelector("#mapaFormErro").innerHTML = `<div class="status show erro"><ul>${erros.map((e) => `<li>${e}</li>`).join("")}</ul></div>`;
        return;
      }

      zonas.push(criarZona(zonas.length, { nomeOficial, codigoInterno, tipo, retangulo }));
      formEl.innerHTML = "";
      desenharTudo();
      atualizarLista();
      atualizarBotaoGravar();
    });
  }

  function atualizarLista() {
    const listaEl = areaEl.querySelector("#mapaLista");
    if (zonas.length === 0) {
      listaEl.innerHTML = `<div class="vaziomsg">Nenhuma zona marcada ainda.</div>`;
      return;
    }
    listaEl.innerHTML = `<div class="mapa-lista">${zonas
      .map(
        (z, i) => `<div class="mapa-item">
          <span class="chip mono">${z.id}</span>
          <span class="mapa-item-nome">${z.nomeOficial}${z.codigoInterno ? ` <span class="mono" style="color:var(--ink-soft)">(${z.codigoInterno})</span>` : ""}</span>
          <span class="mono" style="font-size:11px;color:var(--ink-soft)">${RETULO_TIPO_ZONA[z.tipo]}</span>
          <button class="act secondary mapa-remover" data-indice="${i}">Remover</button>
        </div>`
      )
      .join("")}</div>`;

    listaEl.querySelectorAll(".mapa-remover").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.indice);
        zonas = renumerarZonas(zonas.filter((_, idx) => idx !== i));
        desenharTudo();
        atualizarLista();
        atualizarBotaoGravar();
      });
    });
  }

  function atualizarBotaoGravar() {
    const btn = areaEl.querySelector("#mapaGravar");
    btn.disabled = zonas.length === 0 || !obterDossie();
    btn.onclick = () => {
      onGravar({
        frameReferencia: { nomeArquivo },
        dataMapeamento: new Date().toISOString().slice(0, 10),
        zonas,
      });
    };
  }
}
