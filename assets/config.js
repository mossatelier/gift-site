window.APP_CONFIG = {
  siteName: "🏠加加好物图集",
  adminPath: "admin.html",
  adminPasscode: "",
  supabaseUrl: "https://ukoqffocqjokcroilyyv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FmZm9jcWpva2Nyb2lseXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzMxMDUsImV4cCI6MjA5MDkwOTEwNX0.jKFzbuDLbbDboUD8vJLAu0uTkkEzE2YnC2bHU5I8RH0",
  productsTable: "products",
  storageBucket: "product-images",
  storageFolder: "products",
  // 云开发 admin-orders 云函数的 HTTP 访问 URL
  // 在云开发控制台 → 环境管理 → HTTP 访问服务 → 添加路由 /admin-orders 关联 admin-orders 函数
  adminOrdersUrl: "https://cloud1-d0gtch1v896d24828-1436264391.ap-shanghai.app.tcloudbase.com/admin-orders",
  // 后台登录用户名映射：登录框可输「用户名」或「邮箱」。无 @ 视为用户名 → 映射到下面的邮箱再登。
  // 键=用户名(小写)，值=该管理员的登录邮箱。可自行增删/改名。
  adminUsernames: {
    jiajia: "shiyuanl.zjgsu@gmail.com"
  },
  categories: [
    { value: "all", label: "全部礼品" },
    { value: "referral", label: "推荐有礼" },
    { value: "stroller", label: "婴儿推车" },
    { value: "playpen", label: "收纳围栏" },
    { value: "carseat", label: "安全座椅" },
    { value: "carrier", label: "喂养腰凳" },
    { value: "earlyedu", label: "早教点读" },
    { value: "toy", label: "儿童玩具" },
    { value: "chairtable", label: "餐椅桌椅" },
    { value: "ride", label: "娱乐骑行" },
    { value: "pet", label: "宠物用品" },
    { value: "camping", label: "户外露营" },
    { value: "digital", label: "电子数码" },
    { value: "appliance", label: "家用电器" }
  ],
  subcategories: {
    referral: ["推荐2人", "推荐3人", "推荐5人", "推荐7人", "推荐10人"],
    stroller: ["婴儿车", "遛娃车", "口袋车"],
    toy: ["益智类", "攀爬类", "各种玩具"],
    ride: ["平衡车", "自行车", "滑板车", "扭扭车"]
  },
  fallbackProducts: [
    {
      id: "sample-1",
      title: "婴儿推车礼包",
      category: "stroller",
      price: 240,
      cardsNeeded: 6,
      imageUrl: "images/product-1.svg",
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-04-05T09:00:00+10:00"
    },
    {
      id: "sample-2",
      title: "家用空气炸锅",
      category: "appliance",
      price: 320,
      cardsNeeded: 8,
      imageUrl: "images/product-2.svg",
      sortOrder: 2,
      isActive: true,
      createdAt: "2026-04-05T09:05:00+10:00"
    },
    {
      id: "sample-3",
      title: "早教点读笔",
      category: "earlyedu",
      price: 240,
      cardsNeeded: 6,
      imageUrl: "images/product-3.svg",
      sortOrder: 3,
      isActive: true,
      createdAt: "2026-04-05T09:10:00+10:00"
    },
    {
      id: "sample-4",
      title: "户外露营礼盒",
      category: "camping",
      price: 99,
      cardsNeeded: 2,
      imageUrl: "images/product-4.svg",
      sortOrder: 4,
      isActive: true,
      createdAt: "2026-04-05T09:15:00+10:00"
    },
    {
      id: "sample-5",
      title: "蓝牙耳机数码套装",
      category: "digital",
      price: 360,
      cardsNeeded: 9,
      imageUrl: "images/product-5.svg",
      sortOrder: 5,
      isActive: true,
      createdAt: "2026-04-05T09:20:00+10:00"
    },
    {
      id: "sample-6",
      title: "宠物洁齿礼盒",
      category: "pet",
      price: 149,
      cardsNeeded: 3,
      imageUrl: "images/product-6.svg",
      sortOrder: 6,
      isActive: true,
      createdAt: "2026-04-05T09:25:00+10:00"
    },
    {
      id: "sample-7",
      title: "儿童益智玩具",
      category: "toy",
      price: 160,
      cardsNeeded: 4,
      imageUrl: "images/product-1.svg",
      sortOrder: 7,
      isActive: true,
      createdAt: "2026-04-05T09:30:00+10:00"
    },
    {
      id: "sample-8",
      title: "宝宝餐椅",
      category: "chairtable",
      price: 220,
      cardsNeeded: 5,
      imageUrl: "images/product-2.svg",
      sortOrder: 8,
      isActive: true,
      createdAt: "2026-04-05T09:35:00+10:00"
    },
    {
      id: "sample-9",
      title: "推荐 2 人专享礼包",
      category: "referral",
      price: 40,
      cardsNeeded: 2,
      imageUrl: "images/product-3.svg",
      sortOrder: 9,
      isActive: true,
      createdAt: "2026-04-05T09:40:00+10:00"
    }
  ]
};
