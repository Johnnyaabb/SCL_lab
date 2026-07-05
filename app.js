const state = {
  sourceFilter: "all",
  litFilter: "all",
  dataFilter: "all",
  vizFilter: "all",
  bookFilter: "all",
  programFilter: "all",
  feedFilter: "all",
  user: null,
  favorites: new Set(),
  authMode: "login",
  query: "",
  queryRaw: "",
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

// 多个公共 CORS 代理，按顺序兜底；任一可用即返回。
// {build} 接收原始 url，返回代理后的请求地址。
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`
];

// 抓取结果缓存：同一 url 在该时间窗内复用，避免每次刷新都重新请求。
const FETCH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟
const FETCH_CACHE_PREFIX = "scl:fetch:";

// 未显式配置 RSS 的来源，按常见端点自动探测（覆盖 WordPress 与 Hugo/Jekyll 静态站）。
const GUESS_FEED_PATHS = ["/feed/", "/index.xml", "/?feed=rss2"];

const SOURCE_LOGO_OVERRIDES = {
  "mit-senseable": { domains: ["mit.edu"] },
  "mit-city-form": { domains: ["mit.edu"] },
  "harvard-maps": { domains: ["gsd.harvard.edu", "harvard.edu"] },
  "harvard-real": { domains: ["gsd.harvard.edu", "harvard.edu"] },
  "beijing-city-lab": { domains: ["www.beijingcitylab.com"] },
  "hku-dil": { domains: ["hku.hk"] },
  "shanghai-global-city": {
    urls: ["https://www.shnu.edu.cn/_upload/tpl/03/a5/933/template933/images/logo.svg"],
    domains: ["shnu.edu.cn"]
  },
  "src-street": { urls: ["http://www.streetsrc.com/template/Index/Common/img/logo.png"] },
  "columbia-csr": { domains: ["columbia.edu", "c4sr.columbia.edu"] },
  "hcu-city-science-lab": {
    urls: ["https://www.hcu-hamburg.de/fileadmin/images/HCU_Logo.svg"]
  },
  "african-centre-cities": {
    urls: [
      "https://www.africancentreforcities.net/wp-content/uploads/2020/06/acc-logo-150x150.png",
      "https://www.africancentreforcities.net/wp-content/uploads/2020/06/acc-logo.png"
    ],
    domains: ["africancentreforcities.net", "uct.ac.za"]
  },
  "polyu-scri": {
    urls: ["https://www.polyu.edu.hk/scri/-/media/department/scri/setting/scri_primary_logo_color_horizontal.png?bc=ffffff&h=64&mw=350&rev=6902d82a399845f680336d12bfaf07f4&hash=FFB66F04B22A70EBA869ED2A1CC20A3E"],
    domains: ["polyu.edu.hk"]
  },
  "nature-cities": { domains: ["nature.com"] },
  epb: { domains: ["sagepub.com", "journals.sagepub.com"] },
  "urban-studies": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "journal-planning-education-research": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "journal-planning-literature": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "environment-urbanization": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "environment-urbanization-asia": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "european-urban-regional-studies": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "journal-urban-history": { domains: ["sagepub.com", "journals.sagepub.com"] },
  "urban-research-practice": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "journal-urban-affairs": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "urban-geography": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "journal-urban-technology": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "journal-urban-design": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "city-journal": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "housing-studies": { domains: ["taylorandfrancis.com", "tandfonline.com"] },
  "city-community": { domains: ["wiley.com", "onlinelibrary.wiley.com"] },
  ijurr: { domains: ["wiley.com", "onlinelibrary.wiley.com"] },
  "springer-urban-studies": { domains: ["springer.com"] },
  "urban-ecosystems": { domains: ["springer.com", "link.springer.com"] }
};

const i18n = {
  zh: {
    meta: {
      title: "SCL城市研究所",
      description: "用于快速查阅全球城市研究实验室、研究机构与城市研究期刊最新动态的前沿资讯导航站。"
    },
    brand: { title: "SCL城市研究所" },
    nav: { home: "首页", library: "资源库", literature: "文献检索", bigdata: "多源数据", dataviz: "研究工具集", books: "书籍推荐", programs: "院校申请" },
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
      download: "下载资料",
      open: "打开",
      book: "图书条目",
      apply: "申请入口"
    },
    search: {
      label: "全站检索",
      placeholder: "搜索机构、期刊、数据、工具、主题关键词",
      resultSummary: (count, query) => `找到 ${count} 个与“${query}”相关的内容`,
      noResults: (query) => `没有找到与“${query}”匹配的内容`,
      page: "页面",
      source: "机构资源",
      literature: "文献检索",
      dataSource: "多源数据",
      vizTool: "可视化工具",
      book: "经典书籍",
      program: "院校申请",
      news: "资讯"
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
    literature: {
      title: "学术文献与检索",
      note: "面向城市研究的文献检索入口：综合搜索、引文索引、开放获取、中文库与文献探索工具。标注「需订阅」的多需机构订阅或登录。",
      empty: "没有匹配的文献入口，换个关键词试试。"
    },
    litCat: {
      all: "全部",
      general: "综合检索",
      index: "引文索引",
      oa: "开放获取",
      cn: "中文文献",
      tool: "探索工具"
    },
    bigdata: {
      title: "城市多源大数据",
      note: "面向城市研究的多源数据入口：政府开放数据、地理与遥感、时空人口、地图API与专题数据，均链接至官方下载或接口。",
      empty: "没有匹配的数据源，换个关键词试试。"
    },
    dataviz: {
      title: "城市研究工具集",
      note: "面向城市研究的工具集：城市分析平台、图表与BI、地理可视化、编程库、词云文本与统计分析。",
      empty: "没有匹配的工具，换个关键词试试。"
    },
    dataCat: {
      all: "全部",
      gov: "政府开放",
      geo: "地理遥感",
      mobility: "时空人口",
      api: "地图API",
      thematic: "专题数据"
    },
    vizCat: {
      all: "全部",
      analysis: "分析工具",
      chart: "图表与BI",
      geo: "地理可视化",
      code: "编程库",
      text: "词云文本",
      stat: "统计分析"
    },
    books: {
      title: "城市研究经典书籍",
      note: "精选城市研究、城市设计与规划领域的经典著作，涵盖公共生活、城市理论、城市形态与城市设计。",
      empty: "没有匹配的书籍，换个关键词试试。"
    },
    bookCat: {
      all: "全部",
      public: "公共生活",
      theory: "城市理论",
      form: "城市形态",
      design: "城市设计"
    },
    programs: {
      title: "全球城市研究院校申请",
      note: "面向城市研究、城市分析、城市科学与城市信息学方向的全球院校与实验室名单，含研究方向、主导老师与申请入口，供留学申请参考。",
      empty: "没有匹配的院校，换个关键词试试。",
      piLabel: "主导老师"
    },
    progCat: {
      all: "全部",
      apac: "亚太",
      na: "北美",
      eu: "欧洲"
    },
    auth: {
      login: "登录",
      logout: "登出",
      register: "注册",
      account: "账户",
      myFavorites: "我的收藏",
      loginTitle: "登录",
      registerTitle: "注册",
      demoNote: "首次登录即注册，密码至少 6 位；收藏会同步到你的账号。",
      favNote: "你收藏的机构、数据、工具、书籍与院校，已同步到你的账号，换设备登录也能看到。",
      emailLabel: "邮箱",
      passwordLabel: "密码",
      toRegister: "没有账号？去注册",
      toLogin: "已有账号？去登录",
      favAria: "收藏 / 取消收藏",
      favEmpty: "还没有收藏。点击任意卡片右下角的 ★ 即可收藏。",
      favNeedLogin: "登录后查看你收藏的机构、数据、工具、书籍与院校，跨设备同步。",
      registerSuccess: "注册成功！请到邮箱点击验证链接，验证后回到这里登录。",
      errEmail: "请输入有效邮箱",
      errPassword: "密码至少 6 位",
      errNotRegistered: "该邮箱尚未注册，请先注册",
      errExists: "该邮箱已注册，请直接登录"
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
      summary: "初步总结",
      subscription: "需订阅"
    },
    footer: {
      title: "SCL城市研究所",
      tagline: "城市研究资源导航",
      desc: "汇集城市研究实验室、机构、期刊、文献、数据、工具与经典书籍的一站式导航。",
      navTitle: "资源导航",
      quickTitle: "快速链接",
      backTop: "回到顶部",
      source: "数据来源：城市研究相关收藏夹与全网检索整理。",
      meta: (n) => `共 ${n} 项资源 · 支持中英文检索`
    }
  },
  en: {
    meta: {
      title: "SCL Urban Research Institute",
      description: "A curated navigation site for global urban research labs, institutions, journals, and recent signals."
    },
    brand: { title: "SCL Urban Research Institute" },
    nav: { home: "Home", library: "Library", literature: "Literature", bigdata: "Big Data", dataviz: "Toolkit", books: "Books", programs: "Programs" },
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
      download: "Download",
      open: "Open",
      book: "Book Page",
      apply: "How to Apply"
    },
    search: {
      label: "Site Search",
      placeholder: "Search institutions, journals, data, tools, and topics",
      resultSummary: (count, query) => `${count} results for "${query}"`,
      noResults: (query) => `No results found for "${query}"`,
      page: "Page",
      source: "Source",
      literature: "Literature",
      dataSource: "Big Data",
      vizTool: "Viz Tool",
      book: "Book",
      program: "Program",
      news: "News"
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
    literature: {
      title: "Academic Literature & Search",
      note: "Literature-search entries for urban research: general search, citation indexes, open access, Chinese databases, and discovery tools. Items marked \"Subscription\" usually require institutional access.",
      empty: "No literature entries match this search. Try a different keyword."
    },
    litCat: {
      all: "All",
      general: "General Search",
      index: "Citation Index",
      oa: "Open Access",
      cn: "Chinese DB",
      tool: "Discovery"
    },
    bigdata: {
      title: "Urban Multi-source Big Data",
      note: "Multi-source data entries for urban research: open government data, geospatial and remote sensing, spatiotemporal population, map APIs, and thematic data — each links to an official download or API.",
      empty: "No data sources match this search. Try a different keyword."
    },
    dataviz: {
      title: "Urban Research Toolkit",
      note: "A toolkit for urban research: urban analysis platforms, charts and BI, geovisualization, programming libraries, word clouds, and statistical analysis.",
      empty: "No tools match this search. Try a different keyword."
    },
    dataCat: {
      all: "All",
      gov: "Open Gov",
      geo: "Geo & RS",
      mobility: "People & Time",
      api: "Map API",
      thematic: "Thematic"
    },
    vizCat: {
      all: "All",
      analysis: "Analysis Tools",
      chart: "Charts & BI",
      geo: "Geovisualization",
      code: "Libraries",
      text: "Word Cloud",
      stat: "Statistics"
    },
    books: {
      title: "Classic Urban Studies Books",
      note: "A curated shelf of classics in urban studies, urban design, and planning — spanning public life, urban theory, urban form, and urban design.",
      empty: "No books match this search. Try a different keyword."
    },
    bookCat: {
      all: "All",
      public: "Public Life",
      theory: "Urban Theory",
      form: "Urban Form",
      design: "Urban Design"
    },
    programs: {
      title: "Global Urban Research Programs",
      note: "A worldwide shortlist of universities and labs in urban research, urban analytics, urban science, and urban informatics — with research areas, lead faculty, and how-to-apply links.",
      empty: "No programs match this search. Try a different keyword.",
      piLabel: "Lead"
    },
    progCat: {
      all: "All",
      apac: "Asia-Pacific",
      na: "North America",
      eu: "Europe"
    },
    auth: {
      login: "Sign In",
      logout: "Sign Out",
      register: "Sign Up",
      account: "Account",
      myFavorites: "My Favorites",
      loginTitle: "Sign In",
      registerTitle: "Create Account",
      demoNote: "First sign-in creates your account; password must be at least 6 characters. Favorites sync to your account.",
      favNote: "Institutions, data, tools, books, and programs you saved — synced to your account, so they follow you across devices.",
      emailLabel: "Email",
      passwordLabel: "Password",
      toRegister: "No account? Sign up",
      toLogin: "Have an account? Sign in",
      favAria: "Save / unsave",
      favEmpty: "No favorites yet. Tap the ★ on any card to save it.",
      favNeedLogin: "Sign in to see the institutions, data, tools, books, and programs you saved — synced across devices.",
      registerSuccess: "Account created! Check your email for the verification link, then sign in here.",
      errEmail: "Enter a valid email",
      errPassword: "Password must be at least 6 characters",
      errNotRegistered: "This email is not registered yet — please sign up",
      errExists: "This email is already registered — please sign in"
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
      summary: "First-pass Summary",
      subscription: "Subscription"
    },
    footer: {
      title: "SCL Urban Research Institute",
      tagline: "Urban research resource hub",
      desc: "A one-stop navigator for urban research labs, institutions, journals, literature, data, tools, and classic books.",
      navTitle: "Resources",
      quickTitle: "Quick Links",
      backTop: "Back to Top",
      source: "Sources: curated urban-research bookmarks and web research.",
      meta: (n) => `${n} resources · bilingual search supported`
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
  全球南方: "Global South",
  日本: "Japan",
  澳大利亚: "Australia",
  意大利: "Italy"
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
  "预印本": "preprints",
  "政府数据": "government data",
  "人口数据": "population data",
  "社会经济": "socioeconomic",
  "全球指标": "global indicators",
  "经济数据": "economic data",
  "统计数据": "statistics",
  "人道数据": "humanitarian data",
  "遥感": "remote sensing",
  "卫星影像": "satellite imagery",
  "高程数据": "elevation data",
  "对地观测": "earth observation",
  "地理空间": "geospatial",
  "云计算": "cloud computing",
  "开放地图": "open map data",
  "行政边界": "administrative boundaries",
  "栅格数据": "gridded data",
  "时空数据": "spatiotemporal data",
  "位置大数据": "location big data",
  "人口热力": "population heat",
  "移动数据": "mobile data",
  "地理大数据": "geospatial big data",
  "决策咨询": "decision consulting",
  "数据社区": "data community",
  "地图API": "map API",
  "路径规划": "routing",
  "人口迁徙": "population flows",
  "气象数据": "meteorological data",
  "交通数据": "traffic data",
  "拥堵指数": "congestion index",
  "搜索指数": "search index",
  "舆情": "public opinion",
  "趋势分析": "trend analysis",
  "地铁客流": "metro ridership",
  "可视化": "visualization",
  "可视化库": "visualization library",
  "图表库": "charting library",
  "在线图表": "online charts",
  "商业智能": "business intelligence",
  "仪表盘": "dashboards",
  "数据分析": "data analytics",
  "数据新闻": "data journalism",
  "探索性可视化": "exploratory visualization",
  "动态可视化": "animated visualization",
  "图形语法": "grammar of graphics",
  "快速绘图": "rapid charting",
  "声明式": "declarative",
  "多语言": "multi-language",
  "交互图表": "interactive charts",
  "开源": "open source",
  "WebGL": "WebGL",
  "地理可视化": "geovisualization",
  "大数据地图": "big-data maps",
  "大规模数据": "large-scale data",
  "三维可视化": "3D visualization",
  "数据探索": "data exploration",
  "交互": "interaction",
  "流向图": "flow maps",
  "OD可视化": "OD visualization",
  "交互地图": "interactive maps",
  "地图库": "mapping library",
  "空间可视化": "spatial visualization",
  "在线制图": "online mapping",
  "数据地图": "data maps",
  "图可视化": "graph visualization",
  "地图制图": "cartography",
  "词云": "word cloud",
  "文本可视化": "text visualization",
  "词频分析": "word frequency",
  "在线工具": "online tool",
  "统计分析": "statistical analysis",
  "在线SPSS": "online SPSS",
  "问卷分析": "survey analysis",
  "图表词典": "chart dictionary",
  "设计参考": "design reference",
  "AntV": "AntV",
  "SVG": "SVG",
  "学术搜索": "academic search",
  "免费": "free",
  "引文追踪": "citation tracking",
  "AI检索": "AI search",
  "论文图谱": "paper graph",
  "学术图谱": "scholarly graph",
  "元数据": "metadata",
  "全文聚合": "full-text aggregation",
  "引文索引": "citation index",
  "核心合集": "core collection",
  "文献计量": "bibliometrics",
  "摘要库": "abstract database",
  "科研情报": "research intelligence",
  "文献专利": "papers & patents",
  "检索": "search",
  "期刊目录": "journal directory",
  "全文存档": "full-text archive",
  "中文库": "Chinese database",
  "期刊论文": "journal papers",
  "学位论文": "theses & dissertations",
  "图书文献": "books & literature",
  "文献图谱": "literature graph",
  "可视化探索": "visual discovery",
  "引文分析": "citation analysis",
  "智能引用": "smart citations",
  "文献评估": "literature assessment",
  "人的尺度": "human scale",
  "公共生活": "public life",
  "步行": "walking",
  "行为观察": "behavioral observation",
  "广场": "plazas",
  "调研方法": "survey methods",
  "城市活力": "urban vitality",
  "文明": "civilization",
  "集聚": "agglomeration",
  "规划史": "planning history",
  "田园城市": "garden city",
  "城市意象": "urban imageability",
  "认知地图": "cognitive mapping",
  "城市肌理": "urban fabric",
  "城市美学": "urban aesthetics",
  "外部空间": "exterior space",
  "模式语言": "pattern language",
  "步行城市": "walkability",
  "可持续": "sustainability",
  "第三空间": "third places",
  "公共健康": "public health",
  "批判地理": "critical geography",
  "社会公正": "social justice",
  "类型学": "typology",
  "集体记忆": "collective memory",
  "序列视景": "serial vision",
  "建筑理论": "architectural theory",
  "城市文化": "urban culture",
  "城市空间": "urban space",
  "历史案例": "historic cases",
  "空间尺度": "spatial scale",
  "地理数据科学": "geospatial data science",
  "3D城市模型": "3D city models",
  "空间数据科学": "spatial data science",
  "复杂系统": "complex systems",
  "等时圈": "isochrones",
  "可达性": "accessibility",
  "场地分析": "site analysis",
  "规划分析": "planning analytics",
  "情景模拟": "scenario modeling",
  "公交可达": "transit access",
  "三维规划": "3D planning",
  "社会分析": "social analytics",
  "生成式设计": "generative design",
  "AI分析": "AI analysis",
  "活动数据": "activity data",
  "地理空间分析": "geospatial analysis",
  "云平台": "cloud platform"
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadSession();
  bindEvents();
  bindAuthEvents();
  bindAuthStateSync();
  applyTranslations();
  renderMetrics();
  renderAccount();
  renderSources();
  renderLiterature();
  renderDataSources();
  renderVizTools();
  renderBooks();
  renderPrograms();
  renderFavorites();
  renderFeed(getFeedSeedItems());
  renderGlobalSearchResults();
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
      renderGlobalSearchResults();
    });
  });

  document.querySelectorAll("[data-lit-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.litFilter = button.dataset.litFilter;
      setActiveButton("[data-lit-filter]", button);
      renderLiterature();
      renderGlobalSearchResults();
    });
  });

  document.querySelectorAll("[data-data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dataFilter = button.dataset.dataFilter;
      setActiveButton("[data-data-filter]", button);
      renderDataSources();
      renderGlobalSearchResults();
    });
  });

  document.querySelectorAll("[data-viz-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.vizFilter = button.dataset.vizFilter;
      setActiveButton("[data-viz-filter]", button);
      renderVizTools();
      renderGlobalSearchResults();
    });
  });

  document.querySelectorAll("[data-book-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.bookFilter = button.dataset.bookFilter;
      setActiveButton("[data-book-filter]", button);
      renderBooks();
      renderGlobalSearchResults();
    });
  });

  document.querySelectorAll("[data-program-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.programFilter = button.dataset.programFilter;
      setActiveButton("[data-program-filter]", button);
      renderPrograms();
      renderGlobalSearchResults();
    });
  });

  document.querySelectorAll("[data-feed-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.feedFilter = button.dataset.feedFilter;
      setActiveButton("[data-feed-filter]", button);
      renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
      renderGlobalSearchResults();
    });
  });

  const searchInput = document.getElementById("globalSearch");
  if (searchInput) searchInput.addEventListener("input", (event) => {
    state.queryRaw = event.target.value.trim();
    state.query = state.queryRaw.toLowerCase();
    renderSources();
    renderLiterature();
    renderDataSources();
    renderVizTools();
    renderBooks();
    renderPrograms();
    renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
    renderGlobalSearchResults();
  });

  const refreshBtn = document.getElementById("refreshFeeds");
  if (refreshBtn) refreshBtn.addEventListener("click", refreshFrontiers);

  initFilterAria();
}

function setLanguage(lang) {
  if (!i18n[lang] || state.lang === lang) return;
  state.lang = lang;
  saveLanguage(lang);
  applyTranslations();
  renderMetrics();
  renderSources();
  renderLiterature();
  renderDataSources();
  renderVizTools();
  renderBooks();
  renderPrograms();
  renderAccount();
  renderFavorites();
  applyAuthMode();
  renderFeed(state.feedItems.length ? state.feedItems : getFeedSeedItems());
  renderGlobalSearchResults();
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
  document.querySelectorAll(selector).forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

// 为筛选按钮组设置初始 aria-pressed（与 .is-active 对齐）。
function initFilterAria() {
  ["[data-source-filter]", "[data-lit-filter]", "[data-data-filter]", "[data-viz-filter]", "[data-book-filter]", "[data-program-filter]", "[data-feed-filter]"].forEach((selector) => {
    document.querySelectorAll(selector).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
    });
  });
}

function renderMetrics() {
  const journals = SOURCES.filter((source) => source.type === "journal").length;
  const labs = SOURCES.filter((source) => source.type === "lab" || source.type === "institution").length;
  const totalEl = document.getElementById("totalSources");
  if (totalEl) {
    totalEl.textContent = SOURCES.length;
    document.getElementById("journalCount").textContent = journals;
    document.getElementById("labCount").textContent = labs;
  }

  const footerMeta = document.getElementById("footerMeta");
  if (footerMeta) {
    const total = SOURCES.length +
      (typeof ACADEMIC_SOURCES !== "undefined" ? ACADEMIC_SOURCES.length : 0) +
      (typeof URBAN_DATA_SOURCES !== "undefined" ? URBAN_DATA_SOURCES.length : 0) +
      (typeof DATAVIZ_TOOLS !== "undefined" ? DATAVIZ_TOOLS.length : 0) +
      (typeof BOOKS !== "undefined" ? BOOKS.length : 0);
    footerMeta.textContent = t("footer.meta")(total);
  }
}

function renderSources() {
  const grid = document.getElementById("sourceGrid");
  if (!grid) return;
  const sources = filteredSources();

  if (!sources.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("library.empty"))}</div>`;
    return;
  }

  grid.innerHTML = sources.map((source) => `
    <article class="source-card source-card--${source.type}">
      <h3 class="source-title">
        <span class="source-title-main">
          <span class="source-logo" data-fallback="${escapeHtml(sourceLogoInitials(source.name))}" aria-hidden="true">
            ${sourceLogoImage(source)}
          </span>
          <span>${escapeHtml(source.name)}</span>
        </span>
        <span class="source-region">${escapeHtml(localizeRegion(source.region))}</span>
      </h3>
      <p>${escapeHtml(sourceDescription(source))}</p>
      <div class="tag-row">
        ${source.tags.map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
      </div>
      <div class="card-actions">
        <a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.official"))}</a>
        <a href="${source.latestUrl || source.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.latest"))}</a>
        ${favoriteButton("source", source.id)}
      </div>
    </article>
  `).join("");
  activateSourceLogos(grid);
}

