/* ============================================================
   ShanChaStore - js/db-schema.js
   ============================================================
   Schema + MIGRATION cho database SQLite.

   QUY TẮC (theo prompt PHASE 32):
   - KHÔNG xoá bảng cũ, KHÔNG xoá dữ liệu.
   - Mọi thay đổi cấu trúc đều chạy qua migration an toàn:
       * ALTER TABLE ADD COLUMN (có try/catch "cột đã tồn tại")
       * Tạo bảng mới bằng CREATE TABLE IF NOT EXISTS
       * Copy dữ liệu cũ vào bảng mới khi cần đổi cấu trúc
       * Ánh xạ trạng thái đơn cũ -> state machine 7 bước
   - Chạy lại nhiều lần vẫn an toàn (idempotent).

   Bảng mới thêm:
   - product_toppings : topping thuộc sản phẩm (PHASE 9)
   - order_items      : snapshot đơn hàng chuẩn hoá (PHASE 2)
   - order_item_toppings : snapshot topping của từng dòng (PHASE 2)
   - audit_logs       : truy vết hành động admin/staff (PHASE 25)
   - uploads          : theo dõi file ảnh đã upload (PHASE 10)

   Cột mới thêm (giữ nguyên cột cũ):
   - users.status, users.updated_at            (PHASE 2)
   - products.is_available                     (PHASE 21)
   - orders.delivery_method, orders.payment_status (PHASE 2, 20)
   - reviews.user_id, reviews.order_id, reviews.status (PHASE 17)
   - site_reviews.user_id, site_reviews.status (PHASE 17)
   ============================================================ */
'use strict';

const path = require('path');

/* Trạng thái đơn hàng: state machine 7 bước (PHASE 5).
   Dùng dạng chữ thường, gạch dưới cho khớp với DB hiện có
   (processing/delivering/done/cancelled). */
const ORDER_STATUS = ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'];
const PAYMENT_STATUS = ['pending', 'paid', 'failed', 'refunded'];
const REVIEW_STATUS = ['pending', 'approved', 'hidden'];
const ROLES = ['customer', 'staff', 'admin'];

/* Bản đồ trạng thái cũ -> mới (migration dữ liệu) */
const ORDER_STATUS_MAP = {
  processing: 'pending',
  delivering: 'delivering',
  done: 'completed',
  cancelled: 'cancelled'
};

