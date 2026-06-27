const state = {
  sourceFilter: "all",
  feedFilter: "all",
  query: "",
  feedItems: [],
  feedPool: [],
  feedCursor: 0,
  lang: loadLanguage(),
  isRefreshing: false
};

const FEED_BATCH_SIZE = 8;
const FEED_POOL_LIMIT = 120;
const FEED_CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 6000;

const i18n = {
  zh: {
    meta: {
      title: "SCL城市研究所",
      description: "用于快速查阅全球城市研究实验室、研究机构与城市研究期刊最新动态的前沿资讯导航站。"
    },
    brand: { title: "SCL城市研究所" },
    nav: { home: "首页", library: "资源库", materials: "资料下载" },
    hero: {
      title: "SCL城市研究所资源库",
      lede: "SCL城市研究所资源库用于追踪全球城市研究机构、实验室与期刊的最新动态，集中呈现研究进展、论文发布与官方资讯入口。",
      resourcesAre: "你可以在这里：",
      pointOfficial: "快速检索城市研究机构、实验室、期刊与主题关键词",
      pointTopics: "刷新获取最新资讯，并打开官网、论文或动态原始来源"
    },
    actions: {
      refresh: "刷新最新资讯",
      loadMore: "再显示 8 条资讯",
      reload: "重新获取最新资讯",
      browse: "浏览全部来源",
      official: "官网",
      latest: "最新入口",
      openSource: "打开来源",
      download: "下载资料"
    },
    search: {
      label: "检索来源或主题",
      placeholder: "例如 MIT、城市分析、期刊、交通、空间数据"
    },
    metrics: { sources: "已纳入来源", journals: "期刊与出版", labs: "实验室与机构" },
    feed: {
      title: "最新资讯",
      seedTitle: "点击刷新后显示最新论文和动态",
      seedSource: "SCL城市研究所",
      seedSummary: "点击后会优先读取研究机构官网、期刊论文接口、arXiv 与公开 RSS，每次只展示 8 条最新资讯。",
      defaultStatus: "点击“刷新最新资讯”后，每次展示 8 条；研究机构优先读取官网最新动态，期刊读取最新论文信息。",
      loadingStatus: "正在读取机构官网、期刊论文接口与公开 feed，并生成关键词和初步总结。",
      doneStatus: (added, visible) => `本次新增 ${added} 条，当前显示 ${visible} 条。再次点击继续追加 8 条。`,
      exhaustedStatus: (visible) => `已显示 ${visible} 条可读取资讯。点击可重新获取最新结果。`,
      refreshing: "正在获取",
      empty: "当前筛选下没有资讯。刷新或调整筛选条件。",
      errorStatus: "暂时无法读取外部来源，已保留可打开的官方最新入口。",
      latestPublication: (name) => `${name} 最新出版入口`,
      latestUpdates: (name) => `${name} 最新动态入口`
    },
    library: {
      title: "城市研究机构",
      empty: "没有匹配的来源，换个关键词试试。"
    },
    materials: {
      title: "研究资料下载",
      description: "摘取小红书账号提到的城市研究、街道设计、城市更新与公共空间资料，后续可继续补充下载链接。",
      sourceLink: "查看小红书来源",
      empty: "没有匹配的研究资料，换个关键词试试。",
      pending: "下载链接待补充"
    },
    filters: {
      all: "全部",
      progress: "研究进展",
      papers: "论文资讯",
      labs: "实验室",
      institutions: "机构",
      journals: "期刊"
    },
    labels: {
      lab: "实验室",
      institution: "机构",
      journal: "期刊/出版",
      paper: "论文",
      notice: "提示",
      progress: "进展",
      dynamic: "动态入口",
      note: "使用提示",
      keywords: "关键词",
      summary: "初步总结"
    },
    footer: {
      title: "SCL城市研究所",
      source: "数据来源：favorites_2026_6_27.html 相关收藏夹与本次全球城市研究来源检索。",
      scope: "全球城市研究实验室、机构与期刊导航",
      count: "76 个来源 · 支持中英文检索",
      library: "查看资源库",
      backTop: "回到顶部"
    }
  },
  en: {
    meta: {
      title: "SCL Urban Research Institute",
      description: "A curated navigation site for global urban research labs, institutions, journals, and recent signals."
    },
    brand: { title: "SCL Urban Research Institute" },
    nav: { home: "Home", library: "Library", materials: "Downloads" },
    hero: {
      title: "SCL Urban Research Institute Library",
      lede: "The SCL Urban Research Institute Library tracks updates from global urban research institutions, labs, and journals, bringing research progress, paper releases, and official source links into one place.",
      resourcesAre: "Use it to:",
      pointOfficial: "search urban research institutions, labs, journals, and topic keywords",
      pointTopics: "refresh the latest news and open the original official, paper, or update source"
    },
    actions: {
      refresh: "Refresh Latest Signals",
      loadMore: "Show 8 More",
      reload: "Reload Latest Signals",
      browse: "Browse All Sources",
      official: "Official Site",
      latest: "Latest Entry",
      openSource: "Open Source",
      download: "Download"
    },
    search: {
      label: "Search sources or topics",
      placeholder: "Try MIT, urban analytics, journals, transport, spatial data"
    },
    metrics: { sources: "included sources", journals: "journals & publishing", labs: "labs & institutions" },
    feed: {
      title: "Latest News",
      seedTitle: "Refresh to load recent papers and updates",
      seedSource: "SCL Urban Research Institute",
      seedSummary: "The board reads official lab pages, journal paper APIs, arXiv, and public RSS feeds, then shows 8 fresh items at a time.",
      defaultStatus: "Click “Refresh Latest Signals” to show 8 items at a time. Labs use official update pages; journals use latest paper records.",
      loadingStatus: "Reading official institution pages, journal APIs, and public feeds, then generating keywords and first-pass summaries.",
      doneStatus: (added, visible) => `Added ${added} items. ${visible} items are now visible. Click again to append 8 more.`,
      exhaustedStatus: (visible) => `Showing ${visible} readable items. Click to reload the latest results.`,
      refreshing: "Fetching",
      empty: "No items match the current filters. Refresh or adjust your search.",
      errorStatus: "External sources are temporarily unreadable; official latest-entry links are kept available.",
      latestPublication: (name) => `${name} latest publication entry`,
      latestUpdates: (name) => `${name} latest update entry`
    },
    library: {
      title: "Urban Research Institutions",
      empty: "No sources match this search. Try a different keyword."
    },
    materials: {
      title: "Research Downloads",
      description: "A growing list of urban research, street design, urban regeneration, and public-space resources mentioned by the Xiaohongshu account.",
      sourceLink: "View Xiaohongshu Source",
      empty: "No research materials match this search. Try a different keyword.",
      pending: "Download link pending"
    },
    filters: {
      all: "All",
      progress: "Research Updates",
      papers: "Papers",
      labs: "Labs",
      institutions: "Institutions",
      journals: "Journals"
    },
    labels: {
      lab: "Lab",
      institution: "Institution",
      journal: "Journal / Publishing",
      paper: "Paper",
      notice: "Note",
      progress: "Update",
      dynamic: "Update Entry",
      note: "Usage Note",
      keywords: "Keywords",
      summary: "First-pass Summary"
    },
    footer: {
      title: "SCL Urban Research Institute",
      source: "Sources: relevant bookmarks from favorites_2026_6_27.html and this global urban research scan.",
      scope: "A global navigation library for urban research labs, institutions, and journals",
      count: "76 sources · bilingual search supported",
      library: "View Library",
      backTop: "Back to Top"
    }
  }
};

