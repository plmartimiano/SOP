// Pacote EAP 1.5.4 — motor de consolidação (fase 09, "Consolidação nos 6
// passos"). Diferente da fase 08 (gera 2-3 alternativas para uma pessoa
// escolher e assinar), aqui não há escolha nenhuma: a regra já foi
// homologada, então rodamos só ela, de novo, sempre do mesmo jeito, sobre
// o núcleo atual do dossiê (cartão F09-02: aplicar a regra homologada é o
// mesmo motor de fusão da fase 08, sem alteração).
//
// Duas das três condições de saída da fase ("exatamente 6, na ordem do
// vídeo, nenhuma verificação sumiu") são garantidas pela CONSTRUÇÃO do
// motor de fusão, não checadas aqui como se pudessem falhar:
//   - Ordem: fundirAteSeis só funde vizinho com vizinho, nunca reordena —
//     a ordem cronológica do núcleo (que já vem em ordem do consenso da
//     fase 07) sobrevive em qualquer sequência de fusões.
//   - Verificações não somem: um grupo naoFundivel nunca é escolhido como
//     um dos dois lados de uma fusão (ver o `continue` em fundirAteSeis),
//     então uma pausa de conferência do núcleo sempre sobra como passo
//     próprio, nunca escondida dentro de outro. As duas contagens abaixo
//     (verificacoesNoNucleo/verificacoesNosPassos) existem mesmo assim,
//     não como teste que pode falhar, mas como registro auditável na tela
//     e no dossiê — se um dia o motor de fusão mudar e essa garantia
//     quebrar, o número vai divergir e vai aparecer.
//
// A terceira condição do plano ("4 dos 6 coincidem com o SOP feito à
// mão") não é verificável aqui: exigiria o SOP manual da estação
// digitalizado em algum lugar do programa, e isso não existe — nenhum
// pacote da EAP até agora prevê importar ou guardar esse documento. Fica
// fora, declarado, não fingido.

import { extrairAcaoBase, fundirAteSeis, CRITERIOS } from "./agrupamento.js";

// nucleo: reconhecimento.nucleo (dossiê, versão da fase 07).
// regraHomologada: reconhecimento.regraHomologada (dossiê, versão da fase 08).
export function aplicarRegraHomologada(nucleo, regraHomologada) {
  const criterio = CRITERIOS[regraHomologada.criterioEscolhido];
  if (!criterio) {
    return {
      erro: `Critério "${regraHomologada.criterioEscolhido}" não é reconhecido pelo programa — a regra homologada pode ter vindo de um dossiê de outra versão.`,
    };
  }

  const acoesBase = nucleo.map(extrairAcaoBase);
  const { grupos, completo } = fundirAteSeis(acoesBase, criterio.similaridade);

  const verificacoesNoNucleo = acoesBase.filter((a) => a.naoFundivel).length;
  const verificacoesNosPassos = grupos.filter((g) => g.causa === "pausa_conferencia").length;

  const passos = grupos.map((g, i) => ({
    numero: i + 1,
    titulo: g.rotulo,
    duracaoMediaSegundos: Number(g.duracaoMediaSegundos.toFixed(2)),
    duvidosa: g.duvidosa,
    origem: g.origem || [g.rotulo],
  }));

  return {
    passos,
    completo,
    criterioAplicado: { chave: regraHomologada.criterioEscolhido, nome: criterio.nome },
    verificacoesNoNucleo,
    verificacoesNosPassos,
  };
}