function filteredSources() {
  return SOURCES.filter((source) => {
    const matchesType = state.query || state.sourceFilter === "all" || source.type === state.sourceFilter;
    return matchesType && (!state.query || searchableSourceText(source).includes(state.query));
  });
}

// 各分类的主题图标（lucide 风格线性 SVG，随卡片 accent 着色）。
const CATEGORY_ICON_PATHS = {
  litCat: {
    general: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    index: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    oa: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    cn: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>',
    tool: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/>'
  },
  dataCat: {
    gov: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    geo: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    mobility: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    api: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    thematic: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
  },
  vizCat: {
    analysis: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    geo: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    text: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    stat: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'
  },
  bookCat: {
    public: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    theory: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/>',
    form: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    design: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'
  }
};

function categoryIcon(namespace, category) {
  const paths = (CATEGORY_ICON_PATHS[namespace] || {})[category] || "";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

// 城市多源大数据 / 数据可视化工具 / 学术文献与检索：复用一套卡片渲染。
function renderDataSources() {
  renderResourceGrid("bigdataGrid", URBAN_DATA_SOURCES, "data", state.dataFilter, "dataCat", "bigdata.empty");
}

function renderVizTools() {
  renderResourceGrid("datavizGrid", DATAVIZ_TOOLS, "viz", state.vizFilter, "vizCat", "dataviz.empty");
}

function renderLiterature() {
  renderResourceGrid("literatureGrid", ACADEMIC_SOURCES, "lit", state.litFilter, "litCat", "literature.empty");
}

// 城市研究经典书籍：专用卡片（含作者与年份），链接到豆瓣搜索。
function renderBooks() {
  const grid = document.getElementById("booksGrid");
  if (!grid || typeof BOOKS === "undefined") return;

  const items = BOOKS.filter((book) => {
    const matchesCat = state.query || state.bookFilter === "all" || book.category === state.bookFilter;
    return matchesCat && (!state.query || searchableBookText(book).includes(state.query));
  });

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("books.empty"))}</div>`;
    return;
  }

  grid.innerHTML = items.map((book) => `
    <article class="resource-card book-card">
      <div class="resource-top">
        <span class="resource-cat">${escapeHtml(t(`bookCat.${book.category}`))}</span>
        <span class="resource-origin">${escapeHtml(String(book.year))}</span>
      </div>
      <div class="resource-head">
        <span class="resource-icon">${categoryIcon("bookCat", book.category)}</span>
        <h3>${escapeHtml(bookTitle(book))}</h3>
      </div>
      <p class="book-author">${escapeHtml(book.author)}</p>
      <p>${escapeHtml(bookDescription(book))}</p>
      <div class="tag-row">
        ${book.tags.map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
      </div>
      <div class="card-actions">
        <a href="${bookUrl(book)}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.book"))}</a>
        ${favoriteButton("book", book.id)}
      </div>
    </article>
  `).join("");
}

function bookTitle(book) {
  return state.lang === "zh" ? book.title : book.titleEn;
}

function bookDescription(book) {
  return state.lang === "zh" ? book.description : (book.descriptionEn || book.description);
}

function bookUrl(book) {
  return `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(book.title)}`;
}

function searchableBookText(book) {
  return [
    book.title,
    book.titleEn,
    book.author,
    String(book.year),
    t(`bookCat.${book.category}`),
    book.description,
    book.descriptionEn,
    ...book.tags,
    ...book.tags.map(localizeTag)
  ].join(" ").toLowerCase();
}

// 海外城市分析院校申请：专用卡片（学校 + 实验室 + 主导老师 + 申请入口）。
const PROGRAM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/></svg>';

function renderPrograms() {
  const grid = document.getElementById("programsGrid");
  if (!grid || typeof OVERSEAS_PROGRAMS === "undefined") return;

  const items = OVERSEAS_PROGRAMS.filter((program) => {
    const matchesCat = state.query || state.programFilter === "all" || program.category === state.programFilter;
    return matchesCat && (!state.query || searchableProgramText(program).includes(state.query));
  });

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("programs.empty"))}</div>`;
    return;
  }

  grid.innerHTML = items.map((program) => `
    <article class="resource-card program-card">
      <div class="resource-top">
        <span class="resource-cat">${escapeHtml(t(`progCat.${program.category}`))}</span>
        <span class="resource-origin">${escapeHtml(localizeRegion(program.region))}</span>
      </div>
      <div class="resource-head">
        <span class="resource-icon">${PROGRAM_ICON}</span>
        <h3>${escapeHtml(program.school)}</h3>
      </div>
      <p class="program-lab">${escapeHtml(program.lab)}</p>
      <p class="program-meta">${escapeHtml(t("programs.piLabel"))}: ${escapeHtml(program.pi)}</p>
      <p>${escapeHtml(programDescription(program))}</p>
      <div class="tag-row">
        ${program.tags.map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
      </div>
      <div class="card-actions">
        <a href="${program.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.apply"))}</a>
        ${favoriteButton("program", program.id)}
      </div>
    </article>
  `).join("");
}

