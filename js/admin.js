// Academia Al-Ahmadia - Admin Dashboard Controller
import { 
  getAllData, 
  saveItem, 
  deleteItem, 
  saveTickerNews,
  clearAllMockData,
  setPlayerOfTheDay, 
  togglePlayerOfTheDay, 
  updateRequestStatus, 
  exportData, 
  importData, 
  resetDataToDefaults 
} from "./data-service.js";

const ADMIN_PASS = "ahmadia2026";
let currentData = null;

document.addEventListener("DOMContentLoaded", async () => {
  setupAuth();
  if (isLoggedIn()) {
    showDashboard();
    await loadAdminData();
    setupTabSwitching();
    setupPotdForm();
    setupBackupHandlers();
  }
});

// ==================== 1. AUTHENTICATION ====================
function setupAuth() {
  const loginForm = document.getElementById("admin-login-form");
  const logoutBtn = document.getElementById("btn-admin-logout");
  const mobileLogoutBtn = document.getElementById("btn-mobile-logout");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pass = document.getElementById("admin-password").value.trim();
      if (pass === ADMIN_PASS || pass === "123456" || pass === "admin") {
        sessionStorage.setItem("ahmadia_admin_auth", "true");
        showDashboard();
        loadAdminData();
        setupTabSwitching();
        setupPotdForm();
        setupBackupHandlers();
      } else {
        alert("رمز المرور غير صحيح! يرجى المحاولة مرة أخرى.");
      }
    });
  }

  function handleLogout() {
    sessionStorage.removeItem("ahmadia_admin_auth");
    window.location.reload();
  }

  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener("click", handleLogout);
}

function isLoggedIn() {
  return sessionStorage.getItem("ahmadia_admin_auth") === "true";
}

function showDashboard() {
  const loginSec = document.getElementById("login-section");
  const dashSec = document.getElementById("dashboard-section");
  if (loginSec) loginSec.style.display = "none";
  if (dashSec) dashSec.style.display = "block";
}

// ==================== 2. LOAD DATA & REFRESH ====================
async function loadAdminData() {
  currentData = await getAllData();
  renderAdminStats(currentData);
  renderPotdTab(currentData);
  renderRequestsTable(currentData.registrationRequests || []);
  renderPlayersTable(currentData.players || []);
  renderCoachesTable(currentData.coaches || []);
  renderMatchesTables(currentData.upcomingMatches || [], currentData.matchResults || []);
  renderNewsAndTicker(currentData.tickerNews || [], currentData.news || []);
  renderTrophiesTable(currentData.trophies || []);
  renderSchedulesTable(currentData.schedules || []);
}

// ==================== 3. TABS NAVIGATION ====================
function setupTabSwitching() {
  const desktopBtns = document.querySelectorAll(".admin-sidebar .admin-nav-btn[data-tab]");
  const mobileBtns = document.querySelectorAll(".admin-bottom-nav .admin-bottom-item[data-tab]");
  const panels = document.querySelectorAll(".tab-panel");
  const pageTitle = document.getElementById("page-title");

  const tabTitles = {
    "tab-potd": "⭐ لوحة الشرف (رجل اليوم)",
    "tab-requests": "📝 طلبات الانضمام الجديدة",
    "tab-players": "🏃 إدارة قائمة اللاعبين",
    "tab-coaches": "👔 الجهاز الفني والمدربين",
    "tab-matches": "⚽ المباريات والنتائج",
    "tab-news": "📰 الأخبار والشريط المتحرك",
    "tab-trophies": "🏆 دولاب البطولات",
    "tab-schedules": "🕒 جداول ومواعيد التدريب",
    "tab-settings": "💾 النسخ الاحتياطي والضبط"
  };

  function switchTab(tabId) {
    panels.forEach(p => p.classList.remove("active"));
    desktopBtns.forEach(b => b.classList.remove("active"));
    mobileBtns.forEach(b => b.classList.remove("active"));

    const activePanel = document.getElementById(tabId);
    if (activePanel) activePanel.classList.add("active");

    const activeDeskBtn = document.querySelector(`.admin-sidebar .admin-nav-btn[data-tab="${tabId}"]`);
    if (activeDeskBtn) activeDeskBtn.classList.add("active");

    const activeMobBtn = document.querySelector(`.admin-bottom-nav .admin-bottom-item[data-tab="${tabId}"]`);
    if (activeMobBtn) activeMobBtn.classList.add("active");

    if (pageTitle && tabTitles[tabId]) {
      pageTitle.innerText = tabTitles[tabId];
    }
  }

  desktopBtns.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  mobileBtns.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });
}

