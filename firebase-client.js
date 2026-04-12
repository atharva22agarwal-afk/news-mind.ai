// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// NOTE: These keys MUST match the Firebase Project you are using on the backend.
// If you are using your own Firebase project, replace the config below with your keys
// from Project Settings > General > Your Apps > Web App.
const firebaseConfig = {
  apiKey: "AIzaSyCZeqM0VT-vc0Nq-G9X1LNQqqiHkN1psrU",
  authDomain: "news-mind-55135.firebaseapp.com",
  projectId: "news-mind-55135",
  storageBucket: "news-mind-55135.firebasestorage.app",
  messagingSenderId: "1065440602382",
  appId: "1:1065440602382:web:b55408189c72cc49d58f5f",
  measurementId: "G-FGRCYY00Y7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut };
