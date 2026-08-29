# SOP a partir de vídeo

Programa que gera SOPs ilustrados de 6 passos a partir de vídeos de estações
de linha de montagem. Roda 100% no navegador (upload de MP4, sem YouTube por
enquanto). O plano completo está nos três documentos de referência do
projeto: plano de construção (17 fases / 90 cartões), organograma de
processo e EAP.

## O que já existe

Pacotes **1.1.2** (mapa de zonas da bancada), **1.1.4** (vocabulário de
verbos — versão simplificada, ver ressalva), **1.2.1** (formato do
dossiê), **1.2.3** (exportar/importar), **1.2.4** (interface por etapa),
**1.3.1** (entrada de arquivo), **1.3.2** (triagem de qualidade), **1.3.3**
(extração de frames), **1.3.4** (curva de movimento, geral **e** por zona),
**1.3.5** (detecção de ciclos — ver ressalva sobre a revisão visual
arrastável), **1.3.6** (fatiamento em micro-ações), **1.4.1 + 1.4.2 +
1.4.3** (leitura semântica), **1.4.4 + 1.4.5** (consenso entre ciclos —
ver ressalva sobre a estabilidade de ordem) e **1.5.1 + 1.5.2 + 1.5.3**
(reconhecimento da estação — inventário, relatório e alternativas de
agrupamento, com homologação humana) da EAP. Com isso, o bloco C do
organograma (a parte "grátis" do pipeline) está completo, a primeira
chamada paga do projeto (bloco D, fase 06) já existe — com uma ressalva de
arquitetura importante, ver "Onde o navegador para de bastar" — o bloco D
inteiro (fases 06 e 07) está fechado, e a fase 08 (a primeira do bloco E,
a que pede homologação humana de verdade) também.

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
- `js/deteccao-ciclos.js` — detecção automática de ciclos (F04-01 a F04-05):
  autocorrelação da curva de movimento estima a duração do ciclo (o
  primeiro pico local, ignorando deslocamentos curtos demais pra serem um
  ciclo de verdade); a matriz de auto-similaridade (cada frame comparado
  com todos os outros) é o que desenha as diagonais paralelas do cartão
  F04-01; a partir do frame 0 como marco zero, procura as repetições mais
  parecidas dentro de uma janela ao redor da duração estimada (tolerando
  até 30% de variação de ritmo) e corta os ciclos entre elas; primeiro e
  último ciclo saem marcados como suspeitos, não descartados. **Sem período
  detectável, devolve uma lista vazia** — nunca inventa um ciclo do
  tamanho do vídeo inteiro pra não ficar sem resposta.
- `js/fase04-ui.js` — tela da fase 04: se a fase 03 não gravou frames, ou
  se os frames não estão mais na sessão (mesma situação do vídeo/frames nas
  fases 02/03), explica em vez de fingir. Com frames disponíveis, detecta,
  desenha a matriz de auto-similaridade (sempre, mesmo sem ciclo detectado
  — é diagnóstico útil por si só) e lista os ciclos numa tabela com os
  suspeitos destacados, gravando em `ciclos`.
- `tests/deteccao-ciclos.test.mjs` — testes com sinais sintéticos pequenos
  o bastante pra conferir o resultado na mão: autocorrelação acerta o
  período de um sinal periódico simples, `estimarDuracaoCiclo` devolve
  `null` (não trava, não inventa) pra sinal monótono, plano ou com poucos
  pontos, a matriz é zero na diagonal e simétrica, `encontrarAncoras` acha
  as repetições certas, e um teste de ponta a ponta confirma 4 ciclos de 2s
  cada com pontas marcadas suspeitas.
- `js/micro-acoes.js` — fatiamento em micro-ações dentro de cada ciclo
  (F05-01 a F05-05): mínimos locais da curva geral, dentro do intervalo do
  ciclo, são as fronteiras candidatas (F05-01); vales a menos de 0,5s um do
  outro são hesitação, não fronteira, e se juntam num só (F05-03); cada
  fronteira é classificada cruzando com as curvas por zona — pico numa
  zona de escaninho perto do instante = `componente_novo`, numa zona de
  ferramenta = `troca_ferramenta`, as duas juntas = `combinada`, nenhuma =
  `pausa_conferencia` (F05-02); o frame de maior movimento dentro de cada
  fatia vira o frame-chave (F05-04), com os tempos do frame de antes e de
  depois guardados como contexto (F05-05, sem duplicar a imagem — só a
  referência de tempo, o frame de verdade já está na lista de frames).
