// Pacote EAP 1.1.2 — Mapa de zonas da bancada (cartão F00-03).
// Funções puras: geometria e validação de zona. O desenho em si (canvas,
// upload de imagem, arrastar retângulo) mora em fase00-ui.js, que é DOM e
// só se testa no navegador.

export const TIPOS_ZONA = ["escaninho", "ferramenta", "area_trabalho", "saida"];

export const RETULO_TIPO_ZONA = {
  escaninho: "Escaninho de componente",
  ferramenta: "Suporte de ferramenta",
  area_trabalho: "Área de trabalho",
  saida: "Saída para a próxima estação",
};

export function gerarIdZona(indice) {
  return `Z${String(indice + 1).padStart(2, "0")}`;
}

// retangulo: {x, y, largura, altura} normalizados 0–1, relativos ao frame de
// referência — assim a zona não fica presa à resolução exata da imagem usada
// no mapeamento.
export function validarZona({ nomeOficial, tipo, retangulo }) {
  const erros = [];
  if (!nomeOficial || !nomeOficial.trim()) {
    erros.push("Nome oficial é obrigatório.");
  }
  if (!TIPOS_ZONA.includes(tipo)) {
    erros.push(`Tipo precisa ser um de: ${TIPOS_ZONA.join(", ")}.`);
  }
  if (!retangulo || retangulo.largura <= 0 || retangulo.altura <= 0) {
    erros.push("A área desenhada é inválida — arraste um retângulo com tamanho de verdade.");
  }
  return { valido: erros.length === 0, erros };
}

export function criarZona(indice, { nomeOficial, codigoInterno, tipo, retangulo }) {
  return {
    id: gerarIdZona(indice),
    nomeOficial: nomeOficial.trim(),
    codigoInterno: (codigoInterno || "").trim(),
    tipo,
    retangulo,
  };
}

// Reatribui os ids em ordem (Z01, Z02, ...) — chamado depois de remover uma
// zona do meio da lista, pra nunca ter dois "Z02" nem buraco na numeração.
export function renumerarZonas(zonas) {
  return zonas.map((zona, indice) => ({ ...zona, id: gerarIdZona(indice) }));
}
