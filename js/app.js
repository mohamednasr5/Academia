// =====================================================================
// Academia Al-Ahmadia — Public Website Application Logic v3.0
// Premium rendering: animated stats, scoreboard UI, player directory
// with search/filter, player detail modal, scroll reveals, skeletons,
// real-time sync from admin, settings-driven branding.
// =====================================================================
import { getAllData, syncFromCloud, submitRegistrationRequest } from "./data-service.js";

let academyData = null;
let countdownInterval = null;
let deferredPrompt = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  setupHeaderScroll();
  setupScrollReveal();
  setupScrollSpy();
  initPWA();

  // First paint uses the local cache only; never wait for Firebase or the network.
  await loadAndRenderAll();
  setupRegistrationForm();
  setupPlayerDetailClose();

  // Cloud refresh happens after the page is already usable.
  // The storage event emitted after cache hydration updates the page automatically.
  let renderQueued = false;
  window.addEventListener("storage", () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(async () => {
      renderQueued = false;
      await loadAndRenderAll();
    });
  });
  syncFromCloud().catch(error => console.warn("[Academia] Background refresh failed:", error));
});

// ============================================================
// LOAD & RENDER ALL
// ============================================================
async function loadAndRenderAll() {
  try {
    academyData = await getAllData();
    applySettings(academyData.settings || {});
    renderTicker(academyData.tickerNews || []);
    renderStats(academyData);
    renderPlayerOfTheDay(academyData.playerOfTheDay);
    renderCoaches(academyData.coaches || []);
    renderTrophies(academyData.trophies || []);
    renderSchedules(academyData.schedules || []);
    renderMatches(academyData.upcomingMatches || [], academyData.matchResults || []);
    renderPlayers(academyData.players || []);
    renderNews(academyData.news || []);
  } catch (err) {
    console.error("[Academia] load error:", err);
    showToast("تعذّر تحميل بعض البيانات، يتم العمل في وضع عدم الاتصال.", "error");
  }
}

// ============================================================
// SETTINGS — drive branding dynamically
// ============================================================
function applySettings(s) {
  const set = (id, val, attr = null) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (attr) el.setAttribute(attr, val); else el.textContent = val;
  };
  set("brand-title", s.academyName || "أكاديمية مركز شباب الأحمدية");
  set("brand-tagline", s.tagline || "صناع الأبطال ونجوم المستقبل");
  document.title = `${s.academyName || "أكاديمية مركز شباب الأحمدية"} | المنصة الرسمية`;
  if (s.description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", s.description);
  }
  if (s.logo) {
    document.querySelectorAll("#brand-logo-img, #hero-logo-img").forEach(img => {
      img.src = s.logo; img.onerror = () => { img.src = "./images/logo.jpg"; };
    });
  }
  if (s.announcement && s.announcement.trim()) {
    const banner = document.getElementById("announcement-banner");
    if (banner) { banner.innerHTML = `📣 ${escapeHtml(s.announcement)}`; banner.classList.add("show"); }
  } else {
    const banner = document.getElementById("announcement-banner");
    if (banner) banner.classList.remove("show");
  }
  // Footer
  set("footer-academy-name", s.academyName || "أكاديمية مركز شباب الأحمدية");
  set("footer-description", s.description || "");
  set("footer-address", `📍 ${s.address || ""}`);
  const phoneLink = document.getElementById("footer-phone-link");
  const waLink = document.getElementById("footer-whatsapp-link");
  if (phoneLink && s.phone) { phoneLink.textContent = s.phone; phoneLink.href = `tel:${s.phone}`; }
  if (waLink) { waLink.textContent = "01227506392"; waLink.href = "https://wa.me/201227506392"; waLink.target = "_blank"; waLink.rel = "noopener noreferrer"; }
  // Social links
  const socialWrap = document.getElementById("footer-social-links");
  if (socialWrap && s.whatsapp) {
    socialWrap.innerHTML = `
      <a href="https://wa.me/201227506392" target="_blank" rel="noopener noreferrer" class="social-icon-btn" title="واتساب الإدارة">💬</a>
      <a href="tel:${escapeHtml(s.phone || '')}" class="social-icon-btn" title="اتصال">📞</a>
      ${s.facebook ? `<a href="${escapeHtml(s.facebook)}" target="_blank" class="social-icon-btn" title="فيسبوك">📘</a>` : ''}
      ${s.instagram ? `<a href="${escapeHtml(s.instagram)}" target="_blank" class="social-icon-btn" title="انستجرام">📷</a>` : ''}
      ${s.youtube ? `<a href="${escapeHtml(s.youtube)}" target="_blank" class="social-icon-btn" title="يوتيوب">▶️</a>` : ''}
    `;
  }
  set("footer-developer", s.developerName || "المهندس محمد حماد");
  const devSocial = document.getElementById("footer-developer-social");
  if (devSocial) {
    devSocial.innerHTML = `
      ${s.developerFacebook ? `<a href="${escapeHtml(s.developerFacebook)}" target="_blank" class="social-icon-btn" style="width:32px;height:32px;font-size:0.95rem;" title="فيسبوك">📘</a>` : ''}
      ${s.developerWhatsapp ? `<a href="https://wa.me/${escapeHtml(s.developerWhatsapp)}" target="_blank" class="social-icon-btn" style="width:32px;height:32px;font-size:0.95rem;background:rgba(37,211,102,0.2);border-color:#25d366;color:#25d366;" title="واتساب">💬</a>` : ''}
    `;
  }
}

