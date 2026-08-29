// Controle de tela da fase 15 (Diagramação e entrega) — a última fase
// "padrao" (sem custo) do fluxo principal, e a única sem seção própria no
// dossiê (secaoDossie: null em fases.js): o resultado aqui é um ARQUIVO
// DE SAÍDA (PNG por página, PDF via impressão do navegador), não um dado
// de processo. Não há "gravar no dossiê" nesta fase — só baixar.
//
// Mesma limitação de sessão herdada das fases 13/14: as imagens só
// existem na aba onde foram geradas. Sem biblioteca de PDF (o projeto é
// sem build, sem dependência externa, e este ambiente não tem rede pra
// baixar uma) — o "PDF" é o caminho nativo do navegador: uma área de
// impressão com CSS @media print, e window.print() deixa a pessoa
// escolher "Salvar como PDF" no diálogo do sistema. Deliberado, não uma
// simplificação escondida.

import { montarPaginasSOP, verificarProntoParaEntrega, calcularLayout } from "./diagramacao.js";

const LARGURA_PAGINA = 850; // aproxima A4 a ~100dpi
const ALTURA_PAGINA = 1100;

// container: elemento onde a ferramenta é desenhada.
// fichasAprovadas: aprovacoes.fichas (dossiê, versão atual) — cada uma com .final — ou null.
// imagensGeradas: Map chaveUnicaDoItem -> {imagemBase64, mimeType} (sessao-midia.js) ou null.
// nomeEstacao, versaoDossie: para o cabeçalho.
export function montarDiagramacao(container, { fichasAprovadas, imagensGeradas, nomeEstacao, versaoDossie }) {
  if (!fichasAprovadas || fichasAprovadas.length === 0) {
    container.innerHTML = `<div class="vaziomsg">Aprove as fichas na fase 11 antes de diagramar o SOP.</div>`;
    return;
  }
  if (!imagensGeradas) {
    container.innerHTML = `<div class="vaziomsg">As imagens da fase 13 não estão mais nesta sessão (a página foi recarregada, ou as imagens foram geradas em outra aba/sessão). Volte à fase 13 e gere de novo nesta mesma sessão.</div>`;
    return;
  }

  const fichasFinais = fichasAprovadas.map((f) => f.final);
  const imagensPorPasso = {};
  for (const f of fichasFinais) {
    const img = imagensGeradas.get(`passo:${f.numero}:1`);
    if (img) imagensPorPasso[f.numero] = img;
  }

  const { cabecalho, paginas } = montarPaginasSOP(fichasFinais, imagensPorPasso, { nomeEstacao, versaoDossie });
  const { pronto, paginasSemImagem } = verificarProntoParaEntrega(paginas);

  container.innerHTML = `
    ${
      pronto
        ? `<div class="status show ok">${paginas.length} páginas prontas — 80% imagem, 20% texto sobreposto em cada uma.</div>`
        : `<div class="status show erro">Faltam imagens dos passos ${paginasSemImagem.join(", ")} — volte à fase 13 para gerá-las antes de exportar.</div>`
    }
    <div class="fichas-grid" id="paginasSOP">
      ${paginas.map((p) => `<div class="ficha-card"><h4>Passo ${p.numero} — ${p.titulo}</h4>
        <canvas id="canvas-pagina-${p.numero}" width="${LARGURA_PAGINA}" height="${ALTURA_PAGINA}" style="width:100%;border:1px solid var(--line)"></canvas>
        <div class="row" style="margin-top:8px"><button class="act" id="baixar-pagina-${p.numero}">Baixar PNG</button></div>
      </div>`).join("")}
    </div>
    <div class="row" style="margin-top:12px">
      <button class="act" id="imprimirBotao">Imprimir / salvar como PDF</button>
    </div>
    <div id="areaImpressao" class="impressao-sop"></div>`;

  for (const pagina of paginas) {
    desenharPaginaCanvas(container.querySelector(`#canvas-pagina-${pagina.numero}`), pagina, cabecalho);
    container.querySelector(`#baixar-pagina-${pagina.numero}`).addEventListener("click", () => {
      baixarCanvasComoPng(container.querySelector(`#canvas-pagina-${pagina.numero}`), `sop-passo-${pagina.numero}.png`);
    });
  }

  montarAreaImpressao(container.querySelector("#areaImpressao"), paginas, cabecalho);
  container.querySelector("#imprimirBotao").addEventListener("click", () => window.print());
}

function desenharPaginaCanvas(canvas, pagina, cabecalho) {
  const ctx = canvas.getContext("2d");
  const layout = calcularLayout(canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  function desenharTexto() {
    const topoTexto = layout.alturaImagem;
    ctx.fillStyle = "#14161A";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`${cabecalho.nomeEstacao} — Passo ${pagina.numero}: ${pagina.titulo}`, 16, topoTexto + 22);

    ctx.font = "12px sans-serif";
    const t = pagina.textoSobreposto;
    const linhas = [
      `Mãos: ${(t.maos || []).join(", ") || "—"}   Ferramenta: ${(t.ferramentas || []).join(", ") || "nenhuma"}   Peças: ${(t.pecas || []).join(", ") || "—"}`,
      `Conclusão: ${t.criterioConclusao || ""}`,
      `Risco: ${t.risco || ""}`,
    ];
    linhas.forEach((linha, i) => ctx.fillText(linha, 16, topoTexto + 44 + i * 18));
  }

  if (pagina.temImagem) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, layout.alturaImagem);
      desenharTexto();
    };
    img.src = `data:${pagina.mimeType || "image/png"};base64,${pagina.imagemBase64}`;
  } else {
    ctx.fillStyle = "#C6C8C1";
    ctx.fillRect(0, 0, canvas.width, layout.alturaImagem);
    ctx.fillStyle = "#565A60";
    ctx.font = "16px sans-serif";
    ctx.fillText("(sem imagem gerada nesta sessão)", 16, layout.alturaImagem / 2);
    desenharTexto();
  }
}

function baixarCanvasComoPng(canvas, nomeArquivo) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}

function montarAreaImpressao(el, paginas, cabecalho) {
  el.innerHTML = paginas
    .map(
      (p) => `<div class="impressao-pagina">
        ${p.temImagem ? `<img src="data:${p.mimeType || "image/png"};base64,${p.imagemBase64}" alt="">` : `<div class="impressao-sem-imagem">sem imagem gerada nesta sessão</div>`}
        <div class="impressao-texto">
          <h4>${cabecalho.nomeEstacao} — Passo ${p.numero}: ${p.titulo}</h4>
          <p>Mãos: ${(p.textoSobreposto.maos || []).join(", ") || "—"} · Ferramenta: ${(p.textoSobreposto.ferramentas || []).join(", ") || "nenhuma"} · Peças: ${(p.textoSobreposto.pecas || []).join(", ") || "—"}</p>
          <p>Conclusão: ${p.textoSobreposto.criterioConclusao || ""}</p>
          <p>Risco: ${p.textoSobreposto.risco || ""}</p>
        </div>
      </div>`
    )
    .join("");
}
