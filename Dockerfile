# ============================================================
#   ShanChaStore - Dockerfile
#   Dựng image chạy backend (Node.js thuần + SQLite, zero npm dep).
#   Cách dùng đơn giản nhất: docker compose up -d (xem docker-compose.yml)
# ============================================================
FROM node:22-slim

WORKDIR /app

# Copy toàn bộ mã nguồn (loại trừ .dockerignore)
COPY . .

# Dữ liệu (DB + ảnh upload) nằm trong /app/data để mount volume
ENV DATABASE_PATH=/app/data/database.db
ENV UPLOAD_DIR=/app/data/uploads
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Không có dependency ngoài npm; chỉ cần chạy server
CMD ["node", "server.js"]
