// Fase 13 — geração das imagens. Fala só com api/gerar-imagem.js, nunca
// direto com o Gemini (mesmo motivo do comentário em leitura-semantica.js
// — a chave paga não pode chegar ao navegador).
//
// A barreira "nenhuma imagem é gerada antes do aceite humano das fichas
// dos 6 passos" — fixada desde o início do projeto, e até aqui garantida
// só pela ausência desta fase — vira checagem de código AQUI pela
// primeira vez: gerarTodasAsImagens recusa rodar sem receber
// `aprovacaoExiste: true`, lançando um erro que a tela nunca consegue
// engolir silenciosamente (ver js/fase13-ui.js).

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Uma chamada, com retentativa de espera progressiva (mesmo padrão de
// leitura-semantica.js — lerFatia).
export async function gerarUmaImagem(
  { prompt, imagemReferenciaBase64 = null, seed = null },
  { fetchImpl = fetch, tentativas = 3, endpoint = "/api/gerar-imagem", atrasoBaseMs = 500 } = {}
) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    try {
      const resposta = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, imagemReferenciaBase64, seed }),
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

// A chave da ÂNCORA (variação 1) de um passo — é o que outro item usa em
// `referenciaDe` pra apontar pra esta imagem.
function chaveDoItem(item) {
  return item.tipo === "quadroMestre" ? "quadroMestre" : `passo:${item.numero}:1`;
}

// A chave ÚNICA de cada item do plano, inclusive variações não-âncora —
// usada pela tela (js/fase13-ui.js) pra guardar e mostrar TODAS as
// imagens geradas, não só as que viram referência da próxima etapa.
export function chaveUnicaDoItem(item) {
  return item.tipo === "quadroMestre" ? "quadroMestre" : `passo:${item.numero}:${item.variacao}`;
}

// Monta o PLANO da cadeia — quem referencia quem, quantas variações — sem
// chamar rede nenhuma. Separado de gerarTodasAsImagens pra poder ser
// testado (e mostrado na tela antes de gastar) sem custo nenhum.
//
// Cadeia: o quadro-mestre primeiro, sem referência nenhuma. Cada passo
// referencia a VARIAÇÃO-ÂNCORA (a primeira das três) do elo anterior da
// cadeia — nunca uma referência aleatória, sempre a mesma trilha
// determinística: quadro-mestre → passo 1 (âncora) → passo 2 (âncora) →
// ... As variações 2 e 3 de cada passo usam a MESMA referência que a
// variação-âncora daquele passo (a imagem do elo anterior), não a
// referência de outra variação — assim a incerteza de uma variação nunca
// se acumula sobre a próxima etapa da cadeia.
export function montarPlanoDeGeracao({ quadroMestre, passos }, { variacoesPorPasso = 3, sementeBase = 1000 } = {}) {
  const itens = [{ tipo: "quadroMestre", numero: 0, variacao: 0, prompt: quadroMestre, referenciaDe: null, seed: sementeBase }];
  passos.forEach((p, indicePasso) => {
    for (let v = 0; v < variacoesPorPasso; v++) {
      itens.push({
        tipo: "passo",
        numero: p.numero,
        variacao: v + 1,
        prompt: p.prompt,
        referenciaDe: indicePasso === 0 ? "quadroMestre" : chaveDoItem({ tipo: "passo", numero: passos[indicePasso - 1].numero }),
        seed: sementeBase + p.numero * 10 + v,
      });
    }
  });
  return itens;
}

// Agrupa o plano em "elos" (o quadro-mestre sozinho, depois cada passo
// com suas variações juntas) — dentro de um elo as chamadas não dependem
// umas das outras e podem rodar em paralelo; entre elos, a ordem importa
// (o elo seguinte referencia a âncora do anterior), então rodam em série.
function agruparEmElos(plano) {
  const elos = [];
  let eloAtual = [];
  let chaveAtual = null;
  for (const item of plano) {
    const chave = item.tipo === "quadroMestre" ? "quadroMestre" : `passo:${item.numero}`;
    if (chave !== chaveAtual) {
      if (eloAtual.length) elos.push(eloAtual);
      eloAtual = [];
      chaveAtual = chave;
    }
    eloAtual.push(item);
  }
  if (eloAtual.length) elos.push(eloAtual);
  return elos;
}

// Gera de verdade, elo por elo, na ordem da cadeia. Ao contrário da fase
// 06 (onde toda fatia é independente e cabe em lotes livres), aqui a
// cadeia é sequencial por construção — um passo só pode ser gerado depois
// que a imagem que ele referencia já existe.
//
// aprovacaoExiste: bool — vem de checar se existe uma versão gravada na
// seção "aprovacoes" do dossiê (fase 11). Sem isso, recusa — sempre,
// mesmo que os prompts existam prontos de uma sessão anterior.
export async function gerarTodasAsImagens(
  { quadroMestre, passos },
  { aprovacaoExiste, onResultado, onErro, variacoesPorPasso = 3, sementeBase = 1000, ...opcoesChamada } = {}
) {
  if (!aprovacaoExiste) {
    throw new Error(
      "Geração de imagem recusada: não existe aprovação gravada na fase 11. Nenhuma imagem é gerada antes do " +
        "aceite humano das fichas dos 6 passos — regra fixada desde o início do projeto."
    );
  }

  const plano = montarPlanoDeGeracao({ quadroMestre, passos }, { variacoesPorPasso, sementeBase });
  const imagensPorChave = new Map(); // "quadroMestre" | "passo:N:1" -> base64 — resolve as referências da cadeia

  for (const elo of agruparEmElos(plano)) {
    await Promise.all(
      elo.map(async (item) => {
        try {
          const imagemReferenciaBase64 = item.referenciaDe ? imagensPorChave.get(item.referenciaDe) || null : null;
          const resultado = await gerarUmaImagem({ prompt: item.prompt, imagemReferenciaBase64, seed: item.seed }, opcoesChamada);
          if (item.tipo === "quadroMestre" || item.variacao === 1) {
            imagensPorChave.set(chaveDoItem(item), resultado.imagemBase64);
          }
          onResultado?.(item, resultado);
        } catch (e) {
          onErro?.(item, e);
        }
      })
    );
  }
}