- `js/fase05-ui.js` — tela da fase 05: pede ciclos gravados na fase 04 e os
  frames ainda na sessão; fatia cada ciclo, mostra o frame-chave em
  miniatura e a causa de cada fatia, avisa quando a contagem foge da faixa
  de 6–15 esperada (normal em vídeo curto de teste), e grava tudo em
  `microAcoes`.
- `tests/micro-acoes.test.mjs` — testes com uma curva sintética de três
  vales nítidos: acha os vales certos, filtra os próximos demais, classifica
  cada causa (`componente_novo`/`troca_ferramenta`/`combinada`/
  `pausa_conferencia`) contra curvas de zona construídas à mão, escolhe o
  frame-chave certo (o de maior movimento dentro da fatia) e o contexto de
  antes/depois, e confere o caso degenerado de zero vales (uma fatia só,
  cobrindo o ciclo inteiro).
- `js/vocabulario-verbos.js` — a lista fechada de verbos do cartão F00-05
  (pacote 1.1.4), como constante fixa (`posicionar`, `encaixar`,
  `parafusar`, `conectar`, `testar`, `transferir` — o padrão que o próprio
  plano sugere). **Versão simplificada**: sem tela de edição, sem
  persistência — vocabulário e glossário são recurso da *estação*, reusado
  entre vídeos, não do dossiê (que é por vídeo); a "biblioteca da estação"
  que guardaria isso de verdade é o pacote 1.8.4, ainda não construído.
- `api/_leitura-semantica-core.js` — o núcleo puro dos pacotes 1.4.1
  (módulo de leitura semântica) e 1.4.2 (identificação por zona): monta o
  prompt (glossário fechado, verbos permitidos, e a zona que a mão visitou
  como *resposta*, não como pergunta — F06-02) e sanitiza a resposta do
  modelo. A sanitização é o F06-04 ("proibir invenção") aplicado em código,
  não só pedido no prompt: verbo fora da lista ou objeto fora do glossário
  nunca vira dado gravado — vira `indeterminado`, com o motivo exato.
  Campo obrigatório ausente é erro, não silêncio (F06-03).
- `api/leitura-semantica.js` — a função que roda fora do navegador (ver
  "Onde o navegador para de bastar" abaixo): recebe o payload do cliente,
  monta o prompt via `_leitura-semantica-core.js`, chama o Gemini com a
  chave guardada como variável de ambiente do servidor, e sanitiza a
  resposta antes de devolver.
- `js/leitura-semantica.js` — pacote 1.4.3 (controle de lotes): monta o
  payload de cada fatia (o trio antes/chave/depois a partir do índice do
  frame-chave), chama o proxy em lotes de até 4 em paralelo, com
  retentativa e espera progressiva (F06-05) — salva cada resposta assim
  que chega, não espera o lote inteiro.
- `js/fase06-ui.js` — tela da fase 06: pede micro-ações fatiadas na fase 05
  e os frames ainda na sessão; lê cada frame-chave, mostra o progresso e o
  resultado linha a linha (verbo/objeto/mão/confiança, ou "indeterminado"
  destacado), e grava uma nova versão de `microAcoes` com o campo
  `leituraSemantica` acrescentado a cada fatia — sem apagar a versão
  anterior (a da fase 05, sem essa leitura).
- `tests/leitura-semantica-core.test.mjs` — testes do prompt e da
  sanitização: aceita resposta bem formada, repassa `indeterminado` do
  próprio modelo, e — o mais importante — vira `indeterminado` (nunca erro,
  nunca dado inventado) quando falta campo, quando o verbo não está na
  lista, ou quando objeto/ferramenta não estão no glossário.
- `tests/leitura-semantica-cliente.test.mjs` — testes de lotes e
  retentativa com um `fetch` simulado: tenta de novo depois de uma falha,
  desiste depois do número configurado de tentativas, processa em grupos
  do tamanho certo (conferido por concorrência real, não só contagem de
  chamadas), e uma fatia falhando não trava as outras do mesmo lote.
