// =====================================================================
// Data Service — Academia Al-Ahmadia
// Dual-engine persistence: instant LocalStorage + Firebase Realtime Database
// cloud sync. Admin changes persist to the cloud and propagate to the
// public website. Adds: image upload (compressed), settings, convert
// request → player, hashed admin auth, activity log.
// =====================================================================
import { DEFAULT_DATA } from "./default-data.js";

// Firebase is loaded on demand, never on the critical first paint.
// This lets the public site render its local cache before the SDK downloads.
let firebaseModulePromise = null;
async function getFirebase() {
  if (!firebaseModulePromise) {
    firebaseModulePromise = import("./firebase-config.js").catch(error => {
      firebaseModulePromise = null;
      console.warn("[Academia] Firebase SDK unavailable; using cached data:", error);
      return null;
    });
  }
  return firebaseModulePromise;
}

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
  // Remove legacy demo seed rows (numeric IDs such as player-1 / coach-2).
  // Genuine records are rehydrated from Realtime Database during the cloud sync.
  const seededId = /^(players?|coaches?|news|trophies|schedules?|upcomingMatches|matchResults|registrationRequests|activity)-(?:[1-9]\d*)$/i;
  ["players", "coaches", "news", "trophies", "schedules", "upcomingMatches", "matchResults", "registrationRequests", "activity"].forEach(key => {
    if (Array.isArray(parsed[key])) parsed[key] = parsed[key].filter(item => !seededId.test(String(item?.id || "")));
  });
  if (Array.isArray(parsed.tickerNews)) {
    parsed.tickerNews = parsed.tickerNews.filter(item => !/^🔥 فتح باب التقديم والتسجيل للموسم الرياضي الجديد/.test(String(item || "")));
  }
  if (parsed.playerOfTheDay?.playerId && /^player-[1-9]\d*$/.test(String(parsed.playerOfTheDay.playerId))) {
    parsed.playerOfTheDay = { active: false };
  }
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
// Cloud writes are awaited. Never report success for a local-only change.
async function requireFirebase() {
  const fb = await getFirebase();
  if (!fb?.isFirebaseOnline || !fb.db) throw new Error("تعذر الاتصال بقاعدة Firebase Realtime Database. لم يتم نشر التعديل.");
  return fb;
}
async function pushItemToCloud(collectionName, item) {
  const fb = await requireFirebase();
  try { await fb.set(fb.ref(fb.db, `${collectionName}/${item.id}`), item); return true; }
  catch (error) {
    console.error(`[Academia] Realtime Database write failed (${collectionName}):`, error);
    throw new Error("فشل نشر البيانات في Realtime Database. راجع Database Rules.");
  }
}
async function pushMetaToCloud(data) {
  const fb = await requireFirebase();
  try {
    await fb.update(fb.ref(fb.db, `${fb.META_DOC}/state`), {
      tickerNews: data.tickerNews || [],
      playerOfTheDay: data.playerOfTheDay || { active: false },
      settings: data.settings || {},
      activity: data.activity || []
    });
    return true;
  } catch (error) {
    console.error("[Academia] Realtime Database metadata write failed:", error);
    throw new Error("فشل نشر البيانات العامة في Realtime Database.");
  }
}

