#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import math
from PIL import Image, ImageDraw, ImageFont

S = 2
W, H = 1200*S, 860*S
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
def ah(p, ang, color, size=9):
    x,y=p[0]*S,p[1]*S; L=size*S
    d.polygon([(x,y),(x-L*math.cos(ang-0.4),y-L*math.sin(ang-0.4)),
               (x-L*math.cos(ang+0.4),y-L*math.sin(ang+0.4))], fill=color)
def arrow(p1,p2,color,width=3):
    line(p1,p2,color,width); ah(p2, math.atan2(p2[1]-p1[1],p2[0]-p1[0]), color)
def dot(x,y,color):
    d.ellipse([x*S-3*S,y*S-3*S,x*S+3*S,y*S+3*S], fill=color)
def bullet(x,y,title,font_t,ct,sub=None,cs="#475569"):
    dot(x, y+9, ct); T((x+14,y),title,font_t,ct)
    if sub: T((x+14,y+22),sub,fr(12),cs)

BLU="#2563eb"; BLUF="#eff6ff"; TEA="#0d9488"; TEAF="#f0fdfa"
PUR="#7c3aed"; PURF="#f5f3ff"; GRN="#059669"; GRNF="#ecfdf5"
ORA="#d97706"; ORAF="#fff7ed"; ORAD="#b45309"; SL="#334155"; GRY="#6b7280"; IND="#4338ca"

# Title
T((40,22),"DM 管理地圖：一個世界要怎麼顧", fb(28))
T((42,66),"從建構、設計、開團到推進 —— 各元件的關係一次看懂", fr(16), GRY)

# Banner
rr((40,104,1160,158),10,"#eef2ff","#c7d2fe",2)
T((60,120),"身為 DM，你要管理的元件與它們的流程（① → ② → ③ → ④，並不斷回饋給紀元樹）", fb(17), IND)

# columns
cw=265; cy0=180; cy1=628
cx=[40,325,610,895]
cols=[
 ("① 打地基 · 世界層", None, BLU, BLUF,
   [("世界","名稱 / 備註 / 封面"),
    ("世界規則","allowPactFamiliar 等開關")]),
 ("② 建構世界觀 · 素材庫", "（可重用的積木）", TEA, TEAF,
   [("NPC","人物 / 派系成員"),
    ("地點 / 地圖","城鎮、地城、據點"),
    ("勢力 / 派系","關係與立場"),
    ("線索","伏筆 / 情報")]),
 ("③ 設計冒險", "（用 ② 的素材組裝）", PUR, PURF,
   [("任務 Quests","目標 / 獎勵 / 分支"),
    ("事件 Events","觸發劇情節點"),
    ("遭遇 Encounters","戰鬥 / 挑戰配置"),
    ("關聯素材","綁定 NPC / 地點")]),
 ("④ 開團 & 現場運行", None, GRN, GRNF,
   [("團 / 玩家","錨定到某紀元節點"),
    ("指令中心","扣血/治療/給物/情報"),
    ("訊息模板","骰子驅動的通知"),
    ("玩家快照存檔","代管備份 / 可回送恢復")]),
]
for i,(title,note,c,cf,items) in enumerate(cols):
    x=cx[i]
    rr((x,cy0,x+cw,cy1),12,cf,c,2)
    line((x+16,cy0+40),(x+cw-16,cy0+40),c,2)
    T((x+16,cy0+12),title,fb(16),c)
    yy=cy0+56
    if note:
        T((x+16,yy),note,fr(12.5),GRY); yy+=26
    for t,sub in items:
        bullet(x+18,yy,t,fb(14.5),SL,sub); yy+=58

# horizontal flow arrows
for i in range(3):
    xa=cx[i]+cw; xb=cx[i+1]
    arrow((xa+2,404),(xb-2,404),"#64748b",3)

# ===== era tree spine =====
rr((40,662,1160,812),12,ORAF,ORA,2)
T((60,676),"世界紀元樹（貫穿全局 · 世界狀態的骨幹）", fb(19), ORAD)
T((60,712),"• 有序節點：主線 canon ＋ 可 fork 分支（平行世界）", fr(14.5), SL)
T((60,740),"• 每場冒險的結果 → DM 推進節點（新 diff）或開新分支", fr(14.5), SL)
T((60,768),"• 節點決定 NPC／地點／任務 的「當前狀態」——換節點就換世界", fr(14.5), SL)

# feedback loop arrows
arrow((1030,628),(1030,660),GRN,3)               # run result -> tree
T((828,634),"④ 運行結果回饋給節點", fb(13), GRN)
arrow((300,660),(300,628),ORA,3)                 # tree -> setting/design update
T((316,634),"推進後：更新狀態 / 解鎖後續（餵回 ②③）", fb(13), ORAD)

d.rectangle([1,1,W-2,H-2], outline="#e5e7eb", width=1*S)
img = img.resize((1200,860), Image.LANCZOS)
out="/home/node/.openclaw/workspace/agent-color/projects/tmp/dm-management-map.png"
img.save(out)
print("saved", out)