- `js/consenso-ciclos.js` — o alinhamento entre ciclos (F07-01 a F07-05):
  cada ação de cada ciclo vira uma "assinatura" (verbo+objeto da leitura
  semântica, ou a causa da fase 05 quando a leitura veio indeterminada ou
  nem rodou), e um alinhamento tipo Needleman-Wunsch — a mesma técnica de
  comparar sequências genéticas que o próprio plano cita — casa a sequência
  de cada ciclo contra a do ciclo com mais ações (a referência), permitindo
  lacunas quando uma ação falta num ciclo. Frequência ≥ 80% vira núcleo do
  procedimento; abaixo disso vira exceção, listada, nunca descartada em
  silêncio (F07-03). O ciclo exemplar (F07-05) é o mais aderente ao núcleo,
  desempatado pela duração mais próxima da mediana. **Os ciclos marcados
  suspeitos pela fase 04 são excluídos do consenso aqui** — é onde a regra
  "não usar no consenso" do cartão F04-05 vira ação de código, não só um
  destaque visual. **F07-04 (estabilidade de ordem) não está implementado**
  — motivo é estrutural, não falta de tempo: o alinhamento contra uma
  referência fixa é monotônico por construção (o traceback nunca anda pra
  trás), então qualquer par que sobrevive como combinação já é, por
  definição, não-decrescente — uma troca de posição de verdade não gera
  uma "combinação fora de ordem" detectável nessa tabela, vira lacuna nos
  dois lados. A troca ainda assim "aparece" (a ação cai em frequência e
  desce pra exceções), só que pelo canal da frequência, não por um alerta
  dedicado. Comentário detalhado no topo do arquivo.
- `js/fase07-ui.js` — tela da fase 07: pede ciclos (fase 04) e micro-ações
  (fase 05); calcula o consenso, mostra a tabela ação × ciclo (núcleo e
  exceções em tabelas separadas, colunas dos ciclos suspeitos marcadas
  "—"), avisa quando sobram poucos ciclos não suspeitos pra confiar no
  resultado (sem bloquear — grava mesmo assim, com a ressalva visível), e
  grava em `reconhecimento`. Diferente das fases 02-06, não depende de
  nada na sessão do navegador — só do dossiê — então funciona mesmo depois
  de recarregar a página.
- `tests/consenso-ciclos.test.mjs` — testes com cenários pequenos e
  hand-verificados (os valores esperados vieram de rodar as funções antes
  de escrever as asserções, não de conta de cabeça): alinhamento de
  sequências idênticas e com lacuna, escolha da referência pelo ciclo com
  mais ações, cálculo de frequência, corte de 80%, escolha do ciclo
  exemplar, e a exclusão de ciclos suspeitos do consenso.
- `js/agrupamento.js` — reconhecimento da estação (F08-01 a F08-07): a
  partir de `microAcoes.porCiclo` (todas as fronteiras, todos os ciclos)
  conta componentes e ferramentas distintos por nome (F08-01, F08-02); a
  partir do núcleo já calculado pela fase 07 (só o que é estável) conta
  ações estáveis e verificações — fronteiras de causa `pausa_conferencia`
  (F08-03, F08-04) — e monta a frase do relatório com plural/singular
  corretos (F08-05). O motor de fusão (`fundirAteSeis`) funde os vizinhos
  mais parecidos, segundo um critério escolhível, até sobrarem 6 grupos —
  nunca funde uma ação marcada não-fundível (verificação de conferência),
  e se não sobrar par fundível antes de chegar a 6 grupos, para em vez de
  forçar (`completo: false`, sinalizado na tela em vez de escondido). Três
  critérios prontos (`ferramenta_compartilhada`, `mesmo_componente`,
  `equilibrio_tempo`) geram até 3 alternativas de agrupamento (F08-06),
  cada uma listando os custos das fusões que cruzam causa ou ferramenta
  diferentes (F08-07 — "o que esta alternativa esconde"). **Nota de
  desvio do plano**: o critério "por face de montagem" citado no
  documento original foi substituído por "equilíbrio de tempo" — não há
  geometria de face de montagem modelada em nenhuma fase anterior, e
  inventar esse dado seria pior que declarar a troca. **Este mesmo motor
  de fusão será reusado, sem alteração, pela fase 09** (motor de
  consolidação, ainda não construída) — aqui ele só gera a prévia de cada
  alternativa para a pessoa escolher; lá ele vai aplicar de verdade a
  regra já homologada.
