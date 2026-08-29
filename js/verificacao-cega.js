// Fase 14 — verificação cega. Fala só com api/verificar-imagem.js, nunca
// direto com o Gemini (mesmo motivo do comentário em leitura-semantica.js
// e geracao-imagens.js).
//
// Limitação de arquitetura herdada da fase 13: as imagens só existem na
// sessão do navegador (nunca no dossiê — F01-01), então esta fase só
// funciona na MESMA aba/sessão onde a fase 13 gerou as imagens.
//
// Usa sempre a variação-âncora (variação 1) de cada passo — a mesma que
// sustenta a cadeia de consistência visual na fase 13 — como a imagem
// "oficial" avaliada aqui. Ainda não existe uma tela pra escolher outra
// variação manualmente (lacuna registrada no README) — dá pra trocar
// depois sem mudar esta orquestração, só a fonte da imagem.

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chamarProxy(payload, { fetchImpl = fetch, tentativas = 3, endpoint = "/api/verificar-imagem", atrasoBaseMs = 500 } = {}) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    try {
      const resposta = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.erro || `HTTP ${resposta.status}`);
      return corpo;
    } catch (e) {
      ultimoErro = e;
      if (tentativa < tentativas - 1) await esperar(atrasoBaseMs * 2 ** tentativa);
    }
  }
  throw ultimoErro;
}

const ROTULOS = ["A", "B", "C", "D", "E", "F"];

// F14 (teste de ordem embaralhada): embaralha os passos com rótulos de
// letra, sem que o modelo veja o número real do passo — devolve a lista
// embaralhada e o mapa rótulo → número real, pra comparar depois. rng é
// injetável pra teste determinístico (padrão: Math.random).
export function embaralharComRotulos(passosComImagem, { rng = Math.random } = {}) {
  const copia = [...passosComImagem];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  const rotulos = ROTULOS.slice(0, copia.length);
  const rotuloParaNumero = {};
  const itens = copia.map((p, i) => {
    rotuloParaNumero[rotulos[i]] = p.numero;
    return { rotulo: rotulos[i], ...p };
  });
  return { itens, rotuloParaNumero };
}

// Compara a ordem sugerida pelo modelo (em rótulos) contra a ordem real
// dos números de passo — devolve, posição a posição, se bateu, e se a
// sequência inteira é reconstruível (o gate F14).
export function avaliarOrdemSugerida(ordemSugerida, rotuloParaNumero, ordemRealNumeros) {
  const ordemSugeridaNumeros = ordemSugerida.map((r) => rotuloParaNumero[r]);
  const acertosPorPosicao = ordemSugeridaNumeros.map((n, i) => n === ordemRealNumeros[i]);
  return {
    ordemSugeridaNumeros,
    acertosPorPosicao,
    totalAcertos: acertosPorPosicao.filter(Boolean).length,
    sequenciaReconstruivel: acertosPorPosicao.every(Boolean),
  };
}

// quadroMestreImagem: { imagemBase64, mimeType } | null.
// passosComImagemAncora: [{ numero, imagemBase64, mimeType }] NA ORDEM REAL (1..6).
export async function rodarVerificacaoCega(
  { quadroMestreImagem, passosComImagemAncora },
  { onNota, onOrdem, onContinuidade, rng = Math.random, ...opcoesChamada } = {}
) {
  // 1. Nota por quadro — quadro-mestre (se houver) + cada passo, em paralelo.
  const itensParaNota = [
    ...(quadroMestreImagem ? [{ chave: "quadroMestre", ...quadroMestreImagem }] : []),
    ...passosComImagemAncora.map((p) => ({ chave: `passo:${p.numero}`, imagemBase64: p.imagemBase64, mimeType: p.mimeType })),
  ];
  const notas = {};
  await Promise.all(
    itensParaNota.map(async ({ chave, imagemBase64, mimeType }) => {
      try {
        const r = await chamarProxy({ tipo: "nota", imagemBase64, mimeType }, opcoesChamada);
        notas[chave] = r;
        onNota?.(chave, r, null);
      } catch (e) {
        onNota?.(chave, null, e);
      }
    })
  );

  // 2. Ordem embaralhada — uma chamada só, com todos os passos.
  const { itens, rotuloParaNumero } = embaralharComRotulos(passosComImagemAncora, { rng });
  let ordem = null;
  try {
    const r = await chamarProxy(
      { tipo: "ordem", imagens: itens.map((i) => ({ rotulo: i.rotulo, imagemBase64: i.imagemBase64, mimeType: i.mimeType })) },
      opcoesChamada
    );
    ordem = avaliarOrdemSugerida(
      r.ordemSugerida,
      rotuloParaNumero,
      passosComImagemAncora.map((p) => p.numero)
    );
    onOrdem?.(ordem, null);
  } catch (e) {
    onOrdem?.(null, e);
  }

  // 3. Continuidade — pares consecutivos, NA ORDEM REAL. Independentes
  // entre si (ao contrário da cadeia de geração da fase 13), então rodam
  // em paralelo.
  const paresConsecutivos = [];
  for (let i = 0; i < passosComImagemAncora.length - 1; i++) {
    paresConsecutivos.push([passosComImagemAncora[i], passosComImagemAncora[i + 1]]);
  }
  const continuidades = new Array(paresConsecutivos.length);
  await Promise.all(
    paresConsecutivos.map(async ([antes, depois], indice) => {
      try {
        const r = await chamarProxy({ tipo: "continuidade", imagemAntes: antes, imagemDepois: depois }, opcoesChamada);
        const item = { entre: [antes.numero, depois.numero], ...r };
        continuidades[indice] = item;
        onContinuidade?.(item, null);
      } catch (e) {
        const item = { entre: [antes.numero, depois.numero], erro: e.message };
        continuidades[indice] = item;
        onContinuidade?.(null, e);
      }
    })
  );

  return { notas, ordem, continuidades };
}
