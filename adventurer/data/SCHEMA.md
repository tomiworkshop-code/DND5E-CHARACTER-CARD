# DnD 5E PWA — 離線資料 Schema 說明

本目錄存放角色卡 PWA 的繁體中文離線結構化資料（`data/*.json`）。
後續 `spells.json` / `items.json` 等請對齊此處的通用約定。

## 通用約定（所有資料檔共用）

- 編碼：UTF-8，無 BOM。
- 頂層為物件：`{ "_meta": {...}, "<集合名>": [...] }`。
- `_meta` 欄位：
  - `schema`：資料類型識別字串（如 `dnd5e-pwa/races`）。
  - `version`：整數，schema 版本。
  - `generated`：產生日期 `YYYY-MM-DD`。
  - `source_url`：實際資料來源 URL。
  - `note`：來源/用途備註。
  - `counts`：各集合筆數統計。
- `id`：每筆唯一字串 slug（小寫、英文名+來源書代碼，衝突時加 `-2`、`-3`）。同檔內全域唯一（種族與副種族共用同一命名空間）。
- 屬性代碼一律使用：`str`/`dex`/`con`/`int`/`wis`/`cha`。
- 來源書代碼沿用 5etools 縮寫（PHB、VGM、MTF、DMG、EEPC、GGR、TTP、OGA、UA*、PS* 等）。
- 文字欄位中的 5etools 標記（`{@spell ...}`、`{@item 名稱|phb}`、`{@skill ...}` 等）已清除，只保留可讀文字。

## races.json

來源：`https://5etools.wayneh.tw/data/races.json`（5etools 繁中鏡像）。

頂層：`{ "_meta": {...}, "races": [ Race, ... ] }`

### Race 物件

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一 slug，例：`tabaxi-vgm` |
| `name_zh` | string | 中文名，例：`斑貓人` |
| `name_en` | string | 英文名，例：`Tabaxi`（資料源未翻譯者，與 `name_zh` 相同） |
| `source` | string\|null | 來源書代碼，例：`VGM` |
| `page` | number\|null | 頁碼 |
| `size` | string\|null | 體型代碼：`T`小/`S`小型/`M`中型/`L`大型/`H`巨型（5e 慣例 `M`=Medium、`S`=Small） |
| `speed` | number \| object \| string \| null | 速度。可能為數字（呎）、物件 `{walk,fly,swim,climb}`、或字串 `"Varies"` |
| `abilityBonus` | object | 固定屬性加值，僅含有值的鍵，例：`{"dex":2,"cha":1}`。無加值為 `{}` |
| `abilityChoose` | array | (選用) 玩家可選的屬性加值，格式 `[{from:[...], count:N, amount?:N}]` |
| `darkvision` | number | (選用) 黑暗視覺呎數 |
| `traits_zh` | array | 特性摘要，`[{name_zh, desc_zh}]` |
| `subraces` | array | (選用) 副種族陣列，見下 |

### Subrace 物件（`subraces[]`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一 slug，例：`drow-phb` |
| `name_zh` | string\|null | 中文名，例：`卓爾` |
| `name_en` | string\|null | 英文名，例：`Drow` |
| `source` | string\|null | 來源書（缺省時繼承母種族） |
| `abilityBonus` | object | 副種族額外屬性加值（與母種族疊加） |
| `abilityChoose` | array | (選用) 同上 |
| `darkvision` | number | (選用) |
| `speed` | number\|object\|string | (選用) 覆寫/補充速度 |
| `traits_zh` | array | `[{name_zh, desc_zh}]` |

### 使用注意

- 角色實際屬性加值 = 母種族 `abilityBonus` + 所選 `subrace.abilityBonus`（再加上 `abilityChoose` 玩家選擇）。
- 同名種族可能跨多本書出現（如 Aarakocra 同時在 EEPC 與 DMG），以 `id`（含來源）區分。
- `traits_zh[].name_zh` 含「年齡/陣營/體型/語言」等敘述性條目；UI 若只想顯示機制特性，可自行過濾這些通用條目。

## spells.json

來源：`https://5etools.wayneh.tw/data/spells/index.json`（5etools 繁中鏡像）所指向之分冊 JSON 彙整。

實際使用的端點：

- `spells/index.json`（分冊索引）
- `spells/spells-phb.json`、`spells-xge.json`、`spells-scag.json`、`spells-ggr.json`、`spells-llk.json`、`spells-stream.json`、`spells-ua-ar.json`、`spells-ua-mm.json`、`spells-ua-ss.json`、`spells-ua-tobm.json`

頂層：`{ "_meta": {...}, "spells": [ Spell, ... ] }`

`_meta` 除通用欄位外另含：

