/* ============================================================
   ShanChaStore - data.js
   ============================================================
   FILE NÀY CHẠY CHO: MỌI trang web (nạp trước tiên trong <script>).
   ============================================================
   Đây là "kho dữ liệu gốc" của website:
   - CATEGORIES : 3 danh mục sản phẩm mặc định (Trà sữa / Trà lạnh / Cà phê).
                  GHI CHÚ: từ khi có trang Quản lý danh mục, danh mục thật
                  nằm trong bảng SQLite `categories`; mảng này chỉ là bản fallback.
   - GROUPS     : 3 nhóm sản phẩm (Mới / Hot / Khuyến mãi) — đúng yêu cầu Y1.2.
   - PRODUCTS   : 18 sản phẩm mẫu (tên, danh mục, nhóm, giá, giá cũ, ảnh,
                  mô tả, rating, lượt bán). Server.js dùng để seed vào SQLite
                  lần đầu chạy; trang web đọc từ server chứ không đọc mảng này.
   - STORES     : 4 chi nhánh (tên, địa chỉ, giờ, SĐT, tọa độ lat/lng)
                  — dùng cho Geolocation + tính phí giao hàng.
   - TOPPINGS   : 5 topping kèm giá (trân châu, thạch dừa, pudding…) — seed SQLite.
   - distanceKm : hàm tính khoảng cách 2 điểm theo công thức Haversine (đơn vị km),
                  dùng ở trang chủ (tìm chi nhánh gần) và server (phí ship).
   - nearestStore: sắp 4 chi nhánh theo khoảng cách tăng dần từ 1 điểm.
   ============================================================ */

'use strict';

/* ---------- Danh mục ---------- */
const CATEGORIES = [
  { id: 'tra-sua',  name: 'Trà sữa' },
  { id: 'tra-lanh', name: 'Trà lạnh' },
  { id: 'ca-phe',   name: 'Cà phê' }
];

/* ---------- Nhóm sản phẩm (yêu cầu Y1.2: >= 3 nhóm) ---------- */
const GROUPS = [
  { id: 'new', name: 'Sản phẩm mới' },
  { id: 'hot', name: 'Sản phẩm hot' },
  { id: 'sale', name: 'Sản phẩm khuyến mãi' }
];

