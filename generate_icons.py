from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size):
    img = Image.new('RGB', (size, size), (8, 14, 29))
    d = ImageDraw.Draw(img)
    pad = size * 0.15
    chart_bottom = size * 0.80
    chart_left = pad
    chart_right = size - pad
    chart_width = chart_right - chart_left
    bars = [0.38, 0.58, 0.46, 0.88]
    n = len(bars)
    slot = chart_width / n
    bar_w = slot * 0.52
    max_h = size * 0.50
    bar_colors = [(99,102,241),(74,222,128),(99,102,241),(74,222,128)]
    bar_centers = []
    for i,(h_pct,color) in enumerate(zip(bars,bar_colors)):
        x = chart_left + i*slot + (slot-bar_w)/2
        bar_h = max_h * h_pct
        y_top = chart_bottom - bar_h
        r = bar_w * 0.3
        d.rounded_rectangle([x,y_top,x+bar_w,chart_bottom], radius=r, fill=(*color,255))
        bar_centers.append(x + bar_w/2)
    lw = max(2, size//52)
    line_pts = [(bar_centers[i], chart_bottom - max_h*bars[i] - size*0.04) for i in range(n)]
    for i in range(n-1):
        d.line([line_pts[i],line_pts[i+1]], fill=(248,113,113), width=lw)
    dot_r = max(3, size//44)
    for px,py in line_pts:
        d.ellipse([px-dot_r,py-dot_r,px+dot_r,py+dot_r], fill=(248,113,113))
    font_size = max(10, int(size*0.18))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    text = "R$"
    bbox = d.textbbox((0,0), text, font=font)
    tw = bbox[2]-bbox[0]
    d.text(((size-tw)/2+2, size*0.05+2), text, fill=(0,0,0,120), font=font)
    d.text(((size-tw)/2, size*0.05), text, fill=(167,139,250), font=font)
    d.line([(int(pad),int(chart_bottom)),(int(size-pad),int(chart_bottom))], fill=(255,255,255,30), width=max(1,size//128))
    mask = Image.new('L',(size,size),0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0,0,size-1,size-1], radius=int(size*0.20), fill=255)
    result = Image.new('RGBA',(size,size),(0,0,0,0))
    result.paste(img, mask=mask)
    return result

base = "android/app/src/main/res"

sizes = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}
for folder, sz in sizes.items():
    path = f"{base}/{folder}"
    os.makedirs(path, exist_ok=True)
    icon = make_icon(sz)
    bg = Image.new('RGB', (sz, sz), (8, 14, 29))
    bg.paste(icon, mask=icon.split()[3])
    bg.save(f"{path}/ic_launcher.png")
    bg.save(f"{path}/ic_launcher_round.png")
    print(f"  {folder}: {sz}x{sz}")

fg_sizes = {
    "mipmap-mdpi":    108,
    "mipmap-hdpi":    162,
    "mipmap-xhdpi":   216,
    "mipmap-xxhdpi":  324,
    "mipmap-xxxhdpi": 432,
}
for folder, sz in fg_sizes.items():
    path = f"{base}/{folder}"
    os.makedirs(path, exist_ok=True)
    icon = make_icon(sz)
    icon.save(f"{path}/ic_launcher_foreground.png")

print("Icones gerados com sucesso!")
