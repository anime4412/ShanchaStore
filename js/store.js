/* ============================================================
   ShanChaStore - store.js
   ============================================================
   FILE NÀY CHẠY CHO: MỌI trang web (nạp sau data.js).
   ============================================================
   Đây là "lớp dữ liệu" trung gian — mọi trang gọi qua Store.* thay vì
   đọc/ghi trực tiếp, để khi server đổi thì chỉ sửa 1 chỗ.

   Từng phần làm gì:
   - KEYS        : khoá localStorage (sct_cart = giỏ hàng, sct_token = phiên).
   - api()       : hàm gọi REST API chung (tự kèm token Bearer, tự báo lỗi).
   - cache       : bộ nhớ tạm products/toppings/categories/reviews/settings…
                   nạp 1 lần từ GET /api/bootstrap khi mở trang.
   - init()      : chạy khi file load — đổ bootstrap vào cache, kiểm tra phiên
                   đăng nhập (/api/me), admin thì tải thêm users+orders.
   - Giỏ hàng    : đọc/ghi localStorage theo thiết bị (addToCart/updateQty/...).
   - Sản phẩm    : getProducts (đọc cache), saveProduct/deleteProduct (qua API).
   - Tài khoản   : register/login/googleLogin -> lưu token +
                   set cache.me; logout xoá token; updateProfile sửa thông tin.
   - Đơn hàng    : placeOrder gửi giỏ lên server (server tính lại giá),
                   updateOrderStatus (admin), myOrders (lịch sử của tôi).
   - Cài đặt     : getSettings/setSettings — bảng settings (SQLite).
   - Đánh giá    : getReviews/addReview/deleteReview + site reviews.
   - Danh mục    : getCategories/saveCategory/deleteCategory — bảng categories.
   ============================================================ */

"use strict";

