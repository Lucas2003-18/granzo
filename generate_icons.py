"""
Granzo — gerador de ícones Android
Renderiza o SVG oficial do Granzo em todos os tamanhos necessários.
"""
from PIL import Image, ImageDraw
import math, os

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i]-c1[i])*t) for i in range(3))

def make_granzo_icon(size):
    VB = 192
    S  = size * 4
    sc = S / VB

    img = Image.new('RGB', (S, S), (0, 0, 0))
    bg_c = hex2rgb('#1A1C2E')
    bg_e = hex2rgb('#0F101A')
    px = img.load()
    half = S / 2
    for y in range(S):
        for x in range(S):
            t = min(1.0, math.sqrt(((x-half)/half)**2 + ((y-half)/half)**2))
            px[x, y] = lerp_color(bg_c, bg_e, t)

    d = ImageDraw.Draw(img)
    cx = cy = S / 2

    r_mid = 64 * sc
    sw    = 24 * sc
    r_out = r_mid + sw / 2
    r_in  = r_mid - sw / 2
    gx1, gy1 = 40*sc, 40*sc
    gx2, gy2 = 152*sc, 152*sc
    g_len_sq = (gx2-gx1)**2 + (gy2-gy1)**2
    ring_s = hex2rgb('#6095FF')
    ring_e = hex2rgb('#3D21EC')

    for i in range(1440):
        a1 = math.radians(i * 360/1440)
        a2 = math.radians((i+1) * 360/1440)
        am = (a1+a2)/2
        pmx = cx + r_mid*math.cos(am)
        pmy = cy + r_mid*math.sin(am)
        t = ((pmx-gx1)*(gx2-gx1)+(pmy-gy1)*(gy2-gy1)) / g_len_sq
        color = lerp_color(ring_s, ring_e, t)
        poly = [
            (cx+r_out*math.cos(a1), cy+r_out*math.sin(a1)),
            (cx+r_out*math.cos(a2), cy+r_out*math.sin(a2)),
            (cx+r_in *math.cos(a2), cy+r_in *math.sin(a2)),
            (cx+r_in *math.cos(a1), cy+r_in *math.sin(a1)),
        ]
        d.polygon(poly, fill=color)

    d.ellipse([cx-r_in, cy-r_in, cx+r_in, cy+r_in], fill=hex2rgb('#0F101A'))

    green = hex2rgb('#4ADE80')
    lw    = max(1, int(16 * sc))
    cap_r = lw // 2

    def pt(x, y): return (x*sc, y*sc)

    segs = [
        (pt(56,120),  pt(88,88)),
        (pt(88,88),   pt(112,112)),
        (pt(112,112), pt(152,72)),
        (pt(152,72),  pt(136,72)),
        (pt(152,72),  pt(152,88)),
    ]
    for p1, p2 in segs:
        d.line([p1, p2], fill=green, width=lw)

    for p in [pt(56,120), pt(88,88), pt(112,112), pt(136,72), pt(152,88), pt(152,72)]:
        d.ellipse([p[0]-cap_r, p[1]-cap_r, p[0]+cap_r, p[1]+cap_r], fill=green)

    result_full = img.resize((size, size), Image.LANCZOS)
    rx = int(40 * size / VB)
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size-1, size-1], radius=rx, fill=255)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(result_full, mask=mask)
    return result


def save_icon(icon, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bg = Image.new('RGB', icon.size, (15, 16, 26))
    bg.paste(icon, mask=icon.split()[3])
    bg.save(path)
    print(f"  OK {path}")


ANDROID_SIZES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

BASE = 'android/app/src/main/res'

if __name__ == '__main__':
    print("Gerando icones Granzo...")
    for folder, size in ANDROID_SIZES.items():
        icon = make_granzo_icon(size)
        save_icon(icon, f'{BASE}/{folder}/ic_launcher.png')
        save_icon(icon, f'{BASE}/{folder}/ic_launcher_round.png')
    fg = make_granzo_icon(192)
    save_icon(fg, f'{BASE}/mipmap-xxxhdpi/ic_launcher_foreground.png')
    print("Icones gerados!")
