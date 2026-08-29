// Pacote EAP 1.3.6 — Fatiamento em micro-ações.
// Funções puras: a partir da curva de movimento geral (dentro de um ciclo)
// e das curvas por zona, acha as fronteiras entre uma ação e outra
// (F05-01 a F05-03), escolhe o frame-chave de cada fatia (F05-04) e o
// contexto de antes/depois (F05-05).

// F05-01: mínimos locais da curva suavizada dentro do intervalo do ciclo —
// onde a mão parou. Aceita plateaus (vários pontos seguidos no mesmo valor
// mínimo); os pontos duplicados de um plateau são resolvidos depois, no
// filtro de distância mínima (F05-03).
export function acharVales(curvaGeral, inicioSegundos, fimSegundos) {
  const pontos = curvaGeral.filter((p) => p.tempoSegundos >= inicioSegundos && p.tempoSegundos <= fimSegundos);
  const vales = [];
  for (let i = 1; i < pontos.length - 1; i++) {
    const anterior = valorDe(pontos[i - 1]);
    const atual = valorDe(pontos[i]);
    const proximo = valorDe(pontos[i + 1]);
    const ehMinimo = atual <= anterior && atual <= proximo && (atual < anterior || atual < proximo);
    if (ehMinimo) vales.push(pontos[i].tempoSegundos);
  }
  return vales;
}

// F05-03: pausa menor que meio segundo é hesitação, não fronteira — junta
// vales próximos demais, mantendo só o primeiro de cada grupo.
export function filtrarValesProximos(vales, distanciaMinimaSegundos = 0.5) {
  if (vales.length === 0) return [];
  const filtrados = [vales[0]];
  for (let i = 1; i < vales.length; i++) {
    if (vales[i] - filtrados[filtrados.length - 1] >= distanciaMinimaSegundos) {
      filtrados.push(vales[i]);
    }
  }
  return filtrados;
}

// F05-02: um pico de atividade numa zona, perto do instante da fronteira,
// é evidência forte de causa. Limiar simples — pico bem acima da própria
// média da zona — é o primeiro corte; calibrar contra vídeo real é
// trabalho futuro, não deste pacote.
//
// PASSO — por que DOIS critérios combinados (`pico > 5 && pico > media * 2`),
// não um só. Média relativa sozinha falharia numa zona quase sempre
// parada (média perto de zero: qualquer ruído mínimo pareceria "2x a
// média"); um limiar absoluto sozinho falharia numa zona naturalmente
// mais ativa (uma ferramenta usada o tempo todo teria picos absolutos
// grandes mesmo sem fronteira de verdade). Juntando os dois, uma zona só
// conta como "ativa" se o pico for relevante NOS DOIS SENTIDOS ao mesmo
// tempo — evita os dois jeitos de falso positivo.
//
// A classificação em si é uma tabela de decisão de duas variáveis
// booleanas (tem zona de componente ativa? tem zona de ferramenta
// ativa?): as duas juntas é "combinada" (pegou peça E trocou ferramenta
// na mesma fronteira), só componente é "componente_novo", só ferramenta
// é "troca_ferramenta", nenhuma das duas é "pausa_conferencia" (a mão
// parou sem visitar zona nenhuma — o caso que sobra quando não há
// evidência de pegar nada, plausível como "parou pra olhar/testar").
export function classificarFronteira(tempoSegundos, curvaPorZona, zonas, janelaSegundos = 0.5) {
  const zonasAtivas = [];
  for (const zona of zonas) {
    const pontos = curvaPorZona[zona.id];
    if (!pontos || pontos.length === 0) continue;
    const media = pontos.reduce((s, p) => s + valorDe(p), 0) / pontos.length;
    const pico = Math.max(
      0,
      ...pontos.filter((p) => Math.abs(p.tempoSegundos - tempoSegundos) <= janelaSegundos).map(valorDe)
    );
    if (pico > 5 && pico > media * 2) {
      zonasAtivas.push({ zonaId: zona.id, tipo: zona.tipo });
    }
  }

  const temComponente = zonasAtivas.some((z) => z.tipo === "escaninho");
  const temFerramenta = zonasAtivas.some((z) => z.tipo === "ferramenta");

  let causa;
  if (temComponente && temFerramenta) causa = "combinada";
  else if (temComponente) causa = "componente_novo";
  else if (temFerramenta) causa = "troca_ferramenta";
  else causa = "pausa_conferencia";

  return { causa, zonasEnvolvidas: zonasAtivas.map((z) => z.zonaId) };
}

