// Pacote EAP 1.4.3 — controle de lotes e custo (a parte de lotes e
// retentativa; o contador de gasto em si é o pacote 1.2.5, ainda não
// construído). Fala só com api/leitura-semantica.js — nunca diretamente
// com o Gemini, porque a chave paga não pode chegar ao navegador (ver o
// comentário no topo daquele arquivo).

// F06-01/F06-02: monta o payload de uma fatia — o trio de imagens (a partir
// do índice do frame-chave, pegando o vizinho anterior/seguinte na lista
// de frames), o glossário, os verbos permitidos, e a zona que a mão
// visitou nessa fronteira, se alguma zona foi identificada como causa.
// Nota honesta sobre uma simplificação: só a PRIMEIRA zona envolvida
// (zonasEnvolvidas[0]) vira contexto do prompt. Quando a causa é
// "combinada" (a mão passou por uma zona de componente E uma de
// ferramenta na mesma fronteira — ver classificarFronteira em
// micro-acoes.js), a segunda zona é descartada aqui, e qual das duas
// sobrevive depende só da ordem do array `zonas` do mapa, não de
// relevância. Coberto por teste (tests/leitura-semantica-cliente.test.mjs)
// como comportamento conhecido, não escondido — resolver isso de
// verdade exigiria mandar as DUAS zonas como contexto no prompt.
export function montarPayload(fatia, frames, { glossario, verbosPermitidos, zonas = [] }) {
  const indice = fatia.frameChave.indice;
  const idZonaEnvolvida = (fatia.zonasEnvolvidas || [])[0];
  const zona = idZonaEnvolvida ? zonas.find((z) => z.id === idZonaEnvolvida) || null : null;

  return {
    frames: {
      antes: indice > 0 ? frames[indice - 1].miniaturaDataUrl : null,
      chave: frames[indice].miniaturaDataUrl,
      depois: indice < frames.length - 1 ? frames[indice + 1].miniaturaDataUrl : null,
    },
    tempoSegundos: fatia.frameChave.tempoSegundos,
    glossario,
    verbosPermitidos,
    zona,
  };
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Uma fatia, com retentativa de espera progressiva (F06-05: "nova tentativa
// em caso de falha e pausa progressiva"). `atrasoBaseMs` existe pra testes
// não esperarem segundos de verdade — em produção usa o padrão de 500ms.
export async function lerFatia(
  fatia,
  frames,
  contexto,
  { fetchImpl = fetch, tentativas = 3, endpoint = "/api/leitura-semantica", atrasoBaseMs = 500 } = {}
) {
  const payload = montarPayload(fatia, frames, contexto);
  let ultimoErro;
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    try {
      const resposta = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        throw new Error(corpo.erro || `HTTP ${resposta.status}`);
      }
      return corpo;
    } catch (e) {
      ultimoErro = e;
      if (tentativa < tentativas - 1) {
        await esperar(atrasoBaseMs * 2 ** tentativa);
      }
    }
  }
  throw ultimoErro;
}

// F06-05: de 3 a 5 chamadas em paralelo, salvando cada resposta assim que
// chega — não espera o lote inteiro pra reportar o primeiro resultado.
// Falha isolada numa fatia não derruba as outras: onErro é chamado pra
// essa fatia e o resto do lote continua.
export async function lerFatiasEmLotes(fatias, frames, contexto, { tamanhoLote = 4, onResultado, onErro, ...opcoes } = {}) {
  for (let i = 0; i < fatias.length; i += tamanhoLote) {
    const lote = fatias.slice(i, i + tamanhoLote);
    await Promise.all(
      lote.map(async (fatia, offset) => {
        const indiceGlobal = i + offset;
        try {
          const leitura = await lerFatia(fatia, frames, contexto, opcoes);
          onResultado?.(indiceGlobal, leitura);
        } catch (e) {
          onErro?.(indiceGlobal, e);
        }
      })
    );
  }
}
