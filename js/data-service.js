// Data Service with Firebase Firestore + Offline LocalStorage Fallback
import { db, isFirebaseOnline, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } from "./firebase-config.js";
import { DEFAULT_DATA } from "./default-data.js";

const STORAGE_KEY = "ahmadia_academy_data_v1";

// Helper to load local state
function getLocalStorageData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading localStorage:", e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

// Helper to save local state
function saveLocalStorageData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Error saving to localStorage:", e);
  }
}

// Initialize and sync
export async function initDataService() {
  let localData = getLocalStorageData();
  
  if (isFirebaseOnline && db) {
    try {
      // Try to read settings/meta from firestore to check connection
      const settingsRef = doc(db, "academy_meta", "main");
      // Optional background sync with firestore
    } catch (e) {
      console.warn("Firestore sync deferred:", e);
    }
  }

  // Check player of the day expiration
  checkPlayerOfTheDayExpiration();

  return localData;
}

// Check if Player of the Day is still valid (within 24h)
export function checkPlayerOfTheDayExpiration() {
  const data = getLocalStorageData();
  if (data.playerOfTheDay && data.playerOfTheDay.active) {
    const now = new Date().getTime();
    const expiresAt = new Date(data.playerOfTheDay.expiresAt).getTime();
    if (now > expiresAt) {
      // 24 hours expired! Deactivate or pick default
      data.playerOfTheDay.active = false;
      saveLocalStorageData(data);
    }
  }
}

// Get full academy data
export async function getAllData() {
  checkPlayerOfTheDayExpiration();
  return getLocalStorageData();
}

// Get specific collection
export async function getCollection(name) {
  const data = getLocalStorageData();
  return data[name] || [];
}

// Add or update an item in a collection
export async function saveItem(collectionName, item) {
  const data = getLocalStorageData();
  if (!data[collectionName]) {
    data[collectionName] = [];
  }

  if (!item.id) {
    item.id = `${collectionName}-${Date.now()}`;
  }

  const existingIndex = data[collectionName].findIndex(i => i.id === item.id);
  if (existingIndex >= 0) {
    data[collectionName][existingIndex] = { ...data[collectionName][existingIndex], ...item };
  } else {
    data[collectionName].unshift(item);
  }

  saveLocalStorageData(data);

  // Sync with Firestore if possible
  if (isFirebaseOnline && db) {
    try {
      const itemRef = doc(db, collectionName, item.id);
      await setDoc(itemRef, item, { merge: true });
    } catch (e) {
      console.warn(`Firestore saveItem error on ${collectionName}:`, e);
    }
  }

  return item;
}

// Delete item
export async function deleteItem(collectionName, id) {
  const data = getLocalStorageData();
  if (data[collectionName]) {
    data[collectionName] = data[collectionName].filter(item => item.id !== id);
    saveLocalStorageData(data);
  }

  // Sync with Firestore
  if (isFirebaseOnline && db) {
    try {
      const itemRef = doc(db, collectionName, id);
      await deleteDoc(itemRef);
    } catch (e) {
      console.warn(`Firestore deleteItem error on ${collectionName}:`, e);
    }
  }
  return true;
}

// Set Player of the Day with exact duration (default 24 hours)
export async function setPlayerOfTheDay(playerId, hours = 24, reason = "") {
  const data = getLocalStorageData();
  const player = (data.players || []).find(p => p.id === playerId);
  
  if (!player) {
    throw new Error("اللاعب غير موجود");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const starObj = {
    playerId: player.id,
    playerName: player.name,
    playerAge: player.age,
    playerPosition: player.position,
    playerPhoto: player.photo,
    number: player.number,
    category: player.category,
    reason: reason || "الأداء الاستثنائي والالتزام في التدريبات والمباريات",
    selectedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rating: (Math.random() * (9.9 - 9.3) + 9.3).toFixed(1),
    active: true
  };

  data.playerOfTheDay = starObj;
  saveLocalStorageData(data);

  // Sync to Firestore
  if (isFirebaseOnline && db) {
    try {
      const starRef = doc(db, "academy_meta", "playerOfTheDay");
      await setDoc(starRef, starObj);
    } catch (e) {
      console.warn("Firestore playerOfTheDay sync error:", e);
    }
  }

  return starObj;
}

// Toggle Star of the Day active state
export async function togglePlayerOfTheDay(active) {
  const data = getLocalStorageData();
  if (data.playerOfTheDay) {
    data.playerOfTheDay.active = active;
    saveLocalStorageData(data);

    if (isFirebaseOnline && db) {
      try {
        const starRef = doc(db, "academy_meta", "playerOfTheDay");
        await setDoc(starRef, { active }, { merge: true });
      } catch (e) {
        console.warn("Firestore error:", e);
      }
    }
  }
  return data.playerOfTheDay;
}

// Submit new registration request
export async function submitRegistrationRequest(formData) {
  const data = getLocalStorageData();
  if (!data.registrationRequests) {
    data.registrationRequests = [];
  }

  const newRequest = {
    id: `req-${Date.now()}`,
    playerName: formData.playerName,
    birthDate: formData.birthDate,
    age: formData.age || calculateAge(formData.birthDate),
    parentName: formData.parentName,
    phone: formData.phone,
    address: formData.address,
    preferredPosition: formData.preferredPosition || "خط وسط",
    preferredFoot: formData.preferredFoot || "اليمنى",
    healthNotes: formData.healthNotes || "لا توجد ملاحظات",
    status: "pending", // 'pending', 'approved', 'rejected'
    submittedAt: new Date().toISOString()
  };

  data.registrationRequests.unshift(newRequest);
  saveLocalStorageData(data);

  // Sync to Firestore
  if (isFirebaseOnline && db) {
    try {
      const reqRef = doc(db, "registrationRequests", newRequest.id);
      await setDoc(reqRef, newRequest);
    } catch (e) {
      console.warn("Firestore submission error:", e);
    }
  }

  return newRequest;
}

// Update registration request status
export async function updateRequestStatus(requestId, status) {
  const data = getLocalStorageData();
  if (data.registrationRequests) {
    const item = data.registrationRequests.find(r => r.id === requestId);
    if (item) {
      item.status = status;
      saveLocalStorageData(data);

      if (isFirebaseOnline && db) {
        try {
          const reqRef = doc(db, "registrationRequests", requestId);
          await setDoc(reqRef, { status }, { merge: true });
        } catch (e) {
          console.warn("Firestore error:", e);
        }
      }
    }
  }
}

// Helper: calculate age from date of birth
function calculateAge(birthDateStr) {
  if (!birthDateStr) return 12;
  const birth = new Date(birthDateStr);
  const diff = Date.now() - birth.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 12;
}

// Export data to JSON file
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

// Import data from JSON
export function importData(jsonData) {
  try {
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    saveLocalStorageData(parsed);
    return true;
  } catch (e) {
    console.error("Invalid JSON format:", e);
    return false;
  }
}

// Reset data to defaults
export function resetDataToDefaults() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
