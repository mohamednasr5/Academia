// =====================================================================
// Academia Al-Ahmadia — Admin Dashboard Controller v3.0
// Full CRUD for every entity with image uploads, convert request →
// player, settings management, hashed admin auth, backups, and a
// dashboard overview with recent activity.
// =====================================================================
import {
  getAllData, syncFromCloud, saveItem, deleteItem, saveTickerNews,
  clearAllMockData, setPlayerOfTheDay, togglePlayerOfTheDay,
  updateRequestStatus, convertRequestToPlayer,
  exportData, importData, resetDataToDefaults,
  getSettings, saveSettings, changeAdminPassword,
  verifyAdminPassword, loginAdmin, isLoggedIn, logoutAdmin,
  addActivity, getRecentActivity, processImageUpload
} from "./data-service.js";

let currentData = null;
let pendingImage = null; // holds a data URI for the currently-open modal's image field

// ============================================================
// INIT
// ============================================================
// Surface rejected cloud saves instead of silently appearing successful.
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || "تعذر حفظ التعديل على السحابة.";
  console.error("[Academia] Admin action failed:", event.reason);
  if (typeof adminToast === "function") adminToast(message, "error");
});

document.addEventListener("DOMContentLoaded", async () => {
  setupAuth();
  setupNavigation();
  setupModalClose();
  setupPotdForm();
  setupSettingsForm();
  setupChangePasswordForm();
  setupBackupHandlers();
  setupQuickActions();

  if (isLoggedIn()) {
    showDashboard();
    await syncFromCloud().catch(error => console.warn('[Academia] Admin cloud refresh failed:', error));
    await loadAdminData();
  }
});

// ============================================================
// AUTH
// ============================================================
function setupAuth() {
  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pass = document.getElementById("admin-password").value;
      const errEl = document.getElementById("login-error");
      errEl.textContent = "";
      const ok = await verifyAdminPassword(pass);
      if (ok) {
        loginAdmin();
        showDashboard();
        await loadAdminData();
      } else {
        errEl.textContent = "رمز المرور غير صحيح! حاول مرة أخرى.";
      }
    });
  }
  const logoutBtn = document.getElementById("btn-admin-logout");
  const mobileLogout = document.getElementById("btn-mobile-logout");
  const handleLogout = () => { logoutAdmin(); window.location.reload(); };
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (mobileLogout) mobileLogout.addEventListener("click", handleLogout);
}

function showDashboard() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("dashboard-section").style.display = "block";
}

// ============================================================
// NAVIGATION (sidebar, mobile bottom, drawer, quick actions)
// ============================================================
const TAB_TITLES = {
  "tab-dashboard": "📊 نظرة عامة",
  "tab-potd": "⭐ نجم اليوم",
  "tab-requests": "📝 طلبات الانضمام",
  "tab-players": "🏃 إدارة اللاعبين",
  "tab-coaches": "👔 الجهاز الفني",
  "tab-matches": "⚽ المباريات والنتائج",
  "tab-news": "📰 الأخبار والشريط",
  "tab-trophies": "🏆 دولاب البطولات",
  "tab-schedules": "🕒 جدول التدريب",
  "tab-settings": "⚙️ الإعدادات العامة"
};

