import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// api/_auth-vertex.js é CommonJS — Node ESM importa via interop.
import { obterTokenDeAcesso, montarUrlVertex, lerProjetoELocation, _resetCacheParaTestes } from "../api/_auth-vertex.js";

beforeEach(() => _resetCacheParaTestes());

const URL_METADATA = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const URL_OAUTH_TOKEN = "https://oauth2.googleapis.com/token";

// Simula "não estou rodando no Google Cloud" — a mesma coisa que acontece
// de verdade fora do Cloud Run/Compute Engine (o host não resolve).
function fetchSemMetadataServer(handlerOAuth) {
  return async (url, opts) => {
    if (url === URL_METADATA) throw new Error("getaddrinfo ENOTFOUND metadata.google.internal");
    return handlerOAuth(url, opts);
  };
}

test("montarUrlVertex com location 'global' não leva prefixo de região no host", () => {
  const url = montarUrlVertex({ projeto: "meu-projeto", location: "global", modelo: "gemini-2.5-flash" });
  assert.equal(url, "https://aiplatform.googleapis.com/v1/projects/meu-projeto/locations/global/publishers/google/models/gemini-2.5-flash:generateContent");
});

test("montarUrlVertex com location regional leva o prefixo no host", () => {
  const url = montarUrlVertex({ projeto: "meu-projeto", location: "us-central1", modelo: "gemini-2.5-flash" });
  assert.equal(
    url,
    "https://us-central1-aiplatform.googleapis.com/v1/projects/meu-projeto/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
  );
});

test("lerProjetoELocation exige GOOGLE_CLOUD_PROJECT", () => {
  const original = process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  try {
    assert.throws(() => lerProjetoELocation(), /GOOGLE_CLOUD_PROJECT/);
  } finally {
    if (original !== undefined) process.env.GOOGLE_CLOUD_PROJECT = original;
  }
});

test("lerProjetoELocation usa 'global' como padrão quando GOOGLE_CLOUD_LOCATION não está definida", () => {
  const originalProjeto = process.env.GOOGLE_CLOUD_PROJECT;
  const originalLocation = process.env.GOOGLE_CLOUD_LOCATION;
  process.env.GOOGLE_CLOUD_PROJECT = "meu-projeto";
  delete process.env.GOOGLE_CLOUD_LOCATION;
  try {
    assert.deepEqual(lerProjetoELocation(), { projeto: "meu-projeto", location: "global" });
  } finally {
    if (originalProjeto !== undefined) process.env.GOOGLE_CLOUD_PROJECT = originalProjeto; else delete process.env.GOOGLE_CLOUD_PROJECT;
    if (originalLocation !== undefined) process.env.GOOGLE_CLOUD_LOCATION = originalLocation;
  }
});

test("obterTokenDeAcesso: quando o metadata server responde (simulando rodar no Cloud Run), usa ADC e nem olha GOOGLE_SERVICE_ACCOUNT_JSON", async () => {
  const originalEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; // prova que o caminho 1 não depende disso

  const originalFetch = globalThis.fetch;
  let chamadasMetadata = 0;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, URL_METADATA);
    assert.equal(opts.headers["Metadata-Flavor"], "Google");
    chamadasMetadata += 1;
    return { ok: true, json: async () => ({ access_token: "token-via-adc-456", expires_in: 3600, token_type: "Bearer" }) };
  };

  try {
    const token = await obterTokenDeAcesso();
    assert.equal(token, "token-via-adc-456");
    assert.equal(chamadasMetadata, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv;
  }
});

test("obterTokenDeAcesso: sem metadata server e sem GOOGLE_SERVICE_ACCOUNT_JSON, explica os dois motivos", async () => {
  const originalEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchSemMetadataServer(async () => {
    throw new Error("não deveria chamar o endpoint OAuth sem credencial nenhuma configurada");
  });
  try {
    await assert.rejects(() => obterTokenDeAcesso(), /nem o metadata server.*nem GOOGLE_SERVICE_ACCOUNT_JSON/s);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv;
  }
});

