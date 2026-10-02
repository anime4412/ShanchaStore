/* ============================================================
   ShanChaStore - main.js
   ============================================================
   FILE NÀY CHẠY CHO: trang chủ (index.html)
   ============================================================
   Từng phần trong file làm gì:
   - §1 (renderProducts): hiển thị sản phẩm theo 3 nhóm
        (Tất cả / Mới / Hot / Khuyến mãi) — dùng tabs bấm để lọc.
   - §2 (Slider): banner trượt tự động + nút prev/next + chấm tròn
        + vuốt tay trên điện thoại (đúng yêu cầu Y1.3 slider không tĩnh).
   - §3 (Countdown): đồng hồ đếm ngược Flash Sale, chạy mỗi giây.
   - §4 (Geolocation): nút "Tìm chi nhánh gần nhất" dùng định vị
        trình duyệt, tính khoảng cách Haversine, tô sáng chi nhánh gần.
   - §5 (AudioPlayer): trình phát nhạc quán trà bằng Web Audio API
        (tạo giai điệu pentatonic bằng code, không cần file nhạc).
   - §5.5 (renderSiteReviews): khối "Đánh giá website" ở cuối trang chủ
        — đã đăng nhập thì viết đánh giá (sao + bình luận), chưa thì nhắc login.
   - §5.6 (renderHomeCategories): ô danh mục (Trà sữa / Trà lạnh / Cà phê…)
        render động từ SQLite; bấm vào nhảy sang trang Menu lọc theo danh mục.
   - §6 (Newsletter): form nhận email khuyến mãi, chỉ kiểm tra định dạng email.
   - §7 (Scroll reveal): hiệu ứng xuất hiện dần khi cuộn trang.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  await UI.initCommon('home');   // dựng header + footer + giỏ hàng + đổ dữ liệu từ server

  /* ========== §1. Render sản phẩm theo nhóm (tabs) ==========
     grid = vùng hiện card sản phẩm; tabs = nút "Tất cả / Mới / Hot / KM".
     Bấm tab nào -> lọc Store.getProducts() theo p.group rồi vẽ lại. */
  const grid = document.getElementById('product-grid');
  const tabs = [...document.querySelectorAll('.group-tab')];
  let currentGroup = 'all';
  const PRODUCTS_PER_PAGE = 6;
  let homePage = 1;

  function renderProducts(group) {
    const list = Store.getProducts();
    const filtered = group === 'all'
      ? list
      : list.filter(p => p.group === group);
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
    homePage = Math.min(homePage, pages);
    const pageList = filtered.slice((homePage - 1) * PRODUCTS_PER_PAGE, homePage * PRODUCTS_PER_PAGE);
    grid.innerHTML = pageList.map(UI.productCard).join('') || '<p style="text-align:center;color:var(--muted)">Không có sản phẩm.</p>';
    grid.querySelectorAll('[data-act="view"]').forEach(b => {
      b.addEventListener('click', () => UI.openProductModal(Number(b.closest('.product-card').dataset.id)));
    });
    grid.querySelectorAll('[data-act="add"]').forEach(b => {
      b.addEventListener('click', () => {
        Cart.openToppingModal(Number(b.closest('.product-card').dataset.id), 'add');
      });
    });
    renderHomePager(pages, total);
  }

  function renderHomePager(pages, total) {
    const wrap = document.getElementById('home-pager');
    if (!wrap) return;
    if (pages <= 1) { wrap.innerHTML = ''; return; }
    let html = '<span class="pager-info">Trang ' + homePage + '/' + pages + ' · ' + total + ' món</span>';
    html += '<button data-p="' + (homePage - 1) + '"' + (homePage <= 1 ? ' disabled' : '') + '>‹</button>';
    for (let i = 1; i <= pages; i++) {
      html += '<button data-p="' + i + '"' + (i === homePage ? ' class="active"' : '') + '>' + i + '</button>';
    }
    html += '<button data-p="' + (homePage + 1) + '"' + (homePage >= pages ? ' disabled' : '') + '>›</button>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const np = Number(b.dataset.p);
        if (np < 1 || np > pages) return;
        homePage = np;
        renderProducts(currentGroup);
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentGroup = tab.dataset.group;
      homePage = 1;
      renderProducts(currentGroup);
    });
  });

  renderProducts(currentGroup);

  /* ---------- 7. Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.section, .product-card, .cat-card, .store-card, .review-card');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => { el.classList.add('reveal'); io.observe(el); });
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ========== §2. Slider banner (Y1.3) ==========
     - Nội dung banner lấy từ bảng banners (SQLite) qua Store.getBanners(),
       admin đổi được ảnh/tiêu đề/link trên trang "Banner".
     - Tự chạy 4,5 giây/lần, có nút ‹ ›, chấm tròn, vuốt tay (mobile).
     - go(n, manual): chuyển slide; manual=true thì đặt lại bộ đếm giờ. */
  const slider = document.getElementById('hero-slider');
  function bannerSrc(img) {
    if (!img) return '';
    if (img.indexOf('data:') === 0 || img.indexOf('http') === 0 || img.indexOf('assets/') === 0) return img;
    return 'assets/images/' + img;
  }
  function renderBanners() {
    const banners = Store.getBanners().filter(b => b.active);
    if (!slider) return;
    slider.innerHTML =
      banners.map((b, i) =>
        '<div class="slide' + (i === 0 ? ' active' : '') + '">' +
        '<img src="' + bannerSrc(b.img) + '" alt="' + UI.esc(b.title || 'Banner') + '">' +
        '<div class="slide-overlay"></div>' +
        '<div class="slide-caption">' +
        (b.title ? '<div class="slide-title">' + UI.esc(b.title) + '</div>' : '') +
        (b.sub ? '<div class="slide-sub">' + UI.esc(b.sub) + '</div>' : '') +
        (b.link ? '<a class="btn btn-accent" href="' + UI.esc(b.link) + '">Xem ngay</a>' : '') +
        '</div></div>'
      ).join('') +
      '<button class="slider-btn slider-prev" id="slider-prev" aria-label="Slide trước">‹</button>' +
      '<button class="slider-btn slider-next" id="slider-next" aria-label="Slide sau">›</button>' +
      '<div class="slider-dots" id="slider-dots"></div>';
  }
  renderBanners();

  const slides = slider.querySelectorAll('.slide');
  const dotsWrap = document.getElementById('slider-dots');
  let idx = 0, autoTimer = null;
  const AUTO_MS = 4500;

  // tạo chấm tròn cho từng slide
  slides.forEach((_, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', 'Chuyển đến slide ' + (i + 1));
    if (i === 0) d.classList.add('active');
    d.addEventListener('click', () => go(i, true));
    dotsWrap.appendChild(d);
  });
  const dots = [...dotsWrap.children];

  function go(n, manual) {
    idx = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    if (manual) restartAuto();
  }

  function restartAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => go(idx + 1, false), AUTO_MS);
  }

  document.getElementById('slider-prev').addEventListener('click', () => go(idx - 1, true));
  document.getElementById('slider-next').addEventListener('click', () => go(idx + 1, true));
  restartAuto();

  // hỗ trợ vuốt (touch)
  let touchX = null;
  slider.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1), true);
    touchX = null;
  }, { passive: true });

  /* ========== §3. Countdown Flash Sale (chức năng nâng cao 1) ==========
     Đếm ngược tới saleEndsAt (lấy từ Cài đặt, lưu SQLite).
     Chạy mỗi 1 giây, hiện ở 4 ô: ngày / giờ / phút / giây. */
  function tickCountdown() {
    const s = Store.getSettings();
    const diff = Math.max(0, s.saleEndsAt - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v).padStart(2, '0'); };
    set('cd-d', d); set('cd-h', h); set('cd-m', m); set('cd-s', sec);
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  /* ========== §4. Geolocation: tìm chi nhánh gần nhất (nâng cao 2) ==========
     renderStores: vẽ 4 thẻ chi nhánh; thẻ gần nhất được tô highlight.
     Nút "Tìm chi nhánh gần nhất": xin định vị -> so khoảng cách
     (Haversine, data.js) -> highlight + báo km. Nút "Chỉ đường" mở Google Maps. */
  const storesGrid = document.getElementById('stores-grid');
  function renderStores(nearestId) {
    storesGrid.innerHTML = STORES.map(s => {
      const isNear = s.id === nearestId;
      return (
        '<div class="store-card' + (isNear ? ' nearest' : '') + '">' +
        (isNear ? '<span class="store-tag">' + UI.icon('loc') + ' Gần bạn nhất</span>' : '') +
        '<h3>' + s.name + '</h3>' +
        '<p>' + UI.icon('loc') + ' ' + s.address + '</p>' +
        '<p>' + UI.icon('clock') + ' ' + s.hours + '</p>' +
        '<p>' + UI.icon('phone') + ' ' + s.phone + '</p>' +
        '<button class="btn btn-outline btn-sm" data-dir="' + s.lat + ',' + s.lng + '">Chỉ đường</button>' +
        '</div>'
      );
    }).join('');
    storesGrid.querySelectorAll('[data-dir]').forEach(b => {
      b.addEventListener('click', () => {
        const [la, ln] = b.dataset.dir.split(',');
        window.open('https://www.google.com/maps/dir/?api=1&destination=' + la + ',' + ln, '_blank');
      });
    });
  }
  renderStores(null);

  const geoStatus = document.getElementById('geo-status');
  document.getElementById('btn-geolocate').addEventListener('click', () => {
    if (!navigator.geolocation) {
      geoStatus.textContent = 'Trình duyệt không hỗ trợ định vị.';
      return;
    }
    geoStatus.textContent = 'Đang xác định vị trí của bạn…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const [near] = nearestStore(pos.coords.latitude, pos.coords.longitude);
        const km = distanceKm(pos.coords.latitude, pos.coords.longitude, near.lat, near.lng).toFixed(1);
        geoStatus.textContent = 'Bạn cách ' + near.name + ' khoảng ' + km + ' km.';
        renderStores(near.id);
        UI.toast('Đã tìm thấy chi nhánh gần bạn!', 'ok');
      },
      err => {
        console.warn('geo error', err);
        geoStatus.textContent = 'Không lấy được vị trí (bạn đã cho phép định vị chưa?). Hiển thị toàn bộ chi nhánh.';
      },
      { timeout: 8000 }
    );
  });

  /* ========== §5. Media player (nâng cao 3): Web Audio API ==========
     Bấm "Phát nhạc" -> tạo AudioContext, chơi giai điệu pentatonic
     (nốt Do Re Mi Sol La) sinh bằng code mỗi 0,55 giây — không cần file nhạc.
     Bấm lần nữa -> tạm dừng. */
  const AudioPlayer = (function () {
    let ctx = null, master = null, playing = false, timer = null, audioEl = null;
    const btn = document.getElementById('btn-media');

    /* Nếu admin đã đặt nhạc (link/file) trong Cài đặt -> phát bài đó;
       nếu không -> giai điệu pentatonic tự sinh (fallback cũ). */
    const settings = Store.getSettings();
    const musicUrl = (settings.musicUrl || '').trim();
    const musicName = (settings.musicName || '').trim() || 'Nhạc quán trà – Chill';
    const titleEl = document.querySelector('.media-info b');
    if (titleEl) titleEl.textContent = musicName;

    function playFile() {
      if (!audioEl) {
        audioEl = new Audio(musicUrl);
        audioEl.loop = true;
        audioEl.addEventListener('ended', () => { playing = false; stopUI(); });
      }
      audioEl.play().catch(() => {
        UI.toast('Không phát được nhạc. Kiểm tra lại link/file trong Cài đặt.', 'warn');
        stopUI();
      });
    }
    function stopUI() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      btn.innerHTML = UI.icon('play') + ' Phát nhạc';
    }

    // giai điệu pentatonic nhẹ (nốt: Do Re Mi Sol La)
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    function pluck(freq, when, dur) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.12, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(gain).connect(master);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    }
    function scheduleLoop() {
      let t = ctx.currentTime + 0.1;
      timer = setInterval(() => {
        if (!playing) return;
        const n = notes[Math.floor(Math.random() * notes.length)];
        pluck(n, t, 1.8);
        t += 0.55;
      }, 550);
    }
    function start() {
      if (musicUrl) { playFile(); playing = true; btn.innerHTML = UI.icon('pause') + ' Tạm dừng'; UI.toast('Đang phát: ' + musicName, 'ok'); return; }
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
      }
      ctx.resume();
      playing = true;
      scheduleLoop();
      btn.innerHTML = UI.icon('pause') + ' Tạm dừng';
      UI.toast('Bắt đầu phát nhạc quán trà', 'ok');
    }
    function stop() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
      btn.innerHTML = UI.icon('play') + ' Phát nhạc';
    }
    btn.addEventListener('click', () => (playing ? stop() : start()));
    return { playing };
  })();

  /* ========== §5.5 Đánh giá website ==========
     Đã đăng nhập: hiện form chọn sao (1-5) + ô bình luận -> gửi qua
     Store.addSiteReview() (POST /api/site-reviews, lưu SQLite).
     Chưa đăng nhập: chỉ hiện link "Đăng nhập".
     Bên dưới: danh sách 8 đánh giá mới nhất. */
  function renderSiteReviews() {
    const box = document.getElementById('site-review-box');
    const list = document.getElementById('site-review-list');
    if (!box || !list) return;
    const user = Store.currentUser();
    const reviews = Store.getSiteReviews();

    // form
    if (user) {
      box.innerHTML =
        '<div class="review-form">' +
        '<div class="review-stars" id="sr-stars">' +
        [1,2,3,4,5].map(n => '<button type="button" class="rv-star" data-v="' + n + '" aria-label="' + n + ' sao">★</button>').join('') +
        '</div>' +
        '<textarea id="sr-text" rows="2" placeholder="Đánh giá website của bạn…"></textarea>' +
        '<button class="btn btn-primary btn-sm" id="sr-submit">Gửi đánh giá</button>' +
        '</div>';
      let picked = 0;
      box.querySelectorAll('.rv-star').forEach(b => {
        b.addEventListener('click', () => {
          picked = Number(b.dataset.v);
          box.querySelectorAll('.rv-star').forEach((x, i) => x.classList.toggle('on', i < picked));
        });
      });
      document.getElementById('sr-submit').addEventListener('click', async () => {
        if (!picked) { UI.toast('Hãy chọn số sao.', 'warn'); return; }
        const comment = document.getElementById('sr-text').value.trim();
        try {
          await Store.addSiteReview({ rating: picked, comment });
          UI.toast('Cảm ơn bạn đã đánh giá website!', 'ok');
          renderSiteReviews();
        } catch (err) {
          UI.toast(err.message, 'danger');
        }
      });
    } else {
      box.innerHTML = '<p style="text-align:center;color:var(--muted)"><a href="login.html">Đăng nhập</a> để đánh giá website.</p>';
    }

    // list
    list.innerHTML = reviews.slice(0, 8).map(r =>
      '<div class="review-item">' +
      '<div class="review-meta"><b>' + UI.esc(r.userName) + '</b><span>' + '★'.repeat(r.rating) + '</span></div>' +
      (r.comment ? '<p>' + UI.esc(r.comment) + '</p>' : '') +
      '<div class="review-time">' + UI.fmtDate(r.created) + '</div>' +
      '</div>'
    ).join('') || '<p style="text-align:center;color:var(--muted)">Chưa có đánh giá nào.</p>';
  }
  renderSiteReviews();

  /* ========== §5.6 Danh mục sản phẩm (trang chủ) ==========
     Vẽ các ô danh mục (Trà sữa / Trà lạnh / Cà phê…) từ bảng categories
     trong SQLite. Đếm số sản phẩm mỗi danh mục. Bấm -> products.html?cat=... */
  function renderHomeCategories() {
    const box = document.getElementById('cat-grid');
    if (!box) return;
    const cats = Store.getCategories();
    const products = Store.getProducts();
    if (!cats.length) return;
    box.innerHTML = cats.map(c => {
      const count = products.filter(p => p.category === c.id).length;
      return (
        '<a class="cat-card" href="products.html?cat=' + encodeURIComponent(c.id) + '">' +
        '<span class="cat-icon">' + (UI.icon('cup') || '') + '</span>' +
        '<b>' + UI.esc(c.name) + '</b>' +
        '<span>' + (count ? count + ' món' : 'Xem menu') + '</span>' +
        '</a>'
      );
    }).join('');
  }
  renderHomeCategories();

  /* ========== 5.7 Câu chuyện thương hiệu (render từ settings) ========== */
  function renderStory() {
    const s = Store.getSettings();
    const imgs = document.getElementById('story-imgs');
    if (imgs) {
      const arr = (s.storyImgs && s.storyImgs.length ? s.storyImgs : ['assets/images/story-1.svg', 'assets/images/story-2.svg', 'assets/images/story-3.svg']);
      imgs.innerHTML = arr.map((src, i) => '<img src="' + UI.esc(src) + '" alt="Ảnh câu chuyện ' + (i + 1) + '">').join('');
    }
    const paras = document.getElementById('story-paras');
    if (paras) {
      const t1 = s.storyText1 || 'Là một thương hiệu đến từ Lâm Đồng, nơi mỗi búp trà được chắt lọc tinh hoa từ đất trời, khí hậu mát lành của vùng cao nguyên. Với ShanCha, mỗi tách trà là một hành trình trở về bản nguyên.';
      const t2 = s.storyText2 || 'Khi thưởng thức các ly trà tại ShanCha, bạn có thể chậm rãi nhâm nhi để cảm nhận trọn vẹn hương vị tự nhiên, hiền hoà trong con người Đà Lạt.';
      paras.innerHTML = '<p>' + UI.esc(t1) + '</p><p>' + UI.esc(t2) + '</p>';
    }
    const stats = document.getElementById('story-stats');
    if (stats) {
      const arr = (s.storyStats && s.storyStats.length ? s.storyStats : [
        { num: '18+', label: 'Món signature' },
        { num: '4.8★', label: 'Đánh giá trung bình' },
        { num: '4 CN', label: 'TP.HCM & Đà Lạt' }
      ]);
      stats.innerHTML = arr.map(st => '<div class="story-stat"><b>' + UI.esc(st.num || '') + '</b><span>' + UI.esc(st.label || '') + '</span></div>').join('');
    }
  }
  renderStory();

  /* ========== 5.8 Nhận xét khách hàng (render từ customer_reviews) ========== */
  function renderCustomerReviews() {
    const box = document.getElementById('customer-review-grid');
    if (!box) return;
    const list = Store.getCustomerReviews();
    box.innerHTML = list.slice(0, 6).map(r =>
      '<div class="review-card">' +
      '<div class="stars">' + '★'.repeat(r.stars) + '</div>' +
      '<blockquote>“' + UI.esc(r.content) + '”</blockquote>' +
      '<div class="review-author">' +
      '<span class="review-avatar">' + UI.esc(r.avatarLetter || (r.author || '?').charAt(0).toUpperCase()) + '</span>' +
      '<span>' + UI.esc(r.author) + (r.city ? ' · ' + UI.esc(r.city) : '') + '</span>' +
      '</div></div>'
    ).join('') || '<p style="text-align:center;color:var(--muted)">Chưa có nhận xét.</p>';
  }
  renderCustomerReviews();

  /* ========== 5.9 % Flash sale hiển thị (từ settings.salePercent) ========== */
  function renderFlashPercent() {
    const el = document.getElementById('flash-percent');
    if (!el) return;
    const p = Number(Store.getSettings().salePercent) || 20;
    el.textContent = '-' + p + '%';
  }
  renderFlashPercent();

  /* ========== §6. Newsletter (nhận ưu đãi) ==========
     Kiểm tra email rồi gửi lên server (POST /api/newsletters) — admin xem
     danh sách trong trang "Newsletter". */
  document.getElementById('newsletter-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('nl-email').value.trim();
    const msg = document.getElementById('nl-msg');
    if (!email) { msg.textContent = 'Vui lòng nhập email.'; msg.style.color = 'var(--danger)'; return; }
    if (!Auth.validEmail(email)) { msg.textContent = 'Email không đúng định dạng.'; msg.style.color = 'var(--danger)'; return; }
    try {
      await Store.addNewsletter(email);
      msg.textContent = 'Đã đăng ký! Bạn sẽ nhận ưu đãi mỗi tuần.';
      msg.style.color = 'var(--ok)';
      document.getElementById('nl-email').value = '';
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = 'var(--danger)';
    }
  });

});
