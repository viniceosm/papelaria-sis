import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let ultimoDoc = null;
let carregando = false;

let ordenacao = {
  campo: "descricao",
  direcao: "asc"
};

async function carregarEstoque(paginado = false) {
  if (carregando) return;
  carregando = true;

  let q = query(
    collection(db, "produtos"),
    orderBy("descricao"),
    limit(50)
  );

  if (paginado && ultimoDoc) {
    q = query(
      collection(db, "produtos"),
      orderBy("descricao_lower"),
      startAfter(ultimoDoc),
      limit(50)
    );
  }

  const snap = await getDocs(q);
  const tbody = document.querySelector("#tabelaEstoque tbody");

  snap.forEach(doc => {
    const p = doc.data();
    ultimoDoc = doc;

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${p.cod ?? "-"}</td>
        <td>${p.descricao}</td>
        <td>${p.categoria ?? "-"}</td>
        <td>${p.estoque ?? 0}</td>
        <td>R$ ${Number(p.preco ?? 0).toFixed(2)}</td>
        <td>${p.ativo ? "Sim" : "Não"}</td>
      </tr>
    `);
  });

  carregando = false;
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

document.getElementById("carregarMais").onclick = () => {
  carregarEstoque(true);
};

window.addEventListener("usuario-autenticado", () => {
  carregarEstoque();
});