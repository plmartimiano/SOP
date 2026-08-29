// Autenticação de servidor para o Vertex AI (cartão de handoff de
// 2026-08-29: o cliente já usa Gemini via Vertex AI — projeto do Google
// Cloud + conta de serviço — não a Gemini Developer API com chave simples
// que as três funções deste diretório usavam até aqui). Substitui o
// `?key=GEMINI_API_KEY` na URL por um token de acesso OAuth2, obtido pelo
// fluxo de "JWT bearer" de conta de serviço (RFC 7523 / documentação da
// Google "Using OAuth 2.0 for Server to Server Applications") — só com
// módulos nativos do Node (`crypto`), sem nenhuma dependência nova, pela
// mesma razão de sempre neste projeto: sem build, sem node_modules a
// versionar ou instalar.
//
// Alternativa descartada: a biblioteca oficial `google-auth-library` faz
// a mesma coisa com menos código aqui, mas adiciona a primeira dependência
// externa do projeto — trocaria um arquivo pequeno e auditável por uma
// árvore de node_modules. Como o fluxo de JWT bearer é padrão OAuth2
// estável (não é API específica do Gemini, não deve mudar), escrevê-lo à
// mão é o menor desvio da regra de "zero dependência" do projeto.

const crypto = require("crypto");

let tokenCache = null; // { accessToken, expiraEm } — reaproveitado entre invocações "quentes" da função na Vercel

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

// Pede (ou reusa, se ainda válido) um token de acesso OAuth2 pro escopo
// "cloud-platform" — o único escopo que as chamadas de generateContent do
// Vertex AI precisam. Token expira em ~1h (dados.expires_in do Google);
// a margem de 60s evita usar um token que expira no meio da chamada.
async function obterTokenDeAcesso() {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiraEm > agora + 60) {
    return tokenCache.accessToken;
  }

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
  tokenCache = { accessToken: dadosToken.access_token, expiraEm: agora + (dadosToken.expires_in || 3600) };
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

module.exports = { obterTokenDeAcesso, montarUrlVertex, lerProjetoELocation };
