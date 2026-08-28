# SOP a partir de vídeo

Programa que gera SOPs ilustrados de 6 passos a partir de vídeos de estações
de linha de montagem. Roda 100% no navegador (upload de MP4, sem YouTube por
enquanto). O plano completo está nos três documentos de referência do
projeto: plano de construção (17 fases / 90 cartões), organograma de
processo e EAP.

## O que já existe

Pacotes **1.1.2** (mapa de zonas da bancada), **1.2.1** (formato do
dossiê), **1.2.3** (exportar/importar), **1.2.4** (interface por etapa),
**1.3.1** (entrada de arquivo), **1.3.2** (triagem de qualidade), **1.3.3**
(extração de frames) e **1.3.4** (curva de movimento, geral **e** por
zona) da EAP.

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
- `js/mapa-zonas.js` — geometria e validação de zona (F00-03): id
  sequencial (`Z01`, `Z02`...), lista fechada de tipos (`escaninho`,
  `ferramenta`, `area_trabalho`, `saida`), retângulo normalizado 0–1
  (independente da resolução da foto usada). `renumerarZonas` corrige a
  numeração depois de remover uma zona do meio da lista.
- `js/fase00-ui.js` — a ferramenta de desenhar o mapa: sobe uma foto/frame
  da bancada, arrasta um retângulo sobre a imagem, nomeia a zona num
  formulário (nome oficial, código interno opcional, tipo), lista as zonas
  já marcadas com botão de remover. A foto em si não entra no dossiê (mesmo
  motivo do vídeo — ver `sessao-midia.js`); só a geometria e os nomes vão
  para `mapaDeZonas`.
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
- `js/sessao-midia.js` — o arquivo de vídeo em si e as miniaturas extraídas
  não entram no dossiê (JSON ficaria enorme — o mesmo risco do F01-01).
  Ficam num estado de sessão à parte, só na memória da aba atual. Trocar de
  dossiê (novo, exemplo, importar) limpa esse estado — o vídeo de um dossiê
  antigo não pode vazar para o novo.
- `js/frames-extrator.js` — a extração de verdade (F03-01 + F03-02): amostra
  o vídeo a 2 quadros/segundo por busca de tempo (`seek`) e gera de cada um
  uma miniatura 64×64 em tons de cinza.
- `js/curva-movimento.js` — a curva de movimento, geral e por zona (F03-03 +
  F03-04 + F03-05): diferença média de pixel entre cada par de frames
  vizinhos (picos = ação, vales = pausa), tanto no frame inteiro quanto só
  nos pixels de cada zona do mapa da bancada (`indicesDaZona` traduz o
  retângulo normalizado da zona pra posições na grade 64×64 das miniaturas),
  e uma suavização por média móvel curta que limpa ruído pontual sem apagar
  um vale sustentado.
- `js/fase03-ui.js` — tela da fase 03: se a fase 02 não gravou vídeo
  aprovado, ou se o vídeo não está mais na sessão (página recarregada, outro
  dossiê carregado), explica isso em vez de fingir que tem o vídeo. Com
  vídeo disponível, extrai, calcula e desenha a curva de movimento geral
  (crua e suavizada, num `<canvas>`) e — se a fase 00 já mapeou zonas — uma
  curva menor por zona, mostra a fita de miniaturas, e grava
  `taxaAmostragemFps` + `total` + `tempos` + `curvaMovimento` +
  `curvaPorZona` (quando houver zonas) na seção `frames`.
- `tests/dossie.test.mjs` — testes do formato e do round-trip
  exportar → importar.
- `tests/fases.test.mjs` — testes de integridade dos metadados das 17 fases
  (numeração, campos obrigatórios, seções do dossiê referenciadas existem).
- `tests/video-qualidade.test.mjs` — testes da regra de triagem (pura, sem
  vídeo/DOM, roda no Node). A leitura de metadados em si só faz sentido num
  navegador de verdade — foi conferida manualmente com vídeos sintéticos
  (ver "Como isso foi testado" abaixo).
- `tests/curva-movimento.test.mjs` — testes da diferença de pixel e da
  suavização com frames sintéticos (arrays pequenos, não vídeo de verdade):
  frames idênticos dão zero, preto→branco dá o máximo, um pico isolado é
  atenuado pela suavização mas um vale sustentado sobrevive, e — numa grade
  4×4 pequena o bastante pra conferir os índices na mão — uma mudança numa
  região não vaza pra curva de outra zona.
