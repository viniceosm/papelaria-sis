import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function carregarCaixasAbertos() {
  const card = document.getElementById("cardCaixas");
  const totalEl = document.getElementById("totalCaixas");
  const statusEl = document.getElementById("statusTexto");

  try {
    const q = query(
      collection(db, "caixas"),
      where("status", "==", "aberto")
    );

    const snap = await getCountFromServer(q);
    const total = snap.data().count;

    totalEl.innerText = total;

    // remove estados anteriores
    card.classList.remove("ok", "warn", "danger");

    if (total === 0) {
      card.classList.add("ok");
      statusEl.innerText = "Nenhum caixa aberto";
    } else if (total === 1) {
      card.classList.add("warn");
      statusEl.innerText = "Existe 1 caixa aberto";
    } else {
      card.classList.add("danger");
      statusEl.innerText = "⚠️ Mais de um caixa aberto";
    }

  } catch (err) {
    console.error("Erro ao carregar caixas abertos:", err);
    totalEl.innerText = "—";
    statusEl.innerText = "Erro ao carregar dados";
  }
}

// carrega ao abrir a página
carregarCaixasAbertos();
