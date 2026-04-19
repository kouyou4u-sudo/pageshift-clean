const BOOK_FIELDS = [
  "key",
  "title",
  "author_name",
  "cover_i",
  "first_publish_year",
  "edition_count",
].join(",");

const BOOK_LIMIT = 6;
const REQUEST_TIMEOUT = 10000;
const CACHE_TTL = 1000 * 60 * 30;
const MOBILE_BREAKPOINT = 900;
const CACHE_KEY_PREFIX = "pageshift-cache:";

const CATEGORY_CONFIG = {
  business: {
    query: "business management leadership",
    heading: "ビジネス書",
    summary:
      "ビジネス書の取得に失敗しました。時間をおいて再読み込みするか、Open Library で直接探してみてください。",
  },
  study: {
    query: "\"study guide\" textbook learning",
    heading: "学習参考書",
    summary:
      "学習参考書の読み込みに失敗しました。接続状況をご確認のうえ、あとでもう一度お試しください。",
  },
  mystery: {
    query: "mystery detective fiction",
    heading: "ミステリー小説",
    summary:
      "ミステリー小説のデータを取得できませんでした。Open Library 側の応答が落ち着いたタイミングで再取得できます。",
  },
  discovery: {
    query: "innovation creativity learning",
    sort: "new",
    heading: "新着ベースの注目書籍",
    summary:
      "注目書籍の読み込みに失敗しました。売上順位ではなく、新着系検索から本を見つける棚として設計しています。",
  },
};

const newsItems = [
  {
    date: "2026.04.19",
    title: "春期講習に関するお知らせ",
    url: "#",
  },
  {
    date: "2026.04.15",
    title: "学習相談の受付を開始しました",
    url: "#",
  },
  {
    date: "2026.04.10",
    title: "読書記録ノートの配布を今月分から更新しています",
    url: "#",
  },
  {
    date: "2026.04.05",
    title: "自習席の利用時間を一部延長しました",
    url: "#",
  },
  {
    date: "2026.03.28",
    title: "新年度に向けた面談予約のご案内",
    url: "#",
  },
];

const blogItems = [
  {
    date: "2026.04.18",
    title: "本を読み切れないときに見直したい、記録の取り方",
    url: "#",
  },
  {
    date: "2026.04.12",
    title: "学び直しの最初の一冊を選ぶときに大切にしていること",
    url: "#",
  },
  {
    date: "2026.04.07",
    title: "読書と対話を組み合わせると理解が深まる理由",
    url: "#",
  },
  {
    date: "2026.04.01",
    title: "忙しい日でも続けやすい、30分読書の整え方",
    url: "#",
  },
  {
    date: "2026.03.24",
    title: "ビジネス書と小説を行き来すると視点が広がる",
    url: "#",
  },
];

const POST_LIST_DATA = {
  news: newsItems,
  blog: blogItems,
};

const state = {
  memoryCache: new Map(),
  currentPanelIndex: 0,
  isMobileLayout: false,
  activePostTab: "news",
};

const dom = {
  body: document.body,
  pageProgress: document.getElementById("pageProgress"),
  stage: document.getElementById("discover"),
  track: document.getElementById("horizontalTrack"),
  horizontalProgressBar: document.getElementById("horizontalProgressBar"),
  horizontalProgressText: document.getElementById("horizontalProgressText"),
  bookTemplate: document.getElementById("bookCardTemplate"),
  railDots: [...document.querySelectorAll(".rail-dot")],
  categoryGrids: [...document.querySelectorAll("[data-books-grid]")],
  sections: [...document.querySelectorAll("[data-section]")],
  postTabs: [...document.querySelectorAll("[data-post-tab]")],
  postPanels: {
    news: document.getElementById("panel-news"),
    blog: document.getElementById("panel-blog"),
  },
  postLists: {
    news: document.getElementById("newsList"),
    blog: document.getElementById("blogList"),
  },
  postLinks: [...document.querySelectorAll("[data-post-link]")],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobileViewport() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function updateLayoutMode() {
  state.isMobileLayout = isMobileViewport();
  dom.body.classList.toggle("is-mobile-layout", state.isMobileLayout);
}

function buildSearchUrl(config) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", config.query);
  url.searchParams.set("fields", BOOK_FIELDS);
  url.searchParams.set("limit", String(BOOK_LIMIT + 4));

  if (config.sort) {
    url.searchParams.set("sort", config.sort);
  }

  return url.toString();
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeoutId };
}