/* ---------- Sản phẩm (array of objects) ---------- */
const PRODUCTS = [
  { id: 1,  name: 'Trà Sữa Ôlong',            category: 'tra-sua',  group: 'hot',  price: 35000, oldPrice: 35000, img: 'products/tra-sua-olong.jpg',         desc: 'Trà ôlong ủ từ búp trà Đà Lạt, sữa tươi thanh mát, ít ngọt, hậu trà đậm đà.', rating: 4.9, sold: 1240 },
  { id: 2,  name: 'Hồng Trà Sữa',             category: 'tra-sua',  group: 'sale', price: 29000, oldPrice: 39000, img: 'products/hong-tra-sua.jpg',          desc: 'Hồng trà Đài Loan pha sữa, trân châu đen dai giòn, vị caramel nhẹ.', rating: 4.8, sold: 986 },
  { id: 3,  name: 'Trà Sữa Nhài',             category: 'tra-sua',  group: 'hot',  price: 32000, oldPrice: 32000, img: 'products/tra-sua-nhai.jpg',          desc: 'Trà nhài thơm nồng kết hợp sữa, topping thạch dừa tự làm.', rating: 4.7, sold: 860 },
  { id: 4,  name: 'Trà Sữa Phong Lan',        category: 'tra-sua',  group: 'new',  price: 37000, oldPrice: 37000, img: 'products/tra-sua-phong-lan.jpg',     desc: 'Phong lan trắng ủ cùng trà đen, sữa béo, thơm dịu, vị thanh tao.', rating: 4.9, sold: 640 },
  { id: 5,  name: 'Trà Sữa Ôlong Gạo Rang',   category: 'tra-sua',  group: 'new',  price: 39000, oldPrice: 39000, img: 'products/tra-sua-olong-gao-rang.jpg', desc: 'Gạo rang vàng thơm quyện ôlong, béo ngậy, giòn tan.', rating: 4.8, sold: 520 },
  { id: 6,  name: 'Trà Sữa Bạch Đào',         category: 'tra-sua',  group: 'sale', price: 34000, oldPrice: 42000, img: 'products/tra-sua-bach-dao.jpg',       desc: 'Đào trắng tươi xay nhuyễn, trà sữa nhẹ, ngọt tự nhiên.', rating: 4.6, sold: 730 },
  { id: 7,  name: 'Trà Đào',                  category: 'tra-lanh', group: 'hot',  price: 30000, oldPrice: 30000, img: 'products/tra-dao.jpg',                desc: 'Trà đen ủ lạnh cùng đào miếng, giải nhiệt, ít ngọt.', rating: 4.7, sold: 1100 },
  { id: 8,  name: 'Trà Phở',                  category: 'tra-lanh', group: 'new',  price: 32000, oldPrice: 32000, img: 'products/tra-pho.jpg',                desc: 'Trà ủ từ thảo mộc + gừng, mùi thơm như phở Bắc, độc đáo.', rating: 4.5, sold: 320 },
  { id: 9,  name: 'Trà Lệ Chi Nhài',          category: 'tra-lanh', group: 'new',  price: 36000, oldPrice: 36000, img: 'products/tra-le-chi-nhai.jpg',        desc: 'Nhãn lệ chi ngọt lịm kết hợp trà nhài, uống lạnh cực mát.', rating: 4.8, sold: 410 },
  { id: 10, name: 'Trà Nhãn Hồng Đà Lạt',     category: 'tra-lanh', group: 'sale', price: 33000, oldPrice: 41000, img: 'products/tra-nhan-hong-dalat.jpg',    desc: 'Nhãn hồng Đà Lạt ngọt thanh, trà xanh ủ lạnh.', rating: 4.7, sold: 590 },
  { id: 11, name: 'Trà Me Muối Ớt Mexico',    category: 'tra-lanh', group: 'hot',  price: 35000, oldPrice: 35000, img: 'products/tra-me-muoi-ot-mexico.jpg',  desc: 'Me chua + muối + ớt Mexico cay nhẹ, kích thích vị giác.', rating: 4.8, sold: 880 },
  { id: 12, name: 'Khoai Môn Sữa Dừa',        category: 'tra-lanh', group: 'hot',  price: 37000, oldPrice: 37000, img: 'products/khoai-mon-sua-dua.jpg',      desc: 'Khoai môn tím dẻo, sữa dừa béo, topping phô mai tươi.', rating: 4.9, sold: 1020 },
  { id: 13, name: 'Hojicha Caramel Mặn',      category: 'tra-lanh', group: 'new',  price: 40000, oldPrice: 40000, img: 'products/hojicha-caramel-man.jpg',    desc: 'Hojicha rang khói + caramel muối, vị mặn ngọt cân bằng.', rating: 4.9, sold: 470 },
  { id: 14, name: 'Matcha Hạt Sen',           category: 'tra-lanh', group: 'new',  price: 42000, oldPrice: 42000, img: 'products/matcha-hat-sen.jpg',         desc: 'Matcha Uji nghiền đá, hạt sen non, thơm bùi.', rating: 4.8, sold: 380 },
  { id: 15, name: 'Cà Phê Caramel Mặn',       category: 'ca-phe',   group: 'sale', price: 39000, oldPrice: 49000, img: 'products/ca-phe-caramel-man.jpg',    desc: 'Espresso + caramel mặn + sữa, thêm đá xay.', rating: 4.8, sold: 560 },
  { id: 16, name: 'Cà Phê Sữa Tươi',          category: 'ca-phe',   group: 'hot',  price: 32000, oldPrice: 32000, img: 'products/ca-phe-sua-tuoi.jpg',        desc: 'Cà phê phin truyền thống, sữa tươi nguyên chất.', rating: 4.7, sold: 740 },
  { id: 17, name: 'Cà Phê Sữa Đá',            category: 'ca-phe',   group: 'hot',  price: 29000, oldPrice: 29000, img: 'products/ca-phe-sua-da.jpg',          desc: 'Cà phê đậm đặc, sữa đặc, đá xay mịn, chuẩn gu Sài Gòn.', rating: 4.6, sold: 900 },
  { id: 18, name: 'Cà Phê Đen Đá',            category: 'ca-phe',   group: 'new',  price: 25000, oldPrice: 25000, img: 'products/ca-phe-den-da.jpg',          desc: 'Đen đá nguyên chất, đậm vị Robusta Đà Lạt.', rating: 4.5, sold: 650 }
];

/* ---------- Chi nhánh (dùng cho Geolocation) ---------- */
const STORES = [
  { id: 'cn1', name: 'ShanCha – CN1', address: '38 Lê Lợi, Q.1, TP.HCM', hours: '09:00 – 21:30', phone: '039 799 9949', lat: 10.7764, lng: 106.7008 },
  { id: 'cn2', name: 'ShanCha – CN2', address: '58D Trần Quốc Thảo, Q.3, TP.HCM', hours: '09:00 – 22:00', phone: '039 799 9949', lat: 10.7826, lng: 106.6825 },
  { id: 'cn3', name: 'ShanCha – CN3', address: '340D Hoàng Văn Thụ, Tân Bình, TP.HCM', hours: '09:00 – 22:00', phone: '039 799 9949', lat: 10.8003, lng: 106.6547 },
  { id: 'dl1', name: 'ShanCha Signature – Đà Lạt', address: '61 đường 3/2, P. Xuân Hương, Đà Lạt', hours: '09:00 – 22:00', phone: '039 799 9949', lat: 11.9393, lng: 108.4358 }
];

/* ---------- Topping (tuỳ chọn khi thêm giỏ) ---------- */
const TOPPINGS = [
  { id: 't1', name: 'Trân châu đen', price: 5000 },
  { id: 't2', name: 'Trân châu trắng', price: 5000 },
  { id: 't3', name: 'Thạch dừa', price: 6000 },
  { id: 't4', name: 'Pudding', price: 8000 },
  { id: 't5', name: 'Kem bông', price: 10000 }
];

/* ---------- Chi nhánh gần nhất (tiện ích cho Geolocation) ----------
   distanceKm: công thức Haversine — tính km giữa 2 tọa độ (lat/lng). */
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestStore(lat, lng) {
  return [...STORES].sort((a, b) => distanceKm(lat, lng, a.lat, a.lng) - distanceKm(lat, lng, b.lat, b.lng));
}

/* Hỗ trợ chạy ở Node.js (server.js dùng dữ liệu này để seed database) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES, GROUPS, PRODUCTS, STORES, TOPPINGS, distanceKm };
}
