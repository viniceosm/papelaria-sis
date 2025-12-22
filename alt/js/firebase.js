import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBjvTgvMxOiUcJzud6Vapa5X8ZnGeph0aA",
  authDomain: "papelaria-79dc5.firebaseapp.com",
  projectId: "papelaria-79dc5",
  storageBucket: "papelaria-79dc5.firebasestorage.app",
  messagingSenderId: "730323947354",
  appId: "1:730323947354:web:6a61e2312a6cc4e361ad63"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);