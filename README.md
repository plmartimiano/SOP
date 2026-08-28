# SOP a partir de vídeo

Programa que gera SOPs ilustrados de 6 passos a partir de vídeos de estações
de linha de montagem. Roda 100% no navegador (upload de MP4, sem YouTube por
enquanto). O plano completo está nos três documentos de referência do
projeto: plano de construção (17 fases / 90 cartões), organograma de
processo e EAP.

## O que já existe

Pacotes **1.2.1** (formato do dossiê) e **1.2.3** (exportar/importar) da EAP.

- `js/dossie.js` — esquema do dossiê: as dez seções (`origemVideo`,
  `mapaDeZonas`, `frames`, `ciclos`, `microAcoes`, `reconhecimento`,
  `passos`, `prompts`, `imagens`, `aprovacoes`), cada uma guardando um
  histórico de versões que só cresce (`criarDossieVazio`, `adicionarVersao`,
  `obterVersaoAtual`, `obterHistorico`).
- `js/dossie-validar.js` — validação estrutural, usada na importação para
  apontar exatamente o campo que falta em vez de só dizer "inválido".
- `js/dossie-io.js` — exportar (baixar `.json`) e importar (ler `File` ou
  texto, validar, devolver avisos não bloqueantes quando a versão do formato
  é diferente).
- `fixtures/dossie-exemplo.json` — exemplo fictício preenchido cobrindo as
  dez seções, incluindo uma seção (`passos`) com duas versões para mostrar
  que reprocessar não apaga a versão anterior.
- `index.html` / `js/app.js` / `css/style.css` — página mínima para
  exercitar os dois pacotes: criar dossiê vazio, carregar o exemplo, baixar,
  carregar de volta. **Não** é a interface por etapa (pacote 1.2.4, ainda não
  construído).
- `tests/dossie.test.mjs` — testes do formato e do round-trip
  exportar → importar.

## Decisões que valem para todo o projeto (não mudam)

- Seis passos é número fechado da empresa.
- MVP com upload de MP4, 100% no navegador — nada de YouTube por enquanto.
- Pipeline em cascata do barato para o caro: matemática de pixel no
  navegador primeiro, modelo de visão só nos frames-chave, geração de
  imagem só depois do aceite humano.
- Nenhuma imagem é gerada antes do aceite humano das fichas dos 6 passos.

## O que o formato do dossiê garante

- Nunca guarda imagem em tamanho real dentro do JSON — só referências e
  tempos (risco identificado no cartão F01-01: "um dossiê de 300 MB trava o
  navegador").
- Tem `formatVersion` no topo do arquivo, para permitir escrever um
  conversor quando o formato mudar, sem quebrar dossiês antigos.
- Cada seção é uma lista de versões que só cresce (`adicionarVersao` nunca
  sobrescreve). A regra de **quando** cada fase deve gravar uma versão nova
  é escopo do pacote 1.2.2, ainda não construído — aqui só a forma do
  arquivo já suporta isso.

## Rodar

Sem build, sem dependências de servidor. Para abrir a demonstração:

```
python3 -m http.server 8000
# depois abra http://localhost:8000/index.html
```

(Precisa de servidor local, não `file://`, porque a página busca
`fixtures/dossie-exemplo.json` via `fetch`.)

Para rodar os testes (Node 18+):

```
node --test tests/
```

## Próximos pacotes da EAP (não implementados ainda)

- 1.2.2 — regra de imutabilidade (quando cada fase deve gravar versão nova).
- 1.2.4 — interface por etapa (uma tela por fase, navegação lateral).
- 1.2.5 — painel de registro e custo.
