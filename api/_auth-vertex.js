// Autenticação de servidor para o Vertex AI (cartão de handoff de
// 2026-08-29: o cliente já usa Gemini via Vertex AI — projeto do Google
// Cloud + conta de serviço — não a Gemini Developer API com chave simples
// que as três funções deste diretório usavam até aqui). Substitui o
// `?key=GEMINI_API_KEY` na URL por um token de acesso OAuth2 — só com
// módulos nativos do Node (`crypto`), sem nenhuma dependência nova, pela
// mesma razão de sempre neste projeto: sem build, sem node_modules a
// versionar ou instalar.
//
// ATUALIZADO (segundo cartão de handoff, mesmo dia): o projeto migrou de
// hospedagem na Vercel para um serviço no Cloud Run (ver server.js e
// Dockerfile na raiz) — o que muda a credencial disponível. Dois
// caminhos, nesta ordem de preferência:
//
// 1. ADC via metadata server do Cloud Run/Compute Engine — o MESMO
//    mecanismo que `google.auth.default()` usa nos scripts Python do
//    cliente (ver cartão de handoff): o serviço do Cloud Run tem uma
//    conta de serviço anexada, e o token de acesso vem de uma chamada
//    HTTP simples pro metadata server, sem nenhuma chave em lugar
//    nenhum — nem em variável de ambiente, nem em arquivo. É o caminho
//    padrão, mais seguro (nenhum segredo de longa duração pra vazar) e o
//    que bate com o que o cliente já faz em outras ferramentas dele.
// 2. Fallback pra JWT bearer de conta de serviço (RFC 7523 /
//    documentação da Google "Using OAuth 2.0 for Server to Server
//    Applications"), lendo `GOOGLE_SERVICE_ACCOUNT_JSON` — mantido por
//    portabilidade (funciona em qualquer host, não só Google Cloud; é o
//    que a Vercel precisava quando o projeto rodava lá, e continua
//    disponível se o deploy voltar pra fora do Google Cloud algum dia).
//
// Alternativa descartada: a biblioteca oficial `google-auth-library` faz
// os dois caminhos com menos código aqui, mas adiciona a primeira
// dependência externa do projeto — trocaria dois arquivos pequenos e
// auditáveis por uma árvore de node_modules. Como os dois fluxos são
// padrão OAuth2/GCP estável (não é API específica do Gemini, não deve
// mudar), escrevê-los à mão é o menor desvio da regra de "zero
// dependência" do projeto.

const crypto = require("crypto");

const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

let tokenCache = null; // { accessToken, expiraEm } — reaproveitado entre invocações "quentes" da instância do Cloud Run

function base64url(entrada) {
  const buffer = Buffer.isBuffer(entrada) ? entrada : Buffer.from(entrada);
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// A credencial esperada é o conteúdo INTEIRO do arquivo JSON da conta de
// serviço (baixado do painel do Google Cloud — IAM e administrador >
// Contas de serviço > Chaves > Adicionar chave > JSON), colado como uma
// única variável de ambiente. O private_key de dentro do JSON já vem com
// as quebras de linha escapadas como "\n" (texto), que JSON.parse resolve
// sozinho — não precisa de nenhum tratamento extra ao colar na Vercel.
function lerCredenciais() {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!bruto) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON não configurada no servidor — cole o conteúdo inteiro do arquivo JSON da conta de serviço."
    );
  }
  let credenciais;
  try {
    credenciais = JSON.parse(bruto);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido — cole o arquivo da conta de serviço sem editar.");
  }
  if (!credenciais.client_email || !credenciais.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não tem client_email/private_key — não parece uma chave de conta de serviço.");
  }
  return credenciais;
}