const regionTranslations = {
  中国: "China",
  全球: "Global",
  美国: "United States",
  英国: "United Kingdom",
  新加坡: "Singapore",
  瑞士: "Switzerland",
  荷兰: "Netherlands",
  中国香港: "Hong Kong, China",
  加拿大: "Canada",
  南非: "South Africa",
  非洲: "Africa",
  印度: "India",
  智利: "Chile",
  拉美: "Latin America",
  巴西: "Brazil",
  德国: "Germany",
  亚洲: "Asia",
  欧洲: "Europe",
  全球南方: "Global South"
};

const tagTranslations = {
  "GIS": "GIS",
  "Media Lab": "Media Lab",
  "Nature": "Nature",
  "TOD": "TOD",
  "15分钟城市": "15-minute city",
  "中国城市": "Chinese cities",
  "亚洲城市": "Asian cities",
  "交通": "transport",
  "交通地理": "transport geography",
  "人居环境": "human settlements",
  "低碳": "low carbon",
  "低碳城市": "low-carbon cities",
  "住房": "housing",
  "全球南方": "Global South",
  "全球城市": "global cities",
  "公共空间": "public space",
  "出版系列": "book series",
  "出行": "mobility",
  "制图": "mapping",
  "北京": "Beijing",
  "区域研究": "regional studies",
  "南亚城市": "South Asian cities",
  "历史城市": "historic cities",
  "发展": "development",
  "可持续交通": "sustainable transport",
  "可持续城市": "sustainable cities",
  "图书": "books",
  "城市生活圈": "neighborhood life circle",
  "土地利用": "land use",
  "地图": "maps",
  "场所营造": "placemaking",
  "城市不平等": "urban inequality",
  "城市主义": "urbanism",
  "城市事务": "urban affairs",
  "城市交通": "urban transport",
  "城市信息学": "urban informatics",
  "城市分析": "urban analytics",
  "城市创新": "urban innovation",
  "城市化": "urbanization",
  "城市变化": "urban change",
  "城市可持续": "urban sustainability",
  "城市史": "urban history",
  "城市品质": "urban quality",
  "城市地理": "urban geography",
  "城市大数据": "urban big data",
  "城市形态": "urban form",
  "城市感知": "urban sensing",
  "城市技术": "urban technology",
  "城市政策": "urban policy",
  "城市数据": "urban data",
  "城市数据科学": "urban data science",
  "城市更新": "urban regeneration",
  "城市林业": "urban forestry",
  "城市模型": "urban modeling",
  "城市模拟": "urban simulation",
  "城市气候": "urban climate",
  "城市治理": "urban governance",
  "城市环境": "urban environment",
  "城市理论": "urban theory",
  "城市生态": "urban ecology",
  "城市研究": "urban studies",
  "城市社会学": "urban sociology",
  "城市科学": "urban science",
  "城市管理": "urban management",
  "城市系统": "urban systems",
  "城市经济": "urban economics",
  "城市网络": "urban networks",
  "城市观测": "urban observatories",
  "城市规划": "urban planning",
  "城市议题": "urban issues",
  "城市设计": "urban design",
  "城市贫困": "urban poverty",
  "城市韧性": "urban resilience",
  "多语种": "multilingual",
  "大湾区": "Greater Bay Area",
  "实践": "practice",
  "儿童友好": "child-friendly",
  "巴西城市": "Brazilian cities",
  "应用研究": "applied research",
  "建成环境": "built environment",
  "开放数据": "open data",
  "开放获取": "open access",
  "房地产": "real estate",
  "批判城市研究": "critical urban studies",
  "战术城市主义": "tactical urbanism",
  "技术创新": "technical innovation",
  "拉美城市": "Latin American cities",
  "政策": "policy",
  "政策出版": "policy publications",
  "方法论": "methodology",
  "华南城市": "South China cities",
  "城中村": "urban villages",
  "慢行": "active mobility",
  "街道改造": "street transformation",
  "街道设计": "street design",
  "全球案例": "global cases",
  "非正式住区": "informal settlements",
  "数字城市": "digital cities",
  "数据可视化": "data visualization",
  "数据智能": "data intelligence",
  "数据服务": "data services",
  "数据科学": "data science",
  "文献综述": "literature reviews",
  "新加坡": "Singapore",
  "景观": "landscape",
  "景观城市主义": "landscape urbanism",
  "智慧城市": "smart cities",
  "期刊": "journal",
  "未来城市": "future cities",
  "杂志": "magazine",
  "欧洲城市": "European cities",
  "气候": "climate",
  "气候风险": "climate risk",
  "治理": "governance",
  "热环境": "thermal environment",
  "环境": "environment",
  "理论": "theory",
  "生态": "ecology",
  "生态服务": "ecosystem services",
  "生态系统": "ecosystems",
  "生活方式": "lifestyle",
  "生物多样性": "biodiversity",
  "研究资助": "research funding",
  "社会": "society",
  "社会史": "social history",
  "社会科学": "social sciences",
  "社区": "communities",
  "社区技术": "community technology",
  "空间不平等": "spatial inequality",
  "空间分析": "spatial analysis",
  "空间政策": "spatial policy",
  "空间数据": "spatial data",
  "空间模型": "spatial models",
  "空间治理": "spatial governance",
  "空间研究": "spatial research",
  "空间结构": "spatial structure",
  "空间计算": "spatial computing",
  "综合城市研究": "general urban studies",
  "绿地": "green space",
  "网络分析": "network analysis",
  "自然基解决方案": "nature-based solutions",
  "街景": "streetscape",
  "街道设计": "street design",
  "规划工具": "planning tools",
  "规划教育": "planning education",
  "规划治理": "planning governance",
  "规划理论": "planning theory",
  "规划研究": "planning research",
  "计算城市": "computational urbanism",
  "计算方法": "computational methods",
  "计算社会": "computing and society",
  "论文": "papers",
  "设计研究": "design research",
  "跨学科": "interdisciplinary",
  "都市圈": "metropolitan regions",
  "长三角": "Yangtze River Delta",
  "非洲城市": "African cities",
  "韧性": "resilience",
  "预印本": "preprints"
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applyTranslations();
  renderMetrics();
  renderSources();
  renderMaterials();
  renderFeed(getFeedSeedItems());
});

