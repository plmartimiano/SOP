// Pacotes EAP 1.5.1 (inventário automático) + 1.5.2 (relatório) + 1.5.3
// (alternativas de agrupamento) — cartões F08-01 a F08-07. Funções puras,
// a partir do dossiê: microAcoes.porCiclo (todas as fronteiras, todos os
// ciclos — para os inventários) e reconhecimento.nucleo (o que a fase 07
// já reduziu a "estável" — para as ações que viram passo).
//
// O motor de fusão (`fundirAteSeis`) é o mesmo algoritmo que a fase 09
// (motor de consolidação, js/consolidacao.js) usa de verdade — aqui ele só
// faz a prévia de cada alternativa, pra a pessoa ver o resultado antes de
// homologar.

// F08-01: componentes distintos que o operador agrega — fronteiras cuja
// causa envolve pegar peça nova (isolada ou combinada com ferramenta).
export function inventariarComponentes(porCiclo) {
  const porNome = new Map();
  for (const ciclo of porCiclo) {
    for (const fatia of ciclo.fatias) {
      if (fatia.causa !== "componente_novo" && fatia.causa !== "combinada") continue;
      const leitura = fatia.leituraSemantica;
      const nome = leitura && !leitura.indeterminado ? leitura.objeto : "(componente não identificado)";
      if (!porNome.has(nome)) porNome.set(nome, { nomeOficial: nome, ocorrencias: 0 });
      porNome.get(nome).ocorrencias++;
    }
  }
  return [...porNome.values()];
}

// F08-02: ferramentas distintas, tempo total de uso e número de pegadas.
export function inventariarFerramentas(porCiclo) {
  const porNome = new Map();
  for (const ciclo of porCiclo) {
    for (const fatia of ciclo.fatias) {
      if (fatia.causa !== "troca_ferramenta" && fatia.causa !== "combinada") continue;
      const leitura = fatia.leituraSemantica;
      const nome = leitura && !leitura.indeterminado && leitura.ferramenta !== "nenhuma" ? leitura.ferramenta : "(ferramenta não identificada)";
      const duracao = Math.max(0, (fatia.fimSegundos ?? 0) - (fatia.inicioSegundos ?? 0));
      if (!porNome.has(nome)) porNome.set(nome, { nomeOficial: nome, pegadas: 0, tempoTotalSegundos: 0 });
      const entrada = porNome.get(nome);
      entrada.pegadas++;
      entrada.tempoTotalSegundos += duracao;
    }
  }
  return [...porNome.values()];
}

// F08-03: quantas fronteiras do núcleo (já filtrado pela fase 07) existem,
// classificadas por causa.
export function contarFronteirasEstaveis(nucleo) {
  const porCausa = {};
  for (const entrada of nucleo) {
    const causa = causaDaEntrada(entrada);
    porCausa[causa] = (porCausa[causa] || 0) + 1;
  }
  return { total: nucleo.length, porCausa };
}

// F08-04: pausas de conferência do núcleo — nunca podem ser fundidas em
// silêncio (ver naoFundivel em extrairAcaoBase).
export function detectarPausasDeConferencia(nucleo) {
  return nucleo.filter((entrada) => causaDaEntrada(entrada) === "pausa_conferencia");
}

function causaDaEntrada(entrada) {
  const fatia = Object.values(entrada.porCiclo).find(Boolean);
  return fatia ? fatia.causa : "desconhecida";
}

// F08-05: o relatório em português, pronto pra tela.
export function gerarRelatorio({ componentes, ferramentas, fronteiras, pausasConferencia, duracaoCicloSegundos }) {
  const minutos = Math.floor(duracaoCicloSegundos / 60);
  const segundos = Math.round(duracaoCicloSegundos % 60);
  const plural = (n, singular, plural_) => (n === 1 ? singular : plural_);
  return (
    `Esta estação tem ${componentes.length} ${plural(componentes.length, "componente", "componentes")}, ` +
    `${ferramentas.length} ${plural(ferramentas.length, "ferramenta", "ferramentas")}, ` +
    `${fronteiras.total} ${plural(fronteiras.total, "ação estável", "ações estáveis")}, ` +
    `${pausasConferencia.length} ${plural(pausasConferencia.length, "verificação", "verificações")}, ` +
    `ciclo de ${minutos}min${String(segundos).padStart(2, "0")}s.`
  );
}

// Uma "ação" pronta pra entrar no motor de fusão, derivada de uma entrada
// do núcleo (fase 07). Pausas de conferência nascem não-fundíveis
// (F08-04) — nenhum critério de agrupamento pode escondê-las dentro de
// outro passo. Exportada porque a fase 09 (js/consolidacao.js) reusa essa
// mesma transformação, sem reescrevê-la, pra aplicar de novo a regra já
// homologada sobre o núcleo atual.
export function extrairAcaoBase(entrada) {
  const fatia = Object.values(entrada.porCiclo).find(Boolean);
  const duracoes = Object.values(entrada.porCiclo)
    .filter(Boolean)
    .map((f) => Math.max(0, f.fimSegundos - f.inicioSegundos));
  const duracaoMediaSegundos = duracoes.length ? duracoes.reduce((s, d) => s + d, 0) / duracoes.length : 0;
  const leitura = fatia && fatia.leituraSemantica && !fatia.leituraSemantica.indeterminado ? fatia.leituraSemantica : null;
  const causa = fatia ? fatia.causa : "desconhecida";

  return {
    rotulo: entrada.acao,
    causa,
    ferramenta: leitura && leitura.ferramenta !== "nenhuma" ? leitura.ferramenta : null,
    objeto: leitura ? leitura.objeto : null,
    duracaoMediaSegundos,
    naoFundivel: causa === "pausa_conferencia",
    duvidosa: false,
  };
}