- `js/fase08-ui.js` — tela da fase 08: exige que a fase 07 já tenha
  gravado o núcleo do procedimento (senão explica o que falta, sem
  fingir); com núcleo disponível, mostra o relatório, a grade com as
  alternativas de agrupamento (cada uma com seus 6 passos e os custos que
  esconde), e — ao escolher uma — o formulário de homologação (nome,
  cargo, justificativa opcional). Nome e cargo são obrigatórios: SOP é
  documento de segurança, a homologação não é anônima (validado antes de
  gravar). Grava a regra homologada, junto com os números do relatório e
  as alternativas que foram apresentadas (para auditoria futura), na
  seção `reconhecimento` — a mesma seção que a fase 07 usa, ver nota
  abaixo sobre `campoDistintivo`. **F08-09 (a regra virar padrão
  automático das próximas estações) e F08-10 (detectar quando a regra não
  serve numa estação atípica) não estão implementados** — os dois
  dependem de uma biblioteca de estações reusável entre vídeos (pacote
  1.8.4) que ainda não existe; aqui a homologação vale só para o dossiê
  atual.
- `tests/agrupamento.test.mjs` — 11 testes: inventário de componentes e
  ferramentas (contagem certa, por nome, tempo total somado), contagem de
  fronteiras estáveis por causa, detecção de pausas de conferência,
  singular/plural certos no relatório, `fundirAteSeis` não mexendo quando
  já tem 6 ou menos grupos, nunca fundindo um grupo não-fundível mesmo
  sendo o mais parecido, cada critério fundindo pelos vizinhos certos
  (ferramenta compartilhada / equilíbrio de tempo), sinalização de custo
  quando a fusão cruza causas diferentes, e o caso de menos de 6 ações
  disponíveis (não força — `totalPassos` fica abaixo de 6, `completo:
  false`). A primeira tentativa de fixture de teste tinha dois critérios
  dando resultado idêntico por coincidência de empate — não era bug, era
  o desempate correto (sempre o par mais à esquerda), mas levou a
  redesenhar os dados de teste para diferenciar de verdade os critérios.
- **`campoDistintivo` em `js/fases.js`** — as fases 07 e 08 gravam as duas
  na seção `reconhecimento`, mas com formatos incompatíveis (07 grava
  `nucleo`; 08 grava `regraHomologada`). Pegar sempre "a versão mais
  recente da seção" (o que `obterVersaoAtual` fazia até aqui) devolveria
  silenciosamente o dado da fase errada assim que as duas tivessem
  rodado pelo menos uma vez. Corrigido com um campo `campoDistintivo` por
  fase (o nome do campo que identifica "isto é desta fase") e uma nova
  função em `js/app.js`, `obterVersaoComCampo(secao, campo)`, que percorre
  o histórico de trás para frente até achar a última versão que tem
  aquele campo — usada tanto no "Estado no dossiê" de cada fase quanto na
  leitura do núcleo pela fase 08. `faseRodou()` (o ponto verde da barra
  lateral) não precisou mudar — ele só verifica se existe alguma versão
  na seção, o que continua correto independente do formato.

## Onde o navegador para de bastar (fase 06 em diante)

Até a fase 05, o projeto inteiro roda 100% no navegador — nenhum servidor,
nenhuma chave, `python3 -m http.server` basta. A fase 06 precisa mandar
imagens pra um modelo de visão pago (Gemini), e isso quebra essa regra de
um jeito que não dá pra evitar: colocar a chave paga direto no JavaScript
do navegador a exporia a qualquer pessoa com o DevTools aberto.

A solução adotada é o menor desvio possível dessa regra: uma única função
serverless na Vercel (`api/leitura-semantica.js`), não um backend de
verdade. Ela guarda a chave como variável de ambiente do servidor — nunca
num arquivo do projeto, nunca no navegador — e é a única peça que sai do
"100% client-side". Todo o resto (fases 00 a 05, o dossiê, a navegação)
continua exatamente como estava.

**Para rodar isso de verdade:**
1. Publicar o projeto na Vercel (conectar o repositório, deploy automático
   a cada push).
