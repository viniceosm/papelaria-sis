<script type="module">
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let ordenacao = {
  campo: "descricao",
  direcao: "asc"
};

async function carregarEstoque() {
  const q = query(
    collection(db, "produtos"),
    orderBy(ordenacao.campo, ordenacao.direcao)
  );

  const snap = await getDocs(q);
  const tbody = document.querySelector("#tabelaEstoque tbody");

  tbody.innerHTML = "";

  snap.forEach(doc => {
    const p = doc.data();

    tbody.innerHTML += `
      <tr>
        <td>${p.cod ?? "-"}</td>
        <td>${p.descricao}</td>
        <td>${p.categoria ?? "-"}</td>
        <td>${p.estoque ?? 0}</td>
        <td>R$ ${Number(p.preco ?? 0).toFixed(2)}</td>
        <td>${p.ativo ? "Sim" : "Não"}</td>
      </tr>
    `;
  });
}

// clique para ordenar
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const campo = th.dataset.sort;

    ordenacao.direcao =
      ordenacao.campo === campo && ordenacao.direcao === "asc"
        ? "desc"
        : "asc";

    ordenacao.campo = campo;
    carregarEstoque();
  });
});

carregarEstoque();
</script>