- `tests/mapa-zonas.test.mjs` — testes de geometria e validação de zona
  (nome vazio, tipo fora da lista, retângulo sem área, renumeração após
  remover). O desenho em canvas em si só se testa no navegador.

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

A extração de frames (1.3.3) foi validada no mesmo Chromium, encadeada com a
ingestão: sem vídeo aprovado no dossiê, a tela explica e não mostra a
ferramenta; com vídeo aprovado, extrai (vídeo de ~3s a 2/s deu 6 frames, em
~0,8s), mostra a fita de miniaturas e grava em `frames`. Criar um dossiê novo
depois de extrair limpa a sessão de mídia — voltando à fase 03 sem
reprocessar o vídeo mostra de novo a mensagem pedindo para reprocessar, em
vez de tentar usar um vídeo que já não é mais o do dossiê atual.

A curva de movimento (1.3.4) foi validada com dois vídeos sintéticos
desenhados para dar sinal claro: um alterna metade da tela entre duas cores
a cada 0,5s (mudança grande e real), outro fica com a cor parada o tempo
todo. O primeiro vídeo produziu valores suavizados por volta de 80 (numa
escala 0–255) enquanto o conteúdo realmente mudava entre amostras, caindo
para perto de zero quando duas amostras seguidas pegaram a mesma cor — ou
seja, a curva reage a mudança real de imagem, não a ruído. (Uma primeira
tentativa com um retângulo pequeno se movendo não deu sinal claro — o
ruído de compressão do vp8 dominava um elemento tão pequeno perto do
tamanho do frame; o vídeo de teste final usa uma mudança grande o
suficiente para não se confundir com isso.) Gráfico desenhado no
`<canvas>`, sem erro de página.

O mapa de zonas (1.1.2) foi validado no mesmo Chromium: sem dossiê, a
ferramenta ainda deixa desenhar (pra explorar), mas avisa que falta dossiê
e mantém "gravar" desabilitado. Com dossiê, subir uma foto sintética
800×600, arrastar um retângulo e preencher o formulário criou a zona com a
geometria normalizada correta (conferida contra o pixel exato do arrasto);
um arrasto minúsculo (menos de 8px) foi ignorado, sem abrir formulário; um
nome vazio foi recusado pela validação; remover a primeira de duas zonas
renumerou a que sobrou de `Z02` para `Z01`. Esse teste também expôs — e a
correção foi validada antes deste commit — um bug real de listener
duplicado: trocar de foto sem sair da fase registrava um segundo
`mouseup` no `window` a cada upload, e nada removia o anterior, então um
único arrasto acabava processado mais de uma vez. Corrigido guardando a
referência do handler ativo num escopo que sobrevive entre montagens da
tela, removendo o antigo antes de registrar o novo.

Com o mapa de zonas pronto, fechei a curva por zona (1.3.4 completo) e
testei encadeando os três: mapear duas zonas lado a lado (esquerda/direita)
numa foto 16:9, ingerir um vídeo onde só a metade esquerda muda de cor a
cada 0,5s, e extrair. O payload gravado mostrou a zona esquerda com média
suavizada ~140 (numa escala 0–255) e a zona direita com ~0,3 — a curva
isola geometricamente o movimento de verdade, sem vazar de uma zona pra
outra, exatamente o que o cartão F03-04 promete ("pra qual escaninho a mão
foi"). Sem zona mapeada, a tela volta a mostrar só a curva geral, sem
tentar desenhar gráficos vazios.

## Próximos pacotes da EAP (não implementados ainda)

- 1.2.2 — regra de imutabilidade (quando cada fase deve gravar versão nova).
  Adiado porque ainda não existe nenhuma fase de análise real reprocessando
  dado — a regra hoje não teria o que aplicar de verdade.
- 1.2.5 — painel de registro e custo (frames processados, chamadas feitas,
  gasto estimado). Ainda abstrato: só faz sentido quando a extração demorar
  o suficiente (vídeo de vários minutos) para precisar de feedback de
  progresso — hoje o vídeo de teste extrai em menos de 1 segundo.
- 1.3.5 em diante — detecção de ciclos, fatiamento em micro-ações. É o que
  vai preencher as fases 04 e 05, hoje mostrando "esta fase ainda não
  rodou". A detecção de ciclos consome exatamente a `curvaMovimento` que o
  1.3.4 acabou de gravar.