function bindEvents() {
  document.querySelectorAll("[data-lang-toggle]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.langToggle));
  });

  document.querySelectorAll("[data-source-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sourceFilter = button.dataset.sourceFilter;
      setActiveButton("[data-source-filter]", button);
      renderSources();
    });
  });

  document.querySelectorAll("[data-feed-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.feedFilter = button.dataset.feedFilter;
      setActiveButton("[data-feed-filter]", button);
      renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
    });
  });

  document.getElementById("globalSearch").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderSources();
    renderMaterials();
    renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
  });

  document.getElementById("refreshFeeds").addEventListener("click", refreshFrontiers);
}

function setLanguage(lang) {
  if (!i18n[lang] || state.lang === lang) return;
  state.lang = lang;
  saveLanguage(lang);
  applyTranslations();
  renderMetrics();
  renderSources();
  renderMaterials();
  renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
  updateRefreshButton();
  updateFeedStatus();
}

function applyTranslations() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.title = t("meta.title");
  document.querySelector("meta[name='description']")?.setAttribute("content", t("meta.description"));
  document.querySelector(".brand")?.setAttribute("aria-label", t("brand.title"));
  document.querySelector(".top-nav")?.setAttribute("aria-label", state.lang === "zh" ? "主导航" : "Main navigation");
  document.querySelector(".language-switch")?.setAttribute("aria-label", state.lang === "zh" ? "语言切换" : "Language switcher");
  document.querySelector(".control-band")?.setAttribute("aria-label", state.lang === "zh" ? "资讯筛选" : "Signal filters");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  document.querySelectorAll("[data-lang-toggle]").forEach((button) => {
    const active = button.dataset.langToggle === state.lang;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const status = document.getElementById("feedStatus");
  if (status && !state.isRefreshing) updateFeedStatus();
  if (!state.isRefreshing) updateRefreshButton();
}

function setActiveButton(selector, activeButton) {
  document.querySelectorAll(selector).forEach((button) => button.classList.remove("is-active"));
  activeButton.classList.add("is-active");
}

function renderMetrics() {
  const journals = SOURCES.filter((source) => source.type === "journal").length;
  const labs = SOURCES.filter((source) => source.type === "lab" || source.type === "institution").length;
  document.getElementById("totalSources").textContent = SOURCES.length;
  document.getElementById("journalCount").textContent = journals;
  document.getElementById("labCount").textContent = labs;
}

function renderSources() {
  const grid = document.getElementById("sourceGrid");
  const sources = filteredSources();

  if (!sources.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("library.empty"))}</div>`;
    return;
  }

  grid.innerHTML = sources.map((source) => `
    <article class="source-card source-card--${source.type}">
      <div class="card-topline">
        <span class="pill">${escapeHtml(sourceTypeLabel(source.type))}</span>
        <span>${escapeHtml(localizeRegion(source.region))}</span>
      </div>
      <h3>${escapeHtml(source.name)}</h3>
      <p>${escapeHtml(sourceDescription(source))}</p>
      <div class="tag-row">
        ${source.tags.map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
      </div>
      <div class="card-actions">
        <a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.official"))}</a>
        <a href="${source.latestUrl || source.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.latest"))}</a>
      </div>
    </article>
  `).join("");
}

function filteredSources() {
  return SOURCES.filter((source) => {
    const matchesType = state.sourceFilter === "all" || source.type === state.sourceFilter;
    return matchesType && (!state.query || searchableSourceText(source).includes(state.query));
  });
}

function renderMaterials() {
  const grid = document.getElementById("materialsGrid");
  if (!grid || typeof RESEARCH_MATERIALS === "undefined") return;

  const materials = filteredMaterials();
  if (!materials.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("materials.empty"))}</div>`;
    return;
  }

  grid.innerHTML = materials.map((material) => `
    <article class="material-card">
      <div class="material-cover">
        <img src="${escapeHtml(material.image)}" alt="${escapeHtml(materialTitle(material))}">
        <span class="pill">${escapeHtml(materialFormat(material))}</span>
      </div>
      <div class="material-body">
        <h3>${escapeHtml(materialTitle(material))}</h3>
        <p>${escapeHtml(materialDescription(material))}</p>
        <div class="tag-row">
          ${material.tags.map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
        </div>
        <div class="card-actions material-actions">
          <a href="${escapeHtml(material.sourceUrl || XIAOHONGSHU_SOURCE_URL)}" target="_blank" rel="noreferrer">${escapeHtml(t("materials.sourceLink"))}</a>
          ${material.downloadUrl
            ? `<a href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.download"))}</a>`
            : `<span class="disabled-link">${escapeHtml(t("materials.pending"))}</span>`}
        </div>
      </div>
    </article>
  `).join("");
}

function filteredMaterials() {
  if (typeof RESEARCH_MATERIALS === "undefined") return [];
  return RESEARCH_MATERIALS.filter((material) => !state.query || searchableMaterialText(material).includes(state.query));
}

function materialTitle(material) {
  return state.lang === "zh" ? material.title : material.titleEn || material.title;
}

function materialDescription(material) {
  return state.lang === "zh" ? material.description : material.descriptionEn || material.description;
}

function materialFormat(material) {
  return state.lang === "zh" ? material.format : material.formatEn || material.format;
}

function searchableMaterialText(material) {
  return [
    material.title,
    material.titleEn,
    material.format,
    material.formatEn,
    material.description,
    material.descriptionEn,
    ...material.tags,
    ...material.tags.map(localizeTag)
  ].join(" ").toLowerCase();
}

function renderFeed(items) {
  const grid = document.getElementById("feedGrid");
  const visibleItems = items.filter(feedItemMatchesCurrentView);

  if (!visibleItems.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("feed.empty"))}</div>`;
    return;
  }

  grid.innerHTML = visibleItems.map((item) => `
    <article class="feed-card ${item.kind === "paper" ? "paper-card" : ""}">
      <div class="card-topline">
        <span class="pill">${escapeHtml(feedKindLabel(item.kind))}</span>
        <span>${escapeHtml(item.date || t("labels.dynamic"))}</span>
      </div>
      <h3>${escapeHtml(localizeFeedTitle(item))}</h3>
      <div class="feed-summary">
        <span>${escapeHtml(t("labels.summary"))}</span>
        <p>${escapeHtml(localizeFeedSummary(item))}</p>
      </div>
      <div class="feed-meta">${escapeHtml(item.source)}</div>
      <div class="feed-keywords">${escapeHtml(t("labels.keywords"))}</div>
      <div class="tag-row">
        ${feedKeywords(item).slice(0, 6).map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
      </div>
      <div class="card-actions">
        <a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.openSource"))}</a>
      </div>
    </article>
  `).join("");
}

