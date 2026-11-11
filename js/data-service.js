// Data Service with Firebase Firestore + Instant LocalStorage Engine
import { db, isFirebaseOnline, collection, doc, getDocs, setDoc, deleteDoc } from "./firebase-config.js";
import { DEFAULT_DATA } from "./default-data.js";

const STORAGE_KEY = "ahmadia_academy_data_v1";

// Helper: load local state
function getLocalStorageData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    const parsed = JSON.parse(raw);
    // Ensure all collections exist as arrays even if emptied
    if (!Array.isArray(parsed.players)) parsed.players = [];
    if (!Array.isArray(parsed.coaches)) parsed.coaches = [];
    if (!Array.isArray(parsed.trophies)) parsed.trophies = [];
    if (!Array.isArray(parsed.schedules)) parsed.schedules = [];
    if (!Array.isArray(parsed.upcomingMatches)) parsed.upcomingMatches = [];
    if (!Array.isArray(parsed.matchResults)) parsed.matchResults = [];
    if (!Array.isArray(parsed.news)) parsed.news = [];
    if (!Array.isArray(parsed.tickerNews)) parsed.tickerNews = [];
    if (!Array.isArray(parsed.registrationRequests)) parsed.registrationRequests = [];
    return parsed;
  } catch (e) {
    console.error("Error reading localStorage:", e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

// Helper: save local state
function saveLocalStorageData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Trigger storage event for any open tabs
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("Error saving to localStorage:", e);
  }
}

// Non-blocking firestore sync with 2.5s timeout
function firestoreSync(operationPromise, opName = "operation") {
  if (!isFirebaseOnline || !db) return;
  Promise.race([
    operationPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
  ]).catch(err => {
    console.warn(`Firestore sync note (${opName}):`, err.message || err);
  });
}

// Initialize
export async function initDataService() {
  checkPlayerOfTheDayExpiration();
  return getLocalStorageData();
}

// Check expiration of Star of the Day (24h)
export function checkPlayerOfTheDayExpiration() {
  const data = getLocalStorageData();
  if (data.playerOfTheDay && data.playerOfTheDay.active) {
    const now = Date.now();
    const expiresAt = new Date(data.playerOfTheDay.expiresAt).getTime();
    if (now > expiresAt) {
      data.playerOfTheDay.active = false;
      saveLocalStorageData(data);
    }
  }
}

// Get all data
export async function getAllData() {
  checkPlayerOfTheDayExpiration();
  return getLocalStorageData();
}

// Save or Update an item in a collection
export async function saveItem(collectionName, item) {
  const data = getLocalStorageData();
  if (!Array.isArray(data[collectionName])) {
    data[collectionName] = [];
  }

  if (!item.id) {
    item.id = `${collectionName}-${Date.now()}`;
  }

  const existingIndex = data[collectionName].findIndex(i => String(i.id) === String(item.id));
  if (existingIndex >= 0) {
    data[collectionName][existingIndex] = { ...data[collectionName][existingIndex], ...item };
  } else {
    data[collectionName].unshift(item);
  }

  // Instant local save
  saveLocalStorageData(data);

  // Background non-blocking Firestore sync
  if (isFirebaseOnline && db) {
    firestoreSync(
      setDoc(doc(db, collectionName, String(item.id)), item, { merge: true }),
      `saveItem ${collectionName}`
    );
  }

  return item;
}

// Delete item completely
export async function deleteItem(collectionName, id) {
  const data = getLocalStorageData();
  if (Array.isArray(data[collectionName])) {
    data[collectionName] = data[collectionName].filter(item => String(item.id) !== String(id));
    
    // If the deleted item is the active player of the day, clear potd
    if (collectionName === "players" && data.playerOfTheDay && String(data.playerOfTheDay.playerId) === String(id)) {
      data.playerOfTheDay.active = false;
      data.playerOfTheDay.playerName = "";
      data.playerOfTheDay.playerId = null;
    }

    saveLocalStorageData(data);
  }

  // Background non-blocking Firestore sync
  if (isFirebaseOnline && db) {
    firestoreSync(
      deleteDoc(doc(db, collectionName, String(id))),
      `deleteItem ${collectionName}`
    );
  }

  return true;
}

// Save entire ticker news list
export async function saveTickerNews(newsArray) {
  const data = getLocalStorageData();
  data.tickerNews = Array.isArray(newsArray) ? newsArray : [];
  saveLocalStorageData(data);

  if (isFirebaseOnline && db) {
    firestoreSync(
      setDoc(doc(db, "academy_meta", "tickerNews"), { items: data.tickerNews }),
      "saveTickerNews"
    );
  }
  return data.tickerNews;
}

