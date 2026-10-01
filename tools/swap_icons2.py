# -*- coding: utf-8 -*-
"""Thay emoji con lai bang icon don sac (SVG inline / UI.icon)."""
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

# ============ login.html ============
login_pairs = [
    # note icon (giữ ⚠ -> icon inline)
    ('⚠️ <b>Lưu ý:</b>', '<span class="ic-inline" data-ic="warn"></span> <b>Lưu ý:</b>'),
    # demo hint
    ('Tài khoản demo: <b>user / 123456</b> — Admin: <b>admin / admin123</b>',
     'Tài khoản demo: <b>user / 123456</b> — Admin: <b>admin / admin123</b>'),
]

# ============ checkout.html ============
checkout_pairs = [
    # 🔒 login gate (JS template string trong checkout.js) -> xử lý ở JS
    # 💵 COD / 💳 / 🏦 -> giữ text thuần (bỏ icon)
]

# ============ admin-login.html ============
adminlogin_pairs = [
    ('<div class="admin-login-shield">🔐</div>', '<div class="admin-login-shield"><span class="ic-big" data-ic="lock"></span></div>'),
    ('<div class="admin-login-shield">👤</div>', '<div class="admin-login-shield"><span class="ic-big" data-ic="user"></span></div>'),
    ('Tài khoản demo: <b>admin / admin123</b> &nbsp;·&nbsp;', 'Tài khoản demo: <b>admin / admin123</b> &nbsp;·&nbsp;'),
]

# ============ js/main.js ============
main_pairs = [
    ("UI.toast('Đã tìm thấy chi nhánh gần bạn!', 'ok');", "UI.toast('Đã tìm thấy chi nhánh gần bạn!', 'ok');"),
    ("geoStatus.textContent = 'Bạn cách ' + near.name + ' khoảng ' + km + ' km.';",
     "geoStatus.textContent = 'Bạn cách ' + near.name + ' khoảng ' + km + ' km.';"),
]

# ============ js/checkout.js (gate 🔒) ============
checkout_js_pairs = [
    ("'<div style=\"font-size:3rem\">🔒</div>'",
     "'<div style=\"font-size:3rem\">' + UI.icon('lock') + '</div>'"),
    ("'<div style=\"font-size:3rem\">🧋</div>'",
     "'<div style=\"font-size:3rem\">' + UI.icon('cup') + '</div>'"),
]

# ============ js/login.js (toast 🎉 👋) ============
login_js_pairs = [
    ("UI.toast('Đăng nhập thành công! Chào ' + res.user.name + ' 👋', 'ok');",
     "UI.toast('Đăng nhập thành công! Chào ' + res.user.name, 'ok');"),
    ("UI.toast('Tạo tài khoản thành công! 🎉', 'ok');",
     "UI.toast('Tạo tài khoản thành công!', 'ok');"),
]

# ============ js/admin-login.js (👑) ============
adminlogin_js_pairs = [
    ("UI.toast('Đăng nhập quản trị thành công! 👑', 'ok');",
     "UI.toast('Đăng nhập quản trị thành công!', 'ok');"),
]

total = 0
for path, pairs in [('login.html', login_pairs), ('checkout.html', checkout_pairs),
                    ('admin-login.html', adminlogin_pairs), ('js/main.js', main_pairs),
                    ('js/checkout.js', checkout_js_pairs), ('js/login.js', login_js_pairs),
                    ('js/admin-login.js', adminlogin_js_pairs)]:
    n = sub_file(path, pairs)
    print(path, '->', n)
    total += n
print('TOTAL', total)
