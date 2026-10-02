/* ============================================================
   ShanChaStore - tools/smoke-test.js
   Kiểm thử nhanh trước khi deploy: khởi server thật ở cổng ngẫu
   nhiên (DB tạm, không đụng dữ liệu thật), gọi /api/health và
   /api/bootstrap, xác minh có sản phẩm, rồi tắt server.

   Chạy:  npm test   (hoặc)   node tools/smoke-test.js
   Exit 0 = OK, exit 1 = FAIL.
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PORT = 3100 + Math.floor(Math.random() * 2000);
const TMP_DB = path.join(os.tmpdir(), `shancha-smoke-${process.pid}.db`);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`[smoke] khởi động server test ở cổng ${PORT} (DB tạm: ${TMP_DB})`);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATABASE_PATH: TMP_DB,
      UPLOAD_DIR: path.join(os.tmpdir(), `shancha-smoke-uploads-${process.pid}`),
      ADMIN_PASSWORD: 'smoke-test-pass-1',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });

  try {
    /* chờ server lên (tối đa 20 giây) */
    let health = null;
    for (let i = 0; i < 40; i++) {
      try {
        health = await fetchJson(`http://127.0.0.1:${PORT}/api/health`);
        if (health.status === 200) break;
      } catch (e) { /* chưa lên */ }
      await sleep(500);
    }
    if (!health || health.status !== 200) {
      console.error('[smoke] FAIL: server không phản hồi /api/health.');
      console.error(logs.slice(-2000));
      process.exitCode = 1;
      return;
    }
    console.log('[smoke] OK  /api/health ->', JSON.stringify(health.data));

    /* bootstrap phải có sản phẩm (seed tự chạy trên DB mới) */
    const boot = await fetchJson(`http://127.0.0.1:${PORT}/api/bootstrap`);
    const n = Array.isArray(boot.data.products) ? boot.data.products.length : 0;
    if (boot.status !== 200 || n < 1) {
      console.error('[smoke] FAIL: /api/bootstrap không trả sản phẩm (status=' + boot.status + ', products=' + n + ')');
      process.exitCode = 1;
      return;
    }
    console.log(`[smoke] OK  /api/bootstrap -> ${n} sản phẩm`);

    /* thử luồng login admin với ADMIN_PASSWORD từ env */
    const login = await fetchJson(`http://127.0.0.1:${PORT}/api/login`).catch(() => null);
    // không bắt buộc — chỉ in thông tin nếu lỗi khác 404

    console.log('[smoke] PASS ✅  server chạy, health + bootstrap OK.');
  } catch (err) {
    console.error('[smoke] FAIL:', err.message);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    await sleep(800);
    try { fs.rmSync(TMP_DB, { force: true }); } catch (e) { /* bỏ qua */ }
    try { fs.rmSync(path.join(os.tmpdir(), `shancha-smoke-uploads-${process.pid}`), { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  }
}

main();