function setupNavigation() {
  const switchTab = (tabId) => {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".admin-nav-btn[data-tab], .admin-bottom-item[data-tab]").forEach(b => b.classList.remove("active"));
    const panel = document.getElementById(tabId);
    if (panel) panel.classList.add("active");
    document.querySelectorAll(`.admin-nav-btn[data-tab="${tabId}"]`).forEach(b => b.classList.add("active"));
    document.querySelectorAll(`.admin-bottom-item[data-tab="${tabId}"]`).forEach(b => b.classList.add("active"));
    const title = document.getElementById("page-title");
    if (title && TAB_TITLES[tabId]) title.textContent = TAB_TITLES[tabId];
    closeMobileSidebar();
  };

  document.querySelectorAll(".admin-nav-btn[data-tab], .admin-bottom-item[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  // Quick action buttons
  document.querySelectorAll(".quick-action[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  // Mobile drawer
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("admin-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (toggle && sidebar && backdrop) {
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("open");
    });
    backdrop.addEventListener("click", closeMobileSidebar);
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("admin-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.remove("open");
  if (backdrop) backdrop.classList.remove("open");
}

// ============================================================
// LOAD DATA & RENDER
// ============================================================
async function loadAdminData() {
  currentData = await getAllData();
  renderAdminStats(currentData);
  renderRecentActivity(currentData);
  renderPotdTab(currentData);
  renderRequestsTable(currentData.registrationRequests || []);
  renderPlayersTable(currentData.players || []);
  renderCoachesTable(currentData.coaches || []);
  renderMatchesTables(currentData.upcomingMatches || [], currentData.matchResults || []);
  renderNewsAndTicker(currentData.tickerNews || [], currentData.news || []);
  renderTrophiesTable(currentData.trophies || []);
  renderSchedulesTable(currentData.schedules || []);
  loadSettingsForm(currentData.settings || {});
}

// ============================================================
// STATS + RECENT ACTIVITY
// ============================================================
function renderAdminStats(data) {
  const pending = (data.registrationRequests || []).filter(r => r.status === "pending").length;
  setText("stat-total-players", (data.players || []).length);
  setText("stat-new-requests", pending);
  setText("stat-total-trophies", (data.trophies || []).length);
  setText("stat-total-matches", (data.upcomingMatches || []).length);
  setText("badge-requests-count", pending);
  const mobBadge = document.getElementById("badge-requests-mobile");
  if (mobBadge) {
    if (pending > 0) { mobBadge.textContent = pending; mobBadge.style.display = "block"; }
    else mobBadge.style.display = "none";
  }
}

function renderRecentActivity(data) {
  const list = document.getElementById("recent-activity-list");
  if (!list) return;
  const items = (data.activity || []).slice(0, 6);
  if (!items.length) {
    list.innerHTML = '<li class="recent-activity-item"><div class="act-icon">📋</div><div class="act-text">لا يوجد نشاط مسجل بعد.</div></li>';
    return;
  }
  list.innerHTML = items.map(a => `
    <li class="recent-activity-item">
      <div class="act-icon">${a.icon || '•'}</div>
      <div class="act-text">${escapeHtml(a.text || '')}</div>
      <div class="act-time">${formatRelativeTime(a.time)}</div>
    </li>`).join("");
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return d.toLocaleDateString("ar-EG");
}

// ============================================================
// PLAYER OF THE DAY
// ============================================================
function renderPotdTab(data) {
  const imageInput = document.getElementById("potd-image-number");
  const imagePreview = document.getElementById("potd-image-preview");
  const preview = document.getElementById("potd-current-preview");
  const indicator = document.getElementById("potd-status-indicator");
  const updateImagePreview = () => {
    if (!imageInput || !imagePreview) return;
    const raw = imageInput.value.trim(), number = Number(raw);
    if (raw === "" || !Number.isInteger(number) || number < 0) {
      imagePreview.innerHTML = '<span style="color:var(--text-muted);">أدخل رقم صورة رقم يبدأ من 0 لعرض المعاينة</span>';
      return;
    }
    const label = number === 0 ? "المدرب الفني" : `صورة اللاعب رقم ${number}`;
    imagePreview.innerHTML = `<img src="./images/players/${number}.png" alt="${label}" style="width:150px;height:180px;object-fit:cover;object-position:top;border-radius:12px;border:2px solid var(--gold-primary);" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;color:#ff8a8a;">تعذر تحميل الصورة</span><strong style="color:var(--gold-light);">${label}</strong>`;
  };
  if (imageInput && !imageInput.dataset.previewBound) {
    imageInput.addEventListener("input", updateImagePreview);
    imageInput.dataset.previewBound = "true";
  }
  updateImagePreview();
  const potd = data.playerOfTheDay;
  if (!potd || !potd.active) {
    if (indicator) { indicator.className = "badge-status rejected"; indicator.textContent = "غير مفعل"; }
    if (preview) preview.innerHTML = '<p style="text-align:center;color:var(--text-muted);">⚠️ لا يوجد نجم نشط حالياً. املأ بيانات اللاعب في النموذج أعلاه.</p>';
    return;
  }
  if (indicator) { indicator.className = "badge-status approved"; indicator.textContent = "مفعل وظاهر على الموقع"; }
  const expires = new Date(potd.expiresAt);
  const diffH = Math.max(0, Math.round((expires - new Date()) / 3600000));
  const imageNumber = Number.isInteger(Number(potd.playerImageNumber)) ? Number(potd.playerImageNumber) : null;
  const imageSrc = imageNumber !== null ? `./images/players/${imageNumber}.png` : (potd.playerPhoto || "./images/logo.jpg");
  if (preview) preview.innerHTML = `
    <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">
      <img src="${imageSrc}" alt="${escapeHtml(potd.playerName || "نجم اليوم")}" style="width:150px;height:190px;border-radius:16px;border:3px solid var(--gold-primary);object-fit:cover;object-position:top;" onerror="this.src='./images/logo.jpg'">
      <div style="flex:1;min-width:200px;line-height:2;">
        <h4 style="font-size:1.25rem;color:#fff;">👑 ${escapeHtml(potd.playerName || "")}</h4>
        <p>العمر: ${escapeHtml(String(potd.playerAge || "—"))} سنة | المركز: ${escapeHtml(potd.playerPosition || "—")}</p>
        <p style="color:var(--gold-light);font-weight:800;">التقييم: ${escapeHtml(String(potd.rating || "—"))}/10</p>
        <p style="color:var(--gold-light);"><strong>سبب التكريم:</strong> ${escapeHtml(potd.reason || "")}</p>
      </div>
      <div style="background:rgba(0,0,0,.4);padding:14px;border-radius:12px;">متبقي<br><strong style="font-size:1.3rem;color:var(--gold-light);">${diffH} ساعة</strong></div>
    </div>`;
}

function setupPotdForm() {
  const form = document.getElementById("form-set-potd");
  const toggleBtn = document.getElementById("btn-toggle-potd");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const playerName = document.getElementById("potd-player-name").value.trim();
    const playerAge = Number(document.getElementById("potd-player-age").value);
    const playerPosition = document.getElementById("potd-player-position").value.trim();
    const rating = Number(document.getElementById("potd-player-rating").value);
    const imageNumber = Number(document.getElementById("potd-image-number").value);
    const hours = parseInt(document.getElementById("potd-duration-select").value, 10) || 24;
    const reason = document.getElementById("potd-reason-input").value.trim();
    if (!playerName || !playerPosition || !Number.isFinite(playerAge) || playerAge < 4 || playerAge > 60 ||
        !Number.isFinite(rating) || rating < 1 || rating > 10 ||
        !Number.isInteger(imageNumber) || imageNumber < 0 || !reason) {
      adminToast("راجع الاسم والعمر والمركز والتقييم ورقم الصورة وسبب التكريم", "error");
      return;
    }
    try {
      await setPlayerOfTheDay({ playerName, playerAge, playerPosition, rating, imageNumber, hours, reason });
      adminToast(`⭐ تم تعيين ${playerName} نجم اليوم لمدة ${hours} ساعة!`, "success");
      form.reset();
      document.getElementById("potd-player-rating").value = "10";
      await loadAdminData();
    } catch (err) { adminToast("خطأ: " + err.message, "error"); }
  });
  if (toggleBtn) toggleBtn.addEventListener("click", async () => {
    const active = currentData?.playerOfTheDay ? !currentData.playerOfTheDay.active : true;
    await togglePlayerOfTheDay(active);
    await loadAdminData();
    adminToast(active ? "تم تفعيل لوحة الشرف" : "تم إخفاء لوحة الشرف", "success");
  });
}

// ============================================================
// REGISTRATION REQUESTS
// ============================================================
function renderRequestsTable(requests) {
  const tbody = document.getElementById("table-requests-body");
  if (!tbody) return;
  if (!requests.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:25px;color:var(--text-muted);">لا توجد طلبات تقديم حالياً.</td></tr>';
    return;
  }
  tbody.innerHTML = requests.map(req => {
    let phone = (req.phone || "").replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "2" + phone;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`مرحباً أستاذ ${req.parentName}، نتواصل معك بخصوص طلب انضمام اللاعب (${req.playerName}) لأكاديمية مركز شباب الأحمدية لكرة القدم.`)}`;
    const statusBadge = req.status === "approved" ? '<span class="badge-status approved">مقبول ✅</span>'
      : req.status === "rejected" ? '<span class="badge-status rejected">مرفوض ❌</span>'
      : '<span class="badge-status pending">قيد المراجعة ⏳</span>';
    return `
      <tr>
        <td><strong>${escapeHtml(req.playerName)}</strong><br><span style="font-size:0.74rem;color:var(--text-muted);">${escapeHtml(req.preferredPosition || '')} • ${escapeHtml(req.preferredFoot || '')}</span></td>
        <td>${req.age || 12} سنة<br><span style="font-size:0.74rem;color:var(--text-muted);">${escapeHtml(req.birthDate || '')}</span></td>
        <td>${escapeHtml(req.parentName || '')}<br><span style="font-size:0.74rem;color:var(--text-muted);">${escapeHtml(req.address || '')}</span></td>
        <td><a href="${waUrl}" target="_blank" class="btn-action-icon whatsapp" title="واتساب">💬</a> <span style="direction:ltr;display:inline-block;">${escapeHtml(req.phone || '')}</span></td>
        <td><span class="badge-status neutral">${escapeHtml(req.preferredPosition || '')}</span></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-action-icon view" title="عرض التفاصيل" data-action="view-req" data-id="${req.id}">👁️</button>
          <button class="btn-action-icon convert" title="تحويل إلى لاعب مسجل" data-action="convert-req" data-id="${req.id}">🏃</button>
          <button class="btn-action-icon edit" style="background:rgba(85,217,138,0.16);color:var(--success);border-color:var(--success);" title="قبول" data-action="approve-req" data-id="${req.id}">✓</button>
          <button class="btn-action-icon delete" style="background:rgba(255,100,112,0.16);color:var(--danger);border-color:var(--danger);" title="رفض" data-action="reject-req" data-id="${req.id}">✕</button>
          <button class="btn-action-icon delete" title="حذف" data-action="delete-req" data-id="${req.id}">🗑️</button>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleRequestAction(btn.getAttribute("data-action"), btn.getAttribute("data-id")));
  });
}

