/* ============================================================
   ShanChaStore - checkout.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Thanh toán (checkout.html).
   ============================================================
   Từng phần làm gì:
   - GATE: nếu chưa đăng nhập -> hiện thông báo "cần đăng nhập"
           và không cho thanh toán (quy tắc bắt buộc của assignment).
   - SHIP_TIERS : bảng phí ship theo km (giống server — chỉ để xem trước,
           server luôn tính lại khi đặt).
   - renderSummary(): vẽ tóm tắt đơn: danh sách món, tạm tính, phí ship,
           giảm giá (mã KM), tổng tiền.
   - Bản đồ Leaflet: chọn điểm giao -> tính chi nhánh gần nhất + phí ship
           theo km; nút "Dùng vị trí của tôi" dùng geolocation; nút Xem Google Maps.
   - applyPromo(): kiểm tra mã giảm giá qua /api/promo/check (server quyết định).
   - Nút "Đặt hàng": validate tên/SĐT/email/địa chỉ -> Cart.placeOrder()
           -> thành công hiện màn hình xác nhận với mã đơn + tổng tiền.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  await UI.initCommon();

  /* ---------- Gate: chưa đăng nhập thì không cho thanh toán ---------- */
  if (!Store.isLoggedIn()) {
    document.getElementById('checkout-layout').innerHTML =
      '<div class="form-card" style="text-align:center">' +
      '<div style="font-size:3rem">' + UI.icon('lock') + '</div>' +
      '<h2 style="margin:12px 0">Bạn cần đăng nhập để đặt hàng</h2>' +
      '<p class="section-desc">Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục thanh toán.</p>' +
      '<div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<a class="btn btn-primary" href="login.html?next=checkout.html">Đăng nhập</a>' +
      '<a class="btn btn-outline" href="login.html?tab=register&next=checkout.html">Tạo tài khoản</a>' +
      '</div></div>';
    UI.toast('Vui lòng đăng nhập để đặt hàng!', 'warn');
    return;
  }

  const DELIVERY_FEE = 15000;   // chưa chọn bản đồ -> phí mặc định
  /* Cùng mốc phí với server.js (server luôn tính lại, đây chỉ để xem trước) */
  const SHIP_TIERS = [
    { maxKm: 2,        fee: 10000 },
    { maxKm: 5,        fee: 15000 },
    { maxKm: 10,       fee: 25000 },
    { maxKm: Infinity, fee: 35000 }
  ];

  let mapPick = null;       // {lat, lng, km, storeName, fee} vị trí đã chốt
  let promoApplied = null;  // {code, label, discount, freeShip}

  const itemsBox = document.getElementById('co-items');
  const subtotalEl = document.getElementById('co-subtotal');
  const shipEl = document.getElementById('co-ship');
  const shipTagEl = document.getElementById('co-ship-tag');
  const discLine = document.getElementById('co-discount-line');
  const discEl = document.getElementById('co-discount');
  const discTagEl = document.getElementById('co-discount-tag');
  const totalEl = document.getElementById('co-total');
  const storeSelect = document.getElementById('co-store');
  const mapGroup = document.getElementById('co-map-group');
  const promoInput = document.getElementById('co-promo');
  const promoMsg = document.getElementById('co-promo-msg');

  /* ---------- Phí ship theo khoảng cách (mirror của server) ---------- */
  function shipFeeByKm(km) {
    for (const t of SHIP_TIERS) if (km <= t.maxKm) return t.fee;
    return SHIP_TIERS[SHIP_TIERS.length - 1].fee;
  }
  function nearestStoreInfo(lat, lng) {
    let best = null;
    STORES.forEach(s => {
      const km = Math.round(distanceKm(lat, lng, s.lat, s.lng) * 10) / 10;
      if (!best || km < best.km) best = { store: s, km };
    });
    return best;
  }

  function currentShipFee() {
    if (storeSelect && storeSelect.value) return 0;            // nhận tại quán
    if (promoApplied && promoApplied.freeShip) return 0;        // mã freeship
    if (mapPick) return mapPick.fee;                            // theo khoảng cách
    return DELIVERY_FEE;                                        // mặc định
  }

  /* ---------- Tóm tắt đơn ---------- */
  function renderSummary() {
    const list = Cart.items();
    if (list.length === 0) {
      document.getElementById('checkout-layout').innerHTML =
        '<div class="form-card" style="text-align:center">' +
        '<div style="font-size:3rem">' + UI.icon('cup') + '</div>' +
        '<h2 style="margin:12px 0">Giỏ hàng đang trống</h2>' +
        '<a class="btn btn-primary" style="margin-top:14px" href="products.html">Xem menu</a></div>';
      return;
    }
    itemsBox.innerHTML = list.map(it => {
      const toppings = (it.toppings || []).length
        ? '<div style="font-size:.78rem;color:var(--accent)">+' + it.toppings.map(t => t.name).join(', ') + '</div>' : '';
      return (
        '<div class="cart-item" style="padding:10px 0">' +
        '<img class="cart-item-img" src="' + Cart.imgSrc(it) + '" alt="' + it.name + '">' +
        '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + it.name + ' <span style="color:var(--muted)">× ' + it.qty + '</span></div>' +
        toppings +
        '<div class="cart-item-price">' + UI.fmt(Cart.lineTotal(it)) + '</div>' +
        '</div></div>'
      );
    }).join('');

    const sub = Cart.subtotal();
    const fee = currentShipFee();
    const discount = promoApplied ? Math.min(promoApplied.discount, sub) : 0;

    subtotalEl.textContent = UI.fmt(sub);
    shipTagEl.textContent =
      promoApplied && promoApplied.freeShip ? ' · ' + promoApplied.code :
      mapPick ? ' · ' + mapPick.km + ' km' : '';
    shipEl.textContent = fee ? UI.fmt(fee) : 'Miễn phí';
    if (promoApplied && discount > 0) {
      discLine.style.display = 'flex';
      discTagEl.textContent = ' · ' + promoApplied.code;
      discEl.textContent = '-' + UI.fmt(discount);
    } else {
      discLine.style.display = 'none';
    }
    totalEl.textContent = UI.fmt(sub - discount + fee);
  }

  /* ---------- Trạng thái chọn bản đồ ---------- */
  function renderMapStatus() {
    const box = document.getElementById('co-map-status');
    if (!box) return;
    if (mapPick) {
      box.classList.add('picked');
      box.innerHTML =
        UI.esc(mapPick.storeName) + ' sẽ giao — cách ~' + mapPick.km + ' km, phí ship ' + UI.fmt(mapPick.fee) +
        '. <span class="map-clear" id="co-map-clear">Bỏ vị trí đã chọn</span>';
      document.getElementById('co-map-clear').addEventListener('click', () => {
        mapPick = null;
        renderMapStatus();
        renderSummary();
      });
    } else {
      box.classList.remove('picked');
      box.textContent = 'Chưa chọn vị trí — phí giao hàng mặc định ' + UI.fmt(DELIVERY_FEE) + '.';
    }
  }

  /* ---------- Modal bản đồ (Leaflet + OpenStreetMap) ---------- */
  let mapModal = null, map = null, marker = null, picked = null;

  function pinIcon() {
    return L.divIcon({
      className: 'mm-pin-wrap',
      html: '<div class="mm-pin"></div>',
      iconSize: [26, 34],
      iconAnchor: [13, 32]
    });
  }

  function ensureMapModal() {
    if (mapModal) return;
    mapModal = document.createElement('div');
    mapModal.id = 'map-modal';
    mapModal.className = 'modal';
    mapModal.innerHTML =
      '<div class="modal-card map-modal-card">' +
      '<button class="modal-close" id="mm-close" aria-label="Đóng">×</button>' +
      '<div class="modal-body" style="grid-template-columns:1fr">' +
      '<div class="modal-cat">Điểm giao hàng</div>' +
      '<h2 class="modal-name" style="font-size:1.2rem">Chọn vị trí trên bản đồ</h2>' +
      '<p style="color:var(--muted);font-size:.86rem;margin-bottom:12px">' +
      'Nhấn vào bản đồ để đặt ghim điểm giao. Chi nhánh gần nhất sẽ giao và phí ship tính theo khoảng cách.' +
      '</p>' +
      '<div id="mm-map" class="mm-map"></div>' +
      '<div id="mm-info" class="mm-info">Chưa chọn vị trí. Hãy nhấn vào bản đồ.</div>' +
      '<div class="mm-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="mm-geo">Dùng vị trí của tôi</button>' +
      '<a id="mm-gg" class="btn btn-ghost btn-sm" href="#" target="_blank" rel="noopener">Xem trên Google Maps</a>' +
      '<button type="button" class="btn btn-primary btn-sm" id="mm-use" disabled>Dùng vị trí này</button>' +
      '</div>' +
      '</div></div>';
    document.body.appendChild(mapModal);
    mapModal.addEventListener('click', e => { if (e.target === mapModal) closeMapModal(); });
    document.getElementById('mm-close').addEventListener('click', closeMapModal);
    document.getElementById('mm-use').addEventListener('click', usePicked);
    document.getElementById('mm-geo').addEventListener('click', useGeo);
  }

  function openMapModal() {
    if (typeof L === 'undefined') { UI.toast('Không tải được thư viện bản đồ.', 'danger'); return; }
    ensureMapModal();
    mapModal.classList.add('open');
    const center = mapPick ? [mapPick.lat, mapPick.lng] : [10.7764, 106.7008];
    map = L.map('mm-map').setView(center, mapPick ? 15 : 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    /* đánh dấu 4 chi nhánh */
    STORES.forEach(s => {
      L.circleMarker([s.lat, s.lng], { radius: 9, color: '#5E3A1F', weight: 2, fillColor: '#C97B4A', fillOpacity: .95 })
        .addTo(map)
        .bindTooltip('<b>' + UI.esc(s.name) + '</b><br>' + UI.esc(s.address), { direction: 'top' });
    });
    map.on('click', e => setPin(e.latlng.lat, e.latlng.lng, true));
    if (mapPick) setPin(mapPick.lat, mapPick.lng, false);
  }

  function setPin(lat, lng, pan) {
    picked = {
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5
    };
    if (!marker) {
      marker = L.marker([picked.lat, picked.lng], { icon: pinIcon(), draggable: true }).addTo(map);
      marker.on('dragend', () => setPin(marker.getLatLng().lat, marker.getLatLng().lng, true));
    } else {
      marker.setLatLng([picked.lat, picked.lng]);
    }
    if (pan) map.panTo([picked.lat, picked.lng]);
    updateMapInfo();
  }

  function updateMapInfo() {
    const info = document.getElementById('mm-info');
    const useBtn = document.getElementById('mm-use');
    const gg = document.getElementById('mm-gg');
    if (!picked) {
      info.textContent = 'Chưa chọn vị trí. Hãy nhấn vào bản đồ.';
      useBtn.disabled = true;
      return;
    }
    const near = nearestStoreInfo(picked.lat, picked.lng);
    info.innerHTML =
      '<b>Điểm giao:</b> ' + picked.lat + ', ' + picked.lng +
      '<br><b>Chi nhánh gần nhất:</b> ' + UI.esc(near.store.name) + ' (' + UI.esc(near.store.address) + ')' +
      '<br><b>Khoảng cách:</b> ~' + near.km + ' km → phí ship ' + UI.fmt(shipFeeByKm(near.km));
    useBtn.disabled = false;
    gg.href = 'https://maps.google.com/?q=' + picked.lat + ',' + picked.lng;
  }

  function usePicked() {
    if (!picked) return;
    const near = nearestStoreInfo(picked.lat, picked.lng);
    mapPick = { lat: picked.lat, lng: picked.lng, km: near.km, storeName: near.store.name, fee: shipFeeByKm(near.km) };
    closeMapModal();
    renderMapStatus();
    renderSummary();
    UI.toast('Đã chọn điểm giao — cách ' + near.store.name + ' ~' + near.km + ' km.', 'ok');
  }

  function useGeo() {
    if (!navigator.geolocation) { UI.toast('Trình duyệt không hỗ trợ định vị.', 'warn'); return; }
    UI.toast('Đang tìm vị trí của bạn…', 'ok');
    navigator.geolocation.getCurrentPosition(
      pos => setPin(pos.coords.latitude, pos.coords.longitude, true),
      () => UI.toast('Không lấy được vị trí. Hãy nhấn chọn trên bản đồ.', 'warn'),
      { timeout: 8000 }
    );
  }

  function closeMapModal() {
    if (mapModal) mapModal.classList.remove('open');
    if (map) { map.remove(); map = null; }
    marker = null;
    picked = null;
  }

  /* ---------- Mã giảm giá ---------- */
  async function applyPromo() {
    const code = (promoInput.value || '').trim().toUpperCase();
    if (!code) {
      promoApplied = null;
      promoMsg.className = 'promo-msg';
      promoMsg.textContent = 'Đã bỏ mã giảm giá.';
      renderSummary();
      return;
    }
    try {
      const res = await fetch('/api/promo/check?code=' + encodeURIComponent(code) + '&subtotal=' + Cart.subtotal());
      let data = {};
      try { data = await res.json(); } catch (e) { /* body rỗng */ }
      if (!res.ok) {
        promoApplied = null;
        promoMsg.className = 'promo-msg bad';
        promoMsg.textContent = data.msg || 'Mã giảm giá không hợp lệ.';
      } else {
        promoApplied = {
          code: data.promo.code,
          label: data.promo.label,
          discount: data.promo.discount || 0,
          freeShip: !!data.promo.freeShip
        };
        promoMsg.className = 'promo-msg good';
        promoMsg.textContent = 'Đã áp dụng: ' + data.promo.label + '.';
      }
    } catch (e) {
      UI.toast('Không kết nối được máy chủ để kiểm tra mã.', 'danger');
      return;
    }
    renderSummary();
  }

  const btnOpenMap = document.getElementById('btn-open-map');
  if (btnOpenMap) btnOpenMap.addEventListener('click', openMapModal);

  const btnPromo = document.getElementById('btn-promo');
  if (btnPromo) btnPromo.addEventListener('click', applyPromo);
  if (promoInput) promoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
  });

  /* nhận tại quán -> ẩn phần chọn bản đồ */
  if (storeSelect) storeSelect.addEventListener('change', () => {
    if (mapGroup) mapGroup.style.display = storeSelect.value ? 'none' : '';
    renderSummary();
  });

  renderMapStatus();
  renderSummary();

  /* ---------- Đặt hàng ---------- */
  const btnPlace = document.getElementById('btn-place');
  if (btnPlace) btnPlace.addEventListener('click', async () => {
    const name = document.getElementById('co-name').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const email = document.getElementById('co-email').value.trim();
    const address = document.getElementById('co-address').value.trim();
    const note = document.getElementById('co-note').value.trim();
    const storeId = storeSelect.value;
    const payMethod = document.getElementById('co-pay').value;

    const groups = ['co-name', 'co-phone', 'co-email', 'co-address'].map(id => document.getElementById(id).closest('.form-group'));
    groups.forEach(g => g.classList.remove('invalid'));
    let ok = true;

    if (!name) { groups[0].classList.add('invalid'); ok = false; }
    if (!phone || !Auth.validPhone(phone)) { groups[1].classList.add('invalid'); ok = false; }
    if (email && !Auth.validEmail(email)) { groups[2].classList.add('invalid'); ok = false; }
    if (!address) { groups[3].classList.add('invalid'); ok = false; }
    if (!ok) { UI.toast('Vui lòng kiểm tra lại thông tin.', 'warn'); return; }

    const res = await Cart.placeOrder({
      name, phone, address, note, payMethod, storeId,
      lat: !storeId && mapPick ? mapPick.lat : null,
      lng: !storeId && mapPick ? mapPick.lng : null,
      promo: promoApplied ? promoApplied.code : ''
    });
    if (!res.ok) { UI.toast(res.msg, 'danger'); return; }

    // thành công: hiện màn hình xác nhận
    document.getElementById('checkout-layout').style.display = 'none';
    document.getElementById('co-success').style.display = 'block';
    document.getElementById('co-code').textContent = res.order.code;
    let extra = '';
    if (res.order.shipKm) extra += ' Phí ship theo khoảng cách ~' + res.order.shipKm + ' km từ ' + (res.order.shipFrom || 'chi nhánh gần nhất') + '.';
    if (res.order.promo) extra += ' Ưu đãi ' + res.order.promo + ' đã áp dụng.';
    document.getElementById('co-success-msg').textContent =
      'Cảm ơn ' + name + '! Chúng tôi sẽ gọi ' + phone + ' để xác nhận đơn. Tổng tiền: ' + UI.fmt(res.order.total) + '.' + extra;
    UI.updateCartBadge();
    window.scrollTo(0, 0);
  });

});
