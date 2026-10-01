# ShanCha Store – Website bán trà (Vanilla JavaScript + Backend Node.js/SQLite)

Website bán trà sữa / trà / cà phê xây dựng hoàn toàn bằng **JavaScript thuần (Vanilla JS)**,
HTML, CSS — **không framework, không thư viện ngoài**.

Dự án thực hiện **Assignment WEB1044 – Lập trình cơ sở với JavaScript** (FPT Polytechnic),
giao diện lấy cảm hứng từ shancha.vn (thương hiệu trà Việt) nhưng được thiết kế lại với nội dung riêng.

Website giờ đây có **backend thật**: một server Node.js thuần (`server.js`, chỉ dùng module có sẵn
của Node, không cần `npm install`) phục vụ trang tĩnh + **REST API** và lưu dữ liệu vào file
**SQLite** (`database.db`). Mật khẩu được hash bằng **scrypt + salt**, không còn lưu plaintext.

---

## 🚀 Cách chạy

### Bước 1 – Chạy server (bắt buộc)

Mở Terminal tại thư mục dự án rồi chạy:

```bash
node server.js
```

> Yêu cầu **Node.js ≥ 22.5** (đã có sẵn `node:sqlite`). Không cần `npm install` gì cả.
> Lần chạy đầu, server **tự tạo file `database.db`** và tự nạp dữ liệu mẫu (tài khoản, sản phẩm, topping).

### Bước 2 – Mở trình duyệt

Mở **http://localhost:3000** — mọi tính năng (đăng nhập, giỏ hàng, đặt hàng, admin…) đều chạy
qua API thật; dữ liệu được lưu trong `database.db`, **tắt máy/restart server không mất dữ liệu**.

