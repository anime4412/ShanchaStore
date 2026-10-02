/* ============================================================
   ShanChaStore - login.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Đăng nhập / Đăng ký (login.html).
   ============================================================
   Từng phần làm gì:
   - await UI.initCommon() : dựng header/footer + đổ dữ liệu (Store.ready).
   - Nếu đã đăng nhập: chuyển thẳng về ?next= (hoặc admin nếu là admin).
   - render brand: hiện logo/tên shop ở cột trái (theo Cài đặt).
   - Tabs Đăng nhập / Đăng ký: bật/tắt 2 form.
   - redirectAfterLogin(): sau khi đăng nhập — admin -> admin.html,
        khách -> ?next= (mặc định index.html).
   - Form Đăng nhập: kiểm tra rỗng -> Auth.login() (email hoặc username).
   - Form Đăng ký: kiểm tra từng field (họ tên/user/email/SĐT/mật khẩu)
        -> Auth.register() -> tự đăng nhập luôn (server trả token).
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  await UI.initCommon();

  // nếu đã đăng nhập thì chuyển thẳng theo vai trò
  if (Store.isLoggedIn()) {
    const dest = new URLSearchParams(location.search).get('next');
    if (dest) { location.href = dest; return; }
    const me = Store.currentUser();
    if (me.role === 'admin') location.href = 'admin.html';
    else if (me.role === 'staff') location.href = 'staff.html';
    else location.href = 'index.html';
    return;
  }

  // render brand ở cột trái (theo settings)
  const brandBox = document.getElementById('auth-brand');
  if (brandBox) {
    const s = Store.getSettings();
    if (s.logo && s.logo !== 'assets/images/logo.svg') {
      brandBox.innerHTML = '<img src="' + UI.esc(s.logo) + '" alt="' + UI.esc(s.siteName) + '">';
    } else {
      brandBox.innerHTML = '<span class="brand-text">' + UI.esc(s.siteName || 'ShanCha Store') + '</span>';
    }
  }

  const tabs = {
    login: document.getElementById('tab-login'),
    register: document.getElementById('tab-register')
  };
  const forms = {
    login: document.getElementById('login-form'),
    register: document.getElementById('register-form')
  };

  // nếu vào từ ?tab=register (nút "Đăng ký" trên header)
  if (new URLSearchParams(location.search).get('tab') === 'register') switchTab('register');

  function switchTab(name) {
    Object.keys(tabs).forEach(k => tabs[k].classList.toggle('active', k === name));
    Object.keys(forms).forEach(k => forms[k].classList.toggle('active', k === name));
  }
  tabs.login.addEventListener('click', () => switchTab('login'));
  tabs.register.addEventListener('click', () => switchTab('register'));

  const next = new URLSearchParams(location.search).get('next') || 'index.html';

  function redirectAfterLogin(user) {
    if (user.role === 'admin') location.href = 'admin.html';
    else if (user.role === 'staff') location.href = 'staff.html';
    else location.href = next && next !== 'login.html' ? next : 'index.html';
  }

  /* ---------- Đăng nhập bằng email ---------- */
  forms.login.addEventListener('submit', async e => {
    e.preventDefault();
    const userEl = document.getElementById('login-user');
    const passEl = document.getElementById('login-pass');
    const groups = [userEl.closest('.form-group'), passEl.closest('.form-group')];
    groups.forEach(g => g.classList.remove('invalid'));
    let ok = true;
    if (!userEl.value.trim()) { groups[0].classList.add('invalid'); ok = false; }
    if (!passEl.value) { groups[1].classList.add('invalid'); ok = false; }
    if (!ok) return;

    const btn = document.getElementById('login-submit');
    btn.disabled = true; btn.textContent = 'Đang xử lý…';
    try {
      const res = await Auth.login(userEl.value, passEl.value);
      if (!res.ok) {
        UI.toast(res.msg, 'danger');
        return;
      }
      UI.toast('Đăng nhập thành công! Chào ' + res.user.name, 'ok');
      setTimeout(() => redirectAfterLogin(res.user), 600);
    } finally {
      btn.disabled = false; btn.textContent = 'Đăng nhập';
    }
  });

  /* ---------- Đăng ký ---------- */
  forms.register.addEventListener('submit', async e => {
    e.preventDefault();
    const fields = ['reg-name', 'reg-user', 'reg-email', 'reg-phone', 'reg-pass'];
    const groups = fields.map(id => document.getElementById(id).closest('.form-group'));
    groups.forEach(g => g.classList.remove('invalid'));

    let ok = true;
    const values = fields.map(id => document.getElementById(id).value);
    if (!Auth.validName(values[0])) { groups[0].classList.add('invalid'); ok = false; }
    if (values[1].trim().length < 3) { groups[1].classList.add('invalid'); ok = false; }
    if (!Auth.validEmail(values[2])) { groups[2].classList.add('invalid'); ok = false; }
    if (!Auth.validPhone(values[3])) { groups[3].classList.add('invalid'); ok = false; }
    if (!Auth.validPassword(values[4])) { groups[4].classList.add('invalid'); ok = false; }
    if (!ok) return;

    const btn = document.getElementById('register-submit');
    btn.disabled = true; btn.textContent = 'Đang xử lý…';
    try {
      const res = await Auth.register({
        name: values[0], username: values[1],
        email: values[2], phone: values[3], password: values[4]
      });
      if (!res.ok) {
        UI.toast(res.msg, 'danger');
        return;
      }
      UI.toast('Tạo tài khoản thành công!', 'ok');
      setTimeout(() => location.href = next, 600);
    } finally {
      btn.disabled = false; btn.textContent = 'Tạo tài khoản';
    }
  });

});
