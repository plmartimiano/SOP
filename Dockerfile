# Container do Cloud Run — cartão de handoff de 2026-08-29 (migração de
# hospedagem, Vercel -> Cloud Run; depois, migração das fases 06/14 de
# Gemini pra Claude). O projeto inteiro continuou sem NENHUMA dependência
# de npm até a migração pro Claude — agora existe uma (@anthropic-ai/sdk,
# ver api/_cliente-claude.js), então este Dockerfile ganhou um passo de
# `npm install` que não existia antes. Copia package*.json primeiro (não
# `COPY . .` direto) só pra aproveitar o cache de camada do Docker: o
# `npm install` só roda de novo quando as dependências mudam, não a cada
# mudança de código.

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

# O Cloud Run injeta PORT em tempo de execução (padrão 8080) — server.js
# já lê process.env.PORT, então não precisa declarar aqui de novo; o
# EXPOSE abaixo é só documentação pra quem ler o Dockerfile.
EXPOSE 8080

CMD ["node", "server.js"]
