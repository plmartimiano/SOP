# Container do Cloud Run — cartão de handoff de 2026-08-29 (migração de
# hospedagem, Vercel -> Cloud Run). server.js não tem NENHUMA dependência
# de npm (só módulos nativos do Node), então não existe node_modules nem
# passo de build aqui — só copiar os arquivos e rodar. Mesma disciplina
# de "sem build" do resto do projeto, agora dentro do container.

FROM node:22-alpine

WORKDIR /app

COPY . .

ENV NODE_ENV=production

# O Cloud Run injeta PORT em tempo de execução (padrão 8080) — server.js
# já lê process.env.PORT, então não precisa declarar aqui de novo; o
# EXPOSE abaixo é só documentação pra quem ler o Dockerfile.
EXPOSE 8080

CMD ["node", "server.js"]