function programDescription(program) {
  return state.lang === "zh" ? program.description : (program.descriptionEn || program.description);
}

function searchableProgramText(program) {
  return [
    program.school,
    program.lab,
    program.pi,
    program.region,
    localizeRegion(program.region),
    t(`progCat.${program.category}`),
    program.description,
    program.descriptionEn,
    ...program.tags,
    ...program.tags.map(localizeTag)
  ].join(" ").toLowerCase();
}

/* ============================================================
   用户登录 + 收藏（Supabase 后端）
   - 账号走 Supabase Auth（邮箱+密码），不自建用户表。
   - 收藏存 public.favorites 表，每行 = 某用户收藏的某张卡。
   - state.favorites 仍是 Set("type:id")，UI 层逻辑不变。
   连接凭证在 supabase-config.js 里填写。
   ============================================================ */
const STAR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

// 初始化 Supabase 客户端（配置缺失时为 null，登录/收藏会给出提示）
const sbClient = (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY
    && !/你的项目ID|把你的/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY))
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

// 从后端拉取当前用户的收藏，填充 state.favorites（Set("type:id")）
async function loadFavorites() {
  state.favorites = new Set();
  if (!sbClient || !state.user) return;
  const { data, error } = await sbClient
    .from("favorites")
    .select("item_type,item_id")
    .eq("user_id", state.user.id);
  if (error) { console.error("加载收藏失败", error); return; }
  data.forEach((row) => state.favorites.add(`${row.item_type}:${row.item_id}`));
}

