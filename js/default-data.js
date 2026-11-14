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
    // Hashed admin password (SHA-256 of "ahmadia2026"). See data-service.js verifyAdminPassword.
    adminPasswordHash: "bd6d75431128af5375ec4fcf054c179a73f71cf6216a01dabb28dbe8a16b2be7",
    foundedYear: "2020"
  },

  // -------- COACHES --------
  coaches: [
    {
      id: "coach-1",
      name: "الكابتن / أحمد مصطفى عبد الرحمن",
      role: "المدير الفني العام للأكاديمية",
      age: 38,
      photo: "./images/logo.jpg",
      license: "الرخصة التدريبية A من الاتحاد الأفريقي (CAF)",
      experience: "15 عاماً في قطاع الناشئين وتطوير المواهب",
      bio: "لاعب سابق بعدد من أندية الدوري الممتاز المصري، حاصل على دبلومة تدريبية معتمدة من الاتحاد الدولي (FIFA). قاد فرق الشباب لتحقيق أكثر من 6 بطولات إقليمية ومحلية، وخبير في تطوير المهارات الفردية وبناء الشخصية القيادية للاعبين الصغار وفق أحدث المعايير التدريبية الأوروبية.",
      phone: "",
      email: ""
    },
    {
      id: "coach-2",
      name: "الكابتن / محمود إبراهيم النجار",
      role: "مدرب الفئات السنية ومخطط الأحمال",
      age: 32,
      photo: "./images/logo.jpg",
      license: "الرخصة التدريبية B - أخصائي إعداد بدني",
      experience: "8 سنوات في تطوير السرعة والرشاقة للاعبي كرة القدم",
      bio: "متخصص في الإعداد البدني الحديث وتغذية الرياضيين وتأهيل المواهب الرياضية وتدريبات التوافق العصبي العضلي للفئات العمرية من 8 حتى 16 سنة.",
      phone: "",
      email: ""
    },
    {
      id: "coach-3",
      name: "الكابتن / طارق حسن السيد",
      role: "مدرب حراس المرمى",
      age: 35,
      photo: "./images/logo.jpg",
      license: "رخصة تدريب حراس المرمى التخصصية",
      experience: "10 سنوات في صقل وتأهيل حراس المرمى الواعدين",
      bio: "حارس مرمى متميز سابق، يركز على سرعة رد الفعل، التمركز الصحيح، وبناء حارس المرمى العصري القادر على بدء الهجمات بالقدمين.",
      phone: "",
      email: ""
    }
  ],

  // -------- BREAKING NEWS TICKER --------
  tickerNews: [
    "🔥 فتح باب التقديم والتسجيل للموسم الرياضي الجديد 2026/2027 بأكاديمية مركز شباب الأحمدية!",
    "🏆 تتويج فريق الأكاديمية (مواليد 2012) بكأس بطولة المحافظة بعد الفوز في المباراة النهائية 3-1",
    "⭐ نجم اليوم في لوحة الشرف: اللاعب الموهوب ياسين أحمد لأدائه الخرافي في الجولة الماضية!",
    "⚽ مباراة ودية مرتقبة يوم الجمعة القادمة لفريق مواليد 2010 أمام أكاديمية النجوم على الملعب الرئيسي",
    "📋 تعديل مواعيد التدريبات الصيفية والمسائية لتناسب جميع الفئات العمرية والمدارس"
  ],

  // -------- PLAYER OF THE DAY --------
  playerOfTheDay: {
    playerId: "player-1",
    playerName: "ياسين أحمد الشهاوي",
    playerAge: 13,
    playerPosition: "صانع ألعاب (Playmaker)",
    playerPhoto: "./images/logo.jpg",
    number: 10,
    category: "2012-2014",
    reason: "تسجيل هاتريك رائع في نصف النهائي والتمرير لـ 4 أهداف حاسمة",
    selectedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    rating: 9.8,
    active: true
  },

  // -------- PLAYERS (enriched with DOB, registration status, achievements, performance) --------
  players: [
    {
      id: "player-1",
      name: "ياسين أحمد الشهاوي",
      birthDate: "2013-04-18",
      birthYear: 2013,
      age: 13,
      position: "صانع ألعاب",
      category: "2012-2014",
      number: 10,
      photo: "./images/logo.jpg",
      foot: "اليسرى",
      goals: 18,
      assists: 12,
      matches: 15,
      cleanSheets: 0,
      registrationStatus: "active",
      achievements: ["هداف بطولة المنطقة 2026", "أفضل لاعب صاعد لموسم 2025/2026"],
      performance: "موهبة استثنائية في صناعة اللعب ورؤية ميدانية متقدمة، يتميز بالتمريرات الحاسمة والقدرة على تسجيل الأهداف من خارج منطقة الجزاء."
    },
    {
      id: "player-2",
      name: "عمر خالد المنشاوي",
      birthDate: "2011-09-22",
      birthYear: 2011,
      age: 15,
      position: "مهاجم صريح",
      category: "2010-2012",
      number: 9,
      photo: "./images/logo.jpg",
      foot: "اليمنى",
      goals: 24,
      assists: 7,
      matches: 16,
      cleanSheets: 0,
      registrationStatus: "active",
      achievements: ["هداف دوري الشباب 2026", "لاعب الشهر في أكتوبر"],
      performance: "قمة هجومية ببدنية قوية وحدسة تهديفية عالية، يمتلك سرعة انطلاق مميزة وقدرة على المراوغة في المساحات الضيقة."
    },
    {
      id: "player-3",
      name: "حمزة محمود الزيات",
      birthDate: "2014-06-30",
      birthYear: 2014,
      age: 12,
      position: "حارس مرمى",
      category: "2012-2014",
      number: 1,
      photo: "./images/logo.jpg",
      foot: "اليمنى",
      goals: 0,
      assists: 1,
      matches: 14,
      cleanSheets: 9,
      registrationStatus: "active",
      achievements: ["أفضل حارس في بطولة البراعم", "9 مباريات نظيفة"],
      performance: "حارس مرمى واعد يتميز بسرعة رد الفعل وتمركز ذكي وقدرة على التصدي للركلات الحاسمة، وبدء الهجمات بدقة من الخلف."
    },
    {
      id: "player-4",
      name: "سيف الدين محمد علي",
      birthDate: "2010-02-11",
      birthYear: 2010,
      age: 16,
      position: "قلب دفاع",
      category: "2008-2010",
      number: 4,
      photo: "./images/logo.jpg",
      foot: "اليمنى",
      goals: 3,
      assists: 4,
      matches: 17,
      cleanSheets: 0,
      registrationStatus: "active",
      achievements: ["صخرة الدفاع لموسم 2026", "كابتن الفريق"],
      performance: "مدافع قوي بدنياً وذكي تكتيكياً، يتميز بقوة الإرسال وقدرة على قراءة اللعب وتقطيع الكرات الطويلة باحترافية."
    },
    {
      id: "player-5",
      name: "كريم شريف الباز",
      birthDate: "2015-11-05",
      birthYear: 2015,
      age: 11,
      position: "جناح أيمن",
      category: "2014-2016",
      number: 7,
      photo: "./images/logo.jpg",
      foot: "اليمنى",
      goals: 14,
      assists: 9,
      matches: 12,
      cleanSheets: 0,
      registrationStatus: "active",
      achievements: ["موهبة الموسم للبراعم", "أفضل جناح صاعد"],
      performance: "جناح سريع ومراوغ ماهر، يتميز بالانطلاقات الخطرة على الطرف وقدرة على القطع داخل المنطقة وتسديد الكرات الملتفة."
    },
    {
      id: "player-6",
      name: "أنس إبراهيم رضوان",
      birthDate: "2012-08-14",
      birthYear: 2012,
      age: 14,
      position: "ارتكاز دفاعي",
      category: "2010-2012",
      number: 6,
      photo: "./images/logo.jpg",
      foot: "اليمنى",
      goals: 5,
      assists: 10,
      matches: 15,
      cleanSheets: 0,
      registrationStatus: "active",
      achievements: ["محرك خط الوسط", "أفضل تمريرات حاسمة"],
      performance: "لاعب ارتكاز متكامل يجمع بين الدفاع والهجوم، يمتلك استرجاعاً ممتازاً للكرة وتوزيعاً واسعاً للعب على الجانبين."
    },
    {
      id: "player-7",
      name: "زياد عمرو فؤاد",
      birthDate: "2013-12-09",
      birthYear: 2013,
      age: 12,
      position: "جناح أيسر",
      category: "2012-2014",
      number: 11,
      photo: "./images/logo.jpg",
      foot: "اليسرى",
      goals: 11,
      assists: 8,
      matches: 13,
      cleanSheets: 0,
      registrationStatus: "active",
      achievements: ["نجم الجولة الخامسة"],
      performance: "جناح أيسر تقني يتميز بالمراوغة والقدرة على التسديد المباشر على المرمى، وينفذ الكرات الثابتة بإتقان."
    },
    {
      id: "player-8",
      name: "آدم يوسف الخطيب",
      birthDate: "2015-03-21",
      birthYear: 2015,
      age: 11,
      position: "لاعب خط وسط",
      category: "2014-2016",
      number: 8,
      photo: "./images/logo.jpg",
      foot: "يجيد اللعب بالقدمين",
      goals: 7,
      assists: 11,
      matches: 11,
      cleanSheets: 0,
      registrationStatus: "pending",
      achievements: ["لاعب متعدد المراكز"],
      performance: "لاعب وسط شامل يجيد اللعب بالقدمين، يتميز بالتمريرات القصيرة السريعة والتحرك الذكي بين الخطوط."
    }
  ],

  // -------- TROPHIES (enriched with image field) --------
  trophies: [
    {
      id: "trophy-1",
      title: "كأس دوري مراكز الشباب للمحافظة",
      year: "2026",
      category: "مواليد 2011",
      description: "الحصول على المركز الأول والميدالية الذهبية بدون أي هزيمة طوال مجريات البطولة.",
      badge: "المركز الأول 🥇",
      icon: "🏆",
      image: ""
    },
    {
      id: "trophy-2",
      title: "كأس بطولة الأبطال للناشئين",
      year: "2025",
      category: "مواليد 2013",
      description: "التتويج بعد الفوز في المباراة النهائية بنتيجة 3 - 1 وسط حضور جماهيري كبير.",
      badge: "البطل المتوج 🏆",
      icon: "🥇",
      image: ""
    },
    {
      id: "trophy-3",
      title: "درع التميز الأخلاقي واللعب النظيف",
      year: "2025",
      category: "جميع الفرق",
      description: "منحت الأكاديمية جائزة الروح الرياضية العالية وأفضل سلوك رياضي للمدربين واللاعبين.",
      badge: "اللعب النظيف 🌟",
      icon: "🛡️",
      image: ""
    },
    {
      id: "trophy-4",
      title: "كأس دورة الصداقة الكروية",
      year: "2024",
      category: "مواليد 2009",
      description: "فوز مستحق في البطولة الودية التي ضمت 12 أكاديمية كروية على مستوى المراكز المجاورة.",
      badge: "المركز الأول 🥇",
      icon: "⚽",
      image: ""
    }
  ],

  // -------- TRAINING SCHEDULES --------
  schedules: [
    {
      id: "sch-1",
      category: "مواليد 2014 - 2016 (البراعم)",
      days: "السبت - الإثنين - الأربعاء",
      time: "04:30 مساءً - 06:00 مساءً",
      field: "الملعب الفرعي (النجيل الصناعي A)",
      coach: "كابتن محمود إبراهيم"
    },
    {
      id: "sch-2",
      category: "مواليد 2011 - 2013 (الناشئون)",
      days: "الأحد - الثلاثاء - الخميس",
      time: "06:00 مساءً - 07:30 مساءً",
      field: "الملعب الرئيسي لمركز شباب الأحمدية",
      coach: "كابتن أحمد مصطفى"
    },
    {
      id: "sch-3",
      category: "مواليد 2008 - 2010 (الشباب)",
      days: "الأحد - الثلاثاء - الخميس",
      time: "07:30 مساءً - 09:30 مساءً",
      field: "الملعب الرئيسي لمركز شباب الأحمدية",
      coach: "كابتن أحمد مصطفى"
    },
    {
      id: "sch-4",
      category: "تدريبات حراس المرمى التخصصية",
      days: "السبت - الإثنين - الأربعاء",
      time: "06:00 مساءً - 07:30 مساءً",
      field: "منطقة حراس المرمى المخصصة",
      coach: "كابتن طارق حسن"
    }
  ],

  // -------- UPCOMING MATCHES --------
  upcomingMatches: [
    {
      id: "match-up-1",
      opponent: "أكاديمية الفرسان",
      category: "مواليد 2012",
      tournament: "دوري المحافظة للبراعم",
      stadium: "ملعب مركز شباب الأحمدية الرئيسي",
      date: "2026-11-20",
      time: "05:00 م",
      status: "قادمة"
    },
    {
      id: "match-up-2",
      opponent: "شباب ميت غمر",
      category: "مواليد 2010",
      tournament: "مباراة ودية تحضيرية",
      stadium: "استاد السنبلاوين الرياضي",
      date: "2026-11-25",
      time: "06:30 م",
      status: "قادمة"
    },
    {
      id: "match-up-3",
      opponent: "أكاديمية الأبطال",
      category: "مواليد 2014",
      tournament: "كأس الصداقة الكروي",
      stadium: "ملعب مركز شباب الأحمدية",
      date: "2026-11-28",
      time: "04:00 م",
      status: "قادمة"
    }
  ],

  // -------- MATCH RESULTS (enriched with matchReport) --------
  matchResults: [
    {
      id: "match-res-1",
      opponent: "أكاديمية النجوم الذهبية",
      category: "مواليد 2012",
      tournament: "نهائي بطولة المنطقة",
      scoreOur: 3,
      scoreOpponent: 1,
      result: "win",
      scorers: "ياسين أحمد (هدفين)، كريم شريف (هدف)",
      date: "2026-11-08",
      stadium: "ملعب مركز شباب الأحمدية",
      matchReport: "سيطر فريق الأكاديمية على مجريات الشوط الأول وافتتح ياسين التسجيل في الدقيقة 18 قبل أن يضيف الهدف الثاني من ركلة حرة مباشرة. وفي الشوط الثاني قلص المنافس الفارق قبل أن يحسم كريم النتيجة في الدقيقة 78. أداء تكتيكي منظم وروح جماعية عالية."
    },
    {
      id: "match-res-2",
      opponent: "مركز شباب كفر الصلاحات",
      category: "مواليد 2010",
      tournament: "دوري الشباب",
      scoreOur: 2,
      scoreOpponent: 2,
      result: "draw",
      scorers: "عمر خالد، سيف الدين محمد",
      date: "2026-11-04",
      stadium: "ملعب كفر الصلاحات",
      matchReport: "مباراة قوية ومثيرة تقدم فيها الأحمدية بهدفين قبل أن يدرك المنافس التعادل في الدقائق الأخيرة. ظهرت إيجابيات في التحركات الهجومية مع الحاجة لضبط التغطية الدفاعية في الكرات الثابتة."
    },
    {
      id: "match-res-3",
      opponent: "أكاديمية المستقبل",
      category: "مواليد 2014",
      tournament: "مهرجان البراعم الكروي",
      scoreOur: 4,
      scoreOpponent: 0,
      result: "win",
      scorers: "كريم شريف (هاتريك)، أنس إبراهيم",
      date: "2026-10-28",
      stadium: "ملعب مركز شباب الأحمدية",
      matchReport: "فوز مستحق وعرض هجومي رائع بقيادة كريم شريف الذي سجل هاتريك، مع أداء دفاعي منظم أبقى الشباك نظيفة. شارك أنس إبراهيم بصناعة وتسجيل هدف رائع."
    }
  ],

  // -------- NEWS ARTICLES --------
  news: [
    {
      id: "news-1",
      title: "تتويج مستحق لأبطال الأكاديمية بكأس بطولة المنطقة للناشئين",
      date: "2026-11-09",
      category: "بطولات وإنجازات",
      image: "./images/logo.jpg",
      summary: "وسط أجواء احتفالية حماسية وبحضور مجلس إدارة مركز شباب الأحمدية، توج فريق مواليد 2012 بكأس البطولة بعد تقديم أداء بطولي مشرف نال إشادة الجميع.",
      content: "حقق فريق أكاديمية مركز شباب الأحمدية مواليد 2012 فوزاً كبيراً ومستحقاً في نهائي بطولة المنطقة بنتيجة 3-1، وأشاد الكابتن أحمد مصطفى بالانضباط التكتيكي والروح العالية للاعبين، مؤكداً أن هذا الإنجاز هو نتاج عمل جماعي وتفانٍ طوال الأشهر الماضية.\n\nوقد كرم مجلس إدارة المركز اللاعبين بالميداليات الذهبية درعاً تذكارياً، وأكد رئيس المركز على استمرار الدعم الكامل للأكاديمية لتأهيل المزيد من المواهب الواعدة."
    },
    {
      id: "news-2",
      title: "بدء اختبارات قياس اللياقة البدنية والسرعة الدورية للاعبين",
      date: "2026-11-05",
      category: "التدريب والتطوير",
      image: "./images/logo.jpg",
      summary: "انطلاق أسبوع القياسات البدنية بأحدث الأجهزة الإلكترونية لمتابعة معدل التطور العضلي والسرعة والتحمل لجميع المسجلين بالأكاديمية.",
      content: "أجرت الأكاديمية قياسات بدنية شاملة لجميع الفئات السنية شملت اختبارات السرعة والرشاقة وقوة التسديد، وتم تسجيل البيانات في السجل الرقمي لكل لاعب لتحديد برنامج التمارين المناسب لكل مرحلة.\n\nوأكد الكابتن محمود إبراهيم أن هذه القياسات ستتكرر شهرياً لرصد التطور الفعلي ومقارنته بالمعدلات المعيارية للفئات العمرية المماثلة."
    },
    {
      id: "news-3",
      title: "جلسة توعوية حول التغذية السليمة والنوم الكافي للرياضي الصاعد",
      date: "2026-10-30",
      category: "تثقيف رياضي",
      image: "./images/logo.jpg",
      summary: "ندوة تثقيفية خاصة للاعبي الأكاديمية وأولياء الأمور لتوضيح العادات الغذائية الصحية وأهمية النوم والراحة في بناء العضلات والوقاية من الإصابات.",
      content: "نظمت إدارة الأكاديمية ورشة عمل تفاعلية بحضور أولياء الأمور لتسليط الضوء على النظام الغذائي المثالي للاعب الناشئ، والمشروبات المعوضة للأملاح أثناء التدريبات الشاقة.\n\nوتضمنت الجلسة نصائح عملية حول مواعيد النوم المثلى للفئات العمرية المختلفة وأثرها المباشر على الاستشفاء العضلي والتركيز الذهني أثناء التدريب والمباريات."
    }
  ],

  // -------- REGISTRATION REQUESTS --------
  registrationRequests: [
    {
      id: "req-1",
      playerName: "علي طارق ممدوح",
      birthDate: "2014-06-15",
      age: 12,
      parentName: "طارق ممدوح علي",
      phone: "01012345678",
      address: "الأحمدية - بجوار المسجد الكبير",
      preferredPosition: "حارس مرمى",
      preferredFoot: "اليمنى",
      healthNotes: "لا توجد أي معوقات صحية والحمد لله",
      status: "approved",
      submittedAt: "2026-11-10T14:30:00.000Z"
    },
    {
      id: "req-2",
      playerName: "محمد وليد الشرقاوي",
      birthDate: "2013-09-22",
      age: 13,
      parentName: "وليد الشرقاوي",
      phone: "01123456789",
      address: "الأحمدية - شارع السوق",
      preferredPosition: "صانع ألعاب",
      preferredFoot: "اليسرى",
      healthNotes: "سليم بدنياً",
      status: "pending",
      submittedAt: "2026-11-11T10:15:00.000Z"
    }
  ],

  // -------- ACTIVITY LOG (for dashboard recent activity) --------
  activity: [
    { id: "act-1", icon: "🏆", text: "تتويج فريق مواليد 2012 بكأس بطولة المنطقة", time: "2026-11-09T20:00:00.000Z" },
    { id: "act-2", icon: "📝", text: "استلام طلب انضمام جديد: محمد وليد الشرقاوي", time: "2026-11-11T10:15:00.000Z" },
    { id: "act-3", icon: "⚽", text: "تسجيل نتيجة مباراة الأكاديمية 3-1", time: "2026-11-08T18:30:00.000Z" },
    { id: "act-4", icon: "⭐", text: "اختيار ياسين أحمد نجم اليوم", time: new Date().toISOString() }
  ]
};
