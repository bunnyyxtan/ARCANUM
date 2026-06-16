import sys
from PIL import Image
import os

def convert_logo(src, dest, size=None, make_transparent_black=False):
    try:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        img = Image.open(src).convert('RGBA')
        
        if make_transparent_black:
            data = img.getdata()
            new_data = []
            for item in data:
                if item[0] < 20 and item[1] < 20 and item[2] < 20:
                    new_data.append((0, 0, 0, 0))
                else:
                    new_data.append(item)
            img.putdata(new_data)
            
        if size:
            img = img.resize(size, Image.Resampling.LANCZOS)
            
        if dest.endswith('.ico'):
            img.save(dest, format='ICO')
        else:
            img.save(dest, format='PNG')
        print(f'Saved {dest}')
    except Exception as e:
        print(f'Error saving {dest}: {e}')

src = r'C:\Users\intel\.gemini\antigravity\brain\67b85f60-0177-4a4d-8bd3-ed0dd66fe61a\media__1781635909330.jpg'

convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\brand\arcanum-logo.png', make_transparent_black=True)
convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\favicon.ico', size=(32,32))
convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\favicon-32x32.png', size=(32,32))
convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\favicon-16x16.png', size=(16,16))
convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\apple-touch-icon.png', size=(180,180))
convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\android-chrome-192x192.png', size=(192,192))
convert_logo(src, r'C:\dev\ARCANUM\apps\web\public\android-chrome-512x512.png', size=(512,512))

convert_logo(src, r'C:\dev\ARCANUM\apps\docs\public\favicon.ico', size=(32,32))
convert_logo(src, r'C:\dev\ARCANUM\apps\docs\public\favicon-32x32.png', size=(32,32))
convert_logo(src, r'C:\dev\ARCANUM\apps\docs\public\favicon-16x16.png', size=(16,16))
convert_logo(src, r'C:\dev\ARCANUM\apps\docs\public\apple-touch-icon.png', size=(180,180))
convert_logo(src, r'C:\dev\ARCANUM\apps\docs\public\android-chrome-192x192.png', size=(192,192))
convert_logo(src, r'C:\dev\ARCANUM\apps\docs\public\android-chrome-512x512.png', size=(512,512))