| 欄位 | 說明 |
|------|------|
| `source_files` | 實際彙整的分冊檔名清單 |
| `source_book_counts` | 各來源書法術筆數 |
| `untranslated_estimate` | 估計未提供繁中譯名的筆數（多為 UA/Stream 試行內容） |

法術依 `level` 升冪、再依 `name_en` 排序。

### Spell 物件

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一 slug，英文名+來源書，例：`fireball-phb` |
| `name_zh` | string | 中文名，例：`火球術`（資料源未翻譯者與 `name_en` 相同） |
| `name_en` | string | 英文名，例：`Fireball` |
| `source` | string\|null | 來源書代碼，例：`PHB`、`XGE`、`SCAG`、`GGR`、`LLK`、`Stream`、`UA*` |
| `page` | number\|null | 頁碼 |
| `level` | number | 法術環級，`0` 表戲法（cantrip） |
| `school` | string | 學派代碼：`A`塑能/`C`咒法/`D`預言/`E`惑控/`I`幻術/`N`死靈/`T`變化/`V`防護/`P`（少見） |
| `ritual` | boolean | 是否可作為儀式施放（來自原始 `meta.ritual`） |
| `time` | array | 施法時間，`[{number, unit}]`；`unit`：`action`/`bonus`/`reaction`/`minute`/`hour`。reaction 條目可能含 `condition`（觸發條件，已轉純文字） |
| `range` | object\|null | 射程。`{type, distance?:{type, amount}}`；`type`：`point`/`self`/`touch`/`radius`/`sphere`/`cone`/`line`/`cube`/`hemisphere`/`special`；`distance.type`：`feet`/`miles`/`self`/`touch`/`sight`/`unlimited` 等 |
| `components` | object | 法術成分，僅含有值的鍵：`v`(true)、`s`(true)、`m`(string 材料描述 或 true)、`r`(true，少見) |
| `duration` | array | 持續時間，`[{type, ...}]`；`type`：`instant`/`timed`/`permanent`/`special`。`timed` 含 `duration:{type,amount}` 與可能的 `concentration:true` |
| `classes` | array | 可學此法術的職業英文名（取自 `classes.fromClassList`，去重），例：`["Sorcerer","Wizard"]` |
| `entries_zh` | array<string> | 法術描述純文字段落。清單以 `• ` 前綴；表格以 `【標題】`+ `\| ` 分隔列呈現 |
| `entries_higher_level_zh` | array<string> | (選用) 升環效果描述純文字 |
| `damage_types` | array<string> | (選用) 造成的傷害類型（英文，如 `fire`、`acid`），供篩選 |
| `saving_throw` | array<string> | (選用) 對應豁免屬性（英文，如 `dexterity`） |
| `conditions` | array<string> | (選用) 施加的狀態（英文，如 `prone`、`frightened`） |
| `spell_attack` | array<string> | (選用) 法術攻擊類型（`M` 近戰 / `R` 遠程） |

### 使用注意

- 5etools 標記（`@damage 8d6`、`@dice 1d20`、`@condition`、`@spell`、`@creature` 等）皆已轉為可讀純文字；`@chance N` 轉為 `N%`，參照類標記取其顯示名稱。
- 共 505 筆法術。其中約 40 筆（UA / Stream 試行內容）資料源未提供繁中譯名，`name_zh` 沿用英文，且部分描述亦為英文——屬灰色／試行資料，UI 可考慮以 `source` 過濾。
- 部分非核心分冊（GGR/LLK/SCAG/Stream/UA*）僅收錄少量法術，屬該書新增法術；核心戲法與法術主要來自 PHB（361）與 XGE（95）。

## items.json

來源：5etools 繁中鏡像 `https://5etools.wayneh.tw/data/` 之三個端點彙整：

- `basicitems.json` → `basicitem`（81 筆基礎武器/護甲/彈藥/法器/部分工具）＋ `itemProperty`/`itemType` 參照表（用於翻譯屬性/類型代碼，未直接輸出）。
- `items.json` → `item`（1034 筆魔法物品、冒險裝備、工具、坐騎、載具、財寶等）＋ `itemGroup`（26 筆物品集合）。
- `magicvariants.json` → `variant`（80 筆魔法變體模板，如「精金武器」「+1 護甲」類）。

頂層：`{ "_meta": {...}, "items": [ Item, ... ] }`，共 1221 筆。依 `type`（粗分類）再依 `name_en` 排序。

`_meta` 除通用欄位外另含：

| 欄位 | 說明 |
|------|------|
| `source_files` | 實際彙整的端點檔名清單 |
| `counts_by_type` | 各 `type` 粗分類筆數 |
| `counts_by_source` | 各來源書筆數 |
| `magic_item_estimate` | 具稀有度（非 None）之魔法物品估計筆數（約 732） |
| `untranslated_estimate` | `name_zh` 仍為英文（資料源未譯）之估計筆數（約 303） |

