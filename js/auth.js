/* ============================================================
   ShanChaStore - auth.js
   ============================================================
   FILE NÀY CHẠY CHO: MỌI trang web (nạp sau store.js).
   ============================================================
   Chuyên về tài khoản / phiên đăng nhập:
   - validEmail/validPhone/validName/validPassword : kiểm tra định dạng
        dữ liệu người dùng nhập (email, SĐT, họ tên, mật khẩu ≥ 6 ký tự).
   - register()   : đăng ký tài khoản mới (gọi Store.register -> server hash
        mật khẩu bằng scrypt+muối, lưu vào bảng users trong SQLite).
   - login()      : đăng nhập bằng email HOẶC tên đăng nhập + mật khẩu.
   - googleLogin()/googleLoginDemo() : đăng nhập Google (hàm còn giữ nhưng
        giao diện đã bỏ nút — chỉ để dành cho tương lai).
   - logout()     : đăng xuất — xoá token khỏi localStorage + huỷ phiên server.
   - requireLogin(): yêu cầu đăng nhập — nếu chưa đăng nhập thì chuyển sang
        login.html?next=... (dùng cho nút "Thanh toán").
   - requireAdmin() : yêu cầu quyền admin (dùng cho trang quản trị).
   ============================================================ */

'use strict';

const Auth = (function () {

  /* ---------- Validate chung ---------- */
  const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const rePhone = /^(0|\+84)[0-9]{9,10}$/;

  function validEmail(v) { return reEmail.test(v); }
  function validPhone(v) { return rePhone.test(v); }
  function validName(v) { return v.trim().length >= 2; }
  function validPassword(v) { return v.length >= 6; }

  /* ---------- Đăng ký (gọi API, bất đồng bộ) ---------- */
  async function register({ name, username, email, phone, password }) {
    name = name.trim(); username = username.trim(); email = email.trim(); phone = phone.trim();

    // validate nhanh phía client để phản hồi tức thì
    if (!validName(name)) return { ok: false, msg: 'Họ tên phải có ít nhất 2 ký tự.' };
    if (username.length < 3) return { ok: false, msg: 'Tên đăng nhập phải có ít nhất 3 ký tự.' };
    if (!validEmail(email)) return { ok: false, msg: 'Email không đúng định dạng.' };
    if (!validPhone(phone)) return { ok: false, msg: 'Số điện thoại không đúng định dạng (VD: 0901234567).' };
    if (!validPassword(password)) return { ok: false, msg: 'Mật khẩu phải có ít nhất 6 ký tự.' };

    try {
      const user = await Store.register({ name, username, email, phone, password });
      return { ok: true, user };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  /* ---------- Đăng nhập (gọi API, bất đồng bộ) ---------- */
  async function login(username, password) {
    try {
      const user = await Store.login(username.trim(), password);
      return { ok: true, user };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  /* ---------- Đăng nhập bằng Google (server xác minh ID token) ---------- */
  async function googleLogin(credential) {
    try {
      const user = await Store.googleLogin(credential);
      return { ok: true, user };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  /* ---------- Đăng nhập bằng Google (chế độ demo, chưa cấu hình Client ID) ---------- */
  async function googleLoginDemo(email, name) {
    try {
      const user = await Store.googleLoginDemo(email, name);
      return { ok: true, user };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  /* ---------- Đăng xuất ---------- */
  function logout() { Store.logout(); }

  /* ---------- Yêu cầu đăng nhập để đặt hàng ---------- */
  function requireLogin(nextPath) {
    if (Store.isLoggedIn()) return true;
    const url = 'login.html?next=' + encodeURIComponent(nextPath || location.pathname.split('/').pop() || 'index.html');
    location.href = url;
    return false;
  }

  /* ---------- Yêu cầu admin ---------- */
  function requireAdmin() {
    if (Store.isAdmin()) return true;
    location.href = 'login.html?next=' + encodeURIComponent('admin.html');
    return false;
  }

  return { validEmail, validPhone, validName, validPassword, register, login, googleLogin, googleLoginDemo, logout, requireLogin, requireAdmin };
})();