// Uma fusão é "duvidosa" quando combina causas diferentes ou ferramentas
// diferentes — o mesmo critério que gera um custo em custosDeFusao (F08-07).
// As duas coisas nascem da mesma verificação de propósito, pra nunca
// divergir: o texto do custo e a marca visual sempre concordam.
function ehFusaoDuvidosa(a, b) {
  return a.causa !== b.causa || (a.ferramenta && b.ferramenta && a.ferramenta !== b.ferramenta);
}

function fundirGrupos(a, b) {
  return {
    rotulo: `${a.rotulo} + ${b.rotulo}`,
    causa: a.causa === b.causa ? a.causa : "combinada",
    ferramenta: a.ferramenta === b.ferramenta ? a.ferramenta : null,
    objeto: a.objeto === b.objeto ? a.objeto : null,
    duracaoMediaSegundos: a.duracaoMediaSegundos + b.duracaoMediaSegundos,
    naoFundivel: a.naoFundivel || b.naoFundivel,
    // Contagiosa como naoFundivel: se QUALQUER fusão na história deste
    // grupo cruzou causa/ferramenta, o passo final inteiro fica marcado —
    // a pessoa vendo o passo 3 não precisa adivinhar qual das fusões
    // encadeadas dentro dele foi a duvidosa.
    duvidosa: a.duvidosa || b.duvidosa || ehFusaoDuvidosa(a, b),
    origem: [...(a.origem || [a.rotulo]), ...(b.origem || [b.rotulo])],
  };
}

// F09-02 (usado aqui como prévia, F08-06): enquanto houver mais de
// `maxGrupos`, une os dois vizinhos mais parecidos segundo o critério —
// nunca reordena, só funde vizinho com vizinho. Nunca funde um grupo
// não-fundível (F09-04). Se sobrar só grupos não-fundíveis entre si, para
// e sinaliza em vez de forçar.
export function fundirAteSeis(acoesBase, calcularSimilaridade, maxGrupos = 6) {
  let grupos = acoesBase.map((a) => ({ ...a }));
  const custosDeFusao = [];

  while (grupos.length > maxGrupos) {
    let melhorIndice = -1;
    let melhorPontuacao = -Infinity;
    for (let i = 0; i < grupos.length - 1; i++) {
      if (grupos[i].naoFundivel || grupos[i + 1].naoFundivel) continue;
      const pontuacao = calcularSimilaridade(grupos[i], grupos[i + 1]);
      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        melhorIndice = i;
      }
    }
    if (melhorIndice === -1) break; // só sobrou grupo não-fundível — não força

    const a = grupos[melhorIndice];
    const b = grupos[melhorIndice + 1];
    if (ehFusaoDuvidosa(a, b)) {
      custosDeFusao.push({
        rotulo: `${a.rotulo} + ${b.rotulo}`,
        motivo: `combina uma fronteira de "${a.causa}" com uma de "${b.causa}"${a.ferramenta && b.ferramenta && a.ferramenta !== b.ferramenta ? ` (ferramentas diferentes: ${a.ferramenta} e ${b.ferramenta})` : ""}`,
      });
    }
    grupos.splice(melhorIndice, 2, fundirGrupos(a, b));
  }

  return { grupos, custosDeFusao, completo: grupos.length === maxGrupos };
}

// F08-06 + F08-07: os três critérios possíveis com os dados que temos hoje.
// "Por face de montagem" (citado no plano) não entrou — não temos geometria
// de face modelada; o terceiro critério é "equilíbrio de tempo", que é
// tão válido quanto e não inventa dado que não temos.
export const CRITERIOS = {
  ferramenta_compartilhada: {
    nome: "Por ferramenta compartilhada",
    descricao: "Funde primeiro os vizinhos que usam a mesma ferramenta.",
    similaridade: (a, b) => (a.ferramenta && a.ferramenta === b.ferramenta ? 2 : 0),
  },
  mesmo_componente: {
    nome: "Por subconjunto do produto",
    descricao: "Funde primeiro os vizinhos que atuam no mesmo componente.",
    similaridade: (a, b) => (a.objeto && a.objeto === b.objeto ? 2 : 0),
  },
  equilibrio_tempo: {
    nome: "Por equilíbrio de tempo",
    descricao: "Funde primeiro os vizinhos mais curtos, pra distribuir a duração de forma mais pareja entre os 6 quadros.",
    similaridade: (a, b) => -(a.duracaoMediaSegundos + b.duracaoMediaSegundos),
  },
};

export function proporAlternativas(nucleo, chavesCriterios = Object.keys(CRITERIOS)) {
  const acoesBase = nucleo.map(extrairAcaoBase);
  return chavesCriterios.map((chave) => {
    const criterio = CRITERIOS[chave];
    const { grupos, custosDeFusao, completo } = fundirAteSeis(acoesBase, criterio.similaridade);
    return {
      chave,
      nome: criterio.nome,
      descricao: criterio.descricao,
      passos: grupos.map((g, i) => ({ numero: i + 1, titulo: g.rotulo, duracaoMediaSegundos: Number(g.duracaoMediaSegundos.toFixed(2)), duvidosa: g.duvidosa })),
      totalPassos: grupos.length,
      completo,
      custos: custosDeFusao,
    };
  });
}
