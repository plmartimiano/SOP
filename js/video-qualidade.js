// Pacote EAP 1.3.2 — Triagem de qualidade (regra pura, sem DOM).
// Recebe os metadados já extraídos de um vídeo e decide se ele serve,
// explicando o motivo em português (F02-02: "recusar com uma frase que o
// operador entende"). Separado de video-metadados.js para poder ser testado
// sem navegador.

const PADRAO = {
  resolucaoMinima: 720, // lado menor da imagem, cobre horizontal e vertical
  fpsMinimo: 20,
  duracaoMinimaSanidade: 2, // segundos — só pega arquivo claramente errado
  luminanciaMinima: 40, // 0–255
};

export function triarQualidade(metadados, opcoes = {}) {
  const cfg = { ...PADRAO, ...opcoes };
  const motivos = [];
  const avisos = [];

  const ladoMenor = Math.min(metadados.resolucao.largura, metadados.resolucao.altura);
  if (ladoMenor < cfg.resolucaoMinima) {
    motivos.push(
      `Resolução muito baixa (${metadados.resolucao.largura}×${metadados.resolucao.altura}). Regrave em pelo menos 720p.`
    );
  }

  if (metadados.fps === null) {
    avisos.push(`Não foi possível medir os quadros por segundo neste navegador — a checagem de fps mínimo (${cfg.fpsMinimo}fps) ficou pulada.`);
  } else if (metadados.fps < cfg.fpsMinimo) {
    motivos.push(`Taxa de quadros baixa (${metadados.fps}fps). Regrave a pelo menos ${cfg.fpsMinimo}fps.`);
  }

  if (metadados.duracaoSegundos < cfg.duracaoMinimaSanidade) {
    motivos.push(`Vídeo muito curto (${metadados.duracaoSegundos.toFixed(1)}s). Confira se é o arquivo certo.`);
  }

  if (metadados.luminanciaMedia === null) {
    avisos.push("Não foi possível medir a luminância do vídeo.");
  } else if (metadados.luminanciaMedia < cfg.luminanciaMinima) {
    motivos.push(`Vídeo aparenta estar escuro demais (luminância média ${metadados.luminanciaMedia.toFixed(0)}/255). Regrave com mais luz na bancada.`);
  }

  // A regra do plano (F02-02) recusa vídeo "mais curto que 3 ciclos", mas
  // isso só dá para medir depois que a detecção de ciclos existir (pacote
  // 1.3.5). Aqui só a sanidade básica de duração acima é aplicada — não
  // fingimos medir ciclos que ainda não sabemos contar.
  avisos.push("A checagem de duração mínima por número de ciclos (F02-02) depende da detecção de ciclos (pacote 1.3.5, ainda não implementado).");

  return { aprovado: motivos.length === 0, motivos, avisos };
}
