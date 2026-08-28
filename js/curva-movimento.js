// Pacote EAP 1.3.4 — Curvas de movimento (parte "curva geral" — ver nota
// sobre a curva por zona no fim do arquivo).
// Funções puras, sem DOM: recebem os valores de cinza de cada frame
// (capturados em frames-extrator.js) e devolvem a série temporal de
// movimento. Picos são ação, vales são pausa (F03-03).

// Diferença média absoluta de pixel entre cada par de frames vizinhos,
// 0–255. O primeiro frame não tem "anterior", então a curva tem um ponto a
// menos que a lista de frames.
export function calcularCurvaMovimento(frames) {
  const pontos = [];
  for (let i = 1; i < frames.length; i++) {
    const anterior = frames[i - 1].cinzas;
    const atual = frames[i].cinzas;
    let soma = 0;
    for (let p = 0; p < atual.length; p++) {
      soma += Math.abs(atual[p] - anterior[p]);
    }
    pontos.push({ tempoSegundos: frames[i].tempoSegundos, valor: soma / atual.length });
  }
  return pontos;
}

// Média móvel curta (F03-05): apaga ruído de compressão e tremidas mínimas
// sem apagar pausas reais — janela pequena de propósito, não uma média de
// todo o vídeo.
export function suavizarCurva(pontos, tamanhoJanela = 3) {
  return pontos.map((_, i) => {
    const inicio = Math.max(0, i - Math.floor(tamanhoJanela / 2));
    const fim = Math.min(pontos.length, i + Math.ceil(tamanhoJanela / 2));
    const fatia = pontos.slice(inicio, fim);
    const media = fatia.reduce((soma, p) => soma + p.valor, 0) / fatia.length;
    return { tempoSegundos: pontos[i].tempoSegundos, valor: media };
  });
}

// Combina crua + suavizada num único array (mais fácil de desenhar e de
// gravar no dossiê sem duplicar os tempos).
export function montarCurva(frames, tamanhoJanela = 3) {
  const crua = calcularCurvaMovimento(frames);
  const suave = suavizarCurva(crua, tamanhoJanela);
  return crua.map((p, i) => ({
    tempoSegundos: p.tempoSegundos,
    valorCru: Number(p.valor.toFixed(2)),
    valorSuavizado: Number(suave[i].valor.toFixed(2)),
  }));
}

// A curva POR ZONA (F03-04) precisa da geometria das zonas da bancada
// (mapa de zonas, cartão F00-03 / pacote EAP 1.1.2) para saber, dentro de
// cada frame, quais pixels pertencem a qual escaninho. Esse pacote ainda
// não existe — inventar zonas aqui seria fabricar dado que o vídeo não deu.
// Por isso só a curva geral está implementada; quando 1.1.2 existir, esta
// função ganha um parâmetro de zonas e passa a fatiar `cinzas` por região
// em vez de somar o frame inteiro.
export const CURVA_POR_ZONA_PENDENTE = "depende do mapa de zonas (pacote 1.1.2), ainda não implementado";