2. Configurar `GEMINI_API_KEY` (e, se precisar, `GEMINI_MODEL`) no painel
   do projeto — ver `.env.example` para o que cada uma faz. **O nome exato
   do modelo de visão atual não foi confirmado**: o ambiente onde este
   código foi escrito não tem acesso de rede a domínios do Google, então o
   valor padrão embutido no código é um palpite razoável, não um fato
   verificado. Confirme no Google AI Studio antes de configurar em
   produção.
3. Para testar a fase 06 localmente com a função de verdade, é preciso
   `vercel dev` (que precisa da CLI da Vercel e login) em vez do
   `python3 -m http.server` simples — as fases 00 a 05 continuam
   funcionando com o servidor simples, só a 06 depende da função.

Depois de configurada, roda sozinha: a chave nunca precisa ser digitada por
ninguém a cada uso, não tem processo pra manter de pé (a Vercel escala a
função sozinha a cada chamada).

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

Sem build. Para abrir a demonstração (fases 00 a 05, tudo sem custo):

```
python3 -m http.server 8000
# depois abra http://localhost:8000/index.html
```

(Precisa de servidor local, não `file://`, porque a página busca
`fixtures/dossie-exemplo.json` via `fetch`.)

A fase 06 (leitura semântica) é a exceção — depende da função em `api/`,
que o `http.server` simples não serve. Ver "Onde o navegador para de
bastar" abaixo para rodar essa fase específica (precisa de `vercel dev`
ou de um deploy de verdade na Vercel).

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

A detecção de ciclos (1.3.5) foi validada de duas formas. Primeiro, com os
sinais sintéticos exatos dos testes automatizados (bloco `[0,0,0,100]`
repetido 4 vezes), confirmando que o algoritmo acha o período certo (4
frames = 2s) e corta 4 ciclos de exatamente 2s cada. Depois, no Chromium,
encadeando os quatro pacotes de verdade: gerei um vídeo de 8s com 4 ciclos
de 2s (1s "parado" + 1s de um bloco branco crescendo, simulando ação),
ingeri, extraí frames e detectei ciclos. O programa estimou 2,0s de duração
de ciclo (o valor exato) e cortou 3 ciclos completos (0–2s, 2–4s, 4–6,5s);
o trecho final do vídeo (~1,5s) não tinha correspondência de fechamento
dentro da janela de tolerância e ficou de fora da lista — não virou um
quarto ciclo forjado, que é o comportamento certo diante de um pedaço sem
repetição confirmada. Testei também um vídeo sem repetição nenhuma (cor
parada o tempo todo): a tela mostrou a mensagem de "nenhum padrão
repetitivo detectado" e a matriz de auto-similaridade sozinha, como
diagnóstico, sem oferecer o botão de gravar. Nenhum erro de página em
nenhum dos casos.

O fatiamento em micro-ações (1.3.6) foi testado de ponta a ponta no mesmo
Chromium: mapa de zonas (uma zona cobrindo o frame inteiro), ingestão,
extração, detecção de ciclos e fatiamento do vídeo de 4 ciclos — os 3
ciclos completos (a mesma detecção de 1.3.5) foram fatiados em 1 a 2
fatias cada, com frame-chave e miniatura corretos, contagem de fatias
batendo com a quantidade de miniaturas mostradas, e tudo gravado em
`microAcoes` sem erro de página. A classificação por causa deu sempre
`pausa_conferencia` nesse teste — e é o resultado *correto* pra esse
vídeo: uma zona cobrindo o frame inteiro reproduz a mesma curva geral, e
as fronteiras detectadas são justamente os vales dessa curva — não pode
haver um "pico" de zona bem no ponto que é definido como vale. A
classificação por causa específica (`componente_novo` vs
`troca_ferramenta` vs `combinada`) está verificada com precisão nos
testes automatizados, usando zonas esquerda/direita construídas à mão
para dar sinal distinto — não fiz o trabalho extra de gerar um vídeo
sintético com ação confinada a uma sub-região do frame só para essa
combinação; os testes puros já provam a lógica.

A leitura semântica (1.4.1 + 1.4.2 + 1.4.3) tem uma limitação de teste
importante e deliberada: **o ambiente onde este código foi escrito não tem
acesso de rede a domínios do Google**, então a chamada de verdade ao
Gemini nunca foi executada. O que foi validado:

- **A lógica pura** (`_leitura-semantica-core.js`): prompt e sanitização,
  13 testes automatizados, incluindo os casos de F06-04 (verbo/objeto fora
  da lista vira `indeterminado`, nunca erro nem dado inventado).
