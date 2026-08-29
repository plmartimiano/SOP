// Pacotes EAP 1.4.4 (alinhamento entre ciclos) + 1.4.5 (núcleo do
// procedimento) — cartões F07-01 a F07-05. Funções puras: recebem
// microAcoes.porCiclo (já com leituraSemantica, da fase 06) e os ciclos
// (da fase 04) e devolvem a tabela ação × ciclo, a lista de núcleo e
// exceções, alertas de ordem instável e o ciclo exemplar.
//
// SIMPLIFICAÇÃO DELIBERADA: alinhamento multi-sequência de verdade
// (N ciclos ao mesmo tempo) é um problema NP-difícil em geral; ferramentas
// de bioinformática resolvem isso com alinhamento progressivo. Aqui é mais
// simples ainda: um único ciclo de referência (o com mais fatias) ancora
// as colunas da tabela, e cada outro ciclo é alinhado par-a-par contra essa
// referência (Needleman-Wunsch clássico, a mesma ideia do cartão F07-01).
// Uma ação que existe só num ciclo NÃO referência, sem correspondência na
// referência, fica de fora da tabela — não ganha coluna própria. Isso é
// uma perda real de informação, documentada aqui e no README, não
// escondida.

function assinaturaFatia(fatia) {
  const leitura = fatia.leituraSemantica;
  if (leitura && !leitura.indeterminado) return `${leitura.verbo}:${leitura.objeto}`;
  return `causa:${fatia.causa}`;
}

// Needleman-Wunsch: alinha duas sequências permitindo lacunas (uma ação
// presente num ciclo e ausente no outro — F07-01: "aceitando que uma tenha
// um item a mais ou a menos"). Devolve pares [idxA|null, idxB|null].
export function alinharPar(a, b, { pontuacaoIgual = 2, pontuacaoDiferente = -1, pontuacaoLacuna = -1 } = {}) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i * pontuacaoLacuna;
  for (let j = 0; j <= m; j++) dp[0][j] = j * pontuacaoLacuna;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? pontuacaoIgual : pontuacaoDiferente);
      const cima = dp[i - 1][j] + pontuacaoLacuna;
      const esquerda = dp[i][j - 1] + pontuacaoLacuna;
      dp[i][j] = Math.max(diag, cima, esquerda);
    }
  }

  const alinhamento = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const diag = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? pontuacaoIgual : pontuacaoDiferente);
      if (dp[i][j] === diag) {
        alinhamento.unshift([i - 1, j - 1]);
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + pontuacaoLacuna) {
      alinhamento.unshift([i - 1, null]);
      i--;
    } else {
      alinhamento.unshift([null, j - 1]);
      j--;
    }
  }
  return alinhamento;
}

// F07-01: monta a tabela ação × ciclo. `colunas[i]` é um objeto
// {[cicloIndice]: fatia|undefined} — uma linha da tabela.
export function alinharCiclos(porCiclo) {
  if (porCiclo.length === 0) return { colunas: [], cicloReferenciaIndice: null };

  const referencia = porCiclo.reduce((melhor, c) => (c.fatias.length > melhor.fatias.length ? c : melhor), porCiclo[0]);
  const assinaturaRef = referencia.fatias.map(assinaturaFatia);
  const colunas = referencia.fatias.map((f) => ({ [referencia.cicloIndice]: f }));

  for (const ciclo of porCiclo) {
    if (ciclo.cicloIndice === referencia.cicloIndice) continue;
    const assinaturaCiclo = ciclo.fatias.map(assinaturaFatia);
    const alinhamento = alinharPar(assinaturaRef, assinaturaCiclo);
    for (const [idxRef, idxCiclo] of alinhamento) {
      if (idxRef === null) continue; // ação exclusiva deste ciclo, sem coluna de referência — ver nota no topo do arquivo
      colunas[idxRef][ciclo.cicloIndice] = idxCiclo === null ? null : ciclo.fatias[idxCiclo];
    }
  }

  return { colunas, cicloReferenciaIndice: referencia.cicloIndice };
}

// F07-02: percentual de presença de cada ação (coluna) entre os ciclos
// considerados.
export function calcularFrequencias(colunas, totalCiclos) {
  return colunas.map((coluna) => {
    const presentes = Object.values(coluna).filter(Boolean).length;
    return { presentes, totalCiclos, percentual: Math.round((presentes / totalCiclos) * 100) };
  });
}

