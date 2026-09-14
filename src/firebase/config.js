// Firebase imports
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- Yahaan par Firebase config daalein ---
// (Yeh keys aapke pichhle conversation se hain)
const firebaseConfig = {
  apiKey: "AIzaSyB5VDEo4ewfFQbhj0tqMPAnwhza2fPICe8",
  authDomain: "zenithely.firebaseapp.com",
  projectId: "zenithely",
  storageBucket: "zenithely.firebasestorage.app",
  messagingSenderId: "1079569948368",
  appId: "1:1079569948368:web:de96220d769739c2d648d5",
  measurementId: "G-ETT007M5LV"
};

// --- Firebase services ko initialize karein ---
const app = initializeApp(firebaseConfig);

// Services ko export karein taaki poori app use kar sake
export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth functions ko bhi export karein
export { signInWithEmailAndPassword, signOut, onAuthStateChanged };