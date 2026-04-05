window.APP_CONFIG = {
  siteName: "加加礼品屋",
  adminPath: "admin.html",
  adminPasscode: "",
  supabaseUrl: "https://ukoqffocqjokcroilyyv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FmZm9jcWpva2Nyb2lseXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzMxMDUsImV4cCI6MjA5MDkwOTEwNX0.jKFzbuDLbbDboUD8vJLAu0uTkkEzE2YnC2bHU5I8RH0",
  productsTable: "products",
  storageBucket: "product-images",
  storageFolder: "products",
  categories: [
    { value: "all", label: "全部礼品" },
    { value: "toy", label: "玩偶周边" },
    { value: "kitchen", label: "厨房家居" },
    { value: "beauty", label: "美妆护肤" },
    { value: "coffee", label: "咖啡茶饮" },
    { value: "digital", label: "数码配件" }
  ],
  fallbackProducts: [
    {
      id: "sample-1",
      title: "精美玩偶礼盒",
      category: "toy",
      price: 129,
      cardsNeeded: 2,
      imageUrl: "images/product-1.svg",
      actionLabel: "免费领取",
      actionUrl: "#service",
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-04-05T09:00:00+10:00"
    },
    {
      id: "sample-2",
      title: "厨房好物套装",
      category: "kitchen",
      price: 169,
      cardsNeeded: 3,
      imageUrl: "images/product-2.svg",
      actionLabel: "积分兑换",
      actionUrl: "#service",
      sortOrder: 2,
      isActive: true,
      createdAt: "2026-04-05T09:05:00+10:00"
    },
    {
      id: "sample-3",
      title: "美妆护肤礼包",
      category: "beauty",
      price: 239,
      cardsNeeded: 4,
      imageUrl: "images/product-3.svg",
      actionLabel: "办卡即得",
      actionUrl: "#service",
      sortOrder: 3,
      isActive: true,
      createdAt: "2026-04-05T09:10:00+10:00"
    },
    {
      id: "sample-4",
      title: "精品咖啡礼盒",
      category: "coffee",
      price: 99,
      cardsNeeded: 2,
      imageUrl: "images/product-4.svg",
      actionLabel: "限时免费",
      actionUrl: "#service",
      sortOrder: 4,
      isActive: true,
      createdAt: "2026-04-05T09:15:00+10:00"
    },
    {
      id: "sample-5",
      title: "数码配件套装",
      category: "digital",
      price: 299,
      cardsNeeded: 5,
      imageUrl: "images/product-5.svg",
      actionLabel: "查看详情",
      actionUrl: "#service",
      sortOrder: 5,
      isActive: true,
      createdAt: "2026-04-05T09:20:00+10:00"
    },
    {
      id: "sample-6",
      title: "出行收纳礼盒",
      category: "kitchen",
      price: 149,
      cardsNeeded: 3,
      imageUrl: "images/product-6.svg",
      actionLabel: "立即领取",
      actionUrl: "#service",
      sortOrder: 6,
      isActive: true,
      createdAt: "2026-04-05T09:25:00+10:00"
    }
  ]
};