// Pull ALL data from Realtime Database and merge into local (cloud wins for shared content)
export async function syncFromCloud() {
  const fb = await getFirebase();
  if (!fb?.isFirebaseOnline || !fb.db) {
    console.error("[Academia] Realtime Database is not initialized.");
    return null;
  }
  const timeout = (promise, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Realtime Database timeout after 30000ms: ${label}`)), 30000))
  ]);
  try {
    const local = getLocalStorageData();
    const results = await Promise.all(fb.DATA_COLLECTIONS.map(async name => {
      try {
        const snapshot = await timeout(fb.get(fb.ref(fb.db, name)), name);
        const value = snapshot.val() || {};
        return [name, Object.entries(value).map(([key, item]) => ({
          ...(item && typeof item === "object" ? item : {}),
          id: item?.id || key
        }))];
      } catch (error) {
        console.error(`[Academia] Realtime Database read failed for "${name}":`, error);
        throw error;
      }
    }));
    const metaSnapshot = await timeout(fb.get(fb.ref(fb.db, `${fb.META_DOC}/state`)), "academy_meta/state");
    const meta = metaSnapshot.val() || null;
    for (const [name, records] of results) local[name] = records;
    if (!meta) {
      local.tickerNews = [];
      local.playerOfTheDay = { active: false };
      local.activity = [];
    } else {
      local.tickerNews = Array.isArray(meta.tickerNews) ? meta.tickerNews : [];
      local.playerOfTheDay = meta.playerOfTheDay || { active: false };
      local.activity = Array.isArray(meta.activity) ? meta.activity : [];
      if (meta.settings && typeof meta.settings === "object") local.settings = { ...local.settings, ...meta.settings };
    }
    saveLocalStorageData(local);
    console.info("[Academia] Realtime Database sync completed: all collections and metadata loaded.");
    window.dispatchEvent(new CustomEvent("academia-cloud-sync", { detail: { ok: true } }));
    return local;
  } catch (error) {
    console.error("[Academia] Realtime Database sync failed; local cache was not replaced.", error);
    window.dispatchEvent(new CustomEvent("academia-cloud-sync", { detail: { ok: false, message: error.message || "Unknown Realtime Database error" } }));
    return null;
  }
}

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
  const nextSettings = { ...data.settings, ...newSettings };
  const next = { ...data, settings: nextSettings };
  await pushMetaToCloud(next);
  saveLocalStorageData(next);
  return nextSettings;
}

// ============================================================
// CRUD — SAVE / DELETE
// ============================================================
export async function saveItem(collectionName, item) {
  const data = getLocalStorageData();
  if (!Array.isArray(data[collectionName])) data[collectionName] = [];
  const saved = { ...item };
  if (!saved.id) saved.id = `${collectionName}-${Date.now()}`;
  saved.updatedAt = new Date().toISOString();

  // Commit to Realtime Database first. Local cache is updated only after cloud confirms.
  await pushItemToCloud(collectionName, saved);
  const idx = data[collectionName].findIndex(i => String(i.id) === String(saved.id));
  if (idx >= 0) data[collectionName][idx] = { ...data[collectionName][idx], ...saved };
  else data[collectionName].unshift(saved);
  saveLocalStorageData(data);
  return saved;
}

export async function deleteItem(collectionName, id) {
  const fb = await requireFirebase();
  try {
    await fb.remove(fb.ref(fb.db, `${collectionName}/${id}`));
  } catch (error) {
    console.error(`[Academia] Realtime Database delete failed (${collectionName}):`, error);
    throw new Error("فشل حذف السجل من السحابة؛ لم يتم تنفيذ الحذف محلياً.");
  }
  const data = getLocalStorageData();
  if (Array.isArray(data[collectionName])) data[collectionName] = data[collectionName].filter(i => String(i.id) !== String(id));
  if (collectionName === "players" && data.playerOfTheDay && String(data.playerOfTheDay.playerId) === String(id)) {
    data.playerOfTheDay.active = false;
    data.playerOfTheDay.playerName = "";
    data.playerOfTheDay.playerId = null;
    await pushMetaToCloud(data);
  }
  saveLocalStorageData(data);
  return true;
}

// ============================================================
// TICKER NEWS
// ============================================================
export async function saveTickerNews(newsArray) {
  const data = getLocalStorageData();
  const next = { ...data, tickerNews: Array.isArray(newsArray) ? newsArray : [] };
  await pushMetaToCloud(next);
  saveLocalStorageData(next);
  return next.tickerNews;
}

// ============================================================
// PLAYER OF THE DAY
// ============================================================
export async function setPlayerOfTheDay(details) {
  const { playerName, playerAge, playerPosition, rating, imageNumber, hours = 24, reason = "" } = details || {};
  const imageIndex = Number(imageNumber);
  const age = Number(playerAge), score = Number(rating);
  if (!String(playerName || "").trim()) throw new Error("اكتب اسم اللاعب");
  if (!Number.isFinite(age) || age < 4 || age > 60) throw new Error("أدخل عمراً صحيحاً");
  if (!String(playerPosition || "").trim()) throw new Error("اكتب مركز اللاعب");
  if (!Number.isFinite(score) || score < 1 || score > 10) throw new Error("التقييم يجب أن يكون من 1 إلى 10");
  if (!Number.isInteger(imageIndex) || imageIndex < 0) throw new Error("رقم الصورة يجب أن يكون صفراً أو أكبر");
  const data = getLocalStorageData();
  const now = new Date();
  const starObj = {
    playerId: `album-${imageIndex}`, playerImageNumber: imageIndex,
    playerName: String(playerName).trim(), playerAge: age,
    playerPosition: String(playerPosition).trim(), playerPhoto: `./images/players/${imageIndex}.png`,
    number: imageIndex, category: "", reason: String(reason || "").trim() || "الأداء المتميز والالتزام في الأكاديمية",
    selectedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + Number(hours) * 3600000).toISOString(),
    rating: score, active: true
  };
  const next = { ...data, playerOfTheDay: starObj };
  await pushMetaToCloud(next);
  saveLocalStorageData(next);
  addActivity("⭐", `اختيار ${starObj.playerName} نجم اليوم`);
  return starObj;
}

// Backward-compatible helper for older admin clients.
export async function setPlayerOfTheDayByImage(imageNumber, hours = 24, reason = "") {
  const imageIndex = Number(imageNumber);
  return setPlayerOfTheDay({
    playerName: imageIndex === 0 ? "المدرب الفني" : `اللاعب رقم ${imageIndex}`,
    playerAge: 12,
    playerPosition: imageIndex === 0 ? "المدرب الفني" : "لاعب بالأكاديمية",
    rating: 10, imageNumber: imageIndex, hours, reason
  });
}

export async function togglePlayerOfTheDay(active) {
  const data = getLocalStorageData();
  const next = { ...data, playerOfTheDay: { ...(data.playerOfTheDay || {}), active } };
  await pushMetaToCloud(next);
  saveLocalStorageData(next);
  return next.playerOfTheDay;
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
  await pushItemToCloud("registrationRequests", newRequest);
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
      await pushItemToCloud("registrationRequests", item);
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
    await pushItemToCloud("registrationRequests", req);
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
  await pushItemToCloud("players", newPlayer);
  await pushItemToCloud("registrationRequests", req);
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
export async function addActivity(icon, text) {
  const data = getLocalStorageData();
  if (!Array.isArray(data.activity)) data.activity = [];
  data.activity.unshift({ id: `act-${Date.now()}`, icon, text, time: new Date().toISOString() });
  data.activity = data.activity.slice(0, 30);
  try {
    await pushMetaToCloud(data);
    saveLocalStorageData(data);
  } catch (error) {
    console.error("[Academia] Activity log cloud save failed:", error);
  }
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
  const fb = await getFirebase();
  if (!fb?.isFirebaseOnline || !fb.db) {
    throw new Error("تعذر الاتصال بقاعدة البيانات؛ لم يتم تغيير رمز المرور. تحقق من اتصال Firebase ثم أعد المحاولة.");
  }

  const hash = await sha256(newPassword);
  try {
    await fb.update(fb.ref(fb.db, `${fb.META_DOC}/state`), {
      "settings/adminPasswordHash": hash
    });
  } catch (error) {
    console.error("[Academia] Admin password database update failed:", error);
    throw new Error("فشل حفظ رمز المرور في قاعدة البيانات. لم يتم تأكيد التغيير.");
  }

  const data = getLocalStorageData();
  data.settings = { ...(data.settings || {}), adminPasswordHash: hash };
  saveLocalStorageData(data);
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
