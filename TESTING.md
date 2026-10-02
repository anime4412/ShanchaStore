# TESTING.md — Checklist kiểm thử ShanChaStore (PHASE 31)

> Sau khi nâng cấp lên bản production (2.0). Mỗi nhóm test xong đánh dấu ☑.
> Chạy server: `node server.js` rồi mở http://localhost:3000 (Ctrl+F5 để nạp lại JS).

## 1. KHÁCH HÀNG (Customer)

| # | Kịch bản | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| C1 | Đăng ký tài khoản mới | Tạo thành công, tự đăng nhập | ☐ |
| C2 | Đăng nhập bằng email / username | Vào được trang chủ | ☐ |
| C3 | Đăng xuất | Xoá token, về index | ☐ |
| C4 | Xem sản phẩm / lọc / tìm / sắp xếp | Không lỗi JS | ☐ |
| C5 | Thêm giỏ (topping thuộc sản phẩm) | Giỏ tăng đúng | ☐ |
| C6 | Sửa topping / số lượng | Tổng tiền đúng | ☐ |
| C7 | Checkout pickup | Phí ship = 0 | ☐ |
| C8 | Checkout delivery | Phí ship 15.000đ / theo km | ☐ |
| C9 | Áp mã giảm giá | Giảm đúng | ☐ |
| C10 | Lịch sử đơn (7 trạng thái mới) | Hiển thị đúng | ☐ |
| C11 | Hủy đơn ở PENDING/CONFIRMED | Thành công | ☐ |
| C12 | Hủy đơn ở DELIVERING/COMPLETED | Bị chặn | ☐ |
| C13 | Đánh giá SP chưa mua | Bị chặn (403) | ☐ |
| C14 | Đánh giá SP sau khi đơn hoàn thành | Thành công | ☐ |
| C15 | Đánh giá website | Thành công | ☐ |
| C16 | Newsletter | Không lộ ra bootstrap | ☐ |

## 2. STAFF

| # | Kịch bản | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| S1 | Admin đổi role → STAFF | Thấy Đơn hàng + Dashboard | ☐ |
| S2 | Staff cập nhật trạng thái đơn | Theo state machine | ☐ |
| S3 | Staff bật/tắt sản phẩm | Server chặn đặt hàng khi tắt | ☐ |
| S4 | Staff không quản lý được SP/DM/Topping/KH/Cài đặt | Nút ẩn, API → 403 | ☐ |
| S5 | Staff cập nhật payment status | Hiển thị "Đã thanh toán" | ☐ |

## 3. ADMIN

| # | Kịch bản | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| A1 | Đăng nhập admin | Dashboard KPI đúng | ☐ |
| A2 | CRUD SP + toggle Hết hàng + gán topping | Audit ghi nhận | ☐ |
| A3 | CRUD danh mục | Chặn xoá khi còn SP | ☐ |
| A4 | CRUD topping | Topping mới tự gắn | ☐ |
| A5 | Đơn: tìm + lọc + phân trang + đổi trạng thái | Transition sai bị chặn | ☐ |
| A6 | Đánh giá: duyệt / ẩn / xoá | Review ẩn không hiện | ☐ |
| A7 | Khách hàng: khoá / đổi role | Không đổi được admin | ☐ |
| A8 | Cài đặt website | Lưu vĩnh viễn | ☐ |
| A9 | Nhật ký hệ thống (Audit) | Hiển thị đúng | ☐ |
| A10 | Dashboard | Số liệu chính xác | ☐ |

## 4. BẢO MẬT

| # | Kịch bản | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| SEC1 | SQL Injection | Không đăng nhập được | ☐ |
| SEC2 | XSS trong comment | Hiển thị dạng text | ☐ |
| SEC3 | Path traversal | 404 / 403 | ☐ |
| SEC4 | database.db / .bak / .env / backups/ / logs/ | 403 | ☐ |
| SEC5 | Sửa giá browser | Server bỏ qua, tính lại | ☐ |
| SEC6 | Gửi status=completed khi tạo đơn | Luôn pending | ☐ |
| SEC7 | Gửi payment_status=paid | Bị từ chối | ☐ |
| SEC8 | Xem đơn người khác | 403 | ☐ |
| SEC9 | Upload file độc / ảnh giả | Từ chối | ☐ |
| SEC10 | Brute-force login | 429 | ☐ |
| SEC11 | google-login-demo | 404 | ☐ |
| SEC12 | Security headers | Có CSP etc. | ☐ |
| SEC13 | Bootstrap không lộ newsletters | OK | ☐ |
| SEC14 | Lỗi 500 không lộ stack | OK | ☐ |

## 5. DỮ LIỆU (migration giữ nguyên)

| # | Kiểm tra | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| D1 | Đơn cũ SC46628155 | done → completed, items đủ | ☐ |
| D2 | order_items snapshot giá cũ | Giá không đổi | ☐ |
| D3 | Chạy lại server 2 lần | Idempotent | ☐ |
| D4 | Backup trước migration | File premigration tồn tại | ☐ |
