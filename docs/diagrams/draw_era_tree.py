#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import math
from PIL import Image, ImageDraw, ImageFont

S = 2  # supersample
W, H = 1200*S, 820*S
img = Image.new("RGB", (W, H), "#ffffff")
d = ImageDraw.Draw(img)

RB = "/home/node/.fonts/NotoSansTC-Bold.otf"
RR = "/home/node/.fonts/NotoSansTC-Regular.otf"
def fb(sz): return ImageFont.truetype(RB, sz*S)
def fr(sz): return ImageFont.truetype(RR, sz*S)

def rr(box, radius, fill, outline, width=2):
    x0,y0,x1,y1 = [v*S for v in box]
    d.rounded_rectangle([x0,y0,x1,y1], radius=radius*S, fill=fill, outline=outline, width=width*S)

def T(xy, s, font, fill="#1f2937"):
    d.text((xy[0]*S, xy[1]*S), s, font=font, fill=fill)

def line(p1,p2,color,width):
    d.line([p1[0]*S,p1[1]*S,p2[0]*S,p2[1]*S], fill=color, width=width*S)

def arrowhead(p, ang, color, size=9):
    x,y = p[0]*S, p[1]*S; a=ang; L=size*S
    p1=(x,y)
    p2=(x-L*math.cos(a-0.4), y-L*math.sin(a-0.4))
    p3=(x-L*math.cos(a+0.4), y-L*math.sin(a+0.4))
    d.polygon([p1,p2,p3], fill=color)

def arrow(p1,p2,color,width=3):
    line(p1,p2,color,width)
    ang=math.atan2(p2[1]-p1[1], p2[0]-p1[0])
    arrowhead(p2,ang,color)

def dashed(p1,p2,color,width=3,dash=9,gap=6):
    x0,y0=p1; x1,y1=p2
    tot=math.hypot(x1-x0,y1-y0); n=max(1,int(tot//(dash+gap)))
    dx=(x1-x0)/tot; dy=(y1-y0)/tot; pos=0
    while pos < tot:
        sx=x0+dx*pos; sy=y0+dy*pos
        ex=x0+dx*min(pos+dash,tot); ey=y0+dy*min(pos+dash,tot)
        line((sx,sy),(ex,ey),color,width); pos+=dash+gap

# ---- palette
BLU="#2563eb"; BLUD="#1d4ed8"; BLUF="#dbeafe"; BLUL="#eff6ff"
ORA="#d97706"; ORAD="#b45309"; ORAF="#fff7ed"
GRN="#059669"; GRNF="#ecfdf5"; GRND="#065f46"
GRY="#6b7280"; SL="#334155"; SL2="#475569"

# ---- Title
T((40,26), "世界紀元樹（World Era Tree）", fb(30))
T((42,74), "世界像一棵可展開的樹．角色永遠活在「當下的節點」．分支＝平行世界，不是把時間倒帶", fr(16), GRY)

# ---- connectors first
arrow((212,253),(266,253),BLU,3)
arrow((452,253),(506,253),BLU,3)
# fork elbow dashed E1 -> B1
dashed((360,296),(360,438),ORA,3)
dashed((360,438),(506,438),ORA,3)
arrowhead((506,438),0,ORA)
# team anchors
arrow((712,250),(758,250),GRN,3)
arrow((742,438),(788,438),GRN,3)

# labels on lines
T((296,180),"主線 · 正史（canon）", fb(15), BLU)
T((150,352),"fork 開新分支（由 DM 決定）", fb(15), ORA)

# ---- nodes
rr((40,210,212,296),12,BLUL,BLU,2)
T((60,224),"E0 · 世界誕生", fb(18))
T((60,256),"初始設定：城鎮、", fr(13), SL2)
T((60,275),"NPC、勢力就位", fr(13), SL2)

rr((268,210,452,296),12,BLUL,BLU,2)
T((288,224),"E1 · 邊境動亂", fb(18))
T((288,256),"變化(diff)：獸人入侵、", fr(13), SL2)
T((288,275),"邊境村莊示警", fr(13), SL2)

rr((508,204,712,316),12,BLUF,BLUD,3)
T((528,218),"E2 · 北城陷落後", fb(18))
T((528,250),"diff：北城被焚毀、", fr(13), SL2)
T((528,269),"領主陣亡", fr(13), SL2)
T((528,290),"◀ 目前正史（current）", fb(12), BLUD)

rr((508,396,742,482),12,ORAF,ORA,2)
T((528,410),"B1 · 平行線：北城未陷", fb(17), ORAD)
T((528,442),"diff：玩家守住北城、", fr(13), "#7c2d12")
T((528,461),"領主存活（另一個現實）", fr(13), "#7c2d12")

rr((760,218,936,282),10,GRNF,GRN,2)
T((780,230),"團 A", fb(16), GRND)
T((780,254),"錨定在 E2 上繼續冒險", fr(12), "#047857")

rr((790,406,966,470),10,GRNF,GRN,2)
T((810,418),"團 B", fb(16), GRND)
T((810,442),"錨定在 B1 這條分支", fr(12), "#047857")

# ---- DM decision
rr((40,560,640,710),14,"#fffbeb",ORA,2)
T((64,576),"DM 的決定：一場團打完之後…", fb(19), ORAD)
T((64,612),"團的結果會改變世界。若和正史衝突，DM 二選一：", fr(15), "#78350f")
T((80,644),"① 併入主線 → 推進正史（canon 往前長一個節點）", fb(15), BLUD)
T((80,674),"② 開新分支 → fork 一條平行世界（不影響主線）", fb(15), ORAD)

# ---- key ideas
rr((668,560,1160,710),14,"#f8fafc","#cbd5e1",2)
T((692,576),"重點觀念", fb(18))
T((692,610),"• 每個節點只記「相對上一節點的變化(diff)」，超省空間", fr(14), SL)
T((692,636),"• 地點／NPC 各自帶著經歷演進（存在→已毀→改變…）", fr(14), SL)
T((692,662),"• 玩家角色進度是「另一層」，餵養團所在的節點", fr(14), SL)
T((692,688),"• 死亡回溯／穿越＝從某節點開分支，不是倒帶時間線", fr(14), SL)

# ---- color legend
def sw(x,fill,outline):
    rr((x,742,x+18,760),4,fill,outline,2)
sw(40,BLUF,BLUD); T((66,742),"主線紀元節點", fr(13), SL)
sw(210,ORAF,ORA); T((236,742),"分支/平行世界", fr(13), SL)
sw(392,GRNF,GRN); T((418,742),"團（錨定在節點）", fr(13), SL)
dashed((600,751),(644,751),ORA,3); T((654,742),"fork（DM 開分支）", fr(13), SL)

# border
d.rectangle([1,1,W-2,H-2], outline="#e5e7eb", width=1*S)

out="/home/node/.openclaw/workspace/agent-color/projects/tmp/world-era-tree.png"
img = img.resize((1200,820), Image.LANCZOS)
img.save(out)
print("saved", out)
