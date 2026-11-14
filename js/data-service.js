// =====================================================================
// Data Service — Academia Al-Ahmadia
// Dual-engine persistence: instant LocalStorage + Firebase Firestore
// cloud sync. Admin changes persist to the cloud and propagate to the
// public website. Adds: image upload (compressed), settings, convert
// request → player, hashed admin auth, activity log.
// =====================================================================
import {
  db, isFirebaseOnline, DATA_COLLECTIONS, META_DOC,
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch
} from "./firebase-config.js";
import { DEFAULT_DATA } from "./default-data.js";

const STORAGE_KEY = "ahmadia_academy_data_v1"; // preserved from original repo
const SESSION_KEY = "ahmadia_admin_session";
const SESSION_TTL = 1000 * 60 * 60 * 4; // 4 hours

// ============================================================
// LOCAL STORAGE ENGINE
// ============================================================
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function getLocalStorageData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = deepClone(DEFAULT_DATA);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return migrateData(parsed);
  } catch (e) {
    console.error("[Academia] localStorage read error:", e);
    return deepClone(DEFAULT_DATA);
  }
}

function saveLocalStorageData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("[Academia] localStorage save error (quota?):", e);
    // Last-resort: strip heavy base64 images if quota exceeded
    try {
      const stripped = stripImages(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
      window.dispatchEvent(new Event("storage"));
    } catch (e2) {
      console.error("[Academia] Could not persist even after stripping images:", e2);
    }
  }
}

// Ensure the loaded object has every collection + settings + enriched fields
function migrateData(parsed) {
  const defaults = DEFAULT_DATA;
  if (!Array.isArray(parsed.players)) parsed.players = [];
  if (!Array.isArray(parsed.coaches)) parsed.coaches = [];
  if (!Array.isArray(parsed.trophies)) parsed.trophies = [];
  if (!Array.isArray(parsed.schedules)) parsed.schedules = [];
  if (!Array.isArray(parsed.upcomingMatches)) parsed.upcomingMatches = [];
  if (!Array.isArray(parsed.matchResults)) parsed.matchResults = [];
  if (!Array.isArray(parsed.news)) parsed.news = [];
  if (!Array.isArray(parsed.tickerNews)) parsed.tickerNews = defaults.tickerNews.slice();
  if (!Array.isArray(parsed.registrationRequests)) parsed.registrationRequests = [];
  if (!Array.isArray(parsed.activity)) parsed.activity = defaults.activity.slice();
  if (!parsed.settings || typeof parsed.settings !== "object") {
    parsed.settings = deepClone(defaults.settings);
  } else {
    // Merge any new settings keys from defaults
    parsed.settings = { ...deepClone(defaults.settings), ...parsed.settings };
  }
  if (!parsed.playerOfTheDay || typeof parsed.playerOfTheDay !== "object") {
    parsed.playerOfTheDay = { active: false };
  }
  // Enrich players with new fields (idempotent)
  parsed.players.forEach(p => {
    if (!p.birthDate) p.birthDate = "";
    if (!p.registrationStatus) p.registrationStatus = "active";
    if (!Array.isArray(p.achievements)) p.achievements = [];
    if (!p.performance) p.performance = "";
    if (p.goals == null) p.goals = 0;
    if (p.assists == null) p.assists = 0;
    if (p.matches == null) p.matches = 0;
    if (p.cleanSheets == null) p.cleanSheets = 0;
  });
  // Enrich trophies with image field
  parsed.trophies.forEach(t => { if (t.image === undefined) t.image = ""; });
  // Enrich match results with report
  parsed.matchResults.forEach(r => { if (r.matchReport === undefined) r.matchReport = ""; });
  return parsed;
}

// Strip base64 data URIs from image fields (fallback when quota exceeded)
function stripImages(data) {
  const clone = deepClone(data);
  const clean = (s) => (typeof s === "string" && s.startsWith("data:image")) ? "./images/logo.jpg" : s;
  clone.players.forEach(p => { p.photo = clean(p.photo); });
  clone.coaches.forEach(c => { c.photo = clean(c.photo); });
  clone.news.forEach(n => { n.image = clean(n.image); });
  clone.trophies.forEach(t => { t.image = clean(t.image); });
  if (clone.settings) clone.settings.logo = clean(clone.settings.logo);
  return clone;
}

// ============================================================
// FIRESTORE SYNC
// ============================================================
function firestoreSync(operationPromise, opName = "operation") {
  if (!isFirebaseOnline || !db) return;
  Promise.race([
    operationPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500))
  ]).catch(err => {
    console.warn(`[Academia] Cloud sync note (${opName}):`, err.message || err);
  });
}

