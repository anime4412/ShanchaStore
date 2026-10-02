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
  const PRODUCTS_PER_PAGE = 8;
  let page = 1;

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

    // phân trang
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
    page = Math.min(page, pages);
    const pageList = list.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

    countLabel.textContent = 'Hiển thị ' + pageList.length + ' / ' + total + ' sản phẩm.';
    emptyBox.style.display = list.length ? 'none' : 'block';
    grid.innerHTML = pageList.map(UI.productCard).join('');

    grid.querySelectorAll('[data-act="view"]').forEach(b => {
      b.addEventListener('click', () => UI.openProductModal(Number(b.closest('.product-card').dataset.id)));
    });
    grid.querySelectorAll('[data-act="add"]').forEach(b => {
      b.addEventListener('click', () => {
        Cart.openToppingModal(Number(b.closest('.product-card').dataset.id), 'add');
      });
    });

    // vẽ pager
    const pager = document.getElementById('products-pager');
    if (pager) {
      if (pages <= 1) { pager.innerHTML = ''; return; }
      let html = '<span class="pager-info">Trang ' + page + '/' + pages + ' · ' + total + ' sản phẩm</span>';
      html += '<button data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';
      for (let i = 1; i <= pages; i++) {
        html += '<button data-p="' + i + '"' + (i === page ? ' class="active"' : '') + '>' + i + '</button>';
      }
      html += '<button data-p="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>›</button>';
      pager.innerHTML = html;
      pager.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          const np = Number(b.dataset.p);
          if (np < 1 || np > pages) return;
          page = np;
          apply();
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }

  searchInput.addEventListener('input', () => { query = searchInput.value.trim(); page = 1; apply(); });
  catFilter.addEventListener('change', () => { cat = catFilter.value; page = 1; apply(); });
  sortSelect.addEventListener('change', () => { sortBy = sortSelect.value; page = 1; apply(); });

  apply();
});
