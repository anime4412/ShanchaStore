/* ============================================================
   ShanChaStore - products.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Menu / danh mục sản phẩm (products.html).
   ============================================================
   Từng phần làm gì:
   - render danh mục động: đổ các option vào select #cat-filter từ
        Store.getCategories() (danh mục trong SQLite, không còn ghi cứng).
   - apply(): lọc + tìm + sắp xếp rồi vẽ lưới sản phẩm:
        * lọc theo danh mục (?cat= từ trang chủ hoặc chọn select);
        * lọc nhóm nếu vào từ Flash Sale (?group=);
        * tìm kiếm theo tên / mô tả / tên danh mục;
        * sắp xếp: giá tăng/giảm, đánh giá cao, bán chạy.
   - Nút "Xem chi tiết" -> UI.openProductModal; nút "Thêm giỏ" -> popup topping.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  await UI.initCommon('products');

  const grid = document.getElementById('product-grid');
  const searchInput = document.getElementById('search-input');
  const catFilter = document.getElementById('cat-filter');
  const sortSelect = document.getElementById('sort-select');
  const emptyBox = document.getElementById('empty-box');
  const countLabel = document.getElementById('result-count');

  // render động danh mục từ server (thay option cứng trong HTML)
  const cats = Store.getCategories();
  if (catFilter) {
    catFilter.innerHTML = '<option value="all">Tất cả danh mục</option>' +
      cats.map(c => '<option value="' + UI.esc(c.id) + '">' + UI.esc(c.name) + '</option>').join('');
  }

  // đọc query ?cat=... / ?group=... từ link trang chủ
  const params = new URLSearchParams(location.search);
  if (params.get('cat')) catFilter.value = params.get('cat');
  const presetGroup = params.get('group') || 'all';

  let query = '';
  let cat = catFilter.value;
  let sortBy = sortSelect.value;

  function apply() {
    let list = Store.getProducts();

    // lọc danh mục
    if (cat !== 'all') list = list.filter(p => p.category === cat);
    // lọc nhóm (nếu vào từ flash sale)
    if (presetGroup !== 'all') list = list.filter(p => p.group === presetGroup);
    // tìm kiếm
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.desc || '').toLowerCase().includes(q) ||
        ((Store.getCategories().find(c => c.id === p.category) || {}).name || '').toLowerCase().includes(q)
      );
    }
    // sắp xếp
    switch (sortBy) {
      case 'price-asc': list.sort((a, b) => a.price - b.price); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      case 'rating': list.sort((a, b) => b.rating - a.rating); break;
      case 'sold': list.sort((a, b) => b.sold - a.sold); break;
      default: break;
    }

    countLabel.textContent = 'Hiển thị ' + list.length + ' sản phẩm.';
    emptyBox.style.display = list.length ? 'none' : 'block';
    grid.innerHTML = list.map(UI.productCard).join('');

    grid.querySelectorAll('[data-act="view"]').forEach(b => {
      b.addEventListener('click', () => UI.openProductModal(Number(b.closest('.product-card').dataset.id)));
    });
    grid.querySelectorAll('[data-act="add"]').forEach(b => {
      b.addEventListener('click', () => {
        Cart.openToppingModal(Number(b.closest('.product-card').dataset.id), 'add');
      });
    });
  }

  searchInput.addEventListener('input', () => { query = searchInput.value.trim(); apply(); });
  catFilter.addEventListener('change', () => { cat = catFilter.value; apply(); });
  sortSelect.addEventListener('change', () => { sortBy = sortSelect.value; apply(); });

  apply();
});