test("obterTokenDeAcesso: sem metadata server, cai pro fallback e rejeita JSON inválido com o motivo (não trava)", async () => {
  const originalEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{ isso não é json";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchSemMetadataServer(async () => {
    throw new Error("não deveria chegar no endpoint OAuth — o JSON já devia ter falhado antes");
  });
  try {
    await assert.rejects(() => obterTokenDeAcesso(), /não é um JSON válido/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test("obterTokenDeAcesso: sem metadata server, cai pro fallback e rejeita JSON sem client_email/private_key", async () => {
  const originalEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "meu-projeto" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchSemMetadataServer(async () => {
    throw new Error("não deveria chegar no endpoint OAuth — as credenciais já deviam ter falhado antes");
  });
  try {
    await assert.rejects(() => obterTokenDeAcesso(), /não parece uma chave de conta de serviço/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test("obterTokenDeAcesso: sem metadata server, explica o erro (sem travar) quando a troca por token falha", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const originalEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: "outra-conta@meu-projeto.iam.gserviceaccount.com",
    private_key: privateKey,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchSemMetadataServer(async () => ({
    ok: false,
    status: 401,
    text: async () => "invalid_grant: chave revogada",
  }));

  try {
    await assert.rejects(() => obterTokenDeAcesso(), /401.*invalid_grant/s);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test("obterTokenDeAcesso: sem metadata server, monta um JWT RS256 válido via conta de serviço, troca por token e reusa (cache) sem chamar fetch de novo", async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const originalEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: "conta-de-teste@meu-projeto.iam.gserviceaccount.com",
    private_key: privateKey,
  });

  const originalFetch = globalThis.fetch;
  let chamadasOAuth = 0;
  let assertivaCorpo;
  globalThis.fetch = fetchSemMetadataServer(async (url, opts) => {
    chamadasOAuth += 1;
    assert.equal(url, URL_OAUTH_TOKEN);
    const params = new URLSearchParams(opts.body);
    assert.equal(params.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
    const jwt = params.get("assertion");
    const [cabecalhoB64, corpoB64, assinaturaB64] = jwt.split(".");

    const cabecalho = JSON.parse(Buffer.from(cabecalhoB64, "base64url").toString());
    assert.deepEqual(cabecalho, { alg: "RS256", typ: "JWT" });

    const reivindicacoes = JSON.parse(Buffer.from(corpoB64, "base64url").toString());
    assert.equal(reivindicacoes.iss, "conta-de-teste@meu-projeto.iam.gserviceaccount.com");
    assert.equal(reivindicacoes.scope, "https://www.googleapis.com/auth/cloud-platform");
    assert.equal(reivindicacoes.aud, URL_OAUTH_TOKEN);
    assert.ok(reivindicacoes.exp > reivindicacoes.iat);

    // confirma que a assinatura é de fato válida contra a chave pública —
    // não só "tem três partes separadas por ponto".
    const assinaturaValida = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${cabecalhoB64}.${corpoB64}`),
      publicKey,
      Buffer.from(assinaturaB64, "base64url")
    );
    assert.equal(assinaturaValida, true);
    assertivaCorpo = true;

    return { ok: true, json: async () => ({ access_token: "token-de-teste-123", expires_in: 3600 }) };
  });

  try {
    const token = await obterTokenDeAcesso();
    assert.equal(token, "token-de-teste-123");
    assert.equal(chamadasOAuth, 1);
    assert.equal(assertivaCorpo, true);

    // segunda chamada dentro da validade não deve bater na rede de novo
    const tokenDeNovo = await obterTokenDeAcesso();
    assert.equal(tokenDeNovo, "token-de-teste-123");
    assert.equal(chamadasOAuth, 1, "token em cache não deveria disparar novo fetch");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});
