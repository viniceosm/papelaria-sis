import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  doc,
  getDocsFromCache
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PAGE_SIZE = 10;

let ultimoDoc = null;
let carregando = false;
let paginaAtual = 1;

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
    limit(PAGE_SIZE)
  );

  if (paginado && ultimoDoc) {
    q = query(
      collection(db, "produtos"),
      orderBy("descricao_lower"),
      startAfter(ultimoDoc),
      limit(PAGE_SIZE)
    );
  }

  let snap = await getDocsFromCache(q);

  if (snap.empty) {
    snap = await getDocs(q);
    console.log("🌐 Dados vindos da REDE");
  } else {
    console.log("📦 Dados vindos do CACHE");
  }

  const t1 = performance.now();

  const tbody = document.querySelector("#tabelaEstoque tbody");
  tbody.innerHTML = ""; // limpa página anterior

  const fragment = document.createDocumentFragment();

  snap.forEach(d => {
    const p = d.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${p.cod ?? "-"}</td>
      <td>${p.descricao}</td>
      <td>${p.categoria ?? "-"}</td>
      <td>${p.estoque ?? 0}</td>
      <td>R$ ${Number(p.preco ?? 0).toFixed(2)}</td>
      <td>${p.ativo ? "Sim" : "Não"}</td>
    `;

    fragment.appendChild(tr);
  });

  ultimoDoc = snap.docs[snap.docs.length - 1] ?? null;

  const btnNext = document.getElementById("nextPage");

  btnNext.disabled = snap.docs.length < PAGE_SIZE;

  document.getElementById("infoPagina").innerText =
  `Mostrando ${PAGE_SIZE} registros`;

  tbody.appendChild(fragment);

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

// document
//   .getElementById("corrigirDescricaoLower")
//   .addEventListener("click", corrigirDescricaoLowerComLoop);

// clique para ordenar
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    ordenacao.campo = th.dataset.sort;
    ordenacao.direcao = "asc";

    paginaAtual = 1;
    ultimoDoc = null;
    document.querySelector("#tabelaEstoque tbody").innerHTML = "";

    carregarEstoque();
  });
});

// document.getElementById("carregarMais").onclick = () => {
//   carregarEstoque(true);
// };

window.addEventListener("usuario-autenticado", () => {
  paginaAtual = 1;
  ultimoDoc = null;
  document.querySelector("#tabelaEstoque tbody").innerHTML = "";
  carregarEstoque();
});

document.getElementById("nextPage").onclick = () => {
  paginaAtual++;
  document.getElementById("paginaAtual").innerText = paginaAtual;
  carregarEstoque(true);
};