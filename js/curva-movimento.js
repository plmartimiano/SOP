// Pacote EAP 1.3.4 — Curvas de movimento (geral e por zona).
// Funções puras, sem DOM: recebem os valores de cinza de cada frame
// (capturados em frames-extrator.js) e devolvem a série temporal de
// movimento. Picos são ação, vales são pausa (F03-03). A curva por zona
// (F03-04) faz a mesma conta só nos pixels dentro do retângulo de cada
// zona do mapa de zonas (mapa-zonas.js, pacote 1.1.2) — é o que revela
// pra qual escaninho a mão foi, sem custo nenhum de modelo.

// Diferença média absoluta de pixel entre cada par de frames vizinhos,
// 0–255, olhando só os índices dados (ou o frame inteiro se `indices` for
// omitido). O primeiro frame não tem "anterior", então a curva tem um
// ponto a menos que a lista de frames.
function serieDiferenca(frames, indices) {
  const pontos = [];
  for (let i = 1; i < frames.length; i++) {
    const anterior = frames[i - 1].cinzas;
    const atual = frames[i].cinzas;
    let soma = 0;
    if (!indices) {
      for (let p = 0; p < atual.length; p++) soma += Math.abs(atual[p] - anterior[p]);
      pontos.push({ tempoSegundos: frames[i].tempoSegundos, valor: soma / atual.length });
    } else {
      for (const p of indices) soma += Math.abs(atual[p] - anterior[p]);
      pontos.push({ tempoSegundos: frames[i].tempoSegundos, valor: indices.length ? soma / indices.length : 0 });
    }
  }
  return pontos;
}

export function calcularCurvaMovimento(frames) {
  return serieDiferenca(frames);
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

// Quais posições da grade de `lado`×`lado` (a mesma grade das miniaturas
// 64×64) caem dentro do retângulo normalizado (0–1) da zona. Usa o centro
// de cada célula, não o canto — uma zona finíssima ainda pega a célula que
// ela cobre na maior parte.
export function indicesDaZona(zona, lado = 64) {
  const { x, y, largura, altura } = zona.retangulo;
  const indices = [];
  for (let r = 0; r < lado; r++) {
    const cy = (r + 0.5) / lado;
    if (cy < y || cy > y + altura) continue;
    for (let c = 0; c < lado; c++) {
      const cx = (c + 0.5) / lado;
      if (cx < x || cx > x + largura) continue;
      indices.push(r * lado + c);
    }
  }
  return indices;
}

// { [zonaId]: [{tempoSegundos, valor}, ...] } — uma curva crua por zona.
export function calcularCurvaPorZona(frames, zonas, lado = 64) {
  const porZona = {};
  for (const zona of zonas) {
    porZona[zona.id] = serieDiferenca(frames, indicesDaZona(zona, lado));
  }
  return porZona;
}

// Mesmo formato de montarCurva, mas uma entrada por zona.
export function montarCurvaPorZona(frames, zonas, tamanhoJanela = 3, lado = 64) {
  const cruaPorZona = calcularCurvaPorZona(frames, zonas, lado);
  const resultado = {};
  for (const zona of zonas) {
    const crua = cruaPorZona[zona.id];
    const suave = suavizarCurva(crua, tamanhoJanela);
    resultado[zona.id] = crua.map((p, i) => ({
      tempoSegundos: p.tempoSegundos,
      valorCru: Number(p.valor.toFixed(2)),
      valorSuavizado: Number(suave[i].valor.toFixed(2)),
    }));
  }
  return resultado;
}
