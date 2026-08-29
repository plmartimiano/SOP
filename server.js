// Servidor HTTP do projeto para rodar no Cloud Run — cartão de handoff
// de 2026-08-29: o cliente autentica via Vertex AI e roda outras
// ferramentas dentro do próprio Google Cloud (ADC via metadata server,
// ver api/_auth-vertex.js), então a hospedagem migrou da Vercel pra um
// serviço único no Cloud Run. Zero dependências externas — só módulos
// nativos do Node (http, fs, path) — mesma disciplina do resto do
// projeto: sem build, sem node_modules a versionar ou instalar.
//
// Por que um serviço só, servindo estático e as três rotas pagas juntos,
// em vez de uma Cloud Function por rota (mais parecido com o padrão da
// Vercel): Cloud Run cobra por instância ativa, não por função — um
// serviço único fica mais simples de operar (um só deploy, um só log,
// uma só URL, sem cold start extra por rota) sem custo adicional por
// isso. Ver Dockerfile na raiz para o empacotamento.
//
// As três funções em api/*.js continuam com a MESMA assinatura
// `(req, res) => {...}` que a Vercel usava — não foram reescritas.
// `adaptarResposta` empresta pro `res` puro do Node as poucas
// conveniências que a Vercel dava de graça (`res.status(n).json(obj)`),
// e `lerCorpoJson` faz o papel do `req.body` já parseado que a Vercel
// também dava de graça. Isso evita duplicar (ou reescrever, com risco de
// divergir) a lógica de negócio que já tem cobertura de teste.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = __dirname;
const PORTA = process.env.PORT || 8080;

const TIPOS_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const ROTAS_API = {
  "/api/leitura-semantica": require("./api/leitura-semantica.js"),
  "/api/gerar-imagem": require("./api/gerar-imagem.js"),
  "/api/verificar-imagem": require("./api/verificar-imagem.js"),
};

function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let bruto = "";
    req.on("data", (pedaco) => {
      bruto += pedaco;
    });
    req.on("end", () => {
      if (!bruto) return resolve({});
      try {
        resolve(JSON.parse(bruto));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function adaptarResposta(res) {
  res.status = function (codigo) {
    res.statusCode = codigo;
    return res;
  };
  res.json = function (obj) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
  return res;
}

async function tratarApi(handler, req, res) {
  adaptarResposta(res);
  try {
    req.body = req.method === "POST" ? await lerCorpoJson(req) : {};
  } catch {
    res.status(400).json({ erro: "corpo da requisição não é um JSON válido." });
    return;
  }
  await handler(req, res);
}

// Nunca serve nada fora da raiz do projeto — path.normalize resolve
// qualquer ../ antes da checagem, então "/../../etc/passwd" não escapa.
function tratarEstatico(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const relativo = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const caminho = path.normalize(path.join(RAIZ, relativo));

  if (!caminho.startsWith(RAIZ)) {
    res.writeHead(403);
    res.end("Proibido");
    return;
  }
  fs.readFile(caminho, (erro, dados) => {
    if (erro) {
      res.writeHead(404);
      res.end("Não encontrado");
      return;
    }
    const ext = path.extname(caminho);
    res.writeHead(200, { "Content-Type": TIPOS_MIME[ext] || "application/octet-stream" });
    res.end(dados);
  });
}

function criarServidor() {
  return http.createServer((req, res) => {
    const rota = req.url.split("?")[0];
    const handler = ROTAS_API[rota];
    if (handler) {
      tratarApi(handler, req, res).catch((e) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ erro: e.message }));
      });
      return;
    }
    tratarEstatico(req, res);
  });
}

if (require.main === module) {
  criarServidor().listen(PORTA, () => {
    console.log(`SOP a partir de vídeo rodando em http://localhost:${PORTA}`);
  });
}

module.exports = { criarServidor };