### Item 物件

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一 slug，英文名+來源書，例：`longsword-phb` |
| `name_zh` | string | 中文名（資料源未譯者與 `name_en` 相同） |
| `name_en` | string | 英文名 |
| `source` | string\|null | 來源書代碼（PHB、DMG、XGE、GGR、PSX…） |
| `page` | number\|null | 頁碼 |
| `type` | string | 粗分類：`weapon`/`ammunition`/`armor`/`shield`/`potion`/`scroll`/`ring`/`rod`/`wand`/`focus`/`tool`/`mount`/`vehicle`/`tack`/`treasure`/`wondrous`/`gear`/`explosive`/`eldritch-machine`/`group`/`variant`/`other` |
| `category` | string\|null | 較細的中文類別，例：`軍用近戰武器`、`重型護甲`、`魔法變體模板` |
| `rarity` | string\|null | 稀有度（英文正規化）：`common`/`uncommon`/`rare`/`very rare`/`legendary`/`artifact`/`unknown`；非魔法物品為 `null` |
| `requires_attunement` | boolean | 是否需同調 |
| `attune_note_zh` | string | (選用) 同調條件描述（如「由法師」），純文字 |
| `value_cp` | number\|null | 價值，統一換算為銅幣（cp）。1gp=100cp、1sp=10cp、1ep=50cp、1pp=1000cp |
| `weight` | number\|null | 重量（磅） |
| `ac` | number\|null | 護甲/盾牌的基礎 AC（盾牌為加值，如 2） |
| `damage` | array\|null | 武器傷害，`[{dice, type}]`；`type` 為英文（slashing/piercing/bludgeoning/fire…）。多用途武器的雙手傷害另一筆帶 `versatile:true` |
| `properties` | array\|null | 武器屬性中文，例：`["可雙手"]`、`["靈巧","輕型"]` |
| `entries_zh` | array<string> | 描述純文字段落（清單前綴 `• `，表格以 `【標題】`+`\| ` 分隔，子標題以 `【…】`） |
| `raw_tags` | array<string> | 原始標記輔助篩選：`base-item`/`magic-variant`/`weapon`/`armor`/`wondrous`/原始 type 代碼/`martial`/`simple` 等 |
| `range` | string | (選用) 遠程武器射程，例：`80/320` |
| `bonus` | string | (選用) 武器/物品命中或加值修正（如 `+1`） |
| `bonus_ac` / `bonus_spell_attack` | string | (選用) AC 或法術攻擊加值 |
| `armor_str_req` | number | (選用) 護甲力量需求 |
| `stealth_disadvantage` | boolean | (選用) 穿戴時隱匿檢定劣勢 |
| `charges` | number | (選用) 充能數 |
| `tier` | string | (選用) `minor`/`major` |
| `group_members` | array | (選用，`type=group`) 集合包含的子物品名稱清單 |
| `is_variant` | boolean | (選用，`type=variant`) 標示為魔法變體模板 |
| `name_pattern_zh` / `name_pattern_en` | string | (選用，variant) 套用後品名格式，如 `精金〔基礎物品〕` |
| `applies_to` | string | (選用，variant) 此變體可套用的基礎物品條件摘要 |

### 使用注意

- **變體未展開**：`magicvariants.json` 的 80 筆變體模板（如 +1/+2/+3 武器與護甲、精金、銀製等）以 `type=variant` 保留，附 `name_pattern_*`、`applies_to` 與規則摘要，**未**暴力展開為數千筆具體 +N 物品；UI 若需具體品名請在前端依基礎物品套模板生成。
- **物品集合**：`type=group`（26 筆，如「奧術法器」「工匠工具」）為 5etools 的分組條目，含 `group_members`；非單一可裝備物品。
- **價值單位**：統一為 cp 數字；前端可自行除以 100 顯示 gp。少數無標價物品為 `null`。
- 約 303 筆 `name_zh` 仍為英文（資料源未提供繁中譯名），集中於設定/冒險分冊（PSX/Eberron、UAWGE、GGR、WDH、WDMM、ToA、CoS、SKT、TftYP 等）與英文命名之財寶（寶石/藝品）；核心 PHB/DMG 幾乎全譯（DMG 僅 8 筆未譯）。可用 `_meta.untranslated_estimate` 或 `name_zh`/`name_en` 比對過濾。
- 5etools 標記（`{@item}`、`{@dice}`、`{@damage}`、`{@condition}`、`{@spell}`、`{@chance N}`→`N%`、`{=baseName}` 模板token 等）皆已清除/轉純文字；殘留 `{@…}`/`{=…}` 數為 0。
- 基礎武器/護甲含 DMG 之科技/槍械物品（如反物質步槍），`raw_tags` 含原始 type 代碼可供過濾。
