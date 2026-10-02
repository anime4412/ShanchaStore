/* ============================================================
   ShanChaStore - cart.js
   ============================================================
   FILE NÀY CHẠY CHO: MỌI trang (nạp sau ui.js) — giỏ hàng popup
   + nút thanh toán + đặt hàng.
   ============================================================
   Từng phần làm gì:
   - add()          : thêm sản phẩm (kèm topping đã chọn) vào giỏ (localStorage).
   - changeQty/remove: đổi số lượng / xoá dòng trong giỏ.
   - lineTotal/subtotal : tính tiền từng dòng (giá × SL + topping × SL) & tổng.
   - renderDrawer() : vẽ lại popup giỏ hàng (danh sách + tạm tính + nút Thanh toán),
                     gắn sự kiện +/−/sửa topping/xoá.
   - imgSrc()       : quyết định đường dẫn ảnh (base64/link trực tiếp/assets/).
   - openToppingModal(): popup chọn topping — dùng khi "Thêm giỏ" (mode add)
                     hoặc "Chỉnh topping" trong giỏ (mode edit, giữ số lượng).
   - checkout()     : NÚT THANH TOÁN — GATE ĐĂNG NHẬP:
                     chưa đăng nhập -> toast + chuyển login.html?next=checkout.html
                     (đúng quy tắc "phải đăng nhập mới đặt hàng");
                     đã đăng nhập -> sang checkout.html.
   - placeOrder()   : gửi đơn lên server (Store.placeOrder) — server tính lại
                     giá từ database, không tin giá client.
   ============================================================ */

'use strict';

