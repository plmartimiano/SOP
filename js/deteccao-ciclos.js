// Pacote EAP 1.3.5 — Detecção de ciclos e repetições.
// Funções puras: recebem os frames extraídos (com .cinzas, de
// frames-extrator.js) e a curva de movimento (de curva-movimento.js) e
// devolvem os ciclos detectados: início, fim, duração, e os suspeitos
// marcados. A revisão visual com corte arrastável (F04-06 — "a pessoa
// arrasta se estiver errado") não está implementada; é uma tela própria de
// edição interativa, deixada para depois. Aqui só a detecção automática.
//
// PASSO — duas técnicas diferentes, cada uma resolvendo uma metade do
// problema, e o motivo de precisar das duas. Autocorrelação
// (estimarDuracaoCiclo) responde "qual é o período aproximado?" — rápida
// (opera só sobre a curva 1D, já calculada), mas dá um número só, sem
// dizer ONDE cada repetição realmente começa e termina (o ritmo do
// operador varia ciclo a ciclo, então "todo ciclo tem exatamente X
// segundos" seria uma mentira confortável). A matriz de auto-similaridade
// + âncoras (matrizAutoSimilaridade, encontrarAncoras) resolve a segunda
// metade: usa a estimativa de período só como PONTO DE PARTIDA de uma
// janela de busca (± tolerância), e dentro dela procura a repetição de
// verdade mais parecida — encontrando os cortes reais mesmo quando o
// ritmo varia. detectarCiclos encadeia as duas: sem a primeira (nenhum
// período detectável), a segunda nem roda — não faz sentido procurar
// "onde a repetição está" se não há evidência de que existe repetição.

import { diferencaMediaPixel } from "./curva-movimento.js";

// Autocorrelação normalizada (energia em lag=0 vira 1). Um sinal periódico
// tem picos fortes nos lags que são múltiplos do período — é a base
// matemática do cartão F04-02.
export function autocorrelacao(valores) {
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const centralizados = valores.map((v) => v - media);
  const maxLag = Math.floor(valores.length / 2);
  const resultado = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let soma = 0;
    for (let i = 0; i < valores.length - lag; i++) {
      soma += centralizados[i] * centralizados[i + lag];
    }
    resultado.push(soma);
  }
  const energia = resultado[0] || 1;
  return resultado.map((v) => v / energia);
}

// F04-02: o primeiro pico local da autocorrelação, ignorando os primeiros
// `lagMinimo` passos (aí é só a curva se parecendo com ela mesma deslocada
// de quase nada, não um ciclo de verdade). null quando não há pico claro —
// vídeo sem repetição visível (risco do cartão F04-01: "o vídeo tem só uma
// montagem"), e o programa não deve fingir ter achado um período.
export function estimarDuracaoCiclo(curva, fps = 2, { lagMinimo } = {}) {
  const valores = curva.map((p) => p.valorSuavizado ?? p.valor);
  if (valores.length < 4) return null;
  const minLag = lagMinimo ?? Math.max(2, Math.round(fps));
  const ac = autocorrelacao(valores);
  for (let lag = minLag; lag < ac.length - 1; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0) {
      return { duracaoSegundos: lag / fps, lagEmFrames: lag, confianca: Number(ac[lag].toFixed(3)) };
    }
  }
  return null;
}

// F04-01: matriz[i][j] = diferença média de pixel entre o frame i e o
// frame j (0 = idênticos). Num vídeo repetitivo essa matriz desenha
// diagonais paralelas — cada uma é "este trecho se parece com aquele
// outro, N frames depois".
export function matrizAutoSimilaridade(frames) {
  const n = frames.length;
  const matriz = [];
  for (let i = 0; i < n; i++) {
    const linha = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      linha[j] = i === j ? 0 : diferencaMediaPixel(frames[i].cinzas, frames[j].cinzas);
    }
    matriz.push(linha);
  }
  return matriz;
}

// F04-03: a partir do frame 0 como marco zero (a fase 02 ainda não corta
// o "antes" do primeiro ciclo de verdade — ver F02-04, não implementado —
// então por ora assume-se que o vídeo já começa num início de ciclo),
// procura a repetição mais parecida dentro de uma janela ao redor da
// duração de ciclo estimada, tolerando até 30% de variação de ritmo
// (risco anotado no plano: "o operador varia o ritmo").
export function encontrarAncoras(matriz, totalFrames, duracaoCicloEmFrames, { tolerancia = 0.3 } = {}) {
  if (totalFrames === 0) return [];
  const ancoras = [0];
  let ultima = 0;
  const passoMinimo = Math.max(1, Math.round(duracaoCicloEmFrames * (1 - tolerancia)));
  const passoMaximo = Math.max(passoMinimo, Math.round(duracaoCicloEmFrames * (1 + tolerancia)));

  while (ultima + passoMinimo <= totalFrames - 1) {
    const inicioJanela = ultima + passoMinimo;
    const fimJanela = Math.min(totalFrames - 1, ultima + passoMaximo);
    let melhorIndice = null;
    let melhorValor = Infinity;
    for (let j = inicioJanela; j <= fimJanela; j++) {
      if (matriz[0][j] < melhorValor) {
        melhorValor = matriz[0][j];
        melhorIndice = j;
      }
    }
    if (melhorIndice === null) break;
    ancoras.push(melhorIndice);
    ultima = melhorIndice;
  }
  return ancoras;
}

// F04-04 + F04-05: corta entre âncoras consecutivas e marca o primeiro e o
// último ciclo como suspeitos. Só sinaliza — decidir se um ciclo suspeito
// entra ou não no consenso é responsabilidade de uma fase futura (07).
export function cortarCiclos(frames, ancoras) {
  const ciclos = [];
  for (let i = 0; i < ancoras.length - 1; i++) {
    const inicioIndice = ancoras[i];
    const fimIndice = ancoras[i + 1];
    ciclos.push({
      indice: i + 1,
      inicioSegundos: frames[inicioIndice].tempoSegundos,
      fimSegundos: frames[fimIndice].tempoSegundos,
      duracaoSegundos: Number((frames[fimIndice].tempoSegundos - frames[inicioIndice].tempoSegundos).toFixed(3)),
      suspeito: false,
    });
  }

  if (ciclos.length === 1) {
    ciclos[0].suspeito = true;
    ciclos[0].motivoSuspeita = "único ciclo detectado — sem repetição para comparar";
  } else if (ciclos.length >= 2) {
    ciclos[0].suspeito = true;
    ciclos[0].motivoSuspeita = "primeiro ciclo — ritmo de partida costuma ser mais lento";
    const ultimoCiclo = ciclos[ciclos.length - 1];
    ultimoCiclo.suspeito = true;
    ultimoCiclo.motivoSuspeita = "último ciclo — pode estar interrompido pelo fim do vídeo";
  }

  return ciclos;
}

// Orquestra tudo: da curva de movimento + frames aos ciclos cortados.
// Sem período claro, devolve ciclos: [] em vez de inventar um corte —
// o dossiê precisa saber que a detecção falhou, não receber um ciclo
// fictício do tamanho do vídeo inteiro.
export function detectarCiclos(frames, curvaMovimento, fps = 2) {
  const estimativa = estimarDuracaoCiclo(curvaMovimento, fps);
  const matriz = matrizAutoSimilaridade(frames);
  if (!estimativa) {
    return { ciclos: [], estimativa: null, ancoras: [], matriz };
  }
  const ancoras = encontrarAncoras(matriz, frames.length, estimativa.lagEmFrames);
  const ciclos = cortarCiclos(frames, ancoras);
  return { ciclos, estimativa, ancoras, matriz };
}