async function handleRequestAction(action, id) {
  const req = (currentData.registrationRequests || []).find(r => String(r.id) === String(id));
  if (!req) return;
  if (action === "view-req") {
    showAdminModal("تفاصيل طلب الانضمام", `
      <div style="line-height:1.9;color:var(--text-main);">
        <p><strong>👤 اللاعب:</strong> ${escapeHtml(req.playerName)}</p>
        <p><strong>🎂 الميلاد:</strong> ${escapeHtml(req.birthDate || '')} (${req.age || ''} سنة)</p>
        <p><strong>👨 ولي الأمر:</strong> ${escapeHtml(req.parentName)}</p>
        <p><strong>📱 الهاتف:</strong> <span dir="ltr">${escapeHtml(req.phone)}</span></p>
        <p><strong>🏠 العنوان:</strong> ${escapeHtml(req.address || '—')}</p>
        <p><strong>⚽ المركز المفضل:</strong> ${escapeHtml(req.preferredPosition || '')}</p>
        <p><strong>🦶 القدم:</strong> ${escapeHtml(req.preferredFoot || '')}</p>
        <p><strong>📝 ملاحظات صحية:</strong> ${escapeHtml(req.healthNotes || '—')}</p>
        <p><strong>📅 تاريخ التقديم:</strong> ${new Date(req.submittedAt).toLocaleString("ar-EG")}</p>
      </div>`);
    return;
  }
  if (action === "approve-req") { await updateRequestStatus(id, "approved"); await loadAdminData(); adminToast("تم قبول الطلب ✅", "success"); return; }
  if (action === "reject-req") { await updateRequestStatus(id, "rejected"); await loadAdminData(); adminToast("تم رفض الطلب", "error"); return; }
  if (action === "delete-req") {
    showConfirm("حذف الطلب", `هل تريد حذف طلب ${req.playerName}؟`, async () => {
      await deleteItem("registrationRequests", id);
      await loadAdminData();
      adminToast("تم حذف الطلب", "success");
    });
    return;
  }
  if (action === "convert-req") {
    showConfirm("تحويل إلى لاعب مسجل", `سيتم إنشاء بطاقة لاعب جديدة لـ ${req.playerName} ضمن قائمة اللاعبين، واعتماد الطلب. متابعة؟`, async () => {
      try {
        const { player } = await convertRequestToPlayer(id);
        await loadAdminData();
        adminToast(`🏃 تم تسجيل ${player.name} كلاعب جديد!`, "success");
      } catch (err) { adminToast("خطأ: " + err.message, "error"); }
    });
  }
}

// ============================================================
// PLAYERS CRUD (with image upload)
// ============================================================
function renderPlayersTable(players) {
  const tbody = document.getElementById("table-players-body");
  if (!tbody) return;
  if (!players.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:25px;color:var(--text-muted);">لا يوجد لاعبون. أضف لاعباً جديداً.</td></tr>';
    return;
  }
  tbody.innerHTML = players.map(p => {
    const statusBadge = p.registrationStatus === "pending" ? '<span class="badge-status pending">قيد التسجيل</span>' : '<span class="badge-status approved">مسجل</span>';
    return `
      <tr>
        <td><div class="table-user-cell"><img src="${p.photo || './images/logo.jpg'}" alt="" class="table-avatar" onerror="this.src='./images/logo.jpg'"><strong>${escapeHtml(p.name)}</strong></div></td>
        <td>${p.age || 12} سنة</td>
        <td>${escapeHtml(p.category || '')}</td>
        <td><span class="badge-status neutral">${escapeHtml(p.position || '')}</span></td>
        <td>#${p.number || ''}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-action-icon edit" title="تعديل" data-action="edit-player" data-id="${p.id}">✏️</button>
          <button class="btn-action-icon delete" title="حذف" data-action="delete-player" data-id="${p.id}">🗑️</button>
        </td>
      </tr>`;
  }).join("");
  wireRowActions(tbody);
}

function setupAddButtons() {
  document.getElementById("btn-add-player")?.addEventListener("click", () => openPlayerModal());
  document.getElementById("btn-add-coach")?.addEventListener("click", () => openCoachModal());
  document.getElementById("btn-add-upcoming")?.addEventListener("click", () => openUpcomingMatchModal());
  document.getElementById("btn-add-result")?.addEventListener("click", () => openResultMatchModal());
  document.getElementById("btn-add-ticker")?.addEventListener("click", () => openTickerModal());
  document.getElementById("btn-add-article")?.addEventListener("click", () => openArticleModal());
  document.getElementById("btn-add-trophy")?.addEventListener("click", () => openTrophyModal());
  document.getElementById("btn-add-schedule")?.addEventListener("click", () => openScheduleModal());
}

function wireRowActions(tbody) {
  tbody.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (action === "edit-player") { const p = (currentData.players || []).find(x => x.id === id); if (p) openPlayerModal(p); }
      else if (action === "delete-player") {
        const p = (currentData.players || []).find(x => x.id === id);
        showConfirm("حذف لاعب", `هل تريد حذف اللاعب ${p?.name || ''}؟`, async () => { await deleteItem("players", id); await loadAdminData(); adminToast("تم حذف اللاعب", "success"); });
      }
      else if (action === "edit-coach") { const c = (currentData.coaches || []).find(x => x.id === id); if (c) openCoachModal(c); }
      else if (action === "delete-coach") {
        const c = (currentData.coaches || []).find(x => x.id === id);
        showConfirm("حذف مدرب", `هل تريد حذف المدرب ${c?.name || ''}؟`, async () => { await deleteItem("coaches", id); await loadAdminData(); adminToast("تم حذف المدرب", "success"); });
      }
      else if (action === "delete-upcoming") { showConfirm("حذف مباراة", "حذف هذه المباراة القادمة؟", async () => { await deleteItem("upcomingMatches", id); await loadAdminData(); adminToast("تم الحذف", "success"); }); }
      else if (action === "delete-result") { showConfirm("حذف نتيجة", "حذف هذه النتيجة؟", async () => { await deleteItem("matchResults", id); await loadAdminData(); adminToast("تم الحذف", "success"); }); }
      else if (action === "edit-article") { const a = (currentData.news || []).find(x => x.id === id); if (a) openArticleModal(a); }
      else if (action === "delete-article") { showConfirm("حذف مقال", "حذف هذا المقال؟", async () => { await deleteItem("news", id); await loadAdminData(); adminToast("تم الحذف", "success"); }); }
      else if (action === "edit-trophy") { const t = (currentData.trophies || []).find(x => x.id === id); if (t) openTrophyModal(t); }
      else if (action === "delete-trophy") { showConfirm("حذف بطولة", "حذف هذه البطولة؟", async () => { await deleteItem("trophies", id); await loadAdminData(); adminToast("تم الحذف", "success"); }); }
      else if (action === "edit-schedule") { const s = (currentData.schedules || []).find(x => x.id === id); if (s) openScheduleModal(s); }
      else if (action === "delete-schedule") { showConfirm("حذف موعد", "حذف هذا الموعد؟", async () => { await deleteItem("schedules", id); await loadAdminData(); adminToast("تم الحذف", "success"); }); }
    });
  });
}

