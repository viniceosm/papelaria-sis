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
  getDocsFromCache,
  getCountFromServer,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PAGE_SIZE = 10;

let forcarRede = false;
let cursores = []; // guarda o ultimoDoc de cada página
let ultimoDoc = null;
let carregando = false;
let paginaAtual = 1;
let termoBusca = "";
let totalRegistrosBusca = 0;
let timerBusca;

let ordenacao = {
  campo: "descricao",
  direcao: "asc"
};

const MAPA_ORDENACAO = {
  descricao: "descricao_lower",

  preco_asc: "busca_preco_asc",
  preco_desc: "busca_preco_desc",

  estoque_asc: "busca_estoque_asc",
  estoque_desc: "busca_estoque_desc",

  ativo_asc: "busca_ativo_asc",
  ativo_desc: "busca_ativo_desc"
};

async function carregarEstoque(paginado = false) {
  if (carregando) return;
  carregando = true;

  mostrarSkeleton();

  const qBase = collection(db, "produtos");

  const termoNormalizado =
    typeof termoBusca === "string" ? termoBusca.trim() : "";

  const chaveOrdenacao =
    ordenacao.campo === "descricao"
      ? "descricao"
      : `${ordenacao.campo}_${ordenacao.direcao}`;

  const campoOrdenacao = MAPA_ORDENACAO[chaveOrdenacao];

  if (!campoOrdenacao) {
    console.error("Campo de ordenação inválido:", chaveOrdenacao);
    esconderSkeleton();
    carregando = false;
    return;
  }

  let constraints = [];

  if (termoNormalizado.length > 0) {
    const termo = normalizarDescricao(termoNormalizado);

    constraints.push(
      where(campoOrdenacao, ">=", termo),
      where(campoOrdenacao, "<", termo + "\uf8ff"),
      orderBy(campoOrdenacao, "asc")
    );
  } else {
    constraints.push(orderBy(campoOrdenacao, "asc"));
  }

  constraints.push(limit(PAGE_SIZE));

  if (paginado && paginaAtual > 1 && cursores[paginaAtual - 1]) {
    constraints.push(startAfter(cursores[paginaAtual - 1]));
  }

  const q = query(qBase, ...constraints);

  const snap = forcarRede
    ? await getDocs(q)
    : (await getDocsFromCache(q)).empty
      ? await getDocs(q)
      : await getDocsFromCache(q);

  forcarRede = false;

  const tbody = document.querySelector("#tabelaEstoque tbody");
  tbody.innerHTML = "";

  const fragment = document.createDocumentFragment();

  snap.forEach(d => {
    const p = d.data();

    const descricaoHTML = termoBusca
      ? highlight(p.descricao, termoBusca)
      : p.descricao;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${p.cod ?? "-"}</td>
      <td>${descricaoHTML}</td>
      <td>${p.categoria ?? "-"}</td>
      <td>${p.qtde ?? 0}</td>
      <td>R$ ${Number(p.precoVenda ?? 0).toFixed(2)}</td>
      <td>${p.ativo ? "Sim" : "Não"}</td>
    `;

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);

  ultimoDoc = snap.docs[snap.docs.length - 1] ?? null;
  cursores[paginaAtual] = ultimoDoc;

  esconderSkeleton();
  carregando = false;
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[m]);
}

function highlight(texto, termo) {
  if (!termo) return escapeHTML(texto);

  const escapedTermo = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedTermo})`, "gi");

  return escapeHTML(texto).replace(regex, "<mark>$1</mark>");
}

async function contarResultadosBusca() {
  if (!termoBusca) {
    totalRegistrosBusca = 0;
    document.getElementById("contadorResultados").innerText = "";
    return;
  }

  const termo = normalizarDescricao(termoBusca);

  const qCount = query(
    collection(db, "produtos"),
    where("descricao_lower", ">=", termo),
    where("descricao_lower", "<", termo + "\uf8ff")
  );

  const snap = await getCountFromServer(qCount);
  totalRegistrosBusca = snap.data().count;

  document.getElementById("contadorResultados").innerText =
    `🔎 ${totalRegistrosBusca} resultado(s) encontrados`;
}

function normalizarDescricao(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mostrarSkeleton() {
  document.getElementById("skeletonEstoque").style.display = "block";
  document.querySelector("#tabelaEstoque tbody").style.display = "none";
}

function esconderSkeleton() {
  document.getElementById("skeletonEstoque").style.display = "none";
  document.querySelector("#tabelaEstoque tbody").style.display = "";
}

function pad(num, size = 11) {
  return String(num).padStart(size, "0");
}

function precoAsc(valor) {
  return pad(Math.round((valor || 0) * 100));
}

function precoDesc(valor) {
  return pad(99999999999 - Math.round((valor || 0) * 100));
}

function estoqueAsc(qtde) {
  return pad(qtde || 0, 6);
}

function estoqueDesc(qtde) {
  return pad(999999 - (qtde || 0), 6);
}

function ativoAsc(ativo) {
  return ativo ? "1" : "0";
}

function ativoDesc(ativo) {
  return ativo ? "0" : "1";
}

async function gerarCamposBuscaOrdenacao() {
  if (!confirm(
    "Isso vai gerar/atualizar TODOS os campos de busca e ordenação.\n\nDeseja continuar?"
  )) return;

  const snap = await getDocs(collection(db, "produtos"));

  let batch = writeBatch(db);
  let count = 0;
  let total = 0;
  let batches = 0;

  for (const d of snap.docs) {
    const data = d.data();

    if (!data.descricao) continue;

    const descricaoLower = normalizarDescricao(data.descricao);
    const preco = Number(data.precoVenda || 0);
    const qtde = Number(data.qtde || 0);
    const ativo = Boolean(data.ativo);

    const updateData = {
      busca_preco_asc: `${descricaoLower}|${precoAsc(preco)}`,
      busca_preco_desc: `${descricaoLower}|${precoDesc(preco)}`,

      busca_estoque_asc: `${descricaoLower}|${estoqueAsc(qtde)}`,
      busca_estoque_desc: `${descricaoLower}|${estoqueDesc(qtde)}`,

      busca_ativo_asc: `${descricaoLower}|${ativoAsc(ativo)}`,
      busca_ativo_desc: `${descricaoLower}|${ativoDesc(ativo)}`
    };

    batch.update(doc(db, "produtos", d.id), updateData);

    count++;
    total++;

    if (count === 500) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
      batches++;
    }
  }

  if (count > 0) {
    await batch.commit();
    batches++;
  }

  alert(
    `✅ Campos gerados com sucesso!\n\n` +
    `Produtos atualizados: ${total}\n` +
    `Batches executados: ${batches}`
  );
}

async function corrigirDescricaoLowerComLoop() {
  if (!confirm(
    "Isso vai REGERAR descricao_lower de TODOS os produtos.\n\nDeseja continuar?"
  )) return;

  const snap = await getDocs(collection(db, "produtos"));

  let batch = writeBatch(db);
  let count = 0;
  let total = 0;

  for (const d of snap.docs) {
    const data = d.data();

    if (!data.descricao) continue;

    const normalizada = normalizarDescricao(data.descricao);

    // 🔥 atualiza se estiver diferente
    if (data.descricao_lower !== normalizada) {
      batch.update(doc(db, "produtos", d.id), {
        descricao_lower: normalizada
      });

      count++;
      total++;

      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
  }

  if (count > 0) await batch.commit();

  alert(`✅ descricao_lower corrigida!\n\nRegistros atualizados: ${total}`);
}

// document
//   .getElementById("corrigirDescricaoLower")
//   .addEventListener("click", corrigirDescricaoLowerComLoop);

document
  .getElementById("gerarCamposBusca")
  .addEventListener("click", gerarCamposBuscaOrdenacao);

// clique para ordenar
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const campo = th.dataset.sort;

    // 🔁 toggle asc / desc
    if (ordenacao.campo === campo) {
      ordenacao.direcao =
        ordenacao.direcao === "asc" ? "desc" : "asc";
    } else {
      ordenacao.campo = campo;
      ordenacao.direcao = "asc";
    }

    document.querySelectorAll("th[data-sort]").forEach(th => {
      th.classList.remove("asc", "desc", "active");
    });

    th.classList.add(ordenacao.direcao);

    // 🔄 reset paginação
    paginaAtual = 1;
    ultimoDoc = null;
    cursores = [];
    forcarRede = true;

    // 🔥 ATUALIZA UI
    document.getElementById("paginaAtual").innerText = "1";
    document.getElementById("prevPage").disabled = true;
    document.getElementById("nextPage").disabled = false;

    document.querySelector("#tabelaEstoque tbody").innerHTML = "";

    carregarEstoque();
  });
});

