import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  doc
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

  const t0 = performance.now();

  let q = query(
    collection(db, "produtos"),
    orderBy("descricao_lower"),
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
  const t1 = performance.now();

  const tbody = document.querySelector("#tabelaEstoque tbody");
  const fragment = document.createDocumentFragment(); // 🔥 aqui está o ganho

  snap.forEach(d => {
    const p = d.data();
    ultimoDoc = d;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.cod ?? "-"}</td>
      <td>${p.descricao}</td>
      <td>${p.categoria ?? "-"}</td>
      <td>${p.estoque ?? 0}</td>
      <td>R$ ${Number(p.preco ?? 0).toFixed(2)}</td>
      <td>${p.ativo ? "Sim" : "Não"}</td>
    `;

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment); // 🔥 UM reflow só

  const t2 = performance.now();

  console.log(`⏱️ Firestore: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`🎨 Render: ${(t2 - t1).toFixed(2)} ms`);
  console.log(`🚀 Total: ${(t2 - t0).toFixed(2)} ms`);

  carregando = false;
}

function normalizarDescricao(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function corrigirDescricaoLowerComLoop() {
  if (!confirm(
    "Isso vai atualizar TODOS os produtos sem descricao_lower.\n\nDeseja continuar?"
  )) {
    return;
  }

  const snap = await getDocs(collection(db, "produtos"));

  let batch = writeBatch(db);
  let batchCount = 0;
  let totalAtualizados = 0;
  let totalBatches = 0;

  for (const d of snap.docs) {
    const data = d.data();

    if (!data.descricao_lower && data.descricao) {
      batch.update(doc(db, "produtos", d.id), {
        descricao_lower: normalizarDescricao(data.descricao)
      });

      batchCount++;
      totalAtualizados++;

      // 🔥 quando chega em 500, comita e cria novo batch
      if (batchCount === 500) {
        await batch.commit();
        totalBatches++;

        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  // 🔥 commit final (se sobrou algo)
  if (batchCount > 0) {
    await batch.commit();
    totalBatches++;
  }

  alert(
    `✅ Correção concluída!\n\n` +
    `Produtos atualizados: ${totalAtualizados}\n` +
    `Batches executados: ${totalBatches}`
  );
}

document
  .getElementById("corrigirDescricaoLower")
  .addEventListener("click", corrigirDescricaoLowerComLoop);

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