function numberedAlbumImageField(inputId, previewId, currentPhoto) {
  const initial = imageNumberFromPhoto(currentPhoto);
  return `
    <div class="admin-form-group">
      <label class="admin-label" for="${inputId}">رقم الصورة <span class="req">*</span></label>
      <input type="number" min="0" step="1" inputmode="numeric" id="${inputId}" class="admin-input" value="${initial}" placeholder="أدخل رقم الصورة فقط" required>
      <small style="display:block;color:var(--text-muted);margin-top:6px;">اكتب رقم الصورة فقط. يبدأ الألبوم من 0 ويمكن إضافة أرقام جديدة لاحقاً دون حد أقصى.</small>
      <div id="${previewId}" style="display:flex;align-items:center;gap:12px;margin-top:10px;min-height:72px;">
        <img src="./images/players/${initial}.png" alt="معاينة الصورة" style="width:76px;height:90px;object-fit:cover;object-position:top;border-radius:10px;border:2px solid var(--gold-primary);" onerror="this.style.opacity='.25'">
        <span style="color:var(--text-muted);">رقم الصورة: ${initial}</span>
      </div>
    </div>`;
}
function imageNumberFromPhoto(photo) {
  const match = String(photo || "").match(/\/players\/(\d+)\.png(?:$|\?)/);
  return match ? Number(match[1]) : 0;
}
function bindNumberedAlbumPreview(inputId, previewId) {
  const input = document.getElementById(inputId), preview = document.getElementById(previewId);
  if (!input || !preview || input.dataset.bound === "true") return;
  input.addEventListener("input", () => {
    const raw = input.value.trim(), n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < 0) {
      preview.innerHTML = '<span style="color:var(--text-muted);">أدخل رقماً صحيحاً يبدأ من 0</span>';
      return;
    }
    preview.innerHTML = `<img src="./images/players/${n}.png" alt="معاينة الصورة ${n}" style="width:76px;height:90px;object-fit:cover;object-position:top;border-radius:10px;border:2px solid var(--gold-primary);" onerror="this.style.opacity='.25'"><span style="color:var(--text-muted);">رقم الصورة: ${n}</span>`;
  });
  input.dataset.bound = "true";
}

// --- Player modal ---
function openPlayerModal(player = null) {
  const isEdit = !!player;
  pendingImage = null;
  const body = `
    <form id="form-player-crud">
      ${numberedAlbumImageField("m-p-photo-number", "player-photo-preview", player?.photo)}
      <div class="admin-form-group">
        <label class="admin-label">اسم اللاعب الرباعي <span class="req">*</span></label>
        <input type="text" id="m-p-name" class="admin-input" value="${isEdit ? escapeHtml(player.name) : ''}" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">تاريخ الميلاد <span class="req">*</span></label><input type="date" id="m-p-birth" class="admin-input" value="${isEdit ? (player.birthDate || '') : ''}" required></div>
        <div class="admin-form-group"><label class="admin-label">رقم القميص</label><input type="number" id="m-p-num" class="admin-input" value="${isEdit ? (player.number || '') : 10}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">المركز <span class="req">*</span></label><input type="text" id="m-p-pos" class="admin-input" value="${isEdit ? escapeHtml(player.position) : 'مهاجم صريح'}" required></div>
        <div class="admin-form-group"><label class="admin-label">الفئة السنية</label><select id="m-p-cat" class="admin-select">${categoryOptions(isEdit ? player.category : '')}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">القدم المفضلة</label><select id="m-p-foot" class="admin-select">${footOptions(isEdit ? player.foot : '')}</select></div>
        <div class="admin-form-group"><label class="admin-label">الأهداف</label><input type="number" id="m-p-goals" class="admin-input" value="${isEdit ? (player.goals || 0) : 0}"></div>
        <div class="admin-form-group"><label class="admin-label">التمريرات</label><input type="number" id="m-p-assists" class="admin-input" value="${isEdit ? (player.assists || 0) : 0}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">المباريات</label><input type="number" id="m-p-matches" class="admin-input" value="${isEdit ? (player.matches || 0) : 0}"></div>
        <div class="admin-form-group"><label class="admin-label">شباك نظيفة</label><input type="number" id="m-p-cs" class="admin-input" value="${isEdit ? (player.cleanSheets || 0) : 0}"></div>
      </div>
      <div class="admin-form-group"><label class="admin-label">حالة التسجيل</label><select id="m-p-status" class="admin-select">${statusOptions(isEdit ? player.registrationStatus : 'active')}</select></div>
      <div class="admin-form-group"><label class="admin-label">الإنجازات (افصل بين كل إنجاز بسطر جديد)</label><textarea id="m-p-achievements" class="admin-textarea" rows="3" placeholder="هداف بطولة المنطقة 2026&#10;أفضل لاعب صاعد">${isEdit ? escapeHtml((player.achievements || []).join('\n')) : ''}</textarea></div>
      <div class="admin-form-group"><label class="admin-label">الأداء والملاحظات</label><textarea id="m-p-perf" class="admin-textarea" rows="2">${isEdit ? escapeHtml(player.performance || '') : ''}</textarea></div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;margin-top:8px;">${isEdit ? '💾 حفظ التعديلات' : '➕ إضافة اللاعب'}</button>
    </form>`;
  showAdminModal(isEdit ? "تعديل بيانات اللاعب" : "إضافة لاعب جديد", body);
  bindNumberedAlbumPreview("m-p-photo-number", "player-photo-preview");

  document.getElementById("form-player-crud").onsubmit = async (e) => {
    e.preventDefault();
    const achievementsText = document.getElementById("m-p-achievements").value.trim();
    const item = {
      id: isEdit ? player.id : `player-${Date.now()}`,
      name: document.getElementById("m-p-name").value.trim(),
      birthDate: document.getElementById("m-p-birth").value,
      birthYear: document.getElementById("m-p-birth").value ? new Date(document.getElementById("m-p-birth").value).getFullYear() : undefined,
      age: calcAge(document.getElementById("m-p-birth").value),
      number: parseInt(document.getElementById("m-p-num").value) || 10,
      position: document.getElementById("m-p-pos").value.trim(),
      category: document.getElementById("m-p-cat").value,
      foot: document.getElementById("m-p-foot").value,
      goals: parseInt(document.getElementById("m-p-goals").value) || 0,
      assists: parseInt(document.getElementById("m-p-assists").value) || 0,
      matches: parseInt(document.getElementById("m-p-matches").value) || 0,
      cleanSheets: parseInt(document.getElementById("m-p-cs").value) || 0,
      registrationStatus: document.getElementById("m-p-status").value,
      achievements: achievementsText ? achievementsText.split('\n').map(s => s.trim()).filter(Boolean) : [],
      performance: document.getElementById("m-p-perf").value.trim(),
      photo: `./images/players/${Math.max(0, Math.floor(Number(document.getElementById("m-p-photo-number").value) || 0))}.png`
    };
    await saveItem("players", item);
    closeAdminModal();
    await loadAdminData();
    adminToast(isEdit ? "تم حفظ التعديلات" : "تمت إضافة اللاعب", "success");
  };
}