function updateRefreshButton() {
  const button = document.getElementById("refreshFeeds");
  if (!button) return;
  if (state.isRefreshing) {
    button.textContent = t("feed.refreshing");
    return;
  }
  if (state.feedPool.length && state.feedCursor < state.feedPool.length) {
    button.textContent = t("actions.loadMore");
    return;
  }
  if (state.feedPool.length && state.feedCursor >= state.feedPool.length) {
    button.textContent = t("actions.reload");
    return;
  }
  button.textContent = t("actions.refresh");
}

function updateFeedStatus(added = 0) {
  const status = document.getElementById("feedStatus");
  if (!status) return;
  if (!state.feedItems.length || !state.feedPool.length) {
    status.textContent = t("feed.defaultStatus");
    return;
  }
  const visibleCount = state.feedItems.filter(feedItemMatchesCurrentView).length;
  if (state.feedCursor >= state.feedPool.length) {
    status.textContent = t("feed.exhaustedStatus")(visibleCount);
    return;
  }
  status.textContent = t("feed.doneStatus")(added || Math.min(FEED_BATCH_SIZE, visibleCount), visibleCount);
}

async function refreshFrontiers() {
  if (state.isRefreshing) return;
  const button = document.getElementById("refreshFeeds");
  const status = document.getElementById("feedStatus");
  state.isRefreshing = true;
  button.disabled = true;
  updateRefreshButton();
  status.textContent = t("feed.loadingStatus");

  try {
    if (!state.feedPool.length || state.feedCursor >= state.feedPool.length) {
      state.feedPool = await loadFrontierFeedPool();
      state.feedCursor = 0;
      state.feedItems = [];
    }

    const added = appendFeedBatch();
    renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
    updateFeedStatus(added);
  } catch (error) {
    state.feedPool = buildFallbackItems(
      SOURCES.filter((source) => source.type === "lab" || source.type === "institution"),
      SOURCES.filter((source) => source.type === "journal")
    ).slice(0, FEED_BATCH_SIZE);
    state.feedCursor = 0;
    state.feedItems = [];
    appendFeedBatch();
    renderFeed(state.feedItems);
    status.textContent = t("feed.errorStatus");
  } finally {
    button.disabled = false;
    state.isRefreshing = false;
    updateRefreshButton();
  }
}