const Store = (function () {
  /* ---------- khoá localStorage ---------- */
  const KEYS = {
    cart: "sct_cart",
    token: "sct_token",
  };

  /* ---------- helper gọi API ---------- */
  function token() {
    return localStorage.getItem(KEYS.token) || "";
  }

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: Object.assign(
          { "Content-Type": "application/json" },
          token() ? { Authorization: "Bearer " + token() } : {},
        ),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(
        'Không thể kết nối máy chủ dữ liệu. Vui lòng bật "node server.js" rồi thử lại.',
      );
    }
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      /* body rỗng */
    }
    if (!res.ok) {
      const msg =
        (data && data.msg) ||
        "Không lấy được dữ liệu. Vui lòng thử lại sau.";
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- cache dữ liệu (đổ từ server khi trang load) ---------- */
  const cache = {
    products: [],
    toppings: [],
    categories: [],
    banners: [],
    stores: [],
    customerReviews: [],
    groups: [],
    promos: [],
    reviews: [],
    siteReviews: [],
    productToppings: [],
    settings: {},
    users: [],
    orders: [],
    newsletters: [],
    auditLogs: [],
    me: null,
  };

  const DEFAULT_SETTINGS = {
    siteName: "ShanCha Store",
    slogan: "Đậm trà, thơm hương",
    desc: "Trà nguyên chất từ vùng cao Đà Lạt, pha chế thủ công mỗi ngày.",
    hotline: "039 799 9949",
    email: "hello@shancha.vn",
    address: "TP.HCM · Đà Lạt",
    openHours: "09:00 – 22:00",
    logo: "assets/images/logo.svg",
    themeColor: "#C97B4A",
    salePercent: 20,
    saleEndsAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
  };

  async function init() {
    const boot = await api("GET", "/api/bootstrap");
    cache.products = boot.products;
    cache.settings = Object.assign({}, DEFAULT_SETTINGS, boot.settings);
    cache.toppings = boot.toppings;
    cache.categories = boot.categories || [];
    cache.banners = boot.banners || [];
    cache.stores = boot.stores || [];
    cache.customerReviews = boot.customerReviews || [];
    cache.groups = boot.groups || [];
    cache.promos = boot.promos || [];
    cache.productToppings = boot.productToppings || [];
    cache.reviews = boot.reviews;
    cache.siteReviews = boot.siteReviews;

    /* phiên đăng nhập (nếu có token còn hạn) */
    try {
      const me = await api("GET", "/api/me");
      cache.me = me.user;
    } catch (e) {
      cache.me = null;
    }

    /* nếu là admin -> tải thêm danh sách users + orders + newsletters + audit */
    if (cache.me && cache.me.role === "admin") {
      try {
        const admin = await api("GET", "/api/admin/data");
        cache.users = admin.users;
        cache.orders = admin.orders;
        cache.newsletters = admin.newsletters || [];
        cache.auditLogs = admin.auditLogs || [];
      } catch (e) {
        /* mất quyền giữa chừng -> bỏ qua */
      }
    }
    /* nếu là staff -> tải đơn hàng (qua /api/staff/data) để làm việc */
    if (cache.me && cache.me.role === "staff") {
      try {
        const staff = await api("GET", "/api/staff/data");
        cache.orders = staff.orders;
      } catch (e) {
        /* bỏ qua */
      }
    }
  }

  /* Trang nào cũng phải `await Store.ready` trước khi đọc dữ liệu */
  const ready = init().catch((err) => {
    console.warn("[Store] Không tải được dữ liệu:", err && err.message);
    /* Banner nhỏ góc dưới — KHÔNG che màn hình, chỉ nhắc cách mở đúng.
       Không hiện khi đã mở qua http://localhost:3000 (server chạy bình thường). */
    try {
      if (!location.protocol.startsWith("http")) {
        const tip = document.createElement("div");
        tip.id = "offline-tip";
        tip.style.cssText =
          "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9998;" +
          "background:#2B2318;color:#FAF6EF;padding:10px 16px;border-radius:10px;" +
          "font-size:.85rem;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:92vw;text-align:center;line-height:1.5";
        tip.textContent =
          "Bạn đang mở file trực tiếp nên không có dữ liệu. Hãy chạy 'node server.js' rồi mở http://localhost:3000";
        document.body.appendChild(tip);
      }
    } catch (e) { /* bỏ qua */ }
    return "offline";
  });

  /* ---------- Giỏ hàng (localStorage theo thiết bị) ---------- */
  function readCart() {
    try {
      const raw = localStorage.getItem(KEYS.cart);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function writeCart(list) {
    try {
      localStorage.setItem(KEYS.cart, JSON.stringify(list));
    } catch (e) {
      console.error("[store] write cart fail", e);
    }
  }
  function getCart() {
    return readCart();
  }
  function setCart(list) {
    writeCart(list);
  }
  function cartCount() {
    return readCart().reduce((n, it) => n + it.qty, 0);
  }
  function cartTotal() {
    return readCart().reduce(
      (s, it) =>
        s +
        it.price * it.qty +
        (it.toppings || []).reduce((x, t) => x + t.price * it.qty, 0),
      0,
    );
  }
  function addToCart(product, qty, toppings) {
    const cart = readCart();
    const idx = cart.findIndex((it) => it.id === product.id);
    if (idx >= 0) {
      cart[idx].qty += qty;
      if (toppings) cart[idx].toppings = toppings;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        img: product.img,
        price: product.price,
        qty,
        toppings: toppings || [],
      });
    }
    writeCart(cart);
    return cartCount();
  }
  function updateQty(id, qty) {
    writeCart(
      readCart().map((it) =>
        it.id === Number(id) ? { ...it, qty: Math.max(1, qty) } : it,
      ),
    );
  }
  function removeFromCart(id) {
    writeCart(readCart().filter((it) => it.id !== Number(id)));
  }
  function clearCart() {
    writeCart([]);
  }

  /* ---------- Sản phẩm (đọc cache / ghi qua API) ---------- */
  function getProducts() {
    return cache.products.slice();
  }
  function getProduct(id) {
    return cache.products.find((p) => p.id === Number(id)) || null;
  }
  function nextProductId() {
    return cache.products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  }
  async function saveProduct(product) {
    const data = await api("POST", "/api/products", product);
    const saved = data.product;
    const idx = cache.products.findIndex((p) => p.id === saved.id);
    if (idx >= 0) cache.products[idx] = saved;
    else cache.products.push(saved);
    return saved;
  }
  async function deleteProduct(id) {
    await api("DELETE", "/api/products/" + Number(id));
    cache.products = cache.products.filter((p) => p.id !== Number(id));
    cache.reviews = cache.reviews.filter((r) => r.productId !== Number(id));
  }
  async function toggleAvailability(id, available) {
    const data = await api("PATCH", "/api/products/" + Number(id) + "/availability", { is_available: !!available });
    const saved = data.product;
    const idx = cache.products.findIndex((p) => p.id === saved.id);
    if (idx >= 0) cache.products[idx] = saved;
    return saved;
  }

  /* ---------- Người dùng / phiên đăng nhập ---------- */
  function getUsers() {
    return cache.users.slice();
  }
  function findByUsername(u) {
    return cache.users.find((x) => x.username === u) || null;
  }
  function findByEmail(e) {
    return cache.users.find((x) => x.email === e) || null;
  }
  function currentUser() {
    return cache.me;
  }
  function isLoggedIn() {
    return !!cache.me;
  }
  function isAdmin() {
    return !!cache.me && cache.me.role === "admin";
  }

  async function register({ name, username, email, phone, password }) {
    const data = await api("POST", "/api/register", {
      name,
      username,
      email,
      phone,
      password,
    });
    localStorage.setItem(KEYS.token, data.token);
    cache.me = data.user;
    return data.user;
  }

  async function login(username, password) {
    const data = await api("POST", "/api/login", { username, password });
    localStorage.setItem(KEYS.token, data.token);
    cache.me = data.user;
    if (data.user.role === "admin") {
      try {
        const admin = await api("GET", "/api/admin/data");
        cache.users = admin.users;
        cache.orders = admin.orders;
        cache.newsletters = admin.newsletters || [];
        cache.auditLogs = admin.auditLogs || [];
      } catch (e) {
        /* bỏ qua */
      }
    }
    if (data.user.role === "staff") {
      try {
        const staff = await api("GET", "/api/staff/data");
        cache.orders = staff.orders;
      } catch (e) {
        /* bỏ qua */
      }
    }
    return data.user;
  }

  async function googleLogin(credential) {
    const data = await api("POST", "/api/google-login", { credential });
    localStorage.setItem(KEYS.token, data.token);
    cache.me = data.user;
    return data.user;
  }

  function logout() {
    const t = token();
    localStorage.removeItem(KEYS.token);
    cache.me = null;
    cache.users = [];
    cache.orders = [];
    if (t) api("POST", "/api/logout").catch(() => {});
  }

  async function changePassword({ oldPassword, newPassword }) {
    const data = await api("POST", "/api/change-password", { oldPassword, newPassword });
    return data;
  }

  async function updateProfile({ name, email, phone }) {
    const data = await api("PATCH", "/api/me", { name, email, phone });
    cache.me = data.user;
    return data.user;
  }

  async function myOrders() {
    const data = await api("GET", "/api/my/orders");
    return data.orders;
  }

  async function updateUser(user) {
    const data = await api(
      "PATCH",
      "/api/users/" + encodeURIComponent(user.id),
      {
        name: user.name,
        email: user.email,
        phone: user.phone,
        blocked: !!user.blocked,
        role: user.role,
      },
    );
    const saved = data.user;
    const idx = cache.users.findIndex((u) => u.id === saved.id);
    if (idx >= 0) cache.users[idx] = saved;
    return saved;
  }

  async function deleteUser(id) {
    await api("DELETE", "/api/users/" + encodeURIComponent(id));
    cache.users = cache.users.filter((u) => u.id !== id);
  }

  /* ---------- Tạo người dùng mới (admin — nhân viên/khách) ---------- */
  async function createUser({ name, username, email, phone, password, role }) {
    const data = await api("POST", "/api/users", {
      name, username, email, phone, password, role: role || 'staff'
    });
    cache.users.unshift(data.user);
    return data.user;
  }

  /* ---------- Vai trò ---------- */
  function isStaff() {
    return !!cache.me && (cache.me.role === "staff" || cache.me.role === "admin");
  }

  /* ---------- Upload ảnh an toàn (PHASE 10) ---------- */
  async function uploadImage(dataUrl, kind) {
    const data = await api("POST", "/api/upload", { dataUrl, kind: kind || "product" });
    return data.url;
  }

  /* ---------- Topping thuộc sản phẩm (PHASE 9) ---------- */
  function productToppingIds(productId) {
    return cache.productToppings
      .filter((x) => Number(x.product_id) === Number(productId))
      .map((x) => x.topping_id);
  }
  function getProductToppings(productId) {
    const ids = productToppingIds(productId);
    return cache.toppings.filter((t) => ids.includes(t.id));
  }
  async function saveProductToppings(productId, toppingIds) {
    await api("POST", "/api/product-toppings", { product_id: productId, toppings: toppingIds });
    cache.productToppings = cache.productToppings.filter((x) => Number(x.product_id) !== Number(productId));
    (toppingIds || []).forEach((tid) => cache.productToppings.push({ product_id: productId, topping_id: tid }));
  }

  /* ---------- Hủy đơn (PHASE 22) ---------- */
  async function cancelOrder(code, reason) {
    const data = await api("POST", "/api/orders/" + encodeURIComponent(code) + "/cancel", { reason: reason || "" });
    const idx = cache.orders.findIndex((o) => o.code === code);
    if (idx >= 0) cache.orders[idx] = data.order;
    return data.order;
  }

  /* ---------- Đơn hàng ---------- */
  function getOrders() {
    return cache.orders.slice();
  }

  async function placeOrder({
    name,
    phone,
    address,
    note,
    payMethod,
    storeId,
    lat,
    lng,
    promo,
  }) {
    const items = readCart().map((it) => ({
      id: it.id,
      qty: it.qty,
      toppings: (it.toppings || []).map((t) => t.id),
    }));
    const data = await api("POST", "/api/orders", {
      name,
      phone,
      address,
      note,
      payMethod,
      storeId,
      lat,
      lng,
      promo,
      items,
    });
    clearCart();
    cache.orders.unshift(data.order);
    return data.order;
  }

  async function updateOrderStatus(code, status) {
    const data = await api("PATCH", "/api/orders/" + encodeURIComponent(code), {
      status,
    });
    const idx = cache.orders.findIndex((o) => o.code === code);
    if (idx >= 0) cache.orders[idx] = data.order;
    return data.order;
  }
  async function setOrderStatus(code, status) {
    return updateOrderStatus(code, status);
  }
  async function setOrderPayment(code, payment_status) {
    const data = await api("PATCH", "/api/orders/" + encodeURIComponent(code), {
      payment_status,
    });
    const idx = cache.orders.findIndex((o) => o.code === code);
    if (idx >= 0) cache.orders[idx] = data.order;
    return data.order;
  }

  /* ---------- Cài đặt website ---------- */
  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, cache.settings);
  }
  async function setSettings(s) {
    const data = await api("POST", "/api/settings", s);
    cache.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    return getSettings();
  }

  /* ---------- Đánh giá sản phẩm ---------- */
  function getReviews(productId) {
    return productId
      ? cache.reviews.filter((r) => r.productId === Number(productId))
      : cache.reviews.slice();
  }
  function reviewStats(productId) {
    const rs = getReviews(productId);
    if (!rs.length) return { count: 0, avg: 0 };
    const sum = rs.reduce((s, r) => s + r.rating, 0);
    return { count: rs.length, avg: Math.round((sum / rs.length) * 10) / 10 };
  }
  async function addReview({ productId, rating, comment }) {
    const data = await api("POST", "/api/reviews", {
      productId,
      rating,
      comment,
    });
    cache.reviews.unshift(data.review);
    const idx = cache.products.findIndex((p) => p.id === Number(productId));
    if (idx >= 0) cache.products[idx] = data.product;
    return data.review;
  }

  /* ---------- Đánh giá website ---------- */
  function getSiteReviews() {
    return cache.siteReviews.slice();
  }
  async function addSiteReview({ rating, comment }) {
    const data = await api("POST", "/api/site-reviews", { rating, comment });
    cache.siteReviews.unshift(data.review);
    return data.review;
  }

  /* ---------- Xoá đánh giá (admin) ---------- */
  async function deleteReview(id) {
    const data = await api("DELETE", "/api/reviews/" + Number(id));
    cache.reviews = cache.reviews.filter((r) => r.id !== Number(id));
    if (data.product) {
      const idx = cache.products.findIndex((p) => p.id === data.product.id);
      if (idx >= 0) cache.products[idx] = data.product;
    }
    return data;
  }
  async function deleteSiteReview(id) {
    const data = await api("DELETE", "/api/site-reviews/" + Number(id));
    cache.siteReviews = cache.siteReviews.filter((r) => r.id !== Number(id));
    return data;
  }
  /* Duyệt/ẩn đánh giá (admin — PHASE 17) */
  async function modReview(id, status) {
    const data = await api("PATCH", "/api/reviews/" + Number(id) + "/status", { status });
    const idx = cache.reviews.findIndex((r) => r.id === Number(id));
    if (idx >= 0) cache.reviews[idx] = data.review;
    return data.review;
  }
  async function modSiteReview(id, status) {
    const data = await api("PATCH", "/api/site-reviews/" + Number(id) + "/status", { status });
    const idx = cache.siteReviews.findIndex((r) => r.id === Number(id));
    if (idx >= 0) cache.siteReviews[idx] = data.review;
    return data.review;
  }

  /* ---------- Topping ---------- */
  function getToppings() {
    return cache.toppings.slice();
  }
  function nextToppingId() {
    const max = cache.toppings.reduce((m, t) => {
      const n = parseInt(String(t.id).replace(/\D/g, ""), 10);
      return Math.max(m, isNaN(n) ? 0 : n);
    }, 0);
    return "t" + (max + 1);
  }
  async function saveTopping(topping) {
    const data = await api("POST", "/api/toppings", topping);
    const saved = data.topping;
    const idx = cache.toppings.findIndex((t) => t.id === saved.id);
    if (idx >= 0) cache.toppings[idx] = saved;
    else cache.toppings.push(saved);
    return saved;
  }
  async function deleteTopping(id) {
    await api("DELETE", "/api/toppings/" + encodeURIComponent(id));
    cache.toppings = cache.toppings.filter((t) => t.id !== id);
  }

  /* ---------- Danh mục ---------- */
  function getCategories() {
    return cache.categories.slice();
  }
  function getCategory(id) {
    return cache.categories.find((c) => c.id === id) || null;
  }
  async function saveCategory(cat) {
    const data = await api("POST", "/api/categories", cat);
    const saved = data.category;
    const idx = cache.categories.findIndex((c) => c.id === saved.id);
    if (idx >= 0) cache.categories[idx] = saved;
    else cache.categories.push(saved);
    cache.categories.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    /* nếu đổi id danh mục -> cập nhật sản phẩm trong cache */
    if (cat.originalId && cat.originalId !== saved.id) {
      cache.products.forEach((p) => {
        if (p.category === cat.originalId) p.category = saved.id;
      });
    }
    return saved;
  }
  async function deleteCategory(id) {
    await api("DELETE", "/api/categories/" + encodeURIComponent(id));
    cache.categories = cache.categories.filter((c) => c.id !== id);
  }

  /* ---------- Banner ---------- */
  function getBanners() { return cache.banners.slice(); }
  async function saveBanner(banner) {
    const data = await api("POST", "/api/banners", banner);
    const saved = data.banner;
    const idx = cache.banners.findIndex((b) => b.id === saved.id);
    if (idx >= 0) cache.banners[idx] = saved; else cache.banners.push(saved);
    cache.banners.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    return saved;
  }
  async function deleteBanner(id) {
    await api("DELETE", "/api/banners/" + Number(id));
    cache.banners = cache.banners.filter((b) => b.id !== Number(id));
  }

  /* ---------- Chi nhánh ---------- */
  function getStores() { return cache.stores.slice(); }
  function getStore(id) { return cache.stores.find((s) => s.id === id) || null; }
  async function saveStore(store) {
    const data = await api("POST", "/api/stores", store);
    const saved = data.store;
    const idx = cache.stores.findIndex((s) => s.id === saved.id);
    if (idx >= 0) cache.stores[idx] = saved; else cache.stores.push(saved);
    cache.stores.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    return saved;
  }
  async function deleteStore(id) {
    await api("DELETE", "/api/stores/" + encodeURIComponent(id));
    cache.stores = cache.stores.filter((s) => s.id !== id);
  }

  /* ---------- Nhận xét khách hàng ---------- */
  function getCustomerReviews() { return cache.customerReviews.slice(); }
  async function saveCustomerReview(rev) {
    const data = await api("POST", "/api/customer-reviews", rev);
    const saved = data.review;
    const idx = cache.customerReviews.findIndex((r) => r.id === saved.id);
    if (idx >= 0) cache.customerReviews[idx] = saved; else cache.customerReviews.unshift(saved);
    return saved;
  }
  async function deleteCustomerReview(id) {
    await api("DELETE", "/api/customer-reviews/" + Number(id));
    cache.customerReviews = cache.customerReviews.filter((r) => r.id !== Number(id));
  }

  /* ---------- Nhóm sản phẩm ---------- */
  function getGroupsData() { return cache.groups.slice(); }
  async function saveGroup(group) {
    const data = await api("POST", "/api/groups", group);
    const saved = data.group;
    const idx = cache.groups.findIndex((g) => g.id === saved.id);
    if (idx >= 0) cache.groups[idx] = saved; else cache.groups.push(saved);
    cache.groups.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    return saved;
  }
  async function deleteGroup(id) {
    await api("DELETE", "/api/groups/" + encodeURIComponent(id));
    cache.groups = cache.groups.filter((g) => g.id !== id);
  }

  /* ---------- Mã giảm giá ---------- */
  function getPromos() { return cache.promos.slice(); }
  async function savePromo(promo) {
    const data = await api("POST", "/api/promos", promo);
    const saved = data.promo;
    const idx = cache.promos.findIndex((p) => p.code === saved.code);
    if (idx >= 0) cache.promos[idx] = saved; else cache.promos.push(saved);
    return saved;
  }
  async function deletePromo(code) {
    await api("DELETE", "/api/promos/" + encodeURIComponent(code));
    cache.promos = cache.promos.filter((p) => p.code !== code);
  }

  /* ---------- Newsletter ---------- */
  function getNewsletters() { return cache.newsletters.slice(); }
  async function addNewsletter(email) {
    const data = await api("POST", "/api/newsletters", { email });
    if (!data.existed) cache.newsletters.unshift({ email, created: Date.now() });
    return data;
  }
  async function deleteNewsletter(id) {
    await api("DELETE", "/api/newsletters/" + Number(id));
    cache.newsletters = cache.newsletters.filter((n) => n.id !== Number(id));
  }

  /* ---------- Nhật ký truy vết (audit) ---------- */
  function getAuditLogs() { return cache.auditLogs.slice(); }

  /* ---------- API công khai ---------- */
  return {
    KEYS,
    ready,
    getProducts,
    getProduct,
    saveProduct,
    deleteProduct,
    toggleAvailability,
    nextProductId,
    getUsers,
    findByUsername,
    findByEmail,
    register,
    login,
    googleLogin,
    logout,
    updateProfile,
    changePassword,
    myOrders,
    currentUser,
    isLoggedIn,
    isAdmin,
    updateUser,
    deleteUser,
    createUser,
    getCart,
    setCart,
    cartCount,
    cartTotal,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    getOrders,
    placeOrder,
    updateOrderStatus,
    getSettings,
    setSettings,
    getReviews,
    addReview,
    reviewStats,
    getSiteReviews,
    addSiteReview,
    deleteReview,
    deleteSiteReview,
    modReview,
    modSiteReview,
    getToppings,
    saveTopping,
    deleteTopping,
    nextToppingId,
    getCategories,
    getCategory,
    saveCategory,
    deleteCategory,
    getBanners,
    saveBanner,
    deleteBanner,
    getStores,
    getStore,
    saveStore,
    deleteStore,
    getCustomerReviews,
    saveCustomerReview,
    deleteCustomerReview,
    getGroupsData,
    saveGroup,
    deleteGroup,
    getPromos,
    savePromo,
    deletePromo,
    getNewsletters,
    addNewsletter,
    deleteNewsletter,
    getAuditLogs,
    isStaff,
    uploadImage,
    getProductToppings,
    saveProductToppings,
    cancelOrder,
    setOrderStatus,
    setOrderPayment,
  };
})();