// Push a single item to its Firestore collection
function pushItemToCloud(collectionName, item) {
  if (!isFirebaseOnline || !db) return;
  firestoreSync(
    setDoc(doc(db, collectionName, String(item.id)), item, { merge: true }),
    `save ${collectionName}`
  );
}

// Pull ALL data from Firestore and merge into local (cloud wins for shared content)
export async function syncFromCloud() {
  if (!isFirebaseOnline || !db) return null;
  try {
    const local = getLocalStorageData();
    let changed = false;

    // Pull each collection
    for (const colName of DATA_COLLECTIONS) {
      try {
        const snap = await Promise.race([
          getDocs(collection(db, colName)),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
        ]);
        if (!snap.empty) {
          const cloudItems = [];
          snap.forEach(d => { const v = d.data(); if (v && v.id) cloudItems.push(v); });
          // Merge: cloud items override local by id, keep local-only items too
          const localItems = Array.isArray(local[colName]) ? local[colName] : [];
          const merged = [...cloudItems];
          localItems.forEach(li => {
            if (!cloudItems.some(ci => String(ci.id) === String(li.id))) merged.push(li);
          });
          if (JSON.stringify(local[colName]) !== JSON.stringify(merged)) {
            local[colName] = merged;
            changed = true;
          }
        }
      } catch (e) { /* ignore single-collection errors */ }
    }

    // Pull academy_meta (tickerNews, playerOfTheDay, settings, activity)
    try {
      const metaSnap = await getDoc(doc(db, META_DOC, "state"));
      if (metaSnap.exists()) {
        const meta = metaSnap.data();
        if (Array.isArray(meta.tickerNews) && meta.tickerNews.length) {
          local.tickerNews = meta.tickerNews; changed = true;
        }
        if (meta.playerOfTheDay) {
          local.playerOfTheDay = { ...local.playerOfTheDay, ...meta.playerOfTheDay }; changed = true;
        }
        if (meta.settings) {
          local.settings = { ...local.settings, ...meta.settings }; changed = true;
        }
        if (Array.isArray(meta.activity) && meta.activity.length) {
          local.activity = meta.activity; changed = true;
        }
      }
    } catch (e) { /* ignore meta errors */ }

    if (changed) {
      saveLocalStorageData(local);
      console.log("[Academia] Cloud data merged into local cache.");
    }
    return local;
  } catch (err) {
    console.warn("[Academia] syncFromCloud failed:", err.message);
    return null;
  }
}

// Push the meta doc (tickerNews, playerOfTheDay, settings, activity)
function pushMetaToCloud(data) {
  if (!isFirebaseOnline || !db) return;
  firestoreSync(
    setDoc(doc(db, META_DOC, "state"), {
      tickerNews: data.tickerNews || [],
      playerOfTheDay: data.playerOfTheDay || { active: false },
      settings: data.settings || {},
      activity: data.activity || []
    }, { merge: true }),
    "push meta"
  );
}

// ============================================================
// INITIALIZATION
// ============================================================
export async function initDataService() {
  checkPlayerOfTheDayExpiration();
  // Kick off non-blocking cloud pull so admin edits appear on the public site
  syncFromCloud().catch(() => {});
  // Periodic + on-focus refresh keeps data fresh without stale cache
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => { syncFromCloud().catch(() => {}); });
    setInterval(() => { syncFromCloud().catch(() => {}); }, 1000 * 60 * 2);
  }
  return getLocalStorageData();
}

export function checkPlayerOfTheDayExpiration() {
  const data = getLocalStorageData();
  if (data.playerOfTheDay && data.playerOfTheDay.active && data.playerOfTheDay.expiresAt) {
    const now = Date.now();
    const expiresAt = new Date(data.playerOfTheDay.expiresAt).getTime();
    if (now > expiresAt) {
      data.playerOfTheDay.active = false;
      saveLocalStorageData(data);
    }
  }
}

export async function getAllData() {
  checkPlayerOfTheDayExpiration();
  return getLocalStorageData();
}

// ============================================================
// SETTINGS
// ============================================================
export function getSettings() {
  return getLocalStorageData().settings || deepClone(DEFAULT_DATA.settings);
}

export async function saveSettings(newSettings) {
  const data = getLocalStorageData();
  data.settings = { ...data.settings, ...newSettings };
  saveLocalStorageData(data);
  pushMetaToCloud(data);
  return data.settings;
}

// ============================================================
// CRUD — SAVE / DELETE
// ============================================================
export async function saveItem(collectionName, item) {
  const data = getLocalStorageData();
  if (!Array.isArray(data[collectionName])) data[collectionName] = [];

  if (!item.id) item.id = `${collectionName}-${Date.now()}`;
  item.updatedAt = new Date().toISOString();

  const idx = data[collectionName].findIndex(i => String(i.id) === String(item.id));
  if (idx >= 0) {
    data[collectionName][idx] = { ...data[collectionName][idx], ...item };
  } else {
    data[collectionName].unshift(item);
  }

  saveLocalStorageData(data);
  pushItemToCloud(collectionName, data[collectionName][idx >= 0 ? idx : 0]);
  return item;
}

