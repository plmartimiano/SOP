import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// server.js é CommonJS — Node ESM importa via interop.
import { criarServidor } from "../server.js";

let servidor;

before(async () => {
  servidor = criarServidor();
  await new Promise((resolve) => servidor.listen(0, resolve));
});

after(() => {
  servidor.close();
});

// Usa a forma "path" (não uma string de URL completa) de propósito: o
// construtor de URL normaliza ".." antes mesmo de montar a requisição,
// o que mascararia justamente o caso que o teste de path traversal
// abaixo precisa exercitar (o servidor recebendo o "../" cru na linha
// da requisição, sem normalização prévia do lado do cliente).
function requisitar(caminho, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: servidor.address().port, path: caminho, method: opcoes.method || "GET", headers: opcoes.headers },
      (res) => {
        let corpo = "";
        res.on("data", (c) => (corpo += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, corpo }));
      }
    );
    req.on("error", reject);
    if (opcoes.body) req.write(opcoes.body);
    req.end();
  });
}

test("GET / serve index.html", async () => {
  const r = await requisitar("/");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /text\/html/);
  assert.match(r.corpo, /<!doctype html>/i);
});

test("GET /css/style.css serve o CSS com o content-type certo", async () => {
  const r = await requisitar("/css/style.css");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /text\/css/);
});

test("GET /js/app.js serve o módulo JS com content-type de javascript (exigido pra <script type=module>)", async () => {
  const r = await requisitar("/js/app.js");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /javascript/);
});

test("GET /fixtures/dossie-exemplo.json serve JSON válido", async () => {
  const r = await requisitar("/fixtures/dossie-exemplo.json");
  assert.equal(r.status, 200);
  assert.doesNotThrow(() => JSON.parse(r.corpo));
});

test("GET de um arquivo inexistente devolve 404, não trava o servidor", async () => {
  const r = await requisitar("/isso-nao-existe.xyz");
  assert.equal(r.status, 404);
});

test("tentativa de path traversal não escapa da raiz do projeto", async () => {
  const r = await requisitar("/../../../../../../etc/passwd");
  assert.notEqual(r.status, 200);
  assert.doesNotMatch(r.corpo, /root:/);
});

test("POST /api/leitura-semantica com corpo que não é JSON válido devolve 400 explicando o motivo", async () => {
  const r = await requisitar("/api/leitura-semantica", { method: "POST", body: "{ isso não é json" });
  assert.equal(r.status, 400);
  const json = JSON.parse(r.corpo);
  assert.match(json.erro, /JSON válido/);
});

test("GET /api/leitura-semantica (método errado) chega no handler de verdade e devolve 405", async () => {
  const r = await requisitar("/api/leitura-semantica", { method: "GET" });
  assert.equal(r.status, 405);
  const json = JSON.parse(r.corpo);
  assert.match(json.erro, /Use POST/);
});

test("POST /api/gerar-imagem com corpo válido chega no handler de verdade (sem credencial no ambiente de teste, falha explicando o motivo)", async () => {
  const r = await requisitar("/api/gerar-imagem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "teste" }),
  });
  assert.equal(r.status, 500);
  const json = JSON.parse(r.corpo);
  assert.match(json.erro, /GOOGLE_CLOUD_PROJECT/);
});