// Set Player of the Day with exact duration (default 24 hours)
export async function setPlayerOfTheDay(playerId, hours = 24, reason = "") {
  const data = getLocalStorageData();
  const player = (data.players || []).find(p => String(p.id) === String(playerId));
  
  if (!player) {
    throw new Error("اللاعب غير موجود في قائمة اللاعبين");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const starObj = {
    playerId: player.id,
    playerName: player.name,
    playerAge: player.age,
    playerPosition: player.position,
    playerPhoto: player.photo || "./images/logo.jpg",
    number: player.number || 10,
    category: player.category || "",
    reason: reason || "الأداء الاستثنائي والالتزام في التدريبات والمباريات",
    selectedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rating: (Math.random() * (9.9 - 9.4) + 9.4).toFixed(1),
    active: true
  };

  data.playerOfTheDay = starObj;
  saveLocalStorageData(data);

  if (isFirebaseOnline && db) {
    firestoreSync(
      setDoc(doc(db, "academy_meta", "playerOfTheDay"), starObj),
      "setPlayerOfTheDay"
    );
  }

  return starObj;
}

// Toggle Star of the Day active state
export async function togglePlayerOfTheDay(active) {
  const data = getLocalStorageData();
  if (!data.playerOfTheDay) {
    data.playerOfTheDay = { active: false };
  }
  data.playerOfTheDay.active = active;
  saveLocalStorageData(data);

  if (isFirebaseOnline && db) {
    firestoreSync(
      setDoc(doc(db, "academy_meta", "playerOfTheDay"), { active }, { merge: true }),
      "togglePlayerOfTheDay"
    );
  }
  return data.playerOfTheDay;
}

// Submit registration request
export async function submitRegistrationRequest(formData) {
  const data = getLocalStorageData();
  if (!Array.isArray(data.registrationRequests)) {
    data.registrationRequests = [];
  }

  const newRequest = {
    id: `req-${Date.now()}`,
    playerName: formData.playerName,
    birthDate: formData.birthDate,
    age: formData.age || calculateAge(formData.birthDate),
    parentName: formData.parentName,
    phone: formData.phone,
    address: formData.address || "",
    preferredPosition: formData.preferredPosition || "خط وسط",
    preferredFoot: formData.preferredFoot || "اليمنى",
    healthNotes: formData.healthNotes || "لا توجد ملاحظات",
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  data.registrationRequests.unshift(newRequest);
  saveLocalStorageData(data);

  if (isFirebaseOnline && db) {
    firestoreSync(
      setDoc(doc(db, "registrationRequests", newRequest.id), newRequest),
      "submitRegistrationRequest"
    );
  }

  return newRequest;
}

// Update request status
export async function updateRequestStatus(requestId, status) {
  const data = getLocalStorageData();
  if (Array.isArray(data.registrationRequests)) {
    const item = data.registrationRequests.find(r => String(r.id) === String(requestId));
    if (item) {
      item.status = status;
      saveLocalStorageData(data);

      if (isFirebaseOnline && db) {
        firestoreSync(
          setDoc(doc(db, "registrationRequests", requestId), { status }, { merge: true }),
          "updateRequestStatus"
        );
      }
    }
  }
}

function calculateAge(birthDateStr) {
  if (!birthDateStr) return 12;
  const birth = new Date(birthDateStr);
  const diff = Date.now() - birth.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 12;
}

// Clear all sample / mock data with one click
export function clearAllMockData() {
  const emptyState = {
    coaches: [],
    players: [],
    trophies: [],
    schedules: [],
    upcomingMatches: [],
    matchResults: [],
    news: [],
    tickerNews: [
      "أهلاً بكم في المنصة الرسمية لأكاديمية مركز شباب الأحمدية لكرة القدم"
    ],
    registrationRequests: [],
    playerOfTheDay: {
      active: false,
      playerName: "",
      playerId: null
    }
  };
  saveLocalStorageData(emptyState);
  return emptyState;
}

// Export data
export function exportData() {
  const data = getLocalStorageData();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `ahmadia_academy_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Import data
export function importData(jsonData) {
  try {
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    saveLocalStorageData(parsed);
    return true;
  } catch (e) {
    console.error("Invalid JSON:", e);
    return false;
  }
}

// Reset data to defaults
export function resetDataToDefaults() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
  window.dispatchEvent(new Event("storage"));
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
