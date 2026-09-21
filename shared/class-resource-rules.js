/* shared/class-resource-rules.js
 * D&D 5E 職業與子職業資源導出引擎 (Class Resource Engine)
 * 全面支援單職業與多職業/兼職 (Multiclass) 資源導出。
 * UMD 風格，同時支援 Node.js (`require('./shared/class-resource-rules')`) 與瀏覽器全域 (`window.deriveClassResources`)。
 */
(function (global) {
  'use strict';

  /**
   * 屬性調整值輔助函數
   */
  function getAbilityMod(score) {
    var val = Number(score);
    if (isNaN(val)) val = 10;
    return Math.floor((val - 10) / 2);
  }

  /**
   * 依據角色（含 character.classes 陣列與屬性）計算並匯出預設職業資源清單
   * @param {Object} character - 角色物件
   * @returns {Array<Object>} 資源物件陣列
   */
  function deriveClassResources(character) {
    if (!character || !Array.isArray(character.classes) || character.classes.length === 0) {
      return [];
    }

    var resources = [];
    var chaMod = Math.max(1, getAbilityMod(character.abilities ? character.abilities.cha : 10));
    var wisMod = Math.max(1, getAbilityMod(character.abilities ? character.abilities.wis : 10));

    character.classes.forEach(function (cls, index) {
      if (!cls) return;
      var nameEn = (cls.name_en || cls.name || '').trim();
      var level = Number(cls.level) || 1;
      var subEn = (cls.subclass_en || cls.subclass || '').trim();
      var classKey = nameEn.toLowerCase();

      // --- 野蠻人 (Barbarian) ---
      if (classKey === 'barbarian' || nameEn === '野蠻人') {
        var rages = 2;
        if (level >= 3 && level < 6) rages = 3;
        else if (level >= 6 && level < 12) rages = 4;
        else if (level >= 12 && level < 17) rages = 5;
        else if (level >= 17 && level < 20) rages = 6;
        else if (level >= 20) rages = 99; // 20級無窮次狂暴

        resources.push({
          id: 'barbarian_rage_' + index,
          classKey: 'barbarian',
          className: '野蠻人',
          subclassKey: subEn || null,
          label: '狂暴次數 (Rages)',
          current: rages === 99 ? 99 : rages,
          max: rages === 99 ? 99 : rages,
          reset: 'long',
          kind: 'counter',
          note: rages === 99 ? '20級無限次狂暴' : '長休後恢復全部次數'
        });

        var rageDmg = '+2';
        if (level >= 9 && level < 16) rageDmg = '+3';
        else if (level >= 16) rageDmg = '+4';

        resources.push({
          id: 'barbarian_rage_damage_' + index,
          classKey: 'barbarian',
          className: '野蠻人',
          subclassKey: subEn || null,
          label: '狂暴傷害加值',
          current: 0,
          max: 0,
          reset: 'none',
          kind: 'label',
          diceValue: rageDmg,
          note: '狂暴時近戰武器傷害加值'
        });
      }

      // --- 武僧 (Monk) ---
      if (classKey === 'monk' || nameEn === '武僧') {
        resources.push({
          id: 'monk_ki_' + index,
          classKey: 'monk',
          className: '武僧',
          subclassKey: subEn || null,
          label: '氣 / 專注點數 (Ki Points)',
          current: level,
          max: level,
          reset: 'short',
          kind: 'counter',
          note: '短休或長休後恢復全部氣點'
        });
      }

      // --- 聖騎士 (Paladin) ---
      if (classKey === 'paladin' || nameEn === '聖騎士') {
        var layOnHands = level * 5;
        resources.push({
          id: 'paladin_lay_on_hands_' + index,
          classKey: 'paladin',
          className: '聖騎士',
          subclassKey: subEn || null,
          label: '聖療池 (Lay on Hands)',
          current: layOnHands,
          max: layOnHands,
          reset: 'long',
          kind: 'pool',
          note: '長休後恢復治療池點數（等級 × 5）'
        });

        if (level >= 3) {
          resources.push({
            id: 'paladin_channel_divinity_' + index,
            classKey: 'paladin',
            className: '聖騎士',
            subclassKey: subEn || null,
            label: '神聖干預 (Channel Divinity)',
            current: 1,
            max: 1,
            reset: 'short',
            kind: 'counter',
            note: '短休或長休後恢復'
          });
        }
      }

      // --- 牧師 (Cleric) ---
      if (classKey === 'cleric' || nameEn === '牧師') {
        if (level >= 2) {
          var cdUses = 1;
          if (level >= 6 && level < 18) cdUses = 2;
          else if (level >= 18) cdUses = 3;

          resources.push({
            id: 'cleric_channel_divinity_' + index,
            classKey: 'cleric',
            className: '牧師',
            subclassKey: subEn || null,
            label: '神聖干預 (Channel Divinity)',
            current: cdUses,
            max: cdUses,
            reset: 'short',
            kind: 'counter',
            note: '短休或長休後恢復'
          });
        }
      }

      // --- 吟遊詩人 (Bard) ---
      if (classKey === 'bard' || nameEn === '吟遊詩人') {
        var die = 'd6';
        if (level >= 5 && level < 10) die = 'd8';
        else if (level >= 10 && level < 15) die = 'd10';
        else if (level >= 15) die = 'd12';

        var bardicReset = level >= 5 ? 'short' : 'long';

        resources.push({
          id: 'bard_inspiration_' + index,
          classKey: 'bard',
          className: '吟遊詩人',
          subclassKey: subEn || null,
          label: '吟遊詩人靈感 (Bardic Inspiration)',
          current: chaMod,
          max: chaMod,
          reset: bardicReset,
          kind: 'dice',
          diceValue: die,
          note: (level >= 5 ? '5級起短休或長休恢復' : '長休恢復') + ' (上限 = 魅力調整值)'
        });
      }

      // --- 戰士 (Fighter) ---
      if (classKey === 'fighter' || nameEn === '戰士') {
        resources.push({
          id: 'fighter_second_wind_' + index,
          classKey: 'fighter',
          className: '戰士',
          subclassKey: subEn || null,
          label: '二次風 (Second Wind)',
          current: 1,
          max: 1,
          reset: 'short',
          kind: 'dice',
          diceValue: '1d10+' + level,
          note: '附贈動作恢復 1d10 + 戰士等級 HP，短休恢復'
        });

        if (level >= 2) {
          var surgeUses = level >= 17 ? 2 : 1;
          resources.push({
            id: 'fighter_action_surge_' + index,
            classKey: 'fighter',
            className: '戰士',
            subclassKey: subEn || null,
            label: '行動湧浪 (Action Surge)',
            current: surgeUses,
            max: surgeUses,
            reset: 'short',
            kind: 'counter',
            note: '回合內獲得額外一次動作，短休恢復'
          });
        }

        // 子職業：戰術大師 (Battle Master)
        if (subEn.toLowerCase().indexOf('battle master') !== -1 || cls.subclass === '戰術大師') {
          if (level >= 3) {
            var supCount = 4;
            if (level >= 7 && level < 15) supCount = 5;
            else if (level >= 15) supCount = 6;

            var supDie = 'd8';
            if (level >= 10 && level < 18) supDie = 'd10';
            else if (level >= 18) supDie = 'd12';

            resources.push({
              id: 'fighter_bm_superiority_' + index,
              classKey: 'fighter',
              className: '戰士',
              subclassKey: 'battle_master',
              subclassName: '戰術大師',
              label: '優勢骰 (Superiority Dice)',
              current: supCount,
              max: supCount,
              reset: 'short',
              kind: 'dice',
              diceValue: supDie,
              note: '短休或長休恢復戰術戰術優勢骰'
            });
          }
        }
      }

      // --- 術士 (Sorcerer) ---
      if (classKey === 'sorcerer' || nameEn === '術士') {
        if (level >= 2) {
          resources.push({
            id: 'sorcerer_sorcery_points_' + index,
            classKey: 'sorcerer',
            className: '術士',
            subclassKey: subEn || null,
            label: '術法點數 (Sorcery Points)',
            current: level,
            max: level,
            reset: 'long',
            kind: 'counter',
            note: '長休後恢復，可用於元魔法或轉換法術位'
          });
        }
      }

      // --- 德魯伊 (Druid) ---
      if (classKey === 'druid' || nameEn === '德魯伊') {
        if (level >= 2) {
          resources.push({
            id: 'druid_wild_shape_' + index,
            classKey: 'druid',
            className: '德魯伊',
            subclassKey: subEn || null,
            label: '荒野形態 (Wild Shape)',
            current: 2,
            max: 2,
            reset: 'short',
            kind: 'counter',
            note: '短休或長休後恢復 2 次'
          });
        }
      }

      // --- 邪術師 (Warlock) ---
      if (classKey === 'warlock' || nameEn === '邪術師') {
        var pactSlots = 1;
        if (level >= 2 && level < 11) pactSlots = 2;
        else if (level >= 11 && level < 17) pactSlots = 3;
        else if (level >= 17) pactSlots = 4;

        var slotLevel = 1;
        if (level >= 3 && level < 5) slotLevel = 2;
        else if (level >= 5 && level < 7) slotLevel = 3;
        else if (level >= 7 && level < 9) slotLevel = 4;
        else if (level >= 9) slotLevel = 5;

        resources.push({
          id: 'warlock_pact_slots_' + index,
          classKey: 'warlock',
          className: '邪術師',
          subclassKey: subEn || null,
          label: '契約法術位 (' + slotLevel + '環)',
          current: pactSlots,
          max: pactSlots,
          reset: 'short',
          kind: 'counter',
          note: '短休或長休後恢復全部契約法術位'
        });
      }

      // --- 盜賊 (Rogue) ---
      if (classKey === 'rogue' || nameEn === '盜賊') {
        var sneakDice = Math.ceil(level / 2) + 'd6';
        resources.push({
          id: 'rogue_sneak_attack_' + index,
          classKey: 'rogue',
          className: '盜賊',
          subclassKey: subEn || null,
          label: '偷襲傷害 (Sneak Attack)',
          current: 0,
          max: 0,
          reset: 'none',
          kind: 'dice',
          diceValue: sneakDice,
          note: '每回合一次，符合偷襲條件時額外傷害'
        });
      }

      // --- 奇械師 (Artificer) ---
      if (classKey === 'artificer' || nameEn === '奇械師') {
        if (level >= 2) {
          var infusions = 2;
          if (level >= 6 && level < 10) infusions = 3;
          else if (level >= 10 && level < 14) infusions = 4;
          else if (level >= 14 && level < 18) infusions = 5;
          else if (level >= 18) infusions = 6;

          resources.push({
            id: 'artificer_infused_items_' + index,
            classKey: 'artificer',
            className: '奇械師',
            subclassKey: subEn || null,
            label: '灌注物品上限 (Infused Items)',
            current: infusions,
            max: infusions,
            reset: 'none',
            kind: 'counter',
            note: '同時維持灌注的魔法物品數量上限'
          });
        }
      }
    });

    return resources;
  }

  // 匯出設定
  var ClassResourceEngine = {
    deriveClassResources: deriveClassResources
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClassResourceEngine;
  } else {
    global.DND5E_CLASS_RESOURCE_ENGINE = ClassResourceEngine;
    global.deriveClassResources = deriveClassResources;
  }
})(typeof window !== 'undefined' ? window : global);
