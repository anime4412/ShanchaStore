/* ============================================================
   ShanChaStore - admin.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Quản trị (admin.html).
   ============================================================
   Từng phần làm gì:
   - gate()          : BẢO VỆ — chỉ admin mới vào; không phải admin thì
                       chuyển về admin-login.html.
   - view(name)      : chuyển giữa các màn hình (Dashboard, Sản phẩm, Danh mục,
                       Topping, Đơn hàng, Đánh giá, Khách hàng, Cài đặt).
   - renderDashboard : thống kê KPI (doanh thu, đơn hôm nay, đơn, sản phẩm,
                       khách hàng, TB giá trị đơn), biểu đồ doanh thu 7 ngày,
                       top sản phẩm bán chạy, đánh giá website (xoá nhanh),
                       đơn hàng gần đây.
   - renderProducts  : bảng CRUD sản phẩm (tìm/lọc, sửa, xoá) + form modal
                       thêm/sửa sản phẩm (kèm upload ảnh base64).
   - renderCategories: bảng quản lý DANH MỤC (tên/id/số sản phẩm, sửa, xoá)
                       + form modal thêm/sửa danh mục (Save qua POST /api/categories).
   - renderToppings  : CRUD topping (mỗi topping = tên + giá).
   - renderOrders    : bảng đơn hàng — xem chi tiết + đổi trạng thái
                       (Chờ xử lý / Đang giao / Hoàn thành / Đã huỷ).
   - renderUsers     : danh sách khách hàng — khoá/mở khoá, xoá.
   - renderReviews   : 2 bảng đánh giá (sản phẩm + website) — tìm kiếm, lọc sao,
                       xoá; khi xoá đánh giá sản phẩm, rating tính lại tự động.
   - renderSettings  : form cài đặt website — tên, slogan, mô tả, hotline, email,
                       địa chỉ, giờ mở, màu chủ đạo, logo, % sale, thời gian sale.
                       Lưu qua Store.setSettings() -> bảng settings (SQLite), VĨNH VIỄN.
   ============================================================ */

'use strict';