// 启动时恢复已登录会话（Supabase 会自动持久化 token）
async function loadSession() {
  state.user = null;
  state.favorites = new Set();
  if (!sbClient) return;
  const { data } = await sbClient.auth.getSession();
  const session = data && data.session;
  if (session) {
    state.user = { id: session.user.id, email: session.user.email };
    await loadFavorites();
  }
}

async function registerUser(email, password) {
  const { data, error } = await sbClient.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("confirmEmail"); // 开了邮箱验证，需先验证
  state.user = { id: data.user.id, email: data.user.email };
  await loadFavorites();
}

async function loginUser(email, password) {
  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  state.user = { id: data.user.id, email: data.user.email };
  await loadFavorites();
}

async function logoutUser() {
  if (sbClient) await sbClient.auth.signOut();
  state.user = null;
  state.favorites = new Set();
}

// 跨标签页 / token 过期时同步登录态：任一标签页登录或登出，其它标签页自动跟随
function bindAuthStateSync() {
  if (!sbClient) return;
  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return; // 初始会话已由 loadSession 处理
    const prevId = state.user ? state.user.id : null;
    const nextId = session ? session.user.id : null;
    if (prevId === nextId) return; // 无实质变化（如纯 token 刷新），不重复渲染
    // 官方建议：勿在回调里直接 await 其它 supabase 调用，用 setTimeout 延后以避免死锁
    setTimeout(async () => {
      if (session) {
        state.user = { id: session.user.id, email: session.user.email };
        await loadFavorites();
      } else {
        state.user = null;
        state.favorites = new Set();
      }
      afterAuthChange();
    }, 0);
  });
}

