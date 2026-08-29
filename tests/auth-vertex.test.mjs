import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// api/_auth-vertex.js é CommonJS — Node ESM importa via interop.
import { obterTokenDeAcesso, montarUrlVertex, lerProjetoELocation } from "../api/_auth-vertex.js";

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

test("obterTokenDeAcesso rejeita quando GOOGLE_SERVICE_ACCOUNT_JSON não está configurada", async () => {
  const original = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    await assert.rejects(() => obterTokenDeAcesso(), /GOOGLE_SERVICE_ACCOUNT_JSON não configurada/);
  } finally {
    if (original !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = original;
  }
});

test("obterTokenDeAcesso rejeita JSON inválido com mensagem explicando o motivo (não trava)", async () => {
  const original = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{ isso não é json";
  try {
    await assert.rejects(() => obterTokenDeAcesso(), /não é um JSON válido/);
  } finally {
    if (original !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = original; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test("obterTokenDeAcesso rejeita JSON sem client_email/private_key", async () => {
  const original = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "meu-projeto" });
  try {
    await assert.rejects(() => obterTokenDeAcesso(), /não parece uma chave de conta de serviço/);
  } finally {
    if (original !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = original; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test("obterTokenDeAcesso explica o erro (sem travar) quando a troca por token falha", async () => {
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
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "invalid_grant: chave revogada" });

  try {
    await assert.rejects(() => obterTokenDeAcesso(), /401.*invalid_grant/s);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

// A partir daqui, obterTokenDeAcesso passa a ter um token em cache válido
// por 1h (mockado) — os testes acima de falha precisam rodar ANTES deste,
// senão o cache mascara a falha simulada de rede.
test("obterTokenDeAcesso monta um JWT RS256 válido, troca por token e reusa (cache) sem chamar fetch de novo", async () => {
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
  let chamadasFetch = 0;
  let assertivaCorpo;
  globalThis.fetch = async (url, opts) => {
    chamadasFetch += 1;
    assert.equal(url, "https://oauth2.googleapis.com/token");
    const params = new URLSearchParams(opts.body);
    assert.equal(params.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
    const jwt = params.get("assertion");
    const [cabecalhoB64, corpoB64, assinaturaB64] = jwt.split(".");

    const cabecalho = JSON.parse(Buffer.from(cabecalhoB64, "base64url").toString());
    assert.deepEqual(cabecalho, { alg: "RS256", typ: "JWT" });

    const reivindicacoes = JSON.parse(Buffer.from(corpoB64, "base64url").toString());
    assert.equal(reivindicacoes.iss, "conta-de-teste@meu-projeto.iam.gserviceaccount.com");
    assert.equal(reivindicacoes.scope, "https://www.googleapis.com/auth/cloud-platform");
    assert.equal(reivindicacoes.aud, "https://oauth2.googleapis.com/token");
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

    return {
      ok: true,
      json: async () => ({ access_token: "token-de-teste-123", expires_in: 3600 }),
    };
  };

  try {
    const token = await obterTokenDeAcesso();
    assert.equal(token, "token-de-teste-123");
    assert.equal(chamadasFetch, 1);
    assert.equal(assertivaCorpo, true);

    // segunda chamada dentro da validade não deve bater na rede de novo
    const tokenDeNovo = await obterTokenDeAcesso();
    assert.equal(tokenDeNovo, "token-de-teste-123");
    assert.equal(chamadasFetch, 1, "token em cache não deveria disparar novo fetch");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalEnv; else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});
