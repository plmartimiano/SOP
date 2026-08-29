// Fase 15 — diagramação e entrega. Lógica pura: monta a estrutura de cada
// página do SOP (imagem + texto sobreposto + cabeçalho) a partir das
// fichas aprovadas (fase 11) e das imagens geradas (fase 13). O desenho
// em si (canvas, impressão) é DOM e mora em js/fase15-ui.js — este
// módulo só decide O QUE vai em cada página e QUANTO espaço cada parte
// ocupa, sem tocar em nada visual.
//
// Mesma decisão de imagem "oficial" já tomada na fase 14, pela mesma
// razão (ainda não existe tela de escolha manual entre as 3 variações de
// cada passo — lacuna registrada no README): usa sempre a variação-âncora.
// secaoDossie desta fase é `null` em fases.js — diferente de todas as
// fases anteriores, o resultado aqui é um ARQUIVO DE SAÍDA (PNG por
// página, PDF via impressão), não um dado de processo que caiba numa das
// dez seções do dossiê. Não há "gravar no dossiê" nesta fase.

export function montarPaginasSOP(fichasAprovadas, imagensPorPasso, { nomeEstacao, versaoDossie } = {}) {
  const cabecalho = {
    nomeEstacao: nomeEstacao || "(sem nome)",
    dataGeracao: new Date().toISOString(),
    versaoDossie: versaoDossie ?? null,
  };

  const paginas = fichasAprovadas.map((f) => {
    const imagem = imagensPorPasso[f.numero];
    return {
      numero: f.numero,
      titulo: f.titulo,
      imagemBase64: imagem ? imagem.imagemBase64 : null,
      mimeType: imagem ? imagem.mimeType : null,
      temImagem: !!imagem,
      textoSobreposto: {
        maos: f.maos,
        ferramentas: f.ferramentas,
        pecas: f.pecas,
        criterioConclusao: f.criterioConclusao,
        risco: f.risco,
      },
    };
  });

  return { cabecalho, paginas };
}

// Gate F15 ("um operador que nunca viu a estação executa a montagem só
// com o SOP na mão") não é automatizável — exigiria um teste de usuário
// de verdade. O que dá pra checar em código é a condição NECESSÁRIA (não
// suficiente): nenhuma página pode faltar imagem — um SOP com um passo
// sem desenho não serve pra ninguém executar nada.
export function verificarProntoParaEntrega(paginas) {
  const semImagem = paginas.filter((p) => !p.temImagem).map((p) => p.numero);
  return { pronto: semImagem.length === 0, paginasSemImagem: semImagem };
}

// "80% visuais e 20% escritos, no mesmo papel" (F15, subtítulo do
// cartão) — aqui isso é uma proporção de LAYOUT exata e mensurável, não
// uma estimativa como os "70%" da fase 12: a imagem sempre ocupa
// exatamente 80% da altura da página; a faixa de texto (cabeçalho +
// mãos/ferramenta/peças/critério/risco) ocupa os 20% restantes.
export function calcularLayout(larguraPx, alturaPx) {
  const alturaImagem = Math.round(alturaPx * 0.8);
  const alturaTexto = alturaPx - alturaImagem;
  return { larguraPx, alturaPx, alturaImagem, alturaTexto, proporcaoImagem: alturaImagem / alturaPx };
}
