// Academia Al-Ahmadia - Main Website Application Logic
import { getAllData, submitRegistrationRequest } from "./data-service.js";

// Global state
let academyData = null;
let countdownInterval = null;
let deferredPrompt = null;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", async () => {
  initPWA();
  await loadAndRenderAll();
  setupRegistrationForm();
  setupPlayersFilter();
  setupScrollSpy();

  // Real-time synchronization when admin adds/edits/deletes data
  window.addEventListener("storage", async () => {
    await loadAndRenderAll();
  });
});

// ==================== 1. PWA REGISTRATION & INSTALL ====================
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('Service Worker Registered successfully:', reg.scope))
        .catch((err) => console.warn('Service Worker Registration error:', err));
    });
  }

  const installBtn = document.getElementById('pwa-install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        showToast("التطبيق مثبت بالفعل أو متصفحك يتيح التثبيت من قائمة الخيارات");
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }
}

// ==================== 2. LOAD & RENDER DATA ====================
async function loadAndRenderAll() {
  try {
    academyData = await getAllData();
    renderTicker(academyData.tickerNews || []);
    renderStats(academyData);
    renderPlayerOfTheDay(academyData.playerOfTheDay);
    renderCoaches(academyData.coaches || []);
    renderTrophies(academyData.trophies || []);
    renderSchedules(academyData.schedules || []);
    renderMatches(academyData.upcomingMatches || [], academyData.matchResults || []);
    renderPlayers(academyData.players || []);
    renderNews(academyData.news || []);
  } catch (error) {
    console.error("Error loading academy data:", error);
  }
}

// ==================== 3. TICKER (شريط الأخبار المتحرك) ====================
function renderTicker(items) {
  const container = document.getElementById('ticker-news-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = '<span class="ticker-item">أهلاً بكم في أكاديمية مركز شباب الأحمدية لكرة القدم</span>';
    return;
  }

  const html = items.map(text => `
    <span class="ticker-item">
      <span class="ticker-bullet">★</span>
      <span>${escapeHtml(text)}</span>
    </span>
  `).join('');

  // Repeat twice for seamless infinite scrolling
  container.innerHTML = html + html;
}

// ==================== 4. STATS COUNTER ====================
function renderStats(data) {
  const pCount = document.getElementById('stat-players-count');
  const tCount = document.getElementById('stat-trophies-count');
  const cCount = document.getElementById('stat-coaches-count');

  if (pCount) pCount.innerText = (data.players || []).length + "+";
  if (tCount) tCount.innerText = (data.trophies || []).length;
  if (cCount) cCount.innerText = (data.coaches || []).length;
}

