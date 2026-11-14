// News Article Page Controller — Academia Al-Ahmadia
import { getAllData } from "./data-service.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");
  try {
    const data = await getAllData();
    const newsList = data.news || [];
    let article = newsList.find(n => String(n.id) === String(articleId));
    if (!article && newsList.length) article = newsList[0];
    if (!article) {
      document.getElementById("article-content-container").innerHTML = `
        <div style="text-align:center;padding:50px 20px;">
          <div style="font-size:3rem;margin-bottom:14px;">🔍</div>
          <h2 style="color:var(--gold-light);margin-bottom:12px;">لم يتم العثور على هذا الخبر</h2>
          <p style="color:var(--text-muted);margin-bottom:24px;">ربما تم تعديل الخبر أو حذفه مؤخراً.</p>
          <a href="./index.html#news" class="btn-gold">← العودة لقائمة الأخبار</a>
        </div>`;
      return;
    }
    renderArticle(article);
    renderRelatedNews(newsList, article.id);
    injectArticleStructuredData(article);
  } catch (err) {
    console.error("[Academia] article load error:", err);
  }
});

function formatDate(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}

function renderArticle(item) {
  document.title = `${item.title} | أكاديمية مركز شباب الأحمدية`;
  const container = document.getElementById("article-content-container");
  if (!container) return;

  const currentUrl = encodeURIComponent(window.location.href);
  const shareText = encodeURIComponent(`اقرأ خبر: ${item.title} — أكاديمية مركز شباب الأحمدية: `);
  const paragraphs = (item.content || item.summary || "").split("\n").filter(p => p.trim());
  const bodyHtml = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join("");

  container.innerHTML = `
    <div class="article-meta-bar">
      <span class="gold-badge">🏷️ ${escapeHtml(item.category || 'أخبار الأكاديمية')}</span>
      <span>📅 ${formatDate(item.date)}</span>
      <span>✍️ المركز الإعلامي للأكاديمية</span>
    </div>
    <h1 class="article-title-main">${escapeHtml(item.title)}</h1>
    <img src="${item.image || './images/logo.jpg'}" alt="${escapeHtml(item.title)}" class="article-cover-img" onerror="this.src='./images/logo.jpg'">
    <div class="article-body-text">${bodyHtml}</div>
    <div class="article-share-bar">
      <span style="font-weight:700;color:var(--gold-light);">📤 مشاركة هذا الخبر:</span>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="https://wa.me/?text=${shareText}${currentUrl}" target="_blank" class="share-btn share-wa"><span>💬</span> واتساب</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${currentUrl}" target="_blank" class="share-btn share-fb"><span>📘</span> فيسبوك</a>
        <button type="button" class="share-btn share-copy" id="btn-copy-art-link"><span>🔗</span> نسخ الرابط</button>
      </div>
    </div>`;

  const copyBtn = document.getElementById("btn-copy-art-link");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert("✅ تم نسخ رابط الخبر بنجاح!"))
        .catch(() => alert("رابط الخبر: " + window.location.href));
    });
  }
}

function renderRelatedNews(allNews, currentId) {
  const container = document.getElementById("related-news-container");
  if (!container) return;
  const others = allNews.filter(n => String(n.id) !== String(currentId)).slice(0, 3);
  if (!others.length) { container.parentElement.style.display = "none"; return; }
  container.innerHTML = others.map(news => `
    <article class="news-card">
      <div class="news-img-wrap">
        <img src="${news.image || './images/logo.jpg'}" alt="${escapeHtml(news.title)}" class="news-img" loading="lazy" onerror="this.src='./images/logo.jpg'">
        <span class="news-cat-tag">${escapeHtml(news.category || 'أخبار')}</span>
      </div>
      <div class="news-body">
        <div class="news-meta"><span>🏷️ ${escapeHtml(news.category || 'أخبار')}</span><span>📅 ${formatDate(news.date)}</span></div>
        <h3 class="news-title" style="font-size:1.05rem;">${escapeHtml(news.title)}</h3>
        <p class="news-excerpt" style="font-size:0.85rem;">${escapeHtml(news.summary || news.content || '')}</p>
        <a href="./article.html?id=${encodeURIComponent(news.id)}" class="news-read-more">قراءة الخبر الكامل ←</a>
      </div>
    </article>`).join("");
}

function injectArticleStructuredData(item) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": item.title,
    "datePublished": item.date,
    "articleSection": item.category || "أخبار",
    "image": item.image || "./images/logo.jpg",
    "author": { "@type": "Organization", "name": "أكاديمية مركز شباب الأحمدية" },
    "publisher": { "@type": "Organization", "name": "أكاديمية مركز شباب الأحمدية" }
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
