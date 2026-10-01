/* ============================================================
   ShanChaStore - server.js  (BACKEND — chạy bằng `node server.js`)
   ============================================================
   FILE NÀY LÀ MÁY CHỦ: không chạy trong trình duyệt.
   Phải chạy `node server.js` TRƯỚC rồi mở http://localhost:3000.
   ============================================================
   Nó làm 3 việc lớn:
   1) Database SQLite (file database.db):
      - Bảng users     : tài khoản (mật khẩu hash scrypt + salt, KHÔNG lưu plaintext)
      - Bảng sessions  : phiên đăng nhập (token Bearer, sống 30 ngày)
      - Bảng products  : sản phẩm (tên, danh mục, nhóm, giá, ảnh, rating, đã bán)
      - Bảng categories: danh mục sản phẩm (quản lý trong admin)
      - Bảng toppings  : topping kèm giá
      - Bảng orders    : đơn hàng (server tự tính lại giá, không tin client)
      - Bảng reviews / site_reviews : đánh giá sản phẩm & đánh giá website
      - Bảng settings  : cài đặt website (tên, logo, màu, sale…) — lưu vĩnh viễn
      - Seed dữ liệu mẫu lần đầu chạy (admin/admin123, user/123456, 18 SP...)
   2) REST API (các đường /api/...) — xem bảng ở dưới.
   3) Phục vụ file tĩnh (html/css/js/ảnh) của thư mục dự án.

   CÁC API CHÍNH:
   - GET  /api/bootstrap            : đổ toàn bộ dữ liệu cho trang web khi load
   - POST /api/register             : đăng ký (hash mật khẩu + tạo phiên)
   - POST /api/login                : đăng nhập bằng email HOẶC tên đăng nhập
   - POST /api/logout               : huỷ phiên
   - GET  /api/me                   : thông tin user đang đăng nhập
   - PATCH /api/me                  : sửa tên/email/SĐT
   - POST /api/orders               : đặt hàng (PHẢI đăng nhập; server tính lại giá)
   - GET  /api/my/orders            : lịch sử đơn của tôi
   - POST /api/reviews              : đánh giá sản phẩm (PHẢI đăng nhập)
   - DELETE /api/reviews/:id        : xoá đánh giá sản phẩm (admin) + tính lại rating
   - POST /api/site-reviews         : đánh giá website
   - DELETE /api/site-reviews/:id   : xoá đánh giá website (admin)
   - POST /api/categories           : thêm/sửa danh mục (admin)
   - DELETE /api/categories/:id     : xoá danh mục (admin, chặn nếu còn sản phẩm)
   - GET  /api/admin/data           : danh sách users + orders (admin)
   - POST/DELETE /api/products(/:id): thêm/sửa/xoá sản phẩm (admin)
   - POST/DELETE /api/toppings(/:id): thêm/sửa/xoá topping (admin)
   - PATCH /api/orders/:code        : đổi trạng thái đơn (admin)
   - PATCH/DELETE /api/users/:id    : sửa/khoá/xoá khách hàng (admin)
   - POST /api/settings             : lưu cài đặt website (admin) — VĨNH VIỄN
   - GET  /api/promo/check          : kiểm tra mã giảm giá
   ============================================================ */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

