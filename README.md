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
ver ressalva sobre a estabilidade de ordem), **1.5.1 + 1.5.2 + 1.5.3**
(reconhecimento da estação — inventário, relatório e alternativas de
agrupamento, com homologação humana), **1.5.4** (motor de consolidação —
aplica de verdade, sem perguntar de novo, a regra que a fase 08 homologou),
**1.6** (a ficha de cada passo — mãos, ferramenta, peças, critério de
conclusão, risco e estado do produto), a **fase 11** (mesa de validação
humana — a barreira fixada desde o início do projeto: nenhuma imagem antes
do aceite humano), a **fase 12** (prompts de ilustração — seis prompts em
camadas mais o quadro-mestre da bancada vazia) e a **fase 13** (geração
das imagens — a segunda e última chamada paga do projeto até aqui) da
EAP. Com isso, o bloco C do organograma (a parte "grátis" do pipeline)
está completo, a primeira chamada paga do projeto (bloco D, fase 06) já
existe — com uma ressalva de arquitetura importante, ver "Onde o
navegador para de bastar" — o bloco D inteiro (fases 06 e 07) está
fechado, o bloco E (fases 08, 09 e 10 — reconhecimento, consolidação e
ficha) também, e o pipeline inteiro até a geração de imagem (fases 11, 12
e 13) está implementado e testado — a barreira "nenhuma imagem antes do
aceite humano" agora é uma checagem de código de verdade, não só ausência
de fase.

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
- `js/consolidacao.js` — motor de consolidação (F09-02, pacote 1.5.4): não
  escolhe nada — pega o `criterioEscolhido` já homologado na fase 08 e
  reusa, sem alterar uma linha, `extrairAcaoBase` e `fundirAteSeis` de
  `js/agrupamento.js` sobre o núcleo *atual* do dossiê. É literalmente o
  mesmo motor que gerou a prévia que a pessoa assinou, agora aplicado de
  forma definitiva. Duas das três condições de saída da fase são
  garantidas pela construção do motor, não checadas como se pudessem
  falhar — documentado em detalhe no topo do arquivo: a ordem cronológica
  sobrevive porque o motor só funde vizinho com vizinho, nunca reordena; e
  uma verificação de conferência nunca some porque um grupo `naoFundivel`
  nunca é escolhido como lado de uma fusão. As contagens
  (`verificacoesNoNucleo`/`verificacoesNosPassos`) ficam expostas mesmo
  assim, como registro auditável, não como teste. A terceira condição ("4
  dos 6 batem com o SOP feito à mão") não é verificável — exigiria o SOP
  manual da estação digitalizado em algum lugar do programa, que não
  existe.
- `js/fase09-ui.js` — tela da fase 09: exige núcleo (fase 07) e regra
  homologada (fase 08) — sem escolha nem assinatura para colher, já que a
  decisão foi tomada na fase anterior — aplica a regra, mostra os 6 passos
  com a fusão duvidosa (a que cruzou causa ou ferramenta diferente)
  destacada em amarelo (`--hazard`, a mesma cor de aviso do resto do
  projeto), e grava em `passos`.
- `tests/agrupamento.test.mjs` (2 testes novos) — confirma que o campo
  `duvidosa` (adicionado a `js/agrupamento.js` nesta rodada, contagioso
  como `naoFundivel`: se qualquer fusão dentro da história de um grupo
  cruzou causa/ferramenta, o passo final inteiro fica marcado) aparece só
  no passo que resultou de uma fusão que cruza causa/ferramenta, e nunca
  numa fusão limpa.
- `tests/consolidacao.test.mjs` — 6 testes: aplica o critério e reduz a 6
  passos na ordem certa, marca como duvidosa só a fusão que cruza causa
  diferente, confirma que a verificação de conferência nunca é fundida,
  dois critérios diferentes produzem agrupamentos diferentes sobre o mesmo
  núcleo, um `criterioEscolhido` desconhecido (dossiê de outra versão do
  programa) devolve erro legível em vez de travar, e menos de 6 ações
  disponíveis não força um resultado forjado.
- `js/fichas.js` — pacote 1.6 (fase 10, "a ficha de cada passo"): cruza os
  6 passos da fase 09 com o núcleo da fase 07 (usando o `origem` de cada
  passo — a lista de rótulos das ações originais que foram fundidas nele
  — pra reencontrar a leitura semântica de cada uma) e deriva a ficha. Os
  campos têm confiança bem diferente entre si, e isso é declarado no
  código, não escondido: **mãos, ferramenta, peças e trecho de vídeo** são
  dado real, agregado da leitura semântica já registrada (mãos e
  ferramentas distintas de todas as ações fundidas num passo; peças só das
  causas `componente_novo`/`combinada`; trecho de vídeo é o mínimo/máximo
  dos tempos de início/fim das fatias resolvidas, dentro do ciclo exemplar
  que a fase 07 já escolheu, com um aviso quando uma ação não tinha dado
  nesse ciclo específico e precisou usar outro disponível). **Critério de
  conclusão** é uma frase derivada, não uma leitura de verdade: menciona
  conferência visual se o passo contém uma verificação, ou cita a última
  ação do passo caso contrário. **Risco não tem nenhuma fonte de dado em
  todo o pipeline** — em vez de inventar uma avaliação, o campo é um texto
  fixo declarando que não foi avaliado automaticamente e precisa de
  revisão na fase 11. **Estado do produto antes/depois** é a lista
  acumulada de peças instaladas até aquele ponto (soma progressiva ao
  longo dos passos) — uma aproximação por componentes agregados, não uma
  descrição visual do produto. A função ignora qualquer campo extra que já
  exista nos passos de entrada (só lê `numero`/`titulo`/
  `duracaoMediaSegundos`/`duvidosa`/`origem`), o que a torna idempotente:
  rodar a fase 10 sobre sua própria saída anterior dá o mesmo resultado.
- `js/fase10-ui.js` — tela da fase 10: sem escolha nem assinatura (tipo
  "padrao", igual à fase 09) — exige os passos consolidados (fase 09) e o
  núcleo (fase 07), gera as fichas, mostra um cartão por passo com todos
  os campos (a fusão duvidosa mantém a etiqueta amarela; o risco aparece
  na cor de alerta do projeto, `--alert`, pra chamar atenção visualmente
  de que precisa de revisão humana), e grava. **Grava sob a mesma chave
  `passos` que a fase 09 usa** — a ficha é um superconjunto compatível dos
  mesmos 6 passos, não uma seção paralela com formato diferente (ao
  contrário de "reconhecimento" nas fases 07/08), então não precisou de
  `campoDistintivo`: qualquer leitor de `passos.dados.passos` sempre acha
  a lista, seja a versão da fase 09 ou a da fase 10.
- `tests/fichas.test.mjs` — 10 testes: agrega mãos e ferramenta de todas
  as ações fundidas num passo, o trecho de vídeo cobre do início da
  primeira ação ao fim da última, o critério de conclusão muda certo com
  e sem verificação, o risco nunca varia do texto de "não avaliado"
  (nunca inventado), o estado do produto acumula peças na ordem certa sem
  repetir e não muda num passo sem peça nova, o fallback pro ciclo
  alternativo funciona quando o ciclo exemplar pedido não existe pra
  nenhuma ação, e `verificarCamposObrigatorios` não acusa nada numa ficha
  bem formada mas acusa `trechoVideo` ausente quando a origem não resolve
  nenhuma fatia.
- `js/validacao.js` — fase 11 (mesa de validação humana, "a barreira que
  não se automatiza"): compara os valores finais que a pessoa deixou em
  cada campo editável (`maos`, `ferramentas`, `pecas`, `criterioConclusao`,
  `risco`) contra o que a fase 10 tinha derivado, e guarda só o que de
  fato mudou — o valor original nunca é sobrescrito, fica acessível em
  `correcoes[campo].original` ao lado do `corrigido`. `titulo` e o estado
  do produto ficam de fora das correções de propósito: o segundo é
  acumulado entre TODOS os 6 passos, então corrigir um isoladamente
  quebraria a consistência da cadeia — se algo estiver errado ali, o
  ajuste correto é voltar pra fase 09/10, não remendar na validação.
  `montarAprovacao` junta original + correções + valor final de cada
  ficha com os dados de quem assinou (nome, cargo, data/hora, total de
  correções feitas) — aprovar sem nenhuma correção também é um resultado
  válido (`totalCorrecoes: 0`), não um erro.
- `js/fase11-ui.js` — tela da fase 11: um cartão editável por passo, com
  os 5 campos acima como formulário (mãos/ferramenta/peças como texto
  separado por vírgula; critério de conclusão e risco como texto livre —
  risco com borda na cor de alerta do projeto, `--alert`, pra chamar
  atenção visualmente de que aquele campo em particular nunca foi avaliado
  de verdade antes daqui) e o **trecho de vídeo lado a lado**: quando o
  vídeo original ainda está na sessão do navegador (`sessao-midia.js`,
  mesma limitação de sessão das fases 02-06 — reprocessar o dossiê ou
  recarregar a página perde o vídeo, mas nunca o dado gravado), mostra um
  `<video>` de verdade recortado no trecho daquele passo: no
  `loadedmetadata` faz o seek pro início do trecho, e um `timeupdate`
  pausa e trava o vídeo no fim do trecho, pra pessoa nunca vazar pro
  próximo passo sem perceber. Sem vídeo na sessão, mostra só os tempos do
  trecho em texto, nunca fingindo que o vídeo está ali. Só grava depois
  de nome + cargo preenchidos (mesma exigência de identificação da fase
  08 — "SOP é documento de segurança"). **Esta é a barreira fixada desde
  o início do projeto** ("nenhuma imagem é gerada antes do aceite humano
  das fichas dos 6 passos") — hoje o bloqueio é a própria ausência das
  fases 12/13 (geração de imagem ainda não existe no programa), não uma
  checagem de código; quando essas fases forem construídas, é ali que
  precisam verificar se existe uma versão gravada em `aprovacoes` antes
  de rodar.
- `tests/validacao.test.mjs` — 9 testes: nenhuma correção registrada
  quando nada muda, só o campo que de fato mudou é registrado, comparação
  de lista por conteúdo (não por identidade do array — trocar `["direita"]`
  por um array novo com o mesmo conteúdo não conta como correção),
  detecção de mudança dentro de uma lista, `titulo`/`estadoProduto`
  ficam fora das correções mesmo se "mudarem", o original nunca some
  depois de aplicar uma correção, validação de assinatura (nome/cargo
  obrigatórios, espaço em branco conta como vazio), e `montarAprovacao`
  monta certo tanto com correções quanto com zero correções.
- `js/biblia-visual.js` — a "bíblia visual" do plano original, versão
  simplificada (mesmo espírito de `vocabulario-verbos.js`): uma constante
  fixa de estilo de ilustração (técnica, paleta, ângulo de câmera, fundo),
  não uma tela de edição nem um recurso reusável de verdade entre vídeos.
  A bíblia visual de verdade é recurso da estação (biblioteca de estações,
  pacote 1.8.4, ainda não construída) — até lá, todo dossiê usa este mesmo
  estilo fixo, definido em código, nunca escolhido pela pessoa.
- `js/prompts.js` — fase 12 (prompts de ilustração, "o comando exato que
  a IA de imagem vai receber"): monta uma **camada compartilhada** (nome
  da estação + zonas do mapa da fase 00 + o estilo de `biblia-visual.js` +
  uma instrução negativa fixa contra texto embutido na imagem) — a mesma
  string, byte a byte, em todos os sete prompts — e concatena com uma
  **camada específica** por prompt: para o quadro-mestre, a instrução de
  bancada vazia (sem peça, sem mão, sem operador); para cada um dos 6
  passos, os dados reais da ficha aprovada na fase 11 (mãos, ferramenta,
  peças, estado do produto antes/depois, critério de conclusão). **O
  campo `risco` nunca entra no prompt** — é dado de segurança para a
  documentação final (o texto sobreposto da fase 15), não uma instrução
  visual; não existe "desenhar risco de esmagamento" numa ilustração
  técnica da cena (decisão descoberta ao testar em navegador — ver "Como
  isso foi testado" — e travada com um teste automatizado dedicado, pra
  nunca regredir por engano). Os "70% de texto idêntico" citados no plano
  original não são um número que o código mede ou persegue — são só a
  consequência natural de reusar a mesma camada compartilhada, literalmente
  igual; o que o código garante é essa igualdade estrutural, testada como
  tal. Os dois gates da fase: `verificarSemPedidoDeTexto` é uma checagem
  por palavra-chave (o texto fixo do programa nunca pede texto embutido
  sozinho; o risco real é um campo de ficha corrigido à mão na fase 11
  que descreva, sem querer, um pedido de texto — por isso é heurística,
  não prova) e `verificarCobertura` confirma que cada dado real da ficha
  (mãos, ferramenta, peças, título) aparece no texto final do prompt —
  uma aproximação de "lendo só o prompt você conseguiria desenhar a
  cena", não uma prova de que o prompt é bem escrito.
- `js/fase12-ui.js` — tela da fase 12: exige uma aprovação gravada na
  fase 11 (lê o `final` de cada ficha, já com as correções aplicadas);
  gera o quadro-mestre e os 6 prompts, roda os dois gates em cada um, e
  mostra cada prompt com a camada compartilhada em cinza e a parte
  específica do passo em preto — visualmente clara qual fração do texto é
  igual entre todos. Grava só depois de mostrado; não há assinatura aqui
  (tipo "padrao", igual às fases 09/10).
- `tests/prompts.test.mjs` — 9 testes: a camada compartilhada é idêntica
  no quadro-mestre e em todos os prompts de passo, o quadro-mestre
  descreve a bancada vazia, o prompt do passo cobre mãos/ferramenta/peças,
  `verificarCobertura` acusa exatamente o que falta, nenhum prompt gerado
  pelo template pede texto embutido, `verificarSemPedidoDeTexto` pega um
  pedido de texto vindo de dado da ficha (não do template), a ordem dos
  passos recebidos é preservada sem reordenar, uma estação sem zonas
  mapeadas não quebra, e o campo `risco` nunca aparece no prompt.
- `api/_gerar-imagem-core.js` — núcleo puro da fase 13: monta as `parts`
  da requisição pro Gemini (o prompt de texto, mais — quando houver — a
  imagem de referência do elo anterior da cadeia, como `inline_data`) e
  extrai/valida a imagem da resposta, explicando o motivo (inclusive o
  `finishReason` do modelo, por exemplo quando a resposta é bloqueada por
  segurança) quando nenhuma imagem vem — nunca finge sucesso com um
  resultado vazio, mesmo princípio de F06-04 na leitura semântica.
- `api/gerar-imagem.js` — a função que roda fora do navegador (a
  **segunda e última chamada paga** do projeto planejada até aqui, mesmo
  motivo de arquitetura de `api/leitura-semantica.js` — ver "Onde o
  navegador para de bastar"): recebe prompt + referência opcional +
  semente do cliente, chama o Gemini com a chave do servidor, devolve a
  imagem gerada em base64. **Mesma ressalva de modelo não confirmado da
  fase 06**: o nome exato do modelo de imagem da conta paga não foi
  verificado (sem acesso de rede a domínios do Google no ambiente onde
  isto foi escrito) — o valor padrão embutido (`gemini-2.5-flash-image`)
  é um palpite razoável, não um fato confirmado.
- `js/geracao-imagens.js` — orquestração da cadeia de geração. Diferente
  da fase 06 (onde cada fatia é independente e cabe em lotes livres),
  aqui a cadeia é sequencial por construção: `montarPlanoDeGeracao`
  decide, sem chamar rede nenhuma, quem referencia quem — o quadro-mestre
  primeiro, sem referência; cada passo referencia a **variação-âncora**
  (a primeira das três) do elo anterior, nunca uma referência aleatória;
  as variações 2 e 3 de cada passo usam a mesma referência da
  variação-âncora, não referências entre si, pra a incerteza de uma
  variação nunca se acumular sobre a próxima etapa. `gerarTodasAsImagens`
  roda o plano elo por elo (as 3 variações de um mesmo passo rodam em
  paralelo entre si; entre elos é sequencial, porque um elo depende da
  imagem que o anterior gerou), com a mesma retentativa de espera
  progressiva de `leitura-semantica.js`. **É aqui que a barreira "nenhuma
  imagem antes do aceite humano" — fixada desde a primeira mensagem deste
  projeto — vira checagem de código pela primeira vez**: a função recusa
  rodar (lança erro, não silencia) sem receber `aprovacaoExiste: true`,
  mesmo que os prompts existam prontos de uma sessão anterior.
- `js/fase13-ui.js` — tela da fase 13: exige prompts (fase 12) e, acima
  de tudo, uma aprovação gravada (fase 11) — sem ela, mostra um bloqueio
  explícito e nem desenha o botão de gerar (defesa em duas camadas: a
  tela nem oferece o botão, e mesmo que oferecesse, `geracao-imagens.js`
  recusaria por conta própria). Avisa o custo antes de gerar (19 chamadas
  no plano de 6 passos × 3 variações + 1 quadro-mestre), mostra cada
  imagem assim que chega, e — igual ao vídeo (F01-01) — **as imagens em
  si nunca entram no dossiê**: ficam em `sessao-midia.js`, só na sessão
  da aba atual; o dossiê grava só metadados por item (prompt usado via
  referência, semente, o que foi referenciado, sucesso ou o motivo do
  erro, tamanho aproximado em bytes) — o suficiente pra auditar sem
  guardar potencialmente dezenas de MB de imagem em JSON.
- `tests/gerar-imagem-core.test.mjs` — 6 testes: monta as partes com e
  sem referência, extrai imagem tanto do formato `inline_data` quanto
  `inlineData` (a API do Gemini historicamente aceita as duas grafias em
  contextos diferentes — o código cobre ambas por segurança), explica o
  motivo (inclusive `finishReason`) quando não vem imagem, e não trava
  com uma resposta vazia ou malformada.
- `tests/geracao-imagens.test.mjs` — 11 testes: retentativa e desistência
  (mesmo padrão da fase 06), o plano tem exatamente 1 + passos×variações
  itens, o passo 1 referencia o quadro-mestre e o passo 2 referencia a
  âncora do passo 1 (nunca variação 2 ou 3), sementes distintas e
  determinísticas, **a geração recusa sem `aprovacaoExiste` (inclusive
  quando o parâmetro vem `undefined` por engano, não só `false`
  explícito)**, o número certo de chamadas com a referência certa em cada
  uma (confirmado rastreando o payload de cada chamada simulada, não só
  contando quantas houve), as 3 variações de um mesmo passo rodam em
  paralelo (concorrência real medida, não só contagem), e um erro numa
  variação não trava as outras nem o resto da cadeia.

## Onde o navegador para de bastar (fase 06 em diante)

Até a fase 05, o projeto inteiro roda 100% no navegador — nenhum servidor,
nenhuma chave, `python3 -m http.server` basta. A fase 06 precisa mandar
imagens pra um modelo de visão pago (Gemini), e isso quebra essa regra de
um jeito que não dá pra evitar: colocar a chave paga direto no JavaScript
do navegador a exporia a qualquer pessoa com o DevTools aberto. A fase 13
(geração de imagem) tem exatamente o mesmo problema, com a mesma solução.

A solução adotada é o menor desvio possível dessa regra: duas funções
serverless na Vercel (`api/leitura-semantica.js` para a fase 06,
`api/gerar-imagem.js` para a fase 13), não um backend de verdade. As duas
guardam a chave como variável de ambiente do servidor — nunca num arquivo
do projeto, nunca no navegador — e são as únicas peças que saem do "100%
client-side". Todo o resto (fases 00 a 05, 07 a 12, o dossiê, a
navegação) continua exatamente como estava.

**Para rodar isso de verdade:**
1. Publicar o projeto na Vercel (conectar o repositório, deploy automático
   a cada push).
2. Configurar `GEMINI_API_KEY` (obrigatória, compartilhada pelas duas
   funções) e, se precisar, `GEMINI_MODEL` e `GEMINI_IMAGE_MODEL` no
   painel do projeto — ver `.env.example` para o que cada uma faz. **O
   nome exato dos modelos de visão e de imagem da conta paga não foi
   confirmado, em nenhum dos dois casos**: o ambiente onde este código
   foi escrito não tem acesso de rede a domínios do Google, então os
   valores padrão embutidos no código são palpites razoáveis, não fatos
   verificados. Confirme os dois no Google AI Studio antes de configurar
   em produção.
3. Para testar as fases 06 ou 13 localmente com as funções de verdade, é
   preciso `vercel dev` (que precisa da CLI da Vercel e login) em vez do
   `python3 -m http.server` simples — as demais fases continuam
   funcionando com o servidor simples, só essas duas dependem de função.

Depois de configuradas, rodam sozinhas: a chave nunca precisa ser digitada
por ninguém a cada uso, não tem processo pra manter de pé (a Vercel
escala as funções sozinha a cada chamada).

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

O motor de consolidação (1.5.4) também foi validado de duas formas.
Primeiro, `tests/consolidacao.test.mjs` — 6 testes com o mesmo núcleo de 8
ações do fixture de navegador da fase 08 (dado comparável entre os dois
pacotes): reduz a 6 passos na ordem certa, marca `duvidosa` só no passo
que resultou de fusão de causa diferente, confirma que a verificação de
conferência nunca é fundida (contagem batendo 1 no núcleo / 1 nos passos
finais), critérios diferentes dão resultados diferentes sobre o mesmo
núcleo, um `criterioEscolhido` desconhecido não trava, e menos de 6 ações
não força um resultado.

Segundo, um encadeamento completo num Chromium real: carreguei o mesmo
fixture da fase 08 (`dossie-teste-fase08.json`), fui direto pra fase 09 —
mostrou a mensagem certa pedindo pra homologar na fase 08 primeiro; rodei
o consenso na fase 07 (gravando o núcleo) e voltei pra fase 09 — ainda
pedia a homologação, confirmando que a fase 09 depende dos DOIS
(`campoDistintivo: "nucleo"` sozinho não bastava); homologuei "Por
ferramenta compartilhada" na fase 08; voltando à fase 09, ela aplicou a
regra sem pedir nada — mostrou "Consolidado em 6 passos", os 6 títulos
certos, a fusão "posicionar + encaixar + parafusar Suporte L-32"
destacada com a classe `passo-duvidoso` e a etiqueta "fusão duvidosa" (a
única entre as seis, exatamente a esperada), e a legenda "verificações no
núcleo: 1 · verificações nos passos finais: 1 — nenhuma sumiu". Gravar
acendeu o ponto verde da fase 09 e salvou tudo em `passos`. Por rigor,
voltei também às fases 07 e 08 depois disso — os dois continuavam com seu
próprio estado íntegro, como esperado (fase 09 grava numa seção
diferente, `passos`, então isso nunca esteve em risco pelo mesmo motivo do
`campoDistintivo`, mas confirmei mesmo assim). Nenhum erro de página em
nenhum passo. **Nota sobre o processo de teste**: a primeira rodada deste
mesmo roteiro relatou, por engano, que a fase 07 tinha perdido seu núcleo
depois da fase 09 gravar — investiguei antes de aceitar o resultado (não
é hábito deste projeto reportar uma regressão sem confirmar), isolei o
passo com um script de depuração à parte, e repeti o roteiro original: o
núcleo estava intacto. Foi uma corrida de tempo pontual do próprio script
de teste (não do aplicativo) — registrado aqui em vez de simplesmente
apagado, porque relatar só o resultado final sem essa checagem teria
escondido uma dúvida real que existiu.

A ficha de cada passo (1.6) também foi validada de duas formas. Primeiro,
`tests/fichas.test.mjs` — 10 testes sobre o mesmo núcleo de 8 ações usado
nos pacotes anteriores, com mãos e ferramentas diferenciadas de propósito
pra exercitar a agregação: mãos e ferramenta batem certo quando um passo
funde várias ações originais, o trecho de vídeo cobre do início ao fim
certos, o critério de conclusão muda com e sem verificação, o risco nunca
varia (sempre o texto de "não avaliado" — provando que não há caminho de
código que invente uma avaliação), o estado do produto acumula peças sem
repetir e sem mudar num passo sem peça nova, o fallback pro ciclo
alternativo funciona, e a idempotência (rodar sobre a própria saída
anterior) foi confirmada tanto no teste automatizado quanto no navegador
a seguir.

Segundo, um encadeamento completo num Chromium real, dessa vez cobrindo a
cadeia inteira 07 → 08 → 09 → 10 com o mesmo fixture das fases anteriores:
sem os passos consolidados, a fase 10 pediu pra rodar a fase 09 primeiro;
depois de rodar 07 (consenso), 08 (homologação) e 09 (consolidação) em
sequência, a fase 10 gerou as 6 fichas certas — mãos e ferramenta
agregadas corretamente no passo fundido (a mesma fusão duvidosa da fase
09, com a etiqueta preservada), critério de conclusão certo em cada um
(conferência visual só no passo que tem a verificação), risco idêntico
nos 6 (o texto fixo), estado do produto acumulando as 4 peças na ordem
certa, e o trecho de vídeo de cada passo batendo com os tempos do
fixture. Gravar acendeu o ponto verde da fase 10. Por fim, testei a
idempotência de propósito: saí e voltei pra fase 10 (agora com `passos`
já na versão enriquecida da própria fase 10) e rodei de novo — gerou
exatamente as mesmas 6 fichas, sem erro, confirmando que a função ignora
com segurança os campos extras que ela mesma tinha adicionado da vez
anterior — e a fase 09, visitada depois, continuou funcionando normalmente
(ela nunca leu a seção `passos`, só grava nela, então nunca esteve em
risco por esse motivo, mas confirmei mesmo assim). Nenhum erro de página
em nenhum passo.

A mesa de validação humana (fase 11) foi validada em três frentes, porque
é a barreira mais importante do projeto do ponto de vista de segurança.
Primeiro, `tests/validacao.test.mjs` — 9 testes sobre a lógica pura de
comparação/correção (ver lista de módulos acima).

Segundo, um encadeamento completo 07 → 08 → 09 → 10 → 11 num Chromium
real, com o mesmo fixture das fases anteriores (sem vídeo na sessão, de
propósito — o caso mais comum na prática, já que ele depende de a mesma
aba nunca ter recarregado): fase 11 sem os passos consolidados pediu pra
rodar a fase 09; com os passos mas sem as fichas (fase 10 não rodou)
avisou exatamente isso, em vez de tentar montar um formulário quebrado
com campos que não existem; depois de rodar a fase 10, mostrou os 6
cartões editáveis, cada um com a legenda correta de "vídeo não disponível
nesta sessão" e os tempos do trecho. Testei a leitura do campo `risco` do
passo 1 (confirmando que vem pré-preenchido com o texto fixo "não
avaliado" da fase 10), corrigi só esse campo, deixei os outros 5 passos
intocados, tentei assinar sem nome/cargo (erro certo), assinei de
verdade, e conferi o dossiê gravado: `aprovacao.totalCorrecoes` = 1, a
ficha 1 tinha `original.risco` (o texto fixo, preservado) e
`final.risco` (o texto corrigido) ao mesmo tempo, e a ficha 2 tinha
`correcoes: {}` com `final.risco` idêntico ao texto padrão — provando que
"aceitar como está" e "corrigir" convivem corretamente na mesma
aprovação.

Terceiro, um teste focado só no recorte de vídeo lado a lado — a parte
que o encadeamento acima não podia cobrir, porque importar um dossiê por
JSON nunca populou o vídeo em memória. Montei um fixture menor com
`passos` já no formato da fase 10 (pulando o clique em 07-10) com dois
trechos de vídeo curtos (0,5s–1,5s e 2s–3s), subi um vídeo sintético de
4s pela fase 02 de verdade (para popular `sessao-midia.js`, sem precisar
gravar `origemVideo` no dossiê em si) e fui pra fase 11: os dois cartões
mostraram um `<video>` de verdade com `src` do tipo `blob:`; o vídeo do
passo 1 fez o seek certo pro início do trecho assim que carregou os
metadados (`currentTime` = 0,5s, confirmado depois do evento
`loadedmetadata`); e, dando play a partir de 1,4s e esperando a
reprodução avançar, o vídeo parou sozinho exatamente em `currentTime` =
1,5s (o fim do trecho) com `paused: true` — confirmando que o clamp do
`timeupdate` funciona de verdade, não só na leitura do código. Nenhum
erro de página em nenhum dos três testes.

Os prompts de ilustração (fase 12) foram validados com `tests/prompts.test.mjs`
(9 testes, ver lista de módulos acima) e um encadeamento completo
07 → 08 → 09 → 10 → 11 → 12 num Chromium real, com o mesmo fixture das
fases anteriores: sem fichas aprovadas, a fase 12 pediu pra rodar a fase
11 primeiro (testado tanto antes quanto depois de rodar 07-10, pra
confirmar que a dependência é realmente da aprovação, não dos passos por
si só); depois de aprovar (corrigindo o risco do passo 1 de propósito, pra
confirmar que a fase 12 lê o valor `final` pós-correção, não o `original`
da fase 10), a fase 12 gerou os 7 prompts esperados (quadro-mestre + 6
passos), todos passando nos dois gates, com a camada compartilhada
comprovadamente idêntica (comparei a string exata extraída de cada um dos
7 cartões — um único valor distinto no conjunto). Gravar acendeu o ponto
verde da fase 12.

**Um achado real durante este teste, não um bug**: a primeira versão do
roteiro esperava que o risco corrigido ("Risco de esmagamento dos dedos —
usar luva.") aparecesse no texto do prompt do passo 1, e ele não
aparecia. Investiguei antes de "corrigir" qualquer coisa — a mesma
disciplina de nunca aceitar um resultado surpreendente sem entender por
quê — e percebi que o comportamento estava certo: `risco` é dado de
segurança para a documentação final (o texto sobreposto da fase 15), não
uma instrução visual para uma IA de ilustração técnica. O teste do
roteiro foi corrigido para confirmar o oposto (o risco NÃO aparece), a decisão
foi documentada explicitamente no comentário de `js/prompts.js`, e um
teste automatizado dedicado (`tests/prompts.test.mjs`) trava esse
comportamento contra regressão futura. Registrado aqui porque esse é
exatamente o tipo de coisa que vale mais a pena mostrar o processo do que
só o resultado final. Nenhum erro de página em nenhum passo do teste.

A geração das imagens (fase 13) foi validada em três frentes, porque é a
fase que aplica de verdade a barreira mais importante do projeto — e
porque a chamada de verdade ao Gemini de imagem tem a mesma limitação de
rede já registrada na fase 06 (sem acesso a domínios do Google neste
ambiente). Primeiro, `tests/gerar-imagem-core.test.mjs` (6 testes) e
`tests/geracao-imagens.test.mjs` (11 testes) — lógica pura e orquestração
com `fetch` simulado, ver lista de módulos acima.

Segundo, o **teste do bloqueio**, feito de propósito com um fixture
adversarial que o fluxo normal da interface nunca produziria: um dossiê
com a seção `prompts` já preenchida (como se a fase 12 tivesse rodado)
mas `aprovacoes` vazia — simulando um dossiê editado por fora, já que a
UI normal nunca chega nesse estado (a fase 12 já exige aprovação pra
rodar). Importar esse fixture e ir direto pra fase 13 mostrou o bloqueio
explícito, sem nenhum botão de gerar desenhado na tela, e confirmei que
**zero chamadas** chegaram ao proxy interceptado — não é só a mensagem
que muda, a chamada de rede paga realmente não acontece.

Terceiro, um encadeamento completo 07 → 08 → 09 → 10 → 11 → 12 → 13 num
Chromium real, com `/api/gerar-imagem` interceptado via `page.route()`
(mesmo padrão da fase 06) devolvendo uma imagem PNG 1×1 válida em base64.
Depois de aprovar na fase 11 e montar os prompts na fase 12, a fase 13
mostrou o aviso de custo (19 imagens: 1 quadro-mestre + 6 passos × 3
variações), gerou as 19 de verdade — confirmei a contagem exata de
chamadas ao proxy e que todos os 19 cartões mostraram uma imagem
(`<img>` com `src` de dado válido) — e gravar no dossiê confirmou o mais
importante do ponto de vista arquitetural: os metadados salvos (`itens`) **não têm o
campo `imagemBase64`** em nenhum item, e o "Estado no dossiê" inteiro
ficou com pouco mais de 3 KB — não os potenciais megabytes que 19
imagens em base64 ocupariam se tivessem ido para o JSON. Nenhum erro de
página em nenhum dos três testes.

## Próximos pacotes da EAP (não implementados ainda)

- **Validar `api/leitura-semantica.js` e `api/gerar-imagem.js` contra o
  Gemini de verdade.** Ainda os itens de maior risco de tudo que foi
  construído até aqui — ver a ressalva de teste das fases 06 e 13 acima.
  As duas funções nunca foram chamadas de verdade (só simuladas via
  `page.route()`); o nome exato dos dois modelos (visão e imagem) também
  não foi confirmado.
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
- F08-09 / F08-10 (parte descartada por dependência, não pendente) — a
  regra homologada virar padrão automático das próximas estações da
  mesma linha, e detectar quando ela não serve numa estação atípica. Os
  dois precisam de uma biblioteca de estações reusável entre vídeos
  (1.8.4, ver abaixo) que ainda não existe — sem isso não há "próxima
  estação" para aplicar o padrão. Hoje a homologação da fase 08 (e a
  consolidação da fase 09 que a aplica) valem só para o dossiê atual.
- "4 dos 6 passos coincidem com o SOP feito à mão" (o terceiro critério de
  saída da fase 09, junto com F08-09/F08-10 acima) — não é verificável com
  o que o programa guarda hoje: exigiria o SOP manual da estação
  digitalizado em algum lugar do dossiê ou da biblioteca de estações
  (1.8.4), e isso não existe em nenhum pacote da EAP até aqui. (O campo
  `risco`, que tinha a mesma limitação, já não está mais nesta lista — a
  fase 11 agora permite preenchê-lo de verdade, com o valor original da
  fase 10 preservado ao lado da correção.)
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
- A bíblia visual de verdade (glossário visual reusável por estação, com
  referências de imagem) — hoje `js/biblia-visual.js` é uma constante fixa
  igual pra todo dossiê, mesma simplificação de `vocabulario-verbos.js`.
  Depende da biblioteca de estações (1.8.4, ver acima).
- Escolha entre as 3 variações de cada passo — hoje a fase 13 gera as
  três e grava metadados das três, mas não existe nenhuma tela pra uma
  pessoa escolher qual das três (ou se nenhuma) representa bem o passo.
  Isso não estava explícito no plano original como pacote separado; fica
  registrado aqui como lacuna descoberta ao implementar F13.
- fase 14 (verificação cega) é o próximo passo natural do pipeline: a
  **terceira** chamada paga do projeto (o plano original não deixa isso
  óbvio à primeira vista, mas o `tipo: "pago"` de `fases.js` já estava
  certo desde a fase 1.2.4) — manda as imagens geradas, sozinhas e sem a
  ficha, de volta pro Gemini, pedindo uma nota por quadro, checagem de
  continuidade entre eles e um teste de ordem embaralhada (a sequência
  precisa ser reconstruível só pelas imagens). Tem uma limitação de
  arquitetura herdada da fase 13: como as imagens vivem só na sessão do
  navegador (nunca no dossiê — ver acima), a fase 14 só pode rodar na
  MESMA aba/sessão onde a fase 13 gerou as imagens, a menos que se
  resolva primeiro como reidratar imagens de uma sessão anterior (fora de
  escopo até aqui).