// ============================================================
// TICKER
// ============================================================
function renderTicker(items) {
  const c = document.getElementById("ticker-news-container");
  if (!c) return;
  if (!items.length) {
    c.innerHTML = '<span class="ticker-item"><span class="ticker-bullet">★</span><span>أهلاً بكم في أكاديمية مركز شباب الأحمدية لكرة القدم</span></span>';
    return;
  }
  const html = items.map(t => `<span class="ticker-item"><span class="ticker-bullet">★</span><span>${escapeHtml(t)}</span></span>`).join("");
  c.innerHTML = html + html;
}

// ============================================================
// STATS — animated counters
// ============================================================
function renderStats(data) {
  const playersCount = (data.players || []).length;
  const trophiesCount = (data.trophies || []).length;
  const coachesCount = (data.coaches || []).length;
  animateCounter("stat-players-count", playersCount, "+");
  animateCounter("stat-trophies-count", trophiesCount, "");
  animateCounter("stat-coaches-count", coachesCount, "");
}

function animateCounter(id, target, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) { el.textContent = target + suffix; return; }
  const duration = 1800;
  const start = performance.now();
  const startVal = 0;
  let frameId = 0;
  el.textContent = "0" + suffix;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // Ease-out exponential: visible acceleration at the beginning, then a smooth settle.
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const value = Math.round(startVal + (target - startVal) * eased);
    el.textContent = value.toLocaleString("en-US") + suffix;
    if (progress < 1) frameId = requestAnimationFrame(step);
    else el.textContent = target.toLocaleString("en-US") + suffix;
  }
  if (el.dataset.counterFrame) cancelAnimationFrame(Number(el.dataset.counterFrame));
  frameId = requestAnimationFrame(step);
  el.dataset.counterFrame = String(frameId);
}

// ============================================================
// STAR OF THE DAY
// ============================================================
function renderPlayerOfTheDay(potd) {
  const c = document.getElementById("potd-container");
  if (!c) return;
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  if (!potd || !potd.active) {
    c.innerHTML = `
      <div class="potd-card" style="text-align:center;padding:50px 24px;">
        <div style="font-size:3rem;margin-bottom:12px;">🌟</div>
        <h3 style="color:var(--champ-light);margin-bottom:12px;">لوحة الشرف اليومية</h3>
        <p style="color:var(--text-muted);max-width:620px;margin:0 auto;line-height:1.8;">
          يتم اختيار نجم اليوم من قبل الجهاز الفني للأكاديمية وتجديده كل 24 ساعة وفقاً للأداء الاستثنائي والانضباط في التدريبات والمباريات. ترقبوا الإعلان عن نجم الجولة القادمة!
        </p>
      </div>`;
    return;
  }

  const rating = parseFloat(potd.rating) || 9.8;
  const ratingPct = Math.min(100, (rating / 10) * 100);

  c.innerHTML = `
    <div class="potd-card">
      <div class="potd-grid">
        <div class="potd-photo-wrap">
          <div class="potd-crown">👑</div>
          <img src="${potd.playerPhoto || './images/logo.jpg'}" alt="${escapeHtml(potd.playerName)}" class="potd-photo" onerror="this.src='./images/logo.jpg'">
          <button id="btn-cheer-potd" class="btn-champ" style="padding:7px 18px;font-size:0.82rem;margin-top:14px;">
            <span>👏</span> شجّع نجم اليوم
          </button>
        </div>
        <div class="potd-info">
          <h3>${escapeHtml(potd.playerName)}</h3>
          <div class="potd-meta">
            <span class="champ-badge">⚽ المركز: ${escapeHtml(potd.playerPosition || 'لاعب')}</span>
            <span class="champ-badge">🎂 السن: ${potd.playerAge || 12} سنة</span>
            <span class="champ-badge">رقم: #${potd.number || 10}</span>
          </div>
          <div class="potd-reason">
            <strong>سبب الاختيار والتكريم:</strong>
            <p style="margin-top:6px;">${escapeHtml(potd.reason || 'الأداء المتميز في التدريبات والمباريات.')}</p>
          </div>
          <div class="potd-rating">
            <span>التقييم: ${rating}/10</span>
            <div class="rating-bar"><span style="width:${ratingPct}%"></span></div>
          </div>
        </div>
        <div class="potd-timer-box">
          <div class="potd-timer-title">⏳ متبقي على نهاية التتويج</div>
          <div class="potd-countdown">
            <div class="countdown-unit"><div class="countdown-num" id="potd-hours">24</div><div class="countdown-lbl">ساعة</div></div>
            <div class="countdown-unit"><div class="countdown-num" id="potd-mins">00</div><div class="countdown-lbl">دقيقة</div></div>
            <div class="countdown-unit"><div class="countdown-num" id="potd-secs">00</div><div class="countdown-lbl">ثانية</div></div>
          </div>
          <div style="margin-top:12px;font-size:0.74rem;color:var(--champ-light);">تجديد تلقائي كل 24 ساعة 🕒</div>
        </div>
      </div>
    </div>`;

  startPotdCountdown(potd.expiresAt);
  const cheerBtn = document.getElementById("btn-cheer-potd");
  if (cheerBtn) {
    cheerBtn.addEventListener("click", () => {
      triggerConfetti();
      showToast(`🎉 شكراً لتشجيعك النجم ${potd.playerName}!`, "success");
    });
  }
}