// F07-03: corte de 80% — abaixo disso, vira exceção (revisão humana), não
// núcleo automático.
export function separarNucleoEExcecoes(colunas, frequencias, corteMinimoPercentual = 80) {
  const nucleo = [];
  const excecoes = [];
  colunas.forEach((coluna, i) => {
    const entrada = { coluna, frequencia: frequencias[i] };
    (frequencias[i].percentual >= corteMinimoPercentual ? nucleo : excecoes).push(entrada);
  });
  return { nucleo, excecoes };
}

// F07-04 (estabilidade de ordem) NÃO está implementado aqui — de propósito,
// depois de descobrir por que não dá pra fazer isso em cima do alinhamento
// acima. Uma primeira versão comparava, pra cada ciclo, se o índice da
// fatia casada com cada coluna crescia sempre (sinal de troca de posição
// quando não crescia). Ela nunca disparava, em nenhum cenário de teste —
// e o motivo é estrutural, não um bug para corrigir: Needleman-Wunsch
// contra uma referência fixa é monotônico por construção (o traceback
// nunca anda pra trás nos dois índices ao mesmo tempo), então qualquer
// par que SOBREVIVE como combinação já é, por definição, não-decrescente.
// Uma troca de posição de verdade não vira uma "combinação fora de ordem"
// nessa tabela — vira lacuna nos dois lados (o item some da coluna em vez
// de aparecer trocado), o que já reduz a frequência dele e o empurra pra
// lista de exceções (F07-03). Ou seja, a troca ainda "aparece" — só que
// pelo canal da frequência baixa, não por um alerta dedicado de ordem.
// Detectar isso de verdade precisaria de uma comparação de ordem relativa
// independente da tabela ancorada na referência (ex.: pra cada par de
// ciclos, olhar só os itens que combinam nos dois e comparar a ordem
// relativa deles) — não construído nesta rodada.

// F07-05: o ciclo mais próximo da mediana de duração, desempatado por
// aderência ao núcleo (quantas colunas de núcleo ele preenche).
export function escolherCicloExemplar(porCiclo, ciclosComDuracao, nucleo) {
  if (porCiclo.length === 0) return null;

  const duracoesOrdenadas = [...ciclosComDuracao].map((c) => c.duracaoSegundos).sort((a, b) => a - b);
  const mediana = duracoesOrdenadas[Math.floor(duracoesOrdenadas.length / 2)];

  function aderencia(cicloIndice) {
    return nucleo.filter((entrada) => Boolean(entrada.coluna[cicloIndice])).length;
  }

  let melhorCicloIndice = null;
  let melhorPontuacao = -Infinity;
  for (const ciclo of porCiclo) {
    const info = ciclosComDuracao.find((c) => c.indice === ciclo.cicloIndice);
    if (!info) continue;
    const distanciaMediana = Math.abs(info.duracaoSegundos - mediana);
    const pontuacao = aderencia(ciclo.cicloIndice) * 10 - distanciaMediana;
    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhorCicloIndice = ciclo.cicloIndice;
    }
  }
  return melhorCicloIndice;
}

// Orquestra tudo, a partir dos ciclos NÃO suspeitos apenas — é aqui que a
// marcação de suspeito da fase 04 (F04-05) vira ação de verdade: "não usar
// no consenso" significa excluir da tabela, não só destacar na tela.
export function montarConsenso(porCiclo, listaCiclos, { corteMinimoPercentual = 80 } = {}) {
  const indicesNaoSuspeitos = new Set(listaCiclos.filter((c) => !c.suspeito).map((c) => c.indice));
  const porCicloConsiderado = porCiclo.filter((c) => indicesNaoSuspeitos.has(c.cicloIndice));

  const { colunas, cicloReferenciaIndice } = alinharCiclos(porCicloConsiderado);
  const frequencias = calcularFrequencias(colunas, porCicloConsiderado.length);
  const { nucleo, excecoes } = separarNucleoEExcecoes(colunas, frequencias, corteMinimoPercentual);
  const cicloExemplarIndice = escolherCicloExemplar(porCicloConsiderado, listaCiclos, nucleo);

  return {
    ciclosConsiderados: [...indicesNaoSuspeitos],
    totalCiclosConsiderados: porCicloConsiderado.length,
    cicloReferenciaIndice,
    cicloExemplarIndice,
    nucleo,
    excecoes,
  };
}
