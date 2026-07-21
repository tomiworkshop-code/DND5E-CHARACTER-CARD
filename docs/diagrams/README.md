# DM v2 世界紀元 · 說明圖

給 DM/玩家講解「世界紀元樹」概念用的流程圖。原始碼為 Pillow 腳本，可重新產圖或修改。

## 檔案
- `world-era-tree.(png|html)` + `draw_era_tree.py`：世界紀元樹（主線/分支/團錨定/DM 決策）。
- `era-layers.png` + `draw_layers.py`：三層互動（玩家角色記錄 × 紀元樹節點 × 任務 × NPC/地點）。

## 重繪
需系統有 NotoSansTC 字型（`~/.fonts/NotoSansTC-{Bold,Regular}.otf`）與 Python Pillow：
```
python3 draw_era_tree.py
python3 draw_layers.py
```

對應規格：`concepts/dm-v2-spec.md` §10（世界紀元樹）、§9.6（landing）、§7（玩家快照）。
