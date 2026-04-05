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
      description: "用于替换原来的 emoji 卡片位，后续只换图即可。",
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
      description: "产品图建议控制在 80KB 到 150KB，手机打开更稳。",
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
      description: "文案和跳转仍在 HTML 里，方便你单独改标题和按钮。",
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
      description: "如果要改成 JPG 或 WebP，只要同步改一下图片地址即可。",
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
      description: "适合做高价值礼品位，接入动态数据后同样保留排序和筛选。",
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
      description: "用来补足分类层级，顶部导航和筛选后会更像淘宝式礼品列表。",
      imageUrl: "images/product-6.svg",
      actionLabel: "立即领取",
      actionUrl: "#service",
      sortOrder: 6,
      isActive: true,
      createdAt: "2026-04-05T09:25:00+10:00"
    }
  ]
};