function startPotdCountdown(expiresAtStr) {
  const target = new Date(expiresAtStr).getTime();
  const update = () => {
    const distance = target - Date.now();
    const hEl = document.getElementById("potd-hours");
    const mEl = document.getElementById("potd-mins");
    const sEl = document.getElementById("potd-secs");
    if (distance <= 0) {
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
      [hEl, mEl, sEl].forEach(el => el && (el.textContent = "00"));
      return;
    }
    const h = Math.floor(distance / 3600000);
    const m = Math.floor((distance % 3600000) / 60000);
    const s = Math.floor((distance % 60000) / 1000);
    if (hEl) hEl.textContent = String(h).padStart(2, "0");
    if (mEl) mEl.textContent = String(m).padStart(2, "0");
    if (sEl) sEl.textContent = String(s).padStart(2, "0");
  };
  update();
  countdownInterval = setInterval(update, 1000);
}

// ============================================================
// COACHES
// ============================================================
function formatCoachBio(bioText) {
  if (!bioText || !bioText.trim()) {
    return `<div class="coach-bio-box"><div class="coach-bio-title"><span>📋</span> السيرة الذاتية والمسيرة الرياضية:</div><p style="color:var(--text-muted);font-size:0.9rem;">مدرب معتمد ذو خبرة رياضية متميزة.</p></div>`;
  }
  let rawItems = bioText.includes("\n") ? bioText.split("\n")
    : bioText.includes("-") ? bioText.split("-")
    : bioText.includes("•") ? bioText.split("•")
    : bioText.split(/[\r\n]+/);
  const cleaned = rawItems.map(i => i.replace(/^[\s\-•*\d.\):]+/, "").trim()).filter(i => i.length > 0);
  if (!cleaned.length) cleaned.push(bioText.trim());
  const items = cleaned.map((item, i) => `<li class="coach-bio-item"><span class="bio-num-badge">${i + 1}</span><span class="bio-text">${escapeHtml(item)}</span></li>`).join("");
  return `<div class="coach-bio-box"><div class="coach-bio-title"><span>📋</span> السيرة الذاتية والمسيرة الرياضية:</div><ol class="coach-bio-list">${items}</ol></div>`;
}

function renderCoaches(coaches) {
  const c = document.getElementById("coaches-container");
  if (!c) return;
  if (!coaches.length) {
    c.innerHTML = emptyState("👔", "لا يوجد مدربين مسجلين حالياً", "سيتم عرض الجهاز الفني فور إضافته من لوحة التحكم.");
    return;
  }
  c.innerHTML = coaches.map(coach => `
    <div class="coach-card">
      <div class="coach-header">
        <div class="coach-avatar-wrap">
          <img src="${coach.photo || './images/logo.jpg'}" alt="${escapeHtml(coach.name)}" class="coach-avatar" loading="lazy" onerror="this.src='./images/logo.jpg'">
          <div class="coach-role-badge">${escapeHtml(coach.role || 'مدرب معتمد')}</div>
        </div>
      </div>
      <div class="coach-body">
        <h3 class="coach-name">${escapeHtml(coach.name)}</h3>
        <div class="coach-meta-row">
          <span>🎂 ${coach.age || 30} سنة</span>
          <span>•</span>
          <span>💼 ${escapeHtml(coach.experience || 'خبرة تدريبية')}</span>
        </div>
        ${formatCoachBio(coach.bio)}
        <div class="coach-footer">
          <div class="coach-footer-item">
            <span>📜</span>
            <span><strong>المؤهل:</strong> ${escapeHtml(coach.license || 'رخصة معتمدة')}</span>
          </div>
        </div>
        ${(coach.phone || coach.email) ? `
          <div class="coach-contact">
            ${coach.phone ? `<a href="tel:${escapeHtml(coach.phone)}" target="_blank">📞 ${escapeHtml(coach.phone)}</a>` : ''}
            ${coach.email ? `<a href="mailto:${escapeHtml(coach.email)}" target="_blank">✉️ بريد إلكتروني</a>` : ''}
          </div>` : ''}
      </div>
    </div>`).join("");
}