// Caminho 1 (preferido): pede o token direto pro metadata server da
// instância do Cloud Run — só funciona quando o processo está rodando
// dentro do Google Cloud (o metadata.google.internal só resolve lá
// dentro). Fora do Google Cloud, essa chamada falha rápido (erro de DNS
// ou timeout) e obterTokenDeAcesso cai pro caminho 2 automaticamente.
async function tentarTokenViaMetadataServer() {
  const controle = new AbortController();
  const tempoLimite = setTimeout(() => controle.abort(), 2000);
  try {
    const resposta = await fetch(METADATA_TOKEN_URL, {
      headers: { "Metadata-Flavor": "Google" },
      signal: controle.signal,
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (!dados.access_token) return null;
    return { accessToken: dados.access_token, expiresIn: dados.expires_in };
  } catch {
    return null; // sem metadata server disponível (fora do Google Cloud) — segue pro caminho 2
  } finally {
    clearTimeout(tempoLimite);
  }
}

// Caminho 2 (fallback): JWT bearer de conta de serviço — ver cabeçalho
// do arquivo. Só é tentado se GOOGLE_SERVICE_ACCOUNT_JSON estiver
// configurada; senão obterTokenDeAcesso explica que nenhum dos dois
// caminhos está disponível.
async function obterTokenViaContaDeServico() {
  const agora = Math.floor(Date.now() / 1000);
  const { client_email, private_key } = lerCredenciais();
  const cabecalho = { alg: "RS256", typ: "JWT" };
  const reivindicacoes = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  };
  const naoAssinado = `${base64url(JSON.stringify(cabecalho))}.${base64url(JSON.stringify(reivindicacoes))}`;
  const assinatura = crypto.sign("RSA-SHA256", Buffer.from(naoAssinado), private_key);
  const jwtAssinado = `${naoAssinado}.${base64url(assinatura)}`;

  const respostaToken = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtAssinado,
    }),
  });

  if (!respostaToken.ok) {
    const corpoErro = await respostaToken.text();
    throw new Error(`Falha ao trocar o JWT por um token de acesso do Google: ${respostaToken.status} ${corpoErro.slice(0, 300)}`);
  }

  const dadosToken = await respostaToken.json();
  return { accessToken: dadosToken.access_token, expiresIn: dadosToken.expires_in };
}

// Pede (ou reusa, se ainda válido) um token de acesso OAuth2 pro escopo
// "cloud-platform" — o único escopo que as chamadas de generateContent do
// Vertex AI precisam. Token expira em ~1h (expires_in do Google); a
// margem de 60s evita usar um token que expira no meio da chamada.
async function obterTokenDeAcesso() {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiraEm > agora + 60) {
    return tokenCache.accessToken;
  }

  let resultado = await tentarTokenViaMetadataServer();
  if (!resultado) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error(
        "Não consegui um token de acesso: nem o metadata server do Google Cloud respondeu (normal fora do " +
          "Cloud Run/Compute Engine) nem GOOGLE_SERVICE_ACCOUNT_JSON está configurada como alternativa."
      );
    }
    resultado = await obterTokenViaContaDeServico();
  }

  tokenCache = { accessToken: resultado.accessToken, expiraEm: agora + (resultado.expiresIn || 3600) };
  return tokenCache.accessToken;
}

// F13/F06/F14 confirmaram (cartão de handoff): o cliente usa location
// "global" — nesse caso o host NÃO leva o prefixo de região (é
// "aiplatform.googleapis.com" puro, não "global-aiplatform..."), uma
// particularidade documentada do endpoint global do Vertex AI. Uma
// location regional (ex.: "us-central1") levaria o prefixo normalmente —
// suportado aqui embutido, mesmo que hoje só "global" tenha sido
// confirmado contra a conta do cliente.
function montarUrlVertex({ projeto, location, modelo }) {
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projeto}/locations/${location}/publishers/google/models/${modelo}:generateContent`;
}

function lerProjetoELocation() {
  const projeto = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projeto) {
    throw new Error("GOOGLE_CLOUD_PROJECT não configurada no servidor.");
  }
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  return { projeto, location };
}

// Só para os testes (tests/auth-vertex.test.mjs) isolarem cada caso sem
// depender da ordem em que rodam — nunca chamado pelos handlers de
// produção em api/*.js.
function _resetCacheParaTestes() {
  tokenCache = null;
}

module.exports = { obterTokenDeAcesso, montarUrlVertex, lerProjetoELocation, _resetCacheParaTestes };
