# SOP a partir de vídeo

Programa que gera SOPs ilustrados de 6 passos a partir de vídeos de estações
de linha de montagem. Roda 100% no navegador (upload de MP4, sem YouTube por
enquanto). O plano completo está nos três documentos de referência do
projeto: plano de construção (17 fases / 90 cartões), organograma de
processo e EAP.

## O que já existe

Pacotes **1.2.1** (formato do dossiê), **1.2.3** (exportar/importar),
**1.2.4** (interface por etapa), **1.3.1** (entrada de arquivo) e **1.3.2**
(triagem de qualidade) da EAP.

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
- `js/fases.js` — metadados estáticos das 17 fases do organograma de
  processo (título, entra/sai/decide, critério de passagem, e a qual seção
  do dossiê cada uma corresponde). Só texto — nenhuma lógica de análise.
- `index.html` / `js/app.js` / `css/style.css` — a casca do aplicativo:
  toolbar do dossiê (novo / exemplo / exportar / importar) + navegação
  lateral pelas 17 fases + indicador de qual fase já tem dado gravado.
  Navegação por hash da URL (`#fase-08`), então recarregar a página mantém a
  fase selecionada.
- `js/video-metadados.js` — a primeira fase de análise de verdade (F02-01):
  lê um arquivo MP4 direto no `<video>`/`<canvas>` do navegador — duração,
  resolução, orientação, fps estimado (via `requestVideoFrameCallback`,
  contando quadros decodificados de verdade por ~1s) e uma amostra de
  luminância média (para detectar vídeo escuro). Zero upload a servidor.
- `js/video-qualidade.js` — a triagem automática (F02-02): recusa vídeo
  abaixo de 720p, com fps abaixo de 20, visivelmente escuro ou curto demais,
  cada recusa com uma frase que explica o que regravar. A checagem de
  duração mínima "por número de ciclos" do plano ainda não dá para fazer —
  depende da detecção de ciclos (pacote 1.3.5) — e isso fica dito na tela,
  não fingido.
- `js/fase02-ui.js` — liga os dois módulos acima à tela da fase 02: escolher
  arquivo, mostrar os metadados, mostrar o resultado da triagem, e um botão
  "gravar no dossiê" que só habilita se o vídeo foi aprovado (vídeo
  reprovado não avança — mesma regra do organograma: "não se tenta salvar
  material ruim adiante").
- `tests/dossie.test.mjs` — testes do formato e do round-trip
  exportar → importar.
- `tests/fases.test.mjs` — testes de integridade dos metadados das 17 fases
  (numeração, campos obrigatórios, seções do dossiê referenciadas existem).
- `tests/video-qualidade.test.mjs` — testes da regra de triagem (pura, sem
  vídeo/DOM, roda no Node). A leitura de metadados em si só faz sentido num
  navegador de verdade — foi conferida manualmente com vídeos sintéticos
  (ver "Como isso foi testado" abaixo).

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
node --test
```

## Como isso foi testado

O `estimarFps` precisa de vídeo de verdade tocando no navegador, então não
dá para testar com node:test. Validação manual num Chromium real
(Playwright), com vídeos sintéticos gerados em memória via
`canvas.captureStream()` + `MediaRecorder` (o ambiente não tinha um
codificador MP4/H.264 disponível para gerar arquivos de teste, só vp8/webm —
mas `video-metadados.js` não olha extensão de arquivo, só o `Blob.type`,
então isso testa o código de verdade):

- Vídeo bom (1280×720, ~46fps efetivo, bem iluminado): aprovado, botão
  "gravar" habilita só depois de existir um dossiê, grava em `origemVideo` e
  o indicador da fase 02 acende.
- Resolução baixa (320×240): recusado, com a frase certa.
- Vídeo escuro: recusado por luminância.
- Vídeo muito curto (0,3s): recusado por duração — isso também expôs e
  corrigiu um bug real: `estimarFps` ficava esperando para sempre num vídeo
  mais curto que a janela de amostragem, porque o vídeo termina (evento
  `ended`) antes de gerar frame suficiente e a promise nunca resolvia.
- Arquivo que não é vídeo de verdade: erro legível, nenhum erro de página.
- Tempo até os metadados aparecerem: ~1,3–1,4s — dentro do "menos de 2
  segundos" do cartão F02-01, mas perto do limite (a amostragem de fps usa
  uma janela de 1s pensada para tolerar variação de quadro-a-quadro; se
  isso apertar demais o orçamento em vídeos reais, é o primeiro parâmetro a
  revisitar).

## Próximos pacotes da EAP (não implementados ainda)

- 1.2.2 — regra de imutabilidade (quando cada fase deve gravar versão nova).
  Adiado porque ainda não existe nenhuma fase de análise real reprocessando
  dado — a regra hoje não teria o que aplicar de verdade.
- 1.2.5 — painel de registro e custo (frames processados, chamadas feitas,
  gasto estimado). Ainda abstrato: só faz sentido depois que 1.3.3
  (extração de ~1200 frames) existir e demorar o suficiente para precisar
  de feedback de progresso.
- 1.3.3 em diante — extração de frames, curvas de movimento, detecção de
  ciclos, fatiamento em micro-ações. É o que vai preencher as fases 03 a 05,
  hoje mostrando "esta fase ainda não rodou".
