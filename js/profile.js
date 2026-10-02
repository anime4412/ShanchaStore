/* ============================================================
   ShanChaStore - profile.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Tài khoản / cá nhân (profile.html).
   ============================================================
   Từng phần làm gì:
   - GATE: chưa đăng nhập -> hiện thông báo + link đăng nhập/đăng ký.
   - STATUS/PAY_LABEL: nhãn trạng thái đơn + phương thức thanh toán.
   - renderInfo(): thẻ thông tin tài khoản (avatar, tên, @username, email,
           SĐT, ngày tham gia, vai trò) từ Store.currentUser().
   - fillForm(): điền sẵn họ tên/email/SĐT vào form sửa.
   - renderOrders(): vẽ lịch sử đơn hàng (mã, trạng thái, món+topping,
           nơi nhận, phí ship, mã KM, phương thức, tổng tiền, link bản đồ).
   - Form "Lưu thay đổi": validate -> Store.updateProfile() (PATCH /api/me).
   - Nút "Đăng xuất": Auth.logout() -> về trang chủ.
   - Tải lịch sử đơn: Store.myOrders() (GET /api/my/orders).
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  await UI.initCommon();

  /* ---------- Gate: chưa đăng nhập thì không cho vào ---------- */
  if (!Store.isLoggedIn()) {
    document.getElementById('profile-layout').innerHTML =
      '<div class="form-card" style="grid-column:1/-1;text-align:center">' +
      '<div style="font-size:3rem">' + UI.icon('lock') + '</div>' +
      '<h2 style="margin:12px 0">Bạn cần đăng nhập để xem trang cá nhân</h2>' +
      '<p class="section-desc">Đăng nhập để quản lý thông tin và theo dõi đơn hàng của bạn.</p>' +
      '<div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<a class="btn btn-primary" href="login.html?next=profile.html">Đăng nhập</a>' +
      '<a class="btn btn-outline" href="login.html?tab=register&next=profile.html">Tạo tài khoản</a>' +
      '</div></div>';
    UI.toast('Vui lòng đăng nhập để xem trang cá nhân!', 'warn');
    return;
  }

  const STATUS = {
    pending: { label: 'Chờ xác nhận', cls: 'badge-processing' },
    confirmed: { label: 'Đã xác nhận', cls: 'badge-processing' },
    preparing: { label: 'Đang pha chế', cls: 'badge-delivering' },
    ready: { label: 'Sẵn sàng', cls: 'badge-delivering' },
    delivering: { label: 'Đang giao', cls: 'badge-delivering' },
    completed: { label: 'Hoàn thành', cls: 'badge-done' },
    cancelled: { label: 'Đã huỷ', cls: 'badge-cancelled' }
  };
  const PAY_LABEL = { cod: 'COD', bank: 'Chuyển khoản', card: 'Thẻ tín dụng' };
  /* Đơn có thể hủy được (PHASE 22) */
  const CANCELABLE = ['pending', 'confirmed'];
  function statusBadge(s) {
    const st = STATUS[s] || STATUS.processing;
    return '<span class="badge-status ' + st.cls + '">' + st.label + '</span>';
  }

  /* ---------- Thẻ thông tin tài khoản ---------- */
  function renderInfo() {
    const u = Store.currentUser();
    document.getElementById('pf-info').innerHTML =
      '<div class="pf-avatar">' + UI.esc((u.name || '?').trim().charAt(0).toUpperCase()) + '</div>' +
      '<h3 class="pf-name">' + UI.esc(u.name) + '</h3>' +
      '<div class="pf-username">@' + UI.esc(u.username) + '</div>' +
      (u.role === 'admin' ? '<div style="margin:8px 0"><span class="badge-admin">ADMIN</span></div>' : '') +
      '<div class="pf-rows">' +
      '<div class="pf-row"><span>Email</span><b>' + UI.esc(u.email || '(chưa có)') + '</b></div>' +
      '<div class="pf-row"><span>Số điện thoại</span><b>' + UI.esc(u.phone || '(chưa có)') + '</b></div>' +
      '<div class="pf-row"><span>Ngày tham gia</span><b>' + UI.fmtDate(u.created) + '</b></div>' +
      '<div class="pf-row"><span>Vai trò</span><b>' + (u.role === 'admin' ? 'Quản trị viên' : 'Khách hàng') + '</b></div>' +
      '</div>';
  }

  /* ---------- Điền sẵn form sửa thông tin ---------- */
  function fillForm() {
    const u = Store.currentUser();
    document.getElementById('pf-name').value = u.name || '';
    document.getElementById('pf-email').value = u.email || '';
    document.getElementById('pf-phone').value = u.phone || '';
  }

  /* ---------- Lịch sử đơn hàng ---------- */
  function renderOrders(list) {
    const box = document.getElementById('pf-orders');
    if (!list.length) {
      box.innerHTML =
        '<div class="pf-empty">' +
        '<span style="font-size:2.4rem;display:inline-block">' + UI.icon('box') + '</span>' +
        '<p>Bạn chưa có đơn hàng nào.</p>' +
        '<a class="btn btn-primary btn-sm" href="products.html">Đặt món ngay</a>' +
        '</div>';
      return;
    }
    box.innerHTML = list.map(o => {
      const itemsText = (o.items || []).map(it =>
        UI.esc(it.name) + ' × ' + it.qty +
        ((it.toppings || []).length ? ' <span class="pf-order-toppings">(+' + it.toppings.map(t => UI.esc(t.name)).join(', ') + ')</span>' : '')
      ).join('<br>');
      return (
        '<div class="pf-order">' +
        '<div class="pf-order-head">' +
        '<span class="pf-order-code">' + o.code + '</span>' +
        statusBadge(o.status) +
        '<span class="pf-order-date">' + UI.fmtDate(o.created) + '</span>' +
        '</div>' +
        '<div class="pf-order-items">' + itemsText + '</div>' +
        '<div class="pf-order-meta">' +
        UI.esc(o.store || 'Giao tận nơi') +
        (o.shipKm ? ' · ~' + o.shipKm + ' km từ ' + UI.esc(o.shipFrom) : '') +
        (o.promo ? ' · Ưu đãi ' + UI.esc(o.promo) : '') +
        ' · ' + (PAY_LABEL[o.payMethod] || o.payMethod) +
        '</div>' +
        '<div class="pf-order-meta">' +
        UI.esc(o.store || 'Giao tận nơi') +
        (o.shipKm ? ' · ~' + o.shipKm + ' km từ ' + UI.esc(o.shipFrom) : '') +
        (o.promo ? ' · Ưu đãi ' + UI.esc(o.promo) : '') +
        ' · ' + (PAY_LABEL[o.payMethod] || o.payMethod) +
        (o.payment_status === 'paid' ? ' · <span class="pf-order-paid">Đã thanh toán</span>' : '') +
        '</div>' +
        '<div class="pf-order-foot">' +
        '<span>' +
        (o.lat && o.lng
          ? '<a class="pf-map-link" href="https://maps.google.com/?q=' + o.lat + ',' + o.lng + '" target="_blank" rel="noopener">' + UI.icon('loc') + ' Xem bản đồ giao hàng</a>'
          : (o.discount > 0 ? '<span class="pf-order-discount">Đã giảm ' + UI.fmt(o.discount) + '</span>' : '')) +
        '</span>' +
        '<b class="pf-order-total">' + UI.fmt(o.total) + '</b>' +
        (CANCELABLE.includes(o.status)
          ? '<button class="btn btn-outline btn-sm" data-cancel="' + o.code + '" style="margin-left:8px">Huỷ đơn</button>'
          : '') +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  renderInfo();
  fillForm();

  /* ---------- Lưu thông tin cá nhân ---------- */
  document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('pf-name').value.trim();
    const email = document.getElementById('pf-email').value.trim();
    const phone = document.getElementById('pf-phone').value.trim();
    const groups = ['pf-name', 'pf-email', 'pf-phone'].map(id => document.getElementById(id).closest('.form-group'));
    groups.forEach(g => g.classList.remove('invalid'));

    let ok = true;
    if (!Auth.validName(name)) { groups[0].classList.add('invalid'); ok = false; }
    if (!Auth.validEmail(email)) { groups[1].classList.add('invalid'); ok = false; }
    if (phone && !Auth.validPhone(phone)) { groups[2].classList.add('invalid'); ok = false; }
    if (!ok) { UI.toast('Vui lòng kiểm tra lại thông tin.', 'warn'); return; }

    try {
      await Store.updateProfile({ name, email, phone });
      renderInfo();
      UI.renderHeader();
      UI.toast('Đã lưu thông tin cá nhân.', 'ok');
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });

  /* ---------- Đăng xuất ---------- */
  document.getElementById('btn-logout-profile').addEventListener('click', () => {
    Auth.logout();
    UI.toast('Đã đăng xuất.', 'info');
    setTimeout(() => location.href = 'index.html', 400);
  });

  /* ---------- Tải lịch sử đơn hàng ---------- */
  try {
    const orders = await Store.myOrders();
    renderOrders(orders);
  } catch (err) {
    document.getElementById('pf-orders').innerHTML =
      '<p class="pf-empty">Không tải được lịch sử đơn hàng: ' + UI.esc(err.message) + '</p>';
  }

  /* ---------- Hủy đơn (PHASE 22) ---------- */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    const code = btn.dataset.cancel;
    if (!confirm('Bạn chắc chắn muốn hủy đơn ' + code + '?')) return;
    try {
      await Store.cancelOrder(code);
      UI.toast('Đã hủy đơn ' + code + '.', 'ok');
      const orders = await Store.myOrders();
      renderOrders(orders);
    } catch (err) {
      UI.toast(err.message, 'danger');
    }
  });

});
