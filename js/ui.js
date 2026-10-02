/* ============================================================
   ShanChaStore - ui.js
   ============================================================
   FILE NÀY CHẠY CHO: MỌI trang web (nạp sau auth.js).
   ============================================================
   "Bộ xương giao diện" dùng chung:
   - fmt/fmtDate : định dạng tiền VNĐ & ngày giờ.
   - esc         : chống XSS — thay ký tự đặc biệt bằng mã an toàn.
   - imgTag      : tạo thẻ <img> cho sản phẩm (ảnh thật, fallback SVG).
   - ICONS/icon  : bộ icon SVG đơn sắc dùng khắp website.
   - logoHtml    : hiện logo tuỳ chỉnh (admin) hoặc text tên shop.
   - toast       : thông báo góc màn hình (ok/danger/warn/info).
   - renderHeader/renderFooter : dựng header + footer cho mọi trang,
                   hiện tên user / nút đăng nhập / giỏ hàng theo trạng thái.
   - openDrawer/closeDrawer    : popup giỏ hàng (modal trung tâm).
   - openProductModal          : modal xem chi tiết + topping + đánh giá sản phẩm.
   - renderReviews             : form + danh sách đánh giá sản phẩm trong modal.
   - productCard               : thẻ card sản phẩm (ảnh, giá, nút Xem/Thêm giỏ).
   - initCommon                : hàm khởi tạo mọi trang — chờ Store.ready, áp màu
                   chủ đạo, render header/footer, tạo popup giỏ + modal sản phẩm.
   ============================================================ */

"use strict";

