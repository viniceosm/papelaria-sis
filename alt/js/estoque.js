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
let domPronto = false;
let authPronto = false;
let operadorGlobal = "";
let filtrosAtivos = [];

let ordenacao = {
  campo: "descricao",
  direcao: "asc"
};

const MAPA_SORT_HTML = {
  descricao: "descricao",
  qtde: "qtde",
  precoVenda: "preco",
  ativo: "ativo"
};

const MAPA_ORDENACAO = {
  descricao: "descricao_lower",

  preco_asc: "busca_preco_asc",
  preco_desc: "busca_preco_desc",

  qtde_asc: "busca_qtde_asc",
  qtde_desc: "busca_qtde_desc",

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

  const campoNormalizado = MAPA_SORT_HTML[ordenacao.campo];

  if (!campoNormalizado) {
    console.error("Campo HTML não mapeado:", ordenacao.campo);
    esconderSkeleton();
    carregando = false;
    return;
  }

  const chaveOrdenacao =
    campoNormalizado === "descricao"
      ? "descricao"
      : `${campoNormalizado}_${ordenacao.direcao}`;

  const campoOrdenacao = MAPA_ORDENACAO[chaveOrdenacao];

  if (!campoOrdenacao) {
    console.error("Campo de ordenação inválido:", chaveOrdenacao);
    esconderSkeleton();
    carregando = false;
    return;
  }

  let constraints = [];

  /* =========================
     1️⃣ WHERE – BUSCA TEXTO
     ========================= */
  if (termoNormalizado.length > 0) {
    const termo = normalizarDescricao(termoNormalizado);
  
    if (campoNormalizado === "descricao") {
      constraints.push(
        where("descricao_lower", ">=", termo),
        where("descricao_lower", "<", termo + "\uf8ff")
      );
    } else {
      constraints.push(
        where(campoOrdenacao, ">=", termo),
        where(campoOrdenacao, "<", termo + "\uf8ff")
      );
    }
  }
  
  /* =========================
     2️⃣ WHERE – FILTROS AND
     ========================= */
  if (operadorGlobal === "AND" && filtrosAtivos.length) {
    filtrosAtivos.forEach(f => {
      constraints.push(where(f.campo, f.operador, f.valor));
    });
  }
  
  /* =========================
     3️⃣ ORDER BY
     ========================= */
  // 🔥 se existir filtro com < ou >, ele manda no orderBy
  const filtroRange = filtrosAtivos.find(f =>
    f.operador === ">" || f.operador === "<"
  );
  
  if (filtroRange) {
    constraints.push(orderBy(filtroRange.campo, "asc"));
  } else if (termoNormalizado.length > 0) {
    constraints.push(orderBy(
      campoNormalizado === "descricao"
        ? "descricao_lower"
        : campoOrdenacao,
      "asc"
    ));
  } else {
    constraints.push(orderBy(campoOrdenacao, ordenacao.direcao));
  }
  
  /* =========================
     4️⃣ START AFTER (PAGINAÇÃO)
     ========================= */
  if (paginado && paginaAtual > 1 && cursores[paginaAtual - 1]) {
    constraints.push(startAfter(cursores[paginaAtual - 1]));
  }
  
  /* =========================
     5️⃣ LIMIT (SEMPRE POR ÚLTIMO)
     ========================= */
  constraints.push(limit(PAGE_SIZE));
  
  const q = query(qBase, ...constraints);

  const snap = forcarRede
    ? await getDocs(q)
    : (await getDocsFromCache(q)).empty
      ? await getDocs(q)
      : await getDocsFromCache(q);

  forcarRede = false;

  const tbody = document.querySelector("#tabelaEstoque tbody");
  // tbody.innerHTML = "";
  limparTabelaMantendoSkeleton();

  const fragment = document.createDocumentFragment();

  snap.forEach(d => {
    const p = d.data();

    const descricaoHTML = termoBusca
      ? highlight(p.descricao, termoBusca)
      : p.descricao;
      
    const imagemHTML = p.imagem
      ? `<img src="${p.imagem}" class="card-image" loading="lazy" />`
      : `<div class="card-image placeholder">Sem imagem</div>`;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${p.cod ?? "-"}</td>
    
      <td class="card-container">
        <div class="card-left">
          ${imagemHTML}
        </div>
    
        <div class="card-right">
          <div class="card-preco">
            R$ ${Number(p.precoVenda ?? 0).toFixed(2)}
          </div>
    
          <div class="card-estoque">
            Estoque: ${p.qtde ?? 0}
          </div>
    
          <div class="card-nome">
            ${descricaoHTML}
          </div>
    
          <div class="card-codigo">
            Cód: ${p.cod ?? "-"}
          </div>
        </div>
      </td>
    
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
  if (!document.getElementById("skeletonEstoque")) return;
  document.getElementById("skeletonEstoque").style.display = "table-row";
}

function esconderSkeleton() {
  if (!document.getElementById("skeletonEstoque")) return;
  document.getElementById("skeletonEstoque").style.display = "none";
}

function limparTabelaMantendoSkeleton() {
  const tbody = document.querySelector("#tabelaEstoque tbody");
  const skeleton = document.getElementById("skeletonEstoque");

  tbody.innerHTML = "";

  if (skeleton) {
    tbody.appendChild(skeleton);
  }
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

      busca_qtde_asc: `${descricaoLower}|${estoqueAsc(qtde)}`,
      busca_qtde_desc: `${descricaoLower}|${estoqueDesc(qtde)}`,

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

    // document.querySelector("#tabelaEstoque tbody").innerHTML = "";
    limparTabelaMantendoSkeleton();

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
  authPronto = true;

  paginaAtual = 1;
  ultimoDoc = null;
  cursores = [];

  const tbody = document.querySelector("#tabelaEstoque tbody");
  // if (tbody) tbody.innerHTML = "";
  if (tbody) limparTabelaMantendoSkeleton();

  const prev = document.getElementById("prevPage");
  if (prev) prev.disabled = true;

  if (domPronto) {
    carregarEstoque();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  domPronto = true;

  if (authPronto) {
    carregarEstoque();
  }
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

  // document.querySelector("#tabelaEstoque tbody").innerHTML = "";
  limparTabelaMantendoSkeleton();
  carregarEstoque(true);

  // desativa se voltar pra primeira
  document.getElementById("prevPage").disabled = paginaAtual === 1;
};

const listaFiltros = document.getElementById("listaFiltros");
const btnAddFiltro = document.getElementById("addFiltro");

document.getElementById("btnFiltro").onclick = () => {
  listaFiltros.innerHTML = "";
  listaFiltros.appendChild(criarFiltroRow());
  document.getElementById("modalFiltro").classList.add("open");
}

document.getElementById("fecharFiltro").onclick = () => {
  document.getElementById("modalFiltro").classList.remove("open");
}

function criarFiltroRow() {
  const div = document.createElement("div");
  div.className = "filter-row";

  div.innerHTML = `
    <select class="campo">
      <option value="categoria">Categoria</option>
      <option value="qtde">Estoque</option>
      <option value="ativo">Ativo</option>
      <option value="precoVenda">Preço</option>
    </select>

    <select class="operador">
      <option value="==">=</option>
      <option value=">">></option>
      <option value="<"><</option>
    </select>

    <input class="valor" placeholder="Valor" />

    <button class="btn ghost remover">✕</button>
  `;

  div.querySelector(".remover").onclick = () => div.remove();

  return div;
}

function obterFiltrosDoModal() {
  return [...document.querySelectorAll(".filter-row")].map(row => ({
    campo: row.querySelector(".campo").value,
    operador: row.querySelector(".operador").value,
    valor: normalizarValor(
      row.querySelector(".valor").value,
      row.querySelector(".campo").value
    )
  }));
}

function normalizarValor(valor, campo) {
  if (campo === "qtde" || campo === "precoVenda") {
    return Number(valor);
  }

  if (campo === "ativo") {
    return valor === "true" || valor === "1";
  }

  return valor;
}

btnAddFiltro.addEventListener("click", () => {
  listaFiltros.appendChild(criarFiltroRow());
});

document.getElementById("btnAplicarFiltro").onclick = () => {
  filtrosAtivos = obterFiltrosDoModal();
  operadorGlobal = document.querySelector(
    'input[name="operador-logico"]:checked'
  ).value; // "AND" ou "OR"

  paginaAtual = 1;
  cursores = [];
  ultimoDoc = null;
  forcarRede = true;

  fecharModalFiltro();
  carregarEstoque();
};