async function loadFrontierFeedPool() {
  const journalSources = SOURCES.filter((source) => source.type === "journal");
  const labSources = SOURCES.filter((source) => source.type === "lab" || source.type === "institution");
  const tasks = [
    ...journalSources.map((source) => () => fetchJournalItems(source)),
    ...labSources.map((source) => () => fetchInstitutionItems(source))
  ];

  const settled = await settleLimited(tasks, FEED_CONCURRENCY);
  const liveItems = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const fallbackItems = liveItems.length ? [] : buildFallbackItems(labSources, journalSources);

  const sortedItems = dedupeFeedItems([...liveItems, ...fallbackItems])
    .filter(Boolean)
    .sort((a, b) => dateScore(b.date) - dateScore(a.date))
    .slice(0, FEED_POOL_LIMIT);
  return balanceFeedItems(sortedItems);
}

function balanceFeedItems(items) {
  const papers = items.filter((item) => item.kind === "paper");
  const updates = items.filter((item) => item.kind !== "paper");
  const balanced = [];
  let paperIndex = 0;
  let updateIndex = 0;

  while (paperIndex < papers.length || updateIndex < updates.length) {
    if (paperIndex < papers.length) {
      balanced.push(papers[paperIndex]);
      paperIndex += 1;
    }
    if (updateIndex < updates.length) {
      balanced.push(updates[updateIndex]);
      updateIndex += 1;
    }
  }

  return balanced.slice(0, FEED_POOL_LIMIT);
}

function appendFeedBatch() {
  const nextItems = [];
  let visibleAdded = 0;
  const shouldFillCurrentView = state.feedFilter !== "all" || Boolean(state.query);
  while (state.feedCursor < state.feedPool.length) {
    const item = state.feedPool[state.feedCursor];
    state.feedCursor += 1;
    nextItems.push(item);
    if (feedItemMatchesCurrentView(item)) visibleAdded += 1;
    if (!shouldFillCurrentView && nextItems.length >= FEED_BATCH_SIZE) break;
    if (shouldFillCurrentView && visibleAdded >= FEED_BATCH_SIZE) break;
  }
  state.feedItems = [...state.feedItems, ...nextItems];
  return shouldFillCurrentView ? visibleAdded : nextItems.length;
}

function feedItemMatchesCurrentView(item) {
  const matchesKind = state.feedFilter === "all" ||
    (state.feedFilter === "paper" && item.kind === "paper") ||
    (state.feedFilter === "lab" && item.kind !== "paper");
  if (!matchesKind) return false;
  if (!state.query) return true;
  return searchableFeedText(item).includes(state.query);
}

function searchableFeedText(item) {
  return [
    localizeFeedTitle(item),
    item.source,
    localizeFeedSummary(item),
    ...feedKeywords(item),
    ...feedKeywords(item).map(localizeTag)
  ].join(" ").toLowerCase();
}