// ============================================================
// COACHES CRUD
// ============================================================
function openCoachModal(coach = null) {
  const isEdit = !!coach;
  pendingImage = null;
  const body = `
    <form id="form-coach-crud">
      ${numberedAlbumImageField("m-c-photo-number", "coach-photo-preview", coach?.photo)}
      <div class="admin-form-group"><label class="admin-label">اسم المدرب <span class="req">*</span></label><input type="text" id="m-c-name" class="admin-input" value="${isEdit ? escapeHtml(coach.name) : ''}" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">السن <span class="req">*</span></label><input type="number" id="m-c-age" class="admin-input" value="${isEdit ? coach.age : 35}" required></div>
        <div class="admin-form-group"><label class="admin-label">المسمى التدريبي <span class="req">*</span></label><input type="text" id="m-c-role" class="admin-input" value="${isEdit ? escapeHtml(coach.role) : 'مدرب الفئات السنية'}" required></div>
      </div>
      <div class="admin-form-group"><label class="admin-label">الرخصة والشهادات <span class="req">*</span></label><input type="text" id="m-c-license" class="admin-input" value="${isEdit ? escapeHtml(coach.license) : 'رخصة الاتحاد الأفريقي (CAF)'}" required></div>
      <div class="admin-form-group"><label class="admin-label">سنوات الخبرة</label><input type="text" id="m-c-exp" class="admin-input" value="${isEdit ? escapeHtml(coach.experience || '') : '10 سنوات في قطاع الناشئين'}"></div>
      <div class="admin-form-group"><label class="admin-label">السيرة الذاتية (افصل بين كل نقطة بسطر جديد)</label><textarea id="m-c-bio" class="admin-textarea" rows="4" placeholder="- لاعب نادي الجمارك&#10;- لاعب نادي المريخ">${isEdit ? escapeHtml(coach.bio || '') : ''}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">هاتف (اختياري للنشر)</label><input type="tel" id="m-c-phone" class="admin-input" dir="ltr" value="${isEdit ? escapeHtml(coach.phone || '') : ''}"></div>
        <div class="admin-form-group"><label class="admin-label">بريد إلكتروني (اختياري)</label><input type="email" id="m-c-email" class="admin-input" dir="ltr" value="${isEdit ? escapeHtml(coach.email || '') : ''}"></div>
      </div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;margin-top:8px;">${isEdit ? '💾 حفظ التعديلات' : '➕ إضافة المدرب'}</button>
    </form>`;
  showAdminModal(isEdit ? "تعديل بيانات المدرب" : "إضافة مدرب جديد", body);
  bindNumberedAlbumPreview("m-c-photo-number", "coach-photo-preview");
  document.getElementById("form-coach-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: isEdit ? coach.id : `coach-${Date.now()}`,
      name: document.getElementById("m-c-name").value.trim(),
      age: parseInt(document.getElementById("m-c-age").value) || 35,
      role: document.getElementById("m-c-role").value.trim(),
      license: document.getElementById("m-c-license").value.trim(),
      experience: document.getElementById("m-c-exp").value.trim(),
      bio: document.getElementById("m-c-bio").value.trim(),
      phone: document.getElementById("m-c-phone").value.trim(),
      email: document.getElementById("m-c-email").value.trim(),
      photo: `./images/players/${Math.max(0, Math.floor(Number(document.getElementById("m-c-photo-number").value) || 0))}.png`
    };
    await saveItem("coaches", item);
    closeAdminModal();
    await loadAdminData();
    adminToast(isEdit ? "تم حفظ التعديلات" : "تمت إضافة المدرب", "success");
  };
}

// ============================================================
// MATCHES CRUD
// ============================================================
function openUpcomingMatchModal() {
  const body = `
    <form id="form-upmatch-crud">
      <div class="admin-form-group"><label class="admin-label">الفريق المنافس <span class="req">*</span></label><input type="text" id="m-up-opp" class="admin-input" placeholder="مثال: أكاديمية النجوم" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">الفئة العمرية <span class="req">*</span></label><input type="text" id="m-up-cat" class="admin-input" placeholder="مواليد 2012" required></div>
        <div class="admin-form-group"><label class="admin-label">اسم البطولة</label><input type="text" id="m-up-tourn" class="admin-input" placeholder="دوري المحافظة"></div>
      </div>
      <div class="admin-form-group"><label class="admin-label">الملعب <span class="req">*</span></label><input type="text" id="m-up-stad" class="admin-input" placeholder="ملعب مركز شباب الأحمدية" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">التاريخ <span class="req">*</span></label><input type="date" id="m-up-date" class="admin-input" required></div>
        <div class="admin-form-group"><label class="admin-label">التوقيت <span class="req">*</span></label><input type="text" id="m-up-time" class="admin-input" placeholder="05:00 م" required></div>
      </div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;">📅 جدولة المباراة</button>
    </form>`;
  showAdminModal("جدولة مباراة قادمة", body);
  document.getElementById("form-upmatch-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: `match-up-${Date.now()}`,
      opponent: document.getElementById("m-up-opp").value.trim(),
      category: document.getElementById("m-up-cat").value.trim(),
      tournament: document.getElementById("m-up-tourn").value.trim(),
      stadium: document.getElementById("m-up-stad").value.trim(),
      date: document.getElementById("m-up-date").value,
      time: document.getElementById("m-up-time").value.trim(),
      status: "قادمة"
    };
    await saveItem("upcomingMatches", item);
    closeAdminModal();
    await loadAdminData();
    adminToast("تمت جدولة المباراة", "success");
  };
}

function openResultMatchModal() {
  const body = `
    <form id="form-resmatch-crud">
      <div class="admin-form-group"><label class="admin-label">الفريق المنافس <span class="req">*</span></label><input type="text" id="m-res-opp" class="admin-input" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">أهداف الأحمدية <span class="req">*</span></label><input type="number" id="m-res-our" class="admin-input" value="3" required></div>
        <div class="admin-form-group"><label class="admin-label">أهداف المنافس <span class="req">*</span></label><input type="number" id="m-res-opp-score" class="admin-input" value="1" required></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">الفئة السنية</label><input type="text" id="m-res-cat" class="admin-input" value="مواليد 2012"></div>
        <div class="admin-form-group"><label class="admin-label">البطولة</label><input type="text" id="m-res-tourn" class="admin-input" placeholder="دوري المحافظة"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">التاريخ <span class="req">*</span></label><input type="date" id="m-res-date" class="admin-input" required></div>
        <div class="admin-form-group"><label class="admin-label">الملعب</label><input type="text" id="m-res-stad" class="admin-input" value="ملعب مركز شباب الأحمدية"></div>
      </div>
      <div class="admin-form-group"><label class="admin-label">مسجلو الأهداف</label><input type="text" id="m-res-scorers" class="admin-input" placeholder="مثال: ياسين أحمد (هدفين)، عمر خالد (هدف)"></div>
      <div class="admin-form-group"><label class="admin-label">تقرير المباراة</label><textarea id="m-res-report" class="admin-textarea" rows="3" placeholder="ملخص أداء الفريق وأبرز نقاط المباراة..."></textarea></div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;">⚽ تسجيل النتيجة</button>
    </form>`;
  showAdminModal("تسجيل نتيجة مباراة", body);
  document.getElementById("form-resmatch-crud").onsubmit = async (e) => {
    e.preventDefault();
    const scoreOur = parseInt(document.getElementById("m-res-our").value) || 0;
    const scoreOpp = parseInt(document.getElementById("m-res-opp-score").value) || 0;
    const result = scoreOur > scoreOpp ? "win" : (scoreOur === scoreOpp ? "draw" : "loss");
    const item = {
      id: `match-res-${Date.now()}`,
      opponent: document.getElementById("m-res-opp").value.trim(),
      scoreOur, scoreOpponent: scoreOpp, result,
      category: document.getElementById("m-res-cat").value.trim(),
      tournament: document.getElementById("m-res-tourn").value.trim(),
      stadium: document.getElementById("m-res-stad").value.trim(),
      date: document.getElementById("m-res-date").value,
      scorers: document.getElementById("m-res-scorers").value.trim(),
      matchReport: document.getElementById("m-res-report").value.trim()
    };
    await saveItem("matchResults", item);
    closeAdminModal();
    await loadAdminData();
    adminToast("تم تسجيل النتيجة", "success");
  };
}

