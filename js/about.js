/* ============================================================
   ShanChaStore - about.js
   ============================================================
   FILE NÀY CHẠY CHO: trang Giới thiệu (about.html).

   - Câu chuyện thương hiệu (paras + stats + ảnh) render từ
     Store.getSettings() — giống khối story trên trang chủ.
   - Chi nhánh render từ Store.getStores().
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  await UI.initCommon('about');

  /* ---------- Câu chuyện thương hiệu ---------- */
  function renderStory() {
    const s = Store.getSettings();
    const imgs = document.getElementById('about-story-imgs');
    if (imgs) {
      const arr = (s.storyImgs && s.storyImgs.length ? s.storyImgs : ['assets/images/story-1.svg', 'assets/images/story-2.svg', 'assets/images/story-3.svg']);
      imgs.innerHTML = arr.map((src, i) => '<img src="' + UI.esc(src) + '" alt="Ảnh câu chuyện ' + (i + 1) + '">').join('');
    }
    const paras = document.getElementById('about-story-paras');
    if (paras) {
      const t1 = s.storyText1 || 'Là một thương hiệu đến từ Lâm Đồng, nơi mỗi búp trà được chắt lọc tinh hoa từ đất trời, khí hậu mát lành của vùng cao nguyên. Với ShanCha, mỗi tách trà là một hành trình trở về bản nguyên.';
      const t2 = s.storyText2 || 'Khi thưởng thức các ly trà tại ShanCha, bạn có thể chậm rãi nhâm nhi để cảm nhận trọn vẹn hương vị tự nhiên, hiền hoà trong con người Đà Lạt.';
      paras.innerHTML = '<p>' + UI.esc(t1) + '</p><p>' + UI.esc(t2) + '</p>';
    }
    const stats = document.getElementById('about-story-stats');
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

  /* ---------- Giá trị cốt lõi (render từ settings.aboutValues) ---------- */
  function renderValues() {
    const grid = document.getElementById('about-values-grid');
    if (!grid) return;
    const s = Store.getSettings();
    const list = (s.aboutValues && s.aboutValues.length ? s.aboutValues : [
      { icon: 'leaf',  title: 'Nguyên liệu thật', desc: 'Trà nguyên chất từ vùng cao Đà Lạt, chọn lọc từng búp trà theo mùa.' },
      { icon: 'flask', title: 'Pha chế thủ công', desc: 'Mỗi ly được pha chế tỉ mỉ bởi đội ngũ barista đam mê trà.' },
      { icon: 'heart', title: 'Chăm sóc khách', desc: 'Không gian ấm cúng, phục vụ tận tâm — khách là người nhà.' },
      { icon: 'tag',   title: 'Giá minh bạch', desc: 'Giá công bằng cho chất lượng thật, ưu đãi rõ ràng cho khách quen.' }
    ]);
    grid.innerHTML = list.map(v =>
      '<div class="about-value">' +
      '<span class="ic-big">' + (UI.icon(v.icon || 'leaf') || '') + '</span>' +
      '<h3>' + UI.esc(v.title || '') + '</h3>' +
      '<p>' + UI.esc(v.desc || '') + '</p>' +
      '</div>'
    ).join('');
  }
  renderValues();

  /* ---------- Hành trình (render từ settings.aboutJourney) ---------- */
  function renderJourney() {
    const tl = document.getElementById('about-journey');
    if (!tl) return;
    const s = Store.getSettings();
    const list = (s.aboutJourney && s.aboutJourney.length ? s.aboutJourney : [
      { year: '2019', desc: 'Khởi nguồn từ một xe trà nhỏ trên đường 3/2, Đà Lạt với đúng 3 món trà sữa.' },
      { year: '2021', desc: 'Mở chi nhánh đầu tiên tại TP.HCM, đưa hương trà cao nguyên về thành phố.' },
      { year: '2023', desc: 'Ra mắt bộ sưu tập trà signature: Ôlong Gạo Rang, Hojicha Caramel Mặn, Matcha Hạt Sen…' },
      { year: '2026', desc: 'ShanCha Store — mua trà online mọi lúc mọi nơi, giao tận nơi hoặc nhận tại quán.' }
    ]);
    tl.innerHTML = list.map(j =>
      '<div class="about-step">' +
      '<b>' + UI.esc(j.year || '') + '</b>' +
      '<p>' + UI.esc(j.desc || '') + '</p>' +
      '</div>'
    ).join('');
  }
  renderJourney();

  /* ---------- Chi nhánh ---------- */
  function renderStores() {
    const grid = document.getElementById('about-stores-grid');
    if (!grid) return;
    const list = Store.getStores();
    grid.innerHTML = list.map(s => (
      '<div class="store-card">' +
      '<h3>' + UI.esc(s.name) + '</h3>' +
      '<p>' + UI.icon('loc') + ' ' + UI.esc(s.address) + '</p>' +
      '<p>' + UI.icon('clock') + ' ' + UI.esc(s.hours) + '</p>' +
      '<p>' + UI.icon('phone') + ' ' + UI.esc(s.phone) + '</p>' +
      '<button class="btn btn-outline btn-sm" data-dir="' + s.lat + ',' + s.lng + '">Chỉ đường</button>' +
      '</div>'
    )).join('');
    grid.querySelectorAll('[data-dir]').forEach(b => {
      b.addEventListener('click', () => {
        const [la, ln] = b.dataset.dir.split(',');
        window.open('https://www.google.com/maps/dir/?api=1&destination=' + la + ',' + ln, '_blank');
      });
    });
  }
  renderStores();
});
