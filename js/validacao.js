// Fase 11 — mesa de validação humana ("a barreira que não se
// automatiza"). Lógica pura: comparar o que a pessoa editou contra o que
// a fase 10 derivou, guardando sempre os dois lados (nunca sobrescrevendo
// o original), e montar a estrutura final da seção "aprovacoes". A tela
// (js/fase11-ui.js) é quem decide QUAIS campos ficam editáveis; aqui só
// se sabe comparar e montar.
//
// Esta é a barreira do projeto que estava fixada desde o início: nenhuma
// imagem é gerada antes do aceite humano das fichas dos 6 passos. Este
// módulo produz o registro desse aceite — a aplicação real do bloqueio
// (fase 12/13 recusando rodar sem uma aprovação gravada) só existe quando
// essas fases forem construídas; até lá, o bloqueio é a ausência da
// própria tela de geração, não uma checagem de código.

// Campos que a mesa de validação permite corrigir. titulo (o rótulo do
// passo, decidido na fase 09) e estadoProdutoAntes/Depois (derivado por
// acúmulo entre TODOS os passos, editar um isoladamente quebraria a
// consistência da cadeia) ficam de fora de propósito.
export const CAMPOS_EDITAVEIS = ["maos", "ferramentas", "pecas", "criterioConclusao", "risco"];

function valoresIguais(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

// Compara os valores finais (o que ficou nos campos depois da pessoa
// mexer, ou não) contra a ficha original da fase 10, e devolve só o que
// de fato mudou -- nunca duplica um campo que não foi tocado.
export function calcularCorrecoes(fichaOriginal, valoresFinais) {
  const correcoes = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    const original = fichaOriginal[campo];
    const final = valoresFinais[campo];
    if (!valoresIguais(original, final)) {
      correcoes[campo] = { original, corrigido: final };
    }
  }
  return correcoes;
}

// Aplica as correções por cima da ficha original -- o original em si
// nunca é sobrescrito, ele continua acessível em correcoes[campo].original.
export function aplicarCorrecoes(fichaOriginal, correcoes) {
  const final = { ...fichaOriginal };
  for (const [campo, { corrigido }] of Object.entries(correcoes)) {
    final[campo] = corrigido;
  }
  return final;
}

export function validarAssinatura({ nome, cargo }) {
  const erros = [];
  if (!nome || !nome.trim()) erros.push("Nome é obrigatório.");
  if (!cargo || !cargo.trim()) erros.push("Cargo é obrigatório.");
  return erros;
}

// Monta a seção "aprovacoes" completa: cada ficha com seu original, suas
// correções (se houve) e o valor final; mais os dados de quem assinou.
// fichas: as 6 fichas da fase 10. correcoesPorNumero: { [numero]: correcoes }.
export function montarAprovacao(fichas, correcoesPorNumero, assinatura) {
  const fichasFinais = fichas.map((f) => {
    const correcoes = correcoesPorNumero[f.numero] || {};
    return {
      numero: f.numero,
      original: f,
      correcoes,
      final: aplicarCorrecoes(f, correcoes),
    };
  });
  const totalCorrecoes = fichasFinais.reduce((soma, f) => soma + Object.keys(f.correcoes).length, 0);
  return {
    fichas: fichasFinais,
    aprovacao: {
      responsavel: assinatura.nome,
      cargo: assinatura.cargo,
      dataHora: new Date().toISOString(),
      totalCorrecoes,
    },
  };
}