function readSessionCache(category) {
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_KEY_PREFIX}${category}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeSessionCache(category, items) {
  try {
    window.sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${category}`,
      JSON.stringify({
        timestamp: Date.now(),
        items,
      }),
    );
  } catch {
    // sessionStorage が無効でも動作は継続する
  }
}

function normalizeBook(doc) {
  const title = typeof doc.title === "string" && doc.title.trim() ? doc.title.trim() : "タイトル未登録";
  const authors = Array.isArray(doc.author_name) && doc.author_name.length
    ? doc.author_name.filter(Boolean).slice(0, 2).join(" / ")
    : "著者情報なし";
  const year = Number.isFinite(doc.first_publish_year) ? String(doc.first_publish_year) : "出版年不明";
  const key = typeof doc.key === "string" ? doc.key : "";
  const coverId = Number.isFinite(doc.cover_i) ? doc.cover_i : null;

  return {
    id: key || `${title}-${authors}`,
    key,
    title,
    authors,
    year,
    editionCount: Number.isFinite(doc.edition_count) ? doc.edition_count : 0,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : "",
    linkUrl: key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
  };
}

function dedupeBooks(items) {
  const seen = new Set();
  return items.filter((item) => {
    const fingerprint = `${item.key}|${item.title.toLowerCase()}|${item.authors.toLowerCase()}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

async function fetchCategoryBooks(category) {
  if (state.memoryCache.has(category)) {
    return state.memoryCache.get(category);
  }

  const sessionCached = readSessionCache(category);
  if (sessionCached) {
    state.memoryCache.set(category, sessionCached);
    return sessionCached;
  }

  const config = CATEGORY_CONFIG[category];
  const { signal, timeoutId } = createTimeoutSignal(REQUEST_TIMEOUT);

  try {
    const response = await fetch(buildSearchUrl(config), {
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const docs = Array.isArray(payload.docs) ? payload.docs : [];
    const normalized = dedupeBooks(docs.map(normalizeBook))
      .filter((book) => book.title !== "タイトル未登録" || book.authors !== "著者情報なし")
      .slice(0, BOOK_LIMIT);

    if (!normalized.length) {
      throw new Error("No books available");
    }

    state.memoryCache.set(category, normalized);
    writeSessionCache(category, normalized);
    return normalized;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function createSkeletonMarkup() {
  const wrapper = document.createElement("div");
  wrapper.className = "skeleton-grid status-grid";

  for (let index = 0; index < 4; index += 1) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML = `
      <span class="skeleton-cover"></span>
      <div class="skeleton-lines">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    wrapper.append(card);
  }

  return wrapper;
}

function createStatusCard(title, description) {
  const status = document.createElement("div");
  status.className = "books-grid__status status-grid";
  status.innerHTML = `<strong>${title}</strong><p>${description}</p>`;
  return status;
}

function renderBookGrid(category, books) {
  const grid = dom.categoryGrids.find((node) => node.dataset.booksGrid === category);
  if (!grid) return;

  grid.innerHTML = "";
  grid.setAttribute("aria-busy", "false");

  books.forEach((book) => {
    const fragment = dom.bookTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".book-card");
    const link = fragment.querySelector(".book-card__link");
    const coverWrap = fragment.querySelector(".book-cover-wrap");
    const coverImage = fragment.querySelector(".book-cover");

    link.href = book.linkUrl;
    fragment.querySelector(".book-title").textContent = book.title;
    fragment.querySelector(".book-author").textContent = book.authors;
    fragment.querySelector(".book-year").textContent = book.year;
    coverImage.alt = `${book.title} の表紙`;

    if (book.coverUrl) {
      coverWrap.classList.add("has-image");
      coverImage.src = book.coverUrl;
      coverImage.addEventListener(
        "error",
        () => {
          coverWrap.classList.remove("has-image");
          coverWrap.classList.add("no-image");
          coverImage.classList.add("is-hidden");
          coverImage.alt = "";
        },
        { once: true },
      );
    } else {
      coverWrap.classList.add("no-image");
      coverImage.classList.add("is-hidden");
      coverImage.alt = "";
    }

    if (card) {
      card.dataset.bookId = book.id;
    }

    grid.append(fragment);
  });
}

function renderCategoryLoading(category) {
  const grid = dom.categoryGrids.find((node) => node.dataset.booksGrid === category);
  if (!grid) return;
  grid.innerHTML = "";
  grid.setAttribute("aria-busy", "true");
  grid.append(createSkeletonMarkup());
}

function renderCategoryError(category, error) {
  const grid = dom.categoryGrids.find((node) => node.dataset.booksGrid === category);
  const config = CATEGORY_CONFIG[category];
  if (!grid || !config) return;

  grid.innerHTML = "";
  grid.setAttribute("aria-busy", "false");
  grid.append(
    createStatusCard(
      `${config.heading}を読み込めませんでした`,
      `${config.summary}${error instanceof Error ? ` (${error.message})` : ""}`,
    ),
  );
}

async function loadAllCategories() {
  const categories = Object.keys(CATEGORY_CONFIG);

  categories.forEach((category) => renderCategoryLoading(category));

  await Promise.allSettled(
    categories.map(async (category) => {
      try {
        const books = await fetchCategoryBooks(category);
        renderBookGrid(category, books);
      } catch (error) {
        renderCategoryError(category, error);
      }
    }),
  );
}

function setStageHeight() {
  updateLayoutMode();

  if (state.isMobileLayout) {
    dom.stage.style.height = "auto";
    dom.track.style.transform = "translate3d(0, 0, 0)";
    dom.horizontalProgressBar.style.width = "100%";
    dom.horizontalProgressText.textContent = "4 / 4";
    return;
  }

  const scrollDistance = Math.max(0, dom.track.scrollWidth - window.innerWidth);
  dom.stage.style.height = `${window.innerHeight + scrollDistance}px`;
  updateHorizontalStage();
}

function getStageMetrics() {
  const rect = dom.stage.getBoundingClientRect();
  const stageTop = window.scrollY + rect.top;
  const scrollDistance = Math.max(0, dom.track.scrollWidth - window.innerWidth);
  const scrollableHeight = Math.max(1, dom.stage.offsetHeight - window.innerHeight);
  const passed = clamp(window.scrollY - stageTop, 0, scrollableHeight);
  const progress = clamp(passed / scrollableHeight, 0, 1);

  return { rect, scrollDistance, progress };
}

function updateHorizontalStage() {
  if (state.isMobileLayout) return;

  const { scrollDistance, progress } = getStageMetrics();
  const x = scrollDistance * progress;
  const panelCount = dom.track.children.length;
  const panelIndex = clamp(Math.round(progress * (panelCount - 1)), 0, panelCount - 1);

  state.currentPanelIndex = panelIndex;
  dom.track.style.transform = `translate3d(${-x}px, 0, 0)`;
  dom.horizontalProgressBar.style.width = `${(panelIndex + 1) / panelCount * 100}%`;
  dom.horizontalProgressText.textContent = `${panelIndex + 1} / ${panelCount}`;
}

function updatePageProgress() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = clamp(window.scrollY / maxScroll, 0, 1);
  dom.pageProgress.style.width = `${progress * 100}%`;
}

function getCurrentSectionId() {
  const viewportMiddle = window.innerHeight * 0.5;

  if (!state.isMobileLayout) {
    const stageRect = dom.stage.getBoundingClientRect();
    if (stageRect.top <= viewportMiddle && stageRect.bottom >= viewportMiddle) {
      const currentPanel = dom.track.children[state.currentPanelIndex];
      if (currentPanel?.id) return currentPanel.id;
    }
  }

  let activeSectionId = dom.sections[0]?.id || "hero";
  for (const section of dom.sections) {
    const rect = section.getBoundingClientRect();
    if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
      activeSectionId = section.id;
      break;
    }
  }

  return activeSectionId;
}

function updateReadingRail() {
  const currentId = getCurrentSectionId();
  dom.railDots.forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.target === currentId);
  });
}

function getHorizontalPanelScrollTarget(targetId) {
  if (state.isMobileLayout) return null;

  const panelIndex = [...dom.track.children].findIndex((panel) => panel.id === targetId);
  if (panelIndex < 0) return null;

  const panelCount = dom.track.children.length;
  const stageRect = dom.stage.getBoundingClientRect();
  const stageTop = window.scrollY + stageRect.top;
  const scrollableHeight = Math.max(1, dom.stage.offsetHeight - window.innerHeight);
  const panelProgress = panelCount === 1 ? 0 : panelIndex / (panelCount - 1);

  return stageTop + scrollableHeight * panelProgress;
}

function scrollToSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const horizontalTarget = getHorizontalPanelScrollTarget(targetId);
  if (horizontalTarget !== null) {
    window.scrollTo({
      top: horizontalTarget,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    return;
  }

  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function createPostListItem(item) {
  const row = document.createElement("article");
  row.className = "post-list__item";

  const safeUrl = typeof item.url === "string" && item.url.trim() ? item.url : "#";

  row.innerHTML = `
    <a class="post-list__link" href="${safeUrl}">
      <span class="post-list__date">${item.date}</span>
      <span class="post-list__title">${item.title}</span>
      <span class="post-list__arrow" aria-hidden="true">-&gt;</span>
    </a>
  `;

  return row;
}

function renderPostList(type, items) {
  const container = dom.postLists[type];
  if (!container) return;

  container.innerHTML = "";
  items.forEach((item) => {
    container.append(createPostListItem(item));
  });
}

function setActivePostTab(type, shouldFocus = false) {
  if (!POST_LIST_DATA[type]) return;

  state.activePostTab = type;

  dom.postTabs.forEach((tab) => {
    const isActive = tab.dataset.postTab === type;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;

    if (isActive && shouldFocus) {
      tab.focus();
    }
  });

  Object.entries(dom.postPanels).forEach(([panelType, panel]) => {
    if (!panel) return;
    const isActive = panelType === type;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });

  dom.postLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.postLink === type);
  });
}

function movePostTabFocus(currentType, direction) {
  const tabOrder = dom.postTabs.map((tab) => tab.dataset.postTab);
  const currentIndex = tabOrder.indexOf(currentType);
  if (currentIndex < 0) return;

  const nextIndex = (currentIndex + direction + tabOrder.length) % tabOrder.length;
  const nextType = tabOrder[nextIndex];
  setActivePostTab(nextType, true);
}

function bindPostTabs() {
  dom.postTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActivePostTab(tab.dataset.postTab);
    });

    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        movePostTabFocus(tab.dataset.postTab, 1);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        movePostTabFocus(tab.dataset.postTab, -1);
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActivePostTab("news", true);
      }

      if (event.key === "End") {
        event.preventDefault();
        setActivePostTab("blog", true);
      }
    });
  });
}

function initPostLists() {
  Object.entries(POST_LIST_DATA).forEach(([type, items]) => {
    renderPostList(type, items);
  });

  bindPostTabs();
  setActivePostTab(state.activePostTab);
}

let ticking = false;

function onScroll() {
  if (ticking) return;

  ticking = true;
  window.requestAnimationFrame(() => {
    updateHorizontalStage();
    updatePageProgress();
    updateReadingRail();
    ticking = false;
  });
}

function bindInteractions() {
  dom.railDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      scrollToSection(dot.dataset.target);
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;

      const targetId = href.slice(1);
      if (!document.getElementById(targetId)) return;

      event.preventDefault();
      scrollToSection(targetId);
    });
  });
}

function init() {
  setStageHeight();
  updatePageProgress();
  updateReadingRail();
  bindInteractions();
  initPostLists();
  loadAllCategories();

  window.addEventListener("resize", setStageHeight);
  window.addEventListener("scroll", onScroll, { passive: true });
}

window.addEventListener("load", init);