function valorDe(ponto) {
  return ponto.valorSuavizado ?? ponto.valor;
}

function tempoDeMaiorMovimento(curvaGeral, inicioSegundos, fimSegundos) {
  const pontos = curvaGeral.filter((p) => p.tempoSegundos >= inicioSegundos && p.tempoSegundos <= fimSegundos);
  if (pontos.length === 0) return inicioSegundos;
  let melhor = pontos[0];
  for (const p of pontos) {
    if (valorDe(p) > valorDe(melhor)) melhor = p;
  }
  return melhor.tempoSegundos;
}

function indiceFrameMaisProximo(frames, tempoSegundos) {
  let melhorIndice = 0;
  let melhorDistancia = Infinity;
  frames.forEach((f, i) => {
    const d = Math.abs(f.tempoSegundos - tempoSegundos);
    if (d < melhorDistancia) {
      melhorDistancia = d;
      melhorIndice = i;
    }
  });
  return melhorIndice;
}

// Orquestra tudo pra um ciclo: acha as fronteiras, filtra as insignificantes,
// classifica cada uma e monta a fatia com frame-chave (F05-04) + contexto
// de antes/depois (F05-05, guardado como referência de tempo — o frame de
// verdade é recuperado sob demanda da lista `frames`, nunca duplicado).
export function montarFatias(frames, curvaGeral, ciclo, { curvaPorZona = {}, zonas = [], distanciaMinimaSegundos = 0.5 } = {}) {
  const valesBrutos = acharVales(curvaGeral, ciclo.inicioSegundos, ciclo.fimSegundos);
  const vales = filtrarValesProximos(valesBrutos, distanciaMinimaSegundos);
  const fronteiras = [ciclo.inicioSegundos, ...vales, ciclo.fimSegundos];

  const fatias = [];
  for (let i = 0; i < fronteiras.length - 1; i++) {
    const inicioSegundos = fronteiras[i];
    const fimSegundos = fronteiras[i + 1];
    const tempoChave = tempoDeMaiorMovimento(curvaGeral, inicioSegundos, fimSegundos);
    const indiceChave = indiceFrameMaisProximo(frames, tempoChave);
    const classificacao = classificarFronteira(inicioSegundos, curvaPorZona, zonas);

    fatias.push({
      indice: i + 1,
      inicioSegundos: Number(inicioSegundos.toFixed(3)),
      fimSegundos: Number(fimSegundos.toFixed(3)),
      causa: classificacao.causa,
      zonasEnvolvidas: classificacao.zonasEnvolvidas,
      frameChave: { indice: indiceChave, tempoSegundos: frames[indiceChave].tempoSegundos },
      contextoAntesSegundos: indiceChave > 0 ? frames[indiceChave - 1].tempoSegundos : null,
      contextoDepoisSegundos: indiceChave < frames.length - 1 ? frames[indiceChave + 1].tempoSegundos : null,
    });
  }
  return fatias;
}

// Roda montarFatias em todos os ciclos de uma vez, no formato que vai pro
// dossiê: uma lista de fatias por índice de ciclo.
export function fatiarCiclos(frames, curvaGeral, ciclos, opcoes = {}) {
  return ciclos.map((ciclo) => ({
    cicloIndice: ciclo.indice,
    fatias: montarFatias(frames, curvaGeral, ciclo, opcoes),
  }));
}
