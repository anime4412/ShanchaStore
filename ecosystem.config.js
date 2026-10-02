/* ============================================================
   ShanChaStore - ecosystem.config.js
   Cấu hình PM2 để chạy production: tự restart khi crash,
   ghi log ra logs/, theo dõi uptime.
   Cách dùng:  npm i -g pm2
               pm2 start ecosystem.config.js
               pm2 save && pm2 startup
   ============================================================ */
module.exports = {
  apps: [
    {
      name: 'shancha-store',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,                 // SQLite -> chạy 1 instance
      exec_mode: 'fork',
      max_memory_restart: '400M',   // tự restart nếu rò rỉ bộ nhớ
      autorestart: true,            // tự restart khi crash
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