// ==================== 5. PLAYER OF THE DAY (رجل اليوم) ====================
function renderPlayerOfTheDay(potd) {
  const container = document.getElementById('potd-container');
  if (!container) return;

  if (countdownInterval) clearInterval(countdownInterval);

  if (!potd || !potd.active) {
    container.innerHTML = `
      <div class="potd-card" style="text-align: center; padding: 40px 20px;">
        <h3 style="color: var(--gold-light); margin-bottom: 10px;">🌟 لوحة الشرف اليومية</h3>
        <p style="color: var(--text-muted); max-width: 600px; margin: 0 auto;">
          يتم اختيار رجل اليوم من قبل الجهاز الفني للأكاديمية وتجديده كل 24 ساعة وفقاً للأداء الاستثنائي والانضباط في التدريبات والمباريات. ترقبوا الإعلان عن نجم الجولة القادمة!
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="potd-card">
      <div class="potd-grid">
        <!-- Player Photo -->
        <div class="potd-photo-wrap">
          <div class="potd-crown">👑</div>
          <img src="${potd.playerPhoto || './images/logo.jpg'}" alt="${escapeHtml(potd.playerName)}" class="potd-photo" onerror="this.src='./images/logo.jpg'">
          <div style="margin-top: 12px;">
            <button id="btn-cheer-potd" class="btn-gold" style="padding: 6px 16px; font-size: 0.85rem; border-radius: 20px;">
              <span>👏</span> شجّع نجم اليوم
            </button>
          </div>
        </div>

        <!-- Player Details -->
        <div class="potd-info">
          <h3>${escapeHtml(potd.playerName)}</h3>
          <div class="potd-meta">
            <span class="gold-badge">⚽ المركز: ${escapeHtml(potd.playerPosition || 'لاعب')}</span>
            <span class="gold-badge">🎂 السن: ${potd.playerAge || 12} سنة</span>
            <span class="gold-badge">⭐ التقييم: ${potd.rating || 9.8} / 10</span>
          </div>
          <div class="potd-reason">
            <strong>سبب الاختيار والتكريم:</strong>
            <p style="margin-top: 5px;">${escapeHtml(potd.reason || 'الأداء المتميز في التدريبات والمباريات.')}</p>
          </div>
        </div>

        <!-- 24-Hour Countdown Box -->
        <div class="potd-timer-box">
          <div class="potd-timer-title">⏳ متبقي على نهاية التتويج:</div>
          <div class="potd-countdown">
            <div class="countdown-unit">
              <div class="countdown-num" id="potd-hours">24</div>
              <div class="countdown-lbl">ساعة</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-num" id="potd-mins">00</div>
              <div class="countdown-lbl">دقيقة</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-num" id="potd-secs">00</div>
              <div class="countdown-lbl">ثانية</div>
            </div>
          </div>
          <div style="margin-top: 12px; font-size: 0.75rem; color: var(--gold-light);">
            تجديد تلقائي كل 24 ساعة 🕒
          </div>
        </div>
      </div>
    </div>
  `;

  // Start Countdown
  startPotdCountdown(potd.expiresAt);

  // Cheer button with confetti
  const cheerBtn = document.getElementById('btn-cheer-potd');
  if (cheerBtn) {
    cheerBtn.addEventListener('click', () => {
      triggerConfetti();
      showToast(`🎉 شكراً لتشجيعك النجم ${potd.playerName}!`);
    });
  }
}

function startPotdCountdown(expiresAtStr) {
  const targetTime = new Date(expiresAtStr).getTime();

  function update() {
    const now = new Date().getTime();
    const distance = targetTime - now;

    if (distance <= 0) {
      if (countdownInterval) clearInterval(countdownInterval);
      const hEl = document.getElementById('potd-hours');
      const mEl = document.getElementById('potd-mins');
      const sEl = document.getElementById('potd-secs');
      if (hEl) hEl.innerText = "00";
      if (mEl) mEl.innerText = "00";
      if (sEl) sEl.innerText = "00";
      return;
    }

    const hours = Math.floor(distance / (1000 * 60 * 60));
    const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((distance % (1000 * 60)) / 1000);

    const hEl = document.getElementById('potd-hours');
    const mEl = document.getElementById('potd-mins');
    const sEl = document.getElementById('potd-secs');

    if (hEl) hEl.innerText = String(hours).padStart(2, '0');
    if (mEl) mEl.innerText = String(mins).padStart(2, '0');
    if (sEl) sEl.innerText = String(secs).padStart(2, '0');
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

// ==================== 6. COACHES SECTION (الجهاز الفني) ====================
function formatCoachBio(bioText) {
  if (!bioText || !bioText.trim()) {
    return `
      <div class="coach-bio-box">
        <div class="coach-bio-title"><span>📋</span> السيرة الذاتية والمسيرة الرياضية:</div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">مدرب معتمد ذو خبرة رياضية متميزة.</p>
      </div>
    `;
  }

  // Split by newlines, dashes, bullets, or semicolons
  let rawItems = [];
  if (bioText.includes('\n')) {
    rawItems = bioText.split('\n');
  } else if (bioText.includes('-')) {
    rawItems = bioText.split('-');
  } else if (bioText.includes('•')) {
    rawItems = bioText.split('•');
  } else {
    rawItems = bioText.split(/[\r\n]+/);
  }

  // Clean and filter each line
  const cleanedItems = rawItems
    .map(item => item.replace(/^[\s\-\•\*\d\.\)\:]+/, '').trim())
    .filter(item => item.length > 0);

  if (cleanedItems.length === 0) {
    cleanedItems.push(bioText.trim());
  }

  const listItemsHtml = cleanedItems.map((item, index) => `
    <li class="coach-bio-item">
      <span class="bio-num-badge">${index + 1}</span>
      <span class="bio-text">${escapeHtml(item)}</span>
    </li>
  `).join('');

  return `
    <div class="coach-bio-box">
      <div class="coach-bio-title"><span>📋</span> السيرة الذاتية والمسيرة الرياضية:</div>
      <ol class="coach-bio-list">
        ${listItemsHtml}
      </ol>
    </div>
  `;
}

function renderCoaches(coaches) {
  const container = document.getElementById('coaches-container');
  if (!container) return;

  if (coaches.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: 1/-1;">لا يوجد مدربين مسجلين حالياً.</div>';
    return;
  }

  container.innerHTML = coaches.map(coach => `
    <div class="coach-card">
      <div class="coach-header">
        <div class="coach-avatar-wrap">
          <img src="${coach.photo || './images/logo.jpg'}" alt="${escapeHtml(coach.name)}" class="coach-avatar" onerror="this.src='./images/logo.jpg'">
          <div class="coach-role-badge">${escapeHtml(coach.role || 'مدرب معتمد')}</div>
        </div>
      </div>
      <div class="coach-body">
        <h3 class="coach-name">${escapeHtml(coach.name)}</h3>
        <div class="coach-meta-row">
          <span>🎂 السن: ${coach.age || 30} سنة</span>
          <span>•</span>
          <span>💼 الخبرة: ${escapeHtml(coach.experience || 'خبرة تدريبية متميزة')}</span>
        </div>
        ${formatCoachBio(coach.bio)}
        <div class="coach-footer">
          <div class="coach-footer-item">
            <span>📜</span>
            <span><strong>المؤهل التدريبي:</strong> ${escapeHtml(coach.license || 'رخصة تدريب رياضية معتمدة')}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== 7. TROPHY CABINET (دولاب البطولات) ====================
function renderTrophies(trophies) {
  const container = document.getElementById('trophies-container');
  if (!container) return;

  container.innerHTML = trophies.map(item => `
    <div class="trophy-card">
      <div class="trophy-icon">${item.icon || '🏆'}</div>
      <div class="trophy-year">${escapeHtml(item.year)} - ${escapeHtml(item.category || '')}</div>
      <h3 class="trophy-title">${escapeHtml(item.title)}</h3>
      <p class="trophy-desc">${escapeHtml(item.description)}</p>
      <div style="margin-top: 15px;">
        <span class="gold-badge">${escapeHtml(item.badge || 'إنجاز بطولي')}</span>
      </div>
    </div>
  `).join('');
}

// ==================== 8. SCHEDULES (مواعيد العمل والتدريب) ====================
function renderSchedules(schedules) {
  const container = document.getElementById('schedules-container');
  if (!container) return;

  container.innerHTML = schedules.map(sch => `
    <div class="schedule-card">
      <div class="schedule-cat">
        <span>⚽</span> ${escapeHtml(sch.category)}
      </div>
      <div class="schedule-detail-row">
        <div class="schedule-icon-pill">📅</div>
        <div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">أيام التدريب:</div>
          <div style="font-weight: 700;">${escapeHtml(sch.days)}</div>
        </div>
      </div>
      <div class="schedule-detail-row">
        <div class="schedule-icon-pill">🕒</div>
        <div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">التوقيت:</div>
          <div style="font-weight: 700; color: var(--gold-light);">${escapeHtml(sch.time)}</div>
        </div>
      </div>
      <div class="schedule-detail-row">
        <div class="schedule-icon-pill">🏟️</div>
        <div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">الملعب:</div>
          <div style="font-weight: 600;">${escapeHtml(sch.field)}</div>
        </div>
      </div>
      <div class="schedule-detail-row">
        <div class="schedule-icon-pill">👔</div>
        <div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">المدرب المسؤول:</div>
          <div style="font-weight: 600;">${escapeHtml(sch.coach || 'كابتن الأكاديمية')}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== 9. MATCHES & RESULTS ====================
function renderMatches(upcoming, results) {
  const upcomingPanel = document.getElementById('matches-upcoming-panel');
  const resultsPanel = document.getElementById('matches-results-panel');

  if (upcomingPanel) {
    if (upcoming.length === 0) {
      upcomingPanel.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">لا توجد مباريات قادمة مجدولة حالياً.</div>';
    } else {
      upcomingPanel.innerHTML = upcoming.map(match => `
        <div class="match-card">
          <div class="match-header">
            <span>🏆 ${escapeHtml(match.tournament || 'بطولة رسمية')}</span>
            <span class="gold-badge">${escapeHtml(match.category || 'فئة الناشئين')}</span>
          </div>
          <div class="match-teams-row">
            <div class="team-name">أكاديمية الأحمدية 🦅</div>
            <div class="match-vs-badge">ضد</div>
            <div class="team-name">${escapeHtml(match.opponent)} ⚽</div>
          </div>
          <div class="match-footer">
            <div>
              <span>📍 الملعب: </span>
              <strong>${escapeHtml(match.stadium || 'ملعب الأحمدية')}</strong>
            </div>
            <div>
              <span>🕒 الموعد: </span>
              <strong style="color: var(--gold-light);">${escapeHtml(match.date)} - الساعة ${escapeHtml(match.time)}</strong>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  if (resultsPanel) {
    if (results.length === 0) {
      resultsPanel.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">لم يتم تسجيل نتائج مباريات مؤخراً.</div>';
    } else {
      resultsPanel.innerHTML = results.map(res => {
        const isWin = res.result === 'win' || res.scoreOur > res.scoreOpponent;
        const isDraw = res.result === 'draw' || res.scoreOur === res.scoreOpponent;
        const badgeClass = isWin ? 'badge-win' : (isDraw ? 'badge-draw' : 'badge-status rejected');
        const badgeText = isWin ? 'فوز الأحمدية 🥇' : (isDraw ? 'تعادل 🤝' : 'خسارة');

        return `
          <div class="match-card">
            <div class="match-header">
              <span>🏆 ${escapeHtml(res.tournament || 'مباراة رسمية')} - ${escapeHtml(res.category || '')}</span>
              <span class="${badgeClass}">${badgeText}</span>
            </div>
            <div class="match-teams-row">
              <div class="team-name">أكاديمية الأحمدية 🦅</div>
              <div class="match-score-badge">${res.scoreOur} - ${res.scoreOpponent}</div>
              <div class="team-name">${escapeHtml(res.opponent)} ⚽</div>
            </div>
            <div class="match-footer">
              <div>
                <span>⚽ مسجلو الأهداف: </span>
                <strong style="color: var(--gold-light);">${escapeHtml(res.scorers || 'عمل جماعي متميز')}</strong>
              </div>
              <div>
                <span>📅 التاريخ: </span>
                <span>${escapeHtml(res.date)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// ==================== 10. PLAYERS ROSTER ====================
function renderPlayers(players, filter = 'all') {
  const container = document.getElementById('players-container');
  if (!container) return;

  const filtered = filter === 'all' 
    ? players 
    : players.filter(p => p.category === filter);

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; grid-column: 1/-1; color: var(--text-muted); padding: 40px;">لا يوجد لاعبين مسجلين في هذه الفئة حالياً.</div>';
    return;
  }

  container.innerHTML = filtered.map(player => `
    <div class="player-card">
      <div class="player-card-num">#${player.number || 10}</div>
      <div class="player-img-wrap">
        <img src="${player.photo || './images/logo.jpg'}" alt="${escapeHtml(player.name)}" class="player-img" onerror="this.src='./images/logo.jpg'">
      </div>
      <h4 class="player-name">${escapeHtml(player.name)}</h4>
      <div class="player-pos-badge">${escapeHtml(player.position || 'لاعب')}</div>
      <div class="player-age-badge">
        <span>🎂 ${player.age || 12} سنة</span>
        <span style="margin: 0 4px;">•</span>
        <span>القدم: ${escapeHtml(player.foot || 'اليمنى')}</span>
      </div>
    </div>
  `).join('');
}

function setupPlayersFilter() {
  const filterBtns = document.querySelectorAll('#players-filters-container .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      renderPlayers(academyData.players || [], filter);
    });
  });
}

// ==================== 11. NEWS SECTION ====================
function renderNews(newsList) {
  const container = document.getElementById('news-container');
  if (!container) return;

  container.innerHTML = newsList.map(news => `
    <div class="news-card">
      <img src="${news.image || './images/logo.jpg'}" alt="${escapeHtml(news.title)}" class="news-img" onerror="this.src='./images/logo.jpg'">
      <div class="news-body">
        <div class="news-meta">
          <span>🏷️ ${escapeHtml(news.category || 'أخبار عامة')}</span>
          <span>📅 ${escapeHtml(news.date)}</span>
        </div>
        <h3 class="news-title">${escapeHtml(news.title)}</h3>
        <p class="news-excerpt">${escapeHtml(news.summary || news.content)}</p>
        <div>
          <button class="btn-outline-gold" style="padding: 6px 14px; font-size: 0.85rem;" onclick="openNewsModal('${news.id}')">
            قراءة التفاصيل ←
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Expose news modal opener to window
  window.openNewsModal = (newsId) => {
    const item = (academyData.news || []).find(n => n.id === newsId);
    if (!item) return;

    alert(`${item.title}\n\nالتاريخ: ${item.date}\n\n${item.content || item.summary}`);
  };
}

// ==================== 12. REGISTRATION FORM SUBMISSION ====================
function setupRegistrationForm() {
  const form = document.getElementById('player-reg-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const playerName = document.getElementById('reg-player-name').value.trim();
    const birthDate = document.getElementById('reg-birth-date').value;
    const parentName = document.getElementById('reg-parent-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const position = document.getElementById('reg-position').value;
    const foot = document.getElementById('reg-foot').value;
    const address = document.getElementById('reg-address').value.trim();
    const healthNotes = document.getElementById('reg-notes').value.trim();

    if (!playerName || !birthDate || !parentName || !phone) {
      showToast("يرجى ملء جميع الحقول المطلوبة الإلزامية");
      return;
    }

    const payload = {
      playerName,
      birthDate,
      parentName,
      phone,
      preferredPosition: position,
      preferredFoot: foot,
      address,
      healthNotes
    };

    try {
      await submitRegistrationRequest(payload);
      triggerConfetti();
      form.reset();

      // Show congratulations & offer direct WhatsApp contact
      const whatsappMsg = encodeURIComponent(
        `السلام عليكم، قمت بتسجيل طلب انضمام جديد للاعب: ${playerName} (مواليد ${birthDate}) في أكاديمية مركز شباب الأحمدية. رقم الهاتف: ${phone}. نرجو إفادتنا بموعد الاختبار.`
      );
      const whatsappUrl = `https://wa.me/201000000000?text=${whatsappMsg}`;

      const userChoice = confirm(
        `🎉 تم إرسال طلب التقديم للاعب (${playerName}) بنجاح وحفظه في سجلات الأكاديمية!\n\nهل ترغب في فتح محادثة واتساب فورية مع إدارة الأكاديمية لتأكيد موعد الاختبار الميداني؟`
      );

      if (userChoice) {
        window.open(whatsappUrl, '_blank');
      }

      showToast("تم إرسال الطلب بنجاح! سيتواصل معكم الكابتن قريباً.");
    } catch (err) {
      console.error("Submission failed:", err);
      showToast("حدث خطأ أثناء إرسال الطلب، تم الحفظ محلياً.");
    }
  });
}

// ==================== 13. UTILS & SCROLLSPY ====================
function setupScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links .nav-link, .mobile-bottom-nav .mobile-nav-item');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${current}` || (current === '' && href === '#home')) {
        link.classList.add('active');
      }
    });
  });
}

function showToast(message) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-msg show';
  toast.innerHTML = `<span>🔔</span> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d4af37', '#f6e27a', '#ffffff', '#e5c358']
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