function isFavorited(type, id) {
  return state.favorites.has(`${type}:${id}`);
}

// 乐观更新：先改本地 Set，再写库；失败则回滚
async function toggleFavorite(type, id) {
  if (!sbClient || !state.user) return;
  const key = `${type}:${id}`;
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
    const { error } = await sbClient.from("favorites").delete()
      .eq("user_id", state.user.id).eq("item_type", type).eq("item_id", id);
    if (error) { console.error("取消收藏失败", error); state.favorites.add(key); }
  } else {
    state.favorites.add(key);
    const { error } = await sbClient.from("favorites")
      .insert({ user_id: state.user.id, item_type: type, item_id: id });
    if (error) { console.error("收藏失败", error); state.favorites.delete(key); }
  }
}

function favoriteButton(type, id) {
  const pressed = isFavorited(type, id);
  const label = escapeHtml(t("auth.favAria"));
  return `<button class="fav-btn" type="button" data-fav data-fav-type="${type}" data-fav-id="${escapeHtml(String(id))}" aria-pressed="${pressed}" aria-label="${label}" title="${label}">${STAR_ICON}</button>`;
}

async function handleFavClick(button) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  await toggleFavorite(button.dataset.favType, button.dataset.favId);
  syncFavButtons();
  renderFavorites();
}

function syncFavButtons() {
  document.querySelectorAll("[data-fav]").forEach((button) => {
    button.setAttribute("aria-pressed", String(isFavorited(button.dataset.favType, button.dataset.favId)));
  });
}

function resolveFavItem(type, id) {
  const find = (arr) => (typeof arr !== "undefined" ? arr.find((x) => x.id === id) : null);
  switch (type) {
    case "source": { const s = find(SOURCES); return s && { name: s.name, url: s.url, label: t("search.source") }; }
    case "data": { const s = find(URBAN_DATA_SOURCES); return s && { name: s.name, url: s.url, label: t("search.dataSource") }; }
    case "viz": { const s = find(DATAVIZ_TOOLS); return s && { name: s.name, url: s.url, label: t("search.vizTool") }; }
    case "lit": { const s = find(ACADEMIC_SOURCES); return s && { name: s.name, url: s.url, label: t("search.literature") }; }
    case "book": { const b = find(BOOKS); return b && { name: bookTitle(b), url: bookUrl(b), label: t("search.book") }; }
    case "program": { const p = find(OVERSEAS_PROGRAMS); return p && { name: `${p.school} · ${p.lab}`, url: p.url, label: t("search.program") }; }
    default: return null;
  }
}