// ============================================================
// TROPHIES
// ============================================================
function renderTrophies(trophies) {
  const c = document.getElementById("trophies-container");
  if (!c) return;
  if (!trophies.length) {
    c.innerHTML = emptyState("🏆", "دولاب البطولات فارغ حالياً", "ستظهر الإنجازات فور إضافتها من لوحة التحكم.");
    return;
  }
  c.innerHTML = trophies.map(t => {
    const visual = t.image
      ? `<div class="trophy-image-wrap"><img src="${escapeHtml(t.image)}" alt="${escapeHtml(t.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'trophy-icon\\'>${t.icon || '🏆'}</div>'"></div>`
      : `<div class="trophy-image-wrap"><span class="trophy-icon" style="font-size:2.6rem;">${t.icon || '🏆'}</span></div>`;
    return `
      <div class="trophy-card">
        ${visual}
        <div class="trophy-year">${escapeHtml(t.year)} — ${escapeHtml(t.category || '')}</div>
        <h3 class="trophy-title">${escapeHtml(t.title)}</h3>
        <p class="trophy-desc">${escapeHtml(t.description)}</p>
        <div style="margin-top:14px;"><span class="champ-badge">${escapeHtml(t.badge || 'إنجاز بطولي')}</span></div>
      </div>`;
  }).join("");
}

// ============================================================
// SCHEDULES
// ============================================================
function renderSchedules(schedules) {
  const c = document.getElementById("schedules-container");
  if (!c) return;
  if (!schedules.length) {
    c.innerHTML = emptyState("🕒", "لا توجد مواعيد تدريب مسجلة", "سيتم عرض الجدول الأسبوعي فور إضافته.");
    return;
  }
  c.innerHTML = schedules.map(sch => `
    <div class="schedule-card">
      <div class="schedule-cat"><span>⚽</span> ${escapeHtml(sch.category)}</div>
      <div class="schedule-detail-row"><div class="schedule-icon-pill">📅</div><div><div style="font-size:0.78rem;color:var(--text-muted);">أيام التدريب</div><div style="font-weight:700;">${escapeHtml(sch.days)}</div></div></div>
      <div class="schedule-detail-row"><div class="schedule-icon-pill">🕒</div><div><div style="font-size:0.78rem;color:var(--text-muted);">التوقيت</div><div style="font-weight:700;color:var(--gold-light);">${escapeHtml(sch.time)}</div></div></div>
      <div class="schedule-detail-row"><div class="schedule-icon-pill">🏟️</div><div><div style="font-size:0.78rem;color:var(--text-muted);">الملعب</div><div style="font-weight:600;">${escapeHtml(sch.field)}</div></div></div>
      <div class="schedule-detail-row"><div class="schedule-icon-pill">👔</div><div><div style="font-size:0.78rem;color:var(--text-muted);">المدرب المسؤول</div><div style="font-weight:600;">${escapeHtml(sch.coach || 'كابتن الأكاديمية')}</div></div></div>
    </div>`).join("");
}

