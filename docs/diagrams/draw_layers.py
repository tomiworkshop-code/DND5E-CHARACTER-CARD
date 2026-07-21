#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import math
from PIL import Image, ImageDraw, ImageFont

S = 2
W, H = 1200*S, 880*S
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
    x,y=p[0]*S,p[1]*S; L=size*S
    d.polygon([(x,y),(x-L*math.cos(ang-0.4),y-L*math.sin(ang-0.4)),
               (x-L*math.cos(ang+0.4),y-L*math.sin(ang+0.4))], fill=color)
def arrow(p1,p2,color,width=3):
    line(p1,p2,color,width)
    arrowhead(p2, math.atan2(p2[1]-p1[1],p2[0]-p1[0]), color)

BLU="#2563eb"; BLUD="#1d4ed8"; BLUF="#dbeafe"
ORA="#d97706"; ORAD="#b45309"; ORAF="#fff7ed"
GRN="#059669"; GRNF="#ecfdf5"; GRND="#065f46"
PUR="#7c3aed"; PURF="#f5f3ff"; PURD="#5b21b6"
GRY="#6b7280"; SL="#334155"; NEU="#f1f5f9"; NEUB="#94a3b8"

# Title
T((40,24), "三層如何互動：玩家角色 × 紀元樹節點 × 任務", fb(28))
T((42,68), "誰存什麼、誰影響誰 — 一次看懂", fr(16), GRY)

# ===== connectors first =====
arrow((370,178),(432,172),GRN,3)                 # A->B
arrow((735,172),(797,180),GRY,3)                 # B->C
line((700,478),(852,296),"#94a3b8",3)            # C<->D 單線雙箭頭
arrowhead((852,296), math.atan2(296-478,852-700), BLU)
arrowhead((700,478), math.atan2(478-296,700-852), PUR)
arrow((980,290),(980,478),BLU,3)                 # C->E 推進
arrow((735,565),(797,565),GRY,3)                 # D->E 關聯
arrow((150,275),(505,478),GRN,3)                 # A->D 玩家挑戰

# arrow labels
T((372,150),"① 加入團", fb(14), GRND)
T((742,150),"② 錨定節點", fb(14), GRY)
T((548,362),"③ 指派任務", fb(14), BLUD)
T((548,390),"⑤ 完成→回報", fb(14), PURD)
T((992,362),"④ DM推進：更新", fb(13), BLUD)
T((992,382),"NPC/地點＋解鎖", fb(13), BLUD)
T((92,404),"玩家挑戰任務", fb(13), GRND)
T((742,540),"關聯", fr(13), GRY)

# ===== boxes =====
# A 玩家角色記錄
rr((40,110,370,284),12,GRNF,GRN,2)
T((60,124),"玩家角色記錄", fb(19), GRND)
T((205,128),"（存玩家端）", fr(13), GRN)
T((60,160),"• 角色本體：等級 / HP / 裝備 / 魔寵", fr(13.5), SL)
T((60,186),"• worldProgress：我停在哪個節點", fr(13.5), SL)
T((60,212),"• 不存世界狀態，只存", fr(13.5), SL)
T((78,236),"「我是誰 ＋ 現在在哪個節點」", fb(13.5), GRND)

# B 團
rr((432,126,735,216),12,NEU,NEUB,2)
T((452,140),"團（連線 / 房間）", fb(18))
T((452,172),"把玩家聚在一起、", fr(13.5), SL)
T((452,192),"錨定到一個紀元節點", fr(13.5), SL)

# C 紀元樹節點
rr((800,110,1160,292),12,BLUF,BLUD,3)
T((820,124),"紀元樹節點 E2", fb(19), BLUD)
T((820,156),"（DM 端 · 世界正史）", fr(13.5), BLU)
T((820,188),"• 世界「現在」的狀態（diff 累積）", fr(13.5), SL)
T((820,214),"• 一切世界資訊的權威來源", fr(13.5), SL)
T((820,240),"• 團就掛在這個節點上跑", fr(13.5), SL)
T((820,264),"◀ 世界狀態的單一真相", fb(13), BLUD)

# D 任務
rr((432,480,735,650),12,PURF,PUR,2)
T((452,494),"任務 Quests", fb(19), PURD)
T((452,528),"（世界設定內定義）", fr(13.5), PUR)
T((452,558),"• 狀態隨節點解析", fr(13.5), SL)
T((452,584),"  進行中 / 已完成 / 解鎖", fr(13.5), SL)
T((452,610),"• 完成後把結果回報給節點", fr(13.5), SL)

# E NPC / 地點
rr((800,480,1160,650),12,ORAF,ORA,2)
T((820,494),"NPC / 地點（世界 entities）", fb(18), ORAD)
T((820,528),"• 各自帶著經歷演進", fr(13.5), SL)
T((820,554),"• 狀態：存在 / 已毀 / 改變", fr(13.5), SL)
T((820,580),"• 由節點的 diff 決定當前樣貌", fr(13.5), SL)
T((820,610),"◀ 切分支就會不一樣", fb(13), ORAD)

# ===== bottom: data ownership =====
rr((40,700,1160,842),14,"#f8fafc","#cbd5e1",2)
T((64,714),"資料歸屬（誰存誰）", fb(18))
rr((64,750,82,768),4,GRNF,GRN,2)
T((92,752),"綠 = 玩家端存：角色本體 ＋ worldProgress（只是一個「停在哪個節點」的指標）", fr(14), SL)
rr((64,782,82,800),4,BLUF,BLUD,2)
T((92,784),"藍/橘/紫 = DM 端存：紀元節點 ＋ diff ＋ 任務定義 ＋ NPC/地點狀態（世界狀態的權威）", fr(14), SL)
T((64,814),"關鍵：玩家不存世界；他換節點/換分支，看到的任務與 NPC/地點就跟著節點變。", fb(14), BLUD)

d.rectangle([1,1,W-2,H-2], outline="#e5e7eb", width=1*S)
img = img.resize((1200,880), Image.LANCZOS)
out="/home/node/.openclaw/workspace/agent-color/projects/tmp/era-layers.png"
img.save(out)
print("saved", out)