export async function deleteItem(collectionName, id) {
  const data = getLocalStorageData();
  if (Array.isArray(data[collectionName])) {
    data[collectionName] = data[collectionName].filter(i => String(i.id) !== String(id));
    if (collectionName === "players" && data.playerOfTheDay && String(data.playerOfTheDay.playerId) === String(id)) {
      data.playerOfTheDay.active = false;
      data.playerOfTheDay.playerName = "";
      data.playerOfTheDay.playerId = null;
    }
    saveLocalStorageData(data);
  }
  if (isFirebaseOnline && db) {
    firestoreSync(deleteDoc(doc(db, collectionName, String(id))), `delete ${collectionName}`);
  }
  return true;
}

// ============================================================
// TICKER NEWS
// ============================================================
export async function saveTickerNews(newsArray) {
  const data = getLocalStorageData();
  data.tickerNews = Array.isArray(newsArray) ? newsArray : [];
  saveLocalStorageData(data);
  pushMetaToCloud(data);
  return data.tickerNews;
}

// ============================================================
// PLAYER OF THE DAY
// ============================================================
export export async function setPlayerOfTheDayByImage(imageNumber, hours = 24, reason = "") {
  const imageIndex = Number(imageNumber);
  if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex > 27) {
    throw new Error("رقم الصورة يجب أن يكون من 0 إلى 27");
  }

  const data = getLocalStorageData();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const playerName = imageIndex === 0 ? "المدرب الفني" : `اللاعب رقم ${imageIndex}`;
  const starObj = {
    playerId: `album-${imageIndex}`,
    playerImageNumber: imageIndex,
    playerName,
    playerAge: "",
    playerPosition: imageIndex === 0 ? "المدرب الفني" : "لاعب بالأكاديمية",
    playerPhoto: `./images/players/${imageIndex}.png`,
    number: imageIndex,
    category: "",
    reason: reason || "الأداء المتميز والالتزام في الأكاديمية",
    selectedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rating: "10.0",
    active: true
  };
  data.playerOfTheDay = starObj;
  saveLocalStorageData(data);
  pushMetaToCloud(data);
  addActivity("⭐", `اختيار ${playerName} نجم اليوم من ألبوم الصور`);
  return starObj;
}

export async function togglePlayerOfTheDay(active) {
  const data = getLocalStorageData();
  if (!data.playerOfTheDay) data.playerOfTheDay = { active: false };
  data.playerOfTheDay.active = active;
  saveLocalStorageData(data);
  pushMetaToCloud(data);
  return data.playerOfTheDay;
}

// ============================================================
// REGISTRATION REQUESTS
// ============================================================
function calculateAge(birthDateStr) {
  if (!birthDateStr) return 12;
  const birth = new Date(birthDateStr);
  const diff = Date.now() - birth.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 12;
}

export async function submitRegistrationRequest(formData) {
  const data = getLocalStorageData();
  if (!Array.isArray(data.registrationRequests)) data.registrationRequests = [];
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
  pushItemToCloud("registrationRequests", newRequest);
  addActivity("📝", `استلام طلب انضمام جديد: ${newRequest.playerName}`);
  return newRequest;
}

export async function updateRequestStatus(requestId, status) {
  const data = getLocalStorageData();
  if (Array.isArray(data.registrationRequests)) {
    const item = data.registrationRequests.find(r => String(r.id) === String(requestId));
    if (item) {
      item.status = status;
      saveLocalStorageData(data);
      pushItemToCloud("registrationRequests", item);
      addActivity(status === "approved" ? "✅" : "❌", `${status === "approved" ? "قبول" : "رفض"} طلب ${item.playerName}`);
    }
  }
}