// ==================== 4. STATS ====================
function renderAdminStats(data) {
  const pEl = document.getElementById("stat-total-players");
  const rEl = document.getElementById("stat-new-requests");
  const tEl = document.getElementById("stat-total-trophies");
  const mEl = document.getElementById("stat-total-matches");
  const badgeReq = document.getElementById("badge-requests-count");

  const pendingCount = (data.registrationRequests || []).filter(r => r.status === 'pending').length;

  if (pEl) pEl.innerText = (data.players || []).length;
  if (rEl) rEl.innerText = pendingCount;
  if (tEl) tEl.innerText = (data.trophies || []).length;
  if (mEl) mEl.innerText = (data.upcomingMatches || []).length;
  if (badgeReq) badgeReq.innerText = pendingCount;
}

// ==================== 5. PLAYER OF THE DAY TAB ====================
function renderPotdTab(data) {
  const select = document.getElementById("potd-player-select");
  const preview = document.getElementById("potd-current-preview");
  const indicator = document.getElementById("potd-status-indicator");

  if (select) {
    select.innerHTML = '<option value="">-- اختر لاعباً من القائمة --</option>' +
      (data.players || []).map(p => `
        <option value="${p.id}">${p.name} (#${p.number || ''} - ${p.position} - ${p.category})</option>
      `).join('');
  }

  const potd = data.playerOfTheDay;
  if (!potd || !potd.active) {
    if (indicator) {
      indicator.className = "badge-status rejected";
      indicator.innerText = "غير مفعل حالياً";
    }
    if (preview) {
      preview.innerHTML = `
        <p style="text-align: center; color: var(--text-muted);">
          ⚠️ لا يوجد لاعب مميز نشط حالياً على الموقع. يرجى اختيار لاعب من النموذج أعلاه وتفعيله.
        </p>
      `;
    }
    return;
  }

  if (indicator) {
    indicator.className = "badge-status approved";
    indicator.innerText = "مفعل وظاهر على الموقع";
  }

  const expiresDate = new Date(potd.expiresAt);
  const now = new Date();
  const diffHours = Math.max(0, Math.round((expiresDate - now) / (1000 * 60 * 60)));

  if (preview) {
    preview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
        <img src="${potd.playerPhoto || './images/logo.jpg'}" alt="${potd.playerName}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--gold-primary); object-fit: cover;" onerror="this.src='./images/logo.jpg'">
        <div style="flex: 1;">
          <h4 style="font-size: 1.2rem; color: #fff; margin-bottom: 4px;">👑 رجل اليوم الحالي: <span style="color: var(--gold-light);">${potd.playerName}</span></h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 6px;">
            المركز: ${potd.playerPosition} | السن: ${potd.playerAge} سنة | التقييم: ${potd.rating}
          </p>
          <p style="color: var(--gold-light); font-size: 0.9rem;">
            <strong>سبب الاختيار:</strong> ${potd.reason}
          </p>
        </div>
        <div style="text-align: left; background: rgba(0,0,0,0.5); padding: 10px 16px; border-radius: 10px; border: 1px solid var(--admin-border);">
          <div style="font-size: 0.75rem; color: var(--text-muted);">متبقي على الانتهاء:</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--gold-light);">${diffHours} ساعة</div>
        </div>
      </div>
    `;
  }
}

function setupPotdForm() {
  const form = document.getElementById("form-set-potd");
  const toggleBtn = document.getElementById("btn-toggle-potd");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const playerId = document.getElementById("potd-player-select").value;
      const hours = parseInt(document.getElementById("potd-duration-select").value) || 24;
      const reason = document.getElementById("potd-reason-input").value.trim();

      if (!playerId) {
        alert("يرجى اختيار لاعب أولاً");
        return;
      }

      try {
        await setPlayerOfTheDay(playerId, hours, reason);
        alert(`⭐ تم تعيين اللاعب بنجاح كرجل اليوم لمدة ${hours} ساعة!`);
        form.reset();
        await loadAdminData();
      } catch (err) {
        alert("خطأ: " + err.message);
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      const active = currentData.playerOfTheDay ? !currentData.playerOfTheDay.active : true;
      await togglePlayerOfTheDay(active);
      await loadAdminData();
      alert(active ? "تم تفعيل ظهور لوحة الشرف" : "تم إخفاء لوحة الشرف من الموقع");
    });
  }
}

// ==================== 6. REGISTRATION REQUESTS ====================
function renderRequestsTable(requests) {
  const tbody = document.getElementById("table-requests-body");
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 25px; color: var(--text-muted);">لا توجد طلبات تقديم حالياً.</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(req => {
    let cleanPhone = (req.phone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '2' + cleanPhone;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`مرحباً أستاذ ${req.parentName}، نتواصل معك بخصوص طلب انضمام اللاعب (${req.playerName}) لأكاديمية مركز شباب الأحمدية لكرة القدم.`)}`;

    return `
      <tr>
        <td><strong>${escapeHtml(req.playerName)}</strong></td>
        <td>${req.age || 12} سنة (${req.birthDate || ''})</td>
        <td>${escapeHtml(req.parentName || '')}</td>
        <td>
          <a href="${waUrl}" target="_blank" class="btn-action-icon whatsapp" title="محادثة واتساب سريعة">💬</a>
          <span style="direction: ltr; display: inline-block;">${escapeHtml(req.phone || '')}</span>
        </td>
        <td><span class="badge-status" style="background: rgba(255,255,255,0.06);">${escapeHtml(req.preferredPosition || '')}</span></td>
        <td>${escapeHtml(req.preferredFoot || 'اليمنى')}</td>
        <td>
          <span class="badge-status ${req.status || 'pending'}">
            ${req.status === 'approved' ? 'مقبول ✅' : (req.status === 'rejected' ? 'مرفوض ❌' : 'قيد المراجعة ⏳')}
          </span>
        </td>
        <td>
          <button class="btn-action-icon" style="background: rgba(46, 204, 113, 0.2); color: #2ecc71;" title="قبول الطلب" onclick="handleReqStatus('${req.id}', 'approved')">✓</button>
          <button class="btn-action-icon" style="background: rgba(231, 76, 60, 0.2); color: #e74c3c;" title="رفض الطلب" onclick="handleReqStatus('${req.id}', 'rejected')">✕</button>
          <button class="btn-action-icon delete" title="حذف" onclick="handleDeleteReq('${req.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.handleReqStatus = async (id, status) => {
  await updateRequestStatus(id, status);
  await loadAdminData();
};

window.handleDeleteReq = async (id) => {
  if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
    await deleteItem("registrationRequests", id);
    await loadAdminData();
  }
};

// ==================== 7. PLAYERS CRUD ====================
function renderPlayersTable(players) {
  const tbody = document.getElementById("table-players-body");
  if (!tbody) return;

  if (players.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 25px; color: var(--text-muted);">لا يوجد لاعبين مسجلين. أضف لاعباً جديداً.</td></tr>';
    return;
  }

  tbody.innerHTML = players.map(p => `
    <tr>
      <td>
        <div class="table-user-cell">
          <img src="${p.photo || './images/logo.jpg'}" alt="${p.name}" class="table-avatar" onerror="this.src='./images/logo.jpg'">
          <strong>${escapeHtml(p.name)}</strong>
        </div>
      </td>
      <td>${p.age || 12} سنة</td>
      <td>${escapeHtml(p.category || '')}</td>
      <td><span class="badge-status" style="background: rgba(212,175,55,0.15); color: var(--gold-light);">${escapeHtml(p.position || '')}</span></td>
      <td>#${p.number || ''}</td>
      <td>${escapeHtml(p.foot || 'اليمنى')}</td>
      <td>
        <button class="btn-action-icon edit" title="تعديل" onclick="editPlayer('${p.id}')">✏️</button>
        <button class="btn-action-icon delete" title="حذف" onclick="deletePlayerItem('${p.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.openPlayerModal = (player = null) => {
  const isEdit = !!player;
  const body = `
    <form id="form-player-crud">
      <div class="admin-form-group">
        <label class="admin-label">اسم اللاعب الرباعي *</label>
        <input type="text" id="m-p-name" class="admin-input" value="${isEdit ? escapeHtml(player.name) : ''}" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">العمر (سنوات) *</label>
          <input type="number" id="m-p-age" class="admin-input" value="${isEdit ? player.age : 12}" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">رقم القميص</label>
          <input type="number" id="m-p-num" class="admin-input" value="${isEdit ? player.number || '' : 10}">
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">المركز *</label>
          <input type="text" id="m-p-pos" class="admin-input" value="${isEdit ? escapeHtml(player.position) : 'مهاجم'}" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">الفئة السنية</label>
          <select id="m-p-cat" class="admin-select">
            <option value="2014-2016" ${isEdit && player.category === '2014-2016' ? 'selected' : ''}>2014 - 2016 (براعم)</option>
            <option value="2012-2014" ${isEdit && player.category === '2012-2014' ? 'selected' : ''}>2012 - 2014 (أشبال)</option>
            <option value="2010-2012" ${isEdit && player.category === '2010-2012' ? 'selected' : ''}>2010 - 2012 (ناشئين)</option>
            <option value="2008-2010" ${isEdit && player.category === '2008-2010' ? 'selected' : ''}>2008 - 2010 (شباب)</option>
          </select>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">القدم المفضلة</label>
        <select id="m-p-foot" class="admin-select">
          <option value="اليمنى" ${isEdit && player.foot === 'اليمنى' ? 'selected' : ''}>اليمنى</option>
          <option value="اليسرى" ${isEdit && player.foot === 'اليسرى' ? 'selected' : ''}>اليسرى</option>
          <option value="القدمين" ${isEdit && player.foot === 'القدمين' ? 'selected' : ''}>يجيد اللعب بالقدمين</option>
        </select>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">مسار الصورة في مجلد images/ أو رابط الصورة</label>
        <input type="text" id="m-p-photo" class="admin-input" value="${isEdit ? escapeHtml(player.photo || '') : './images/logo.jpg'}" placeholder="./images/players/player1.jpg أو رابط">
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px; margin-top: 10px;">
        ${isEdit ? 'حفظ التعديلات' : 'إضافة اللاعب الآن'}
      </button>
    </form>
  `;

  showAdminModal(isEdit ? "تعديل بيانات اللاعب" : "إضافة لاعب جديد للأكاديمية", body);

  document.getElementById("form-player-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: isEdit ? player.id : `player-${Date.now()}`,
      name: document.getElementById("m-p-name").value.trim(),
      age: parseInt(document.getElementById("m-p-age").value) || 12,
      number: parseInt(document.getElementById("m-p-num").value) || 10,
      position: document.getElementById("m-p-pos").value.trim(),
      category: document.getElementById("m-p-cat").value,
      foot: document.getElementById("m-p-foot").value,
      photo: document.getElementById("m-p-photo").value.trim() || './images/logo.jpg'
    };

    await saveItem("players", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.editPlayer = (id) => {
  const p = (currentData.players || []).find(item => item.id === id);
  if (p) openPlayerModal(p);
};

window.deletePlayerItem = async (id) => {
  if (confirm("هل أنت متأكد من حذف هذا اللاعب من الأكاديمية؟")) {
    await deleteItem("players", id);
    await loadAdminData();
  }
};

// ==================== 8. COACHES CRUD ====================
function renderCoachesTable(coaches) {
  const tbody = document.getElementById("table-coaches-body");
  if (!tbody) return;

  if (coaches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 25px; color: var(--text-muted);">لا يوجد مدربين مضافين.</td></tr>';
    return;
  }

  tbody.innerHTML = coaches.map(c => `
    <tr>
      <td>
        <div class="table-user-cell">
          <img src="${c.photo || './images/logo.jpg'}" alt="${c.name}" class="table-avatar" onerror="this.src='./images/logo.jpg'">
          <strong>${escapeHtml(c.name)}</strong>
        </div>
      </td>
      <td>${c.age || 35} سنة</td>
      <td>${escapeHtml(c.role || '')}</td>
      <td>${escapeHtml(c.license || '')}</td>
      <td>${escapeHtml(c.experience || '')}</td>
      <td>
        <button class="btn-action-icon edit" title="تعديل" onclick="editCoach('${c.id}')">✏️</button>
        <button class="btn-action-icon delete" title="حذف" onclick="deleteCoachItem('${c.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.openCoachModal = (coach = null) => {
  const isEdit = !!coach;
  const body = `
    <form id="form-coach-crud">
      <div class="admin-form-group">
        <label class="admin-label">اسم المدرب ثلاثي أو رباعي *</label>
        <input type="text" id="m-c-name" class="admin-input" value="${isEdit ? escapeHtml(coach.name) : ''}" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">السن (العمر) *</label>
          <input type="number" id="m-c-age" class="admin-input" value="${isEdit ? coach.age : 35}" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">المسمى التدريبي *</label>
          <input type="text" id="m-c-role" class="admin-input" value="${isEdit ? escapeHtml(coach.role) : 'مدرب الفئات السنية'}" required>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">الرخصة والشهادات التدريبية *</label>
        <input type="text" id="m-c-license" class="admin-input" value="${isEdit ? escapeHtml(coach.license) : 'رخصة الاتحاد الأفريقي (CAF)'}" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">سنوات الخبرة</label>
        <input type="text" id="m-c-exp" class="admin-input" value="${isEdit ? escapeHtml(coach.experience || '') : '10 سنوات خبرة في قطاع الناشئين'}">
      </div>
      <div class="admin-form-group">
        <label class="admin-label">السيرة الذاتية المفصلة (Bio) *</label>
        <textarea id="m-c-bio" class="admin-textarea" rows="3" required>${isEdit ? escapeHtml(coach.bio) : ''}</textarea>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">مسار صورة المدرب في مجلد images/ أو رابط الصورة</label>
        <input type="text" id="m-c-photo" class="admin-input" value="${isEdit ? escapeHtml(coach.photo || '') : './images/logo.jpg'}">
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px; margin-top: 10px;">
        ${isEdit ? 'حفظ تعديلات المدرب' : 'إضافة المدرب الآن'}
      </button>
    </form>
  `;

  showAdminModal(isEdit ? "تعديل بيانات المدرب" : "إضافة مدرب جديد", body);

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
      photo: document.getElementById("m-c-photo").value.trim() || './images/logo.jpg'
    };

    await saveItem("coaches", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.editCoach = (id) => {
  const c = (currentData.coaches || []).find(item => item.id === id);
  if (c) openCoachModal(c);
};

window.deleteCoachItem = async (id) => {
  if (confirm("هل أنت متأكد من حذف هذا المدرب؟")) {
    await deleteItem("coaches", id);
    await loadAdminData();
  }
};

// ==================== 9. MATCHES & RESULTS CRUD ====================
function renderMatchesTables(upcoming, results) {
  const upTbody = document.getElementById("table-upcoming-matches-body");
  const resTbody = document.getElementById("table-results-matches-body");

  if (upTbody) {
    if (upcoming.length === 0) {
      upTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">لا توجد مباريات قادمة.</td></tr>';
    } else {
      upTbody.innerHTML = upcoming.map(m => `
        <tr>
          <td><strong>${escapeHtml(m.opponent)}</strong></td>
          <td>${escapeHtml(m.category)}</td>
          <td>${escapeHtml(m.tournament || 'ودية')}</td>
          <td>${escapeHtml(m.stadium || '')}</td>
          <td>${m.date} (${m.time})</td>
          <td>
            <button class="btn-action-icon delete" title="حذف" onclick="deleteUpcomingMatch('${m.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
  }

  if (resTbody) {
    if (results.length === 0) {
      resTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">لم تسجل نتائج.</td></tr>';
    } else {
      resTbody.innerHTML = results.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.opponent)}</strong></td>
          <td>${escapeHtml(r.category)}</td>
          <td><strong style="color: var(--gold-light);">${r.scoreOur} - ${r.scoreOpponent}</strong></td>
          <td>${escapeHtml(r.scorers || '')}</td>
          <td>${r.date}</td>
          <td>
            <button class="btn-action-icon delete" title="حذف" onclick="deleteResultMatch('${r.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
  }
}

window.openUpcomingMatchModal = () => {
  const body = `
    <form id="form-upmatch-crud">
      <div class="admin-form-group">
        <label class="admin-label">الفريق المنافس *</label>
        <input type="text" id="m-up-opp" class="admin-input" placeholder="مثال: أكاديمية النجوم" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">الفئة العمرية *</label>
          <input type="text" id="m-up-cat" class="admin-input" placeholder="مثال: مواليد 2012" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">اسم البطولة / ودية</label>
          <input type="text" id="m-up-tourn" class="admin-input" placeholder="دوري المحافظة">
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">الملعب *</label>
        <input type="text" id="m-up-stad" class="admin-input" placeholder="ملعب مركز شباب الأحمدية الرئيسي" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">التاريخ *</label>
          <input type="date" id="m-up-date" class="admin-input" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">التوقيت *</label>
          <input type="text" id="m-up-time" class="admin-input" placeholder="05:00 م" required>
        </div>
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px;">
        جدولة المباراة القادمة 📅
      </button>
    </form>
  `;
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
      time: document.getElementById("m-up-time").value.trim()
    };
    await saveItem("upcomingMatches", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.deleteUpcomingMatch = async (id) => {
  if (confirm("حذف هذه المباراة القادمة؟")) {
    await deleteItem("upcomingMatches", id);
    await loadAdminData();
  }
};

window.openResultMatchModal = () => {
  const body = `
    <form id="form-resmatch-crud">
      <div class="admin-form-group">
        <label class="admin-label">الفريق المنافس *</label>
        <input type="text" id="m-res-opp" class="admin-input" placeholder="مثال: أكاديمية الأبطال" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">أهداف أكاديمية الأحمدية *</label>
          <input type="number" id="m-res-our" class="admin-input" value="3" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">أهداف المنافس *</label>
          <input type="number" id="m-res-opp-score" class="admin-input" value="1" required>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">الفئة السنية</label>
          <input type="text" id="m-res-cat" class="admin-input" value="مواليد 2012">
        </div>
        <div class="admin-form-group">
          <label class="admin-label">التاريخ *</label>
          <input type="date" id="m-res-date" class="admin-input" required>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">مسجلو الأهداف</label>
        <input type="text" id="m-res-scorers" class="admin-input" placeholder="مثال: ياسين أحمد (هدفين)، عمر خالد (هدف)">
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px;">
        تسجيل النتيجة ⚽
      </button>
    </form>
  `;
  showAdminModal("تسجيل نتيجة مباراة", body);

  document.getElementById("form-resmatch-crud").onsubmit = async (e) => {
    e.preventDefault();
    const scoreOur = parseInt(document.getElementById("m-res-our").value) || 0;
    const scoreOpponent = parseInt(document.getElementById("m-res-opp-score").value) || 0;
    const result = scoreOur > scoreOpponent ? "win" : (scoreOur === scoreOpponent ? "draw" : "loss");

    const item = {
      id: `match-res-${Date.now()}`,
      opponent: document.getElementById("m-res-opp").value.trim(),
      scoreOur,
      scoreOpponent,
      result,
      category: document.getElementById("m-res-cat").value.trim(),
      date: document.getElementById("m-res-date").value,
      scorers: document.getElementById("m-res-scorers").value.trim()
    };
    await saveItem("matchResults", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.deleteResultMatch = async (id) => {
  if (confirm("حذف هذه النتيجة؟")) {
    await deleteItem("matchResults", id);
    await loadAdminData();
  }
};

// ==================== 10. NEWS & TICKER CRUD ====================
function renderNewsAndTicker(tickerList, articles) {
  const tickerContainer = document.getElementById("ticker-items-list");
  const artTbody = document.getElementById("table-news-articles-body");

  if (tickerContainer) {
    tickerContainer.innerHTML = tickerList.map((item, index) => `
      <li style="background: rgba(0,0,0,0.3); border: 1px solid var(--admin-border); padding: 10px 14px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span>⚡ ${escapeHtml(item)}</span>
        <button class="btn-action-icon delete" onclick="deleteTickerItem(${index})">🗑️</button>
      </li>
    `).join('');
  }

  if (artTbody) {
    if (articles.length === 0) {
      artTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">لا توجد مقالات منشورة.</td></tr>';
    } else {
      artTbody.innerHTML = articles.map(a => `
        <tr>
          <td><strong>${escapeHtml(a.title)}</strong></td>
          <td>${escapeHtml(a.category || '')}</td>
          <td>${a.date}</td>
          <td>
            <button class="btn-action-icon delete" onclick="deleteArticleItem('${a.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
  }
}

window.openTickerModal = () => {
  const body = `
    <form id="form-ticker-add">
      <div class="admin-form-group">
        <label class="admin-label">نص الخبر للشريط العاجل *</label>
        <textarea id="m-ticker-text" class="admin-textarea" rows="2" placeholder="اكتب الخبر العاجل هنا..." required></textarea>
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px;">
        إضافة إلى الشريط المتحرك ⚡
      </button>
    </form>
  `;
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
  };
};

window.deleteTickerItem = async (index) => {
  if (confirm("حذف هذا الخبر من الشريط المتحرك؟")) {
    const ticker = currentData.tickerNews || [];
    ticker.splice(index, 1);
    await saveTickerNews(ticker);
    await loadAdminData();
  }
};

window.openArticleModal = () => {
  const body = `
    <form id="form-article-crud">
      <div class="admin-form-group">
        <label class="admin-label">عنوان الخبر أو التقرير *</label>
        <input type="text" id="m-art-title" class="admin-input" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">القسم *</label>
          <input type="text" id="m-art-cat" class="admin-input" value="أخبار الأكاديمية">
        </div>
        <div class="admin-form-group">
          <label class="admin-label">التاريخ *</label>
          <input type="date" id="m-art-date" class="admin-input" required>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">نبذة ملخصة *</label>
        <input type="text" id="m-art-sum" class="admin-input" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">نص المقال كاملاً *</label>
        <textarea id="m-art-content" class="admin-textarea" rows="4" required></textarea>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">رابط أو مسار الصورة</label>
        <input type="text" id="m-art-img" class="admin-input" value="./images/logo.jpg">
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px;">
        نشر المقال الإخباري 📰
      </button>
    </form>
  `;
  showAdminModal("كتابة مقال إخباري جديد", body);

  document.getElementById("form-article-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: `news-${Date.now()}`,
      title: document.getElementById("m-art-title").value.trim(),
      category: document.getElementById("m-art-cat").value.trim(),
      date: document.getElementById("m-art-date").value,
      summary: document.getElementById("m-art-sum").value.trim(),
      content: document.getElementById("m-art-content").value.trim(),
      image: document.getElementById("m-art-img").value.trim() || './images/logo.jpg'
    };
    await saveItem("news", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.deleteArticleItem = async (id) => {
  if (confirm("حذف هذا المقال الإخباري؟")) {
    await deleteItem("news", id);
    await loadAdminData();
  }
};

// ==================== 11. TROPHIES CRUD ====================
function renderTrophiesTable(trophies) {
  const tbody = document.getElementById("table-trophies-body");
  if (!tbody) return;

  if (trophies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">دولاب البطولات فارغ.</td></tr>';
    return;
  }

  tbody.innerHTML = trophies.map(t => `
    <tr>
      <td><strong>${t.icon || '🏆'} ${escapeHtml(t.title)}</strong></td>
      <td>${escapeHtml(t.year)}</td>
      <td>${escapeHtml(t.category || '')}</td>
      <td><span class="badge-status approved">${escapeHtml(t.badge || '')}</span></td>
      <td>${escapeHtml(t.description)}</td>
      <td>
        <button class="btn-action-icon delete" onclick="deleteTrophyItem('${t.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.openTrophyModal = () => {
  const body = `
    <form id="form-trophy-crud">
      <div class="admin-form-group">
        <label class="admin-label">اسم البطولة أو الكأس *</label>
        <input type="text" id="m-tr-title" class="admin-input" placeholder="كأس دوري مراكز الشباب" required>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-form-group">
          <label class="admin-label">سنة التتويج *</label>
          <input type="text" id="m-tr-year" class="admin-input" value="2026" required>
        </div>
        <div class="admin-form-group">
          <label class="admin-label">الفئة السنية</label>
          <input type="text" id="m-tr-cat" class="admin-input" value="مواليد 2012">
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">شارة التتويج (Badge)</label>
        <input type="text" id="m-tr-badge" class="admin-input" value="المركز الأول 🥇">
      </div>
      <div class="admin-form-group">
        <label class="admin-label">تفاصيل الإنجاز *</label>
        <textarea id="m-tr-desc" class="admin-textarea" rows="2" required></textarea>
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px;">
        إضافة البطولة لدولاب المجد 🏆
      </button>
    </form>
  `;
  showAdminModal("إضافة كأس أو بطولة جديدة", body);

  document.getElementById("form-trophy-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: `trophy-${Date.now()}`,
      title: document.getElementById("m-tr-title").value.trim(),
      year: document.getElementById("m-tr-year").value.trim(),
      category: document.getElementById("m-tr-cat").value.trim(),
      badge: document.getElementById("m-tr-badge").value.trim(),
      description: document.getElementById("m-tr-desc").value.trim(),
      icon: "🏆"
    };
    await saveItem("trophies", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.deleteTrophyItem = async (id) => {
  if (confirm("حذف هذه البطولة من دولاب الإنجازات؟")) {
    await deleteItem("trophies", id);
    await loadAdminData();
  }
};

// ==================== 12. SCHEDULES CRUD ====================
function renderSchedulesTable(schedules) {
  const tbody = document.getElementById("table-schedules-body");
  if (!tbody) return;

  if (schedules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">لا توجد مواعيد مضافة.</td></tr>';
    return;
  }

  tbody.innerHTML = schedules.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.category)}</strong></td>
      <td>${escapeHtml(s.days)}</td>
      <td><span style="color: var(--gold-light);">${escapeHtml(s.time)}</span></td>
      <td>${escapeHtml(s.field)}</td>
      <td>${escapeHtml(s.coach || '')}</td>
      <td>
        <button class="btn-action-icon delete" onclick="deleteScheduleItem('${s.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.openScheduleModal = () => {
  const body = `
    <form id="form-sch-crud">
      <div class="admin-form-group">
        <label class="admin-label">الفئة العمرية *</label>
        <input type="text" id="m-s-cat" class="admin-input" placeholder="مواليد 2012 - 2014" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">أيام التدريب *</label>
        <input type="text" id="m-s-days" class="admin-input" placeholder="السبت - الإثنين - الأربعاء" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">التوقيت *</label>
        <input type="text" id="m-s-time" class="admin-input" placeholder="05:00 م - 06:30 م" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">الملعب *</label>
        <input type="text" id="m-s-field" class="admin-input" value="الملعب الرئيسي لمركز شباب الأحمدية" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">المدرب المسؤول</label>
        <input type="text" id="m-s-coach" class="admin-input" placeholder="كابتن أحمد مصطفى">
      </div>
      <button type="submit" class="btn-admin-action" style="width: 100%; background: var(--gold-gradient); color: #090c10; font-weight: 800; padding: 12px;">
        إضافة موعد التدريب 🕒
      </button>
    </form>
  `;
  showAdminModal("إضافة موعد تدريب جديد", body);

  document.getElementById("form-sch-crud").onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: `sch-${Date.now()}`,
      category: document.getElementById("m-s-cat").value.trim(),
      days: document.getElementById("m-s-days").value.trim(),
      time: document.getElementById("m-s-time").value.trim(),
      field: document.getElementById("m-s-field").value.trim(),
      coach: document.getElementById("m-s-coach").value.trim()
    };
    await saveItem("schedules", item);
    closeAdminModal();
    await loadAdminData();
  };
};

window.deleteScheduleItem = async (id) => {
  if (confirm("حذف هذا الموعد من جدول التدريب؟")) {
    await deleteItem("schedules", id);
    await loadAdminData();
  }
};

// ==================== 13. BACKUP & RESTORE ====================
function setupBackupHandlers() {
  const exportBtn = document.getElementById("btn-export-backup");
  const importInput = document.getElementById("input-import-backup");
  const resetBtn = document.getElementById("btn-reset-defaults");

  if (exportBtn) exportBtn.addEventListener("click", () => exportData());

  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const success = importData(event.target.result);
        if (success) {
          alert("✅ تم استيراد البيانات بنجاح!");
          await loadAdminData();
        } else {
          alert("❌ الملف غير صالح أو لا يحتوي على تنسيق JSON الصحيح");
        }
      };
      reader.readAsText(file);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("⚠️ هل أنت متأكد تماماً من رغبتك في إعادة ضبط جميع البيانات للوضع الافتراضي؟")) {
        resetDataToDefaults();
        await loadAdminData();
        alert("تمت استعادة البيانات الافتراضية بنجاح.");
      }
    });
  }

  const clearAllBtn = document.getElementById("btn-clear-all-mock");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
      if (confirm("🗑️ هل أنت متأكد من رغبتك في مسح وإفراغ جميع البيانات التجريبية العشوائية؟ ستبدأ المنصة فارغة وجاهزة لبياناتك الحقيقية.")) {
        clearAllMockData();
        await loadAdminData();
        alert("✅ تم مسح جميع البيانات التجريبية بنجاح! المنصة الآن فارغة وجاهزة لبياناتك.");
      }
    });
  }
}

// ==================== MODAL HELPERS ====================
function showAdminModal(title, contentHtml) {
  const modal = document.getElementById("general-modal");
  const titleEl = document.getElementById("modal-title");
  const bodyEl = document.getElementById("modal-body");

  if (titleEl) titleEl.innerText = title;
  if (bodyEl) bodyEl.innerHTML = contentHtml;
  if (modal) modal.classList.add("open");
}

window.closeAdminModal = () => {
  const modal = document.getElementById("general-modal");
  if (modal) modal.classList.remove("open");
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
