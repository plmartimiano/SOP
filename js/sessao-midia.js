// Estado de sessão: coisas grandes demais para o dossiê (o arquivo de vídeo,
// as miniaturas de frame) e que por isso vivem só na memória da aba atual —
// mesmo espírito do risco registrado em F01-01 ("guarde as imagens à parte
// e no JSON só as referências e os tempos"). Recarregar a página perde isso;
// é o mesmo comportamento que o rodapé do plano original já assume ("quadro
// de leitura, não sistema de gestão").

let videoAprovado = null; // { file, dados } — o File do MP4 aprovado na fase 02
let framesExtraidos = null; // [{ indice, tempoSegundos, miniaturaDataUrl }] — fase 03

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

// Chamado sempre que o dossiê muda (novo, exemplo, importado) — o vídeo em
// memória pertence à sessão de ingestão anterior, não ao dossiê que acabou
// de entrar.
export function limparSessaoMidia() {
  videoAprovado = null;
  framesExtraidos = null;
}
