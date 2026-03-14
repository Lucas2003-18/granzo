#!/usr/bin/env python3
"""Gera ícone de notificação monocromático (branco sobre transparente) para Android."""
from PIL import Image, ImageDraw, ImageFont
import os

SIZES = {
    "mdpi": 24,
    "hdpi": 36,
    "xhdpi": 48,
    "xxhdpi": 72,
    "xxxhdpi": 96,
}

def generate_notif_icon():
    for density, size in SIZES.items():
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Círculo de fundo semi-transparente
        padding = max(1, size // 12)
        draw.ellipse([padding, padding, size - padding, size - padding], fill=(255, 255, 255, 255))
        
        # Letra "G" centralizada em cor escura (aparece como recorte)
        font_size = int(size * 0.55)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        bbox = draw.textbbox((0, 0), "G", font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (size - tw) // 2 - bbox[0]
        ty = (size - th) // 2 - bbox[1]
        draw.text((tx, ty), "G", fill=(0, 0, 0, 0), font=font)
        
        # Abordagem alternativa: G branco sobre fundo transparente (melhor para Android)
        img2 = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw2 = ImageDraw.Draw(img2)
        
        # Desenha um "G" estilizado branco
        margin = size // 6
        # Arco do G
        draw2.arc([margin, margin, size - margin, size - margin], 30, 330, fill=(255, 255, 255, 255), width=max(2, size // 10))
        # Barra horizontal do G
        mid_y = size // 2
        draw2.line([(size // 2, mid_y), (size - margin, mid_y)], fill=(255, 255, 255, 255), width=max(2, size // 10))
        # Barra vertical do G
        draw2.line([(size - margin, mid_y), (size - margin, mid_y + size // 6)], fill=(255, 255, 255, 255), width=max(2, size // 10))
        
        out_dir = f"android/app/src/main/res/drawable-{density}"
        os.makedirs(out_dir, exist_ok=True)
        img2.save(f"{out_dir}/ic_notif.png")
        print(f"  {density}: {size}x{size} -> {out_dir}/ic_notif.png")

if __name__ == "__main__":
    print("Gerando ícones de notificação...")
    generate_notif_icon()
    print("Done!")
