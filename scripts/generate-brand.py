"""Rasterize Swipe's simple code-owned S mark for Expo icon sizes."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent.parent

def mark(size, transparent=False, monochrome=False):
    scale=3
    im=Image.new('RGBA',(size*scale,size*scale),(0,0,0,0) if transparent else '#23251F')
    draw=ImageDraw.Draw(im)
    factor=size*scale/1024
    segments=[((650,310),(540,240),(350,260),(350,390)),((350,390),(350,505),(640,480),(640,610)),((640,610),(640,740),(430,755),(320,680))]
    points=[]
    for a,b,c,d in segments:
        for i in range(101):
            t=i/100
            points.append(tuple(factor*((1-t)**3*a[j]+3*(1-t)**2*t*b[j]+3*(1-t)*t*t*c[j]+t**3*d[j]) for j in range(2)))
    ink='#FFFFFF' if monochrome else '#FAFAF7'
    draw.line(points,fill=ink,width=round(94*factor),joint='curve')
    for x,y in (points[0],points[-1]):
        r=47*factor
        draw.ellipse((x-r,y-r,x+r,y+r),fill=ink)
    draw.ellipse(tuple(v*factor for v in (692,672,788,768)),fill=ink if monochrome else '#A9B58B')
    return im.resize((size,size),Image.Resampling.LANCZOS)
mark(1024).save(ROOT/'assets/icon.png')
mark(64).save(ROOT/'assets/favicon.png')
mark(1024,True).save(ROOT/'assets/android-icon-foreground.png')
mark(1024,True,True).save(ROOT/'assets/android-icon-monochrome.png')
