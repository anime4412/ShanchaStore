/* ============================================================
   ShanChaStore - staff.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Nhân viên (staff.html).

   - gate()          : chỉ STAFF hoặc ADMIN vào; khách hàng bị chặn.
   - view(name)      : chuyển màn hình (Dashboard, Đơn hàng, Sản phẩm,
                       Topping, Hồ sơ).
   - renderDashboard : thẻ KPI đơn theo trạng thái (PHASE 6 của prompt staff).
   - renderOrders    : tìm/lọc/xem chi tiết/đổi trạng thái theo state machine
                       (chỉ transition hợp lệ, backend kiểm tra lại).
   - renderProducts  : bật/tắt Hết hàng (KHÔNG sửa giá / xoá).
   - renderToppings  : xem topping (chỉ đọc).
   - renderProfile   : sửa họ tên/email/SĐT + đổi mật khẩu.
   ============================================================ */

'use strict';

const Staff = (function () {

  let currentView = 'dashboard';

  /* ---------- Bảo vệ: chỉ staff/admin ---------- */
  function gate() {
    if (!Store.isLoggedIn()) { location.href = 'login.html'; return false; }
    const me = Store.currentUser();
    if (me.role !== 'staff' && me.role !== 'admin') {
      document.getElementById('view-dashboard').innerHTML =
        '<div class="form-card" style="text-align:center">' +
        '<h2 style="margin:12px 0">Bạn không có quyền truy cập khu vực nhân viên</h2>' +
        '<p class="section-desc">Chức năng này chỉ dành cho nhân viên của ShanCha.</p>' +
        '<a class="btn btn-primary" style="margin-top:14px" href="index.html">Về trang chủ</a></div>';
      return false;
    }
    document.getElementById('staff-user-name').textContent = me.name + (me.role === 'admin' ? ' (ADMIN)' : '');
    return true;
  }

  /* ---------- Chuyển view ---------- */
  function view(name) {
    currentView = name;
    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    ['dashboard', 'orders', 'products', 'toppings', 'profile'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = v === name ? 'block' : 'none';
    });
    const titles = { dashboard: 'Dashboard', orders: 'Quản lý đơn hàng', products: 'Sản phẩm', toppings: 'Topping', profile: 'Hồ sơ nhân viên' };
    document.getElementById('view-title').textContent = titles[name];
    if (name === 'dashboard') renderDashboard();
    if (name === 'orders') renderOrders();
    if (name === 'products') renderProducts();
    if (name === 'toppings') renderToppings();
    if (name === 'profile') renderProfile();
  }

  /* ---------- Trạng thái đơn ---------- */
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

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    const orders = Store.getOrders();
    const count = st => orders.filter(o => o.status === st).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const doneToday = orders.filter(o => o.status === 'completed' && o.created >= today.getTime()).length;
    const todayCount = orders.filter(o => o.created >= today.getTime()).length;
    const kpi = [
      { label: 'Đơn mới (PENDING)', value: count('pending'), sub: 'cần xác nhận' },
      { label: 'Đang xử lý', value: count('confirmed'), sub: 'đã xác nhận' },
      { label: 'Đang pha chế', value: count('preparing'), sub: 'đang làm' },
      { label: 'Sẵn sàng', value: count('ready'), sub: 'chờ giao/nhận' },
      { label: 'Đang giao', value: count('delivering'), sub: 'trên đường' },
      { label: 'Hoàn thành hôm nay', value: doneToday, sub: todayCount + ' đơn hôm nay' }
    ];
    document.getElementById('staff-kpi-grid').innerHTML = kpi.map(k =>
      '<div class="kpi-card"><div class="kpi-label">' + k.label + '</div><div class="kpi-value">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>'
    ).join('');

    const recent = orders.slice(0, 8);
    document.getElementById('staff-recent-orders').innerHTML =
      '<thead><tr><th>Mã</th><th>Khách</th><th>Tổng</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>' +
      (recent.length ? recent.map(o =>
        '<tr><td><b>' + o.code + '</b></td><td>' + UI.esc(o.name || o.customer) + '</td><td>' + UI.fmt(o.total) + '</td>' +
        '<td>' + statusBadge(o.status) + '</td><td>' + UI.fmtDate(o.created) + '</td></tr>'
      ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Chưa có đơn hàng</td></tr>') +
      '</tbody>';
  }

  /* ---------- Đơn hàng ---------- */
  let orderQ = '';
  function renderOrders() {
    const status = document.getElementById('st-status').value;
    let list = Store.getOrders();
    if (status !== 'all') list = list.filter(o => o.status === status);
    if (orderQ) {
      const q = orderQ.toLowerCase();
      list = list.filter(o =>
        (o.code || '').toLowerCase().includes(q) ||
        (o.name || '').toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q)
      );
    }
    const page = Number(document.getElementById('staff-orders-page').value) || 1;
    const per = 20;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const cur = Math.min(page, pages);
    const pageList = list.slice((cur - 1) * per, cur * per);

    const tbody = pageList.map(o => {
      const itemCount = o.items.reduce((n, it) => n + it.qty, 0);
      const allowed = STATUS[o.status] ? STATUS[o.status].next : [];
      const opts = (STATUS[o.status] ? ['<option value="' + o.status + '" selected>' + STATUS[o.status].label + '</option>'] : [])
        .concat(allowed.map(s => '<option value="' + s + '">' + STATUS[s].label + '</option>')).join('');
      return (
        '<tr>' +
        '<td><b>' + o.code + '</b></td>' +
        '<td>' + UI.esc(o.name || o.customer) + '<div style="font-size:.78rem;color:var(--muted)">' + UI.esc(o.phone) + '</div></td>' +
        '<td>' + itemCount + ' món</td>' +
        '<td>' + UI.fmt(o.total) + '</td>' +
        '<td>' + statusBadge(o.status) + '<div style="margin-top:4px">' + payBadge(o.payment_status) + '</div></td>' +
        '<td>' + UI.fmtDate(o.created) + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-act="detail" title="Chi tiết">' + UI.icon('eye') + '</button>' +
        (allowed.length ? '<select class="filter-select" data-act="status" style="padding:6px 8px">' + opts + '</select>' : '<span style="color:var(--muted);font-size:.78rem">—</span>') +
        '<select class="filter-select" data-act="pay" style="padding:6px 8px">' +
        Object.keys(PAYMENT_STATUS).map(p => '<option value="' + p + '"' + ((o.payment_status || 'pending') === p ? ' selected' : '') + '>' + PAYMENT_STATUS[p].label + '</option>').join('') +
        '</select>' +
        '</div></td>' +
        '</tr>'
      );
    }).join('');

    const pagerEl = document.getElementById('staff-orders-pager');
    if (pagerEl) pagerEl.innerHTML = pages > 1
      ? '<div class="admin-pager"><span>Trang ' + cur + '/' + pages + ' (' + total + ' đơn)</span>' +
        '<button class="btn btn-ghost btn-sm" data-page="' + (cur - 1) + '"' + (cur <= 1 ? ' disabled' : '') + '>‹ Trước</button>' +
        '<button class="btn btn-ghost btn-sm" data-page="' + (cur + 1) + '"' + (cur >= pages ? ' disabled' : '') + '>Sau ›</button></div>'
      : '';

    document.getElementById('staff-orders-table').innerHTML =
      '<thead><tr><th>Mã</th><th>Khách</th><th>Số món</th><th>Tổng</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Không có đơn hàng</td></tr>') +
      '</tbody>';

    document.querySelectorAll('#staff-orders-table [data-act="detail"]').forEach(b => {
      b.addEventListener('click', () => showOrderDetail(b.closest('tr').querySelector('td b').textContent));
    });
    document.querySelectorAll('#staff-orders-table [data-act="status"]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const code = sel.closest('tr').querySelector('td b').textContent;
        if (!confirm('Chuyển đơn ' + code + ' sang "' + sel.selectedOptions[0].textContent + '"?')) { renderOrders(); return; }
        try {
          await Store.setOrderStatus(code, sel.value);
          UI.toast('Đã cập nhật trạng thái đơn ' + code, 'ok');
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
        renderOrders();
      });
    });
    document.querySelectorAll('#staff-orders-table [data-act="pay"]').forEach(sel => {
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
    if (pagerEl) pagerEl.querySelectorAll('[data-page]').forEach(b => {
      b.addEventListener('click', () => { document.getElementById('staff-orders-page').value = b.dataset.page; renderOrders(); });
    });
  }

  function showOrderDetail(code) {
    const o = Store.getOrders().find(x => x.code === code);
    if (!o) return;
    const modal = document.getElementById('staff-order-modal');
    document.getElementById('staff-order-modal-body').innerHTML =
      '<h2 style="margin-bottom:10px">Đơn ' + o.code + '</h2>' +
      '<div style="margin-bottom:16px">' + statusBadge(o.status) + ' ' + payBadge(o.payment_status) + ' <span style="color:var(--muted);font-size:.85rem">' + UI.fmtDate(o.created) + '</span></div>' +
      o.items.map(it => {
        const tops = (it.toppings || []).length ? ' <span style="color:var(--accent);font-size:.8rem">(+' + it.toppings.map(t => t.name).join(', ') + ')</span>' : '';
        return '<div class="detail-line"><span>' + UI.esc(it.name) + ' × ' + it.qty + tops + '</span><b>' + UI.fmt(Cart.lineTotal(it)) + '</b></div>';
      }).join('') +
      '<div class="detail-line"><span>Tạm tính</span><b>' + UI.fmt(o.subtotal) + '</b></div>' +
      (o.discount > 0 ? '<div class="detail-line"><span>Giảm giá</span><b style="color:var(--ok)">-' + UI.fmt(o.discount) + '</b></div>' : '') +
      '<div class="detail-line"><span>Phí giao hàng' + (o.shipKm ? ' (~' + o.shipKm + ' km)' : '') + '</span><b>' + (o.shipFee ? UI.fmt(o.shipFee) : 'Miễn phí') + '</b></div>' +
      '<div class="detail-line"><span style="font-weight:900">Tổng cộng</span><b style="color:var(--primary)">' + UI.fmt(o.total) + '</b></div>' +
      '<hr style="border:none;border-top:1px dashed var(--line);margin:12px 0">' +
      '<div class="detail-line"><span>Khách hàng</span><b>' + UI.esc(o.name || o.customer) + '</b></div>' +
      '<div class="detail-line"><span>SĐT</span><b>' + UI.esc(o.phone) + '</b></div>' +
      '<div class="detail-line"><span>Địa chỉ</span><b style="text-align:right">' + UI.esc(o.address) + '</b></div>' +
      (o.note ? '<div class="detail-line"><span>Ghi chú</span><b>' + UI.esc(o.note) + '</b></div>' : '') +
      '<div class="detail-line"><span>Thanh toán</span><b>' + ({ cod: 'COD', bank: 'Chuyển khoản', card: 'Thẻ' }[o.payMethod] || o.payMethod) + '</b></div>' +
      '<div class="detail-line"><span>Nhận tại</span><b>' + UI.esc(o.store || '') + '</b></div>';
    modal.classList.add('open');
  }

  /* ---------- Sản phẩm: chỉ bật/tắt hết hàng ---------- */
  let staffProdPage = 1;
  function renderProducts() {
    const q = (document.getElementById('stp-search').value || '').toLowerCase();
    let list = Store.getProducts();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
    // phân trang (10/trang)
    const PER = 10;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PER));
    staffProdPage = Math.min(staffProdPage, pages);
    const pageList = list.slice((staffProdPage - 1) * PER, staffProdPage * PER);
    const tbody = pageList.map(p => {
      const soldOut = p.is_available === false;
      const catName = (Store.getCategories().find(c => c.id === p.category) || {}).name || 'Khác';
      return (
        '<tr data-id="' + p.id + '">' +
        '<td><img class="thumb" src="' + UI.assetUrl(p.img) + '" alt=""></td>' +
        '<td><b>' + UI.esc(p.name) + '</b><div style="font-size:.78rem;color:var(--muted)">' + catName + '</div></td>' +
        '<td>' + UI.fmt(p.price) + '</td>' +
        '<td><span class="badge-status ' + (soldOut ? 'badge-cancelled' : 'badge-done') + '">' + (soldOut ? 'Hết hàng' : 'Còn hàng') + '</span></td>' +
        '<td><div class="row-actions"><button class="icon-btn" data-act="avail" title="' + (soldOut ? 'Bật bán (còn hàng)' : 'Tắt bán (hết hàng)') + '">' + UI.icon(soldOut ? 'unlock' : 'lock') + '</button></div></td>' +
        '</tr>'
      );
    }).join('');
    document.getElementById('staff-products-table').innerHTML =
      '<thead><tr><th>Ảnh</th><th>Tên</th><th>Giá</th><th>Trạng thái</th><th>Bật/Tắt</th></tr></thead><tbody>' +
      (tbody || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Không có sản phẩm</td></tr>') +
      '</tbody>';
    document.querySelectorAll('#staff-products-table [data-act="avail"]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = Number(b.closest('tr').dataset.id);
        const p = Store.getProduct(id);
        try {
          const saved = await Store.toggleAvailability(id, !(p.is_available !== false));
          renderProducts();
          UI.toast(saved.is_available ? 'Đã bật "' + saved.name + '" trở lại (còn hàng).' : 'Đã tắt "' + saved.name + '" (hết hàng).', 'ok');
        } catch (err) { UI.toast(err.message, 'danger'); }
      });
    });

    // phân trang sản phẩm staff
    const pagerEl = document.getElementById('staff-products-pager');
    if (pagerEl) {
      UI.pager(pagerEl, staffProdPage, pages, total, np => { staffProdPage = np; renderProducts(); });
    }
  }

  /* ---------- Topping: chỉ đọc ---------- */
  function renderToppings() {
    const list = Store.getToppings();
    document.getElementById('staff-toppings-table').innerHTML =
      '<thead><tr><th>Tên topping</th><th>Giá</th><th>Ghi chú</th></tr></thead><tbody>' +
      list.map(t =>
        '<tr><td><b>' + UI.esc(t.name) + '</b></td><td>' + UI.fmt(t.price) + '</td><td style="color:var(--muted);font-size:.8rem">Chỉ admin mới sửa giá</td></tr>'
      ).join('') +
      '</tbody>';
  }

  /* ---------- Hồ sơ + đổi mật khẩu ---------- */
  function renderProfile() {
    const u = Store.currentUser();
    document.getElementById('staff-profile-info').innerHTML =
      '<div class="pf-avatar">' + UI.esc((u.name || '?').trim().charAt(0).toUpperCase()) + '</div>' +
      '<div class="pf-rows">' +
      '<div class="pf-row"><span>Username</span><b>@' + UI.esc(u.username) + '</b></div>' +
      '<div class="pf-row"><span>Vai trò</span><b>Nhân viên (STAFF)</b></div>' +
      '<div class="pf-row"><span>Ngày tạo</span><b>' + UI.fmtDate(u.created) + '</b></div>' +
      '<div class="pf-row"><span>Trạng thái</span><b>' + (u.blocked ? 'Bị khoá' : 'Đang hoạt động') + '</b></div>' +
      '</div>';
    document.getElementById('sp-name').value = u.name || '';
    document.getElementById('sp-email').value = u.email || '';
    document.getElementById('sp-phone').value = u.phone || '';
  }

  /* ---------- khởi động ---------- */
  async function init() {
    await Store.ready;
    if (!gate()) return;
    document.title = 'Khu vực nhân viên – ' + Store.getSettings().siteName;
    view('dashboard');

    document.querySelectorAll('.admin-nav button').forEach(b => b.addEventListener('click', () => view(b.dataset.view)));
    document.getElementById('staff-logout').addEventListener('click', () => { Auth.logout(); location.href = 'index.html'; });
    document.getElementById('st-status').addEventListener('change', renderOrders);
    const so = document.getElementById('st-order-search');
    if (so) so.addEventListener('input', () => { orderQ = so.value.trim(); renderOrders(); });
    const stp = document.getElementById('stp-search');
    if (stp) stp.addEventListener('input', () => { staffProdPage = 1; renderProducts(); });
    document.getElementById('staff-order-modal-close').addEventListener('click', () => document.getElementById('staff-order-modal').classList.remove('open'));
    document.getElementById('staff-order-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('staff-order-modal')) document.getElementById('staff-order-modal').classList.remove('open');
    });

    document.getElementById('staff-profile-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('sp-name').value.trim();
      const email = document.getElementById('sp-email').value.trim();
      const phone = document.getElementById('sp-phone').value.trim();
      if (name.length < 2 || !Auth.validEmail(email)) { UI.toast('Kiểm tra lại họ tên / email.', 'warn'); return; }
      if (phone && !Auth.validPhone(phone)) { UI.toast('Số điện thoại không đúng định dạng.', 'warn'); return; }
      try {
        await Store.updateProfile({ name, email, phone });
        UI.toast('Đã lưu thông tin.', 'ok');
        renderProfile();
      } catch (err) { UI.toast(err.message, 'danger'); }
    });

    document.getElementById('staff-pass-form').addEventListener('submit', async e => {
      e.preventDefault();
      const oldPw = document.getElementById('sp-old-pass').value;
      const newPw = document.getElementById('sp-new-pass').value;
      const newPw2 = document.getElementById('sp-new-pass2').value;
      if (newPw !== newPw2) { UI.toast('Xác nhận mật khẩu mới không khớp.', 'warn'); return; }
      try {
        const res = await Store.changePassword({ oldPassword: oldPw, newPassword: newPw });
        localStorage.setItem(Store.KEYS.token, res.token);
        UI.toast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.', 'ok');
        setTimeout(() => { Auth.logout(); location.href = 'login.html'; }, 1200);
      } catch (err) { UI.toast(err.message, 'danger'); }
    });
  }

  return { view, init };
})();

document.addEventListener('DOMContentLoaded', Staff.init);