function renderAccount() {
  const loginBtn = document.getElementById("loginBtn");
  const userBox = document.getElementById("accountUser");
  const emailEl = document.getElementById("accountEmail");
  if (!loginBtn || !userBox) return;
  if (state.user) {
    loginBtn.hidden = true;
    userBox.hidden = false;
    if (emailEl) emailEl.textContent = state.user.email;
  } else {
    loginBtn.hidden = false;
    userBox.hidden = true;
  }
}

function renderFavorites() {
  const section = document.getElementById("favorites");
  const grid = document.getElementById("favoritesGrid");
  if (!section || !grid) return;
  const isFavPage = document.body.dataset.page === "favorites";
  if (!state.user) {
    if (isFavPage) {
      // 收藏独立页：未登录时给出提示与登录入口，而不是留白
      section.hidden = false;
      grid.innerHTML = `<div class="empty-state">
        <p>${escapeHtml(t("auth.favNeedLogin"))}</p>
        <button type="button" class="primary-button" data-open-login>${escapeHtml(t("auth.login"))}</button>
      </div>`;
    } else {
      section.hidden = true;
      grid.innerHTML = "";
    }
    return;
  }
  section.hidden = false;
  const items = [...state.favorites]
    .map((key) => {
      const idx = key.indexOf(":");
      return { type: key.slice(0, idx), id: key.slice(idx + 1) };
    })
    .map((fav) => ({ ...fav, data: resolveFavItem(fav.type, fav.id) }))
    .filter((fav) => fav.data);

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t("auth.favEmpty"))}</div>`;
    return;
  }
  grid.innerHTML = items.map((fav) => `
    <article class="resource-card fav-card">
      <div class="resource-top">
        <span class="resource-cat">${escapeHtml(fav.data.label)}</span>
      </div>
      <div class="resource-head">
        <h3>${escapeHtml(fav.data.name)}</h3>
      </div>
      <div class="card-actions">
        <a href="${fav.data.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.open"))}</a>
        ${favoriteButton(fav.type, fav.id)}
      </div>
    </article>
  `).join("");
}

function openAuthModal(mode) {
  state.authMode = mode || "login";
  const modal = document.getElementById("authModal");
  if (!modal) return;
  applyAuthMode();
  const err = document.getElementById("authError");
  if (err) { err.hidden = true; err.textContent = ""; }
  const form = document.getElementById("authForm");
  if (form) form.reset();
  modal.hidden = false;
  const email = document.getElementById("authEmail");
  if (email) email.focus();
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.hidden = true;
}

function applyAuthMode() {
  const isReg = state.authMode === "register";
  const title = document.getElementById("authTitle");
  const submit = document.getElementById("authSubmit");
  const switchBtn = document.getElementById("authSwitchBtn");
  const demo = document.getElementById("authDemo");
  if (title) title.textContent = t(isReg ? "auth.registerTitle" : "auth.loginTitle");
  if (submit) submit.textContent = t(isReg ? "auth.register" : "auth.login");
  if (switchBtn) switchBtn.textContent = t(isReg ? "auth.toLogin" : "auth.toRegister");
  if (demo) demo.textContent = t("auth.demoNote");
}

function showAuthError(message) {
  const err = document.getElementById("authError");
  if (err) { err.textContent = message; err.hidden = false; }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showAuthError(t("auth.errEmail")); return; }
  if (password.length < 6) { showAuthError(t("auth.errPassword")); return; }
  if (!sbClient) { showAuthError("后端未配置：请在 supabase-config.js 填入 Project URL 和 anon key"); return; }
  const submitBtn = document.getElementById("authSubmit");
  if (submitBtn) submitBtn.disabled = true;
  try {
    if (state.authMode === "register") await registerUser(email, password);
    else await loginUser(email, password);
  } catch (error) {
    const msg = String((error && error.message) || error);
    if (msg === "confirmEmail") {
      // 注册成功但需邮箱验证：切回登录 tab，用提示条给出正面反馈，保留邮箱、清空密码
      state.authMode = "login";
      applyAuthMode();
      const err = document.getElementById("authError");
      if (err) { err.hidden = true; err.textContent = ""; }
      const demo = document.getElementById("authDemo");
      if (demo) demo.textContent = t("auth.registerSuccess");
      const pw = document.getElementById("authPassword");
      if (pw) pw.value = "";
      return;
    }
    if (/already|registered/i.test(msg)) showAuthError(t("auth.errExists"));
    else if (/invalid login|credentials/i.test(msg)) showAuthError("邮箱或密码错误");
    else showAuthError(msg);
    return;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
  closeAuthModal();
  afterAuthChange();
}

function afterAuthChange() {
  renderAccount();
  renderFavorites();
  syncFavButtons();
  renderGlobalSearchResults();
}

function bindAuthEvents() {
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", () => openAuthModal("login"));
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", async () => { await logoutUser(); afterAuthChange(); });
  const form = document.getElementById("authForm");
  if (form) form.addEventListener("submit", handleAuthSubmit);
  const closeBtn = document.getElementById("authClose");
  if (closeBtn) closeBtn.addEventListener("click", closeAuthModal);
  const overlay = document.getElementById("authModal");
  if (overlay) overlay.addEventListener("click", (event) => { if (event.target === overlay) closeAuthModal(); });
  const switchBtn = document.getElementById("authSwitchBtn");
  if (switchBtn) switchBtn.addEventListener("click", () => {
    state.authMode = state.authMode === "register" ? "login" : "register";
    applyAuthMode();
    const err = document.getElementById("authError");
    if (err) err.hidden = true;
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAuthModal(); });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fav]");
    if (button) handleFavClick(button);
    if (event.target.closest("[data-open-login]")) openAuthModal("login");
  });
}

function renderResourceGrid(gridId, list, kind, activeFilter, catNamespace, emptyKey) {
  const grid = document.getElementById(gridId);
  if (!grid || typeof list === "undefined") return;

  const items = list.filter((item) => {
    const matchesCat = state.query || activeFilter === "all" || item.category === activeFilter;
    return matchesCat && (!state.query || searchableResourceText(item, catNamespace).includes(state.query));
  });

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(t(emptyKey))}</div>`;
    return;
  }

  grid.innerHTML = items.map((item) => `
    <article class="resource-card resource-card--${kind}">
      <div class="resource-top">
        <span class="resource-cat">${escapeHtml(t(`${catNamespace}.${item.category}`))}</span>
        <span class="resource-top-right">
          ${item.access === "subscription" ? `<span class="resource-access">${escapeHtml(t("labels.subscription"))}</span>` : ""}
          <span class="resource-origin">${escapeHtml(localizeRegion(item.origin))}</span>
        </span>
      </div>
      <div class="resource-head">
        <span class="resource-icon">${categoryIcon(catNamespace, item.category)}</span>
        <h3>${escapeHtml(item.name)}</h3>
      </div>
      <p>${escapeHtml(resourceDescription(item))}</p>
      <div class="tag-row">
        ${item.tags.map((tag) => `<span>${escapeHtml(localizeTag(tag))}</span>`).join("")}
      </div>
      <div class="card-actions">
        <a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(t("actions.open"))}</a>
        ${favoriteButton(kind, item.id)}
      </div>
    </article>
  `).join("");
}