// Convert an approved registration request into a registered player (no duplication)
export async function convertRequestToPlayer(requestId, extra = {}) {
  const data = getLocalStorageData();
  const req = (data.registrationRequests || []).find(r => String(r.id) === String(requestId));
  if (!req) throw new Error("الطلب غير موجود");

  // Avoid duplicating: if a player with same name+birthDate exists, just update status
  const existing = (data.players || []).find(p =>
    p.name === req.playerName && p.birthDate === req.birthDate
  );
  if (existing) {
    req.status = "approved";
    saveLocalStorageData(data);
    pushItemToCloud("registrationRequests", req);
    return { player: existing, duplicated: false };
  }

  const newPlayer = {
    id: `player-${Date.now()}`,
    name: req.playerName,
    birthDate: req.birthDate,
    birthYear: req.birthDate ? new Date(req.birthDate).getFullYear() : undefined,
    age: req.age || calculateAge(req.birthDate),
    position: extra.position || req.preferredPosition || "لاعب خط وسط",
    category: extra.category || guessCategoryFromAge(req.age || calculateAge(req.birthDate)),
    number: extra.number || (data.players.length + 1),
    photo: "./images/logo.jpg",
    foot: req.preferredFoot || "اليمنى",
    goals: 0, assists: 0, matches: 0, cleanSheets: 0,
    registrationStatus: "active",
    achievements: [],
    performance: "",
    convertedFromRequest: req.id
  };
  if (!Array.isArray(data.players)) data.players = [];
  data.players.unshift(newPlayer);

  req.status = "approved";
  saveLocalStorageData(data);
  pushItemToCloud("players", newPlayer);
  pushItemToCloud("registrationRequests", req);
  addActivity("🏃", `تحويل ${req.playerName} إلى لاعب مسجل`);
  return { player: newPlayer, duplicated: false };
}

function guessCategoryFromAge(age) {
  const y = new Date().getFullYear();
  const birthYear = y - age;
  if (age <= 11) return "2014-2016";
  if (age <= 13) return "2012-2014";
  if (age <= 15) return "2010-2012";
  return "2008-2010";
}

// ============================================================
// ACTIVITY LOG
// ============================================================
export function addActivity(icon, text) {
  const data = getLocalStorageData();
  if (!Array.isArray(data.activity)) data.activity = [];
  data.activity.unshift({ id: `act-${Date.now()}`, icon, text, time: new Date().toISOString() });
  data.activity = data.activity.slice(0, 30); // keep last 30
  saveLocalStorageData(data);
  pushMetaToCloud(data);
}

export function getRecentActivity(limit = 6) {
  const data = getLocalStorageData();
  return (data.activity || []).slice(0, limit);
}

// ============================================================
// IMAGE UPLOAD (compressed base64 data URI — works offline + syncs to cloud)
// ============================================================
export async function processImageUpload(file, { maxSize = 700, quality = 0.82 } = {}) {
  if (!file) throw new Error("لم يتم اختيار ملف");
  if (!file.type.startsWith("image/")) throw new Error("الملف المختار ليس صورة صحيحة");
  if (file.size > 6 * 1024 * 1024) throw new Error("حجم الصورة كبير جداً (الحد الأقصى 6 ميجابايت)");

  const dataUrl = await readFileAsDataURL(file);
  const compressed = await compressImage(dataUrl, maxSize, quality);
  return compressed; // JPEG data URI
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(new Error("فشل معالجة الصورة"));
      }
    };
    img.onerror = () => reject(new Error("فشل تحميل الصورة"));
    img.src = dataUrl;
  });
}

// ============================================================
// ADMIN AUTH (hashed password via SubtleCrypto SHA-256)
// NOTE: client-side gate for a static site. For full server-side
// authorization, enable Firebase Auth + Security Rules (see README).
// ============================================================
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAdminPassword(input) {
  const settings = getSettings();
  const expected = settings.adminPasswordHash;
  if (!expected) return false;
  const hashed = await sha256(input);
  return hashed === expected;
}

export async function changeAdminPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
  }
  const hash = await sha256(newPassword);
  await saveSettings({ adminPasswordHash: hash });
  return true;
}

export function loginAdmin() {
  const session = { at: Date.now(), exp: Date.now() + SESSION_TTL };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function isLoggedIn() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (Date.now() > s.exp) { sessionStorage.removeItem(SESSION_KEY); return false; }
    return true;
  } catch { return false; }
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ============================================================
// BACKUP / RESTORE / RESET
// ============================================================
export function clearAllMockData() {
  const data = getLocalStorageData();
  data.coaches = [];
  data.players = [];
  data.trophies = [];
  data.schedules = [];
  data.upcomingMatches = [];
  data.matchResults = [];
  data.news = [];
  data.registrationRequests = [];
  data.activity = [];
  data.tickerNews = ["أهلاً بكم في المنصة الرسمية لأكاديمية مركز شباب الأحمدية لكرة القدم"];
  data.playerOfTheDay = { active: false, playerName: "", playerId: null };
  // keep settings
  saveLocalStorageData(data);
  return data;
}

export function exportData() {
  const data = getLocalStorageData();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `ahmadia_academy_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function importData(jsonData) {
  try {
    const parsed = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
    const migrated = migrateData(parsed);
    saveLocalStorageData(migrated);
    return true;
  } catch (e) {
    console.error("[Academia] Invalid JSON import:", e);
    return false;
  }
}

export function resetDataToDefaults() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deepClone(DEFAULT_DATA)));
  window.dispatchEvent(new Event("storage"));
  return deepClone(DEFAULT_DATA);
}