function migrate(db, ROOT) {
  /* ---------- Bảng cũ: tạo nếu chưa có (giữ nguyên cấu trúc) ---------- */
  db.exec(`
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
      created   INTEGER NOT NULL,
      discount  INTEGER NOT NULL DEFAULT 0,
      promo     TEXT DEFAULT '',
      lat       REAL,
      lng       REAL,
      shipKm    REAL,
      shipFrom  TEXT DEFAULT ''
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
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      img    TEXT NOT NULL,
      title  TEXT DEFAULT '',
      sub    TEXT DEFAULT '',
      link   TEXT DEFAULT '',
      sort   INTEGER DEFAULT 0,
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
      code    TEXT PRIMARY KEY,
      type    TEXT NOT NULL,
      value   REAL NOT NULL DEFAULT 0,
      max     REAL,
      min     REAL,
      label   TEXT DEFAULT '',
      active  INTEGER NOT NULL DEFAULT 1,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS newsletters (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      email   TEXT NOT NULL UNIQUE,
      created INTEGER NOT NULL
    );
  `);

  /* ---------- Bảng MỚI ---------- */
  db.exec(`
    /* Topping gắn với sản phẩm (PHASE 9) */
    CREATE TABLE IF NOT EXISTS product_toppings (
      product_id INTEGER NOT NULL,
      topping_id TEXT NOT NULL,
      PRIMARY KEY (product_id, topping_id)
    );

    /* Snapshot dòng đơn hàng (PHASE 2) — giữ giá tại thời điểm đặt */
    CREATE TABLE IF NOT EXISTS order_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     TEXT NOT NULL,
      product_id   INTEGER,
      product_name TEXT NOT NULL,
      unit_price   INTEGER NOT NULL,
      quantity     INTEGER NOT NULL DEFAULT 1,
      subtotal     INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_item_toppings (
      order_item_id INTEGER NOT NULL,
      topping_name  TEXT NOT NULL,
      topping_price INTEGER NOT NULL,
      quantity      INTEGER NOT NULL DEFAULT 1
    );

    /* Truy vết hành động admin/staff (PHASE 25) */
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      username    TEXT DEFAULT '',
      action      TEXT NOT NULL,
      target_type TEXT DEFAULT '',
      target_id   TEXT DEFAULT '',
      details     TEXT DEFAULT '',
      ip          TEXT DEFAULT '',
      created     INTEGER NOT NULL
    );

    /* Theo dõi file đã upload (PHASE 10) */
    CREATE TABLE IF NOT EXISTS uploads (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      filename  TEXT NOT NULL,
      kind      TEXT DEFAULT 'product',
      size      INTEGER NOT NULL DEFAULT 0,
      created   INTEGER NOT NULL
    );
  `);

  /* ---------- ALTER TABLE: thêm cột mới (an toàn chạy lại) ---------- */
  const addCol = (table, col) => {
    try { db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + col); }
    catch (e) { /* cột đã tồn tại */ }
  };

  /* users: status + updated_at (PHASE 2) */
  addCol('users', 'status TEXT NOT NULL DEFAULT \'active\'');
  addCol('users', 'updated_at INTEGER');

  /* products: còn bán / hết nguyên liệu (PHASE 21) */
  addCol('products', 'is_available INTEGER NOT NULL DEFAULT 1');

  /* orders: delivery_method + payment_status (PHASE 2, 20) */
  addCol('orders', 'delivery_method TEXT NOT NULL DEFAULT \'delivery\'');
  addCol('orders', 'payment_status TEXT NOT NULL DEFAULT \'pending\'');

  /* reviews: gắn user + đơn + moderation (PHASE 17) */
  addCol('reviews', 'user_id TEXT DEFAULT \'\'');
  addCol('reviews', 'order_id TEXT DEFAULT \'\'');
  addCol('reviews', 'status TEXT NOT NULL DEFAULT \'pending\'');

  /* site_reviews: gắn user + moderation (PHASE 17) */
  addCol('site_reviews', 'user_id TEXT DEFAULT \'\'');
  addCol('site_reviews', 'status TEXT NOT NULL DEFAULT \'pending\'');

  /* ---------- Migration DỮ LIỆU ---------- */

  /* 1) Ánh xạ trạng thái đơn cũ -> 7 bước mới */
  const st = db.prepare('SELECT code, status FROM orders');
  const upd = db.prepare('UPDATE orders SET status = ? WHERE code = ?');
  const tx = db.prepare('BEGIN');
  try {
    tx.run();
    for (const r of st.all()) {
      const next = ORDER_STATUS_MAP[r.status];
      if (next && next !== r.status) upd.run(next, r.code);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  /* 2) Tách items JSON cũ (orders.items) thành bảng order_items + order_item_toppings
        CHỈ chạy cho đơn chưa có dòng trong order_items (chống trùng khi chạy lại) */
  const orderRows = db.prepare('SELECT code, items FROM orders').all();
  const countItemsByOrder = (code) => db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?').get(code);
  const insItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insTopping = db.prepare(
    'INSERT INTO order_item_toppings (order_item_id, topping_name, topping_price, quantity) VALUES (?, ?, ?, ?)'
  );
  let migrated = 0;
  for (const o of orderRows) {
    if ((countItemsByOrder(o.code) || {}).n > 0) continue; // đã có snapshot
    let items = [];
    try { items = JSON.parse(o.items); } catch (e) { items = []; }
    for (const it of items) {
      const qty = Math.max(1, Number(it.qty) || 1);
      const price = Math.max(0, Number(it.price) || 0);
      const info = insItem.run(o.code, it.id || null, String(it.name || 'Sản phẩm'), price, qty, price * qty);
      for (const t of (it.toppings || [])) {
        insTopping.run(info.lastInsertRowid, String(t.name || 'Topping'), Math.max(0, Number(t.price) || 0), qty);
      }
    }
    migrated++;
  }

  /* 3) Seed product_toppings: gắn TẤT CẢ topping hiện có cho mọi sản phẩm đang bán
        (hành vi cũ cho phép chọn mọi topping; admin có thể bỏ sau). */
  if (db.prepare('SELECT COUNT(*) AS n FROM product_toppings').get().n === 0) {
    const insPT = db.prepare('INSERT OR IGNORE INTO product_toppings (product_id, topping_id) VALUES (?, ?)');
    const tops = db.prepare('SELECT id FROM toppings').all();
    const prods = db.prepare('SELECT id FROM products').all();
    const ins = db.prepare('BEGIN');
    try {
      ins.run();
      for (const p of prods) for (const t of tops) insPT.run(p.id, t.id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  /* 4) Chuẩn hoá role cũ: nếu DB cũ chỉ có customer/admin thì không cần đổi.
        (role staff sẽ được cấp qua admin — không seed sẵn để tránh tài khoản lạ.) */

  /* 5) Index cho hiệu năng (PHASE 26) */
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(productId)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)'); } catch (e) {}

  return {
    ORDER_STATUS,
    PAYMENT_STATUS,
    REVIEW_STATUS,
    ROLES,
    migratedOrders: migrated
  };
}

module.exports = { migrate, ORDER_STATUS, PAYMENT_STATUS, REVIEW_STATUS, ROLES };