function resourceDescription(item) {
  return state.lang === "zh" ? item.description : (item.descriptionEn || item.description);
}

function searchableResourceText(item, catNamespace) {
  return [
    item.name,
    item.origin,
    localizeRegion(item.origin),
    t(`${catNamespace}.${item.category}`),
    item.access === "subscription" ? t("labels.subscription") : "",
    item.description,
    item.descriptionEn,
    ...item.tags,
    ...item.tags.map(localizeTag)
  ].join(" ").toLowerCase();
}

function renderGlobalSearchResults() {
  const panel = document.getElementById("globalSearchResults");
  if (!panel) return;

  if (!state.query) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  const allResults = buildGlobalSearchItems()
    .filter((item) => item.searchText.includes(state.query));
  const results = allResults.slice(0, 12);

  panel.hidden = false;
  if (!results.length) {
    panel.innerHTML = `<p class="search-results-empty">${escapeHtml(t("search.noResults")(state.queryRaw || state.query))}</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="search-results-head">${escapeHtml(t("search.resultSummary")(allResults.length, state.queryRaw || state.query))}</div>
    <div class="search-results-list">
      ${results.map((item) => `
        <a class="search-result-item" href="${escapeHtml(item.href)}">
          <span>${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.summary)}</small>
        </a>
      `).join("")}
    </div>
  `;
}

function buildGlobalSearchItems() {
  return [
    ...pageSearchItems(),
    ...feedSearchItems(),
    ...sourceSearchItems(),
    ...literatureSearchItems(),
    ...dataSourceSearchItems(),
    ...vizToolSearchItems(),
    ...bookSearchItems(),
    ...programSearchItems()
  ].map((item) => ({
    ...item,
    searchText: [
      item.type,
      item.title,
      item.summary,
      ...(item.keywords || []),
      ...(item.keywords || []).map(localizeTag)
    ].join(" ").toLowerCase()
  }));
}

function pageSearchItems() {
  return [
    {
      type: t("search.page"),
      title: t("hero.title"),
      summary: [t("hero.lede"), t("hero.pointOfficial"), t("hero.pointTopics")].join(" "),
      href: "#home",
      keywords: ["SCL城市研究所", "首页", "资源库", "功能介绍"]
    },
    {
      type: t("search.page"),
      title: t("feed.title"),
      summary: t("feed.defaultStatus"),
      href: "#feedTitle",
      keywords: ["最新资讯", "研究进展", "论文资讯"]
    },
    {
      type: t("search.page"),
      title: t("library.title"),
      summary: `${SOURCES.length} ${t("metrics.sources")}，${t("metrics.labs")}，${t("metrics.journals")}`,
      href: "#library",
      keywords: ["城市研究机构", "实验室", "机构", "期刊"]
    },
    {
      type: t("search.page"),
      title: t("literature.title"),
      summary: t("literature.note"),
      href: "#literature",
      keywords: ["学术文献与检索", "文献", "Google Scholar", "知网", "arXiv", "开放获取", "引文"]
    },
    {
      type: t("search.page"),
      title: t("bigdata.title"),
      summary: t("bigdata.note"),
      href: "#bigdata",
      keywords: ["城市多源大数据", "开放数据", "遥感", "POI", "地图API", "交通数据"]
    },
    {
      type: t("search.page"),
      title: t("dataviz.title"),
      summary: t("dataviz.note"),
      href: "#dataviz",
      keywords: ["数据可视化工具", "图表", "ECharts", "kepler.gl", "词云", "GIS"]
    },
    {
      type: t("search.page"),
      title: t("books.title"),
      summary: t("books.note"),
      href: "#books",
      keywords: ["城市研究经典书籍", "人性化的城市", "城市意象", "死与生", "扬·盖尔", "简·雅各布斯"]
    },
    {
      type: t("search.page"),
      title: t("programs.title"),
      summary: t("programs.note"),
      href: "#programs",
      keywords: ["海外院校申请", "留学", "城市分析", "香港大学", "新加坡国立大学", "UCL", "MIT"]
    },
    {
      type: t("search.page"),
      title: t("footer.title"),
      summary: [t("footer.desc"), t("footer.source")].join(" "),
      href: "#home",
      keywords: ["数据来源", "页脚", "资源导航", "回到顶部"]
    }
  ];
}

function feedSearchItems() {
  const items = state.feedItems.length ? state.feedItems : getFeedSeedItems();
  return items.map((item) => ({
    type: t("search.news"),
    title: localizeFeedTitle(item),
    summary: localizeFeedSummary(item),
    href: "#feedTitle",
    keywords: feedKeywords(item)
  }));
}

function sourceSearchItems() {
  return SOURCES.map((source) => ({
    type: t("search.source"),
    title: source.name,
    summary: `${sourceTypeLabel(source.type)} · ${localizeRegion(source.region)} · ${sourceDescription(source)}`,
    href: "#library",
    keywords: [source.folder, source.region, sourceTypeLabel(source.type), ...source.tags]
  }));
}

function programSearchItems() {
  if (typeof OVERSEAS_PROGRAMS === "undefined") return [];
  return OVERSEAS_PROGRAMS.map((program) => ({
    type: t("search.program"),
    title: `${program.school} · ${program.lab}`,
    summary: `${t(`progCat.${program.category}`)} · ${localizeRegion(program.region)} · ${programDescription(program)}`,
    href: "#programs",
    keywords: [program.school, program.lab, program.pi, program.region, t(`progCat.${program.category}`), ...program.tags]
  }));
}

function bookSearchItems() {
  if (typeof BOOKS === "undefined") return [];
  return BOOKS.map((book) => ({
    type: t("search.book"),
    title: bookTitle(book),
    summary: `${book.author} · ${book.year} · ${bookDescription(book)}`,
    href: "#books",
    keywords: [book.title, book.titleEn, book.author, t(`bookCat.${book.category}`), ...book.tags]
  }));
}

function literatureSearchItems() {
  if (typeof ACADEMIC_SOURCES === "undefined") return [];
  return ACADEMIC_SOURCES.map((item) => ({
    type: t("search.literature"),
    title: item.name,
    summary: `${t(`litCat.${item.category}`)} · ${localizeRegion(item.origin)} · ${resourceDescription(item)}`,
    href: "#literature",
    keywords: [item.origin, t(`litCat.${item.category}`), ...item.tags]
  }));
}

function dataSourceSearchItems() {
  if (typeof URBAN_DATA_SOURCES === "undefined") return [];
  return URBAN_DATA_SOURCES.map((item) => ({
    type: t("search.dataSource"),
    title: item.name,
    summary: `${t(`dataCat.${item.category}`)} · ${localizeRegion(item.origin)} · ${resourceDescription(item)}`,
    href: "#bigdata",
    keywords: [item.origin, t(`dataCat.${item.category}`), ...item.tags]
  }));
}