const Cart = (function () {

  function count() { return Store.cartCount(); }
  function items() { return Store.getCart(); }

  function add(productId, qty, toppings) {
    const p = Store.getProduct(productId);
    if (!p) return false;
    /* Chặn: sản phẩm đã tắt bán (hết hàng) thì không thêm vào giỏ được */
    if (p.is_available === false) {
      UI.toast('Sản phẩm "' + p.name + '" đang hết hàng, không thể đặt.', 'warn');
      return false;
    }
    const ids = (toppings || []).map(t => t.id);
    const chosen = Store.getToppings().filter(t => ids.includes(t.id));
    Store.addToCart(p, qty || 1, chosen);
    UI.toast('Đã thêm "' + p.name + '" vào giỏ hàng', 'ok');
    return true;
  }

  function changeQty(id, qty) { Store.updateQty(id, Math.max(1, Number(qty) || 1)); }
  function remove(id) { Store.removeFromCart(id); }

  function lineTotal(it) {
    return (it.price * it.qty) + (it.toppings || []).reduce((s, t) => s + t.price * it.qty, 0);
  }
  function subtotal() { return Store.getCart().reduce((s, it) => s + lineTotal(it), 0); }

  function renderDrawer() {
    const wrap = document.getElementById('cart-drawer-body');
    if (!wrap) return;
    const list = items();

    if (list.length === 0) {
      wrap.innerHTML =
        '<div class="cart-empty">' +
        '<span class="cart-empty-icon">' + UI.icon('cup') + '</span>' +
        '<p>Giỏ hàng đang trống</p>' +
        '<a class="btn btn-primary" href="products.html">Xem menu</a>' +
        '</div>';
      return;
    }

    const rows = list.map(it => {
      const toppingsText = (it.toppings || []).length
        ? '<div class="cart-item-toppings">+' + it.toppings.map(t => t.name).join(', ') + '</div>' : '';
      return (
        '<div class="cart-item" data-id="' + it.id + '">' +
        '<img class="cart-item-img" src="' + imgSrc(it) + '" alt="' + it.name + '">' +
        '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + it.name + '</div>' +
        toppingsText +
        '<div class="cart-item-price">' + UI.fmt(lineTotal(it)) + '</div>' +
        '<div class="cart-item-controls">' +
        '<button class="qty-btn" data-act="minus" aria-label="Giảm">−</button>' +
        '<span class="qty-val">' + it.qty + '</span>' +
        '<button class="qty-btn" data-act="plus" aria-label="Tăng">+</button>' +
        '<button class="icon-btn" data-act="edit" title="Chỉnh topping" aria-label="Chỉnh topping">' + UI.icon('edit') + '</button>' +
        '<button class="qty-del" data-act="del" aria-label="Xoá">' + UI.icon('trash') + '</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    wrap.innerHTML =
      rows +
      '<div class="cart-summary">' +
      '<div class="cart-sum-row"><span>Tạm tính</span><span>' + UI.fmt(subtotal()) + '</span></div>' +
      '<button class="btn btn-primary btn-block" id="btn-checkout">' + UI.icon('check') + ' Thanh toán</button>' +
      '</div>';

    wrap.querySelectorAll('.qty-btn').forEach(b => {
      b.addEventListener('click', () => {
        const id = Number(b.closest('.cart-item').dataset.id);
        const val = Number(b.closest('.cart-item').querySelector('.qty-val').textContent);
        changeQty(id, b.dataset.act === 'plus' ? val + 1 : val - 1);
        renderDrawer(); UI.updateCartBadge();
      });
    });
    wrap.querySelectorAll('[data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => {
        const id = Number(b.closest('.cart-item').dataset.id);
        openToppingModal(id);
      });
    });
    wrap.querySelectorAll('.qty-del').forEach(b => {
      b.addEventListener('click', () => {
        const id = Number(b.closest('.cart-item').dataset.id);
        remove(id);
        renderDrawer(); UI.updateCartBadge();
      });
    });

    const btn = document.getElementById('btn-checkout');
    if (btn) btn.addEventListener('click', checkout);
  }

  /* ---------- Ảnh trong giỏ: base64/link trực tiếp/uploads, còn lại qua assets/ ---------- */
  function imgSrc(it) {
    return UI.assetUrl(it.img);
  }

  /* ---------- Popup chọn/chỉnh topping ---------- */
  function openToppingModal(productId, mode) {
    // productId = id sản phẩm (thêm mới) HOẶC id dòng giỏ (sửa). Phân biệt qua mode.
    let modal = document.getElementById('topping-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'topping-modal';
      modal.className = 'modal';
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      document.body.appendChild(modal);
    }
    const p = Store.getProduct(productId);
    if (!p && mode !== 'edit') return;

    const editing = mode === 'edit';
    const cartItem = editing ? items().find(it => it.id === productId) : null;
    const product = editing ? Store.getProduct(productId) : p;
    if (!product) return;

    // topping hiện tại
    const current = editing ? (cartItem.toppings || []) : [];

    modal.innerHTML =
      '<div class="modal-card small">' +
      '<button class="modal-close" id="tm-close" aria-label="Đóng">' + UI.icon('close') + '</button>' +
      '<div class="modal-body" style="grid-template-columns:1fr">' +
      '<div class="modal-cat">' + (editing ? 'Chỉnh sản phẩm trong giỏ' : 'Thêm vào giỏ') + '</div>' +
      '<h2 class="modal-name">' + UI.esc(product.name) + '</h2>' +
      '<div class="modal-price"><span class="price-now">' + UI.fmt(product.price) + '</span></div>' +
      '<div class="modal-toppings"><h4>Topping</h4>' +
      Store.getProductToppings(product.id).map(t => {
        const on = current.some(c => c.id === t.id);
        return '<label class="topping"><input type="checkbox" value="' + t.id + '"' + (on ? ' checked' : '') + '> ' + t.name + ' (+' + UI.fmt(t.price) + ')</label>';
      }).join('') +
      '</div>' +
      '<div class="modal-qty"><span>Số lượng:</span>' +
      '<button id="mq-minus" class="qty-btn">−</button><span id="mq-val">' + (editing ? cartItem.qty : 1) + '</span><button id="mq-plus" class="qty-btn">+</button>' +
      '</div>' +
      '<button class="btn btn-primary btn-block" id="tm-add">' + (editing ? UI.icon('check') + ' Cập nhật giỏ' : UI.icon('cart') + ' Thêm vào giỏ') + '</button>' +
      '</div></div></div>';

    modal.classList.add('open');
    document.getElementById('tm-close').addEventListener('click', () => modal.classList.remove('open'));

    let qty = editing ? cartItem.qty : 1;
    const val = document.getElementById('mq-val');
    document.getElementById('mq-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); val.textContent = qty; });
    document.getElementById('mq-plus').addEventListener('click', () => { qty += 1; val.textContent = qty; });

    document.getElementById('tm-add').addEventListener('click', () => {
      const chosen = [...modal.querySelectorAll('.topping input:checked')].map(i => Store.getToppings().find(t => t.id === i.value)).filter(Boolean);
      if (editing) {
        // cập nhật dòng giỏ: giữ id, đổi topping + qty
        const cart = Store.getCart().map(it => it.id === productId ? { ...it, qty, toppings: chosen } : it);
        Store.setCart(cart);
        UI.toast('Đã cập nhật sản phẩm trong giỏ.', 'ok');
      } else {
        add(productId, qty, chosen);
      }
      modal.classList.remove('open');
      renderDrawer();
      UI.updateCartBadge();
    });
  }

  /* ---------- Thanh toán: chặn nếu chưa đăng nhập ---------- */
  function checkout() {
    if (!Store.isLoggedIn()) {
      UI.closeDrawer();
      UI.toast('Vui lòng đăng nhập để đặt hàng!', 'warn');
      setTimeout(() => location.href = 'login.html?next=checkout.html', 600);
      return;
    }
    location.href = 'checkout.html';
  }

  /* ---------- Tạo đơn hàng (đã đăng nhập) — gọi API, server tính lại giá ---------- */
  async function placeOrder({ name, phone, address, note, payMethod, storeId, lat, lng, promo }) {
    const user = Store.currentUser();
    if (!user) return { ok: false, msg: 'Vui lòng đăng nhập để đặt hàng.' };

    const list = items();
    if (list.length === 0) return { ok: false, msg: 'Giỏ hàng trống.' };
    if (!name || !phone || !address) return { ok: false, msg: 'Vui lòng điền đầy đủ thông tin giao hàng.' };
    if (!Auth.validPhone(phone)) return { ok: false, msg: 'Số điện thoại không đúng định dạng.' };

    try {
      const order = await Store.placeOrder({ name, phone, address, note, payMethod, storeId, lat, lng, promo });
      UI.updateCartBadge();
      return { ok: true, order };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  return { count, items, add, changeQty, remove, lineTotal, subtotal, renderDrawer, checkout, placeOrder, openToppingModal, imgSrc };
})();