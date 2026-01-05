import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function carregarResumoCaixas() {
  try {
    // TOTAL
    const totalQuery = query(collection(db, "caixas"));
    const totalSnap = await getCountFromServer(totalQuery);
    const total = totalSnap.data().count;

    // FECHADOS
    const fechadosQuery = query(
      collection(db, "caixas"),
      where("status", "==", "fechado")
    );
    const fechadosSnap = await getCountFromServer(fechadosQuery);
    const fechados = fechadosSnap.data().count;

    // UI
    document.getElementById("totalCaixas").innerText = total;
    document.getElementById("totalFechados").innerText = fechados;

  } catch (err) {
    console.error("Erro ao carregar resumo de caixas:", err);
    document.getElementById("totalCaixas").innerText = "—";
    document.getElementById("totalFechados").innerText = "—";
  }
}

// carrega ao abrir
carregarResumoCaixas();