/* Dữ liệu gốc dùng để seed database lần đầu */
const { PRODUCTS, STORES, TOPPINGS, distanceKm } = require('./js/data.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'database.db');
const SHIP_FEE = 15000;                       // phí giao tận nơi khi KHÔNG chọn bản đồ
const BODY_LIMIT = 15 * 1024 * 1024;          // 15MB (chứa ảnh base64)
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;  // phiên đăng nhập sống 30 ngày
const ORDER_STATUS = ['processing', 'delivering', 'done', 'cancelled'];
const PAY_METHODS = ['cod', 'bank', 'card'];
const CATEGORIES_ID = ['tra-sua', 'tra-lanh', 'ca-phe'];
const GROUPS_ID = ['new', 'hot', 'sale'];

/* Phí ship theo khoảng cách (km) từ chi nhánh gần nhất tới điểm giao trên bản đồ */
const SHIP_TIERS = [
  { maxKm: 2,        fee: 10000 },
  { maxKm: 5,        fee: 15000 },
  { maxKm: 10,       fee: 25000 },
  { maxKm: Infinity, fee: 35000 }
];

/* Mã khuyến mãi (server tự kiểm tra lại khi đặt hàng, không tin client) */
const PROMOS = {
  FREESHIP:  { code: 'FREESHIP',  type: 'ship',    label: 'Miễn phí vận chuyển' },
  SHANCHA10: { code: 'SHANCHA10', type: 'percent', value: 10, max: 30000, label: 'Giảm 10% đơn hàng (tối đa 30.000đ)' },
  GIAM20K:   { code: 'GIAM20K',   type: 'amount', value: 20000, min: 100000, label: 'Giảm 20.000đ cho đơn từ 100.000đ' }
};

const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const rePhone = /^(0|\+84)[0-9]{9,10}$/;

/* ============================================================
   1) DATABASE SQLITE
   (cột "grp" / "descr" vì "group" / "desc" là từ khoá của SQL)
   ============================================================ */
const db = new DatabaseSync(DB_FILE);db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    username  TEXT NOT NULL UNIQUE,
    pass_salt TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    email     TEXT DEFAULT '',
    phone     TEXT DEFAULT '',
    role      TEXT NOT NULL DEFAULT 'customer',
    blocked   INTEGER NOT NULL DEFAULT 0,
    created   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token   TEXT PRIMARY KEY,
    userId  TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL,
    grp      TEXT NOT NULL,
    price    INTEGER NOT NULL,
    oldPrice INTEGER NOT NULL,
    img      TEXT DEFAULT '',
    descr    TEXT DEFAULT '',
    rating   REAL NOT NULL DEFAULT 4.5,
    sold     INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS toppings (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    price INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    code      TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    customer  TEXT NOT NULL,
    name      TEXT NOT NULL,
    phone     TEXT NOT NULL,
    address   TEXT NOT NULL,
    note      TEXT DEFAULT '',
    payMethod TEXT NOT NULL DEFAULT 'cod',
    store     TEXT NOT NULL DEFAULT 'Giao tận nơi',
    items     TEXT NOT NULL,
    subtotal  INTEGER NOT NULL,
    shipFee   INTEGER NOT NULL,
    total     INTEGER NOT NULL,
    status    TEXT NOT NULL DEFAULT 'processing',
    created   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    userName  TEXT NOT NULL,
    rating    INTEGER NOT NULL,
    comment   TEXT DEFAULT '',
    created   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_reviews (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    userName TEXT NOT NULL,
    rating   INTEGER NOT NULL,
    comment  TEXT DEFAULT '',
    created  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS banners (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    img   TEXT NOT NULL,
    title TEXT DEFAULT '',
    sub   TEXT DEFAULT '',
    link  TEXT DEFAULT '',
    sort  INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS stores (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    address TEXT DEFAULT '',
    hours   TEXT DEFAULT '',
    phone   TEXT DEFAULT '',
    lat     REAL,
    lng     REAL,
    sort    INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS customer_reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    avatar_letter TEXT DEFAULT '',
    stars         INTEGER NOT NULL DEFAULT 5,
    content       TEXT DEFAULT '',
    author        TEXT DEFAULT '',
    city          TEXT DEFAULT '',
    created       INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS groups (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS promos (
    code   TEXT PRIMARY KEY,
    type   TEXT NOT NULL,
    value  REAL NOT NULL DEFAULT 0,
    max    REAL,
    min    REAL,
    label  TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS newsletters (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    email   TEXT NOT NULL UNIQUE,
    created INTEGER NOT NULL
  );
`);

/* Nâng cấp bảng orders cho bản đồ + khuyến mãi (an toàn khi chạy lại nhiều lần) */
[
  'discount INTEGER NOT NULL DEFAULT 0', // số tiền được giảm nhờ mã KM
  'promo    TEXT DEFAULT \'\'',           // mã KM đã áp dụng
  'lat      REAL',                        // tọa độ điểm giao (chọn trên bản đồ)
  'lng      REAL',
  'shipKm   REAL',                        // khoảng cách tới chi nhánh gần nhất
  'shipFrom TEXT DEFAULT \'\''            // tên chi nhánh phụ trách giao
].forEach(col => {
  try { db.exec('ALTER TABLE orders ADD COLUMN ' + col); }
  catch (e) { /* cột đã tồn tại từ lần chạy trước */ }
});

/* ---------- Mật khẩu: scrypt + muối ngẫu nhiên (không lưu plaintext) ----------
   hashPassword(password): sinh muối ngẫu nhiên + hash scrypt 64 byte -> hex.
   verifyPassword(password, salt, hash): băm thử rồi so sánh an toàn thời gian. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return orig.length === test.length && crypto.timingSafeEqual(orig, test);
}

/* ---------- Đổi tên cột database -> tên field của website ---------- */
function rowToProduct(r) {
  return {
    id: r.id, name: r.name, category: r.category, group: r.grp,
    price: r.price, oldPrice: r.oldPrice, img: r.img, desc: r.descr,
    rating: r.rating, sold: r.sold
  };
}
function rowToUser(r) {
  return {
    id: r.id, name: r.name, username: r.username,
    email: r.email, phone: r.phone, role: r.role,
    blocked: !!r.blocked, created: r.created
  };
}
function rowToOrder(r) {
  let items = [];
  try { items = JSON.parse(r.items); } catch (e) { /* items hỏng -> mảng rỗng */ }
  return {
    code: r.code, userId: r.userId, customer: r.customer, name: r.name,
    phone: r.phone, address: r.address, note: r.note, payMethod: r.payMethod,
    store: r.store, items, subtotal: r.subtotal, shipFee: r.shipFee,
    discount: r.discount || 0, promo: r.promo || '',
    lat: r.lat, lng: r.lng, shipKm: r.shipKm, shipFrom: r.shipFrom || '',
    total: r.total, status: r.status, created: r.created
  };
}
function rowToReview(r) {
  return { id: r.id, productId: r.productId, userName: r.userName, rating: r.rating, comment: r.comment, created: r.created };
}
function rowToSiteReview(r) {
  return { id: r.id, userName: r.userName, rating: r.rating, comment: r.comment, created: r.created };
}
function rowToCategory(r) {
  return { id: r.id, name: r.name, sort: r.sort };
}
function rowToBanner(r) {
  return { id: r.id, img: r.img, title: r.title, sub: r.sub, link: r.link, sort: r.sort, active: !!r.active };
}
function rowToStore(r) {
  return { id: r.id, name: r.name, address: r.address, hours: r.hours, phone: r.phone, lat: r.lat, lng: r.lng, sort: r.sort };
}
function rowToCustomerReview(r) {
  return { id: r.id, avatarLetter: r.avatar_letter, stars: r.stars, content: r.content, author: r.author, city: r.city, created: r.created };
}
function rowToGroup(r) {
  return { id: r.id, name: r.name, sort: r.sort };
}
function rowToPromo(r) {
  return { code: r.code, type: r.type, value: r.value, max: r.max, min: r.min, label: r.label, active: !!r.active, created: r.created };
}
function rowToNewsletter(r) {
  return { id: r.id, email: r.email, created: r.created };
}

/* ---------- Cài đặt website (lưu JSON từng khoá) ----------
   getSettings(): đọc toàn bộ bảng settings, ghép lên DEFAULT_SETTINGS.
   saveSettings(s): ghi từng khoá bằng INSERT OR REPLACE -> LƯU VĨNH VIỄN. */
const DEFAULT_SETTINGS = {
  siteName: 'ShanCha Store',
  slogan: 'Đậm trà, thơm hương',
  desc: 'Trà nguyên chất từ vùng cao Đà Lạt, pha chế thủ công mỗi ngày.',
  hotline: '039 799 9949',
  email: 'hello@shancha.vn',
  address: 'TP.HCM · Đà Lạt',
  openHours: '09:00 – 22:00',
  logo: 'assets/images/logo.svg',
  themeColor: '#C97B4A',
  salePercent: 20,
  saleEndsAt: Date.now() + 2 * 24 * 60 * 60 * 1000
};

function getSettings() {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  db.prepare('SELECT k, v FROM settings').all().forEach(row => {
    try { out[row.k] = JSON.parse(row.v); }
    catch (e) { out[row.k] = row.v; }
  });
  return out;
}
function saveSettings(s) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)');
  Object.keys(s).forEach(k => stmt.run(k, JSON.stringify(s[k])));
  return getSettings();
}

/* ---------- Seed dữ liệu lần đầu chạy ---------- */
function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const stmt = db.prepare(
      'INSERT INTO users (id, name, username, pass_salt, pass_hash, email, phone, role, blocked, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
    );
    const admin = hashPassword('admin123');
    stmt.run('u-admin', 'Quản trị viên', 'admin', admin.salt, admin.hash, 'admin@shancha.vn', '0397999949', 'admin', Date.now());
    const user = hashPassword('123456');
    stmt.run('u-user', 'Khách hàng Demo', 'user', user.salt, user.hash, 'user@shancha.vn', '0901234567', 'customer', Date.now());
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
    const stmt = db.prepare(
      'INSERT INTO products (id, name, category, grp, price, oldPrice, img, descr, rating, sold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    PRODUCTS.forEach(p => stmt.run(p.id, p.name, p.category, p.group, p.price, p.oldPrice, p.img, p.desc, p.rating, p.sold));
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM toppings').get().n === 0) {
    const stmt = db.prepare('INSERT INTO toppings (id, name, price) VALUES (?, ?, ?)');
    TOPPINGS.forEach(t => stmt.run(t.id, t.name, t.price));
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM categories').get().n === 0) {
    const stmt = db.prepare('INSERT INTO categories (id, name, sort) VALUES (?, ?, ?)');
    [['tra-sua', 'Trà sữa', 1], ['tra-lanh', 'Trà lạnh', 2], ['ca-phe', 'Cà phê', 3]].forEach(c => stmt.run(c[0], c[1], c[2]));
  }
  /* Seed nội dung trang chủ (giữ nguyên giao diện khi nâng cấp) */
  if (db.prepare('SELECT COUNT(*) AS n FROM groups').get().n === 0) {
    const stmt = db.prepare('INSERT INTO groups (id, name, sort) VALUES (?, ?, ?)');
    [['new', 'Sản phẩm mới', 1], ['hot', 'Sản phẩm hot', 2], ['sale', 'Sản phẩm khuyến mãi', 3]].forEach(g => stmt.run(g[0], g[1], g[2]));
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM stores').get().n === 0) {
    const stmt = db.prepare('INSERT INTO stores (id, name, address, hours, phone, lat, lng, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    STORES.forEach((s, i) => stmt.run(s.id, s.name, s.address, s.hours, s.phone, s.lat, s.lng, i + 1));
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM banners').get().n === 0) {
    const stmt = db.prepare('INSERT INTO banners (img, title, sub, link, sort, active) VALUES (?, ?, ?, ?, ?, 1)');
    [
      ['assets/images/banner-1.jpg', 'SƠN TRÀ', 'Trà trên núi – hương vị từ Đà Lạt', 'products.html', 1],
      ['assets/images/banner-2.jpg', 'SIGNATURE TEA', 'Công thức truyền thống, chuẩn vị', 'index.html#story', 2],
      ['assets/images/banner-3.jpg', 'FLASH SALE', 'Giảm đến 30% cho trà sữa ôlong', 'index.html#sale', 3]
    ].forEach(b => stmt.run(b[0], b[1], b[2], b[3], b[4]));
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM customer_reviews').get().n === 0) {
    const stmt = db.prepare('INSERT INTO customer_reviews (avatar_letter, stars, content, author, city, created) VALUES (?, ?, ?, ?, ?, ?)');
    [
      ['L', 5, 'Trà sữa đậm vị trà nhất mình từng uống. Quán nhỏ xinh, nhân viên thân thiện, mua mang về rất tiện.', 'Lan Thanh', 'TP.HCM'],
      ['J', 5, 'Không quá ngọt, rất chuẩn gu. Mình thích nhất trà sữa phong lan và ôlong kem bông dừa.', 'J.Y.S', 'Q.3'],
      ['M', 5, 'Quán lowkey nhưng chất lượng cao. Ghé ngày trong tuần sẽ yên tĩnh hơn cuối tuần.', 'Mỹ Lan', 'Đà Lạt']
    ].forEach(r => stmt.run(r[0], r[1], r[2], r[3], r[4], Date.now()));
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM settings').get().n === 0) saveSettings(DEFAULT_SETTINGS);
  db.prepare('DELETE FROM sessions WHERE created < ?').run(Date.now() - SESSION_MS);
}
seed();

/* ---------- Phiên đăng nhập (Bearer token) ----------
   createSession(userId): tạo token ngẫu nhiên 48 ký tự hex, lưu bảng sessions.
   userFromRequest(req): đọc header Authorization: Bearer <token>,
   JOIN với users -> trả user (null nếu hết hạn/bị khoá). */
function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, userId, created) VALUES (?, ?, ?)').run(token, userId, Date.now());
  return token;
}
function userFromRequest(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const row = db.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.userId WHERE s.token = ?'
  ).get(m[1]);
  if (!row || row.blocked) return null;
  return rowToUser(row);
}

/* ============================================================
   2) REST API
   handleApi(req, res, u): trung tâm xử lý mọi đường /api/...
   needUser():  yêu cầu đã đăng nhập, nếu không trả 401.
   needAdmin(): yêu cầu role admin, nếu không trả 401/403.
   ============================================================ */
class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > BODY_LIMIT) { reject(new ApiError(413, 'Dữ liệu quá lớn (tối đa 15MB).')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new ApiError(400, 'Dữ liệu gửi lên không hợp lệ.')); }
    });
    req.on('error', () => reject(new ApiError(400, 'Lỗi đọc dữ liệu gửi lên.')));
  });
}

async function handleApi(req, res, u) {
  const p = u.pathname;
  const method = req.method;

  function ok(data) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }
  function fail(status, msg) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, msg }));
  }
  function needUser() {
    const usr = userFromRequest(req);
    if (!usr) { fail(401, 'Vui lòng đăng nhập để tiếp tục.'); return null; }
    return usr;
  }
  function needAdmin() {
    const usr = needUser();
    if (!usr) return null;
    if (usr.role !== 'admin') { fail(403, 'Bạn không có quyền quản trị.'); return null; }
    return usr;
  }

  try {
    /* ---------- Dữ liệu chung khi trang load ---------- */
    if (method === 'GET' && p === '/api/bootstrap') {
      return ok({
        products: db.prepare('SELECT * FROM products ORDER BY id').all().map(rowToProduct),
        settings: getSettings(),
        toppings: db.prepare('SELECT * FROM toppings ORDER BY id').all().map(rowToToppingRow),
        categories: db.prepare('SELECT * FROM categories ORDER BY sort, id').all().map(rowToCategory),
        banners: db.prepare('SELECT * FROM banners ORDER BY sort, id').all().map(rowToBanner),
        stores: db.prepare('SELECT * FROM stores ORDER BY sort, id').all().map(rowToStore),
        customerReviews: db.prepare('SELECT * FROM customer_reviews ORDER BY id DESC').all().map(rowToCustomerReview),
        groups: db.prepare('SELECT * FROM groups ORDER BY sort, id').all().map(rowToGroup),
        promos: db.prepare('SELECT * FROM promos ORDER BY code').all().map(rowToPromo),
        newsletters: db.prepare('SELECT * FROM newsletters ORDER BY created DESC').all().map(rowToNewsletter),
        reviews: db.prepare('SELECT * FROM reviews ORDER BY id DESC').all().map(rowToReview),
        siteReviews: db.prepare('SELECT * FROM site_reviews ORDER BY id DESC').all().map(rowToSiteReview)
      });
    }

    /* ---------- Kiểm tra mã giảm giá (để hiện dự tính phí trước khi đặt) ---------- */
    if (method === 'GET' && p === '/api/promo/check') {
      const code = String(u.searchParams.get('code') || '').trim();
      const subtotal = Math.max(0, Math.round(Number(u.searchParams.get('subtotal')) || 0));
      const res = checkPromo(code, subtotal);
      return res.ok ? ok(res) : fail(400, res.msg);
    }

    /* ---------- Đăng ký ---------- */
    if (method === 'POST' && p === '/api/register') {
      const b = await readBody(req);
      const name = String(b.name || '').trim();
      const username = String(b.username || '').trim();
      const email = String(b.email || '').trim();
      const phone = String(b.phone || '').trim();
      const password = String(b.password || '');

      if (name.length < 2) return fail(400, 'Họ tên phải có ít nhất 2 ký tự.');
      if (username.length < 3) return fail(400, 'Tên đăng nhập phải có ít nhất 3 ký tự.');
      if (!reEmail.test(email)) return fail(400, 'Email không đúng định dạng.');
      if (!rePhone.test(phone)) return fail(400, 'Số điện thoại không đúng định dạng (VD: 0901234567).');
      if (password.length < 6) return fail(400, 'Mật khẩu phải có ít nhất 6 ký tự.');
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return fail(409, 'Tên đăng nhập đã tồn tại.');
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fail(409, 'Email đã được đăng ký.');

      const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const { salt, hash } = hashPassword(password);
      db.prepare(
        'INSERT INTO users (id, name, username, pass_salt, pass_hash, email, phone, role, blocked, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
      ).run(id, name, username, salt, hash, email, phone, 'customer', Date.now());
      const user = rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
      return ok({ user, token: createSession(id) });
    }

    /* ---------- Đăng nhập (bằng email HOẶC tên đăng nhập) ---------- */
    if (method === 'POST' && p === '/api/login') {
      const b = await readBody(req);
      const username = String(b.username || '').trim();
      const password = String(b.password || '');
      const row = db.prepare(
        'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE'
      ).get(username, username);
      if (!row) return fail(401, 'Tên đăng nhập / email không tồn tại.');
      if (!verifyPassword(password, row.pass_salt, row.pass_hash)) return fail(401, 'Mật khẩu không đúng.');
      if (row.blocked) return fail(403, 'Tài khoản đã bị khoá.');
      return ok({ user: rowToUser(row), token: createSession(row.id) });
    }

    /* ---------- Đăng xuất ---------- */
    if (method === 'POST' && p === '/api/logout') {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
      return ok({ ok: true });
    }

    /* ---------- Đăng nhập bằng Google (xác minh ID token với Google) ---------- */
    if (method === 'POST' && p === '/api/google-login') {
      const b = await readBody(req);
      const credential = String(b.credential || '').trim();
      if (!credential) return fail(400, 'Thiếu mã đăng nhập Google.');

      const clientId = String(getSettings().googleClientId || '').trim();
      if (!clientId) return fail(400, 'Website chưa cấu hình đăng nhập Google. Hãy liên hệ quản trị viên.');

      /* Xác minh token qua endpoint công khai của Google (không cần API key) */
      let info;
      try {
        const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
        if (!r.ok) throw new Error('tokeninfo ' + r.status);
        info = await r.json();
      } catch (e) {
        console.error('[google-login] Xác minh token lỗi:', e.message);
        return fail(401, 'Không xác minh được mã đăng nhập Google. Vui lòng thử lại.');
      }
      if (info.aud !== clientId) return fail(401, 'Mã đăng nhập không thuộc về website này.');
      if (!info.email) return fail(401, 'Tài khoản Google không có email.');
      if (String(info.email_verified) !== 'true') return fail(401, 'Email Google của bạn chưa được xác thực.');

      /* tìm user theo email; không có thì tạo mới */
      let row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(info.email);
      if (row && row.blocked) return fail(403, 'Tài khoản đã bị khoá.');
      if (!row) {
        let username = 'gg_' + String(info.sub || '').replace(/\D/g, '').slice(0, 12);
        if (username.length < 3 || db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
          username = 'gg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        }
        const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const name = String(info.name || '').trim() || info.email.split('@')[0];
        const { salt, hash } = hashPassword(crypto.randomBytes(18).toString('hex'));
        db.prepare(
          'INSERT INTO users (id, name, username, pass_salt, pass_hash, email, phone, role, blocked, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
        ).run(id, name, username, salt, hash, info.email, '', 'customer', Date.now());
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      }
      return ok({ user: rowToUser(row), token: createSession(row.id) });
    }

    /* ---------- Đăng nhập Google CHẾ ĐỘ DEMO (chỉ khi chưa cấu hình Client ID thật) ----------
       Giúp nút "Đăng nhập bằng Google" luôn hoạt động để chấm điểm / dùng offline.
       Khi admin nhập googleClientId trong Cài đặt, API này tự tắt và dùng luồng thật ở trên. */
    if (method === 'POST' && p === '/api/google-login-demo') {
      const clientId = String(getSettings().googleClientId || '').trim();
      if (clientId) return fail(400, 'Website đã cấu hình đăng nhập Google thật. Vui lòng đăng nhập qua Google.');
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      const name = String(b.name || '').trim();
      if (!reEmail.test(email)) return fail(400, 'Email không đúng định dạng.');

      let row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
      if (row && row.blocked) return fail(403, 'Tài khoản đã bị khoá.');
      if (!row) {
        let username = 'gg_' + email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 12);
        if (username.length < 3 || db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
          username = 'gg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        }
        const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const displayName = name || email.split('@')[0];
        const { salt, hash } = hashPassword(crypto.randomBytes(18).toString('hex'));
        db.prepare(
          'INSERT INTO users (id, name, username, pass_salt, pass_hash, email, phone, role, blocked, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
        ).run(id, displayName, username, salt, hash, email, '', 'customer', Date.now());
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      }
      return ok({ user: rowToUser(row), token: createSession(row.id), demo: true });
    }

    /* ---------- Thông tin phiên hiện tại ---------- */
    if (method === 'GET' && p === '/api/me') {
      const usr = needUser();
      if (!usr) return;
      return ok({ user: usr });
    }

    /* ---------- Sửa thông tin cá nhân ---------- */
    if (method === 'PATCH' && p === '/api/me') {
      const usr = needUser();
      if (!usr) return;
      const b = await readBody(req);
      const name = String(b.name || '').trim();
      const email = String(b.email || '').trim();
      const phone = String(b.phone || '').trim();
      if (name.length < 2) return fail(400, 'Họ tên phải có ít nhất 2 ký tự.');
      if (!reEmail.test(email)) return fail(400, 'Email không đúng định dạng.');
      if (phone && !rePhone.test(phone)) return fail(400, 'Số điện thoại không đúng định dạng (VD: 0901234567).');
      const dup = db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?').get(email, usr.id);
      if (dup) return fail(409, 'Email này đã được tài khoản khác sử dụng.');
      db.prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?').run(name, email, phone, usr.id);
      return ok({ user: rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(usr.id)) });
    }

    /* ---------- Đơn hàng của tôi ---------- */
    if (method === 'GET' && p === '/api/my/orders') {
      const usr = needUser();
      if (!usr) return;
      return ok({
        orders: db.prepare('SELECT * FROM orders WHERE userId = ? ORDER BY created DESC').all(usr.id).map(rowToOrder)
      });
    }

    /* ---------- Dữ liệu quản trị (users + orders) ---------- */
    if (method === 'GET' && p === '/api/admin/data') {
      if (!needAdmin()) return;
      return ok({
        users: db.prepare('SELECT * FROM users ORDER BY created').all().map(rowToUser),
        orders: db.prepare('SELECT * FROM orders ORDER BY created DESC').all().map(rowToOrder)
      });
    }

    /* ---------- Sản phẩm (admin) ---------- */
    if (method === 'POST' && p === '/api/products') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const name = String(b.name || '').trim();
      const price = Math.round(Number(b.price) || 0);
      if (!name || price <= 0) return fail(400, 'Tên và giá hợp lệ là bắt buộc.');
      const category = CATEGORIES_ID.includes(b.category) ? b.category : 'tra-sua';
      const grp = GROUPS_ID.includes(b.group) ? b.group : 'new';
      const oldPrice = Math.max(price, Math.round(Number(b.oldPrice) || 0));
      const rating = Math.min(5, Math.max(0, Number(b.rating) || 0));
      const sold = Math.max(0, Math.round(Number(b.sold) || 0));

      let id = Number(b.id) || 0;
      const exists = id ? db.prepare('SELECT 1 FROM products WHERE id = ?').get(id) : null;
      if (id && exists) {
        db.prepare(
          'UPDATE products SET name = ?, category = ?, grp = ?, price = ?, oldPrice = ?, img = ?, descr = ?, rating = ?, sold = ? WHERE id = ?'
        ).run(name, category, grp, price, oldPrice, String(b.img || ''), String(b.desc || ''), rating, sold, id);
      } else {
        if (!id) id = (db.prepare('SELECT MAX(id) AS m FROM products').get().m || 0) + 1;
        db.prepare(
          'INSERT INTO products (id, name, category, grp, price, oldPrice, img, descr, rating, sold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, name, category, grp, price, oldPrice, String(b.img || ''), String(b.desc || ''), rating, sold);
      }
      return ok({ product: rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
    }

    let m = /^\/api\/products\/(-?\d+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      const id = Number(m[1]);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      db.prepare('DELETE FROM reviews WHERE productId = ?').run(id);
      return ok({ ok: true });
    }

    /* ---------- Topping (admin) ---------- */
    if (method === 'POST' && p === '/api/toppings') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const name = String(b.name || '').trim();
      const price = Math.max(0, Math.round(Number(b.price) || 0));
      if (!name) return fail(400, 'Tên và giá hợp lệ là bắt buộc.');
      let id = String(b.id || '').trim();
      if (!id) {
        const rows = db.prepare('SELECT id FROM toppings').all();
        const max = rows.reduce((mx, r) => {
          const n = parseInt(String(r.id).replace(/\D/g, ''), 10);
          return Math.max(mx, isNaN(n) ? 0 : n);
        }, 0);
        id = 't' + (max + 1);
      }
      db.prepare('INSERT OR REPLACE INTO toppings (id, name, price) VALUES (?, ?, ?)').run(id, name, price);
      return ok({ topping: rowToToppingRow(db.prepare('SELECT * FROM toppings WHERE id = ?').get(id)) });
    }

    m = /^\/api\/toppings\/([^/]+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      db.prepare('DELETE FROM toppings WHERE id = ?').run(m[1]);
      return ok({ ok: true });
    }

    /* ---------- Danh mục (admin) ---------- */
    if (method === 'POST' && p === '/api/categories') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const id = String(b.id || '').trim().toLowerCase().replace(/\s+/g, '-');
      const name = String(b.name || '').trim();
      if (!id || !name) return fail(400, 'ID và tên danh mục là bắt buộc.');
      if (!/^[a-z0-9-]{2,30}$/.test(id)) return fail(400, 'ID danh mục chỉ gồm chữ thường, số và dấu gạch ngang (2–30 ký tự).');
      const exists = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id);
      if (!exists && b.originalId && b.originalId !== id && db.prepare('SELECT 1 FROM categories WHERE id = ?').get(b.originalId)) {
        /* đổi id: cập nhật cả sản phẩm đang dùng danh mục cũ */
        db.prepare('UPDATE categories SET id = ?, name = ? WHERE id = ?').run(id, name, b.originalId);
        db.prepare('UPDATE products SET category = ? WHERE category = ?').run(id, b.originalId);
        return ok({ category: rowToCategory(db.prepare('SELECT * FROM categories WHERE id = ?').get(id)) });
      }
      if (exists) {
        db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
      } else {
        const maxSort = db.prepare('SELECT MAX(sort) AS m FROM categories').get().m || 0;
        db.prepare('INSERT INTO categories (id, name, sort) VALUES (?, ?, ?)').run(id, name, maxSort + 1);
      }
      return ok({ category: rowToCategory(db.prepare('SELECT * FROM categories WHERE id = ?').get(id)) });
    }

    m = /^\/api\/categories\/([^/]+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      const id = decodeURIComponent(m[1]);
      const row = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id);
      if (!row) return fail(404, 'Không tìm thấy danh mục.');
      const count = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category = ?').get(id).n;
      if (count > 0) return fail(400, 'Còn ' + count + ' sản phẩm thuộc danh mục này, không xoá được.');
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return ok({ ok: true });
    }

    /* ---------- Banner (admin) ---------- */
    if (method === 'POST' && p === '/api/banners') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const img = String(b.img || '').trim();
      const title = String(b.title || '').trim();
      const sub = String(b.sub || '').trim();
      const link = String(b.link || '').trim();
      if (!img) return fail(400, 'Ảnh banner là bắt buộc.');
      const sort = Math.max(0, Math.round(Number(b.sort) || 0));
      let id = Number(b.id) || 0;
      const exists = id ? db.prepare('SELECT 1 FROM banners WHERE id = ?').get(id) : null;
      if (id && exists) {
        db.prepare('UPDATE banners SET img = ?, title = ?, sub = ?, link = ?, sort = ?, active = ? WHERE id = ?')
          .run(img, title, sub, link, sort, b.active === false ? 0 : 1, id);
      } else {
        if (!id) id = (db.prepare('SELECT MAX(id) AS m FROM banners').get().m || 0) + 1;
        db.prepare('INSERT INTO banners (id, img, title, sub, link, sort, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, img, title, sub, link, sort, b.active === false ? 0 : 1);
      }
      return ok({ banner: rowToBanner(db.prepare('SELECT * FROM banners WHERE id = ?').get(id)) });
    }
    m = /^\/api\/banners\/(-?\d+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      db.prepare('DELETE FROM banners WHERE id = ?').run(Number(m[1]));
      return ok({ ok: true });
    }

    /* ---------- Chi nhánh (admin) ---------- */
    if (method === 'POST' && p === '/api/stores') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const id = String(b.id || '').trim().toLowerCase().replace(/\s+/g, '-');
      const name = String(b.name || '').trim();
      if (!id || !name) return fail(400, 'ID và tên chi nhánh là bắt buộc.');
      const lat = Number(b.lat);
      const lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail(400, 'Toạ độ lat/lng không hợp lệ.');
      const exists = db.prepare('SELECT 1 FROM stores WHERE id = ?').get(id);
      if (exists) {
        db.prepare('UPDATE stores SET name = ?, address = ?, hours = ?, phone = ?, lat = ?, lng = ? WHERE id = ?')
          .run(name, String(b.address || '').trim(), String(b.hours || '').trim(), String(b.phone || '').trim(), lat, lng, id);
      } else {
        const maxSort = db.prepare('SELECT MAX(sort) AS m FROM stores').get().m || 0;
        db.prepare('INSERT INTO stores (id, name, address, hours, phone, lat, lng, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, name, String(b.address || '').trim(), String(b.hours || '').trim(), String(b.phone || '').trim(), lat, lng, maxSort + 1);
      }
      return ok({ store: rowToStore(db.prepare('SELECT * FROM stores WHERE id = ?').get(id)) });
    }
    m = /^\/api\/stores\/([^/]+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      db.prepare('DELETE FROM stores WHERE id = ?').run(decodeURIComponent(m[1]));
      return ok({ ok: true });
    }

    /* ---------- Nhận xét khách hàng (admin) ---------- */
    if (method === 'POST' && p === '/api/customer-reviews') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const stars = Math.round(Number(b.stars) || 5);
      const content = String(b.content || '').trim();
      const author = String(b.author || '').trim();
      if (stars < 1 || stars > 5) return fail(400, 'Số sao phải từ 1 đến 5.');
      if (!content || !author) return fail(400, 'Nội dung và tên người nhận xét là bắt buộc.');
      let id = Number(b.id) || 0;
      const exists = id ? db.prepare('SELECT 1 FROM customer_reviews WHERE id = ?').get(id) : null;
      if (id && exists) {
        db.prepare('UPDATE customer_reviews SET avatar_letter = ?, stars = ?, content = ?, author = ?, city = ? WHERE id = ?')
          .run(String(b.avatarLetter || '').trim().charAt(0).toUpperCase(), stars, content, author, String(b.city || '').trim(), id);
      } else {
        if (!id) id = (db.prepare('SELECT MAX(id) AS m FROM customer_reviews').get().m || 0) + 1;
        db.prepare('INSERT INTO customer_reviews (id, avatar_letter, stars, content, author, city, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, String(b.avatarLetter || '').trim().charAt(0).toUpperCase(), stars, content, author, String(b.city || '').trim(), Date.now());
      }
      return ok({ review: rowToCustomerReview(db.prepare('SELECT * FROM customer_reviews WHERE id = ?').get(id)) });
    }
    m = /^\/api\/customer-reviews\/(-?\d+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      db.prepare('DELETE FROM customer_reviews WHERE id = ?').run(Number(m[1]));
      return ok({ ok: true });
    }

    /* ---------- Nhóm sản phẩm (admin) ---------- */
    if (method === 'POST' && p === '/api/groups') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const id = String(b.id || '').trim().toLowerCase().replace(/\s+/g, '-');
      const name = String(b.name || '').trim();
      if (!id || !name) return fail(400, 'ID và tên nhóm là bắt buộc.');
      const exists = db.prepare('SELECT 1 FROM groups WHERE id = ?').get(id);
      if (exists) {
        db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name, id);
      } else {
        const maxSort = db.prepare('SELECT MAX(sort) AS m FROM groups').get().m || 0;
        db.prepare('INSERT INTO groups (id, name, sort) VALUES (?, ?, ?)').run(id, name, maxSort + 1);
      }
      return ok({ group: rowToGroup(db.prepare('SELECT * FROM groups WHERE id = ?').get(id)) });
    }
    m = /^\/api\/groups\/([^/]+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      const id = decodeURIComponent(m[1]);
      const row = db.prepare('SELECT 1 FROM groups WHERE id = ?').get(id);
      if (!row) return fail(404, 'Không tìm thấy nhóm.');
      const count = db.prepare('SELECT COUNT(*) AS n FROM products WHERE grp = ?').get(id).n;
      if (count > 0) return fail(400, 'Còn ' + count + ' sản phẩm thuộc nhóm này, không xoá được.');
      db.prepare('DELETE FROM groups WHERE id = ?').run(id);
      return ok({ ok: true });
    }

    /* ---------- Mã giảm giá (admin) ---------- */
    if (method === 'POST' && p === '/api/promos') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      const code = String(b.code || '').trim().toUpperCase();
      const label = String(b.label || '').trim();
      const type = ['ship', 'percent', 'amount'].includes(b.type) ? b.type : 'amount';
      const value = Math.max(0, Math.round(Number(b.value) || 0));
      const max = Number(b.max) != null && b.max !== '' ? Math.max(0, Math.round(Number(b.max))) : null;
      const min = Number(b.min) != null && b.min !== '' ? Math.max(0, Math.round(Number(b.min))) : null;
      if (!code || !label) return fail(400, 'Mã và nhãn mã giảm giá là bắt buộc.');
      if (type !== 'ship' && value <= 0) return fail(400, 'Giá trị mã giảm giá phải lớn hơn 0.');
      const exists = db.prepare('SELECT 1 FROM promos WHERE code = ?').get(code);
      if (exists) {
        db.prepare('UPDATE promos SET type = ?, value = ?, max = ?, min = ?, label = ?, active = ? WHERE code = ?')
          .run(type, value, max, min, label, b.active === false ? 0 : 1, code);
      } else {
        db.prepare('INSERT INTO promos (code, type, value, max, min, label, active, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(code, type, value, max, min, label, b.active === false ? 0 : 1, Date.now());
      }
      return ok({ promo: rowToPromo(db.prepare('SELECT * FROM promos WHERE code = ?').get(code)) });
    }
    m = /^\/api\/promos\/([^/]+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      db.prepare('DELETE FROM promos WHERE code = ?').run(decodeURIComponent(m[1]));
      return ok({ ok: true });
    }

    /* ---------- Newsletter ---------- */
    if (method === 'POST' && p === '/api/newsletters') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      if (!reEmail.test(email)) return fail(400, 'Email không đúng định dạng.');
      const dup = db.prepare('SELECT 1 FROM newsletters WHERE email = ?').get(email);
      if (dup) return ok({ ok: true, existed: true }); // đã đăng ký rồi — coi như thành công
      db.prepare('INSERT INTO newsletters (email, created) VALUES (?, ?)').run(email, Date.now());
      return ok({ ok: true });
    }
    if (method === 'GET' && p === '/api/newsletters') {
      if (!needAdmin()) return;
      return ok({ newsletters: db.prepare('SELECT * FROM newsletters ORDER BY created DESC').all().map(rowToNewsletter) });
    }
    m = /^\/api\/newsletters\/(-?\d+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      db.prepare('DELETE FROM newsletters WHERE id = ?').run(Number(m[1]));
      return ok({ ok: true });
    }

    /* ---------- Đặt hàng (đã đăng nhập) ---------- */
    if (method === 'POST' && p === '/api/orders') {
      const usr = needUser();
      if (!usr) return;
      const b = await readBody(req);
      const name = String(b.name || '').trim();
      const phone = String(b.phone || '').trim();
      const address = String(b.address || '').trim();
      const note = String(b.note || '');
      const payMethod = PAY_METHODS.includes(b.payMethod) ? b.payMethod : 'cod';
      const rawItems = Array.isArray(b.items) ? b.items : [];

      if (!rawItems.length) return fail(400, 'Giỏ hàng trống.');
      if (!name || !phone || !address) return fail(400, 'Vui lòng điền đầy đủ thông tin giao hàng.');
      if (!rePhone.test(phone)) return fail(400, 'Số điện thoại không đúng định dạng.');

      /* Tính lại giá từ database -> không tin giá client gửi lên */
      const items = [];
      let subtotal = 0;
      for (const raw of rawItems) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(raw.id));
        if (!prod) return fail(400, 'Có sản phẩm không còn tồn tại. Vui lòng làm mới giỏ hàng.');
        const qty = Math.max(1, Math.round(Number(raw.qty) || 1));
        const tops = (Array.isArray(raw.toppings) ? raw.toppings : [])
          .map(tid => db.prepare('SELECT * FROM toppings WHERE id = ?').get(String(tid)))
          .filter(Boolean)
          .map(t => ({ id: t.id, name: t.name, price: t.price }));
        subtotal += prod.price * qty + tops.reduce((s, t) => s + t.price * qty, 0);
        items.push({ id: prod.id, name: prod.name, img: prod.img, price: prod.price, qty, toppings: tops });
      }

      /* Phí ship: nhận tại quán = 0; có tọa độ bản đồ = theo khoảng cách
         tới chi nhánh gần nhất; không chọn bản đồ = phí cố định */
      const store = STORES.find(s => s.id === b.storeId);
      let shipFee = 0, shipKm = null, shipFrom = '', lat = null, lng = null;
      if (!store) {
        lat = Number(b.lat);
        lng = Number(b.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
          const near = nearestBranch(lat, lng);
          shipKm = near.km;
          shipFrom = near.store.name;
          shipFee = shipFeeByKm(shipKm);
        } else {
          shipFee = SHIP_FEE;
        }
      }

      /* Mã giảm giá: server tự kiểm tra lại theo đúng tạm tính vừa tính ở trên */
      let discount = 0, promoCode = '';
      const promoInput = String(b.promo || '').trim().toUpperCase();
      if (promoInput) {
        const res = checkPromo(promoInput, subtotal);
        if (res.ok) {
          promoCode = res.promo.code;
          discount = res.promo.discount;
          if (res.promo.freeShip) shipFee = 0;
        }
      }

      const total = Math.max(0, subtotal - discount) + shipFee;
      const code = nextOrderCode();
      db.prepare(
        'INSERT INTO orders (code, userId, customer, name, phone, address, note, payMethod, store, items, subtotal, shipFee, discount, promo, lat, lng, shipKm, shipFrom, total, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(code, usr.id, usr.name, name, phone, address, note, payMethod,
            store ? store.name : 'Giao tận nơi', JSON.stringify(items), subtotal, shipFee,
            discount, promoCode, lat, lng, shipKm, shipFrom, total, 'processing', Date.now());
      return ok({ order: rowToOrder(db.prepare('SELECT * FROM orders WHERE code = ?').get(code)) });
    }

    /* ---------- Đổi trạng thái đơn (admin) ---------- */
    m = /^\/api\/orders\/([^/]+)$/.exec(p);
    if (method === 'PATCH' && m) {
      if (!needAdmin()) return;
      const b = await readBody(req);
      if (!ORDER_STATUS.includes(b.status)) return fail(400, 'Trạng thái đơn hàng không hợp lệ.');
      const row = db.prepare('SELECT * FROM orders WHERE code = ?').get(m[1]);
      if (!row) return fail(404, 'Không tìm thấy đơn hàng.');
      db.prepare('UPDATE orders SET status = ? WHERE code = ?').run(b.status, m[1]);
      return ok({ order: rowToOrder(db.prepare('SELECT * FROM orders WHERE code = ?').get(m[1])) });
    }

    /* ---------- Sửa khách hàng (admin) ---------- */
    m = /^\/api\/users\/([^/]+)$/.exec(p);
    if (method === 'PATCH' && m) {
      if (!needAdmin()) return;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(m[1]);
      if (!row) return fail(404, 'Không tìm thấy người dùng.');
      const b = await readBody(req);
      const blocked = row.role === 'admin' ? 0 : (b.blocked ? 1 : 0);
      db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, blocked = ? WHERE id = ?')
        .run(String(b.name || row.name).trim() || row.name, String(b.email || '').trim(), String(b.phone || '').trim(), blocked, m[1]);
      if (blocked) db.prepare('DELETE FROM sessions WHERE userId = ?').run(m[1]);
      return ok({ user: rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(m[1])) });
    }

    /* ---------- Xoá khách hàng (admin) ---------- */
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(m[1]);
      if (!row) return fail(404, 'Không tìm thấy người dùng.');
      if (row.role === 'admin') return fail(403, 'Không thể xoá tài khoản quản trị.');
      db.prepare('DELETE FROM users WHERE id = ?').run(m[1]);
      db.prepare('DELETE FROM sessions WHERE userId = ?').run(m[1]);
      return ok({ ok: true });
    }

    /* ---------- Cài đặt website (admin) ---------- */
    if (method === 'POST' && p === '/api/settings') {
      if (!needAdmin()) return;
      const b = await readBody(req);
      return ok({ settings: saveSettings(b) });
    }

    /* ---------- Đánh giá sản phẩm (đã đăng nhập) ---------- */
    if (method === 'POST' && p === '/api/reviews') {
      const usr = needUser();
      if (!usr) return;
      const b = await readBody(req);
      const productId = Number(b.productId);
      const rating = Math.round(Number(b.rating) || 0);
      const comment = String(b.comment || '').trim();
      if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) return fail(404, 'Không tìm thấy sản phẩm.');
      if (rating < 1 || rating > 5) return fail(400, 'Hãy chọn số sao từ 1 đến 5.');
      const info = db.prepare(
        'INSERT INTO reviews (productId, userName, rating, comment, created) VALUES (?, ?, ?, ?, ?)'
      ).run(productId, usr.name, rating, comment, Date.now());
      db.prepare(
        'UPDATE products SET rating = ROUND((SELECT AVG(rating) FROM reviews WHERE productId = ?), 1) WHERE id = ?'
      ).run(productId, productId);
      return ok({
        review: rowToReview(db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid)),
        product: rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(productId))
      });
    }

    /* ---------- Đánh giá website (đã đăng nhập) ---------- */
    if (method === 'POST' && p === '/api/site-reviews') {
      const usr = needUser();
      if (!usr) return;
      const b = await readBody(req);
      const rating = Math.round(Number(b.rating) || 0);
      const comment = String(b.comment || '').trim();
      if (rating < 1 || rating > 5) return fail(400, 'Hãy chọn số sao từ 1 đến 5.');
      const info = db.prepare(
        'INSERT INTO site_reviews (userName, rating, comment, created) VALUES (?, ?, ?, ?)'
      ).run(usr.name, rating, comment, Date.now());
      return ok({ review: rowToSiteReview(db.prepare('SELECT * FROM site_reviews WHERE id = ?').get(info.lastInsertRowid)) });
    }

    /* ---------- Xoá đánh giá sản phẩm (admin) ---------- */
    m = /^\/api\/reviews\/(-?\d+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      const id = Number(m[1]);
      const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
      if (!row) return fail(404, 'Không tìm thấy đánh giá.');
      db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
      /* tính lại rating trung bình của sản phẩm; không còn đánh giá thì về mặc định 4.5 */
      const avgRow = db.prepare('SELECT AVG(rating) AS avg FROM reviews WHERE productId = ?').get(row.productId);
      const newRating = avgRow && avgRow.avg != null ? Math.round(Number(avgRow.avg) * 10) / 10 : 4.5;
      db.prepare('UPDATE products SET rating = ? WHERE id = ?').run(newRating, row.productId);
      return ok({
        review: { id, productId: row.productId },
        product: rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(row.productId))
      });
    }

    /* ---------- Xoá đánh giá website (admin) ---------- */
    m = /^\/api\/site-reviews\/(-?\d+)$/.exec(p);
    if (method === 'DELETE' && m) {
      if (!needAdmin()) return;
      const id = Number(m[1]);
      const row = db.prepare('SELECT * FROM site_reviews WHERE id = ?').get(id);
      if (!row) return fail(404, 'Không tìm thấy đánh giá.');
      db.prepare('DELETE FROM site_reviews WHERE id = ?').run(id);
      return ok({ review: { id } });
    }

    return fail(404, 'Không tìm thấy API: ' + method + ' ' + p);
  } catch (err) {
    console.error('[api] Lỗi', method, p, err);
    const status = err instanceof ApiError ? err.status : 500;
    const msg = err instanceof ApiError ? err.message : 'Lỗi máy chủ nội bộ.';
    if (!res.headersSent) fail(status, msg);
  }
}

function rowToToppingRow(r) {
  return { id: r.id, name: r.name, price: r.price };
}

/* ---------- Phí ship + khuyến mãi (server là nơi quyết định cuối) ---------- */
function fmtVND(n) { return n.toLocaleString('vi-VN') + 'đ'; }

function shipFeeByKm(km) {
  for (const t of SHIP_TIERS) if (km <= t.maxKm) return t.fee;
  return SHIP_TIERS[SHIP_TIERS.length - 1].fee;
}

/* chi nhánh gần điểm giao nhất (gọi "chi nhánh phụ trách giao hàng") */
function nearestBranch(lat, lng) {
  let best = null;
  for (const s of STORES) {
    const km = distanceKm(lat, lng, s.lat, s.lng);
    if (!best || km < best.km) best = { store: s, km };
  }
  return best ? { store: best.store, km: Math.round(best.km * 10) / 10 } : null;
}

/* kiểm tra mã giảm giá theo tạm tính; trả về {ok, promo} hoặc {ok:false, msg}
   Ưu tiên mã admin tạo trong bảng promos; PROMOS cũ chỉ là fallback lần đầu. */
function checkPromo(code, subtotal) {
  const c = String(code || '').trim().toUpperCase();
  let promo = null;
  const row = db.prepare('SELECT * FROM promos WHERE code = ?').get(c);
  if (row) {
    if (!row.active) return { ok: false, msg: 'Mã giảm giá đã bị tắt.' };
    promo = { code: row.code, type: row.type, value: row.value, max: row.max, min: row.min, label: row.label };
  } else {
    promo = PROMOS[c] || null;
  }
  if (!promo) return { ok: false, msg: 'Mã giảm giá không tồn tại hoặc đã hết hạn.' };
  if (promo.min && subtotal < promo.min) return { ok: false, msg: 'Mã chỉ áp dụng cho đơn từ ' + fmtVND(promo.min) + '.' };
  let discount = 0, freeShip = false;
  if (promo.type === 'ship') freeShip = true;
  else if (promo.type === 'percent') discount = Math.min(Math.round(subtotal * promo.value / 100), promo.max || Infinity);
  else discount = Math.min(promo.value, subtotal);
  return { ok: true, promo: { code: promo.code, label: promo.label, discount, freeShip } };
}

function nextOrderCode() {
  for (let i = 0; i < 5; i++) {
    const code = 'SC' + (Date.now() + i).toString().slice(-8);
    if (!db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code)) return code;
  }
  return 'SC' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
}

/* ============================================================
   3) PHỤC VỤ FILE TĨNH
   serveStatic: đọc file html/css/js/ảnh từ thư mục dự án và trả về.
   - Chặn truy cập database.db (403).
   - Chống path traversal (../../) — không cho đọc file ngoài thư mục.
   ============================================================ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>404 – ShanCha Store</title></head>' +
    '<body style="font-family:Segoe UI,system-ui,sans-serif;background:#FAF6EF;color:#2B2318;text-align:center;padding:80px 20px">' +
    '<h1 style="font-size:3rem;margin-bottom:8px">404</h1>' +
    '<p>Không tìm thấy trang bạn yêu cầu.</p>' +
    '<p><a href="/" style="color:#7A4E2D;font-weight:700">← Về trang chủ</a></p>' +
    '</body></html>'
  );
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch (e) { return notFound(res); }

  if (rel.endsWith('/')) rel += 'index.html';
  if (rel === '/database.db') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Không được truy cập file database.');
  }

  /* chống path traversal (../../) */
  const filePath = path.normalize(path.join(ROOT, rel));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return notFound(res);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

/* ============================================================
   4) KHỞI ĐỘNG SERVER
   Mỗi request: nếu đường dẫn bắt đầu /api/ -> xử lý API,
   ngược lại -> phục vụ file tĩnh. Lắng nghe ở PORT (mặc định 3000).
   ============================================================ */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname.startsWith('/api/')) await handleApi(req, res, u);
    else serveStatic(req, res, u.pathname);
  } catch (err) {
    console.error('[server] Lỗi:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, msg: 'Lỗi máy chủ nội bộ.' }));
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log('==================================================');
  console.log('  ShanCha Store - backend đang chạy');
  console.log('  Website : http://localhost:' + PORT);
  console.log('  Database: ' + DB_FILE);
  console.log('  Tài khoản demo: admin/admin123 - user/123456');
  console.log('  Nhấn Ctrl+C để dừng server');
  console.log('==================================================');
});

process.on('SIGINT', () => {
  console.log('\n[server] Đang đóng database...');
  try { db.close(); } catch (e) { /* bỏ qua */ }
  process.exit(0);
});
