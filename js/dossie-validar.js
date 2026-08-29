// Validação estrutural do dossiê. Fica separada de dossie.js porque quem
// precisa dela é sobretudo a importação (1.2.3): um arquivo carregado de
// volta pode vir de outra versão do formato ou ter sido editado à mão, e o
// erro precisa apontar o campo, não só dizer "inválido" (ver risco em F01-02:
// "estrutura que muda toda semana").
//
// PASSO 1 — por que validação escrita à mão, e não uma lib de JSON Schema.
// O projeto é sem build e sem dependência externa (mesma restrição que
// levou fase15-ui.js a usar window.print() em vez de uma lib de PDF) —
// puxar uma lib de schema exigiria empacotamento ou um CDN, nenhum dos
// dois presente aqui. O dossiê também não é grande nem tem estrutura
// profundamente aninhada — dez seções, cada uma uma lista de versões com
// a mesma forma — então validar campo a campo é mais direto de ler do
// que aprender a sintaxe de um schema pra um caso tão contido.
//
// PASSO 2 — por que "erro" e "aviso" são coisas diferentes, não um único
// booleano válido/inválido. Um dossiê de versão de formato diferente, ou
// com uma seção desconhecida, ainda dá pra abrir e trabalhar — só corre
// o risco de ter campo faltando que este programa não sabe preencher.
// Isso não deveria IMPEDIR a importação (bloquear teria o mesmo efeito
// prático de perder o trabalho de quem gravou aquele dossiê), então vira
// aviso, não erro. Já um dossiê sem `secoes.origemVideo.versoes` como
// lista, por exemplo, não tem como ser lido de forma sã por nenhuma fase
// — isso é erro de verdade, bloqueia a importação (ver dossie-io.js).

import { FORMAT_VERSION, SECOES } from "./dossie.js";

function ehObjeto(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ehISODataValida(v) {
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

// Retorna { valido, erros, avisos }. Nunca lança — quem chama decide o que
// fazer com uma lista de erros nunca vazia.
export function validarDossie(dossie) {
  const erros = [];
  const avisos = [];

  if (!ehObjeto(dossie)) {
    return { valido: false, erros: ["O dossiê não é um objeto JSON."], avisos };
  }

  if (typeof dossie.formatVersion !== "string") {
    erros.push('Campo "formatVersion" ausente ou não é texto.');
  } else if (dossie.formatVersion !== FORMAT_VERSION) {
    // Versão diferente não é erro fatal por si só — é aviso, para permitir
    // que uma futura fase 1.2.2 escreva o conversor sem quebrar a leitura.
    avisos.push(
      `Formato do arquivo é v${dossie.formatVersion}, este programa espera v${FORMAT_VERSION}. Pode haver campos incompatíveis.`
    );
  }

  if (!ehISODataValida(dossie.criadoEm)) {
    erros.push('Campo "criadoEm" ausente ou não é uma data válida.');
  }
  if (!ehISODataValida(dossie.atualizadoEm)) {
    erros.push('Campo "atualizadoEm" ausente ou não é uma data válida.');
  }

  if (!ehObjeto(dossie.estacao)) {
    erros.push('Campo "estacao" ausente ou malformado.');
  }

  if (!ehObjeto(dossie.secoes)) {
    erros.push('Campo "secoes" ausente ou malformado — dossiê não pode ser lido.');
    return { valido: erros.length === 0, erros, avisos };
  }

  for (const nome of SECOES) {
    const secao = dossie.secoes[nome];
    if (!ehObjeto(secao) || !Array.isArray(secao.versoes)) {
      erros.push(`Seção "${nome}" ausente ou sem lista de versões.`);
      continue;
    }
    secao.versoes.forEach((v, i) => {
      const rotulo = `${nome}.versoes[${i}]`;
      if (!ehObjeto(v)) {
        erros.push(`${rotulo} não é um objeto.`);
        return;
      }
      if (v.versao !== i + 1) {
        erros.push(`${rotulo}.versao deveria ser ${i + 1}, veio ${JSON.stringify(v.versao)} (versões não podem ter buracos).`);
      }
      if (!ehISODataValida(v.data)) {
        erros.push(`${rotulo}.data ausente ou inválida.`);
      }
      if (!("dados" in v)) {
        erros.push(`${rotulo}.dados ausente.`);
      }
    });
  }

  // Seção extra desconhecida: não bloqueia (pode ser campo de uma versão
  // futura do formato), mas avisa.
  for (const chave of Object.keys(dossie.secoes)) {
    if (!SECOES.includes(chave)) {
      avisos.push(`Seção "${chave}" não é reconhecida por este programa e será ignorada.`);
    }
  }

  return { valido: erros.length === 0, erros, avisos };
}
