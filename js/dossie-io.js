// Pacote EAP 1.2.3 — Exportar e importar o dossiê.
// É o ponto de salvamento manual (F01-03): baixar o JSON, fechar o
// navegador, reabrir, carregar de volta e continuar de onde parou. Nenhuma
// imagem em tamanho real trafega aqui — o risco descrito em F01-01 ("um
// dossiê de 300 MB trava o navegador") é evitado a montante, guardando nas
// seções só referências e tempos, nunca os binários.
//
// PASSO 1 — o padrão de download (Blob + <a download> + click programático)
// definido aqui em exportarDossie é reusado sem alteração, muitos pacotes
// depois, por js/fase15-ui.js pra baixar cada página do SOP como PNG — é
// o único jeito nativo do navegador de "salvar arquivo" sem servidor.
// `doc` é parâmetro (default `document`) só pra este módulo continuar
// testável no Node puro (tests/dossie.test.mjs passa um documento falso),
// sem precisar de jsdom nem de um navegador de verdade pra um teste que é
// só sobre a forma da string e do nome de arquivo.
//
// PASSO 2 — por que importar lança exceção em vez de devolver {valido:false}
// como validarDossie faz. Import é uma ação do usuário (clicar "Carregar
// dossiê") com um resultado binário claro: ou a tela continua com o
// dossiê antigo e mostra o erro, ou troca pra o novo. Um throw (capturado
// pela UI) deixa esse "ou isto ou aquilo" explícito no controle de fluxo,
// em vez de espalhar `if (!resultado.valido) return` por todo lugar que
// chama importar.

import { validarDossie } from "./dossie-validar.js";

function nomeArquivoPadrao(dossie) {
  const base = (dossie?.estacao?.nome || "sem-nome")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `sop-dossie-${base || "sem-nome"}-${timestamp}.json`;
}

// Baixa o dossiê como arquivo .json no navegador do usuário. `document` é
// injetado para o módulo continuar testável fora do navegador.
export function exportarDossie(dossie, { nomeArquivo, doc = document } = {}) {
  const conteudo = JSON.stringify(dossie, null, 2);
  const blob = new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = url;
  link.download = nomeArquivo || nomeArquivoPadrao(dossie);
  doc.body.appendChild(link);
  link.click();
  doc.body.removeChild(link);
  URL.revokeObjectURL(url);
  return link.download;
}

// Serializa sem disparar download — usado pelos testes e por quem quiser
// oferecer a mesma exportação por outro caminho (ex.: copiar para a área de
// transferência).
export function serializarDossie(dossie) {
  return JSON.stringify(dossie, null, 2);
}

class ErroImportacao extends Error {
  constructor(mensagem, { erros = [], avisos = [] } = {}) {
    super(mensagem);
    this.name = "ErroImportacao";
    this.erros = erros;
    this.avisos = avisos;
  }
}

// Lê um texto JSON e devolve { dossie, avisos } se a estrutura for válida.
// Lança ErroImportacao (com a lista de erros) se não for — quem chama decide
// como mostrar isso na tela.
export function importarDossieDeTexto(texto) {
  let dossie;
  try {
    dossie = JSON.parse(texto);
  } catch (e) {
    throw new ErroImportacao("O arquivo não é um JSON válido.", { erros: [e.message] });
  }
  const { valido, erros, avisos } = validarDossie(dossie);
  if (!valido) {
    throw new ErroImportacao("O arquivo não tem o formato de um dossiê SOP.", { erros, avisos });
  }
  return { dossie, avisos };
}

// Lê um File (ex.: vindo de <input type="file">) e devolve a mesma coisa que
// importarDossieDeTexto, de forma assíncrona.
export function importarDossieDeArquivo(file) {
  return file.text().then(importarDossieDeTexto);
}

export { ErroImportacao };