async function settleLimited(tasks, limit) {
  const results = [];
  let nextIndex = 0;
  const workerCount = Math.min(limit, tasks.length);

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        results[currentIndex] = { status: "fulfilled", value: await tasks[currentIndex]() };
      } catch (error) {
        results[currentIndex] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function fetchJournalItems(source) {
  const items = [];
  if (source.issn) {
    items.push(...await tryFetchItems(() => fetchCrossref(source)));
  }
  if (source.feed) {
    items.push(...await tryFetchItems(() => fetchFeed(source)));
  }
  if (!items.length) {
    items.push(...await tryFetchItems(() => fetchOfficialPageItems(source, "paper")));
  }
  return items.length ? items : [];
}

async function fetchInstitutionItems(source) {
  const items = [];
  if (source.feed) {
    items.push(...await tryFetchItems(() => fetchFeed(source)));
  }
  if (!items.length) {
    items.push(...await tryFetchItems(() => fetchOfficialPageItems(source, "lab")));
  }
  if (!items.length) {
    items.push(...await tryFetchItems(() => discoverFeedItems(source)));
  }
  return items.length ? items : [];
}

async function tryFetchItems(job) {
  try {
    return await job();
  } catch (error) {
    return [];
  }
}

async function fetchCrossref(source) {
  const since = new Date();
  since.setMonth(since.getMonth() - 18);
  const filterDate = since.toISOString().slice(0, 10);
  const issn = source.issn[0];
  const endpoint = `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?filter=from-pub-date:${filterDate},type:journal-article&sort=published&order=desc&rows=8`;
  const response = await fetchWithTimeout(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Crossref ${source.name} ${response.status}`);
  const data = await response.json();
  return (data.message.items || []).map((item) => {
    const title = cleanTitle(item.title && item.title[0]) || "Untitled article";
    const excerpt = compactText(stripHtml(item.abstract || ""), 300);
    const subjects = Array.isArray(item.subject) ? item.subject : [];
    return normalizeFeedItem({
      title,
      source: source.name,
      sourceId: source.id,
      kind: "paper",
      date: extractCrossrefDate(item),
      url: item.URL || source.latestUrl || source.url,
      excerpt,
      summary: excerpt,
      keywords: buildKeywords(source, title, excerpt, subjects),
      tags: buildKeywords(source, title, excerpt, subjects)
    });
  });
}

async function fetchFeed(source) {
  const text = await fetchText(source.feed);
  return parseFeedText(text, source);
}

async function discoverFeedItems(source) {
  const pageUrls = uniqueValues([source.latestUrl, source.url]).filter(Boolean);
  for (const pageUrl of pageUrls) {
    const text = await fetchText(pageUrl);
    const doc = new DOMParser().parseFromString(text, "text/html");
    const feedLink = Array.from(doc.querySelectorAll("link[rel='alternate']")).find((link) => {
      const type = (link.getAttribute("type") || "").toLowerCase();
      return type.includes("rss") || type.includes("atom");
    });
    if (!feedLink) continue;
    const feedUrl = new URL(feedLink.getAttribute("href"), pageUrl).href;
    const feedText = await fetchText(feedUrl);
    const items = parseFeedText(feedText, source).slice(0, 6);
    if (items.length) return items;
  }
  return [];
}

function parseFeedText(text, source) {
  const xml = new DOMParser().parseFromString(text, "text/xml");
  const nodes = Array.from(xml.querySelectorAll("item, entry"));
  return nodes.slice(0, 8).map((node) => {
    const title = node.querySelector("title")?.textContent || source.name;
    const href = feedLinkFromNode(node) || source.latestUrl || source.url;
    const summary = node.querySelector("summary, description, content")?.textContent || "";
    const date = node.querySelector("published, updated, pubDate")?.textContent || "";
    const categories = Array.from(node.querySelectorAll("category"))
      .map((category) => category.getAttribute("term") || category.textContent)
      .filter(Boolean);
    const excerpt = compactText(stripHtml(summary), 260);
    return normalizeFeedItem({
      title: cleanTitle(title),
      source: source.name,
      sourceId: source.id,
      kind: source.type === "journal" ? "paper" : "lab",
      date: formatLooseDate(date),
      url: toAbsoluteUrl(href, source.url),
      excerpt,
      summary: excerpt,
      keywords: buildKeywords(source, title, excerpt, categories),
      tags: buildKeywords(source, title, excerpt, categories)
    });
  });
}

async function fetchOfficialPageItems(source, forcedKind) {
  const pageUrl = source.latestUrl || source.url;
  const text = await fetchText(pageUrl);
  const doc = new DOMParser().parseFromString(text, "text/html");
  return collectOfficialCandidates(doc, source, pageUrl, forcedKind).slice(0, 8);
}

function collectOfficialCandidates(doc, source, pageUrl, forcedKind) {
  const primaryAnchors = Array.from(doc.querySelectorAll([
    "main article a[href]",
    "article a[href]",
    ".news a[href]",
    ".news-item a[href]",
    ".post a[href]",
    ".views-row a[href]",
    ".card a[href]",
    ".teaser a[href]",
    "main a[href]"
  ].join(",")));
  const anchors = primaryAnchors.length ? primaryAnchors : Array.from(doc.querySelectorAll("a[href]"));
  const seen = new Set();

  return anchors.flatMap((anchor) => {
    const href = anchor.getAttribute("href");
    const url = toAbsoluteUrl(href, pageUrl);
    if (!isUsefulContentUrl(url)) return [];

    const container = anchor.closest("article, li, .news-item, .post, .views-row, .card, .teaser, section, div") || anchor.parentElement;
    const title = officialCandidateTitle(anchor, container);
    if (!isUsefulContentTitle(title)) return [];

    const key = normalizeKey(url || title);
    if (seen.has(key)) return [];
    seen.add(key);

    const excerpt = officialCandidateExcerpt(container, title);
    return [normalizeFeedItem({
      title,
      source: source.name,
      sourceId: source.id,
      kind: forcedKind || (source.type === "journal" ? "paper" : "lab"),
      date: extractDateFromElement(container),
      url,
      excerpt,
      summary: excerpt,
      keywords: buildKeywords(source, title, excerpt),
      tags: buildKeywords(source, title, excerpt)
    })];
  });
}

function officialCandidateTitle(anchor, container) {
  const anchorText = cleanTitle(anchor.textContent);
  const heading = container ? cleanTitle(container.querySelector("h1, h2, h3, h4")?.textContent) : "";
  if (heading && (isGenericLinkText(anchorText) || heading.length >= anchorText.length)) return heading;
  return anchorText || heading;
}

function officialCandidateExcerpt(container, title) {
  if (!container) return "";
  const paragraphs = Array.from(container.querySelectorAll("p, .summary, .description, .excerpt"))
    .map((node) => cleanTitle(node.textContent))
    .filter((text) => text && text !== title && !isGenericLinkText(text));
  if (paragraphs.length) return compactText(paragraphs[0], 260);
  const text = cleanTitle(container.textContent).replace(title, "").trim();
  return compactText(text, 220);
}

function isUsefulContentTitle(title) {
  if (!title || title.length < 10 || title.length > 180) return false;
  if (isGenericLinkText(title)) return false;
  return !/^(home|about|contact|privacy|cookie|subscribe|search|menu|login)$/i.test(title);
}

function isUsefulContentUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|zip|ics)$/i.test(url)) return false;
  return !/(mailto:|javascript:|#)/i.test(url);
}

function isGenericLinkText(text) {
  return /^(read more|learn more|view all|more|更多|阅读全文|查看全部|了解更多|click here)$/i.test((text || "").trim());
}

function extractDateFromElement(element) {
  if (!element) return "";
  const time = element.querySelector("time");
  const explicit = time?.getAttribute("datetime") || time?.textContent || "";
  const parsedExplicit = parseDateText(explicit);
  if (parsedExplicit) return parsedExplicit;
  return parseDateText(element.textContent || "");
}

function parseDateText(value) {
  if (!value) return "";
  const isoMatch = value.match(/\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return formatLooseDate(isoMatch[0].replaceAll("/", "-").replaceAll(".", "-"));
  const monthMatch = value.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(20\d{2}|19\d{2})\b/i);
  if (monthMatch) return formatLooseDate(monthMatch[0]);
  const compactMatch = value.match(/\b(20\d{2}|19\d{2})\s*年\s*(0?[1-9]|1[0-2])\s*月\s*(0?[1-9]|[12]\d|3[01])?\s*日?/);
  if (compactMatch) {
    const [, year, month, day = "1"] = compactMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

function feedLinkFromNode(node) {
  const alternate = Array.from(node.querySelectorAll("link")).find((link) => {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    return !rel || rel === "alternate";
  });
  return alternate?.getAttribute("href") || alternate?.textContent || node.querySelector("link")?.textContent || "";
}

function normalizeFeedItem(item) {
  const title = cleanTitle(item.title);
  const keywords = feedKeywords(item);
  return {
    ...item,
    title,
    url: item.url || "#home",
    excerpt: compactText(item.excerpt || item.summary || "", 300),
    summary: compactText(item.summary || item.excerpt || "", 300),
    keywords,
    tags: keywords
  };
}

function dedupeFeedItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeKey(item.url || item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(item.title && item.url);
  });
}

function buildKeywords(source, title = "", excerpt = "", extras = []) {
  const text = `${title} ${excerpt}`.toLowerCase();
  const rules = [
    ["城市数据", /\b(data|dataset|digital|sensor|sensing|analytics|ai|machine learning|model|simulation|platform)\b|数据|模型|模拟|智能/],
    ["城市科学", /\b(urban science|city science|complexity|systems?)\b|城市科学|城市系统/],
    ["城市规划", /\b(planning|plan|zoning|land use|spatial policy)\b|规划|土地利用/],
    ["交通", /\b(mobility|transport|transit|traffic|walkability|accessibility)\b|交通|出行|可达/],
    ["公共空间", /\b(public space|placemaking|street|streetscape|park|open space)\b|公共空间|街道|公园/],
    ["可持续城市", /\b(sustainab|climate|resilien|carbon|energy|green|ecology|nature-based)\b|可持续|气候|韧性|低碳|生态/],
    ["住房", /\b(housing|neighbourhood|neighborhood|community|real estate)\b|住房|社区|房地产/],
    ["城市治理", /\b(governance|policy|justice|equity|inequality|participation)\b|治理|政策|公平|不平等/],
    ["城市设计", /\b(urban design|built environment|morphology|form|architecture)\b|城市设计|建成环境|形态/]
  ];
  const inferred = rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return uniqueValues([
    ...(source.tags || []),
    ...inferred,
    ...extras.map((value) => cleanTitle(value)).filter(Boolean)
  ]).filter((keyword) => keyword.length <= 32).slice(0, 8);
}

function feedKeywords(item) {
  return uniqueValues([...(item.keywords || []), ...(item.tags || [])]).filter(Boolean);
}

function uniqueValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = cleanTitle(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeKey(value) {
  return String(value || "").trim().replace(/[#?].*$/, "").toLowerCase();
}

function toAbsoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (error) {
    return value || baseUrl || "#home";
  }
}

async function fetchText(url) {
  try {
    const direct = await fetchWithTimeout(url, { headers: { Accept: "application/rss+xml, application/xml, text/html" } });
    if (direct.ok) return direct.text();
  } catch (error) {
    // Fall through to proxy.
  }

  const proxied = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) throw new Error(`Proxy failed ${url}`);
  return proxied.text();
}

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildFallbackItems(labSources, journalSources) {
  const journalFallbacks = journalSources
    .map((source) => fallbackSourceItem(source, "publication"));

  const labFallbacks = labSources.map(fallbackLabItem);
  return [...journalFallbacks, ...labFallbacks];
}

function fallbackLabItem(source) {
  return fallbackSourceItem(source, "updates");
}

function fallbackSourceItem(source, fallbackKind) {
  const title = fallbackKind === "publication"
    ? `${source.name} latest publications`
    : `${source.name} latest updates`;
  return {
    title,
    fallbackKind,
    source: source.name,
    sourceId: source.id,
    kind: source.type === "journal" ? "paper" : "lab",
    date: "",
    url: source.latestUrl || source.url,
    excerpt: sourceDescription(source),
    summary: sourceDescription(source),
    keywords: source.tags,
    tags: source.tags
  };
}

function getFeedSeedItems() {
  return [{
    title: t("feed.seedTitle"),
    source: t("feed.seedSource"),
    kind: "notice",
    date: "",
    url: "#home",
    summary: t("feed.seedSummary"),
    tags: [t("labels.note")]
  }];
}

function localizeFeedTitle(item) {
  if (item.fallbackKind === "publication") return t("feed.latestPublication")(item.source);
  if (item.fallbackKind === "updates") return t("feed.latestUpdates")(item.source);
  return item.title;
}

function localizeFeedSummary(item) {
  if (item.sourceId && (item.fallbackKind || item.summary === findSourceById(item.sourceId)?.description)) {
    const source = findSourceById(item.sourceId);
    if (source) return sourceDescription(source);
  }
  return buildInitialSummary(item);
}

function buildInitialSummary(item) {
  const keywords = feedKeywords(item).slice(0, 3);
  const keywordText = keywords.map(localizeTag).join(state.lang === "zh" ? "、" : ", ");
  const excerpt = compactText(item.excerpt || item.summary || "", 120);
  const source = item.source || "";
  if (state.lang === "zh") {
    const subject = keywordText || source;
    if (item.kind === "paper") {
      return excerpt
        ? `这篇最新论文聚焦 ${subject}。官方摘要要点：${excerpt}`
        : `这篇最新论文题名显示其聚焦 ${subject}，适合继续查看全文的方法、案例与结论。`;
    }
    return excerpt
      ? `该机构最新动态聚焦 ${subject}。官方页面要点：${excerpt}`
      : `该机构最新动态与 ${subject} 相关，可用于跟踪 ${source} 的近期研究方向。`;
  }
  const subject = keywordText || source;
  if (item.kind === "paper") {
    return excerpt
      ? `This recent paper focuses on ${subject}. Official excerpt: ${excerpt}`
      : `This recent paper appears to focus on ${subject}; open the source to review methods, cases, and findings.`;
  }
  return excerpt
    ? `This official update focuses on ${subject}. Source excerpt: ${excerpt}`
    : `This official update is related to ${subject} and helps track recent work from ${source}.`;
}

function findSourceById(id) {
  return SOURCES.find((source) => source.id === id);
}

function sourceTypeLabel(type) {
  return t(`labels.${type}`);
}

function feedKindLabel(kind) {
  if (kind === "paper") return t("labels.paper");
  if (kind === "notice") return t("labels.notice");
  return t("labels.progress");
}

function sourceDescription(source) {
  if (state.lang === "zh") return source.description;
  const tags = source.tags.map(localizeTag).filter(Boolean).slice(0, 3).join(", ");
  const region = localizeRegion(source.region);
  const type = source.type === "journal" ? "publication source" : source.type;
  return `A ${type} based in ${region}, focused on ${tags}.`;
}

function searchableSourceText(source) {
  return [
    source.name,
    source.region,
    localizeRegion(source.region),
    source.folder,
    source.description,
    sourceDescription(source),
    source.includeReason,
    sourceTypeLabel(source.type),
    ...source.tags,
    ...source.tags.map(localizeTag)
  ].join(" ").toLowerCase();
}

function localizeRegion(value) {
  if (state.lang === "zh") return value;
  return value
    .split("/")
    .map((part) => regionTranslations[part] || part)
    .join(" / ");
}

function localizeTag(value) {
  if (state.lang === "zh") return value;
  return tagTranslations[value] || value;
}

function t(path) {
  return path.split(".").reduce((value, key) => value?.[key], i18n[state.lang]) ?? path;
}

function loadLanguage() {
  try {
    return localStorage.getItem("urbanResearchLang") === "en" ? "en" : "zh";
  } catch (error) {
    return "zh";
  }
}

function saveLanguage(lang) {
  try {
    localStorage.setItem("urbanResearchLang", lang);
  } catch (error) {
    // Ignore storage failures in private or locked-down browsing contexts.
  }
}

function extractCrossrefDate(item) {
  const parts =
    item.published?.["date-parts"] ||
    item["published-print"]?.["date-parts"] ||
    item["published-online"]?.["date-parts"] ||
    item.created?.["date-parts"];
  if (!parts || !parts[0]) return "";
  const [year, month = 1, day = 1] = parts[0];
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateScore(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatLooseDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 18);
  return date.toISOString().slice(0, 10);
}

function compactText(value, limit = 220) {
  const text = cleanTitle(value);
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}

function cleanTitle(value) {
  return stripHtml(value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  const node = document.createElement("div");
  node.innerHTML = value;
  return node.textContent || node.innerText || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
