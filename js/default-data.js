// =====================================================================
// Default Seed Data — Academia Al-Ahmadia
// Preserves all original records and enriches them with the additional
// fields required by the upgraded platform (DOB, registration status,
// achievements, performance, trophy images, match reports, settings).
// =====================================================================
export const DEFAULT_DATA = {
  // -------- GENERAL ACADEMY SETTINGS (new) --------
  settings: {
    academyName: "أكاديمية مركز شباب الأحمدية لكرة القدم",
    shortName: "أكاديمية الأحمدية",
    tagline: "صناع الأبطال ونجوم المستقبل",
    description: "صرح كروي متكامل لتأهيل وصقل مهارات البراعم والناشئين وفق أحدث البرامج التدريبية المعتمدة، تحت إشراف نخبة من المدربين الوطنيين داخل بيئة تربوية ورياضية احترافية برعاية مجلس إدارة مركز شباب الأحمدية.",
    logo: "./images/logo.jpg",
    phone: "01227506392",
    whatsapp: "201227506392",
    email: "",
    address: "مقر مركز شباب الأحمدية - الأحمدية - المنزلة - محافظة الدقهلية",
    facebook: "https://www.facebook.com/en.mohamed.nasr",
    instagram: "",
    youtube: "",
    announcement: "",
    developerName: "المهندس محمد حماد",
    developerFacebook: "https://www.facebook.com/en.mohamed.nasr",
    developerWhatsapp: "201279934735",
    foundedYear: "2020",
    adminPasswordHash: "64533647a5d1df6de07cdc1a3a51f4c0fcbb35fffd51b5c38f32c949e24a210c"
  },

  // -------- COACHES --------
  coaches: [],

  // -------- BREAKING NEWS TICKER --------
  tickerNews: [],

  // -------- PLAYER OF THE DAY --------
  playerOfTheDay: { active: false },

  // -------- PLAYERS (enriched with DOB, registration status, achievements, performance) --------
  players: [],

  // -------- TROPHIES (enriched with image field) --------
  trophies: [],

  // -------- TRAINING SCHEDULES --------
  schedules: [],

  // -------- UPCOMING MATCHES --------
  upcomingMatches: [],

  // -------- MATCH RESULTS (enriched with matchReport) --------
  matchResults: [],

  // -------- NEWS ARTICLES --------
  news: [],

  // -------- REGISTRATION REQUESTS --------
  registrationRequests: [],

  // -------- ACTIVITY LOG (for dashboard recent activity) --------
  activity: []
};