// ============================================================
// NEWS & TICKER CRUD
// ============================================================
function openArticleModal(article = null) {
  const isEdit = !!article;
  pendingImage = null;
  const body = `
    <form id="form-article-crud">
      <div class="admin-form-group"><label class="admin-label">صورة الخبر</label>${imageUploadField("article-photo-preview", article?.image)}</div>
      <div class="admin-form-group"><label class="admin-label">عنوان الخبر <span class="req">*</span></label><input type="text" id="m-art-title" class="admin-input" value="${isEdit ? escapeHtml(article.title) : ''}" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">القسم</label><input type="text" id="m-art-cat" class="admin-input" value="${isEdit ? escapeHtml(article.category || '') : 'أخبار الأكاديمية'}"></div>
        <div class="admin-form-group"><label class="admin-label">التاريخ <span class="req">*</span></label><input type="date" id="m-art-date" class="admin-input" value="${isEdit ? (article.date || '') : new Date().toISOString().slice(0,10)}" required></div>
      </div>
      <div class="admin-form-group"><label class="admin-label">نبذة ملخصة <span class="req">*</span></label><input type="text" id="m-art-sum" class="admin-input" value="${isEdit ? escapeHtml(article.summary || '') : ''}" required></div>
      <div class="admin-form-group"><label class="admin-label">نص المقال كاملاً <span class="req">*</span></label><textarea id="m-art-content" class="admin-textarea" rows="5" placeholder="افصل بين الفقرات بسطر جديد">${isEdit ? escapeHtml(article.content || '') : ''}</textarea></div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;">📰 ${isEdit ? 'حفظ التعديلات' : 'نشر المقال'}</button>
    </form>`;
  showAdminModal(isEdit ? "تعديل مقال إخباري" : "كتابة مقال إخباري جديد", body);
  wireImageUpload("article-photo-preview");
  document.getElementById("form-article-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: isEdit ? article.id : `news-${Date.now()}`,
      title: document.getElementById("m-art-title").value.trim(),
      category: document.getElementById("m-art-cat").value.trim(),
      date: document.getElementById("m-art-date").value,
      summary: document.getElementById("m-art-sum").value.trim(),
      content: document.getElementById("m-art-content").value.trim(),
      image: pendingImage || (isEdit ? article.image : './images/logo.jpg')
    };
    await saveItem("news", item);
    closeAdminModal();
    await loadAdminData();
    adminToast(isEdit ? "تم حفظ التعديلات" : "تم نشر المقال", "success");
  };
}

function openTickerModal() {
  const body = `
    <form id="form-ticker-add">
      <div class="admin-form-group"><label class="admin-label">نص الخبر العاجل <span class="req">*</span></label><textarea id="m-ticker-text" class="admin-textarea" rows="2" required></textarea></div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;">⚡ إضافة للشريط</button>
    </form>`;
  showAdminModal("إضافة خبر للشريط المتحرك", body);
  document.getElementById("form-ticker-add").onsubmit = async (e) => {
    e.preventDefault();
    const text = document.getElementById("m-ticker-text").value.trim();
    if (!text) return;
    const ticker = currentData.tickerNews || [];
    ticker.unshift(text);
    await saveTickerNews(ticker);
    closeAdminModal();
    await loadAdminData();
    adminToast("تمت الإضافة للشريط", "success");
  };
}

// ============================================================
// TROPHIES CRUD
// ============================================================
function openTrophyModal(trophy = null) {
  const isEdit = !!trophy;
  pendingImage = null;
  const body = `
    <form id="form-trophy-crud">
      <div class="admin-form-group"><label class="admin-label">صورة الكأس (اختياري)</label>${imageUploadField("trophy-photo-preview", trophy?.image)}</div>
      <div class="admin-form-group"><label class="admin-label">اسم البطولة <span class="req">*</span></label><input type="text" id="m-tr-title" class="admin-input" value="${isEdit ? escapeHtml(trophy.title) : ''}" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">سنة التتويج <span class="req">*</span></label><input type="text" id="m-tr-year" class="admin-input" value="${isEdit ? escapeHtml(trophy.year) : '2026'}" required></div>
        <div class="admin-form-group"><label class="admin-label">الفئة السنية</label><input type="text" id="m-tr-cat" class="admin-input" value="${isEdit ? escapeHtml(trophy.category || '') : 'مواليد 2012'}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="admin-form-group"><label class="admin-label">شارة التتويج</label><input type="text" id="m-tr-badge" class="admin-input" value="${isEdit ? escapeHtml(trophy.badge || '') : 'المركز الأول 🥇'}"></div>
        <div class="admin-form-group"><label class="admin-label">الأيقونة (إيموجي)</label><input type="text" id="m-tr-icon" class="admin-input" value="${isEdit ? escapeHtml(trophy.icon || '') : '🏆'}"></div>
      </div>
      <div class="admin-form-group"><label class="admin-label">تفاصيل الإنجاز <span class="req">*</span></label><textarea id="m-tr-desc" class="admin-textarea" rows="2" required>${isEdit ? escapeHtml(trophy.description || '') : ''}</textarea></div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;">🏆 ${isEdit ? 'حفظ التعديلات' : 'إضافة البطولة'}</button>
    </form>`;
  showAdminModal(isEdit ? "تعديل بطولة" : "إضافة كأس أو بطولة", body);
  wireImageUpload("trophy-photo-preview");
  document.getElementById("form-trophy-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: isEdit ? trophy.id : `trophy-${Date.now()}`,
      title: document.getElementById("m-tr-title").value.trim(),
      year: document.getElementById("m-tr-year").value.trim(),
      category: document.getElementById("m-tr-cat").value.trim(),
      badge: document.getElementById("m-tr-badge").value.trim(),
      icon: document.getElementById("m-tr-icon").value.trim() || "🏆",
      description: document.getElementById("m-tr-desc").value.trim(),
      image: pendingImage || (isEdit ? (trophy.image || '') : '')
    };
    await saveItem("trophies", item);
    closeAdminModal();
    await loadAdminData();
    adminToast(isEdit ? "تم حفظ التعديلات" : "تمت إضافة البطولة", "success");
  };
}

// ============================================================
// SCHEDULES CRUD
// ============================================================
function openScheduleModal(sch = null) {
  const isEdit = !!sch;
  const body = `
    <form id="form-sch-crud">
      <div class="admin-form-group"><label class="admin-label">الفئة العمرية <span class="req">*</span></label><input type="text" id="m-s-cat" class="admin-input" value="${isEdit ? escapeHtml(sch.category) : ''}" placeholder="مواليد 2012 - 2014" required></div>
      <div class="admin-form-group"><label class="admin-label">أيام التدريب <span class="req">*</span></label><input type="text" id="m-s-days" class="admin-input" value="${isEdit ? escapeHtml(sch.days) : ''}" placeholder="السبت - الإثنين - الأربعاء" required></div>
      <div class="admin-form-group"><label class="admin-label">التوقيت <span class="req">*</span></label><input type="text" id="m-s-time" class="admin-input" value="${isEdit ? escapeHtml(sch.time) : ''}" placeholder="05:00 م - 06:30 م" required></div>
      <div class="admin-form-group"><label class="admin-label">الملعب <span class="req">*</span></label><input type="text" id="m-s-field" class="admin-input" value="${isEdit ? escapeHtml(sch.field) : 'الملعب الرئيسي لمركز شباب الأحمدية'}" required></div>
      <div class="admin-form-group"><label class="admin-label">المدرب المسؤول</label><input type="text" id="m-s-coach" class="admin-input" value="${isEdit ? escapeHtml(sch.coach || '') : ''}" placeholder="كابتن أحمد مصطفى"></div>
      <button type="submit" class="btn-admin-action" style="width:100%;background:var(--gold-gradient);color:#07110f;font-weight:800;padding:12px;border:none;">🕒 ${isEdit ? 'حفظ التعديلات' : 'إضافة الموعد'}</button>
    </form>`;
  showAdminModal(isEdit ? "تعديل موعد تدريب" : "إضافة موعد تدريب جديد", body);
  document.getElementById("form-sch-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: isEdit ? sch.id : `sch-${Date.now()}`,
      category: document.getElementById("m-s-cat").value.trim(),
      days: document.getElementById("m-s-days").value.trim(),
      time: document.getElementById("m-s-time").value.trim(),
      field: document.getElementById("m-s-field").value.trim(),
      coach: document.getElementById("m-s-coach").value.trim()
    };
    await saveItem("schedules", item);
    closeAdminModal();
    await loadAdminData();
    adminToast(isEdit ? "تم حفظ التعديلات" : "تمت إضافة الموعد", "success");
  };
}