- **A canalização do lado do navegador**, num Chromium real, encadeando o
  pipeline inteiro (mapa de zonas → ingestão → extração → ciclos →
  fatiamento → leitura semântica): a chamada `fetch("/api/leitura-semantica")`
  foi interceptada com `page.route()` do Playwright e respondida com dados
  simulados — sem precisar da Vercel nem do Gemini de verdade. Isso provou
  que o payload é montado certo, que 5 fatias foram lidas em paralelo (lote
  de até 4) em 92ms, que uma resposta `indeterminado` simulada aparece
  destacada na tabela, e que gravar cria uma v2 de `microAcoes` com
  `leituraSemantica` em cada fatia sem apagar a v1 da fase 05.
- **O que não foi e não pôde ser testado aqui**: se `api/leitura-semantica.js`
  realmente conversa certo com a API do Gemini (o formato exato da
  requisição REST, o nome do modelo, o parsing da resposta). Isso só dá
  para confirmar depois do deploy na Vercel com uma `GEMINI_API_KEY` de
  verdade. **Decisão registrada**: o projeto segue em frente assumindo que
  essa chamada funciona, sem essa validação ter sido feita — não porque foi
  confirmada, mas por escolha explícita de manter o ritmo do projeto. Tudo
  que foi construído a partir daqui (fase 07 em diante) herda esse risco
  sem saber; é o primeiro item a conferir depois de um deploy de verdade.

O consenso entre ciclos (1.4.4 + 1.4.5) foi validado de duas formas.
Primeiro, com cenários pequenos e hand-verificados nos testes automatizados
(alinhamento com e sem lacuna, escolha de referência, frequência, corte de
80%, ciclo exemplar, exclusão de suspeitos). Foi exatamente esse processo
de verificação manual que expôs o problema estrutural do F07-04 descrito
acima — a primeira versão do código "passava" nos meus testes iniciais só
porque eu não tinha testado um caso que expusesse a limitação; rodar
cenários & imprimir o resultado antes de escrever a asserção (em vez de
supor o valor esperado) foi o que revelou isso.

Segundo, num Chromium real: como gerar um vídeo com exatamente a variação
de ações entre ciclos que eu queria testar seria impraticável, montei um
dossiê fixture à mão (`dossie-teste-consenso.json`, 5 ciclos, 1º e 5º
suspeitos, uma ação presente em só 2 dos 3 ciclos válidos) e carreguei
pelo botão normal de importar — o mesmo caminho que um usuário de verdade
usaria para abrir um dossiê salvo. A tela calculou exatamente o que a
lógica pura já tinha previsto (núcleo com as duas ações de 100%, exceção
com a de 67%, referência e exemplar no ciclo 2), gravou sem apagar as
seções anteriores, e o aviso de "poucos ciclos" apareceu certo quando
testado com um fixture reduzido a 1 ciclo não suspeito (sem bloquear o
botão de gravar). Nenhum erro de página em nenhum dos casos. Essa fase não
depende de vídeo nem de rede — só do dossiê — então essa validação não tem
a mesma ressalva de "não testado de verdade" que a fase 06 carrega.

O reconhecimento da estação (1.5.1 + 1.5.2 + 1.5.3) também foi validado de
duas formas. Primeiro, `js/agrupamento.js` tem 11 testes automatizados com
fixtures desenhados à mão para diferenciar de verdade os três critérios de
fusão (ver ressalva acima sobre a primeira tentativa de fixture, que
empatava dois critérios por coincidência).

