import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function carregarResumoCaixas() {
  try {
    // 🔴 ABERTOS
    const qAbertos = query(
      collection(db, "caixas"),
      where("status", "==", "aberto")
    );
    const abertosSnap = await getCountFromServer(qAbertos);
    const abertos = abertosSnap.data().count;

    // 🟢 FECHADOS
    const qFechados = query(
      collection(db, "caixas"),
      where("status", "==", "fechado")
    );
    const fechadosSnap = await getCountFromServer(qFechados);
    const fechados = fechadosSnap.data().count;

    // 📦 TOTAL
    const qTotal = query(collection(db, "caixas"));
    const totalSnap = await getCountFromServer(qTotal);
    const total = totalSnap.data().count;

    // UI
    document.getElementById("totalAbertos").innerText = abertos;
    document.getElementById("totalFechados").innerText = fechados;
    document.getElementById("totalCaixas").innerText = total;

  } catch (err) {
    console.error("Erro ao carregar resumo dos caixas:", err);
  }
}

carregarResumoCaixas();