// ============================================================
// SETTINGS + PASSWORD
// ============================================================
function loadSettingsForm(s) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set("set-academy-name", s.academyName);
  set("set-short-name", s.shortName);
  set("set-tagline", s.tagline);
  set("set-description", s.description);
  set("set-announcement", s.announcement);
  set("set-phone", s.phone);
  set("set-whatsapp", s.whatsapp);
  set("set-email", s.email);
  set("set-founded", s.foundedYear);
  set("set-address", s.address);
  set("set-facebook", s.facebook);
  set("set-instagram", s.instagram);
  set("set-youtube", s.youtube);
  set("set-developer-name", s.developerName);
  set("set-developer-facebook", s.developerFacebook);
  set("set-developer-whatsapp", s.developerWhatsapp);
  const logoPrev = document.getElementById("settings-logo-preview");
  if (logoPrev && s.logo) logoPrev.src = s.logo;
}

function setupSettingsForm() {
  const form = document.getElementById("form-settings");
  if (!form) return;
  // Logo upload
  const logoFile = document.getElementById("settings-logo-file");
  const logoPrev = document.getElementById("settings-logo-preview");
  let logoDataUri = null;
  if (logoFile) {
    logoFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        logoDataUri = await processImageUpload(file, { maxSize: 400, quality: 0.85 });
        if (logoPrev) logoPrev.src = logoDataUri;
        adminToast("تم تحميل الشعار", "success");
      } catch (err) { adminToast(err.message, "error"); }
    });
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const settings = {
      academyName: val("set-academy-name"),
      shortName: val("set-short-name"),
      tagline: val("set-tagline"),
      description: val("set-description"),
      announcement: val("set-announcement"),
      phone: val("set-phone"),
      whatsapp: val("set-whatsapp"),
      email: val("set-email"),
      foundedYear: val("set-founded"),
      address: val("set-address"),
      facebook: val("set-facebook"),
      instagram: val("set-instagram"),
      youtube: val("set-youtube"),
      developerName: val("set-developer-name"),
      developerFacebook: val("set-developer-facebook"),
      developerWhatsapp: val("set-developer-whatsapp")
    };
    if (logoDataUri) settings.logo = logoDataUri;
    await saveSettings(settings);
    await loadAdminData();
    adminToast("تم حفظ الإعدادات العامة بنجاح ✅", "success");
  });
}

function setupChangePasswordForm() {
  const form = document.getElementById("form-change-password");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const np = document.getElementById("new-admin-password").value;
    const confirm = document.getElementById("confirm-admin-password").value;
    if (np !== confirm) {
      adminToast("رمزا المرور غير متطابقين", "error");
      return;
    }
    try {
      await changeAdminPassword(np);
      form.reset();
      adminToast("تم تحديث رمز المرور بنجاح 🔑", "success");
    } catch (err) { adminToast(err.message, "error"); }
  });
}

// ============================================================
// BACKUP / RESTORE / RESET
// ============================================================
function setupBackupHandlers() {
  document.getElementById("btn-export-backup")?.addEventListener("click", () => exportData());
  const importInput = document.getElementById("input-import-backup");
  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (importData(ev.target.result)) { await loadAdminData(); adminToast("تم استيراد البيانات بنجاح ✅", "success"); }
        else adminToast("الملف غير صالح", "error");
      };
      reader.readAsText(file);
    });
  }
  document.getElementById("btn-reset-defaults")?.addEventListener("click", () => {
    showConfirm("استعادة البيانات الافتراضية", "سيتم استبدال كل البيانات الحالية بالبيانات النموذجية. متابعة؟", async () => {
      resetDataToDefaults(); await loadAdminData(); adminToast("تمت استعادة الافتراضي", "success");
    });
  });
  document.getElementById("btn-clear-all-mock")?.addEventListener("click", () => {
    showConfirm("مسح كل البيانات", "سيتم تفريغ كل اللاعبين والمدربين والأخبار والبطولات (تبقى الإعدادات). متابعة؟", async () => {
      clearAllMockData(); await loadAdminData(); adminToast("تم مسح البيانات", "success");
    });
  });
}

function setupQuickActions() {
  // wired in setupNavigation via .quick-action selector
}

// ============================================================
// RENDER HELPERS for tables (coaches/matches/news/trophies/schedules)
// ============================================================
function renderCoachesTable(coaches) {
  const tbody = document.getElementById("table-coaches-body");
  if (!tbody) return;
  if (!coaches.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:25px;color:var(--text-muted);">لا يوجد مدربون.</td></tr>';
    return;
  }
  tbody.innerHTML = coaches.map(c => `
    <tr>
      <td><div class="table-user-cell"><img src="${c.photo || './images/logo.jpg'}" alt="" class="table-avatar" onerror="this.src='./images/logo.jpg'"><strong>${escapeHtml(c.name)}</strong></div></td>
      <td>${c.age || 35} سنة</td>
      <td>${escapeHtml(c.role || '')}</td>
      <td>${escapeHtml(c.license || '')}</td>
      <td>${escapeHtml(c.experience || '')}</td>
      <td><button class="btn-action-icon edit" data-action="edit-coach" data-id="${c.id}">✏️</button><button class="btn-action-icon delete" data-action="delete-coach" data-id="${c.id}">🗑️</button></td>
    </tr>`).join("");
  wireRowActions(tbody);
}

function renderMatchesTables(upcoming, results) {
  const up = document.getElementById("table-upcoming-matches-body");
  const res = document.getElementById("table-results-matches-body");
  if (up) {
    if (!upcoming.length) up.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد مباريات قادمة.</td></tr>';
    else up.innerHTML = upcoming.map(m => `<tr><td><strong>${escapeHtml(m.opponent)}</strong></td><td>${escapeHtml(m.category)}</td><td>${escapeHtml(m.tournament || 'ودية')}</td><td>${escapeHtml(m.stadium || '')}</td><td>${m.date} (${escapeHtml(m.time || '')})</td><td><button class="btn-action-icon delete" data-action="delete-upcoming" data-id="${m.id}">🗑️</button></td></tr>`).join("");
    wireRowActions(up);
  }
  if (res) {
    if (!results.length) res.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">لم تسجل نتائج.</td></tr>';
    else res.innerHTML = results.map(r => `<tr><td><strong>${escapeHtml(r.opponent)}</strong></td><td>${escapeHtml(r.category)}</td><td><strong style="color:var(--gold-light);">${r.scoreOur} - ${r.scoreOpponent}</strong></td><td>${escapeHtml(r.scorers || '')}</td><td>${r.date}</td><td><button class="btn-action-icon delete" data-action="delete-result" data-id="${r.id}">🗑️</button></td></tr>`).join("");
    wireRowActions(res);
  }
}

