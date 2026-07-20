/* shared/familiar-presets.js
 * 魔寵範本匯入 (Familiar Preset Import) 資料 + 主權閘門。
 * 規格：concepts/familiar-preset-spec.md
 *
 * - 掛在 window.DND5E_FAMILIAR_PRESETS（UMD/IIFE，node 可 require，瀏覽器 <script> 可用）。
 * - 每筆 preset 對齊 v2 現行魔寵形狀（含 skills[] / attacks[] 陣列、senses / resistances / story），
 *   並多帶 tier / canAttack。name/story/notes 屬敘事面，匯入時保留玩家自填。
 * - tier=srd：尋找魔寵（SRD 5.1 CR0 野獸，皆「不能攻擊」但保留其 stat block 攻擊數據供顯示）。
 * - tier=pact：鎖鏈契約（官方進階魔寵，可自行攻擊）。
 * - 數值以官方 stat block（SRD 5.1, CC-BY-4.0）交叉核對。
 */
(function (global) {
  "use strict";

  var TIER_LABELS = {
    srd: "尋找魔寵 (Find Familiar) · SRD 5.1 CR0 野獸",
    pact: "鎖鏈契約 (Pact of the Chain) · 官方進階魔寵"
  };

  /* 敘事面欄位：匯入時一律保留玩家既有值（範本這些欄位留空）。 */
  var NARRATIVE_KEYS = ["name", "story", "notes"];

  function ab(str, dex, con, int, wis, cha) {
    return { str: str, dex: dex, con: con, int: int, wis: wis, cha: cha };
  }
  function hp(n) { return { current: n, max: n }; }

  /* ---- tier = srd（尋找魔寵，CR0 野獸；可攻擊：否）---- */
  var SRD = [
    {
      id: "bat", type: "蝙蝠 (Bat)", speed: "5呎，飛行30呎", ac: 12, hp: hp(1),
      abilities: ab(2, 15, 8, 2, 12, 4),
      senses: "盲視60呎；被動察覺11", resistances: "",
      skills: [
        { name: "回聲定位", desc: "只要無法聽見就無法使用盲視。" },
        { name: "敏銳聽覺", desc: "以聽覺進行的感知（Perception）檢定具有優勢。" }
      ],
      attacks: [{ name: "咬 (Bite)", hit: "+0", dmg: "1 穿刺", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "cat", type: "貓 (Cat)", speed: "40呎，攀爬30呎", ac: 12, hp: hp(2),
      abilities: ab(3, 15, 10, 3, 12, 7),
      senses: "被動察覺13", resistances: "",
      skills: [{ name: "敏銳嗅覺", desc: "以嗅覺進行的感知檢定具有優勢。" }],
      attacks: [{ name: "爪 (Claws)", hit: "+0", dmg: "1 抓傷", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "crab", type: "螃蟹 (Crab)", speed: "20呎，游泳20呎", ac: 11, hp: hp(2),
      abilities: ab(2, 11, 10, 1, 8, 2),
      senses: "盲視30呎；被動察覺9", resistances: "",
      skills: [{ name: "兩棲", desc: "可在空氣與水中呼吸。" }],
      attacks: [{ name: "螫 (Claw)", hit: "+0", dmg: "1 鈍擊", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "frog", type: "青蛙／蟾蜍 (Frog)", speed: "20呎，游泳20呎", ac: 11, hp: hp(1),
      abilities: ab(1, 13, 8, 1, 8, 3),
      senses: "黑暗視覺30呎；被動察覺11", resistances: "",
      skills: [
        { name: "兩棲", desc: "可在空氣與水中呼吸。" },
        { name: "立定跳躍", desc: "立定可橫跳10呎、豎跳5呎（含或不含助跑）。" }
      ],
      attacks: []
    },
    {
      id: "hawk", type: "鷹 (Hawk)", speed: "10呎，飛行60呎", ac: 13, hp: hp(1),
      abilities: ab(5, 16, 8, 2, 14, 6),
      senses: "被動察覺14", resistances: "",
      skills: [{ name: "敏銳視覺", desc: "以視覺進行的感知檢定具有優勢。" }],
      attacks: [{ name: "爪 (Talons)", hit: "+5", dmg: "1 抓傷", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "lizard", type: "蜥蜴 (Lizard)", speed: "20呎，攀爬20呎", ac: 10, hp: hp(2),
      abilities: ab(2, 11, 10, 1, 8, 3),
      senses: "黑暗視覺30呎；被動察覺9", resistances: "",
      skills: [],
      attacks: [{ name: "咬 (Bite)", hit: "+0", dmg: "1 穿刺", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "octopus", type: "章魚 (Octopus)", speed: "5呎，游泳30呎", ac: 12, hp: hp(3),
      abilities: ab(4, 15, 11, 3, 10, 4),
      senses: "黑暗視覺30呎；被動察覺12", resistances: "",
      skills: [
        { name: "閉氣", desc: "離水後可閉氣30分鐘。" },
        { name: "水下偽裝", desc: "在水中進行的敏捷（隱匿）檢定具有優勢。" },
        { name: "墨雲（充能）", desc: "可噴出10呎立方墨雲，區域重度遮蔽1分鐘後隨後動作可游速逃離。" }
      ],
      attacks: [{ name: "觸手 (Tentacles)", hit: "+4", dmg: "1 鈍擊", desc: "命中則目標被擒抱（脫逃DC10），被擒抱時無法對其他目標使用觸手。" }]
    },
    {
      id: "owl", type: "貓頭鷹 (Owl)", speed: "5呎，飛行60呎", ac: 11, hp: hp(1),
      abilities: ab(3, 13, 8, 2, 12, 7),
      senses: "黑暗視覺120呎；被動察覺13", resistances: "",
      skills: [
        { name: "飛掠 (Flyby)", desc: "飛行離開敵人觸及範圍時不會招致藉機攻擊。" },
        { name: "敏銳聽覺與視覺", desc: "以聽覺或視覺進行的感知檢定具有優勢。" }
      ],
      attacks: [{ name: "爪 (Talons)", hit: "+3", dmg: "1 抓傷", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "poisonous-snake", type: "毒蛇 (Poisonous Snake)", speed: "30呎，游泳30呎", ac: 13, hp: hp(2),
      abilities: ab(2, 16, 11, 1, 10, 3),
      senses: "盲視10呎；被動察覺10", resistances: "",
      skills: [],
      attacks: [{ name: "咬 (Bite)", hit: "+5", dmg: "1 穿刺", desc: "附加：DC10 體質豁免，失敗受 2 (1d4) 毒素傷害，成功減半。" }]
    },
    {
      id: "quipper", type: "魚 (Quipper)", speed: "0呎，游泳40呎", ac: 13, hp: hp(1),
      abilities: ab(2, 16, 9, 1, 7, 2),
      senses: "黑暗視覺60呎；被動察覺8", resistances: "",
      skills: [
        { name: "嗜血", desc: "對生命值未滿的生物攻擊具有優勢。" },
        { name: "水中呼吸", desc: "只能在水中呼吸。" }
      ],
      attacks: [{ name: "咬 (Bite)", hit: "+5", dmg: "1 穿刺", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "rat", type: "老鼠 (Rat)", speed: "20呎", ac: 10, hp: hp(1),
      abilities: ab(2, 11, 9, 2, 10, 4),
      senses: "黑暗視覺30呎；被動察覺10", resistances: "",
      skills: [{ name: "敏銳嗅覺", desc: "以嗅覺進行的感知檢定具有優勢。" }],
      attacks: [{ name: "咬 (Bite)", hit: "+0", dmg: "1 穿刺", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "raven", type: "渡鴉 (Raven)", speed: "10呎，飛行50呎", ac: 12, hp: hp(1),
      abilities: ab(2, 14, 8, 2, 12, 6),
      senses: "被動察覺13", resistances: "",
      skills: [{ name: "擬聲 (Mimicry)", desc: "可模仿聽過的簡單聲音；DC10 洞察檢定方可識破。" }],
      attacks: [{ name: "喙 (Beak)", hit: "+4", dmg: "1 穿刺", desc: "近戰武器攻擊，觸及5呎。" }]
    },
    {
      id: "sea-horse", type: "海馬 (Sea Horse)", speed: "0呎，游泳20呎", ac: 11, hp: hp(1),
      abilities: ab(1, 12, 8, 1, 10, 2),
      senses: "被動察覺10", resistances: "",
      skills: [{ name: "水中呼吸", desc: "只能在水中呼吸。" }],
      attacks: []
    },
    {
      id: "spider", type: "蜘蛛 (Spider)", speed: "20呎，攀爬20呎", ac: 12, hp: hp(1),
      abilities: ab(2, 14, 8, 1, 10, 2),
      senses: "黑暗視覺30呎；被動察覺10", resistances: "",
      skills: [
        { name: "蛛行", desc: "可沿難行表面（含倒吊天花板）行走，無需能力檢定。" },
        { name: "蛛網感知", desc: "接觸蛛網時可感知與其相連蛛網上任何生物的位置。" },
        { name: "蛛網行走", desc: "忽略蛛網造成的移動限制。" }
      ],
      attacks: [{ name: "咬 (Bite)", hit: "+4", dmg: "1 穿刺", desc: "附加：DC9 體質豁免，失敗受 2 (1d4) 毒素傷害，成功減半。" }]
    },
    {
      id: "weasel", type: "鼬 (Weasel)", speed: "30呎", ac: 13, hp: hp(1),
      abilities: ab(3, 16, 8, 2, 12, 3),
      senses: "被動察覺13", resistances: "",
      skills: [{ name: "敏銳聽覺與嗅覺", desc: "以聽覺或嗅覺進行的感知檢定具有優勢。" }],
      attacks: [{ name: "咬 (Bite)", hit: "+5", dmg: "1 穿刺", desc: "近戰武器攻擊，觸及5呎。" }]
    }
  ];

  /* ---- tier = pact（鎖鏈契約，官方 4 種；可自行攻擊）---- */
  var PACT = [
    {
      id: "imp", type: "小惡魔 (Imp)", speed: "20呎，飛行40呎", ac: 13, hp: hp(10),
      abilities: ab(6, 17, 13, 11, 12, 14),
      senses: "黑暗視覺120呎（魔鬼視覺，無視魔法黑暗）；被動察覺11",
      resistances: "抗性：冷、非魔法且非銀製武器之鈍擊/穿刺/揮砍；免疫：火、毒；狀態免疫：中毒",
      skills: [
        { name: "變形者 (Shapechanger)", desc: "可用動作變為鼠、渡鴉或蜘蛛形態或變回原形，數據不變（速度隨形態調整）。" },
        { name: "魔鬼視覺", desc: "魔法黑暗不影響其黑暗視覺。" },
        { name: "魔法抗性", desc: "對抗法術與魔法效果的豁免具有優勢。" },
        { name: "隱形（動作）", desc: "以動作變為隱形，直到攻擊或專注結束。" }
      ],
      attacks: [{ name: "螫刺 (Sting／野獸形態為咬)", hit: "+5", dmg: "1d4+3 穿刺", desc: "附加：DC11 體質豁免，失敗受 10 (3d6) 毒素傷害，成功減半。" }]
    },
    {
      id: "quasit", type: "類魔 (Quasit)", speed: "40呎", ac: 13, hp: hp(7),
      abilities: ab(5, 17, 10, 7, 10, 10),
      senses: "黑暗視覺120呎；被動察覺10",
      resistances: "抗性：冷、火、閃電、非魔法且非銀製武器之鈍擊/穿刺/揮砍；免疫：毒；狀態免疫：中毒",
      skills: [
        { name: "變形者 (Shapechanger)", desc: "可用動作變為蝙蝠、蜈蚣或蟾蜍形態或變回原形，數據不變（速度隨形態調整）。" },
        { name: "魔法抗性", desc: "對抗法術與魔法效果的豁免具有優勢。" },
        { name: "隱形", desc: "可用動作變為隱形，直到攻擊、使用恐嚇（Scare）或專注結束。" }
      ],
      attacks: [{ name: "爪 (Claws／野獸形態為咬)", hit: "+4", dmg: "1d4+3 揮砍", desc: "附加：DC10 體質豁免，失敗受 5 (2d4) 毒素傷害並中毒1分鐘（每回合結束可重擲）。" }]
    },
    {
      id: "pseudodragon", type: "偽龍 (Pseudodragon)", speed: "15呎，飛行60呎", ac: 13, hp: hp(7),
      abilities: ab(6, 15, 13, 10, 12, 10),
      senses: "盲視10呎；黑暗視覺60呎；被動察覺13", resistances: "",
      skills: [
        { name: "敏銳感官", desc: "依賴視覺、聽覺或嗅覺的感知檢定具有優勢。" },
        { name: "魔法抗性", desc: "對抗法術與魔法效果的豁免具有優勢。" },
        { name: "有限心靈感應", desc: "可與100呎內能理解語言的生物傳達簡單想法、情緒與影像。" }
      ],
      attacks: [
        { name: "咬 (Bite)", hit: "+4", dmg: "1d4+2 穿刺", desc: "近戰武器攻擊，觸及5呎。" },
        { name: "螫 (Sting)", hit: "+4", dmg: "1d4+2 穿刺", desc: "附加：DC11 體質豁免，失敗中毒1小時；若差5以上則陷入昏迷（受傷或被喚醒即解除）。" }
      ]
    },
    {
      id: "sprite", type: "小魔靈 (Sprite)", speed: "10呎，飛行40呎", ac: 15, hp: hp(2),
      abilities: ab(3, 18, 10, 14, 13, 11),
      senses: "被動察覺13", resistances: "",
      skills: [
        { name: "隱形", desc: "可用動作變為隱形，直到攻擊、施法或專注結束。" },
        { name: "洞察善惡 (Heart Sight)", desc: "觸碰生物得知其情緒；DC10 魅力豁免失敗則得知陣營（天界/邪魔/不死自動失敗）。" }
      ],
      attacks: [
        { name: "長劍 (Longsword)", hit: "+2", dmg: "1 揮砍", desc: "近戰武器攻擊，觸及5呎。" },
        { name: "短弓 (Shortbow)", hit: "+6", dmg: "1 穿刺", desc: "遠程武器攻擊，40/160呎。附加：DC10 體質豁免，失敗中毒1分鐘；若擲骰結果≤5則陷入昏迷（受傷或被喚醒即解除）。" }
      ]
    }
  ];

  /* 標記 tier / canAttack；SRD 追加「魔寵限制」特性（尋找魔寵不能攻擊）。 */
  var SRD_RESTRICT = { name: "魔寵限制", desc: "以「尋找魔寵」召喚：不能主動攻擊，但可執行其他動作（偵察、傳遞法術等）。" };
  var PACT_ATTACK = { name: "契約魔寵", desc: "鎖鏈契約魔寵：可依你的命令自行攻擊。" };

  function finalize(list, tier, canAttack, extraTrait) {
    return list.map(function (p) {
      var out = JSON.parse(JSON.stringify(p));
      out.tier = tier;
      out.canAttack = canAttack;
      out.name = "";   // 敘事面：留空給玩家自取
      out.story = "";  // 敘事面：留空
      out.notes = "";  // 敘事面：留空
      out.skills = (out.skills || []).slice();
      if (extraTrait) out.skills.push(JSON.parse(JSON.stringify(extraTrait)));
      return out;
    });
  }

  var PRESETS = []
    .concat(finalize(SRD, "srd", false, SRD_RESTRICT))
    .concat(finalize(PACT, "pact", true, PACT_ATTACK));

  /* ---- 主權閘門（規格 §5）----
   * ctx = { mode:'local'|'dm', started:boolean, allowPactFamiliar:boolean }
   *   mode='local'                 → 允許全部 tier
   *   mode='dm' + started（開團後） → 機制面鎖定，禁止匯入（需 DM 調整）
   *   mode='dm' + tier='srd'       → 允許（限建檔/創角階段）
   *   mode='dm' + tier='pact'      → 需 allowPactFamiliar === true
   * 回傳 { ok:boolean, reason:string }
   */
  function canImportFamiliar(preset, ctx) {
    ctx = ctx || {};
    var tier = preset && preset.tier;
    if (ctx.mode !== "dm") {
      return { ok: true, reason: "" };
    }
    if (ctx.started) {
      return { ok: false, reason: "已開團，機制面由 DM 管理（需 DM 調整）" };
    }
    if (tier === "pact") {
      if (ctx.allowPactFamiliar === true) return { ok: true, reason: "" };
      return { ok: false, reason: "此 DM 世界未開放鎖鏈契約魔寵（需 DM 於世界規則開啟）" };
    }
    return { ok: true, reason: "" };
  }

  /* 依範本產生新的魔寵物件：覆蓋機制面、保留玩家敘事面（name/story/notes）。
   * prev = 玩家目前的 familiar（可為 null）；回傳全新物件（不改動 prev）。 */
  function applyPreset(prev, preset) {
    prev = prev || {};
    var out = JSON.parse(JSON.stringify(preset));
    delete out.id;
    delete out.tier; // tier 為範本分組用，落地魔寵不需保留
    NARRATIVE_KEYS.forEach(function (k) {
      var v = prev[k];
      out[k] = (v !== undefined && v !== null) ? v : "";
    });
    return out;
  }

  global.DND5E_FAMILIAR_PRESETS = {
    PRESETS: PRESETS,
    TIER_LABELS: TIER_LABELS,
    NARRATIVE_KEYS: NARRATIVE_KEYS,
    canImportFamiliar: canImportFamiliar,
    applyPreset: applyPreset
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.DND5E_FAMILIAR_PRESETS;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