function vizToolSearchItems() {
  if (typeof DATAVIZ_TOOLS === "undefined") return [];
  return DATAVIZ_TOOLS.map((item) => ({
    type: t("search.vizTool"),
    title: item.name,
    summary: `${t(`vizCat.${item.category}`)} · ${localizeRegion(item.origin)} · ${resourceDescription(item)}`,
    href: "#dataviz",
    keywords: [item.origin, t(`vizCat.${item.category}`), ...item.tags]
  }));
}

function renderFeed(items) {
  const grid = document.getElementById("feedGrid");
  if (!grid) return;
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
  status.classList.remove("is-error");
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
  status.classList.remove("is-error");
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
    status.classList.add("is-error");
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
  const matchesKind = Boolean(state.query) || state.feedFilter === "all" ||
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
  if (!items.length && source.feed) {
    items.push(...await tryFetchItems(() => fetchFeed(source)));
  }
  if (!items.length) {
    items.push(...await tryFetchItems(() => guessFeedItems(source)));
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
    items.push(...await tryFetchItems(() => guessFeedItems(source)));
  }
  if (!items.length) {
    items.push(...await tryFetchItems(() => discoverFeedItems(source)));
  }
  if (!items.length) {
    items.push(...await tryFetchItems(() => fetchOfficialPageItems(source, "lab")));
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
  const cached = readFetchCache(url);
  if (cached !== null) return cached;

  // 先尝试直连。
  try {
    const direct = await fetchWithTimeout(url, { headers: { Accept: "application/rss+xml, application/xml, text/html" } });
    if (direct.ok) {
      const text = await direct.text();
      writeFetchCache(url, text);
      return text;
    }
  } catch (error) {
    // 直连失败（多为 CORS），逐个尝试代理。
  }

  // 依次尝试各代理，任一成功即缓存并返回。
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const proxied = await fetchWithTimeout(buildProxyUrl(url));
      if (!proxied.ok) continue;
      const text = await proxied.text();
      if (!text) continue;
      writeFetchCache(url, text);
      return text;
    } catch (error) {
      // 换下一个代理。
    }
  }

  throw new Error(`All proxies failed ${url}`);
}

// 轻量抓取：仅直连 + 首个代理、较短超时，用于 RSS 端点探测，避免探测拖慢刷新。
async function fetchTextQuick(url) {
  const cached = readFetchCache(url);
  if (cached !== null) return cached;
  try {
    const direct = await fetchWithTimeout(url, { headers: { Accept: "application/rss+xml, application/xml" } }, 4000);
    if (direct.ok) {
      const text = await direct.text();
      writeFetchCache(url, text);
      return text;
    }
  } catch (error) {
    // 转首个代理。
  }
  const proxied = await fetchWithTimeout(CORS_PROXIES[0](url), {}, 4000);
  if (!proxied.ok) throw new Error(`Quick fetch failed ${url}`);
  const text = await proxied.text();
  if (!text) throw new Error(`Empty quick fetch ${url}`);
  writeFetchCache(url, text);
  return text;
}

// 自动探测来源站点的常见 RSS 端点，命中有效 feed 即返回其条目。
async function guessFeedItems(source) {
  const origin = safeOrigin(source.url) || safeOrigin(source.latestUrl);
  if (!origin) return [];
  const attempts = GUESS_FEED_PATHS.map((path) => async () => {
    const text = await fetchTextQuick(origin + path);
    if (!looksLikeFeed(text)) throw new Error("not a feed");
    const items = parseFeedText(text, source).slice(0, 6);
    if (!items.length) throw new Error("empty feed");
    return items;
  });
  try {
    return await Promise.any(attempts.map((run) => run()));
  } catch (error) {
    return [];
  }
}

function looksLikeFeed(text) {
  return /<rss[\s>]|<feed[\s>]|<rdf:RDF/i.test((text || "").slice(0, 800));
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (error) {
    return "";
  }
}

function readFetchCache(url) {
  try {
    const raw = localStorage.getItem(FETCH_CACHE_PREFIX + url);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || (Date.now() - entry.t) > FETCH_CACHE_TTL_MS) {
      localStorage.removeItem(FETCH_CACHE_PREFIX + url);
      return null;
    }
    return entry.v;
  } catch (error) {
    return null;
  }
}

function writeFetchCache(url, text) {
  try {
    localStorage.setItem(FETCH_CACHE_PREFIX + url, JSON.stringify({ t: Date.now(), v: text }));
  } catch (error) {
    // 配额超限等：清掉自己的旧缓存后放弃本次写入。
    pruneFetchCache();
  }
}

function pruneFetchCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FETCH_CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch (error) {
    // 忽略。
  }
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

function sourceLogoImage(source) {
  const candidates = sourceLogoCandidates(source);
  if (!candidates.length) return "";
  return `<img src="${escapeHtml(candidates[0])}" data-logo-index="0" data-logo-candidates="${escapeHtml(JSON.stringify(candidates))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

function activateSourceLogos(container = document) {
  container.querySelectorAll(".source-logo img").forEach((img) => {
    img.addEventListener("error", () => loadNextSourceLogo(img));
    if (img.complete && img.naturalWidth === 0) loadNextSourceLogo(img);
  });
}

function loadNextSourceLogo(img) {
  const candidates = parseLogoCandidates(img.dataset.logoCandidates);
  const nextIndex = Number(img.dataset.logoIndex || 0) + 1;

  if (nextIndex < candidates.length) {
    img.dataset.logoIndex = String(nextIndex);
    img.src = candidates[nextIndex];
    return;
  }

  img.parentElement?.classList.add("source-logo--fallback");
  img.remove();
}

function parseLogoCandidates(value) {
  try {
    const candidates = JSON.parse(value || "[]");
    return Array.isArray(candidates) ? candidates : [];
  } catch (error) {
    return [];
  }
}

function sourceLogoCandidates(source) {
  const override = SOURCE_LOGO_OVERRIDES[source.id] || {};
  const baseDomain = source.logoDomain || urlDomain(source.url);
  const domains = [
    ...(override.domains || []),
    baseDomain
  ].filter(Boolean);

  const urls = [
    ...(override.urls || []),
    ...domains.flatMap(logoServiceUrls)
  ];
  return [...new Set(urls)];
}

function logoServiceUrls(domain) {
  const cleanDomain = domain.replace(/^www\./, "");
  return [
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    `https://${domain}/favicon.ico`,
    ...(cleanDomain !== domain ? [] : [`https://www.${domain}/favicon.ico`])
  ];
}

function urlDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function sourceLogoInitials(name) {
  const words = cleanTitle(name).split(/\s+/).filter(Boolean);
  const initials = words
    .map((word) => word[0])
    .join("")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 2);
  return initials.toUpperCase() || "UR";
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
