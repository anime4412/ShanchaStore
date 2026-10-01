#!/usr/bin/env python3
"""Generate SVG assets for ShanchaStore (offline, no network)."""
import os, math

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "images")
os.makedirs(BASE, exist_ok=True)

# ---- palette (tea brand: cream bg, amber/brown, green) ----
TEAS = [
    # name, base color, accent, label, cup color
    ("tra-sua-olong",      "#C89B6D", "#7A4E2D", "Tr\u00e0 S\u1eefa \u00d4long", "#8a5a2b"),
    ("hong-tra-sua",       "#B5654A", "#6E3521", "H\u1ed3ng Tr\u00e0 S\u1eefa", "#7a3f28"),
    ("tra-sua-nhai",       "#9CB380", "#5C7A3A", "Tr\u00e0 S\u1eefa Nh\u00e0i", "#5c7a3a"),
    ("tra-sua-phong-lan",  "#D9B48F", "#8A5A2B", "Tr\u00e0 S\u1eefa Phong Lan", "#8a5a2b"),
    ("tra-sua-olong-gao-rang", "#B08A5A", "#6E4A22", "\u00d4long G\u1ea1o Rang", "#6e4a22"),
    ("tra-sua-bach-dao",   "#F2C4A0", "#C97B4A", "Tr\u00e0 S\u1eefa B\u1ea1ch \u0110\u00e0o", "#c97b4a"),
    ("tra-dao",            "#F2A65A", "#C97B4A", "Tr\u00e0 \u0110\u00e0o", "#e8913a"),
    ("tra-pho",            "#C0A578", "#7A6A3A", "Tr\u00e0 Ph\u1edf", "#8a7a4a"),
    ("tra-le-chi-nhai",    "#A8C3A0", "#5C7A3A", "Tr\u00e0 L\u1ec7 Chi Nh\u00e0i", "#5c7a3a"),
    ("tra-nhan-hong-dalat","#E8A87C", "#B5654A", "Tr\u00e0 Nh\u00e3n H\u1ed3ng \u0110\u00e0 L\u1ea1t", "#c97b4a"),
    ("tra-me-muoi-ot-mexico","#D9A15A", "#8A5A2B", "Tr\u00e0 Me Mu\u1ed1i \u1ed8t Mexico", "#b5654a"),
    ("khoai-mon-sua-dua",  "#BFA0C8", "#7A5A8A", "Khoai M\u00f4n S\u1eefa D\u1eeba", "#7a5a8a"),
    ("hojicha-caramel-man","#8B6B4A", "#5A3E22", "Hojicha Caramel M\u1eb7n", "#6e4a22"),
    ("matcha-hat-sen",     "#A8C3A0", "#5C7A3A", "Matcha H\u1ea1t Sen", "#4f6f33"),
    ("ca-phe-caramel-man", "#7A5A3A", "#4A3420", "C\u00e0 Ph\u00ea Caramel M\u1eb7n", "#4a3420"),
    ("ca-phe-sua-tuoi",    "#8B6B4A", "#4A3420", "C\u00e0 Ph\u00ea S\u1eefa T\u01b0\u01a1i", "#5a3e22"),
    ("ca-phe-sua-da",      "#6E4A2E", "#3E2A18", "C\u00e0 Ph\u00ea S\u1eefa \u0110\u00e1", "#4a3420"),
    ("ca-phe-den-da",      "#4A3420", "#2E1F12", "C\u00e0 Ph\u00ea \u0110en \u0110\u00e1", "#2e1f12"),
]