const UI = (function () {
  /* ---------- Định dạng tiền Việt ---------- */
  function fmt(n) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(n || 0);
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  /* ---------- Ảnh sản phẩm: ảnh thật (products/*.jpg), uploads/, fallback SVG cũ ---------- */
  function assetUrl(src) {
    if (!src) return "assets/images/logo.svg";
    if (src.indexOf("data:") === 0 || src.indexOf("http") === 0 || src.indexOf("/uploads/") === 0) return src;
    return "assets/images/" + src;
  }
  function imgTag(p, cls) {
    const direct = p.img.indexOf("data:") === 0 || p.img.indexOf("http") === 0 || p.img.indexOf("/uploads/") === 0;
    const src = direct ? p.img : "assets/images/" + p.img;
    const base =
      !direct && p.img.indexOf("products/") === 0
        ? p.img.slice(9).replace(/\.jpg$/, ".svg")
        : p.img;
    const fallback =
      direct || base.indexOf("http") === 0 || base.indexOf("data:") === 0
        ? ""
        : "assets/images/" + base;
    return (
      '<img class="' +
      cls +
      '" src="' +
      src +
      '" alt="' +
      esc(p.name) +
      '" loading="lazy"' +
      (fallback
        ? ' onerror="this.onerror=null;this.src=&quot;' + fallback + '&quot;"'
        : "") +
      ">"
    );
  }

  /* ---------- Icon SVG don sac (dung currentColor) ---------- */
  var ICONS = {
    cart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    loc: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.6 2.81.72A2 2 0 0 1 22 16.92z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    unlock:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    dash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 12l4-4 3 3 5-6"/></svg>',
    box: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    cup: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    music:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    truck:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    chevL:
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    chevR:
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    logout:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    topping:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16M4 11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2M4 11v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M8 7v.01M12 7v.01M16 7v.01"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    comment:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/></svg>',
    img: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/></svg>',
    google:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.87c2.27-2.09 3.55-5.17 3.55-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.29A7.19 7.19 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.98 11.98 0 0 0 0 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    flask: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v5.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V3"/><path d="M7.5 15h9"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  };
  function icon(name) {
    return ICONS[name] || "";
  }

  /* ---------- Logo: ảnh tùy chỉnh (admin) hoặc text theo tên shop ---------- */
  function isDefaultLogo(src) {
    return !src || src === "assets/images/logo.svg";
  }
  function logoHtml(cls) {
    const s = Store.getSettings();
    if (isDefaultLogo(s.logo)) {
      return (
        '<span class="' +
        cls +
        ' brand-text">' +
        esc(s.siteName || "ShanCha Store") +
        "</span>"
      );
    }
    return (
      '<img class="' +
      cls +
      '" src="' +
      esc(s.logo) +
      '" alt="' +
      esc(s.siteName) +
      '">'
    );
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, type) {
    let box = document.getElementById("toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast toast-" + (type || "info");
    t.innerHTML = esc(msg);
    box.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  /* ---------- Header (nav + trạng thái đăng nhập + giỏ) ---------- */
  function renderHeader(active) {
    const user = Store.currentUser();
    const header = document.getElementById("site-header");
    if (!header) return;
    const cartN = Store.cartCount();

    const authHtml = user
      ? '<div class="nav-user">' +
        '<a class="nav-user-name" href="profile.html" title="Trang cá nhân">' +
        UI.icon("user") +
        " " +
        esc(user.name) +
        (user.role === "admin" ? ' <b class="badge-admin">ADMIN</b>' : "") +
        "</a>" +
        (user.role === "admin"
          ? '<a class="nav-link" href="admin.html">Quản trị</a>'
          : "") +
        '<a class="nav-link" href="profile.html">Tài khoản</a>' +
        '<a class="nav-link" href="#" id="btn-logout">' +
        UI.icon("logout") +
        " Đăng xuất</a>" +
        "</div>"
      : '<div class="nav-user">' +
        '<a class="nav-link" href="login.html">Đăng nhập</a>' +
        '<a class="btn btn-primary btn-sm" href="login.html?tab=register">Đăng ký</a>' +
        "</div>";

    header.innerHTML =
      '<div class="container header-inner">' +
      '<a class="brand" href="index.html">' +
      logoHtml("brand-img") +
      "</a>" +
      '<nav class="nav" aria-label="Điều hướng chính">' +
      '<a class="nav-link' +
      (active === "home" ? " active" : "") +
      '" href="index.html">Trang chủ</a>' +
      '<a class="nav-link' +
      (active === "products" ? " active" : "") +
      '" href="products.html">Menu</a>' +
      '<a class="nav-link' +
      (active === "about" ? " active" : "") +
      '" href="about.html">Giới thiệu</a>' +
      '<a class="nav-link" href="index.html#story">Câu chuyện</a>' +
      '<a class="nav-link" href="index.html#stores">Chi nhánh</a>' +
      "</nav>" +
      '<button class="nav-burger" id="nav-burger" aria-label="Mở menu" aria-expanded="false">' +
      '<span></span><span></span><span></span>' +
      "</button>" +
      '<div class="header-actions">' +
      authHtml +
      '<button class="cart-btn" id="btn-cart" aria-label="Giỏ hàng">' +
      '<span class="cart-icon">' +
      UI.icon("cart") +
      '</span><span class="cart-badge" id="cart-badge">' +
      cartN +
      "</span>" +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="mobile-nav" id="mobile-nav" hidden>' +
      '<a class="nav-link' +
      (active === "home" ? " active" : "") +
      '" href="index.html">Trang chủ</a>' +
      '<a class="nav-link' +
      (active === "products" ? " active" : "") +
      '" href="products.html">Menu</a>' +
      '<a class="nav-link' +
      (active === "about" ? " active" : "") +
      '" href="about.html">Giới thiệu</a>' +
      '<a class="nav-link" href="index.html#story">Câu chuyện</a>' +
      '<a class="nav-link" href="index.html#stores">Chi nhánh</a>' +
      (user && user.role === "admin"
        ? '<a class="nav-link" href="admin.html">Quản trị</a>'
        : "") +
      (user
        ? '<a class="nav-link" href="profile.html">Tài khoản</a>' +
          '<a class="nav-link" href="#" id="mobile-logout">Đăng xuất</a>'
        : '<a class="nav-link" href="login.html">Đăng nhập / Đăng ký</a>') +
      "</div>";

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn)
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        Auth.logout();
        UI.toast("Đã đăng xuất.", "info");
        UI.renderHeader(active);
        setTimeout(() => location.reload(), 300);
      });
    /* ---------- Menu mobile: hamburger toggle ---------- */
    const burger = document.getElementById("nav-burger");
    const mobileNav = document.getElementById("mobile-nav");
    if (burger && mobileNav) {
      const closeMobile = () => {
        mobileNav.hidden = true;
        burger.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
        document.body.classList.remove("mobile-nav-open");
      };
      burger.addEventListener("click", () => {
        const opening = mobileNav.hidden;
        mobileNav.hidden = !opening;
        burger.classList.toggle("open", opening);
        burger.setAttribute("aria-expanded", opening ? "true" : "false");
        document.body.classList.toggle("mobile-nav-open", opening);
      });
      mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMobile));
      const mLog = document.getElementById("mobile-logout");
      if (mLog)
        mLog.addEventListener("click", (e) => {
          e.preventDefault();
          closeMobile();
          if (typeof Auth !== "undefined" && Auth.logout) {
            Auth.logout();
            UI.toast("Đã đăng xuất.", "info");
          }
          setTimeout(() => location.reload(), 300);
        });
      document.addEventListener("click", (e) => {
        if (
          !mobileNav.hidden &&
          !e.target.closest("#mobile-nav") &&
          !e.target.closest("#nav-burger")
        ) {
          closeMobile();
        }
      });
    }
    const cartBtn = document.getElementById("btn-cart");
    if (cartBtn) cartBtn.addEventListener("click", openDrawer);
  }

  function updateCartBadge() {
    const b = document.getElementById("cart-badge");
    if (b) b.textContent = Store.cartCount();
  }

  /* ---------- Giỏ hàng drawer ---------- */
  function openDrawer() {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.getElementById("cart-overlay");
    if (!drawer) return;
    Cart.renderDrawer();
    drawer.classList.add("open");
    if (overlay) overlay.classList.add("show");
    document.body.classList.add("drawer-open");
  }
  function closeDrawer() {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.getElementById("cart-overlay");
    if (drawer) drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }

  /* ---------- Modal chi tiết sản phẩm ---------- */
  function openProductModal(id) {
    const p = Store.getProduct(id);
    if (!p) return;
    const cat = Store.getCategories().find((c) => c.id === p.category);
    const modal = document.getElementById("product-modal");
    if (!modal) return;

    modal.innerHTML =
      '<div class="modal-card">' +
      '<button class="modal-close" id="modal-close" aria-label="Đóng">' +
      UI.icon("close") +
      "</button>" +
      '<div class="modal-body">' +
      '<div class="modal-img">' +
      imgTag(p, "") +
      "</div>" +
      '<div class="modal-info">' +
      '<div class="modal-cat">' +
      esc(cat ? cat.name : "") +
      " · " +
      (p.group === "sale"
        ? "Khuyến mãi"
        : p.group === "hot"
          ? "Bán chạy"
          : "Mới") +
      "</div>" +
      '<h2 class="modal-name">' +
      esc(p.name) +
      "</h2>" +
      '<div class="modal-price">' +
      (p.oldPrice > p.price
        ? '<span class="price-old">' + fmt(p.oldPrice) + "</span>"
        : "") +
      '<span class="price-now">' +
      fmt(p.price) +
      "</span>" +
      "</div>" +
      '<div class="modal-rating">' +
      UI.icon("star") +
      " " +
      p.rating +
      " · Đã bán " +
      p.sold +
      "</div>" +
      '<p class="modal-desc">' +
      esc(p.desc) +
      "</p>" +
      '<div class="modal-toppings"><h4>Topping</h4>' +
      Store.getProductToppings(p.id)
        .map(
          (t) =>
            '<label class="topping"><input type="checkbox" value="' +
            t.id +
            '"> ' +
            t.name +
            " (+" +
            fmt(t.price) +
            ")</label>",
        )
        .join("") +
      "</div>" +
      '<div class="modal-qty">' +
      "<span>Số lượng:</span>" +
      '<button id="mq-minus" class="qty-btn">−</button><span id="mq-val">1</span><button id="mq-plus" class="qty-btn">+</button>' +
      "</div>" +
      '<button class="btn btn-primary btn-block" id="modal-add">Thêm vào giỏ hàng</button>' +
      '<div class="modal-reviews" id="modal-reviews"></div>' +
      "</div>" +
      "</div>" +
      "</div>";

    modal.classList.add("open");
    renderReviews(p.id);
    document
      .getElementById("modal-close")
      .addEventListener("click", () => modal.classList.remove("open"));

    let qty = 1;
    const val = document.getElementById("mq-val");
    document.getElementById("mq-minus").addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      val.textContent = qty;
    });
    document.getElementById("mq-plus").addEventListener("click", () => {
      qty += 1;
      val.textContent = qty;
    });

    document.getElementById("modal-add").addEventListener("click", () => {
      const toppings = [...modal.querySelectorAll(".topping input:checked")]
        .map((i) => Store.getToppings().find((t) => t.id === i.value))
        .filter(Boolean);
      Cart.add(p.id, qty, toppings);
      UI.updateCartBadge();
      modal.classList.remove("open");
      // tự mở popup giỏ hàng
      openDrawer();
    });
  }

  /* ---------- Đánh giá sản phẩm ---------- */
  function renderReviews(productId) {
    const box = document.getElementById("modal-reviews");
    if (!box) return;
    const stats = Store.reviewStats(productId);
    const list = Store.getReviews(productId);
    const user = Store.currentUser();

    let html =
      '<div class="reviews-head"><h4>Đánh giá</h4>' +
      '<span class="reviews-avg">' +
      (stats.count ? stats.avg + " ★" : "Chưa có đánh giá") +
      (stats.count ? " (" + stats.count + " lượt)" : "") +
      "</span></div>";

    // form viết đánh giá (yêu cầu đăng nhập)
    if (user) {
      html +=
        '<div class="review-form"><div class="review-stars" id="rv-stars">' +
        [1, 2, 3, 4, 5]
          .map(
            (n) =>
              '<button type="button" class="rv-star" data-v="' +
              n +
              '" aria-label="' +
              n +
              ' sao">★</button>',
          )
          .join("") +
        '</div><textarea id="rv-text" rows="2" placeholder="Chia sẻ cảm nhận của bạn…"></textarea>' +
        '<button class="btn btn-primary btn-sm" id="rv-submit">Gửi đánh giá</button></div>';
    } else {
      html +=
        '<p class="review-login"><a href="login.html?next=' +
        location.pathname.split("/").pop() +
        '">Đăng nhập</a> để đánh giá sản phẩm này.</p>';
    }

    html +=
      list
        .slice(0, 5)
        .map(
          (r) =>
            '<div class="review-item"><div class="review-meta"><b>' +
            esc(r.userName) +
            "</b><span>" +
            "★".repeat(r.rating) +
            "</span></div>" +
            (r.comment ? "<p>" + esc(r.comment) + "</p>" : "") +
            '<div class="review-time">' +
            fmtDate(r.created) +
            "</div></div>",
        )
        .join("") || '<p class="review-empty">Chưa có đánh giá nào.</p>';

    box.innerHTML = html;

    // star picker
    let picked = 0;
    box.querySelectorAll(".rv-star").forEach((b) => {
      b.addEventListener("click", () => {
        picked = Number(b.dataset.v);
        box
          .querySelectorAll(".rv-star")
          .forEach((x, i) => x.classList.toggle("on", i < picked));
      });
    });
    const submit = document.getElementById("rv-submit");
    if (submit)
      submit.addEventListener("click", async () => {
        if (!picked) {
          UI.toast("Hãy chọn số sao.", "warn");
          return;
        }
        const comment = document.getElementById("rv-text").value.trim();
        try {
          await Store.addReview({ productId, rating: picked, comment });
          UI.toast("Cảm ơn bạn đã đánh giá!", "ok");
          renderReviews(productId);
        } catch (err) {
          UI.toast(err.message, "danger");
        }
      });
  }

  function renderFooter() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const s = Store.getSettings();
    footer.innerHTML =
      '<div class="container footer-grid">' +
      '<div class="footer-col">' +
      logoHtml("footer-logo") +
      "<p>" +
      esc(s.slogan) +
      "</p>" +
      "<p>" +
      esc(
        s.desc ||
          "Trà nguyên chất từ vùng cao Đà Lạt, pha chế thủ công mỗi ngày.",
      ) +
      "</p>" +
      "</div>" +
      '<div class="footer-col">' +
      "<h4>Liên kết</h4>" +
      '<a href="index.html">Trang chủ</a>' +
      '<a href="products.html">Menu</a>' +
      '<a href="admin.html">Quản trị</a>' +
      "</div>" +
      '<div class="footer-col">' +
      "<h4>Liên hệ</h4>" +
      "<p>Hotline: " +
      esc(s.hotline) +
      "</p>" +
      "<p>Email: " +
      esc(s.email || "hello@shancha.vn") +
      "</p>" +
      "<p>" +
      esc(s.address || "TP.HCM · Đà Lạt") +
      "</p>" +
      "<p>Giờ mở cửa: " +
      esc(s.openHours || "09:00 – 22:00") +
      "</p>" +
      "</div>" +
      '<div class="footer-col">' +
      "<h4>Theo dõi</h4>" +
      '<div class="footer-social">' +
      '<a href="#" aria-label="Facebook">f</a>' +
      '<a href="#" aria-label="Instagram">ig</a>' +
      '<a href="#" aria-label="TikTok">tt</a>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="footer-bottom"><div class="container">© 2026 ' +
      esc(s.siteName) +
      " – Assignment WEB1044 · JavaScript cơ sở</div></div>";
  }

  /* ---------- Card sản phẩm ---------- */
  function productCard(p) {
    const isSale = p.oldPrice > p.price;
    const soldOut = p.is_available === false;
    return (
      '<div class="product-card' + (soldOut ? ' sold-out' : '') + '" data-id="' +
      p.id +
      '">' +
      (isSale && !soldOut
        ? '<span class="badge-sale">- ' +
          Math.round((1 - p.price / p.oldPrice) * 100) +
          "%</span>"
        : "") +
      (soldOut ? '<span class="badge-sale">Hết hàng</span>' : "") +
      '<div class="product-img">' +
      imgTag(p, "") +
      "</div>" +
      '<div class="product-body">' +
      '<div class="product-cat">' +
      esc(
        (Store.getCategories().find((c) => c.id === p.category) || {}).name ||
          "",
      ) +
      "</div>" +
      '<h3 class="product-name">' +
      esc(p.name) +
      "</h3>" +
      '<div class="product-price">' +
      (isSale && !soldOut ? '<span class="price-old">' + fmt(p.oldPrice) + "</span>" : "") +
      '<span class="price-now">' +
      fmt(p.price) +
      "</span>" +
      "</div>" +
      '<div class="product-meta">' +
      UI.icon("star") +
      " " +
      p.rating +
      " · " +
      p.sold +
      " đã bán</div>" +
      '<div class="product-actions">' +
      '<button class="btn btn-outline btn-sm" data-act="view"' + (soldOut ? ' disabled' : '') + '>Xem chi tiết</button>' +
      (soldOut
        ? '<button class="btn btn-primary btn-sm" disabled>Hết hàng</button>'
        : '<button class="btn btn-primary btn-sm" data-act="add">Thêm giỏ</button>') +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  /* ---------- Pager dùng chung ----------
     UI.pager(container, page, pages, total, onGo)
     - container: element HTML hiển thị phân trang (có thể null).
     - page/pages/total: trang hiện tại, tổng trang, tổng số phần tử.
     - onGo(np): callback khi bấm sang trang np (1-based). */
  function pager(container, page, pages, total, onGo) {
    if (!container) return;
    if (!pages || pages <= 1) { container.innerHTML = ''; return; }
    let html = '<span class="pager-info">Trang ' + page + '/' + pages + (total ? ' · ' + total + ' mục' : '') + '</span>';
    html += '<button data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';
    for (let i = 1; i <= pages; i++) {
      html += '<button data-p="' + i + '"' + (i === page ? ' class="active"' : '') + '>' + i + '</button>';
    }
    html += '<button data-p="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>›</button>';
    container.innerHTML = html;
    container.querySelectorAll('button[data-p]').forEach(b => {
      b.addEventListener('click', () => {
        const np = Number(b.dataset.p);
        if (np < 1 || np > pages) return;
        onGo && onGo(np);
      });
    });
  }

  /* ---------- Khởi tạo UI chung trên mọi trang ---------- */
  async function initCommon(activePage) {
    // chờ tải dữ liệu từ server vào cache trước khi render
    await Store.ready;
    // áp dụng màu chủ đạo từ settings
    const st = Store.getSettings();
    if (st.themeColor)
      document.documentElement.style.setProperty("--accent", st.themeColor);
    renderHeader(activePage);
    renderFooter();
    updateCartBadge();

    // popup giỏ hàng (modal trung tâm)
    const overlay = document.createElement("div");
    overlay.id = "cart-overlay";
    overlay.className = "overlay";
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
    popup.id = "cart-drawer";
    popup.className = "cart-popup";
    popup.innerHTML =
      '<div class="cart-popup-head"><h3>' +
      icon("cart") +
      ' Giỏ hàng</h3><button class="modal-close" id="drawer-close" aria-label="Đóng">' +
      icon("close") +
      '</button></div><div class="cart-popup-body" id="cart-drawer-body"></div>';
    document.body.appendChild(popup);

    document
      .getElementById("drawer-close")
      .addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    // product modal container
    const modal = document.createElement("div");
    modal.id = "product-modal";
    modal.className = "modal";
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
    document.body.appendChild(modal);
  }

  return {
    fmt,
    fmtDate,
    esc,
    assetUrl,
    imgTag,
    icon,
    toast,
    pager,
    renderHeader,
    updateCartBadge,
    openDrawer,
    closeDrawer,
    openProductModal,
    renderFooter,
    productCard,
    initCommon,
  };
})();
