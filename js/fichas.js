// Pacote EAP 1.6 — a ficha de cada passo (fase 10, "o documento que vai
// virar desenho"). Entra: os 6 passos que a fase 09 consolidou + o núcleo
// do procedimento (fase 07, pra reencontrar mãos/ferramenta/peças/tempo
// de cada ação original que foi fundida em cada passo) + o índice do
// ciclo exemplar (a fase 07 já escolheu qual ciclo é o mais
// representativo — é dele que tiramos os tempos e leituras de cada
// ficha, quando disponíveis).
//
// Nem todo campo da ficha tem a mesma origem de confiança. Mãos,
// ferramenta, peças e o trecho de vídeo vêm direto da leitura semântica
// já registrada no dossiê — dado real, sem invenção. Critério de
// conclusão é uma frase derivada (presença ou não de uma verificação de
// conferência no passo), não uma leitura de verdade. Risco não tem
// nenhuma fonte de dado em todo o pipeline até aqui — fica marcado como
// não avaliado, para a mesa de validação humana (fase 11) preencher,
// nunca inventado aqui. Estado do produto antes/depois é a lista
// acumulada de peças instaladas até aquele ponto — uma aproximação por
// acúmulo de componentes, não uma descrição visual do produto.

const RISCO_NAO_AVALIADO =
  "Não avaliado automaticamente — sem fonte de dado de risco no pipeline até aqui. Revisar na fase 11 (mesa de validação humana).";

function localizarFatia(entrada, cicloExemplarIndice) {
  if (!entrada) return { fatia: null, usouCicloAlternativo: false };
  const doExemplar = entrada.porCiclo[cicloExemplarIndice];
  if (doExemplar) return { fatia: doExemplar, usouCicloAlternativo: false };
  const alternativa = Object.values(entrada.porCiclo).find(Boolean);
  return { fatia: alternativa || null, usouCicloAlternativo: !!alternativa };
}

function distintos(lista) {
  return [...new Set(lista.filter((v) => v !== null && v !== undefined))];
}

// passos: reconhecimento->passos como a fase 09 gravou ({numero, titulo,
// duracaoMediaSegundos, duvidosa, origem}). nucleo: reconhecimento.nucleo
// (fase 07). cicloExemplarIndice: reconhecimento.cicloExemplarIndice
// (fase 07).
export function gerarFichas(passos, nucleo, cicloExemplarIndice) {
  // BUG CORRIGIDO (achado numa revisão de código, não num teste): dois
  // rótulos de núcleo podem ser a MESMA string — por exemplo duas
  // verificações de conferência sem leitura determinada viram
  // literalmente "pausa_conferencia" as duas (ver causaDaEntrada em
  // agrupamento.js, usada como `.acao` quando a leitura não identificou
  // um verbo). Um Map simples de string→entrada perderia a segunda
  // ocorrência (a última sobrescreve a primeira no Map), e todo passo
  // cujo rótulo colidisse pegaria silenciosamente os dados (mãos,
  // ferramenta, TRECHO DE VÍDEO) da entrada errada — grave porque é
  // exatamente esse trecho de vídeo que a fase 11 mostra como barreira
  // de segurança. Como `nucleo` está em ordem cronológica e cada label
  // de `origem` é consumido na mesma ordem em que aparece nele
  // (fundirAteSeis só funde vizinhos, nunca reordena — ver
  // js/agrupamento.js), uma FILA por rótulo, consumida em ordem,
  // resolve a colisão sem ambiguidade: a primeira "pausa_conferencia"
  // do núcleo vai para a primeira ocorrência do rótulo em `origem`, a
  // segunda para a segunda, e assim por diante.
  const filasPorAcao = new Map();
  for (const entrada of nucleo) {
    if (!filasPorAcao.has(entrada.acao)) filasPorAcao.set(entrada.acao, []);
    filasPorAcao.get(entrada.acao).push(entrada);
  }
  function consumirEntrada(label) {
    const fila = filasPorAcao.get(label);
    return fila && fila.length ? fila.shift() : undefined;
  }

  const pecasInstaladas = new Set();

  return passos.map((passo) => {
    const resolucoes = passo.origem.map((label) => localizarFatia(consumirEntrada(label), cicloExemplarIndice));
    const origemIncompleta = resolucoes.some((r) => !r.fatia);
    const usouCicloAlternativo = resolucoes.some((r) => r.usouCicloAlternativo);
    const fatias = resolucoes.map((r) => r.fatia).filter(Boolean);

    const leiturasValidas = fatias.map((f) => f.leituraSemantica).filter((l) => l && !l.indeterminado);
    const maos = distintos(leiturasValidas.map((l) => l.mao));
    const ferramentas = distintos(leiturasValidas.map((l) => l.ferramenta).filter((f) => f && f !== "nenhuma"));
    const pecas = distintos(
      fatias
        .filter((f) => f.causa === "componente_novo" || f.causa === "combinada")
        .map((f) => (f.leituraSemantica && !f.leituraSemantica.indeterminado ? f.leituraSemantica.objeto : null))
    );

    const temVerificacao = fatias.some((f) => f.causa === "pausa_conferencia");
    const criterioConclusao = temVerificacao
      ? "Verificado por conferência visual — este passo inclui uma ação de teste registrada."
      : `Concluído ao finalizar a última ação do passo ("${passo.origem[passo.origem.length - 1]}").`;

    const tempos = fatias
      .flatMap((f) => [f.inicioSegundos, f.fimSegundos])
      .filter((t) => typeof t === "number");
    const trechoVideo = tempos.length ? { inicioSegundos: Math.min(...tempos), fimSegundos: Math.max(...tempos) } : null;

    const estadoProdutoAntes = [...pecasInstaladas];
    pecas.forEach((p) => pecasInstaladas.add(p));
    const estadoProdutoDepois = [...pecasInstaladas];

    return {
      numero: passo.numero,
      titulo: passo.titulo,
      duracaoMediaSegundos: passo.duracaoMediaSegundos,
      duvidosa: passo.duvidosa,
      origem: passo.origem,
      maos: maos.length ? maos : ["não identificada"],
      ferramentas,
      pecas,
      trechoVideo,
      criterioConclusao,
      risco: RISCO_NAO_AVALIADO,
      estadoProdutoAntes,
      estadoProdutoDepois,
      origemIncompleta,
      usouCicloAlternativo,
    };
  });
}

// Gate da fase 10: "nenhum campo obrigatório está vazio". maos/ferramentas
// /pecas são listas — lista vazia é um dado válido (nenhuma ferramenta
// usada neste passo), não um campo "vazio" no sentido do gate. Só os
// campos de texto/objeto abaixo é que não podem faltar de verdade.
export function verificarCamposObrigatorios(ficha) {
  const faltando = [];
  if (!ficha.titulo) faltando.push("titulo");
  if (!ficha.criterioConclusao) faltando.push("criterioConclusao");
  if (!ficha.risco) faltando.push("risco");
  if (!ficha.trechoVideo) faltando.push("trechoVideo");
  return faltando;
}
