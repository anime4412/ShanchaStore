/* ============================================================
   ShanChaStore - admin-login.js
   Đăng nhập riêng cho quản trị viên.
   - Chỉ chấp nhận tài khoản có role === 'admin'.
   - Nếu đã đăng nhập admin: chuyển thẳng vào admin.html.
   - Nếu đang là khách thường: nhắc đăng xuất / không cho vào.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // chờ dữ liệu từ server (không có header trên trang này)
  await Store.ready;

  // Yêu cầu đăng xuất nếu được chuyển qua ?logout=1
  // (phải đặt TRƯỚC kiểm tra phiên hiện tại, nếu không link
  //  "Đăng xuất & đăng nhập lại" sẽ lặp vô hạn ở khối dưới)
  if (new URLSearchParams(location.search).get('logout') === '1') {
    Auth.logout();
  }

  // Nếu đã đăng nhập admin -> vào thẳng trang quản trị
  const current = Store.currentUser();
  if (current) {
    if (current.role === 'admin') {
      location.href = 'admin.html';
      return;
    }
    // Đang là khách hàng -> thông báo và không cho đăng nhập quản trị
    document.querySelector('.admin-login-card').innerHTML =
      '<div class="admin-login-shield"><span class="ic-big" data-ic="user"></span></div>' +
      '<div class="admin-login-title">Bạn đang đăng nhập với tài khoản khách</div>' +
      '<div class="admin-login-sub">Tài khoản hiện tại: <b>' + UI.esc(current.name) + '</b>. ' +
      'Vui lòng đăng xuất rồi đăng nhập bằng tài khoản admin.</div>' +
      '<a class="btn btn-primary btn-block" href="admin-login.html?logout=1">Đăng xuất & đăng nhập lại</a>' +
      '<div class="admin-login-links"><a href="index.html"><span class="nav-ic" data-ic="chevL"></span> Về trang chủ</a></div>';
    return;
  }

  const form = document.getElementById('admin-login-form');
  const userEl = document.getElementById('al-user');
  const passEl = document.getElementById('al-pass');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const groups = [userEl.closest('.form-group'), passEl.closest('.form-group')];
    groups.forEach(g => g.classList.remove('invalid'));
    let ok = true;
    if (!userEl.value.trim()) { groups[0].classList.add('invalid'); ok = false; }
    if (!passEl.value) { groups[1].classList.add('invalid'); ok = false; }
    if (!ok) return;

    const res = await Auth.login(userEl.value, passEl.value);
    if (!res.ok) {
      UI.toast(res.msg, 'danger');
      return;
    }
    if (res.user.role !== 'admin') {
      Auth.logout();
      UI.toast('Tài khoản này không có quyền quản trị.', 'danger');
      return;
    }
    UI.toast('Đăng nhập quản trị thành công!', 'ok');
    setTimeout(() => location.href = 'admin.html', 500);
  });

});
