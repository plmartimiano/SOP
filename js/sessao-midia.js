// Estado de sessão: coisas grandes demais para o dossiê (o arquivo de vídeo,
// as miniaturas de frame) e que por isso vivem só na memória da aba atual —
// mesmo espírito do risco registrado em F01-01 ("guarde as imagens à parte
// e no JSON só as referências e os tempos"). Recarregar a página perde isso;
// é o mesmo comportamento que o rodapé do plano original já assume ("quadro
// de leitura, não sistema de gestão").
//
// PASSO — por que três variáveis de módulo soltas, e não um objeto de
// estado (ou uma "classe Sessao"). O projeto não usa nenhum framework de
// estado (Redux, signals, etc.) — é DOM manipulado direto por cada
// fase-ui.js. Um módulo ES importado sempre devolve a MESMA instância em
// qualquer lugar do app (é assim que módulos funcionam nativamente),
// então três `let` no topo do arquivo já dão exatamente a garantia de
// "um valor só, compartilhado por toda a aba" que uma classe singleton
// daria, com menos código pra ler. O preço dessa simplicidade é este
// módulo ser stateful e mutável — aceitável porque o estado que ele
// guarda É, por definição, coisa que só existe nesta sessão do
// navegador; não faria sentido fingir imutabilidade aqui.
//
// Este módulo é consultado (obterVideoAprovado, obterFramesExtraidos,
// obterImagensGeradas) por toda fase de 03 a 15 que depende de mídia
// ainda estar na aba — e é exatamente a ausência desses dados aqui
// (tudo `null`) que produz as mensagens "recarregue e reprocesse" /
// "gere de novo nesta sessão" espalhadas pelas telas.

let videoAprovado = null; // { file, dados } — o File do MP4 aprovado na fase 02
let framesExtraidos = null; // [{ indice, tempoSegundos, miniaturaDataUrl }] — fase 03
let imagensGeradas = null; // Map "chave do item" -> { imagemBase64, mimeType } — fase 13

export function definirVideoAprovado(file, dados) {
  videoAprovado = { file, dados };
  framesExtraidos = null; // vídeo novo invalida frames extraídos do vídeo anterior
}

export function obterVideoAprovado() {
  return videoAprovado;
}

export function definirFramesExtraidos(frames) {
  framesExtraidos = frames;
}

export function obterFramesExtraidos() {
  return framesExtraidos;
}

// As imagens em si (base64, potencialmente vários MB cada, 19 por dossiê
// no plano atual — 1 quadro-mestre + 6 passos × 3 variações) nunca entram
// no dossiê JSON, mesmo risco do vídeo (F01-01: "um dossiê de 300 MB
// trava o navegador"). O dossiê grava só metadados (seção "imagens" — ver
// js/fase13-ui.js); a imagem de verdade fica aqui, na sessão.
export function definirImagensGeradas(mapaImagens) {
  imagensGeradas = mapaImagens;
}

export function obterImagensGeradas() {
  return imagensGeradas;
}

// Chamado sempre que o dossiê muda (novo, exemplo, importado) — o vídeo em
// memória pertence à sessão de ingestão anterior, não ao dossiê que acabou
// de entrar.
export function limparSessaoMidia() {
  videoAprovado = null;
  framesExtraidos = null;
  imagensGeradas = null;
}