// ============================================================
// MATCHES — scoreboard UI
// ============================================================
function renderMatches(upcoming, results) {
  const upPanel = document.getElementById("matches-upcoming-panel");
  const resPanel = document.getElementById("matches-results-panel");

  if (upPanel) {
    if (!upcoming.length) {
      upPanel.innerHTML = emptyState("📅", "لا توجد مباريات قادمة مجدولة", "ترقبوا إعلان المباريات القادمة قريباً.");
    } else {
      // sort by date ascending
      const sorted = [...upcoming].sort((a, b) => new Date(a.date) - new Date(b.date));
      upPanel.innerHTML = sorted.map(m => `
        <div class="match-card">
          <div class="match-header">
            <span>🏆 ${escapeHtml(m.tournament || 'بطولة رسمية')}</span>
            <span class="champ-badge">${escapeHtml(m.category || 'فئة الناشئين')}</span>
          </div>
          <div class="scoreboard">
            <div class="team-block">
              <div class="team-crest home">🦅</div>
              <div class="team-name">أكاديمية الأحمدية</div>
              <div class="team-side">المضيف</div>
            </div>
            <div class="match-scoreboard-time">${escapeHtml(m.time || '')}<br><span style="font-size:0.7rem;color:var(--text-muted);">vs</span></div>
            <div class="team-block">
              <div class="team-crest">⚽</div>
              <div class="team-name">${escapeHtml(m.opponent)}</div>
              <div class="team-side">الضيف</div>
            </div>
          </div>
          <div class="match-footer">
            <div><span>📍 الملعب:</span> <strong>${escapeHtml(m.stadium || 'ملعب الأحمدية')}</strong></div>
            <div><span>🕒 الموعد:</span> <strong style="color:var(--gold-light);">${formatDate(m.date)} - ${escapeHtml(m.time)}</strong></div>
          </div>
        </div>`).join("");
    }
  }

  if (resPanel) {
    if (!results.length) {
      resPanel.innerHTML = emptyState("⚽", "لم يتم تسجيل نتائج مباريات مؤخراً", "ستظهر النتائج فور تسجيلها من لوحة التحكم.");
    } else {
      const sorted = [...results].sort((a, b) => new Date(b.date) - new Date(a.date));
      resPanel.innerHTML = sorted.map(r => {
        const isWin = r.result === "win" || r.scoreOur > r.scoreOpponent;
        const isDraw = r.result === "draw" || (r.scoreOur === r.scoreOpponent && r.result !== "win" && r.result !== "loss");
        const badgeClass = isWin ? "badge-win" : (isDraw ? "badge-draw" : "badge-loss");
        const badgeText = isWin ? "فوز الأحمدية 🥇" : (isDraw ? "تعادل 🤝" : "خسارة");
        return `
          <div class="match-card">
            <div class="match-header">
              <span>🏆 ${escapeHtml(r.tournament || 'مباراة رسمية')} — ${escapeHtml(r.category || '')}</span>
              <span class="${badgeClass}">${badgeText}</span>
            </div>
            <div class="scoreboard">
              <div class="team-block">
                <div class="team-crest home">🦅</div>
                <div class="team-name">أكاديمية الأحمدية</div>
              </div>
              <div class="match-score-badge">${r.scoreOur} - ${r.scoreOpponent}</div>
              <div class="team-block">
                <div class="team-crest">⚽</div>
                <div class="team-name">${escapeHtml(r.opponent)}</div>
              </div>
            </div>
            <div class="match-footer">
              <div><span>⚽ مسجلو الأهداف:</span> <strong style="color:var(--gold-light);">${escapeHtml(r.scorers || 'عمل جماعي متميز')}</strong></div>
              <div><span>📅 التاريخ:</span> ${formatDate(r.date)}</div>
            </div>
            ${r.matchReport ? `<div class="match-report"><strong style="color:var(--gold-light);">📄 تقرير المباراة:</strong> ${escapeHtml(r.matchReport)}</div>` : ''}
          </div>`;
      }).join("");
    }
  }
}

function formatDate(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}

// ============================================================
// PLAYERS DIRECTORY — search + filter + detail modal
// ============================================================
// ============================================================
// CINEMATIC PLAYERS CAROUSEL — images/players/0.png ... 27.png
// ============================================================
let playersCarouselIndex = 0;
let playersCarouselTimer = null;
let playersCarouselPaused = false;
let playersCarouselTouchStartX = 0;
let playersCarouselBound = false;

function renderPlayers() {
  const track = document.getElementById("players-carousel-track");
  const root = document.getElementById("players-carousel");
  if (!track || !root) return;

  const slides = Array.from({ length: 28 }, (_, index) => {
    const src = `./images/players/${index}.png`;
    const isCoach = index === 0;
    return `
      <button class="players-carousel-slide" type="button"
        data-slide-index="${index}" aria-label="${isCoach ? "المدرب الفني" : `اللاعب رقم ${index}`}" tabindex="-1">
        <span class="players-carousel-image-frame">
          <img src="${src}" alt="${isCoach ? "المدربة" : `اللاعب رقم ${index}`}"
            loading="${index === 0 || index === 1 || index === 27 ? "eager" : "lazy"}" decoding="async" draggable="false"
            onerror="this.closest('.players-carousel-slide').classList.add('image-missing')">
        </span>
        <span class="players-carousel-slide-number">${isCoach ? "المدرب الفني" : String(index).padStart(2, "0")}</span>
      </button>`;
  });
  track.innerHTML = slides.join("");
  playersCarouselIndex = 0;
  updatePlayersCarousel();
  setupPlayersCarouselControls();
  startPlayersCarousel();
}