> Nếu mở `index.html` trực tiếp (file://) hoặc server chưa chạy, trang sẽ báo
> "Không kết nối được máy chủ" và hướng dẫn chạy lại `node server.js`.

> Sau khi sửa code frontend, bấm **Ctrl+F5** (reload cứng) để nạp lại JavaScript.

---

## 👤 Tài khoản demo

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| **Admin** (quản trị) | `admin` | `admin123` |
| **Khách hàng** | `user` | `123456` |

Hoặc tự **đăng ký** tài khoản mới trên trang Đăng nhập.

---

## 📄 Cấu trúc thư mục (đúng Y2)

```
ShanchaStore/
├── server.js           # Backend: HTTP server + REST API + SQLite (Node thuần, 0 dependency)
├── database.db         # File SQLite (tự tạo khi chạy server, đã git-ignore)
├── index.html          # Trang chủ: slider, 3 nhóm SP, flash sale, chi nhánh, media
├── products.html       # Trang danh mục: lọc, tìm kiếm, sắp xếp
├── login.html          # Đăng nhập / Đăng ký (validate)
├── checkout.html       # Thanh toán (bắt buộc đăng nhập)
├── admin-login.html   # Đăng nhập riêng cho quản trị viên
├── admin.html          # Trang quản trị website
├── css/
│   ├── style.css       # Giao diện chung
│   └── admin.css       # Giao diện trang admin
├── js/
│   ├── data.js         # Dữ liệu mẫu (sản phẩm, danh mục, chi nhánh, topping) — server dùng để seed DB
│   ├── store.js        # Lớp dữ liệu client: gọi REST API, cache dữ liệu, giỏ hàng localStorage
│   ├── auth.js         # Đăng ký / đăng nhập / đăng xuất / phân quyền (gọi API)
│   ├── cart.js         # Giỏ hàng + đặt hàng (gate đăng nhập, server tính lại giá)
│   ├── ui.js           # Header, footer, toast, drawer giỏ hàng, modal sản phẩm
│   ├── main.js         # Trang chủ: slider, tabs SP, countdown, geolocation, media
│   ├── products.js     # Trang danh mục: lọc/tìm/sort
│   ├── login.js        # Xử lý form đăng nhập/đăng ký
│   ├── checkout.js     # Xử lý thanh toán
│   ├── admin-login.js # Đăng nhập quản trị riêng (chỉ admin)
│   └── admin.js        # Dashboard, CRUD sản phẩm, quản lý đơn hàng, khách hàng
└── assets/images/      # Ảnh SVG tự sinh (sản phẩm, banner, story) – offline
```

### REST API của server.js

| Method + Endpoint | Quyền | Chức năng |
|---|---|---|
| `GET /api/bootstrap` | công khai | products, settings, toppings, reviews, site reviews |
| `POST /api/register` | công khai | tạo tài khoản (scrypt hash) + trả token phiên |
| `POST /api/login` | công khai | đăng nhập (email hoặc tên đăng nhập), trả token phiên |
| `POST /api/logout` | đã đăng nhập | huỷ phiên |
| `GET /api/me` | token | thông tin người dùng hiện tại |
| `POST /api/orders` | đã đăng nhập | đặt hàng (server tính lại giá từ DB) |
| `POST /api/reviews` | đã đăng nhập | đánh giá sản phẩm (server cập nhật lại rating) |
| `DELETE /api/reviews/:id` | admin | xoá đánh giá sản phẩm + tính lại rating |
| `POST /api/site-reviews` | đã đăng nhập | đánh giá website |
| `DELETE /api/site-reviews/:id` | admin | xoá đánh giá website |
| `POST /api/categories` | admin | thêm/sửa danh mục sản phẩm |
| `DELETE /api/categories/:id` | admin | xoá danh mục (chặn nếu còn sản phẩm) |
| `POST /api/banners` + `DELETE /api/banners/:id` | admin | quản lý banner slider trang chủ |
| `POST /api/stores` + `DELETE /api/stores/:id` | admin | quản lý chi nhánh (dùng cho bản đồ + phí ship) |
| `POST /api/customer-reviews` + `DELETE /api/customer-reviews/:id` | admin | quản lý nhận xét khách hàng trên trang chủ |
| `POST /api/groups` + `DELETE /api/groups/:id` | admin | quản lý nhóm sản phẩm (Mới/Hot/KM) |
| `POST /api/promos` + `DELETE /api/promos/:code` | admin | quản lý mã giảm giá (server dùng bảng này khi đặt hàng) |
| `POST /api/newsletters` | công khai | khách đăng ký email nhận ưu đãi |
| `GET /api/newsletters` + `DELETE /api/newsletters/:id` | admin | xem/xoá danh sách email |
| `GET /api/admin/data` | admin | danh sách users + orders |
| `POST/DELETE /api/products(/:id)` | admin | thêm/sửa/xoá sản phẩm |
| `POST/DELETE /api/toppings(/:id)` | admin | thêm/sửa/xoá topping |
| `PATCH /api/orders/:code` | admin | đổi trạng thái đơn hàng |
| `PATCH/DELETE /api/users/:id` | admin | sửa/khoá/xoá khách hàng |
| `POST /api/settings` | admin | lưu cài đặt website |

---

## ✅ Đối chiếu yêu cầu assignment

| Yêu cầu | Trạng thái | Vị trí triển khai |
|---|---|---|
| **Y1.1** Website load, không lỗi JS | ✅ | Toàn bộ trang, test browser sạch lỗi console |
| **Y1.2.1** ≥ 3 nhóm SP: Mới / Hot / Khuyến mãi | ✅ | `data.js` `GROUPS`, tabs trang chủ |
| **Y1.2.1** SP có tên, giá, ảnh, nút Xem chi tiết / Thêm giỏ | ✅ | Card SP + modal chi tiết |
| **Y1.2.2** Trang danh mục theo category | ✅ | `products.html?cat=…` |
| **Y1.2.3** Hiệu ứng hover / zoom | ✅ | `style.css` `.product-card:hover` |
| **Y1.3** Slider có next / prev / dot, điều khiển JS | ✅ | `main.js` slider (auto + thủ công + vuốt) |
| **Y1.4** Form + kiểm tra rỗng, định dạng email/số | ✅ | `login.html`, `checkout.html`, `auth.js` |
| **Y1.5** Giỏ hàng: thêm / xoá / đổi số lượng, lưu localStorage | ✅ | `cart.js` + `store.js`, reload không mất |
| **Y1.6** Chức năng nâng cao (chọn ≥1) | ✅ | Làm đủ **3**: Countdown, Geolocation, Media |
| **Y1.7** Tự đề xuất 3 yêu cầu | ✅ | Đăng nhập bắt buộc khi đặt hàng · Admin · Tìm kiếm/lọc/sort |
| **Y2** js/ , css/ , html cùng cấp | ✅ | Đúng cấu trúc ở trên |

---

## 🔐 3 yêu cầu tự đề xuất (Y1.7)

1. **Đăng nhập bắt buộc để đặt hàng** — *Lý do:* bảo vệ đơn hàng, quản lý được khách hàng.
   Khách chưa đăng nhập bấm "Thanh toán" sẽ bị chặn và chuyển sang trang đăng nhập
   (`cart.js` `checkout()` → `login.html?next=…`; `checkout.js` gate bảo vệ).
2. **Trang quản trị Admin** — *Lý do:* chủ cửa hàng cần quản lý toàn bộ website:
   dashboard thống kê (doanh thu, đơn hôm nay, đơn hàng, sản phẩm, khách hàng,
   giá trị trung bình đơn + biểu đồ 7 ngày + top sản phẩm bán chạy),
   CRUD sản phẩm, **quản lý danh mục + nhóm sản phẩm**, **quản lý banner slider**,
   **quản lý chi nhánh**, **nhận xét khách hàng**, **mã giảm giá**, **danh sách email
   newsletter**, cập nhật trạng thái đơn hàng, khoá/mở/xoá khách hàng, cài đặt website
   (gồm cả **câu chuyện thương hiệu + ảnh story**),
   và **quản lý đánh giá & bình luận** (đánh giá sản phẩm + đánh giá website, có tìm kiếm,
   lọc theo sao, xoá — khi xoá đánh giá sản phẩm, rating trung bình được tính lại tự động).
   Đăng nhập riêng qua `admin-login.html` (chỉ admin); `admin.html` bị chặn nếu không
   phải admin (`admin-login.js` + `admin.js` `gate()`).
3. **Tìm kiếm + lọc + sắp xếp sản phẩm** — *Lý do:* trải nghiệm mua sắm tốt hơn.
   `products.js`: tìm theo tên/mô tả/danh mục, lọc theo danh mục, sắp xếp theo giá/đánh giá/bán chạy.

---

## 🔧 Chức năng nâng cao (Y1.6) — làm đủ 3

- **Countdown Clock (Flash Sale):** `main.js` — đồng hồ đếm ngược đến hết đợt giảm giá, cập nhật mỗi giây.
- **Geolocation:** `main.js` — nút "Tìm chi nhánh gần nhất" dùng `navigator.geolocation`,
  tính khoảng cách Haversine (`data.js` `distanceKm`) và highlight chi nhánh gần bạn nhất.
- **Media:** `main.js` `AudioPlayer` — trình phát nhạc quán trà dùng **Web Audio API**
  (tạo giai điệu pentatonic bằng code, không cần file nhạc), nút play/pause điều khiển bằng JS.

---

## ⚠️ Lưu ý

- **Bảo mật backend:** mật khẩu hash bằng **scrypt + salt ngẫu nhiên** (module `crypto` của Node),
  phiên đăng nhập dùng **token Bearer ngẫu nhiên** (hết hạn 30 ngày), giá đơn hàng được
  **server tính lại từ database** (không tin giá client gửi lên), chặn path traversal và
  chặn truy cập trực tiếp file `database.db`.
- **Dữ liệu thật, bền vững:** toàn bộ tài khoản/sản phẩm/đơn hàng/đánh giá/cài đặt nằm trong
  `database.db` (SQLite) — restart server hay tắt máy đều không mất. Muốn reset về dữ liệu mẫu:
  tắt server, xoá file `database.db`, chạy lại `node server.js`.
- **Giỏ hàng vẫn lưu `localStorage`** theo từng thiết bị (giỏ hàng là dữ liệu tạm, chưa đặt hàng).
- Ảnh sản phẩm là ảnh thật (JPEG) tải từ nguồn miễn phí bản quyền (Unsplash/Pexels) về `assets/images/products/`, chạy offline hoàn toàn (có fallback SVG cũ nếu mất file).
- Banner hero dùng ảnh nền thật + overlay, icon đồng bộ SVG đơn sắc (`currentColor`), animation chỉnh chu (kenburns, scroll reveal, hover nâng/zoom, countdown nhịp) và tôn trọng `prefers-reduced-motion`.
- Giỏ hàng dạng **popup modal**, có popup **chọn/chỉnh topping** khi thêm/sửa sản phẩm.
- **Phí giao hàng:** nhận tại quán = **miễn phí**, giao tận nơi = **15.000₫** (server tính, checkout hiển thị động).
- **Settings admin mở rộng**: tên, slogan, mô tả, hotline, email, địa chỉ, giờ mở cửa, màu chủ đạo, logo (file/link).
- **Ảnh sản phẩm**: upload từ máy (base64) hoặc dán link ảnh, có preview.
- **Đánh giá**: khách đánh giá sản phẩm (sao + bình luận) hiển thị trong modal; đánh giá website ở trang chủ; admin quản lý & xoá trong trang "Đánh giá".
- **Quản lý danh mục**: admin thêm/sửa/xoá danh mục trong trang "Danh mục" (bảng `categories` trong SQLite). Danh mục mới tự xuất hiện trong bộ lọc sản phẩm (admin, trang Menu, form sản phẩm, trang chủ). Không xoá được danh mục còn sản phẩm.
