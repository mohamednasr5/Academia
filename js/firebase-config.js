// =====================================================================
// Firebase Configuration — Academia Al-Ahmadia
// Realtime Database is the single cloud database for academy records.
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getDatabase, ref, get, set, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJYIKnZNBMZuXhVAhP4irqjLuzP4jQ16g",
  authDomain: "academia-e6d7b.firebaseapp.com",
  databaseURL: "https://academia-e6d7b-default-rtdb.firebaseio.com",
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
  db = getDatabase(app);
  isFirebaseOnline = true;
  console.log("[Academia] Firebase Realtime Database initialized — cloud sync active.");
} catch (error) {
  console.error("[Academia] Realtime Database initialization failed:", error);
}

const DATA_COLLECTIONS = [
  "players", "coaches", "trophies", "schedules",
  "upcomingMatches", "matchResults", "news", "registrationRequests"
];
const META_DOC = "academy_meta";

export {
  app, db, isFirebaseOnline, DATA_COLLECTIONS, META_DOC,
  ref, get, set, update, remove, onValue
};