def product_svg(name, base, accent, label, cup):
    """A drink cup illustration with circle badge."""
    w, h = 600, 600
    g = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
    g += f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
    g += f'<stop offset="0" stop-color="{base}"/><stop offset="1" stop-color="{accent}"/></linearGradient>'
    g += f'<linearGradient id="cup" x1="0" y1="0" x2="0" y2="1">'
    g += f'<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.25" stop-color="{cup}"/><stop offset="1" stop-color="{accent}"/></linearGradient></defs>'
    # bg
    g += f'<rect width="{w}" height="{h}" fill="url(#bg)" rx="28"/>'
    # soft circle
    g += f'<circle cx="300" cy="300" r="210" fill="rgba(255,255,255,0.12)"/>'
    # cup body
    g += f'<path d="M210 240 L230 470 A70 70 0 0 0 370 470 L390 240 Z" fill="url(#cup)" stroke="rgba(0,0,0,0.12)" stroke-width="6"/>'
    # cup opening ellipse
    g += f'<ellipse cx="300" cy="240" rx="92" ry="26" fill="#FFFFFF" opacity="0.9"/>'
    # tea surface
    g += f'<ellipse cx="300" cy="240" rx="76" ry="18" fill="{accent}" opacity="0.85"/>'
    # straw
    g += f'<rect x="352" y="120" width="16" height="140" rx="8" fill="{accent}" transform="rotate(-8 360 190)"/>'
    # pearls at bottom
    for i in range(5):
        px = 260 + (i % 3) * 26 + (i // 3) * 10
        py = 430 + (i % 2) * 22
        g += f'<circle cx="{px}" cy="{py}" r="12" fill="#3E2A1A" opacity="0.9"/>'
    # steam
    for i in range(3):
        sx = 240 + i * 36
        g += f'<path d="M{sx} 180 q 8 -14 0 -26 q -8 -12 0 -24" stroke="rgba(255,255,255,0.5)" stroke-width="5" fill="none" stroke-linecap="round"/>'
    # label
    g += f'<rect x="120" y="520" width="360" height="52" rx="26" fill="rgba(0,0,0,0.35)"/>'
    g += f'<text x="300" y="554" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">{label}</text>'
    g += '</svg>'
    with open(os.path.join(BASE, name + ".svg"), "w", encoding="utf-8") as f:
        f.write(g)
    print("product", name)

for t in TEAS:
    product_svg(*t)

# ---- banners (slider) ----
def banner(name, text, sub, c1, c2):
    w, h = 1920, 800
    g = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
    g += f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
    g += f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
    g += f'<rect width="{w}" height="{h}" fill="url(#bg)"/>'
    g += f'<circle cx="1500" cy="150" r="380" fill="rgba(255,255,255,0.08)"/>'
    g += f'<circle cx="1700" cy="650" r="300" fill="rgba(255,255,255,0.06)"/>'
    g += f'<circle cx="300" cy="680" r="220" fill="rgba(255,255,255,0.05)"/>'
    g += f'<rect x="120" y="250" width="560" height="10" rx="5" fill="rgba(255,255,255,0.7)"/>'
    g += f'<text x="120" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="88" font-weight="800" fill="#FFFFFF">{text}</text>'
    g += f'<text x="122" y="480" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="rgba(255,255,255,0.92)">{sub}</text>'
    g += '</svg>'
    with open(os.path.join(BASE, name + ".svg"), "w", encoding="utf-8") as f:
        f.write(g)
    print("banner", name)

banner("banner-1", "S\u01a0N TR\u00c0", "Tr\u00e0 tr\u00ean n\u00fai - h\u01b0\u01a1ng v\u1ecb t\u1eeb \u0110\u00e0 L\u1ea1t", "#C89B6D", "#7A4E2D")
banner("banner-2", "SIGNATURE TEA", "C\u00f4ng th\u1ee9c truy\u1ec1n th\u1ed1ng chu\u1ea9n v\u1ecb", "#8B6B4A", "#4A3420")
banner("banner-3", "FLASH SALE", "Gi\u1ea3m \u0111\u1ebfn 30% cho tr\u00e0 s\u1eefa \u00f4long", "#9CB380", "#5C7A3A")

# logo (text) + favicon
logo = '''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48" viewBox="0 0 200 48">
<text x="10" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#7A4E2D">ShanCha</text>
<text x="172" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#C97B4A">STORE</text>
</svg>'''
with open(os.path.join(BASE, "logo.svg"), "w", encoding="utf-8") as f:
    f.write(logo)

favicon = '''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#7A4E2D"/>
<path d="M18 22 L22 46 A6 6 0 0 0 42 46 L46 22 Z" fill="#F2C4A0"/>
<ellipse cx="32" cy="22" rx="14" ry="5" fill="#fff"/>
<text x="32" y="52" text-anchor="middle" font-family="Segoe UI, Arial" font-size="18" font-weight="800" fill="#FFF">S</text>
</svg>'''
with open(os.path.join(BASE, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(favicon)

# story images (tea garden scenes)
import random
random.seed(7)
for i, (label, c1, c2) in enumerate([
    ("story-1", "#7A9E6B", "#4F6F33"),
    ("story-2", "#C9A87C", "#8A6A3A"),
    ("story-3", "#8BAE7E", "#5C7A3A"),
], 1):
    g = f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">'
    g += f'<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
    g += f'<rect width="800" height="600" fill="url(#b)"/>'
    # hills
    g += f'<path d="M0 420 Q 200 320 400 400 T 800 380 L800 600 L0 600 Z" fill="rgba(0,0,0,0.15)"/>'
    # sun
    g += f'<circle cx="620" cy="150" r="70" fill="rgba(255,255,255,0.35)"/>'
    # tea bushes
    for _ in range(24):
        x = random.randint(20, 780); y = random.randint(400, 560)
        g += f'<ellipse cx="{x}" cy="{y}" rx="{random.randint(18, 34)}" ry="{random.randint(10, 18)}" fill="rgba(30,70,40,0.5)"/>'
    g += f'<text x="400" y="560" text-anchor="middle" font-family="Segoe UI, Arial" font-size="30" font-weight="700" fill="rgba(255,255,255,0.9)">{"Story Image " + str(i)} - Sh&#x1B0;n Tr&#xE0;</text>'
    g += '</svg>'
    with open(os.path.join(BASE, label + ".svg"), "w", encoding="utf-8") as f:
        f.write(g)

print("DONE. Total files:", len(os.listdir(BASE)))