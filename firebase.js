import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  reload,
  getIdToken
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBWtrCHB4pb9JoYVsbng3SC6hVGcy5yc2Y",
  authDomain: "quicbite-12e2b.firebaseapp.com",
  databaseURL: "https://quicbite-12e2b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quicbite-12e2b",
  storageBucket: "quicbite-12e2b.firebasestorage.app",
  messagingSenderId: "507574164456",
  appId: "1:507574164456:web:598432aa16017839b7a25d",
  measurementId: "G-MC5PJG2690"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export {
  auth,
  db,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  reload,
  getIdToken,
  ref,
  get,
  set,
  update,
  remove,
  push,
  serverTimestamp
};