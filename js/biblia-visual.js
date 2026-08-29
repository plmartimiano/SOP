// Bíblia visual — versão simplificada, mesmo espírito de
// vocabulario-verbos.js: uma constante fixa de estilo de ilustração, não
// uma tela de edição nem um recurso reusável de verdade entre vídeos. A
// bíblia visual de verdade é recurso da ESTAÇÃO (biblioteca de estações,
// pacote 1.8.4, ainda não construída, ver F16-06 em fases.js) — até lá,
// todo dossiê usa este mesmo estilo fixo, definido aqui em código, nunca
// escolhido pela pessoa.

export const ESTILO_VISUAL = {
  tecnica: "ilustração técnica vetorial, linha limpa, sombreamento plano, sem textura fotográfica",
  paleta: "paleta neutra (cinzas e azul-aço) na bancada e no fundo, com a peça em foco de cada passo destacada em cor viva",
  angulo: "vista de cima em ângulo fixo de 3/4, câmera parada — o mesmo enquadramento em todos os quadros, do quadro-mestre ao sexto passo",
  fundo: "fundo liso, só a bancada e o que está explicitamente descrito no passo — nada de decoração, nada de elemento não mencionado",
};

// Junta o estilo acima numa frase única, pronta pra entrar na camada
// compartilhada do prompt (js/prompts.js).
export function descreverEstiloVisual() {
  return `Estilo: ${ESTILO_VISUAL.tecnica}. ${ESTILO_VISUAL.paleta}. ${ESTILO_VISUAL.angulo}. ${ESTILO_VISUAL.fundo}.`;
}