function updatePlayersCarousel() {
  const track = document.getElementById("players-carousel-track");
  const counter = document.getElementById("players-carousel-counter");
  const dots = document.getElementById("players-carousel-dots");
  if (!track) return;

  const slides = [...track.querySelectorAll(".players-carousel-slide")];
  const total = slides.length;
  if (!total) return;

  slides.forEach((slide, index) => {
    let offset = index - playersCarouselIndex;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    slide.className = "players-carousel-slide";
    slide.dataset.position = String(offset);
    slide.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
    slide.tabIndex = offset === 0 ? 0 : -1;
    if (offset === 0) slide.classList.add("is-active");
    else if (Math.abs(offset) === 1) slide.classList.add(offset < 0 ? "is-prev" : "is-next");
    else if (Math.abs(offset) === 2) slide.classList.add("is-far");
    else slide.classList.add("is-hidden");
  });

  if (counter) counter.textContent = `${String(playersCarouselIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  if (dots) {
    if (!dots.children.length) {
      dots.innerHTML = slides.map((_, i) =>
        `<button type="button" class="players-carousel-dot" data-go-to="${i}" aria-label="الصورة ${i + 1}"></button>`
      ).join("");
      dots.querySelectorAll("[data-go-to]").forEach(dot => {
        dot.addEventListener("click", () => {
          playersCarouselIndex = Number(dot.dataset.goTo);
          updatePlayersCarousel();
          restartPlayersCarousel();
        });
      });
    }
    dots.querySelectorAll(".players-carousel-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === playersCarouselIndex);
      dot.setAttribute("aria-current", i === playersCarouselIndex ? "true" : "false");
    });
  }
}

function movePlayersCarousel(direction) {
  const total = document.querySelectorAll("#players-carousel-track .players-carousel-slide").length;
  if (!total) return;
  playersCarouselIndex = (playersCarouselIndex + direction + total) % total;
  updatePlayersCarousel();
}

function startPlayersCarousel() {
  stopPlayersCarousel();
  if (playersCarouselPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  playersCarouselTimer = window.setInterval(() => movePlayersCarousel(1), 5000);
}

function stopPlayersCarousel() {
  if (playersCarouselTimer) {
    window.clearInterval(playersCarouselTimer);
    playersCarouselTimer = null;
  }
}

function restartPlayersCarousel() {
  stopPlayersCarousel();
  startPlayersCarousel();
}

function setupPlayersCarouselControls() {
  const root = document.getElementById("players-carousel");
  if (!root || playersCarouselBound) return;
  playersCarouselBound = true;

  root.querySelector(".players-carousel-prev")?.addEventListener("click", () => {
    movePlayersCarousel(-1);
    restartPlayersCarousel();
  });
  root.querySelector(".players-carousel-next")?.addEventListener("click", () => {
    movePlayersCarousel(1);
    restartPlayersCarousel();
  });

  const pause = document.getElementById("players-carousel-pause");
  pause?.addEventListener("click", () => {
    playersCarouselPaused = !playersCarouselPaused;
    pause.setAttribute("aria-pressed", String(playersCarouselPaused));
    pause.innerHTML = playersCarouselPaused ? "▶ تشغيل" : "Ⅱ إيقاف";
    if (playersCarouselPaused) stopPlayersCarousel();
    else startPlayersCarousel();
  });

  root.addEventListener("mouseenter", stopPlayersCarousel);
  root.addEventListener("mouseleave", startPlayersCarousel);
  root.addEventListener("focusin", stopPlayersCarousel);
  root.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!root.contains(document.activeElement)) startPlayersCarousel();
    }, 0);
  });

  root.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); movePlayersCarousel(1); restartPlayersCarousel(); }
    if (event.key === "ArrowRight") { event.preventDefault(); movePlayersCarousel(-1); restartPlayersCarousel(); }
  });

  root.addEventListener("touchstart", event => {
    playersCarouselTouchStartX = event.changedTouches[0].clientX;
    stopPlayersCarousel();
  }, { passive: true });
  root.addEventListener("touchend", event => {
    const delta = event.changedTouches[0].clientX - playersCarouselTouchStartX;
    if (Math.abs(delta) > 45) movePlayersCarousel(delta < 0 ? 1 : -1);
    startPlayersCarousel();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPlayersCarousel();
    else startPlayersCarousel();
  });
}

function openPlayerDetail(playerId) {
  const player = (academyData.players || []).find(p => String(p.id) === String(playerId));
  if (!player) return;
  const overlay = document.getElementById("player-detail-overlay");
  const card = document.getElementById("player-detail-card");
  if (!overlay || !card) return;

  const achievements = (Array.isArray(player.achievements) ? player.achievements : []).filter(Boolean);
  const statusText = player.registrationStatus === "pending" ? "قيد التسجيل" : "لاعب مسجل";
  const statusClass = player.registrationStatus === "pending" ? "pending" : "approved";

  card.innerHTML = `
    <div class="modal-header-flex">
      <h3 id="player-detail-title">ملف اللاعب</h3>
      <button type="button" class="btn-close-modal" id="btn-close-player-detail" aria-label="إغلاق">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:20px;">
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
        <img src="${player.photo || './images/logo.jpg'}" alt="${escapeHtml(player.name)}" style="width:110px;height:110px;border-radius:18px;object-fit:cover;border:3px solid var(--gold-primary);box-shadow:var(--gold-glow);" onerror="this.src='./images/logo.jpg'">
        <div style="flex:1;min-width:180px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="background:var(--gold-gradient);color:#08110c;font-weight:900;padding:3px 12px;border-radius:10px;font-size:0.85rem;">#${player.number || 10}</span>
            <span class="badge-status ${statusClass}">${statusText}</span>
          </div>
          <h2 style="font-size:1.5rem;font-weight:800;color:var(--text-white);margin-bottom:4px;">${escapeHtml(player.name)}</h2>
          <p style="color:var(--gold-light);font-weight:700;">${escapeHtml(player.position || 'لاعب')}</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">${escapeHtml(player.category || '')}</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
        <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border-gold);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:0.74rem;color:var(--text-muted);">تاريخ الميلاد</div>
          <div style="font-weight:700;color:var(--gold-light);margin-top:4px;">${player.birthDate ? formatDate(player.birthDate) : '—'}</div>
        </div>
        <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border-gold);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:0.74rem;color:var(--text-muted);">العمر</div>
          <div style="font-weight:700;color:var(--gold-light);margin-top:4px;">${player.age || 12} سنة</div>
        </div>
        <div style="background:rgba(0,0,0,0.3);border:1px solid var(--border-gold);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:0.74rem;color:var(--text-muted);">القدم المفضلة</div>
          <div style="font-weight:700;color:var(--gold-light);margin-top:4px;">${escapeHtml(player.foot || 'اليمنى')}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div style="background:var(--gold-gradient);color:#08110c;border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;">${player.goals || 0}</div>
          <div style="font-size:0.72rem;font-weight:700;">أهداف</div>
        </div>
        <div style="background:rgba(183,243,74,0.12);border:1px solid var(--border-gold);border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;color:var(--gold-light);">${player.assists || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">تمريرات</div>
        </div>
        <div style="background:rgba(183,243,74,0.12);border:1px solid var(--border-gold);border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;color:var(--gold-light);">${player.matches || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">مباريات</div>
        </div>
        <div style="background:rgba(183,243,74,0.12);border:1px solid var(--border-gold);border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:1.4rem;font-weight:900;color:var(--gold-light);">${player.cleanSheets || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">شباك نظيفة</div>
        </div>
      </div>

      ${achievements.length ? `
        <div>
          <h4 style="color:var(--gold-light);font-size:0.95rem;margin-bottom:10px;">🏆 الإنجازات</h4>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:8px;">
            ${achievements.map(a => `<li style="display:flex;align-items:center;gap:10px;background:rgba(232,185,74,0.08);border:1px solid var(--border-champ);padding:9px 14px;border-radius:10px;font-size:0.88rem;color:var(--text-white);"><span style="color:var(--champ-light);">🏅</span> ${escapeHtml(a)}</li>`).join("")}
          </ul>
        </div>` : ""}

      ${player.performance ? `
        <div>
          <h4 style="color:var(--gold-light);font-size:0.95rem;margin-bottom:8px;">📊 الأداء والملاحظات</h4>
          <p style="color:var(--text-muted);font-size:0.9rem;line-height:1.8;background:rgba(0,0,0,0.3);padding:14px;border-radius:10px;border-right:3px solid var(--gold-primary);">${escapeHtml(player.performance)}</p>
        </div>` : ""}
    </div>`;

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  const closeBtn = document.getElementById("btn-close-player-detail");
  if (closeBtn) closeBtn.addEventListener("click", closePlayerDetail);
}

function closePlayerDetail() {
  const overlay = document.getElementById("player-detail-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function setupPlayerDetailClose() {
  const overlay = document.getElementById("player-detail-overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePlayerDetail();
    });
  }
}

// ============================================================
// NEWS
// ============================================================
function renderNews(newsList) {
  const c = document.getElementById("news-container");
  if (!c) return;
  if (!newsList.length) {
    c.innerHTML = emptyState("📰", "لا توجد أخبار منشورة حالياً", "ستظهر آخر أخبار الأكاديمية فور نشرها.");
    return;
  }
  const sorted = [...newsList].sort((a, b) => new Date(b.date) - new Date(a.date));
  c.innerHTML = sorted.map(news => `
    <article class="news-card">
      <div class="news-img-wrap">
        <img src="${news.image || './images/logo.jpg'}" alt="${escapeHtml(news.title)}" class="news-img" loading="lazy" onerror="this.src='./images/logo.jpg'">
        <span class="news-cat-tag">${escapeHtml(news.category || 'أخبار')}</span>
      </div>
      <div class="news-body">
        <div class="news-meta">
          <span>🏷️ ${escapeHtml(news.category || 'أخبار عامة')}</span>
          <span>📅 ${formatDate(news.date)}</span>
        </div>
        <h3 class="news-title">${escapeHtml(news.title)}</h3>
        <p class="news-excerpt">${escapeHtml(news.summary || news.content || '')}</p>
        <a href="./article.html?id=${encodeURIComponent(news.id)}" class="news-read-more">قراءة الخبر كاملاً ←</a>
      </div>
    </article>`).join("");
}

// ============================================================
// REGISTRATION FORM
// ============================================================
function setupRegistrationForm() {
  const form = document.getElementById("player-reg-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const playerName = document.getElementById("reg-player-name").value.trim();
    const birthDate = document.getElementById("reg-birth-date").value;
    const parentName = document.getElementById("reg-parent-name").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const position = document.getElementById("reg-position").value;
    const foot = document.getElementById("reg-foot").value;
    const address = document.getElementById("reg-address").value.trim();
    const healthNotes = document.getElementById("reg-notes").value.trim();

    if (!playerName || !birthDate || !parentName || !phone) {
      showToast("يرجى ملء جميع الحقول المطلوبة الإلزامية", "error");
      return;
    }
    if (!/^01[0-2,5][0-9]{8}$/.test(phone)) {
      showToast("رقم الهاتف غير صحيح. يجب أن يكون رقم موبايل مصري صالح (11 رقم يبدأ بـ 01)", "error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>⏳</span> جاري الإرسال...'; }

    try {
      await submitRegistrationRequest({
        playerName, birthDate, parentName, phone,
        preferredPosition: position, preferredFoot: foot,
        address, healthNotes
      });
      triggerConfetti();
      form.reset();

      const waMsg = encodeURIComponent(`السلام عليكم، قمت بتسجيل طلب انضمام جديد للاعب: ${playerName} (مواليد ${birthDate}) في أكاديمية مركز شباب الأحمدية. رقم الهاتف: ${phone}. نرجو إفادتنا بموعد الاختبار.`);
      const waNumber = (academyData?.settings?.whatsapp) || "201227506392";
      const waUrl = `https://wa.me/${waNumber}?text=${waMsg}`;

      showToast("تم إرسال الطلب بنجاح! سيتواصل معكم الكابتن قريباً.", "success");
      setTimeout(() => {
        if (confirm(`🎉 تم إرسال طلب التقديم للاعب (${playerName}) بنجاح!\n\nهل ترغب في فتح محادثة واتساب فورية مع إدارة الأكاديمية لتأكيد موعد الاختبار الميداني؟`)) {
          window.open(waUrl, "_blank");
        }
      }, 600);
    } catch (err) {
      console.error("[Academia] submission failed:", err);
      showToast("حدث خطأ أثناء إرسال الطلب، تم الحفظ محلياً.", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>🚀</span> إرسال طلب التقديم الآن'; }
    }
  });
}