const Admin = (function () {

  let currentView = 'dashboard';

  /* ---------- Bảo vệ: chỉ admin mới vào được (staff cũng vào được — PHASE 4) ---------- */
  function gate() {
    if (!Store.isLoggedIn()) {
      location.href = 'admin-login.html';
      return false;
    }
    if (!Store.isAdmin() && !Store.isStaff()) {
      location.href = 'admin-login.html';
      return false;
    }
    const user = Store.currentUser();
    document.getElementById('admin-user-name').textContent = user.name;
    document.getElementById('admin-user-name').textContent += (user.role === 'admin' ? ' (ADMIN)' : ' (STAFF)');
    /* staff chỉ thấy: Dashboard, Sản phẩm (chỉ bật/tắt hết hàng), Đơn hàng */
    if (user.role !== 'admin') {
      ['categories', 'banners', 'stores', 'customer-reviews', 'groups', 'promos', 'newsletters', 'toppings', 'reviews', 'users', 'settings', 'audit'].forEach(v => {
        const btn = document.querySelector('.admin-nav button[data-view="' + v + '"]');
        if (btn) btn.style.display = 'none';
      });
      ['dashboard', 'products', 'orders'].forEach(v => {
        const btn = document.querySelector('.admin-nav button[data-view="' + v + '"]');
        if (btn) btn.style.display = '';
      });
    }
    return true;
  }

  /* ---------- Chuyển view ---------- */
  function view(name) {
    currentView = name;
    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    ['dashboard', 'products', 'categories', 'banners', 'stores', 'customer-reviews', 'groups', 'promos', 'newsletters', 'toppings', 'orders', 'reviews', 'users', 'settings', 'audit'].forEach(v => {
      document.getElementById('view-' + v).style.display = v === name ? 'block' : 'none';
    });
    const titles = {
      dashboard: 'Dashboard', products: 'Quản lý sản phẩm', categories: 'Quản lý danh mục',
      banners: 'Quản lý Banner', stores: 'Quản lý chi nhánh', 'customer-reviews': 'Nhận xét khách hàng',
      groups: 'Nhóm sản phẩm', promos: 'Mã giảm giá', newsletters: 'Newsletter',
      toppings: 'Quản lý Topping', orders: 'Quản lý đơn hàng', reviews: 'Quản lý đánh giá',
      users: 'Quản lý khách hàng', settings: 'Cài đặt website', audit: 'Nhật ký hệ thống'
    };
    document.getElementById('view-title').textContent = titles[name];
    if (name === 'dashboard') renderDashboard();
    if (name === 'products') renderProducts();
    if (name === 'categories') renderCategories();
    if (name === 'banners') renderBanners();
    if (name === 'stores') renderStores();
    if (name === 'customer-reviews') renderCustomerReviews();
    if (name === 'groups') renderGroups();
    if (name === 'promos') renderPromos();
    if (name === 'newsletters') renderNewsletters();
    if (name === 'toppings') renderToppings();
    if (name === 'orders') renderOrders();
    if (name === 'reviews') renderReviews();
    if (name === 'users') renderUsers();
    if (name === 'settings') renderSettings();
    if (name === 'audit') renderAudit();
  }

  // inject icon SVG đơn sắc cho sidebar (data-ic)
  document.querySelectorAll('[data-ic]').forEach(el => {
    const nm = el.dataset.ic;
    if (nm && UI.icon) el.innerHTML = UI.icon(nm);
  });

  document.querySelectorAll('.admin-nav button').forEach(b => {
    b.addEventListener('click', () => view(b.dataset.view));
  });
  document.getElementById('admin-logout').addEventListener('click', () => {
    Auth.logout();
    location.href = 'index.html';
  });
  /* ---------- Trạng thái đơn (state machine 7 bước — PHASE 5) ---------- */
  const STATUS = {
    pending: { label: 'Chờ xác nhận', cls: 'badge-processing', next: ['confirmed', 'cancelled'] },
    confirmed: { label: 'Đã xác nhận', cls: 'badge-processing', next: ['preparing', 'cancelled'] },
    preparing: { label: 'Đang pha chế', cls: 'badge-delivering', next: ['ready', 'cancelled'] },
    ready: { label: 'Sẵn sàng', cls: 'badge-delivering', next: ['delivering'] },
    delivering: { label: 'Đang giao', cls: 'badge-delivering', next: ['completed'] },
    completed: { label: 'Hoàn thành', cls: 'badge-done', next: [] },
    cancelled: { label: 'Đã huỷ', cls: 'badge-cancelled', next: [] }
  };
  const PAYMENT_STATUS = {
    pending: { label: 'Chờ thanh toán', cls: 'badge-processing' },
    paid: { label: 'Đã thanh toán', cls: 'badge-done' },
    failed: { label: 'Thanh toán lỗi', cls: 'badge-cancelled' },
    refunded: { label: 'Đã hoàn tiền', cls: 'badge-cancelled' }
  };
  function statusBadge(s) { const st = STATUS[s] || STATUS.pending; return '<span class="badge-status ' + st.cls + '">' + st.label + '</span>'; }
  function payBadge(s) { const st = PAYMENT_STATUS[s] || PAYMENT_STATUS.pending; return '<span class="badge-status ' + st.cls + '">' + st.label + '</span>'; }

  /* ================= DASHBOARD =================
     Tính toán các chỉ số từ Store.getOrders()/getProducts()/getUsers()
     rồi đổ vào lưới KPI, biểu đồ cột 7 ngày, top bán chạy,
     bảng đánh giá website + đơn hàng gần đây. */
  function renderDashboard() {
    const orders = Store.getOrders();
    const products = Store.getProducts();
    const users = Store.getUsers().filter(u => u.role === 'customer');
    const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
    const doneCount = orders.filter(o => o.status === 'done').length;
    const valid = orders.filter(o => o.status !== 'cancelled');
    const avgOrder = valid.length ? Math.round(revenue / valid.length) : 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => o.created >= todayStart.getTime() && o.status !== 'cancelled');
    const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);

    const kpi = [
      { label: 'Doanh thu', value: UI.fmt(revenue), sub: doneCount + ' đơn hoàn thành' },
      { label: 'Đơn hôm nay', value: todayOrders.length, sub: UI.fmt(todayRevenue) + ' hôm nay' },
      { label: 'Đơn hàng', value: orders.length, sub: orders.filter(o => o.status === 'processing').length + ' chờ xử lý' },
      { label: 'Sản phẩm', value: products.length, sub: products.filter(p => p.group === 'sale').length + ' đang khuyến mãi' },
      { label: 'Khách hàng', value: users.length, sub: users.filter(u => !u.blocked).length + ' đang hoạt động' },
      { label: 'TB giá trị đơn', value: UI.fmt(avgOrder), sub: 'trên ' + valid.length + ' đơn hợp lệ' }
    ];
    document.getElementById('kpi-grid').innerHTML = kpi.map(k =>
      '<div class="kpi-card"><div class="kpi-label">' + k.label + '</div><div class="kpi-value">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>'
    ).join('');

    // biểu đồ doanh thu 7 ngày
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const sum = orders.filter(o => o.status !== 'cancelled' && o.created >= d.getTime() && o.created < next.getTime())
        .reduce((s, o) => s + o.total, 0);
      days.push({ label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), value: sum });
    }
    const max = Math.max(...days.map(d => d.value), 1);
    const chart = document.getElementById('revenue-chart');
    chart.innerHTML =
      '<div class="chart-bars">' + days.map(d =>
        '<div class="chart-bar" style="height:' + Math.max(3, (d.value / max) * 100) + '%" title="' + d.label + ': ' + UI.fmt(d.value) + '">' +
        (d.value ? '<span class="chart-val">' + (d.value >= 1000000 ? (d.value / 1000000).toFixed(1) + 'tr' : Math.round(d.value / 1000) + 'k') + '</span>' : '') +
        '</div>').join('') + '</div>' +
      '<div class="chart-labels">' + days.map(d => '<span>' + d.label + '</span>').join('') + '</div>';

    // top sản phẩm bán chạy (theo lượt bán trong đơn)
    const soldMap = {};
    orders.forEach(o => (o.items || []).forEach(it => {
      soldMap[it.name] = (soldMap[it.name] || 0) + it.qty;
    }));
    const topList = Object.keys(soldMap)
      .map(name => ({ name, qty: soldMap[name] }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const topEl = document.getElementById('top-products');
    if (topEl) {
      topEl.innerHTML =
        '<thead><tr><th>Sản phẩm</th><th>Lượt bán</th></tr></thead><tbody>' +
        (topList.length ? topList.map((t, i) =>
          '<tr><td>#' + (i + 1) + ' ' + UI.esc(t.name) + '</td><td>' + t.qty + '</td></tr>'
        ).join('') : '<tr><td colspan="2" style="text-align:center;color:var(--muted)">Chưa có đơn hàng</td></tr>') +
        '</tbody>';
    }

    // đánh giá website
    const siteReviews = Store.getSiteReviews();
    const srCount = document.getElementById('site-review-count');
    if (srCount) srCount.textContent = siteReviews.length + ' lượt';
    const srTable = document.getElementById('site-reviews-table');
    if (srTable) {
      srTable.innerHTML =
        '<thead><tr><th>Người đánh giá</th><th>Sao</th><th>Nội dung</th><th>Thời gian</th><th></th></tr></thead><tbody>' +
        (siteReviews.length ? siteReviews.slice(0, 6).map(r =>
          '<tr data-id="' + r.id + '">' +
          '<td><b>' + UI.esc(r.userName) + '</b></td>' +
          '<td><span class="stars">' + '★'.repeat(r.rating) + '</span></td>' +
          '<td class="review-comment">' + UI.esc(r.comment || '—') + '</td>' +
          '<td>' + UI.fmtDate(r.created) + '</td>' +
          '<td><div class="row-actions"><button class="icon-btn danger" data-act="del-site-review" title="Xoá">' + UI.icon('trash') + '</button></div></td>' +
          '</tr>'
        ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Chưa có đánh giá website</td></tr>') +
        '</tbody>';
      srTable.querySelectorAll('[data-act="del-site-review"]').forEach(b => {
        b.addEventListener('click', async () => {
          const id = Number(b.closest('tr').dataset.id);
          if (!confirm('Xoá đánh giá website này?')) return;
          try {
            await Store.deleteSiteReview(id);
            renderDashboard();
            UI.toast('Đã xoá đánh giá website.', 'ok');
          } catch (err) {
            UI.toast(err.message, 'danger');
          }
        });
      });
    }

    // đơn gần đây
    const recent = orders.slice(0, 6);
    document.getElementById('recent-orders').innerHTML =
      '<thead><tr><th>Mã</th><th>Khách</th><th>Tổng</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>' +
      (recent.length ? recent.map(o =>
        '<tr><td><b>' + o.code + '</b></td><td>' + UI.esc(o.customer) + '</td><td>' + UI.fmt(o.total) + '</td>' +
        '<td>' + statusBadge(o.status) + '</td><td>' + UI.fmtDate(o.created) + '</td></tr>'
      ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Chưa có đơn hàng</td></tr>') +
      '</tbody>';
  }

  /* ================= SẢN PHẨM (CRUD) =================
     renderCatOptions: tạo các <option> danh mục từ Store.getCategories().
     renderProducts: lọc theo từ khoá + danh mục + nhóm rồi vẽ bảng;
     nút Sửa mở form, nút Xoá gọi Store.deleteProduct (xoá luôn đánh giá). */
  function renderCatOptions(selected) {
    return Store.getCategories().map(c =>
      '<option value="' + UI.esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>'
    ).join('');
  }
  let admProdPage = 1;
  function renderProducts() {
    const q = (document.getElementById('adm-search').value || '').toLowerCase();
    const cat = document.getElementById('adm-cat').value;
    const group = document.getElementById('adm-group').value;
    // render động các option danh mục (giữ giá trị đang chọn)
    const admCat = document.getElementById('adm-cat');
    if (admCat && admCat.options.length <= 1) {
      admCat.innerHTML = '<option value="all">Tất cả danh mục</option>' + renderCatOptions('');
    }
    const cats = Store.getCategories();
    let list = Store.getProducts();
    if (cat !== 'all') list = list.filter(p => p.category === cat);
    if (group !== 'all') list = list.filter(p => p.group === group);
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q));

    // phân trang (10/trang)
    const ADM_PROD_PER = 10;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / ADM_PROD_PER));
    admProdPage = Math.min(admProdPage, pages);
    const pageList = list.slice((admProdPage - 1) * ADM_PROD_PER, admProdPage * ADM_PROD_PER);

    const tbody = pageList.map(p => {
      const catName = (cats.find(c => c.id === p.category) || {}).name || 'Khác';
      const groupName = (GROUPS.find(g => g.id === p.group) || {}).name;
      const soldOut = p.is_available === false;
      return (
        '<tr data-id="' + p.id + '">' +
        '<td><img class="thumb" src="' + UI.assetUrl(p.img) + '" alt=""></td>' +
        '<td><b>' + UI.esc(p.name) + '</b><div style="font-size:.78rem;color:var(--muted)">' + catName + ' · ' + groupName + '</div></td>' +
        '<td>' + UI.fmt(p.price) + '</td>' +
        '<td>' + (p.oldPrice > p.price ? UI.fmt(p.oldPrice) : '—') + '</td>' +
        '<td>' + UI.icon('star') + ' ' + p.rating + '</td>' +
        '<td>' + p.sold + '</td>' +
        '<td><span class="badge-status ' + (soldOut ? 'badge-cancelled' : 'badge-done') + '">' + (soldOut ? 'Hết hàng' : 'Còn hàng') + '</span></td>' +
        '<td><div class="row-actions">' +
        (Store.isAdmin() ? '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' : '') +
        '<button class="icon-btn" data-act="avail" title="' + (soldOut ? 'Bật bán (còn hàng)' : 'Tắt bán (hết hàng)') + '">' + UI.icon(soldOut ? 'unlock' : 'lock') + '</button>' +
        (Store.isAdmin() ? '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' : '') +
        '</div></td>' +
        '</tr>'
      );
    }).join('');

    document.getElementById('adm-products-table').innerHTML =
      '<thead><tr><th>Ảnh</th><th>Tên</th><th>Giá</th><th>Giá cũ</th><th>Rating</th><th>Đã bán</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Không có sản phẩm</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#adm-products-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openProductForm(Number(b.closest('tr').dataset.id)));
    });
    document.querySelectorAll('#adm-products-table [data-act="avail"]').forEach(b => {
      b.addEventListener('click', async () => {
        const tbody2 = b.closest('tr');
        const id = Number(tbody2.dataset.id);
        const p = Store.getProduct(id);
        try {
          const saved = await Store.toggleAvailability(id, !(p.is_available !== false));
          renderProducts();
          UI.toast(saved.is_available ? 'Đã bật bán "' + saved.name + '".' : 'Đã tắt bán "' + saved.name + '".', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });
    document.querySelectorAll('#adm-products-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = Number(b.closest('tr').dataset.id);
        const p = Store.getProduct(id);
        if (!confirm('Xoá sản phẩm "' + p.name + '"?')) return;
        try {
          await Store.deleteProduct(id);
          renderProducts();
          UI.toast('Đã xoá sản phẩm.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });

    // phân trang admin sản phẩm
    const pagerEl = document.getElementById('adm-products-pager');
    if (pagerEl) {
      UI.pager(pagerEl, admProdPage, pages, total, np => { admProdPage = np; renderProducts(); });
    }
  }

  function openProductForm(id) {
    const modal = document.getElementById('product-form-modal');
    modal.classList.add('open');
    document.getElementById('pf-title').textContent = id ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
    const p = id ? Store.getProduct(id) : null;
    document.getElementById('pf-id').value = p ? p.id : '';
    document.getElementById('pf-name').value = p ? p.name : '';
    document.getElementById('pf-cat').innerHTML = renderCatOptions(p ? p.category : '');
    document.getElementById('pf-group').value = p ? p.group : 'new';
    document.getElementById('pf-price').value = p ? p.price : '';
    document.getElementById('pf-oldprice').value = p && p.oldPrice > p.price ? p.oldPrice : '';
    document.getElementById('pf-desc').value = p ? p.desc : '';
    document.getElementById('pf-img').value = p ? p.img : '';
    document.getElementById('pf-rating').value = p ? p.rating : 4.5;
    document.getElementById('pf-sold').value = p ? p.sold : 0;
    document.getElementById('pf-avail').value = p && p.is_available === false ? '0' : '1';
    // preview ảnh
    const prev = document.getElementById('pf-img-preview');
    const img = document.getElementById('pf-img').value;
    prev.innerHTML = img ? '<img src="' + (img.indexOf('data:') === 0 || img.indexOf('http') === 0 ? img : 'assets/images/' + img) + '" alt="" style="height:56px;border-radius:10px;object-fit:cover;border:1px solid var(--line)">' : '';
  }

  // upload ảnh từ máy -> base64 (tự cắt vuông 1:1 + chuẩn hoá 800x800 cho nét)
  document.getElementById('pf-img-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml|bmp|avif)$/i.test(f.type) && !/\.(png|jpe?g|webp|svg|bmp|avif)$/i.test(f.name)) {
      UI.toast('Vui lòng chọn file ảnh (PNG/JPG/WEBP/SVG).', 'warn');
      e.target.value = '';
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const S = 800; // kích thước chuẩn cho ảnh sản phẩm (khung vuông 1:1)
      if (img.naturalWidth < 400 || img.naturalHeight < 400) {
        UI.toast('Ảnh hơi nhỏ (' + img.naturalWidth + 'x' + img.naturalHeight + '), nên dùng ảnh ≥ 800px.', 'warn');
      }
      // cắt phần giữa theo tỷ lệ vuông
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (sw > sh) { sx = Math.round((sw - sh) / 2); sw = sh; }
      else { sy = Math.round((sh - sw) / 2); sh = sw; }
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, S, S);
      const isTransparent = f.type === 'image/png' || f.type === 'image/webp' || f.type === 'image/svg+xml';
      const out = canvas.toDataURL(isTransparent ? 'image/png' : 'image/jpeg', 0.9);
      document.getElementById('pf-img').value = out;
      document.getElementById('pf-img-preview').innerHTML =
        '<img src="' + out + '" alt="" style="width:100%;max-width:120px;border-radius:10px;aspect-ratio:1;object-fit:cover;border:1px solid var(--line)">' +
        '<div style="font-size:.75rem;color:var(--muted);margin-top:4px">Đã chuẩn hoá 800×800 vuông.</div>';
      UI.toast('Đã chọn ảnh từ máy.', 'ok');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      UI.toast('Không đọc được file ảnh này.', 'danger');
      e.target.value = '';
    };
    img.src = url;
  });

  if (Store.isAdmin()) {
    document.getElementById('btn-new-product').addEventListener('click', () => openProductForm(null));
  } else {
    const nb = document.getElementById('btn-new-product');
    if (nb) nb.style.display = 'none';
  }
  document.getElementById('product-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('product-form-modal')) document.getElementById('product-form-modal').classList.remove('open');
  });
  document.getElementById('pf-modal-close').addEventListener('click', () => document.getElementById('product-form-modal').classList.remove('open'));
  document.getElementById('pf-cancel').addEventListener('click', () => {
    document.getElementById('product-form-modal').classList.remove('open');
  });

  document.getElementById('product-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('pf-name').value.trim();
    const price = Number(document.getElementById('pf-price').value);
    if (!name || price <= 0) { UI.toast('Tên và giá hợp lệ là bắt buộc.', 'warn'); return; }

    const idField = document.getElementById('pf-id').value;
    const cat = document.getElementById('pf-cat').value;
    const group = document.getElementById('pf-group').value;
    const oldPrice = Number(document.getElementById('pf-oldprice').value) || 0;
    const img = document.getElementById('pf-img').value.trim();
    // nếu để trống -> ảnh mặc định theo danh mục (fallback svg cũ)
    const fallbackImg = { 'tra-sua': 'tra-sua-olong.svg', 'tra-lanh': 'tra-dao.svg', 'ca-phe': 'ca-phe-sua-da.svg' };
    const finalImg = img || fallbackImg[cat] || 'tra-sua-olong.svg';

    const product = {
      id: idField ? Number(idField) : Store.nextProductId(),
      name,
      category: cat,
      group,
      price,
      oldPrice: oldPrice > price ? oldPrice : price,
      img: finalImg,
      desc: document.getElementById('pf-desc').value.trim() || 'Món mới tại ShanCha, pha chế thủ công.',
      rating: Math.min(5, Math.max(0, Number(document.getElementById('pf-rating').value) || 4.5)),
      sold: Number(document.getElementById('pf-sold').value) || 0,
      is_available: document.getElementById('pf-avail').value === '1'
    };
    try {
      await Store.saveProduct(product);
      document.getElementById('product-form-modal').classList.remove('open');
      renderProducts();
      UI.toast(idField ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.', 'ok');
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });

  document.getElementById('adm-search').addEventListener('input', () => { admProdPage = 1; renderProducts(); });
  document.getElementById('adm-cat').addEventListener('change', () => { admProdPage = 1; renderProducts(); });
  document.getElementById('adm-group').addEventListener('change', () => { admProdPage = 1; renderProducts(); });

  /* ================= ĐƠN HÀNG =================
     Bảng đơn hàng có tìm kiếm + lọc trạng thái + đổi trạng thái (state machine)
     + đổi trạng thái thanh toán. */
  let orderQ = '';
  function renderOrders() {
    const status = document.getElementById('adm-status').value;
    let list = Store.getOrders();
    if (status !== 'all') list = list.filter(o => o.status === status);
    if (orderQ) {
      const q = orderQ.toLowerCase();
      list = list.filter(o =>
        (o.code || '').toLowerCase().includes(q) ||
        (o.name || '').toLowerCase().includes(q) ||
        (o.customer || '').toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q)
      );
    }
    /* phân trang (PHASE 26) */
    const page = Number(document.getElementById('adm-orders-page') ? document.getElementById('adm-orders-page').value : 1) || 1;
    const per = 20;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const cur = Math.min(page, pages);
    const pageList = list.slice((cur - 1) * per, cur * per);

    const tbody = pageList.map(o => {
      const itemCount = o.items.reduce((n, it) => n + it.qty, 0);
      /* dropdown chỉ hiện trạng thái hợp lệ tiếp theo (state machine) */
      const allowed = STATUS[o.status] ? STATUS[o.status].next : [];
      const opts = (STATUS[o.status] ? ['<option value="' + o.status + '" selected>' + STATUS[o.status].label + '</option>'] : [])
        .concat(allowed.map(s => '<option value="' + s + '">' + STATUS[s].label + '</option>')).join('');
      return (
        '<tr>' +
        '<td><b>' + o.code + '</b></td>' +
        '<td>' + UI.esc(o.name || o.customer) + '<div style="font-size:.78rem;color:var(--muted)">' + UI.esc(o.phone) + '</div></td>' +
        '<td>' + itemCount + ' món</td>' +
        '<td>' + UI.fmt(o.total) + (o.promo ? '<div class="order-promo-tag">' + UI.esc(o.promo) + '</div>' : '') + '</td>' +
        '<td>' + (o.shipFee ? UI.fmt(o.shipFee) : 'Miễn phí') + (o.shipKm ? '<div class="order-km-tag">~' + o.shipKm + ' km</div>' : '') + '</td>' +
        '<td>' + statusBadge(o.status) + '<div style="margin-top:4px">' + payBadge(o.payment_status) + '</div></td>' +
        '<td>' + UI.fmtDate(o.created) + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-act="detail" title="Chi tiết">' + UI.icon('eye') + '</button>' +
        '<select class="filter-select" data-act="status" style="padding:6px 8px"' + (allowed.length ? '' : ' disabled') + '>' + opts + '</select>' +
        '<select class="filter-select" data-act="pay" style="padding:6px 8px">' +
        Object.keys(PAYMENT_STATUS).map(p => '<option value="' + p + '"' + ((o.payment_status || 'pending') === p ? ' selected' : '') + '>' + PAYMENT_STATUS[p].label + '</option>').join('') +
        '</select>' +
        '</div></td>' +
        '</tr>'
      );
    }).join('');

    const pag = pages > 1
      ? '<div class="admin-pager">' +
        '<span>Trang ' + cur + '/' + pages + ' (' + total + ' đơn)</span>' +
        '<button class="btn btn-ghost btn-sm" data-page="' + (cur - 1) + '"' + (cur <= 1 ? ' disabled' : '') + '>‹ Trước</button>' +
        '<button class="btn btn-ghost btn-sm" data-page="' + (cur + 1) + '"' + (cur >= pages ? ' disabled' : '') + '>Sau ›</button>' +
        '</div>'
      : '';
    const pagerEl = document.getElementById('adm-orders-pager');
    if (pagerEl) pagerEl.innerHTML = pag;

    document.getElementById('adm-orders-table').innerHTML =
      '<thead><tr><th>Mã</th><th>Khách</th><th>Số món</th><th>Tổng</th><th>Phí ship</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Không có đơn hàng</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#adm-orders-table [data-act="detail"]').forEach(b => {
      b.addEventListener('click', () => showOrderDetail(b.closest('tr').querySelector('td b').textContent));
    });
    document.querySelectorAll('#adm-orders-table [data-act="status"]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const code = sel.closest('tr').querySelector('td b').textContent;
        try {
          await Store.setOrderStatus(code, sel.value);
          UI.toast('Đã cập nhật trạng thái đơn ' + code, 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
        renderOrders();
      });
    });
    document.querySelectorAll('#adm-orders-table [data-act="pay"]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const code = sel.closest('tr').querySelector('td b').textContent;
        try {
          await Store.setOrderPayment(code, sel.value);
          UI.toast('Đã cập nhật thanh toán đơn ' + code, 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
        renderOrders();
      });
    });
    mapPager(pagerEl);
  }
  function mapPager(el) {
    if (!el) return;
    el.querySelectorAll('[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        const page = Number(b.dataset.page);
        document.getElementById('adm-orders-page').value = page;
        renderOrders();
      });
    });
  }

  function showOrderDetail(code) {
    const o = Store.getOrders().find(x => x.code === code);
    if (!o) return;
    const modal = document.getElementById('order-modal');
    document.getElementById('order-modal-body').innerHTML =
      '<h2 style="margin-bottom:10px">Đơn ' + o.code + '</h2>' +
      '<div style="margin-bottom:16px">' + statusBadge(o.status) + ' <span style="color:var(--muted);font-size:.85rem">' + UI.fmtDate(o.created) + '</span></div>' +
      o.items.map(it => {
        const toppings = (it.toppings || []).length ? ' <span style="color:var(--accent);font-size:.8rem">(+' + it.toppings.map(t => t.name).join(', ') + ')</span>' : '';
        return '<div class="detail-line"><span>' + UI.esc(it.name) + ' × ' + it.qty + toppings + '</span><b>' + UI.fmt(Cart.lineTotal(it)) + '</b></div>';
      }).join('') +
      '<div class="detail-line"><span>Tạm tính</span><b>' + UI.fmt(o.subtotal) + '</b></div>' +
      (o.discount > 0 ? '<div class="detail-line"><span>Giảm giá (' + UI.esc(o.promo || 'ưu đãi') + ')</span><b style="color:var(--ok)">-' + UI.fmt(o.discount) + '</b></div>' : '') +
      '<div class="detail-line"><span>Phí giao hàng' + (o.shipKm ? ' (~' + o.shipKm + ' km từ ' + UI.esc(o.shipFrom) + ')' : '') + '</span><b>' + (o.shipFee ? UI.fmt(o.shipFee) : 'Miễn phí') + '</b></div>' +
      '<div class="detail-line"><span style="font-weight:900">Tổng cộng</span><b style="color:var(--primary)">' + UI.fmt(o.total) + '</b></div>' +
      '<hr style="border:none;border-top:1px dashed var(--line);margin:12px 0">' +
      '<div class="detail-line"><span>Khách hàng</span><b>' + UI.esc(o.name || o.customer) + '</b></div>' +
      '<div class="detail-line"><span>SĐT</span><b>' + UI.esc(o.phone) + '</b></div>' +
      '<div class="detail-line"><span>Địa chỉ</span><b style="text-align:right">' + UI.esc(o.address) + '</b></div>' +
      (o.note ? '<div class="detail-line"><span>Ghi chú</span><b>' + UI.esc(o.note) + '</b></div>' : '') +
      '<div class="detail-line"><span>Thanh toán</span><b>' + ({ cod: 'COD', bank: 'Chuyển khoản', card: 'Thẻ' }[o.payMethod] || o.payMethod) + '</b></div>' +
      '<div class="detail-line"><span>Trạng thái thanh toán</span><b>' + payBadge(o.payment_status) + '</b></div>' +
      '<div class="detail-line"><span>Nhận tại</span><b>' + UI.esc(o.store || '') + (o.store === 'Giao tận nơi' && o.shipFrom ? ' (giao từ ' + UI.esc(o.shipFrom) + ')' : '') + '</b></div>' +
      (o.lat && o.lng ? '<div class="detail-line"><span>Vị trí trên bản đồ</span><b><a href="https://maps.google.com/?q=' + o.lat + ',' + o.lng + '" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">Xem bản đồ</a></b></div>' : '');
    modal.classList.add('open');
  }

  document.getElementById('order-modal-close').addEventListener('click', () => document.getElementById('order-modal').classList.remove('open'));
  document.getElementById('order-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('order-modal')) document.getElementById('order-modal').classList.remove('open');
  });

  document.getElementById('adm-status').addEventListener('change', renderOrders);
  const admOrderSearch = document.getElementById('adm-order-search');
  if (admOrderSearch) admOrderSearch.addEventListener('input', () => { orderQ = admOrderSearch.value.trim(); renderOrders(); });

  /* ================= KHÁCH HÀNG =================
     Bảng users: tên/@username, email, SĐT, vai trò, số đơn + tổng chi tiêu,
     trạng thái; nút khoá/mở khoá (xoá phiên) + xoá (không xoá được admin). */
  let admUserPage = 1;
  function renderUsers() {
    const users = Store.getUsers();
    const orders = Store.getOrders();
    const ADM_USER_PER = 10;
    const total = users.length;
    const pages = Math.max(1, Math.ceil(total / ADM_USER_PER));
    admUserPage = Math.min(admUserPage, pages);
    const pageUsers = users.slice((admUserPage - 1) * ADM_USER_PER, admUserPage * ADM_USER_PER);
    const tbody = pageUsers.map(u => {
      const orderCount = orders.filter(o => o.userId === u.id).length;
      const total = orders.filter(o => o.userId === u.id && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
      return (
        '<tr>' +
        '<td><b>' + UI.esc(u.name) + '</b><div style="font-size:.78rem;color:var(--muted)">@' + UI.esc(u.username) + '</div></td>' +
        '<td>' + UI.esc(u.email) + '</td>' +
        '<td>' + UI.esc(u.phone) + '</td>' +
        '<td>' + (u.role === 'admin' ? '<span class="badge-admin">ADMIN</span>' : u.role === 'staff' ? '<span class="badge-status badge-processing">STAFF</span>' : 'Khách hàng') + '</td>' +
        '<td>' + orderCount + ' đơn · ' + UI.fmt(total) + '</td>' +
        '<td>' + (u.blocked ? '<span class="badge-status badge-cancelled">Bị khoá</span>' : '<span class="badge-status badge-done">Hoạt động</span>') + '</td>' +
        '<td><div class="row-actions">' +
        (u.role !== 'admin' ? '<select class="filter-select" data-act="role" data-id="' + u.id + '" style="padding:4px 6px;font-size:.8rem">' +
          '<option value="customer"' + (u.role === 'customer' ? ' selected' : '') + '>KH</option>' +
          '<option value="staff"' + (u.role === 'staff' ? ' selected' : '') + '>Staff</option>' +
          '</select>' : '') +
        (u.role !== 'admin' ? '<button class="icon-btn" data-act="block" title="' + (u.blocked ? 'Mở khoá' : 'Khoá') + '">' + UI.icon(u.blocked ? 'unlock' : 'lock') + '</button>' : '') +
        (u.role !== 'admin' ? '<button class="icon-btn danger" data-act="del" title="Xoá khách hàng">' + UI.icon('trash') + '</button>' : '') +
        '</div></td>' +
        '</tr>'
      );
    }).join('');

    document.getElementById('adm-users-table').innerHTML =
      '<thead><tr><th>Người dùng</th><th>Email</th><th>SĐT</th><th>Vai trò</th><th>Mua hàng</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      tbody + '</tbody>';

    document.querySelectorAll('#adm-users-table [data-act="role"]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const uid = sel.dataset.id;
        const users = Store.getUsers();
        const u = users.find(x => x.id === uid);
        if (!u || u.role === 'admin') return;
        try {
          await Store.updateUser({ ...u, role: sel.value });
          renderUsers();
          UI.toast('Đã đổi vai trò thành ' + (sel.value === 'staff' ? 'STAFF' : 'khách hàng') + '.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });
    document.querySelectorAll('#adm-users-table [data-act="block"]').forEach(b => {
      b.addEventListener('click', async () => {
        const uname = b.closest('tr').querySelector('td b').textContent;
        const users = Store.getUsers();
        const u = users.find(x => x.name === uname);
        if (!u) return;
        try {
          const saved = await Store.updateUser({ ...u, blocked: !u.blocked });
          renderUsers();
          UI.toast(saved.blocked ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });
    // Xoá khách hàng (chỉ khách, không phải admin)
    document.querySelectorAll('#adm-users-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        const uname = b.closest('tr').querySelector('td b').textContent;
        const users = Store.getUsers();
        const u = users.find(x => x.name === uname);
        if (!u || u.role === 'admin') return;
        if (!confirm('Xoá khách hàng "' + u.name + '" vĩnh viễn? Các đơn của họ vẫn được giữ lại.')) return;
        try {
          await Store.deleteUser(u.id);
          renderUsers();
          UI.toast('Đã xoá khách hàng.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });

    // phân trang khách hàng
    const pagerEl = document.getElementById('adm-users-pager');
    if (pagerEl) {
      UI.pager(pagerEl, admUserPage, pages, total, np => { admUserPage = np; renderUsers(); });
    }
  }

  /* ================= ĐÁNH GIÁ (sản phẩm + website) =================
     renderReviews: 2 bảng từ Store.getReviews() (đánh giá sản phẩm — kèm tên
     sản phẩm, lọc theo sao, tìm người gửi/nội dung) và Store.getSiteReviews().
     Nút Xoá: DELETE /api/reviews/:id (server tính lại rating sản phẩm)
     hoặc DELETE /api/site-reviews/:id. */
  let admRvPage = 1, admSrPage = 1;
  function renderReviews() {
    // ---- Đánh giá sản phẩm ----
    const q = (document.getElementById('rv-search').value || '').toLowerCase();
    const star = document.getElementById('rv-filter').value;
    let list = Store.getReviews();
    if (star !== 'all') list = list.filter(r => r.rating === Number(star));
    if (q) list = list.filter(r =>
      (r.userName || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q)
    );

    const rvBadge = document.getElementById('rv-count-badge');
    if (rvBadge) rvBadge.textContent = list.length + ' / ' + Store.getReviews().length + ' lượt';

    // phân trang đánh giá sản phẩm (8/trang)
    const RV_PER = 8;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / RV_PER));
    admRvPage = Math.min(admRvPage, pages);
    const pageList = list.slice((admRvPage - 1) * RV_PER, admRvPage * RV_PER);

    const rvTbody = pageList.map(r => {
      const p = Store.getProduct(r.productId);
      const prodName = p ? p.name : 'Sản phẩm #' + r.productId;
      return (
        '<tr data-id="' + r.id + '">' +
        '<td><b>' + UI.esc(prodName) + '</b></td>' +
        '<td><b>' + UI.esc(r.userName) + '</b></td>' +
        '<td><span class="stars">' + '★'.repeat(r.rating) + '</span></td>' +
        '<td class="review-comment">' + UI.esc(r.comment || '—') + '</td>' +
        '<td>' + (r.status === 'approved' || r.status === '' ? '<span class="badge-status badge-done">Đã duyệt</span>' : r.status === 'hidden' ? '<span class="badge-status badge-cancelled">Đã ẩn</span>' : '<span class="badge-status badge-processing">Chờ duyệt</span>') + '</td>' +
        '<td>' + UI.fmtDate(r.created) + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-act="mod-review" data-status="approved" title="Duyệt">' + UI.icon('check') + '</button>' +
        '<button class="icon-btn" data-act="mod-review" data-status="hidden" title="Ẩn">' + UI.icon('eye') + '</button>' +
        '<button class="icon-btn danger" data-act="del-review" title="Xoá">' + UI.icon('trash') + '</button>' +
        '</div></td>' +
        '</tr>'
      );
    }).join('');

    document.getElementById('adm-reviews-table').innerHTML =
      '<thead><tr><th>Sản phẩm</th><th>Người gửi</th><th>Sao</th><th>Nội dung</th><th>Trạng thái</th><th>Thời gian</th><th></th></tr></thead><tbody>' +
      (rvTbody || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Chưa có đánh giá sản phẩm</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#adm-reviews-table [data-act="mod-review"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = Number(b.closest('tr').dataset.id);
        const status = b.dataset.status;
        try {
          await Store.modReview(id, status);
          renderReviews();
          UI.toast(status === 'approved' ? 'Đã duyệt đánh giá.' : 'Đã ẩn đánh giá.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });
    document.querySelectorAll('#adm-reviews-table [data-act="del-review"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = Number(b.closest('tr').dataset.id);
        const r = Store.getReviews().find(x => x.id === id);
        if (!r) return;
        if (!confirm('Xoá đánh giá này? Rating của sản phẩm sẽ được tính lại.')) return;
        try {
          await Store.deleteReview(id);
          renderReviews();
          UI.toast('Đã xoá đánh giá.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });

    // phân trang đánh giá sản phẩm
    const rvPager = document.getElementById('adm-reviews-pager');
    if (rvPager) {
      UI.pager(rvPager, admRvPage, pages, total, np => { admRvPage = np; renderReviews(); });
    }

    // ---- Đánh giá website ----
    const sq = (document.getElementById('sr-search').value || '').toLowerCase();
    let sList = Store.getSiteReviews();
    if (sq) sList = sList.filter(r =>
      (r.userName || '').toLowerCase().includes(sq) ||
      (r.comment || '').toLowerCase().includes(sq)
    );

    const srBadge = document.getElementById('sr-count-badge');
    if (srBadge) srBadge.textContent = sList.length + ' / ' + Store.getSiteReviews().length + ' lượt';

    // phân trang đánh giá website (8/trang)
    const SR_PER = 8;
    const sTotal = sList.length;
    const sPages = Math.max(1, Math.ceil(sTotal / SR_PER));
    admSrPage = Math.min(admSrPage, sPages);
    const sPageList = sList.slice((admSrPage - 1) * SR_PER, admSrPage * SR_PER);

    const srTbody = sPageList.map(r =>
      '<tr data-id="' + r.id + '">' +
      '<td><b>' + UI.esc(r.userName) + '</b></td>' +
      '<td><span class="stars">' + '★'.repeat(r.rating) + '</span></td>' +
      '<td class="review-comment">' + UI.esc(r.comment || '—') + '</td>' +
      '<td>' + UI.fmtDate(r.created) + '</td>' +
      '<td><div class="row-actions">' +
      '<button class="icon-btn danger" data-act="del-site-review" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div></td>' +
      '</tr>'
    ).join('');

    document.getElementById('adm-site-reviews-table').innerHTML =
      '<thead><tr><th>Người gửi</th><th>Sao</th><th>Nội dung</th><th>Thời gian</th><th></th></tr></thead><tbody>' +
      (srTbody || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Chưa có đánh giá website</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#adm-site-reviews-table [data-act="del-site-review"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = Number(b.closest('tr').dataset.id);
        if (!confirm('Xoá đánh giá website này?')) return;
        try {
          await Store.deleteSiteReview(id);
          renderReviews();
          UI.toast('Đã xoá đánh giá website.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });

    // phân trang đánh giá website
    const srPager = document.getElementById('adm-site-reviews-pager');
    if (srPager) {
      UI.pager(srPager, admSrPage, sPages, sTotal, np => { admSrPage = np; renderReviews(); });
    }
  }

  document.getElementById('rv-search').addEventListener('input', renderReviews);
  document.getElementById('rv-filter').addEventListener('change', renderReviews);
  document.getElementById('sr-search').addEventListener('input', renderReviews);

  /* ================= DANH MỤC (CRUD) =================
     renderCategories: bảng danh mục (tên, id, số sản phẩm) + nút Sửa/Xoá.
     openCatForm: mở modal thêm/sửa — khi sửa thì khoá ô ID.
     Xoá: gọi Store.deleteCategory; server chặn nếu danh mục còn sản phẩm. */
  function renderCategories() {
    const q = (document.getElementById('cat-search').value || '').toLowerCase();
    let list = Store.getCategories();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    const products = Store.getProducts();

    const tbody = list.map(c => {
      const count = products.filter(p => p.category === c.id).length;
      return (
        '<tr data-id="' + c.id + '">' +
        '<td><b>' + UI.esc(c.name) + '</b></td>' +
        '<td><code style="font-size:.8rem">' + UI.esc(c.id) + '</code></td>' +
        '<td>' + count + ' sản phẩm</td>' +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
        '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
        '</div></td>' +
        '</tr>'
      );
    }).join('');

    document.getElementById('adm-cats-table').innerHTML =
      '<thead><tr><th>Tên</th><th>ID</th><th>Số sản phẩm</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Không có danh mục</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#adm-cats-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openCatForm(b.closest('tr').dataset.id));
    });
    document.querySelectorAll('#adm-cats-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.closest('tr').dataset.id;
        const c = Store.getCategory(id);
        if (!c) return;
        if (!confirm('Xoá danh mục "' + c.name + '"?')) return;
        try {
          await Store.deleteCategory(id);
          renderCategories();
          UI.toast('Đã xoá danh mục.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
          renderCategories();
        }
      });
    });
  }

  function openCatForm(id) {
    const modal = document.getElementById('cat-form-modal');
    modal.classList.add('open');
    const c = id ? Store.getCategory(id) : null;
    document.getElementById('cf-title').textContent = c ? 'Sửa danh mục' : 'Thêm danh mục';
    document.getElementById('cf-id').value = c ? c.id : '';
    document.getElementById('cf-id-input').value = c ? c.id : '';
    document.getElementById('cf-name').value = c ? c.name : '';
    document.getElementById('cf-id-input').disabled = !!c; // không đổi id khi sửa (tránh phức tạp)
  }

  document.getElementById('btn-new-category').addEventListener('click', () => openCatForm(null));
  document.getElementById('cf-cancel').addEventListener('click', () => document.getElementById('cat-form-modal').classList.remove('open'));
  document.getElementById('cf-modal-close').addEventListener('click', () => document.getElementById('cat-form-modal').classList.remove('open'));
  document.getElementById('cat-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('cat-form-modal')) document.getElementById('cat-form-modal').classList.remove('open');
  });
  document.getElementById('cat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const idInput = document.getElementById('cf-id-input').value.trim().toLowerCase().replace(/\s+/g, '-');
    const name = document.getElementById('cf-name').value.trim();
    if (!idInput || !name) { UI.toast('ID và tên danh mục là bắt buộc.', 'warn'); return; }
    const originalId = document.getElementById('cf-id').value;
    try {
      await Store.saveCategory({ id: idInput, name, originalId: originalId || undefined });
      document.getElementById('cat-form-modal').classList.remove('open');
      renderCategories();
      UI.toast(originalId ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục mới.', 'ok');
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });
  document.getElementById('cat-search').addEventListener('input', renderCategories);

  /* ================= BANNER (CRUD) ================= */
  function renderBanners() {
    const list = Store.getBanners();
    const tbody = list.map(b => (
      '<tr data-id="' + b.id + '">' +
      '<td><img class="thumb" src="' + (b.img.indexOf('data:') === 0 || b.img.indexOf('http') === 0 ? b.img : 'assets/images/' + b.img) + '" alt=""></td>' +
      '<td><b>' + UI.esc(b.title || '—') + '</b><div style="font-size:.78rem;color:var(--muted)">' + UI.esc(b.sub || '') + '</div></td>' +
      '<td>' + (b.active ? '<span class="badge-status badge-done">Hiện</span>' : '<span class="badge-status badge-cancelled">Ẩn</span>') + '</td>' +
      '<td><div class="row-actions">' +
      '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div></td>' +
      '</tr>'
    )).join('');
    document.getElementById('adm-banners-table').innerHTML =
      '<thead><tr><th>Ảnh</th><th>Tiêu đề</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Không có banner</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#adm-banners-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openBannerForm(Number(b.closest('tr').dataset.id)));
    });
    document.querySelectorAll('#adm-banners-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Xoá banner này?')) return;
        try { await Store.deleteBanner(Number(b.closest('tr').dataset.id)); renderBanners(); UI.toast('Đã xoá banner.', 'ok'); }
        catch (err) { UI.toast(err.message, 'danger'); }
      });
    });
  }
  function openBannerForm(id) {
    const modal = document.getElementById('banner-form-modal');
    modal.classList.add('open');
    const b = id ? Store.getBanners().find(x => x.id === id) : null;
    document.getElementById('bn-title').textContent = b ? 'Sửa banner' : 'Thêm banner';
    document.getElementById('bn-id').value = b ? b.id : '';
    document.getElementById('bn-img').value = b ? b.img : '';
    document.getElementById('bn-title-input').value = b ? (b.title || '') : '';
    document.getElementById('bn-sub').value = b ? (b.sub || '') : '';
    document.getElementById('bn-link').value = b ? (b.link || '') : '';
    document.getElementById('bn-sort').value = b ? (b.sort || 1) : 1;
    document.getElementById('bn-active').checked = b ? b.active : true;
    const prev = document.getElementById('bn-img-preview');
    prev.innerHTML = b && b.img ? '<img src="' + (b.img.indexOf('data:') === 0 || b.img.indexOf('http') === 0 ? b.img : 'assets/images/' + b.img) + '" alt="" style="height:48px;border-radius:8px;object-fit:cover;border:1px solid var(--line)">' : '';
  }
  document.getElementById('btn-new-banner').addEventListener('click', () => openBannerForm(null));
  document.getElementById('bn-cancel').addEventListener('click', () => document.getElementById('banner-form-modal').classList.remove('open'));
  document.getElementById('bn-modal-close').addEventListener('click', () => document.getElementById('banner-form-modal').classList.remove('open'));
  document.getElementById('banner-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('banner-form-modal')) document.getElementById('banner-form-modal').classList.remove('open');
  });
  // Upload ảnh banner: cắt đúng tỷ lệ khung 2.4:1 (1920x800), nén về đúng kích
  // thước chuẩn để banner luôn vừa khung, nét trên mọi màn hình, không bị mờ/vỡ.
  document.getElementById('bn-img-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml|bmp|avif)$/i.test(f.type) && !/\.(png|jpe?g|webp|svg|bmp|avif)$/i.test(f.name)) {
      UI.toast('Vui lòng chọn file ảnh (PNG/JPG/WEBP/SVG).', 'warn');
      e.target.value = '';
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const BW = 1920, BH = 800, RATIO = BW / BH; // tỷ lệ khung banner 2.4:1
      // nguồn quá nhỏ -> cảnh báo nhưng vẫn xử lý
      if (img.naturalWidth < 960 || img.naturalHeight < 400) {
        UI.toast('Ảnh hơi nhỏ (' + img.naturalWidth + 'x' + img.naturalHeight + '), banner có thể không nét. Nên dùng ảnh ≥ 1920px ngang.', 'warn');
      }
      // cắt phần giữa theo đúng tỷ lệ 2.4:1
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (sw / sh > RATIO) { sw = Math.round(sh * RATIO); sx = Math.round((img.naturalWidth - sw) / 2); }
      else { sh = Math.round(sw / RATIO); sy = Math.round((img.naturalHeight - sh) / 2); }
      const canvas = document.createElement('canvas');
      canvas.width = BW; canvas.height = BH;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, BW, BH);
      // JPEG 0.9: nét + file nhẹ; nếu ảnh có nền trong suốt (PNG) thì giữ PNG
      const isTransparent = f.type === 'image/png' || f.type === 'image/webp' || f.type === 'image/svg+xml';
      const out = canvas.toDataURL(isTransparent ? 'image/png' : 'image/jpeg', 0.9);
      document.getElementById('bn-img').value = out;
      document.getElementById('bn-img-preview').innerHTML =
        '<img src="' + out + '" alt="" style="width:100%;max-width:420px;border-radius:10px;aspect-ratio:12/5;object-fit:cover;border:1px solid var(--line)">' +
        '<div style="font-size:.75rem;color:var(--muted);margin-top:4px">Đã chuẩn hoá 1920×800 — nét trên mọi màn hình.</div>';
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      UI.toast('Không đọc được file ảnh này.', 'danger');
      e.target.value = '';
    };
    img.src = url;
  });
  document.getElementById('banner-form').addEventListener('submit', async e => {
    e.preventDefault();
    const img = document.getElementById('bn-img').value.trim();
    if (!img) { UI.toast('Ảnh banner là bắt buộc.', 'warn'); return; }
    const idField = document.getElementById('bn-id').value;
    try {
      await Store.saveBanner({
        id: idField ? Number(idField) : undefined,
        img, title: document.getElementById('bn-title-input').value.trim(),
        sub: document.getElementById('bn-sub').value.trim(),
        link: document.getElementById('bn-link').value.trim(),
        sort: Number(document.getElementById('bn-sort').value) || 1,
        active: document.getElementById('bn-active').checked
      });
      document.getElementById('banner-form-modal').classList.remove('open');
      renderBanners();
      UI.toast(idField ? 'Đã cập nhật banner.' : 'Đã thêm banner.', 'ok');
    } catch (err) { UI.toast(err.message, 'danger'); }
  });

  /* ================= CHI NHÁNH (CRUD) ================= */
  function renderStores() {
    const q = (document.getElementById('store-search').value || '').toLowerCase();
    let list = Store.getStores();
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
    const tbody = list.map(s => (
      '<tr data-id="' + s.id + '">' +
      '<td><b>' + UI.esc(s.name) + '</b><div style="font-size:.78rem;color:var(--muted)">' + UI.esc(s.address) + '</div></td>' +
      '<td>' + UI.esc(s.hours) + '</td>' +
      '<td>' + UI.esc(s.phone) + '</td>' +
      '<td>' + s.lat + ', ' + s.lng + '</td>' +
      '<td><div class="row-actions">' +
      '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div></td>' +
      '</tr>'
    )).join('');
    document.getElementById('adm-stores-table').innerHTML =
      '<thead><tr><th>Chi nhánh</th><th>Giờ</th><th>SĐT</th><th>Tọa độ</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Không có chi nhánh</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#adm-stores-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openStoreForm(b.closest('tr').dataset.id));
    });
    document.querySelectorAll('#adm-stores-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Xoá chi nhánh này?')) return;
        try { await Store.deleteStore(b.closest('tr').dataset.id); renderStores(); UI.toast('Đã xoá chi nhánh.', 'ok'); }
        catch (err) { UI.toast(err.message, 'danger'); }
      });
    });
  }
  function openStoreForm(id) {
    const modal = document.getElementById('store-form-modal');
    modal.classList.add('open');
    const s = id ? Store.getStore(id) : null;
    document.getElementById('st-title').textContent = s ? 'Sửa chi nhánh' : 'Thêm chi nhánh';
    document.getElementById('st-id').value = s ? s.id : '';
    document.getElementById('st-id-input').value = s ? s.id : '';
    document.getElementById('st-id-input').disabled = !!s;
    document.getElementById('st-name-input').value = s ? s.name : '';
    document.getElementById('st-address-input').value = s ? (s.address || '') : '';
    document.getElementById('st-hours-input').value = s ? (s.hours || '') : '';
    document.getElementById('st-phone-input').value = s ? (s.phone || '') : '';
    const lat = s ? Number(s.lat) : 10.8231;   // TP.HCM mặc định
    const lng = s ? Number(s.lng) : 106.6297;
    document.getElementById('st-lat').value = lat;
    document.getElementById('st-lng').value = lng;
    initStoreMap(lat, lng);
  }
  // ---- Bản đồ Leaflet chọn vị trí chi nhánh ----
  let storeMap = null, storeMarker = null;
  function setStoreCoord(la, ln) {
    document.getElementById('st-lat').value = +la.toFixed(6);
    document.getElementById('st-lng').value = +ln.toFixed(6);
    const c = document.getElementById('store-map-coord');
    if (c) c.textContent = 'Tọa độ: ' + la.toFixed(5) + ', ' + ln.toFixed(5);
  }
  function initStoreMap(lat, lng) {
    const el = document.getElementById('store-map');
    if (!el || typeof L === 'undefined') return;
    if (!storeMap) {
      storeMap = L.map('store-map').setView([lat, lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(storeMap);
      const storeIcon = L.divIcon({
        className: 'store-map-pin',
        html: '<svg viewBox="0 0 24 24" width="30" height="30" fill="var(--accent)" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
      });
      storeMarker = L.marker([lat, lng], { icon: storeIcon, draggable: true }).addTo(storeMap);
      setStoreCoord(lat, lng);
      // click map -> dời marker
      storeMap.on('click', ev => {
        storeMarker.setLatLng(ev.latlng);
        setStoreCoord(ev.latlng.lat, ev.latlng.lng);
      });
      // kéo marker -> cập nhật tọa độ
      storeMarker.on('dragend', ev => {
        const ll = ev.target.getLatLng();
        setStoreCoord(ll.lat, ll.lng);
      });
    } else {
      storeMap.setView([lat, lng], 12);
      storeMarker.setLatLng([lat, lng]);
      setStoreCoord(lat, lng);
    }
    // buộc Leaflet phải tính lại kích thước khi modal vừa mở (đang ẩn -> display flex)
    setTimeout(() => { if (storeMap) storeMap.invalidateSize(); }, 60);
  }
  document.getElementById('btn-new-store').addEventListener('click', () => openStoreForm(null));
  document.getElementById('st-cancel').addEventListener('click', () => document.getElementById('store-form-modal').classList.remove('open'));
  document.getElementById('st-modal-close').addEventListener('click', () => document.getElementById('store-form-modal').classList.remove('open'));
  document.getElementById('store-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('store-form-modal')) document.getElementById('store-form-modal').classList.remove('open');
  });
  document.getElementById('store-form').addEventListener('submit', async e => {
    e.preventDefault();
    const idInput = document.getElementById('st-id-input').value.trim().toLowerCase().replace(/\s+/g, '-');
    const name = document.getElementById('st-name-input').value.trim();
    if (!idInput || !name) { UI.toast('ID và tên chi nhánh là bắt buộc.', 'warn'); return; }
    try {
      await Store.saveStore({
        id: idInput, name,
        address: document.getElementById('st-address-input').value.trim(),
        hours: document.getElementById('st-hours-input').value.trim(),
        phone: document.getElementById('st-phone-input').value.trim(),
        lat: Number(document.getElementById('st-lat').value),
        lng: Number(document.getElementById('st-lng').value)
      });
      document.getElementById('store-form-modal').classList.remove('open');
      renderStores();
      UI.toast('Đã lưu chi nhánh.', 'ok');
    } catch (err) { UI.toast(err.message, 'danger'); }
  });
  document.getElementById('store-search').addEventListener('input', renderStores);

  /* ================= NHẬN XÉT KHÁCH HÀNG (CRUD) ================= */
  function renderCustomerReviews() {
    const list = Store.getCustomerReviews();
    const tbody = list.map(r => (
      '<tr data-id="' + r.id + '">' +
      '<td><span class="stars">' + '★'.repeat(r.stars) + '</span></td>' +
      '<td class="review-comment">' + UI.esc(r.content) + '</td>' +
      '<td><b>' + UI.esc(r.author) + '</b><div style="font-size:.78rem;color:var(--muted)">' + UI.esc(r.city || '') + '</div></td>' +
      '<td><div class="row-actions">' +
      '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div></td>' +
      '</tr>'
    )).join('');
    document.getElementById('adm-creviews-table').innerHTML =
      '<thead><tr><th>Sao</th><th>Nội dung</th><th>Khách</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Chưa có nhận xét</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#adm-creviews-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openCReviewForm(Number(b.closest('tr').dataset.id)));
    });
    document.querySelectorAll('#adm-creviews-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Xoá nhận xét này?')) return;
        try { await Store.deleteCustomerReview(Number(b.closest('tr').dataset.id)); renderCustomerReviews(); UI.toast('Đã xoá nhận xét.', 'ok'); }
        catch (err) { UI.toast(err.message, 'danger'); }
      });
    });
  }
  function openCReviewForm(id) {
    const modal = document.getElementById('creview-form-modal');
    modal.classList.add('open');
    const r = id ? Store.getCustomerReviews().find(x => x.id === id) : null;
    document.getElementById('cr-title').textContent = r ? 'Sửa nhận xét' : 'Thêm nhận xét';
    document.getElementById('cr-id').value = r ? r.id : '';
    document.getElementById('cr-avatar').value = r ? (r.avatarLetter || '') : '';
    document.getElementById('cr-stars').value = r ? r.stars : 5;
    document.getElementById('cr-content').value = r ? (r.content || '') : '';
    document.getElementById('cr-author').value = r ? (r.author || '') : '';
    document.getElementById('cr-city').value = r ? (r.city || '') : '';
  }
  document.getElementById('btn-new-creview').addEventListener('click', () => openCReviewForm(null));
  document.getElementById('cr-cancel').addEventListener('click', () => document.getElementById('creview-form-modal').classList.remove('open'));
  document.getElementById('cr-modal-close').addEventListener('click', () => document.getElementById('creview-form-modal').classList.remove('open'));
  document.getElementById('creview-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('creview-form-modal')) document.getElementById('creview-form-modal').classList.remove('open');
  });
  document.getElementById('creview-form').addEventListener('submit', async e => {
    e.preventDefault();
    const content = document.getElementById('cr-content').value.trim();
    const author = document.getElementById('cr-author').value.trim();
    if (!content || !author) { UI.toast('Nội dung và tên là bắt buộc.', 'warn'); return; }
    const idField = document.getElementById('cr-id').value;
    try {
      await Store.saveCustomerReview({
        id: idField ? Number(idField) : undefined,
        avatarLetter: document.getElementById('cr-avatar').value.trim(),
        stars: Math.max(1, Math.min(5, Number(document.getElementById('cr-stars').value) || 5)),
        content, author,
        city: document.getElementById('cr-city').value.trim()
      });
      document.getElementById('creview-form-modal').classList.remove('open');
      renderCustomerReviews();
      UI.toast(idField ? 'Đã cập nhật nhận xét.' : 'Đã thêm nhận xét.', 'ok');
    } catch (err) { UI.toast(err.message, 'danger'); }
  });

  /* ================= NHÓM SẢN PHẨM (CRUD) ================= */
  function renderGroups() {
    const list = Store.getGroupsData();
    const products = Store.getProducts();
    const tbody = list.map(g => {
      const count = products.filter(p => p.group === g.id).length;
      return (
        '<tr data-id="' + g.id + '">' +
        '<td><b>' + UI.esc(g.name) + '</b></td>' +
        '<td><code style="font-size:.8rem">' + UI.esc(g.id) + '</code></td>' +
        '<td>' + count + ' sản phẩm</td>' +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
        '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
        '</div></td>' +
        '</tr>'
      );
    }).join('');
    document.getElementById('adm-groups-table').innerHTML =
      '<thead><tr><th>Tên</th><th>ID</th><th>Số sản phẩm</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Không có nhóm</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#adm-groups-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openGroupForm(b.closest('tr').dataset.id));
    });
    document.querySelectorAll('#adm-groups-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Xoá nhóm này?')) return;
        try { await Store.deleteGroup(b.closest('tr').dataset.id); renderGroups(); UI.toast('Đã xoá nhóm.', 'ok'); }
        catch (err) { UI.toast(err.message, 'danger'); renderGroups(); }
      });
    });
  }
  function openGroupForm(id) {
    const modal = document.getElementById('group-form-modal');
    modal.classList.add('open');
    const g = id ? Store.getGroupsData().find(x => x.id === id) : null;
    document.getElementById('gr-title').textContent = g ? 'Sửa nhóm' : 'Thêm nhóm';
    document.getElementById('gr-id').value = g ? g.id : '';
    document.getElementById('gr-id-input').value = g ? g.id : '';
    document.getElementById('gr-id-input').disabled = !!g;
    document.getElementById('gr-name').value = g ? g.name : '';
  }
  document.getElementById('btn-new-group').addEventListener('click', () => openGroupForm(null));
  document.getElementById('gr-cancel').addEventListener('click', () => document.getElementById('group-form-modal').classList.remove('open'));
  document.getElementById('gr-modal-close').addEventListener('click', () => document.getElementById('group-form-modal').classList.remove('open'));
  document.getElementById('group-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('group-form-modal')) document.getElementById('group-form-modal').classList.remove('open');
  });
  document.getElementById('group-form').addEventListener('submit', async e => {
    e.preventDefault();
    const idInput = document.getElementById('gr-id-input').value.trim().toLowerCase().replace(/\s+/g, '-');
    const name = document.getElementById('gr-name').value.trim();
    if (!idInput || !name) { UI.toast('ID và tên nhóm là bắt buộc.', 'warn'); return; }
    try {
      await Store.saveGroup({ id: idInput, name });
      document.getElementById('group-form-modal').classList.remove('open');
      renderGroups();
      UI.toast('Đã lưu nhóm.', 'ok');
    } catch (err) { UI.toast(err.message, 'danger'); }
  });

  /* ================= MÃ GIẢM GIÁ (CRUD) ================= */
  function renderPromos() {
    const list = Store.getPromos();
    const tbody = list.map(p => (
      '<tr data-id="' + p.code + '">' +
      '<td><b>' + p.code + '</b></td>' +
      '<td>' + UI.esc(p.label) + '</td>' +
      '<td>' + ({ ship: 'Miễn ship', percent: p.value + '%', amount: UI.fmt(p.value) }[p.type] || p.type) + '</td>' +
      '<td>' + (p.active ? '<span class="badge-status badge-done">Bật</span>' : '<span class="badge-status badge-cancelled">Tắt</span>') + '</td>' +
      '<td><div class="row-actions">' +
      '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div></td>' +
      '</tr>'
    )).join('');
    document.getElementById('adm-promos-table').innerHTML =
      '<thead><tr><th>Mã</th><th>Nhãn</th><th>Ưu đãi</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Chưa có mã giảm giá</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#adm-promos-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openPromoForm(b.closest('tr').dataset.id));
    });
    document.querySelectorAll('#adm-promos-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Xoá mã ' + b.closest('tr').dataset.id + '?')) return;
        try { await Store.deletePromo(b.closest('tr').dataset.id); renderPromos(); UI.toast('Đã xoá mã.', 'ok'); }
        catch (err) { UI.toast(err.message, 'danger'); }
      });
    });
  }
  function openPromoForm(code) {
    const modal = document.getElementById('promo-form-modal');
    modal.classList.add('open');
    const p = code ? Store.getPromos().find(x => x.code === code) : null;
    document.getElementById('pr-title').textContent = p ? 'Sửa mã' : 'Thêm mã';
    document.getElementById('pr-code').value = p ? p.code : '';
    document.getElementById('pr-code-input').value = p ? p.code : '';
    document.getElementById('pr-code-input').disabled = !!p;
    document.getElementById('pr-label').value = p ? (p.label || '') : '';
    document.getElementById('pr-type').value = p ? p.type : 'percent';
    document.getElementById('pr-value').value = p ? p.value : 0;
    document.getElementById('pr-max').value = p && p.max != null ? p.max : '';
    document.getElementById('pr-min').value = p && p.min != null ? p.min : '';
    document.getElementById('pr-active').checked = p ? p.active : true;
  }
  document.getElementById('btn-new-promo').addEventListener('click', () => openPromoForm(null));
  document.getElementById('pr-cancel').addEventListener('click', () => document.getElementById('promo-form-modal').classList.remove('open'));
  document.getElementById('pr-modal-close').addEventListener('click', () => document.getElementById('promo-form-modal').classList.remove('open'));
  document.getElementById('promo-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('promo-form-modal')) document.getElementById('promo-form-modal').classList.remove('open');
  });
  document.getElementById('promo-form').addEventListener('submit', async e => {
    e.preventDefault();
    const code = document.getElementById('pr-code-input').value.trim().toUpperCase();
    const label = document.getElementById('pr-label').value.trim();
    if (!code || !label) { UI.toast('Mã và nhãn là bắt buộc.', 'warn'); return; }
    const type = document.getElementById('pr-type').value;
    const value = Number(document.getElementById('pr-value').value) || 0;
    const maxV = document.getElementById('pr-max').value;
    const minV = document.getElementById('pr-min').value;
    try {
      await Store.savePromo({
        code, label, type, value,
        max: maxV === '' ? null : Number(maxV),
        min: minV === '' ? null : Number(minV),
        active: document.getElementById('pr-active').checked
      });
      document.getElementById('promo-form-modal').classList.remove('open');
      renderPromos();
      UI.toast('Đã lưu mã giảm giá.', 'ok');
    } catch (err) { UI.toast(err.message, 'danger'); }
  });

  /* ================= NEWSLETTER ================= */
  function renderNewsletters() {
    const q = (document.getElementById('nl-search').value || '').toLowerCase();
    let list = Store.getNewsletters();
    if (q) list = list.filter(n => n.email.toLowerCase().includes(q));
    const badge = document.getElementById('nl-count');
    if (badge) badge.textContent = list.length + ' email';
    const tbody = list.map(n => (
      '<tr data-id="' + n.id + '">' +
      '<td>' + UI.esc(n.email) + '</td>' +
      '<td>' + UI.fmtDate(n.created) + '</td>' +
      '<td><div class="row-actions"><button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button></div></td>' +
      '</tr>'
    )).join('');
    document.getElementById('adm-newsletters-table').innerHTML =
      '<thead><tr><th>Email</th><th>Ngày đăng ký</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Chưa có email nào</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#adm-newsletters-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Xoá email này?')) return;
        try { await Store.deleteNewsletter(Number(b.closest('tr').dataset.id)); renderNewsletters(); UI.toast('Đã xoá.', 'ok'); }
        catch (err) { UI.toast(err.message, 'danger'); }
      });
    });
  }
  document.getElementById('nl-search').addEventListener('input', renderNewsletters);

  /* ================= NHẬT KÝ HỆ THỐNG (AUDIT — PHASE 25) ================= */
  /* Bảng chuyển mã hành động máy (action) -> câu mô tả tiếng Việt rõ ràng */
  const AUDIT_LABEL = {
    USER_CHANGE_PASSWORD: 'Đổi mật khẩu',
    ADMIN_UPDATE_PRODUCT: 'Sửa sản phẩm',
    ADMIN_CREATE_PRODUCT: 'Thêm sản phẩm mới',
    ADMIN_DELETE_PRODUCT: 'Xoá sản phẩm',
    ADMIN_SET_PRODUCT_TOPPINGS: 'Cập nhật topping cho sản phẩm',
    STAFF_TOGGLE_AVAILABILITY: 'Đổi trạng thái còn/hết hàng',
    ADMIN_UPDATE_ORDER: 'Cập nhật trạng thái đơn hàng',
    STAFF_UPDATE_ORDER: 'Xử lý đơn hàng',
    ADMIN_UPDATE_PAYMENT: 'Cập nhật thanh toán đơn hàng',
    STAFF_UPDATE_PAYMENT: 'Cập nhật thanh toán đơn hàng',
    ORDER_CANCELLED: 'Huỷ đơn hàng',
    ADMIN_CHANGE_ROLE: 'Đổi vai trò tài khoản',
    ADMIN_UPDATE_USER: 'Cập nhật thông tin người dùng',
    ADMIN_UPDATE_SETTINGS: 'Cập nhật cài đặt website',
    ADMIN_MODERATE_REVIEW: 'Duyệt/ẩn đánh giá sản phẩm',
    ADMIN_MODERATE_SITE_REVIEW: 'Duyệt/ẩn đánh giá website',
    ADMIN_DELETE_REVIEW: 'Xoá đánh giá sản phẩm',
    ADMIN_DELETE_SITE_REVIEW: 'Xoá đánh giá website'
  };
  /* Mô tả chi tiết tiếng Việt tuỳ theo action + details JSON */
  function auditDetail(a) {
    let d = {};
    try { d = JSON.parse(a.details || '{}'); } catch (e) {}
    switch (a.action) {
      case 'STAFF_TOGGLE_AVAILABILITY':
        return d.is_available ? 'Bật bán: sản phẩm còn hàng, khách đặt được.' : 'Tắt bán: sản phẩm hết hàng, khách không đặt được.';
      case 'ADMIN_UPDATE_ORDER':
      case 'STAFF_UPDATE_ORDER':
        return 'Chuyển trạng thái từ "' + (d.from || '?') + '" sang "' + (d.to || '?') + '".';
      case 'ADMIN_UPDATE_PAYMENT':
      case 'STAFF_UPDATE_PAYMENT':
        return 'Đổi trạng thái thanh toán: ' + ({ pending: 'Chờ thanh toán', paid: 'Đã thanh toán', failed: 'Thanh toán lỗi', refunded: 'Đã hoàn tiền' }[d.payment_status] || d.payment_status || '?') + '.';
      case 'ADMIN_CREATE_PRODUCT':
        return 'Đã thêm sản phẩm "' + (d.name || a.targetId) + '".';
      case 'ADMIN_UPDATE_PRODUCT':
        return 'Đã cập nhật sản phẩm "' + (d.name || a.targetId) + '".';
      case 'ADMIN_DELETE_PRODUCT':
        return 'Đã xoá sản phẩm (mã ' + a.targetId + ').';
      case 'ADMIN_SET_PRODUCT_TOPPINGS':
        return 'Cập nhật ' + (d.count || 0) + ' topping cho sản phẩm (mã ' + a.targetId + ').';
      case 'ADMIN_UPDATE_SETTINGS':
        return 'Đã thay đổi: ' + (d.keys || []).map(k => ({ siteName: 'Tên web', slogan: 'Slogan', themeColor: 'Màu chủ đạo', logo: 'Logo', salePercent: '% Flash sale' }[k] || k)).join(', ');
      case 'ORDER_CANCELLED':
        return 'Huỷ đơn' + (d.reason ? ' (' + d.reason + ')' : '');
      case 'ADMIN_CHANGE_ROLE':
        return 'Đổi vai trò tài khoản (mã ' + a.targetId + ').';
      case 'ADMIN_UPDATE_USER':
        return 'Cập nhật tài khoản người dùng (mã ' + a.targetId + ').';
      case 'ADMIN_MODERATE_REVIEW':
      case 'ADMIN_MODERATE_SITE_REVIEW':
        return ({ approved: 'Đã duyệt đánh giá', hidden: 'Đã ẩn đánh giá' }[d.status] || 'Đổi trạng thái duyệt') + '.';
      case 'ADMIN_DELETE_REVIEW':
        return 'Đã xoá đánh giá sản phẩm (mã ' + a.targetId + ').';
      case 'ADMIN_DELETE_SITE_REVIEW':
        return 'Đã xoá đánh giá website (mã ' + a.targetId + ').';
      default:
        return d && Object.keys(d).length ? JSON.stringify(d) : a.details || '';
    }
  }
  function renderAudit() {
    const q = (document.getElementById('audit-search').value || '').toLowerCase();
    let list = Store.getAuditLogs();
    if (q) list = list.filter(a =>
      (a.action || '').toLowerCase().includes(q) ||
      (a.username || '').toLowerCase().includes(q) ||
      (a.targetId || '').toLowerCase().includes(q)
    );
    const badge = document.getElementById('audit-count');
    if (badge) badge.textContent = list.length + ' bản ghi';
    const tbody = list.map(a =>
      '<tr>' +
      '<td><b>' + UI.esc(AUDIT_LABEL[a.action] || a.action) + '</b></td>' +
      '<td>' + UI.esc(a.username || a.userId || '—') + '</td>' +
      '<td>' + UI.esc(a.targetType || '—') + (a.targetId ? ' · ' + UI.esc(a.targetId) : '') + '</td>' +
      '<td class="review-comment">' + UI.esc(auditDetail(a)) + '</td>' +
      '<td>' + UI.esc(a.ip || '') + '</td>' +
      '<td>' + UI.fmtDate(a.created) + '</td>' +
      '</tr>'
    ).join('');
    document.getElementById('adm-audit-table').innerHTML =
      '<thead><tr><th>Hành động</th><th>Người thực hiện</th><th>Mục tiêu</th><th>Chi tiết</th><th>IP</th><th>Thời gian</th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Chưa có bản ghi nào</td></tr>') +
      '</tbody>';
  }
  const auditSearch = document.getElementById('audit-search');
  if (auditSearch) auditSearch.addEventListener('input', renderAudit);

  /* ================= TOPPING (CRUD) ================= */
  function renderToppings() {
    const q = (document.getElementById('tp-search').value || '').toLowerCase();
    let list = Store.getToppings();
    if (q) list = list.filter(t => t.name.toLowerCase().includes(q));

    const tbody = list.map(t =>
      '<tr data-id="' + t.id + '">' +
      '<td><b>' + UI.esc(t.name) + '</b></td>' +
      '<td>' + UI.fmt(t.price) + '</td>' +
      '<td><div class="row-actions">' +
      '<button class="icon-btn" data-act="edit" title="Sửa">' + UI.icon('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div></td>' +
      '</tr>'
    ).join('');

    document.getElementById('adm-toppings-table').innerHTML =
      '<thead><tr><th>Tên topping</th><th>Giá</th><th></th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Không có topping</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#adm-toppings-table [data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => openToppingForm(b.closest('tr').dataset.id));
    });
    document.querySelectorAll('#adm-toppings-table [data-act="del"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.closest('tr').dataset.id;
        const t = Store.getToppings().find(x => x.id === id);
        if (!t) return;
        if (!confirm('Xoá topping "' + t.name + '"?')) return;
        try {
          await Store.deleteTopping(id);
          renderToppings();
          UI.toast('Đã xoá topping.', 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    });
  }

  function openToppingForm(id) {
    const modal = document.getElementById('topping-form-modal');
    modal.classList.add('open');
    document.getElementById('tp-title').textContent = id ? 'Sửa topping' : 'Thêm topping';
    const t = id ? Store.getToppings().find(x => x.id === id) : null;
    document.getElementById('tp-id').value = t ? t.id : '';
    document.getElementById('tp-name').value = t ? t.name : '';
    document.getElementById('tp-price').value = t ? t.price : '';
  }

  document.getElementById('btn-new-topping').addEventListener('click', () => openToppingForm(null));
  document.getElementById('tp-cancel').addEventListener('click', () => document.getElementById('topping-form-modal').classList.remove('open'));
  document.getElementById('tp-modal-close').addEventListener('click', () => document.getElementById('topping-form-modal').classList.remove('open'));
  document.getElementById('topping-form-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('topping-form-modal')) document.getElementById('topping-form-modal').classList.remove('open');
  });
  document.getElementById('topping-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('tp-name').value.trim();
    const price = Number(document.getElementById('tp-price').value);
    if (!name || price < 0) { UI.toast('Tên và giá hợp lệ là bắt buộc.', 'warn'); return; }
    const idField = document.getElementById('tp-id').value;
    try {
      await Store.saveTopping({ id: idField || Store.nextToppingId(), name, price });
      document.getElementById('topping-form-modal').classList.remove('open');
      renderToppings();
      UI.toast(idField ? 'Đã cập nhật topping.' : 'Đã thêm topping mới.', 'ok');
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });
  document.getElementById('tp-search').addEventListener('input', renderToppings);

  /* ================= CÀI ĐẶT =================
     renderSettings: đổ giá trị hiện tại từ Store.getSettings() vào form.
     Submit: gộp toàn bộ field -> Store.setSettings() (POST /api/settings)
     -> lưu VĨNH VIỄN vào bảng settings trong SQLite; áp màu/logo ngay. */
  function renderSettings() {
    const s = Store.getSettings();
    document.getElementById('st-name').value = s.siteName;
    document.getElementById('st-slogan').value = s.slogan;
    document.getElementById('st-desc').value = s.desc || '';
    document.getElementById('st-hotline').value = s.hotline;
    document.getElementById('st-email').value = s.email || '';
    document.getElementById('st-address').value = s.address || '';
    document.getElementById('st-hours-open').value = s.openHours || '';
    document.getElementById('st-theme').value = s.themeColor || '#C97B4A';
    document.getElementById('st-logo').value = s.logo || 'assets/images/logo.svg';
    document.getElementById('st-sale').value = s.salePercent;
    document.getElementById('st-hours').value = Math.max(1, Math.round((s.saleEndsAt - Date.now()) / 3600000));
    /* câu chuyện thương hiệu */
    document.getElementById('st-story-1').value = s.storyText1 || '';
    document.getElementById('st-story-2').value = s.storyText2 || '';
    document.getElementById('st-stat1-num').value = (s.storyStats && s.storyStats[0] && s.storyStats[0].num) || '18+';
    document.getElementById('st-stat1-label').value = (s.storyStats && s.storyStats[0] && s.storyStats[0].label) || 'Món signature';
    document.getElementById('st-stat2-num').value = (s.storyStats && s.storyStats[1] && s.storyStats[1].num) || '4.8★';
    document.getElementById('st-stat2-label').value = (s.storyStats && s.storyStats[1] && s.storyStats[1].label) || 'Đánh giá trung bình';
    document.getElementById('st-stat3-num').value = (s.storyStats && s.storyStats[2] && s.storyStats[2].num) || '4 CN';
    document.getElementById('st-stat3-label').value = (s.storyStats && s.storyStats[2] && s.storyStats[2].label) || 'TP.HCM & Đà Lạt';
    document.getElementById('st-story-img-1').value = (s.storyImgs && s.storyImgs[0]) || 'assets/images/story-1.svg';
    document.getElementById('st-story-img-2').value = (s.storyImgs && s.storyImgs[1]) || 'assets/images/story-2.svg';
    document.getElementById('st-story-img-3').value = (s.storyImgs && s.storyImgs[2]) || 'assets/images/story-3.svg';
    /* nhạc quán trà */
    document.getElementById('st-music-name').value = s.musicName || '';
    document.getElementById('st-music-url').value = s.musicUrl || '';
    /* Trang Giới thiệu — giá trị + hành trình */
    renderAboutEditors(s);
    // preview logo
    const prev = document.getElementById('st-logo-preview');
    prev.innerHTML = s.logo ? '<img src="' + s.logo + '" alt="logo" style="height:38px;border:1px solid var(--line);border-radius:8px;padding:4px;background:var(--bg)">' : '';
  }
  // upload logo file -> base64
  /* ---------- Trang Giới thiệu: editors (giá trị + hành trình) ---------- */
  function renderAboutEditors(s) {
    const valuesBox = document.getElementById('about-values-editor');
    const journeyBox = document.getElementById('about-journey-editor');
    if (!valuesBox || !journeyBox) return;
    const values = (s.aboutValues && s.aboutValues.length ? s.aboutValues : [
      { icon: 'leaf',  title: 'Nguyên liệu thật', desc: 'Trà nguyên chất từ vùng cao Đà Lạt, chọn lọc từng búp trà theo mùa.' },
      { icon: 'flask', title: 'Pha chế thủ công', desc: 'Mỗi ly được pha chế tỉ mỉ bởi đội ngũ barista đam mê trà.' },
      { icon: 'heart', title: 'Chăm sóc khách', desc: 'Không gian ấm cúng, phục vụ tận tâm — khách là người nhà.' },
      { icon: 'tag',   title: 'Giá minh bạch', desc: 'Giá công bằng cho chất lượng thật, ưu đãi rõ ràng cho khách quen.' }
    ]);
    const journey = (s.aboutJourney && s.aboutJourney.length ? s.aboutJourney : [
      { year: '2019', desc: 'Khởi nguồn từ một xe trà nhỏ trên đường 3/2, Đà Lạt với đúng 3 món trà sữa.' },
      { year: '2021', desc: 'Mở chi nhánh đầu tiên tại TP.HCM, đưa hương trà cao nguyên về thành phố.' },
      { year: '2023', desc: 'Ra mắt bộ sưu tập trà signature: Ôlong Gạo Rang, Hojicha Caramel Mặn, Matcha Hạt Sen…' },
      { year: '2026', desc: 'ShanCha Store — mua trà online mọi lúc mọi nơi, giao tận nơi hoặc nhận tại quán.' }
    ]);
    valuesBox.innerHTML = values.map((v, i) =>
      '<div class="about-editor-row" data-row="' + i + '" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<input type="text" class="av-icon" placeholder="icon (leaf/flask/heart/tag)" value="' + UI.esc(v.icon || '') + '" style="flex:0 0 130px">' +
      '<input type="text" class="av-title" placeholder="Tiêu đề" value="' + UI.esc(v.title || '') + '" style="flex:1;min-width:120px">' +
      '<input type="text" class="av-desc" placeholder="Mô tả" value="' + UI.esc(v.desc || '') + '" style="flex:2;min-width:160px">' +
      '<button type="button" class="icon-btn danger av-del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div>'
    ).join('');
    journeyBox.innerHTML = journey.map((j, i) =>
      '<div class="aj-row" data-row="' + i + '" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<input type="text" class="aj-year" placeholder="Năm (2019)" value="' + UI.esc(j.year || '') + '" style="flex:0 0 90px">' +
      '<input type="text" class="aj-desc" placeholder="Mô tả mốc thời gian" value="' + UI.esc(j.desc || '') + '" style="flex:3;min-width:180px">' +
      '<button type="button" class="icon-btn danger aj-del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div>'
    ).join('');
    valuesBox.querySelectorAll('.av-del').forEach(b => {
      b.addEventListener('click', () => {
        b.closest('.about-editor-row').remove();
      });
    });
    journeyBox.querySelectorAll('.aj-del').forEach(b => {
      b.addEventListener('click', () => {
        b.closest('.aj-row').remove();
      });
    });
  }
  document.getElementById('btn-add-value').addEventListener('click', () => {
    const box = document.getElementById('about-values-editor');
    if (!box) return;
    box.insertAdjacentHTML('beforeend',
      '<div class="about-editor-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<input type="text" class="av-icon" placeholder="icon" style="flex:0 0 130px">' +
      '<input type="text" class="av-title" placeholder="Tiêu đề" style="flex:1;min-width:120px">' +
      '<input type="text" class="av-desc" placeholder="Mô tả" style="flex:2;min-width:160px">' +
      '<button type="button" class="icon-btn danger av-del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div>'
    );
    box.lastElementChild.querySelector('.av-del').addEventListener('click', function () { this.closest('.about-editor-row').remove(); });
  });
  document.getElementById('btn-add-journey').addEventListener('click', () => {
    const box = document.getElementById('about-journey-editor');
    if (!box) return;
    box.insertAdjacentHTML('beforeend',
      '<div class="aj-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<input type="text" class="aj-year" placeholder="Năm (2019)" style="flex:0 0 90px">' +
      '<input type="text" class="aj-desc" placeholder="Mô tả mốc thời gian" style="flex:3;min-width:180px">' +
      '<button type="button" class="icon-btn danger aj-del" title="Xoá">' + UI.icon('trash') + '</button>' +
      '</div>'
    );
    box.lastElementChild.querySelector('.aj-del').addEventListener('click', function () { this.closest('.aj-row').remove(); });
  });
  // upload logo file -> base64
  document.getElementById('st-logo-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('st-logo').value = ev.target.result;
      document.getElementById('st-logo-preview').innerHTML = '<img src="' + ev.target.result + '" alt="logo" style="height:38px;border:1px solid var(--line);border-radius:8px;padding:4px;background:var(--bg)">';
    };
    reader.readAsDataURL(f);
  });
  // upload file nhạc -> base64 vào ô link nhạc
  document.getElementById('st-music-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('st-music-url').value = ev.target.result;
      UI.toast('Đã nạp file nhạc. Bấm Lưu cài đặt để áp dụng.', 'ok');
    };
    reader.readAsDataURL(f);
  });
  // áp dụng màu chủ đạo + logo lên giao diện
  function applySettings() {
    const s = Store.getSettings();
    if (s.themeColor) document.documentElement.style.setProperty('--accent', s.themeColor);
    const brand = document.querySelector('.admin-brand');
    if (brand) {
      if (s.logo && s.logo !== 'assets/images/logo.svg') {
        brand.innerHTML = '<img src="' + UI.esc(s.logo) + '" alt="' + UI.esc(s.siteName) + '">';
      } else {
        brand.innerHTML = '<span class="brand-text">' + UI.esc(s.siteName || 'ShanCha Store') + '</span>';
      }
    }
  }
  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const hours = Math.max(1, Number(document.getElementById('st-hours').value) || 48);
    const s = Store.getSettings();
    s.siteName = document.getElementById('st-name').value.trim() || 'ShanCha Store';
    s.slogan = document.getElementById('st-slogan').value.trim() || 'Đậm trà, thơm hương';
    s.desc = document.getElementById('st-desc').value.trim() || '';
    s.hotline = document.getElementById('st-hotline').value.trim() || '039 799 9949';
    s.email = document.getElementById('st-email').value.trim() || 'hello@shancha.vn';
    s.address = document.getElementById('st-address').value.trim() || 'TP.HCM · Đà Lạt';
    s.openHours = document.getElementById('st-hours-open').value.trim() || '09:00 – 22:00';
    s.themeColor = document.getElementById('st-theme').value || '#C97B4A';
    s.logo = document.getElementById('st-logo').value.trim() || 'assets/images/logo.svg';
    s.salePercent = Math.min(90, Math.max(0, Number(document.getElementById('st-sale').value) || 20));
    s.saleEndsAt = Date.now() + hours * 3600000;
    /* câu chuyện thương hiệu */
    s.storyText1 = document.getElementById('st-story-1').value.trim();
    s.storyText2 = document.getElementById('st-story-2').value.trim();
    s.storyStats = [
      { num: document.getElementById('st-stat1-num').value.trim(), label: document.getElementById('st-stat1-label').value.trim() },
      { num: document.getElementById('st-stat2-num').value.trim(), label: document.getElementById('st-stat2-label').value.trim() },
      { num: document.getElementById('st-stat3-num').value.trim(), label: document.getElementById('st-stat3-label').value.trim() }
    ];
    s.storyImgs = [
      document.getElementById('st-story-img-1').value.trim(),
      document.getElementById('st-story-img-2').value.trim(),
      document.getElementById('st-story-img-3').value.trim()
    ];
    /* nhạc quán trà */
    s.musicName = document.getElementById('st-music-name').value.trim();
    const musicUrlField = document.getElementById('st-music-url');
    s.musicUrl = (musicUrlField ? musicUrlField.value : '').trim();
    /* Trang Giới thiệu — giá trị + hành trình */
    const valuesBox = document.getElementById('about-values-editor');
    if (valuesBox) {
      s.aboutValues = [...valuesBox.querySelectorAll('.about-editor-row')].map(r => ({
        icon: r.querySelector('.av-icon').value.trim(),
        title: r.querySelector('.av-title').value.trim(),
        desc: r.querySelector('.av-desc').value.trim()
      })).filter(v => v.title || v.desc);
    }
    const journeyBox = document.getElementById('about-journey-editor');
    if (journeyBox) {
      s.aboutJourney = [...journeyBox.querySelectorAll('.aj-row')].map(r => ({
        year: r.querySelector('.aj-year').value.trim(),
        desc: r.querySelector('.aj-desc').value.trim()
      })).filter(j => j.year || j.desc);
    }
    try {
      await Store.setSettings(s);
      applySettings();
      UI.toast('Đã lưu cài đặt website.', 'ok');
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });

  /* ---------- Modal thêm nhân viên / tài khoản ---------- */
  const userModal = document.getElementById('user-modal');
  function openUserModal() {
    if (!userModal) return;
    userModal.style.display = 'flex';
    document.getElementById('user-form').reset();
    document.getElementById('nu-username').focus();
  }
  function closeUserModal() {
    if (userModal) userModal.style.display = 'none';
  }
  const btnNewUser = document.getElementById('btn-new-user');
  if (btnNewUser) btnNewUser.addEventListener('click', openUserModal);
  const userModalClose = document.getElementById('user-modal-close');
  if (userModalClose) userModalClose.addEventListener('click', closeUserModal);
  if (userModal) userModal.addEventListener('click', e => { if (e.target === userModal) closeUserModal(); });
  document.getElementById('user-form').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('nu-name').value.trim(),
      username: document.getElementById('nu-username').value.trim().toLowerCase(),
      email: document.getElementById('nu-email').value.trim(),
      phone: document.getElementById('nu-phone').value.trim(),
      password: document.getElementById('nu-password').value,
      role: document.getElementById('nu-role').value
    };
    try {
      await Store.createUser(payload);
      UI.toast('Đã tạo tài khoản ' + (payload.role === 'staff' ? 'nhân viên' : 'khách hàng') + ' ' + payload.name + '.', 'ok');
      closeUserModal();
      renderUsers();
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });

  /* ---------- khởi động ---------- */
  async function init() {
    await Store.ready;
    if (!gate()) return;
    applySettings();
    document.title = Store.getSettings().siteName + ' – Quản trị';
    view('dashboard');
  }

  return { view, init };
})();

document.addEventListener('DOMContentLoaded', Admin.init);
