const inputValor = document.getElementById("valorCompra");
const selectParcelas = document.getElementById("parcelas");
const valorTaxaEl = document.getElementById("valorTaxa");
const valorFinalEl = document.getElementById("valorFinal");

let valorAtual = "";

// 📌 Percentuais aproximados por parcela (baseados no seu teste)
const TAXAS_PERCENTUAIS = {
  1: 0.0386,
  2: 0.0986,
  3: 0.1124,
  4: 0.1262,
  5: 0.1393,
  6: 0.1524,
  7: 0.1648,
  8: 0.1779,
  9: 0.1897,
  10: 0.2021,
  11: 0.2041,
  12: 0.2041
};

function formatarValor(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function atualizarCalculo() {
  const valor = parseFloat(valorAtual || 0) / 100;
  const parcelas = Number(selectParcelas.value);
  const taxaPercentual = TAXAS_PERCENTUAIS[parcelas] || 0;

  const taxa = valor * taxaPercentual;
  const total = valor + taxa;

  valorTaxaEl.innerText = formatarValor(taxa);
  valorFinalEl.innerText = formatarValor(total);
}

document.querySelectorAll(".teclado button[data-num]").forEach(btn => {
  btn.addEventListener("click", () => {
    valorAtual += btn.dataset.num;
    inputValor.value = formatarValor((parseFloat(valorAtual) || 0) / 100);
    atualizarCalculo();
  });
});

document.getElementById("clear").addEventListener("click", () => {
  valorAtual = "";
  inputValor.value = "";
  atualizarCalculo();
});

selectParcelas.addEventListener("change", atualizarCalculo);