// document.getElementById("carregarMais").onclick = () => {
//   carregarEstoque(true);
// };

document.getElementById("busca").addEventListener("input", e => {
  clearTimeout(timerBusca);

  timerBusca = setTimeout(async () => {
    termoBusca = e.target.value.trim();

    forcarRede = true;
    paginaAtual = 1;
    cursores = [];
    ultimoDoc = null;

    document.getElementById("paginaAtual").innerText = "1";
    document.getElementById("prevPage").disabled = true;

    if (termoBusca.length === 0) {
      document.getElementById("contadorResultados").innerText = "";
    } else {
      await contarResultadosBusca();
    }

    carregarEstoque();
  }, 300);
});

window.addEventListener("usuario-autenticado", () => {
  paginaAtual = 1;
  ultimoDoc = null;
  cursores = [];
  document.querySelector("#tabelaEstoque tbody").innerHTML = "";
  document.getElementById("prevPage").disabled = true;
  carregarEstoque();
});

document.getElementById("nextPage").onclick = () => {
  paginaAtual++;
  document.getElementById("paginaAtual").innerText = paginaAtual;
  document.getElementById("prevPage").disabled = false;
  carregarEstoque(true);
};

document.getElementById("prevPage").onclick = () => {
  if (paginaAtual <= 1) return;

  paginaAtual--;
  document.getElementById("paginaAtual").innerText = paginaAtual;

  document.querySelector("#tabelaEstoque tbody").innerHTML = "";
  carregarEstoque(true);

  // desativa se voltar pra primeira
  document.getElementById("prevPage").disabled = paginaAtual === 1;
};