// ============================================================
// SCROLL REVEAL + SCROLL SPY + HEADER
// ============================================================
function setupScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach(el => el.classList.add("in-view"));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in-view"); obs.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => obs.observe(el));
}

function setupScrollSpy() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-links .nav-link, .mobile-bottom-nav .mobile-nav-item");
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      let current = "";
      const y = window.pageYOffset;
      sections.forEach(section => {
        const top = section.offsetTop - 140;
        if (y >= top) current = section.getAttribute("id");
      });
      navLinks.forEach(link => {
        link.classList.remove("active");
        const href = link.getAttribute("href");
        if (href === `#${current}` || (current === "" && href === "#home")) link.classList.add("active");
      });
      ticking = false;
    });
  }, { passive: true });
}

function setupHeaderScroll() {
  const header = document.getElementById("main-header");
  if (!header) return;
  window.addEventListener("scroll", () => {
    if (window.pageYOffset > 20) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }, { passive: true });
}

// ============================================================
// PWA
// ============================================================
function initPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .then(reg => {
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn("[Academia] SW registration error:", err));
    });
  }

  const installBtn = document.getElementById("pwa-install-btn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = "inline-flex";
  });
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) {
        showToast("التطبيق مثبت بالفعل أو يمكن تثبيته من قائمة المتصفح", "info");
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") showToast("تم تثبيت التطبيق بنجاح 📲", "success");
      deferredPrompt = null;
      installBtn.style.display = "none";
    });
  }

  const refreshBtn = document.getElementById("btn-refresh-update");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      }
      window.location.reload();
    });
  }
}

function showUpdateBanner() {
  const banner = document.getElementById("update-banner");
  if (banner) banner.classList.add("show");
}

// ============================================================
// UTILITIES
// ============================================================
function showToast(message, type = "") {
  const existing = document.querySelector(".toast-msg");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast-msg show" + (type ? " " + type : "");
  toast.innerHTML = `<span>🔔</span> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

function triggerConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 110, spread: 72, origin: { y: 0.6 },
      colors: ["#b7f34a", "#d7ff8a", "#ffffff", "#e8b94a", "#f5d27a"]
    });
  }
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(desc)}</p></div>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
