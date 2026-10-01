# -*- coding: utf-8 -*-
"""Thay emoji bang UI.icon(...) trong toan bo project."""
import io, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

def sub_file(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    n = 0
    for old, new in pairs:
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            n += c
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    return n

# --- ui.js: header / footer / card / drawer ---
ui_pairs = [
    # header cart button
    ("'<span class=\"cart-icon\">🛒</span><span class=\"cart-badge\" id=\"cart-badge\">' + cartN + '</span>'",
     "'<span class=\"cart-icon\">' + UI.icon('cart') + '</span><span class=\"cart-badge\" id=\"cart-badge\">' + cartN + '</span>'"),
    # user name icon
    ("'<span class=\"nav-user-name\">👤 ' + esc(user.name)",
     "'<span class=\"nav-user-name\">' + UI.icon('user') + ' ' + esc(user.name)"),
    # logout
    ("'<a class=\"nav-link\" href=\"#\" id=\"btn-logout\">Đăng xuất</a>'",
     "'<a class=\"nav-link\" href=\"#\" id=\"btn-logout\">' + UI.icon('logout') + ' Đăng xuất</a>'"),
    # footer social (giữ chữ f/ig/tt - đơn sắc nhỏ)
    # product card star
    ("'<div class=\"product-meta\">⭐ ' + p.rating + ' · ' + p.sold + ' đã bán</div>'",
     "'<div class=\"product-meta\">' + UI.icon('star') + ' ' + p.rating + ' · ' + p.sold + ' đã bán</div>'"),
    # modal rating
    ("'<div class=\"modal-rating\">⭐ ' + p.rating + ' · Đã bán ' + p.sold + '</div>'",
     "'<div class=\"modal-rating\">' + UI.icon('star') + ' ' + p.rating + ' · Đã bán ' + p.sold + '</div>'"),
    # drawer close (button content in drawer head)
    ("'<div class=\"drawer-head\"><h3>Giỏ hàng</h3><button class=\"modal-close\" id=\"drawer-close\" aria-label=\"Đóng\">×</button></div>'",
     "'<div class=\"drawer-head\"><h3>Giỏ hàng</h3><button class=\"modal-close\" id=\"drawer-close\" aria-label=\"Đóng\">' + UI.icon('close') + '</button></div>'"),
    # empty cart icon
    ("'<span class=\"cart-empty-icon\">🧋</span>'",
     "'<span class=\"cart-empty-icon\">' + UI.icon('cup') + '</span>'"),
    # cart item delete
    ("'<button class=\"qty-del\" data-act=\"del\" aria-label=\"Xoá\">🗑</button>'",
     "'<button class=\"qty-del\" data-act=\"del\" aria-label=\"Xoá\">' + UI.icon('trash') + '</button>'"),
    # product modal close
    ("'<button class=\"modal-close\" id=\"modal-close\" aria-label=\"Đóng\">×</button>'",
     "'<button class=\"modal-close\" id=\"modal-close\" aria-label=\"Đóng\">' + UI.icon('close') + '</button>'"),
]

# --- cart.js: checkout icon + toast ---
cart_pairs = [
    ("'<button class=\"btn btn-primary btn-block\" id=\"btn-checkout\">Thanh toán</button>'",
     "'<button class=\"btn btn-primary btn-block\" id=\"btn-checkout\">' + UI.icon('check') + ' Thanh toán</button>'"),
]

# --- admin.js: sidebar icons handled in HTML; thao tac buttons ---
admin_pairs = [
    # edit button
    ("'<button class=\"icon-btn\" data-act=\"edit\" title=\"Sửa\">✏️</button>'",
     "'<button class=\"icon-btn\" data-act=\"edit\" title=\"Sửa\">' + UI.icon('edit') + '</button>'"),
    # delete button
    ("'<button class=\"icon-btn danger\" data-act=\"del\" title=\"Xoá\">🗑</button>'",
     "'<button class=\"icon-btn danger\" data-act=\"del\" title=\"Xoá\">' + UI.icon('trash') + '</button>'"),
    # block/unlock
    ("'<button class=\"icon-btn\" data-act=\"block\" title=\"' + (u.blocked ? 'Mở khoá' : 'Khoá') + '\">' + (u.blocked ? '🔓' : '🔒') + '</button>'",
     "'<button class=\"icon-btn\" data-act=\"block\" title=\"' + (u.blocked ? 'Mở khoá' : 'Khoá') + '\">' + UI.icon(u.blocked ? 'unlock' : 'lock') + '</button>'"),
    # detail
    ("'<button class=\"icon-btn\" data-act=\"detail\" title=\"Chi tiết\">👁</button>'",
     "'<button class=\"icon-btn\" data-act=\"detail\" title=\"Chi tiết\">' + UI.icon('eye') + '</button>'"),
    # new product btn (html) -> handled separately
    # logout in admin.html handled in html pass
]

# --- admin.html: sidebar emoji -> icon svg inline (no JS context) ---
admin_html_pairs = [
    ('<button class="active" data-view="dashboard"><span>📊</span><span>Dashboard</span></button>',
     '<button class="active" data-view="dashboard"><span class="nav-ic" data-ic="dash"></span><span>Dashboard</span></button>'),
    ('<button data-view="products"><span>🧋</span><span>Sản phẩm</span></button>',
     '<button data-view="products"><span class="nav-ic" data-ic="cup"></span><span>Sản phẩm</span></button>'),
    ('<button data-view="orders"><span>📦</span><span>Đơn hàng</span></button>',
     '<button data-view="orders"><span class="nav-ic" data-ic="box"></span><span>Đơn hàng</span></button>'),
    ('<button data-view="users"><span>👥</span><span>Khách hàng</span></button>',
     '<button data-view="users"><span class="nav-ic" data-ic="users"></span><span>Khách hàng</span></button>'),
    ('<button data-view="settings"><span>⚙️</span><span>Cài đặt</span></button>',
     '<button data-view="settings"><span class="nav-ic" data-ic="gear"></span><span>Cài đặt</span></button>'),
    ('<button class="btn btn-danger btn-sm btn-block" id="admin-logout">Đăng xuất</button>',
     '<button class="btn btn-danger btn-sm btn-block" id="admin-logout"><span class="nav-ic" data-ic="logout"></span> Đăng xuất</button>'),
    ('<button class="btn btn-primary btn-sm" id="btn-new-product">+ Thêm sản phẩm</button>',
     '<button class="btn btn-primary btn-sm" id="btn-new-product">+ Thêm sản phẩm</button>'),
]

# --- index.html: static emoji in sections ---
index_pairs = [
    ('<span class="cat-icon">🧋</span>', '<span class="cat-icon">' + '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg></span>'),
    ('<span class="cat-icon">🍵</span>', '<span class="cat-icon">' + '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg></span>'),
    ('<span class="cat-icon">☕</span>', '<span class="cat-icon">' + '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg></span>'),
    ('<span class="cat-icon">🧊</span>', '<span class="cat-icon">' + '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="10"/></svg></span>'),
    ('<button class="btn btn-primary" id="btn-geolocate">📍 Tìm chi nhánh gần nhất</button>',
     '<button class="btn btn-primary" id="btn-geolocate"><span class="ic-inline" data-ic="loc"></span> Tìm chi nhánh gần nhất</button>'),
    ('<div class="media-cover">🎵</div>', '<div class="media-cover"><span class="ic-big" data-ic="music"></span></div>'),
    ('<button class="btn btn-accent btn-media" id="btn-media">▶ Phát nhạc</button>',
     '<button class="btn btn-accent btn-media" id="btn-media">▶ Phát nhạc</button>'),
    ('<span class="section-eyebrow">⚡ Flash Sale</span>', '<span class="section-eyebrow">Flash Sale</span>'),
    ('<div class="stars">★★★★★</div>', '<div class="stars">★★★★★</div>'),
]

# --- products.html static ---
# (giữ search icon trong placeholder; không đổi)

total = 0
for path, pairs in [('js/ui.js', ui_pairs), ('js/cart.js', cart_pairs), ('js/admin.js', admin_pairs),
                    ('admin.html', admin_html_pairs), ('index.html', index_pairs)]:
    n = sub_file(path, pairs)
    print(path, '->', n, 'replacements')
    total += n
print('TOTAL', total)
