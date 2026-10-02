/* ============================================================
   ShanChaStore - tools/backup.js
   Backup database.sqlite: sao chép database.db
   vào backups/database-YYYY-MM-DD-HHmm.db, giữ N bản gần nhất.
   Cách dùng: node tools/backup.js   (hoặc npm run backup)
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB = path.join(ROOT, 'database.db');
const DIR = path.join(ROOT, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP) || 15;

if (!fs.existsSync(DB)) {
  console.error('[backup] Không tìm thấy database.db — bỏ qua.');
  process.exit(1);
}
fs.mkdirSync(DIR, { recursive: true });

function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}
const dest = path.join(DIR, 'database-' + ts() + '.db');
fs.copyFileSync(DB, dest);
console.log('[backup] Đã sao lưu:', dest);

// xoá backup cũ
fs.readdirSync(DIR)
  .filter(f => /^database-.*\.db$/.test(f))
  .sort()
  .reverse()
  .slice(KEEP)
  .forEach(f => { fs.unlinkSync(path.join(DIR, f)); console.log('[backup] Xoá backup cũ:', f); });