Segundo, um encadeamento real no mesmo Chromium, desenhado especificamente
para exercitar o fix do `campoDistintivo`: montei um dossiê fixture
(`dossie-teste-fase08.json`) com `ciclos` e `microAcoes` já prontos (5
ciclos, 1º e 5º suspeitos, os 3 do meio com as mesmas 8 ações — 8 ações a
100% de núcleo, incluindo uma verificação de conferência não-fundível) mas
`reconhecimento` vazio de propósito, e carreguei pelo botão normal de
importar. Isso obrigou o teste a rodar a fase 07 de verdade (clicar
"Calcular consenso" → "Gravar", gravando a v1 de `reconhecimento` com
`nucleo`) antes de entrar na fase 08 — em vez de simular esse passo. Com
o núcleo de 8 ações disponível, a fase 08 mostrou o relatório certo ("4
componentes, 1 ferramenta, 8 ações estáveis, 1 verificação, ciclo de
0min10s"), as 3 alternativas, cada uma reduzida a exatamente 6 passos
(`completo: true`), com a fusão de "posicionar + encaixar + parafusar"
aparecendo diferente conforme o critério. Selecionar uma alternativa abriu
o formulário de homologação; tentar assinar sem nome/cargo mostrou o erro
certo; assinando como "Maria Teste / Engenheira de Processo" gravou a v2
de `reconhecimento` com `regraHomologada` completo (responsável, cargo,
critério escolhido, os 6 passos, as 3 alternativas apresentadas para
auditoria) e acendeu o ponto verde da fase 08. **O teste crítico**: depois
disso, voltar para a tela da fase 07 e conferir o "Estado no dossiê"
mostrou que ele continua exibindo a v1 (o `nucleo` da própria fase 07),
não a v2 (`regraHomologada` da fase 08) — provando que o fix do
`campoDistintivo` funciona de verdade num navegador real, não só na
leitura do código. Nenhum erro de página em nenhum dos passos.

## Próximos pacotes da EAP (não implementados ainda)

- **Validar `api/leitura-semantica.js` contra o Gemini de verdade.** Ainda
  o item de maior risco de tudo que foi construído até aqui — ver a
  ressalva de teste da fase 06 acima.
- 1.4.4 (parte descartada, não pendente) — estabilidade de ordem (F07-04).
  Diferente das outras lacunas desta lista, esta não é "ainda não
  construída" — é uma limitação estrutural documentada em
  `consenso-ciclos.js`: alinhamento contra uma referência fixa não
  consegue representar troca de posição como uma combinação fora de
  ordem, só como lacuna. Resolver isso de verdade precisaria de uma
  comparação de ordem relativa independente da tabela ancorada na
  referência.
- 1.1.3 — glossário completo da estação (nome oficial, código interno e
  foto de referência por item). Hoje a fase 06 usa os nomes já cadastrados
  no mapa de zonas como substituto — funciona, mas é mais pobre que o
  glossário de verdade (sem foto, sem itens que não sejam zona).
- 1.8.4 — biblioteca de estações (mapa de zonas, glossário, vocabulário de
  verbos, quadro-mestre e agora também a regra de agrupamento homologada,
  reusáveis entre vídeos). Sem isso, glossário e verbos ficam como estão
  hoje: constante fixa ou substituto via zonas, em vez de recurso próprio
  da estação — e a regra homologada na fase 08 fica presa a um dossiê só
  (ver F08-09/F08-10 acima).
- 1.3.5 (parte pendente) — revisão visual dos cortes com correção
  arrastável (F04-06: "uma tira de miniaturas com as linhas de corte, e a
  pessoa arrasta se estiver errado"). A detecção automática existe; falta
  a tela de edição interativa que recalcula os ciclos seguintes quando um
  corte é ajustado à mão.
- 1.2.2 — regra de imutabilidade (quando cada fase deve gravar versão nova).
  Adiado porque ainda não existe nenhuma fase de análise real reprocessando
  dado — a regra hoje não teria o que aplicar de verdade.
- 1.2.5 — painel de registro e custo (frames processados, chamadas feitas,
  gasto estimado). Com a fase 06 chamando um modelo pago de verdade agora,
  este pacote deixou de ser abstrato — é o próximo com utilidade real
  imediata.
- F08-09 / F08-10 (parte descartada por dependência, não pendente) — a
  regra homologada virar padrão automático das próximas estações da
  mesma linha, e detectar quando ela não serve numa estação atípica. Os
  dois precisam de uma biblioteca de estações reusável entre vídeos
  (1.8.4, ver abaixo) que ainda não existe — sem isso não há "próxima
  estação" para aplicar o padrão. Hoje a homologação da fase 08 vale só
  para o dossiê atual.
- fase 09 (consolidação nos 6 passos) é o próximo passo natural do
  pipeline: aplica a regra homologada pela fase 08 — sempre a mesma, sem
  perguntar de novo — reusando o mesmo motor de fusão de
  `js/agrupamento.js` que a fase 08 já usa para as prévias, agora de
  forma definitiva e determinística sobre os 6 passos do procedimento.
