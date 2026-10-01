# -*- coding: utf-8 -*-
"""Dọn emoji còn sót trong toàn project (thay bằng icon đơn sắc / bỏ icon)."""
import io, os

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

# ---- checkout.html: các option thanh toán + store ----
checkout_pairs = [
    # giữ text thuần cho phương thức thanh toán (bỏ emoji)
    ('🚚 Giao hàng', 'Giao hàng'),
    ('🏪 Nhận tại cửa hàng', 'Nhận tại cửa hàng'),
    ('💵 Tiền mặt (COD)', 'Tiền mặt (COD)'),
    ('💳 Thẻ ngân hàng', 'Thẻ ngân hàng'),
    ('🏦 Chuyển khoản', 'Chuyển khoản'),
    ('🎉', ''),
]

# ---- products.html ----
products_pairs = [
    ('🔍', ''),
    ('🧋', ''),
]

# ---- admin.html ----
admin_pairs = [
    ('🔍', ''),
    ('💾', ''),
]

# ---- js/main.js ----
main_pairs = [
    ("'<div class=\"media-cover\">🎵</div>'", "'<div class=\"media-cover\">' + UI.icon('music') + '</div>'"),
    ("msg.textContent = '✅ Đã đăng ký! Bạn sẽ nhận ưu đãi mỗi tuần.';",
     "msg.textContent = 'Đã đăng ký! Bạn sẽ nhận ưu đãi mỗi tuần.';"),
]

# ---- js/cart.js ----
cart_pairs = [
    ("'<span class=\"cart-empty-icon\">' + UI.icon('cup') + '</span>'", "'<span class=\"cart-empty-icon\">' + UI.icon('cup') + '</span>'"),
    ("'<button class=\"qty-del\" data-act=\"del\" aria-label=\"Xoá\">' + UI.icon('trash') + '</button>'",
     "'<button class=\"qty-del\" data-act=\"del\" aria-label=\"Xoá\">' + UI.icon('trash') + '</button>'"),
]

# ---- js/admin.js ----
admin_js_pairs = [
    ("'<div class=\"product-meta\">⭐ ' + p.rating", "'<div class=\"product-meta\">' + UI.icon('star') + ' ' + p.rating"),
    ("'<button class=\"icon-btn danger\" data-act=\"del\" title=\"Xoá\">' + UI.icon('trash') + '</button>'",
     "'<button class=\"icon-btn danger\" data-act=\"del\" title=\"Xoá\">' + UI.icon('trash') + '</button>'"),
]

# ---- js/admin-login.js ----
adminlogin_pairs = [
    ("'<div class=\"admin-login-shield\">👤</div>'", "'<div class=\"admin-login-shield\"><span class=\"ic-big\" data-ic=\"user\"></span></div>'"),
]

total = 0
for path, pairs in [('checkout.html', checkout_pairs), ('products.html', products_pairs),
                    ('admin.html', admin_pairs), ('js/main.js', main_pairs),
                    ('js/cart.js', cart_pairs), ('js/admin.js', admin_js_pairs),
                    ('js/admin-login.js', adminlogin_pairs)]:
    n = sub_file(path, pairs)
    print(path, '->', n)
    total += n
print('TOTAL', total)
