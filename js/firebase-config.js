// =====================================================================
// Firebase Configuration & Initialization — Academia Al-Ahmadia
// Preserves the existing Firebase project (academia-e6d7b).
// Adds: real-time cloud sync so admin changes appear on the public site.
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Existing project configuration (preserved from original repository)
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
  console.log("[Academia] Firebase initialized — cloud sync active for project academia-e6d7b");
} catch (error) {
  console.warn("[Academia] Firebase init warning — operating in offline/local mode:", error.message);
}

// Collections that mirror the local data model
const DATA_COLLECTIONS = [
  "players", "coaches", "trophies", "schedules",
  "upcomingMatches", "matchResults", "news", "registrationRequests"
];
const META_DOC = "academy_meta"; // single doc holding tickerNews, playerOfTheDay, settings, activity

export {
  app, db, isFirebaseOnline,
  DATA_COLLECTIONS, META_DOC,
  collection, doc, getDocs, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch
};