function renderNewsAndTicker(tickerList, articles) {
  const tc = document.getElementById("ticker-items-list");
  if (tc) {
    if (!tickerList.length) tc.innerHTML = '<li style="color:var(--text-muted);padding:12px;">لا توجد أخبار في الشريط.</li>';
    else tc.innerHTML = tickerList.map((item, i) => `<li style="background:rgba(0,0,0,0.3);border:1px solid var(--admin-border);padding:10px 14px;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;"><span style="flex:1;">⚡ ${escapeHtml(item)}</span><button class="btn-action-icon delete" data-action="delete-ticker" data-index="${i}">🗑️</button></li>`).join("");
    tc.querySelectorAll("[data-action=delete-ticker]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.getAttribute("data-index"));
        const t = currentData.tickerNews || [];
        t.splice(idx, 1);
        await saveTickerNews(t);
        await loadAdminData();
        adminToast("تم حذف الخبر من الشريط", "success");
      });
    });
  }
  const at = document.getElementById("table-news-articles-body");
  if (at) {
    if (!articles.length) at.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد مقالات.</td></tr>';
    else at.innerHTML = articles.map(a => `<tr><td><strong>${escapeHtml(a.title)}</strong></td><td>${escapeHtml(a.category || '')}</td><td>${a.date}</td><td><button class="btn-action-icon edit" data-action="edit-article" data-id="${a.id}">✏️</button><button class="btn-action-icon delete" data-action="delete-article" data-id="${a.id}">🗑️</button></td></tr>`).join("");
    wireRowActions(at);
  }
}

function renderTrophiesTable(trophies) {
  const tbody = document.getElementById("table-trophies-body");
  if (!tbody) return;
  if (!trophies.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">دولاب البطولات فارغ.</td></tr>';
    return;
  }
  tbody.innerHTML = trophies.map(t => `
    <tr>
      <td><strong>${t.icon || '🏆'} ${escapeHtml(t.title)}</strong></td>
      <td>${escapeHtml(t.year)}</td>
      <td>${escapeHtml(t.category || '')}</td>
      <td><span class="badge-status approved">${escapeHtml(t.badge || '')}</span></td>
      <td style="max-width:260px;">${escapeHtml(t.description)}</td>
      <td><button class="btn-action-icon edit" data-action="edit-trophy" data-id="${t.id}">✏️</button><button class="btn-action-icon delete" data-action="delete-trophy" data-id="${t.id}">🗑️</button></td>
    </tr>`).join("");
  wireRowActions(tbody);
}

function renderSchedulesTable(schedules) {
  const tbody = document.getElementById("table-schedules-body");
  if (!tbody) return;
  if (!schedules.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد مواعيد.</td></tr>';
    return;
  }
  tbody.innerHTML = schedules.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.category)}</strong></td>
      <td>${escapeHtml(s.days)}</td>
      <td><span style="color:var(--gold-light);">${escapeHtml(s.time)}</span></td>
      <td>${escapeHtml(s.field)}</td>
      <td>${escapeHtml(s.coach || '')}</td>
      <td><button class="btn-action-icon edit" data-action="edit-schedule" data-id="${s.id}">✏️</button><button class="btn-action-icon delete" data-action="delete-schedule" data-id="${s.id}">🗑️</button></td>
    </tr>`).join("");
  wireRowActions(tbody);
}

// ============================================================
// IMAGE UPLOAD HELPER (modal-level)
// ============================================================
function imageUploadField(previewId, currentPhoto) {
  const src = currentPhoto || "./images/logo.jpg";
  return `
    <div class="image-upload-field">
      <img id="${previewId}" class="image-upload-preview" src="${escapeHtml(src)}" alt="معاينة" onerror="this.src='./images/logo.jpg'">
      <label class="image-upload-btn">📷 رفع صورة<input type="file" accept="image/*" data-preview="${previewId}"></label>
      <span class="upload-hint">JPG/PNG حتى 6 ميجا (يُضغط تلقائياً)</span>
    </div>`;
}

function wireImageUpload(previewId) {
  const input = document.querySelector(`input[data-preview="${previewId}"]`);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUri = await processImageUpload(file);
      pendingImage = dataUri;
      preview.src = dataUri;
      adminToast("تم تحميل الصورة", "success");
    } catch (err) { adminToast(err.message, "error"); }
  });
}

// ============================================================
// MODAL + CONFIRM + TOAST
// ============================================================
function showAdminModal(title, html) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = html;
  document.getElementById("general-modal").classList.add("open");
}

function closeAdminModal() {
  document.getElementById("general-modal").classList.remove("open");
  pendingImage = null;
}

function setupModalClose() {
  document.getElementById("btn-close-modal")?.addEventListener("click", closeAdminModal);
  const modal = document.getElementById("general-modal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeAdminModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAdminModal(); });
}

function showConfirm(title, message, onConfirm) {
  const html = `
    <div class="confirm-dialog">
      <div class="confirm-icon">⚠️</div>
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button class="btn-admin-action" id="confirm-cancel">إلغاء</button>
        <button class="btn-admin-action" id="confirm-yes" style="background:var(--danger);color:#fff;border-color:var(--danger);">تأكيد</button>
      </div>
    </div>`;
  showAdminModal(title, html);
  document.getElementById("confirm-cancel").addEventListener("click", closeAdminModal);
  document.getElementById("confirm-yes").addEventListener("click", async () => {
    closeAdminModal();
    try { await onConfirm(); } catch (e) { adminToast("خطأ: " + e.message, "error"); }
  });
}

function adminToast(message, type = "") {
  const t = document.getElementById("admin-toast");
  if (!t) { alert(message); return; }
  t.className = "admin-toast show" + (type ? " " + type : "");
  t.innerHTML = `<span>${type === "success" ? "✅" : type === "error" ? "❌" : "🔔"}</span> <span>${escapeHtml(message)}</span>`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

// ============================================================
// UTILITIES
// ============================================================
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

function calcAge(birthDateStr) {
  if (!birthDateStr) return 12;
  const b = new Date(birthDateStr);
  const diff = Date.now() - b.getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970) || 12;
}

function categoryOptions(selected) {
  const cats = [["2014-2016", "2014 - 2016 (براعم)"], ["2012-2014", "2012 - 2014 (أشبال)"], ["2010-2012", "2010 - 2012 (ناشئين)"], ["2008-2010", "2008 - 2010 (شباب)"]];
  return cats.map(([v, l]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${l}</option>`).join("");
}
function footOptions(selected) {
  const f = [["اليمنى", "اليمنى"], ["اليسرى", "اليسرى"], ["يجيد اللعب بالقدمين", "بالقدمين"]];
  return f.map(([v, l]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${l}</option>`).join("");
}
function statusOptions(selected) {
  const s = [["active", "مسجل (نشط)"], ["pending", "قيد التسجيل"], ["inactive", "غير نشط"]];
  return s.map(([v, l]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${l}</option>`).join("");
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Wire the add buttons after DOM ready (called once at init)
// These are attached here to ensure they exist after initial render
setTimeout(() => { setupAddButtons(); }, 0);
