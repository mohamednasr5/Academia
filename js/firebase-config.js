// Firebase Configuration and Initialization for Academia Al-Ahmadia
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJYIKnZNBMZuXhVAhP4irqjLuzP4jQ16g",
  authDomain: "academia-e6d7b.firebaseapp.com",
  projectId: "academia-e6d7b",
  storageBucket: "academia-e6d7b.firebasestorage.app",
  messagingSenderId: "679214276618",
  appId: "1:679214276618:web:f34c9e48d83e338facfff3",
  measurementId: "G-ME9ZF20CZ0"
};

let app = null;
let db = null;
let isFirebaseOnline = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isFirebaseOnline = true;
  console.log("Firebase initialized successfully for Academia Al-Ahmadia");
} catch (error) {
  console.warn("Firebase initialization warning (falling back to local cache):", error);
}

export { 
  app, 
  db, 
  isFirebaseOnline,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy 
};
