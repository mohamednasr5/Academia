// News Article Page Controller
import { getAllData } from "./data-service.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");

  try {
    const data = await getAllData();
    const newsList = data.news || [];
    
    // Find matching article or default to first
    let article = newsList.find(n => String(n.id) === String(articleId));
    if (!article && newsList.length > 0) {
      article = newsList[0];
    }

    if (!article) {
      document.getElementById("article-content-container").innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
          <h2 style="color: var(--gold-light); margin-bottom: 15px;">لم يتم العثور على هذا الخبر</h2>
          <p style="color: var(--text-muted); margin-bottom: 25px;">ربما تم تعديل الخبر أو حذفه مؤخراً.</p>
          <a href="./index.html#news" class="btn-gold">← العودة لقائمة الأخبار</a>
        </div>
      `;
      return;
    }

    renderArticle(article);
    renderRelatedNews(newsList, article.id);

  } catch (err) {
    console.error("Error loading article:", err);
  }
});

function renderArticle(item) {
  document.title = `${item.title} | أكاديمية مركز شباب الأحمدية`;

  const container = document.getElementById("article-content-container");
  if (!container) return;

  const currentUrl = encodeURIComponent(window.location.href);
  const shareText = encodeURIComponent(`اقرأ خبر: ${item.title} - أكاديمية مركز شباب الأحمدية: `);

  const fullText = item.content || item.summary || "";
  const paragraphs = fullText.split("\n").filter(p => p.trim().length > 0);
  const bodyHtml = paragraphs.map(p => `<p style="margin-bottom: 18px;">${escapeHtml(p)}</p>`).join("");

  container.innerHTML = `
    <!-- Category & Date Bar -->
    <div class="article-meta-bar">
      <span class="gold-badge">🏷️ ${escapeHtml(item.category || 'أخبار الأكاديمية')}</span>
      <span>📅 تاريخ النشر: <strong>${escapeHtml(item.date || '')}</strong></span>
      <span>✍️ المركز الإعلامي للأكاديمية</span>
    </div>

    <!-- Title -->
    <h1 class="article-title-main">${escapeHtml(item.title)}</h1>

    <!-- Image -->
    <img src="${item.image || './images/logo.jpg'}" alt="${escapeHtml(item.title)}" class="article-cover-img" onerror="this.src='./images/logo.jpg'">

    <!-- Article Content -->
    <div class="article-body-text">
      ${bodyHtml}
    </div>

    <!-- Share Bar -->
    <div class="article-share-bar">
      <span style="font-weight: 700; color: var(--gold-light);">📤 مشاركة هذا الخبر:</span>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="https://wa.me/?text=${shareText}${currentUrl}" target="_blank" class="share-btn share-wa">
          <span>💬</span> واتساب
        </a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${currentUrl}" target="_blank" class="share-btn share-fb">
          <span>📘</span> فيسبوك
        </a>
        <button type="button" class="share-btn share-copy" id="btn-copy-art-link">
          <span>🔗</span> نسخ الرابط
        </button>
      </div>
    </div>
  `;

  const copyBtn = document.getElementById("btn-copy-art-link");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert("✅ تم نسخ رابط الخبر بنجاح! يمكنك الآن مشاركته."))
        .catch(() => alert("رابط الخبر: " + window.location.href));
    });
  }
}

function renderRelatedNews(allNews, currentId) {
  const container = document.getElementById("related-news-container");
  if (!container) return;

  const others = allNews.filter(n => String(n.id) !== String(currentId)).slice(0, 3);
  if (others.length === 0) {
    container.parentElement.style.display = "none";
    return;
  }

  container.innerHTML = others.map(news => `
    <div class="news-card">
      <img src="${news.image || './images/logo.jpg'}" alt="${escapeHtml(news.title)}" class="news-img" onerror="this.src='./images/logo.jpg'">
      <div class="news-body">
        <div class="news-meta">
          <span>🏷️ ${escapeHtml(news.category || 'أخبار')}</span>
          <span>📅 ${escapeHtml(news.date)}</span>
        </div>
        <h3 class="news-title" style="font-size: 1.05rem;">${escapeHtml(news.title)}</h3>
        <p class="news-excerpt" style="font-size: 0.85rem;">${escapeHtml(news.summary || news.content)}</p>
        <div>
          <a href="./article.html?id=${news.id}" class="btn-outline-gold" style="padding: 6px 14px; font-size: 0.85rem; text-decoration: none;">
            قراءة الخبر الكامل ←
          </a>
        </div>
      </div>
    </div>
  `).join("");
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
