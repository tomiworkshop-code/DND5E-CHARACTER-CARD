/* ============================================================
   DND5E Character Card V2 — 應用主邏輯 (extracted from index.html)
   於全域作用域執行；依賴 head 中載入的 Vue 與 character-schema.js。
   ============================================================ */
    const { createApp, ref, computed, watch, onMounted } = Vue;
/* ===== 內嵌職業資料（離線可用，不靠外部 fetch） ===== */

    window.uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    /* ===== 存檔邏輯已抽至 shared/store.js（window.DND5E_STORE）；下方為委派綁定 ===== */
    const STORE = window.DND5E_STORE;
    const LS_IDENTITIES      = STORE.LS.IDENTITIES;
    const LS_INSTANCES       = STORE.LS.INSTANCES;
    const LS_WORLDS          = STORE.LS.WORLDS;
    const LS_ACTIVE_WORLD    = STORE.LS.ACTIVE_WORLD;
    const LS_ACTIVE_INSTANCE = STORE.LS.ACTIVE_INSTANCE;
    const LS_SCHEMA_VER      = STORE.LS.SCHEMA_VER;
    const LS_SETTINGS        = STORE.LS.SETTINGS;
    const DEFAULT_WORLD_ID   = STORE.DEFAULT_WORLD_ID;
    const loadSettings          = STORE.loadSettings;
    const pickIdentityFields    = STORE.pickIdentityFields;
    const pickMechanicalFields  = STORE.pickMechanicalFields;
    const pickInstanceNarrative = STORE.pickInstanceNarrative;
    const composeC              = STORE.composeC;
    const decomposeC            = STORE.decomposeC;
    const migrateToV2           = STORE.migrateToV2;







    /* 來源群組顯示定義（順序即顯示順序），改用 emoji 以符合 V2 風格 */
    const SOURCE_GROUP_DEFS = [
      { key:"core",      icon:"📖", label:"核心規則" },
      { key:"adventure", icon:"🗺️", label:"冒險模組" },
      { key:"setting",   icon:"🌍", label:"戰役設定" },
      { key:"ua",        icon:"🧪", label:"試行內容（UA / 直播）" },
      { key:"other",     icon:"❓", label:"其他 / 未分類" }
    ];
    const app = createApp({
      setup() {
        const coreRules = Vue.reactive({ CLASSES:[], SKILLS:[], CONDITIONS:[], COMMON_LANGUAGES:[], ARMOR_OPTIONS:[], WEAPON_OPTIONS:[], TOOL_OPTIONS:[], RACES:[], ALIGNMENTS:[], BACKGROUNDS:[] });
        
        Vue.onMounted(async () => {
          try {
            const res = await fetch('../data/core-rules.json');
            if(res.ok) {
              const data = await res.json();
              Object.assign(coreRules, data);
            }
            
            // 由於 core-rules.json 裡的 CLASSES 沒有 features，我們需要補抓 classes.json 裡面的完整特性
            const resCls = await fetch('../data/classes.json');
            if(resCls.ok) {
              const classData = await resCls.json();
              if (classData && classData.classes) {
                // 將 features 與 subclasses features 合併進 coreRules.CLASSES
                coreRules.CLASSES.forEach(baseDef => {
                  const fullDef = classData.classes.find(c => c?.name_en === baseDef?.name_en);
                  if (fullDef) {
                    baseDef.features = fullDef.features || [];
                    (baseDef.subclasses || []).forEach(baseSc => {
                      const fullSc = (fullDef.subclasses || []).find(sc => sc?.name_en === baseSc?.name_en);
                      if (fullSc) {
                        baseSc.features = fullSc.features || [];
                      }
                    });
                  }
                });
              }
            }
          } catch(e) { console.error('Failed to load rules', e); }
        });
        const isMenuOpen = ref(false);
        const currentView = ref('dashboard');
        const chars = ref([]);
        const worlds = ref(JSON.parse(localStorage.getItem(LS_WORLDS)) || [{ id: '__solo__', name: '單人漫遊', type: 'local', desc: '本地沙盒世界。在此處的所有數值變更會直接保存，無需等待 DM 批准。' }]);
        const selectedWorldObj = computed(() => worlds.value.find(w => w.id === selectedWorldKey.value) || worlds.value[0]);

        const selectedCharId = ref(null);
        const selectedWorldKey = ref('__solo__');
        const activeModule = ref(null);
        const isEditMode = ref(false);
        const isWorldEditMode = ref(false);
        const worldEditTemp = Vue.reactive({ name: '', location: '', time: '', quest: '' });
        const startWorldEdit = () => {
          // 名稱屬於世界定義層（全域），location/time/quest 屬於角色在該世界的進度存檔槽
          worldEditTemp.name = selectedWorldObj.value.name || '';
          worldEditTemp.location = activeWorldProgress.value.location || '';
          worldEditTemp.time = activeWorldProgress.value.time || '';
          worldEditTemp.quest = activeWorldProgress.value.quest || '';
          isWorldEditMode.value = true;
        };
        const saveWorldEdit = () => {
          // 世界名稱 name 寫回全域世界定義；進度（location/time/quest）寫入角色層 activeWorldProgress
          selectedWorldObj.value.name = worldEditTemp.name;
          activeWorldProgress.value.location = worldEditTemp.location;
          activeWorldProgress.value.time = worldEditTemp.time;
          activeWorldProgress.value.quest = worldEditTemp.quest;
          isWorldEditMode.value = false;
        };
        const activeRecordTab = ref('log');
        const newRecordText = ref('');
        const recordTabs = [
          { id: 'log', icon: '📜', label: '戰報與大事紀' },
          { id: 'quest', icon: '📚', label: '任務與遭遇' },
          { id: 'npc', icon: '🤝', label: '陣營與NPC' },
          { id: 'clue', icon: '💎', label: '線索與寶物' }
        ];
        const addWorldRecord = () => {
          // 筆記屬於角色在該世界的進度存檔槽（activeWorldProgress），不再寫入全域世界物件
          if(!newRecordText.value.trim()) return;
          const wp = activeWorldProgress.value;
          if(!wp.records) wp.records = { log:[], quest:[], npc:[], clue:[] };
          if(!wp.records[activeRecordTab.value]) wp.records[activeRecordTab.value] = [];
          wp.records[activeRecordTab.value].unshift({ id: Date.now(), text: newRecordText.value, time: new Date().toLocaleString() });
          newRecordText.value = '';
        };
        const removeWorldRecord = (id) => {
          const wp = activeWorldProgress.value;
          if(wp.records && wp.records[activeRecordTab.value]) {
            wp.records[activeRecordTab.value] = wp.records[activeRecordTab.value].filter(n => n.id !== id);
          }
        };
        const availableSpells = ref([]);
        const newSpellQuery = ref('');
        const spellFilterLevel = ref('');
        const customSpell = ref({ name: '', level: '1' });
        const availableItems = ref([]);
        const itemSearch = ref('');
        const customItem = ref({ name: '', qty: 1, desc: '' });
        const featOpen = ref({});
        const hasStatEffect = (name, desc, rawItem = null) => {
          let text = String(name || '') + ' ' + String(desc || '');
          if (rawItem) {
            if (rawItem.bonus) return true;
            if (Array.isArray(rawItem.entries_zh)) text += ' ' + rawItem.entries_zh.join('');
          }
          const keywords = ['+1', '+2', '+3', '防禦等級', '豁免', '值變為', 'AC:'];
          return keywords.some(k => text.includes(k));
        };
        const descOpen = ref({});
        const toggleDesc = (id) => { descOpen.value[id] = !descOpen.value[id]; };
        const needsExpand = (text) => {
          if (!text) return false;
          return text.length > 150 || text.split('\n').length > 4;
        };

        const computedAC = computed(() => {
          const char = selectedChar.value;
          if (!char) return 10;
          const dexMod = abilityMod((Number(char.abilities?.dex) || 10) + (Number(char.abilityBonus?.dex) || 0));
          
          let baseAC = 10 + dexMod;
          let armorAC = null;
          let bonusAC = 0;
          let shieldAC = 0;
          
          const equipped = (char.inventory || []).filter(i => i.equipped);
          equipped.forEach(item => {
            let text = String(item?.name || '') + ' ' + String(item?.desc || '');
            
            // 處理護甲基礎AC
            let matchArmor = text.match(/AC:\s*(\d+)/);
            if (matchArmor && item?.category && item?.category.includes('護甲')) {
              let acVal = parseInt(matchArmor[1], 10);
              // 如果是中甲，敏捷加值最多+2
              if (item?.category.includes('中型')) acVal += Math.min(2, dexMod);
              // 如果是重甲，不加敏捷
              else if (item?.category.includes('重型')) acVal = acVal;
              // 輕甲
              else acVal += dexMod;
              
              if (armorAC === null || acVal > armorAC) armorAC = acVal;
            }
            
            // 處理盾牌
            if (item?.category && item?.category.includes('盾牌')) shieldAC = 2;
            
            // 處理額外AC加值 (例如 AC +1)
            let matchBonus = text.match(/AC\s*\+(\d+)/i) || text.match(/防禦等級.*?\+(\d+)/);
            if (matchBonus) {
              bonusAC += parseInt(matchBonus[1], 10);
            }
          });
          
          return (armorAC !== null ? armorAC : baseAC) + shieldAC + bonusAC;
        });

        const abilityTotal = (key) => {
          const char = selectedChar.value;
          if (!char) return 10;
          const baseSum = (Number(char.abilities?.[key]) || 10) + (Number(char.abilityBonus?.[key]) || 0);
          
          // 動態計算裝備影響
          const zhMap = { str:'力量', dex:'敏捷', con:'體質', int:'智力', wis:'感知', cha:'魅力' };
          const zh = zhMap[key];
          const equipped = (char.inventory || []).filter(i => i.equipped);
          
          let override = 0;
          equipped.forEach(item => {
            let text = String(item?.name || '') + ' ' + String(item?.desc || '');
            const match = text.match(new RegExp(zh + '值變為(\\d+)'));
            if (match) {
              const val = parseInt(match[1], 10);
              if (val > override) override = val;
            }
          });
          
          return override > baseSum ? override : baseSum;
        };
        const abilityMod = (score) => Math.floor((score - 10) / 2);
        const fmtMod = (m) => m >= 0 ? '+' + m : m;
        const abilityDefs = [
          {key:'str', zh:'力量'}, {key:'dex', zh:'敏捷'}, {key:'con', zh:'體質'},
          {key:'int', zh:'智力'}, {key:'wis', zh:'感知'}, {key:'cha', zh:'魅力'}
        ];


        
        const isGlobalSwitcherOpen = ref(false);
        const switcherStep = ref('char'); // 'char' 或 'world'
        const switcherTempCharId = ref(null);
        const switcherTempChar = computed(() => chars.value.find(c => c.id === switcherTempCharId.value));
        
        const openGlobalSwitcher = () => { switcherStep.value = 'char'; isGlobalSwitcherOpen.value = true; };
        const selectSwitcherChar = (ch) => { switcherTempCharId.value = ch.id; switcherStep.value = 'world'; };
        const confirmSwitcherWorld = (worldKey) => { selectedCharId.value = switcherTempCharId.value; selectedWorldKey.value = worldKey; isGlobalSwitcherOpen.value = false; };
        const createNewWorld = () => { alert('新增/加入世界 功能開發中...'); };

        /* ===== 內容來源設定：資料狀態 + 設定 reactive ===== */
        // dataState 集中存放各類來源資料（sources/races/spells/items），供來源篩選計算使用
        const dataState = Vue.reactive({ sources:[], races:[], spells:[], items:[] });
        // settings：全域共用的內容檢視設定（非 per-character）
        const settings = Vue.reactive(loadSettings());

        function persistSettings(){
          try{
            localStorage.setItem(LS_SETTINGS, JSON.stringify({
              enabledSources: settings.enabledSources || [],
              includeUntranslated: settings.includeUntranslated,
              seen: settings.seen || []
            }));
          }catch(e){}
        }
        /* 軟體中出現的所有來源代碼（manifest + 實際資料） */
        function allSourceCodes(){
          const set = new Set();
          (dataState.sources || []).forEach(s => { if(s && s.code) set.add(s.code); });
          (dataState.races  || []).forEach(r => {
            if(r.source) set.add(r.source);
            (r.subraces || []).forEach(sr => { set.add(sr.source || r.source); });
          });
          (dataState.spells || []).forEach(s => { if(s.source) set.add(s.source); });
          (dataState.items  || []).forEach(i => { if(i.source) set.add(i.source); });
          set.delete(undefined); set.delete(null); set.delete("");
          return Array.from(set);
        }
        /* 資料載入後調和：首次預設全開；日後新增來源預設視為啟用 */
        function reconcileSettings(){
          const all = allSourceCodes();
          if(!Array.isArray(settings.enabledSources)){
            settings.enabledSources = all.slice();
          } else {
            all.forEach(code => {
              if(!settings.seen.includes(code) && !settings.enabledSources.includes(code)){
                settings.enabledSources.push(code);
              }
            });
          }
          settings.seen = all.slice();
          persistSettings();
        }
        /* ===== 篩選判斷 ===== */
        function isSourceEnabled(code){
          if(!code) return true;                          /* 無來源（如部分物品）視為啟用 */
          if(!Array.isArray(settings.enabledSources)) return true;
          if(settings.enabledSources.includes(code)) return true;
          /* 未被記錄過的來源（sources.json 漏列 / 內建簡表 / 舊存檔）預設視為啟用 */
          if(!Array.isArray(settings.seen) || !settings.seen.includes(code)) return true;
          return false;
        }
        function isUntranslated(o){
          return !!(o && o.name_en && o.name_zh && o.name_zh === o.name_en);
        }
        /* 可選清單篩選：來源啟用 + （若不含未繁中則排除未繁中） */
        function passesFilter(o){
          if(!o) return false;
          if(!isSourceEnabled(o.source)) return false;
          if(!settings.includeUntranslated && isUntranslated(o)) return false;
          return true;
        }

        /* ===== 設定面板：來源目錄與分組 ===== */
        const sourceCatalog = computed(() => {
          const map = {};
          (dataState.sources || []).forEach(s => { if(s && s.code) map[s.code] = Object.assign({}, s); });
          allSourceCodes().forEach(code => {
            if(!map[code]) map[code] = { code, name_zh:code, name_en:code, group:"other", official:false, counts:null };
          });
          return Object.values(map);
        });
        const sourceGroups = computed(() => {
          const cat = sourceCatalog.value;
          return SOURCE_GROUP_DEFS.map(g => ({
            key:g.key, label:g.label, icon:g.icon,
            sources: cat.filter(s => (s.group || "other") === g.key).sort((a,b)=>a.code.localeCompare(b.code))
          })).filter(g => g.sources.length);
        });
        const enabledCount = computed(() => (settings.enabledSources || []).filter(code => allSourceCodes().includes(code)).length);
        const totalSourceCount = computed(() => allSourceCodes().length);
        function sourceCountsText(s){
          if(!s || !s.counts) return "";
          const c0 = s.counts;
          return "種 " + (c0.races||0) + " · 法 " + (c0.spells||0) + " · 物 " + (c0.items||0);
        }
        function sourceLabelOf(s){
          if(!s) return "";
          const zh = s.name_zh || s.code;
          return zh + (s.name_en && s.name_en !== zh ? "（" + s.name_en + "）" : "");
        }
        function toggleSource(code){
          if(!Array.isArray(settings.enabledSources)) settings.enabledSources = [];
          const i = settings.enabledSources.indexOf(code);
          if(i >= 0) settings.enabledSources.splice(i,1); else settings.enabledSources.push(code);
          persistSettings();
        }
        function selectAllSources(on){
          settings.enabledSources = on ? allSourceCodes() : [];
          persistSettings();
        }
        function groupAllEnabled(g){ return g.sources.length > 0 && g.sources.every(s => isSourceEnabled(s.code)); }
        function toggleGroup(g){
          if(!Array.isArray(settings.enabledSources)) settings.enabledSources = [];
          const on = !groupAllEnabled(g);
          g.sources.forEach(s => {
            const i = settings.enabledSources.indexOf(s.code);
            if(on && i < 0) settings.enabledSources.push(s.code);
            if(!on && i >= 0) settings.enabledSources.splice(i,1);
          });
          persistSettings();
        }
        // 設定變動時自動持久化（includeUntranslated 等）
        watch(settings, () => { persistSettings(); }, { deep: true });

        /* 種族選單：採用完整 races.json（86 種）並依【內容來源設定】篩選；無資料時回退到基礎 10 種 */
        const raceOptions = computed(() => {
          const full = (dataState.races || []).filter(r => r && (r.name_zh || r.name) && passesFilter(r));
          if (!full.length) return (coreRules.RACES || []);
          const seen = new Set();
          const list = [];
          full.forEach(r => {
            const label = r.name_zh || r.name;
            if (seen.has(label)) return;
            seen.add(label);
            list.push({ name: label, name_en: r.name_en || '', source: r.source || '' });
          });
          list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
          return list;
        });

        const filteredAvailableSpells = computed(() => {
          let q = newSpellQuery.value.toLowerCase().trim();
          let level = spellFilterLevel.value;
          return availableSpells.value.filter(sp => {
            if (!passesFilter(sp)) return false;
            if (level !== '' && String(sp?.level) !== String(level)) return false;
            if (q) {
              const zh = (sp?.name_zh || sp?.name || '').toLowerCase();
              const en = (sp?.name_en || '').toLowerCase();
              if (!zh.includes(q) && !en.includes(q)) return false;
            }
            return true;
          }).slice(0, 100);
        });
        
        const isSpellInBook = (sp) => {
          if(!selectedChar.value || !selectedChar.value.spellbook) return false;
          return selectedChar.value.spellbook.some(b => b?.name === sp?.name_zh || b?.name === sp?.name || b?.name === sp?.name_en);
        };

        const filteredAvailableItems = computed(() => {
          let q = itemSearch.value.toLowerCase().trim();
          return availableItems.value.filter(item => {
            if (!passesFilter(item)) return false;
            if (!q) return true;
            const zh = (item?.name_zh || item?.name || '').toLowerCase();
            const en = (item?.name_en || '').toLowerCase();
            return zh.includes(q) || en.includes(q);
          }).slice(0, 100);
        });

        
        const totalLevel = computed(() => {
          if (!selectedChar.value || !selectedChar.value.classes) return 1;
          return selectedChar.value.classes.reduce((sum, cl) => sum + (Number(cl.level) || 0), 0) || 1;
        });
        const profBonus = computed(() => Math.ceil(totalLevel.value / 4) + 1);
        const skillValue = (zh) => {
          if (!selectedChar.value || !selectedChar.value.skills) return 0;
          const def = coreRules.SKILLS.find(s => s.zh === zh);
          if (!def) return 0;
          const skData = selectedChar.value.skills[zh];
          if (!skData) return abilityMod(abilityTotal(def.attr));
          if (skData.override !== null && skData.override !== '' && skData.override !== undefined) return Number(skData.override);
          return abilityMod(abilityTotal(def.attr)) + (skData.proficient ? profBonus.value : 0);
        };
        
        const isDMWorld = computed(() => selectedWorldKey.value !== '__solo__');

        const selectedChar = computed(() => {
          if (!selectedCharId.value) return null;
          return chars.value.find(c => c.id === selectedCharId.value) || null;
        });

        // 你現在選中的角色在目前世界的進度存檔槽（每個角色獨立，不再共用世界物件）。
        // 若不存在則自動初始化；若 selectedChar 為 null 則回傳一個暫存空物件避免 template 報錯。
        const activeWorldProgress = computed(() => {
          const char = selectedChar.value;
          const key = selectedWorldKey.value;
          if (!char) return { location:'', time:'', quest:'', records:{ log:[], quest:[], npc:[], clue:[] } };
          if (!char.worldProgress) char.worldProgress = {};
          if (!char.worldProgress[key]) {
            char.worldProgress[key] = { location:'', time:'', quest:'', records:{ log:[], quest:[], npc:[], clue:[] } };
          }
          const wp = char.worldProgress[key];
          if (!wp.records) wp.records = { log:[], quest:[], npc:[], clue:[] };
          return wp;
        });

        watch([isEditMode, activeModule, selectedChar, () => coreRules.SKILLS], ([edit, mod, char, rulesSkills]) => {
          if (mod === 'skills' && char) {
            if (!char.skills) char.skills = {};
            if (rulesSkills && rulesSkills.length) {
              rulesSkills.forEach(s => {
                if (!char.skills[s.zh]) char.skills[s.zh] = { proficient: false, override: null };
              });
            }
          }
          if (edit && mod === 'stats' && char) {
            if (!char.abilities) {
              char.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            }
            if (!char.abilityBonus) {
              char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            }
          }
          if (edit && mod === 'inventory' && char) {
            if (char.inventory && char.inventory.length > 0 && typeof char.inventory[0] === 'string') {
              char.inventory = char.inventory.map(item => ({ name: item, qty: 1, desc: '' }));
            }
          }
        }, { immediate: true });

        // 當選擇的角色改變時，重設世界選擇器並關閉內頁
        watch(selectedCharId, (newId) => {
          selectedWorldKey.value = '__solo__';
          activeModule.value = null;
        });

        // 當世界切換時，退出內頁以防狀態混亂（可選，增加安全感）
        watch(selectedWorldKey, () => {
          if (activeModule.value !== 'story') {
             // activeModule.value = null; // 暫不強制關閉，讓使用者在不同世界間快速比對數值也是一種好體驗
          }
        });

        const requestDMApproval = () => {
          alert(`已發送修改申請至 DM 世界：${selectedWorldKey.value}。請等待 DM 批准。`);
          console.log(`[Action] Requesting DM approval for ${activeModule.value} in world ${selectedWorldKey.value}`);
        };

        // 啟動時讀取 V1 既有的本地存檔資料
        onMounted(() => {
          fetch('../data/spells.json').then(res => res.json()).then(data => {
            availableSpells.value = data.spells || data || [];
            dataState.spells = availableSpells.value;
            reconcileSettings();
          }).catch(() => {
            availableSpells.value = [
              { id: 'fireball', name_zh: '火球術', level: 3 },
              { id: 'magic_missile', name_zh: '魔法飛彈', level: 1 }
            ];
            dataState.spells = availableSpells.value;
          });
          fetch('../data/items.json').then(res => res.json()).then(data => {
            availableItems.value = data.items || [];
            dataState.items = availableItems.value;
            reconcileSettings();
          }).catch(e => {
             console.error("無法讀取物品資料", e);
             availableItems.value = [];
          });
          // 載入來源清單 (sources.json) 與種族 (races.json)，供內容來源設定使用
          fetch('../data/sources.json').then(res => res.json()).then(data => {
            dataState.sources = data.sources || data || [];
            reconcileSettings();
          }).catch(e => { console.error("無法讀取來源資料", e); });
          fetch('../data/races.json').then(res => res.json()).then(data => {
            dataState.races = data.races || data || [];
            reconcileSettings();
          }).catch(e => { console.error("無法讀取種族資料", e); });
          
          migrateToV2();
          let identities = JSON.parse(localStorage.getItem(LS_IDENTITIES) || "[]");
          let instances = JSON.parse(localStorage.getItem(LS_INSTANCES) || "{}");
          
          if (identities.length === 0) {
            // Failsafe
            let dc = window.DND5E_CHAR.defaultChar();
            dc.id = window.uid();
            let iid = dc.id + "@" + DEFAULT_WORLD_ID;
            identities.push({ characterId: dc.id, identity: pickIdentityFields(dc), version_n: 1 });
            instances[iid] = {
              instanceId: iid, characterId: dc.id, worldId: DEFAULT_WORLD_ID,
              mechanical: pickMechanicalFields(dc), narrative: pickInstanceNarrative(dc),
              version_m: 1, version_n: 1, updatedAt: Date.now()
            };
            localStorage.setItem(LS_IDENTITIES, JSON.stringify(identities));
            localStorage.setItem(LS_INSTANCES, JSON.stringify(instances));
          }

          const composed = [];
          for (let ident of identities) {
             let inst = instances[ident.characterId + "@" + DEFAULT_WORLD_ID]; // fallback to default world for now
             if (inst) composed.push(composeC(ident, inst));
          }
          chars.value = composed;
          
          if (!selectedCharId.value) {
            selectedCharId.value = localStorage.getItem("dnd_active") || chars.value[0].id;
          }

        });

        // 統計模塊：計算所有角色、接觸過的世界與戰報數量
        const stats = computed(() => {
          let totalChars = chars.value.length;
          let worldSet = new Set();
          let eventCount = 0;

          chars.value.forEach(ch => {
            if (ch.worldProgress) {
              Object.keys(ch.worldProgress).forEach(k => {
                if (k !== '__solo__') worldSet.add(k);
                // 計算每個世界桶內的筆記數量（新的 records 分類結構：log/quest/npc/clue）
                const recs = ch.worldProgress[k] && ch.worldProgress[k].records;
                if (recs) {
                  ['log','quest','npc','clue'].forEach(cat => {
                    if (Array.isArray(recs[cat])) eventCount += recs[cat].length;
                  });
                }
              });
            }
          });

  
        watch(chars, (newVal) => {
          let identities = JSON.parse(localStorage.getItem(LS_IDENTITIES) || "[]");
          let instances = JSON.parse(localStorage.getItem(LS_INSTANCES) || "{}");
          let changed = false;

          /* worldId 一致性：已連線 DM 房間時，「當前選定角色」的落帳 instance 跟隨 DM 世界，
           * 與 applyCommand/handleRemoteSave 用同一個 instance；其他角色仍落帳本地預設世界。 */
          const _syncWid = (c) => (room.status === 'connected' && room.meta && room.meta.worldId &&
            selectedChar.value && c.id === selectedChar.value.id) ? room.meta.worldId : DEFAULT_WORLD_ID;
          newVal.forEach(c => {
             const wid = _syncWid(c);
             let ident = identities.find(i => i.characterId === c.id);
             let inst = instances[c.id + "@" + wid];
             // 新增角色尚無 identity/instance 種子紀錄 → 先建立，避免存檔被略過（新角色不見 bug）
             if (!ident) {
               ident = { characterId: c.id, identity: pickIdentityFields(c), version_n: 1 };
               identities.push(ident);
               changed = true;
             }
             if (!inst) {
               const iid = c.id + "@" + wid;
               inst = {
                 instanceId: iid, characterId: c.id, worldId: DEFAULT_WORLD_ID,
                 mechanical: pickMechanicalFields(c),
                 narrative: pickInstanceNarrative(c),
                 worldProgress: JSON.parse(JSON.stringify(c.worldProgress || {})),
                 version_m: 1, version_n: 1, updatedAt: Date.now()
               };
               instances[iid] = inst;
               changed = true;
             }
             if (decomposeC(c, ident, inst)) {
               changed = true;
             }
          });

          if (changed) {
            localStorage.setItem(LS_IDENTITIES, JSON.stringify(identities));
            localStorage.setItem(LS_INSTANCES, JSON.stringify(instances));
          }
        }, { deep: true });

        watch(worlds, (newVal) => {
          localStorage.setItem(LS_WORLDS, JSON.stringify(newVal));
        }, { deep: true });

        watch(selectedCharId, (newVal) => {
          if (newVal) localStorage.setItem("dnd_active", newVal);
        });

        return {
            totalChars,
            totalWorlds: worldSet.size,
            totalEvents: eventCount
          };
        });

        const viewTitle = computed(() => {
          switch(currentView.value) {
            case 'dashboard': return '個人儀表板';
            case 'characters': return '我的角色';
            case 'worlds': return '冒險世界';
            case 'settings': return '設定';
            default: return '冒險者檔案';
          }
        });

        /* ===== 頭像上傳：讀檔 → canvas 縮圖 → 寫入 selectedChar.avatar（控制體積避免擐爆 localStorage） ===== */
        const onAvatarPick = (ev) => {
          const f = ev.target && ev.target.files && ev.target.files[0];
          if (!f) return;
          if (!/^image\//.test(f.type)) { alert('請選擇圖片檔案喔~'); return; }
          if (f.size > 8 * 1024 * 1024) { alert('圖片請小於 8MB喔~'); return; }
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              try {
                const MAX = 512; // 長邊最大 512px
                let w = img.width, h = img.height;
                if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                else if (h >= w && h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                // 輸出 jpeg（品質 0.85），大幅縮小 dataURL 體積
                if (selectedChar.value) selectedChar.value.avatar = canvas.toDataURL('image/jpeg', 0.85);
              } catch (e) {
                // 縮圖失敗則直接用原始 dataURL 備援
                if (selectedChar.value) selectedChar.value.avatar = reader.result;
              }
            };
            img.onerror = () => { if (selectedChar.value) selectedChar.value.avatar = reader.result; };
            img.src = reader.result;
          };
          reader.readAsDataURL(f);
          // 清空 input，讓同一張圖可連續重選
          ev.target.value = '';
        };

        const switchView = (view) => {
          currentView.value = view;
          isMenuOpen.value = false;
          activeModule.value = null; // 切換大視圖時關閉內頁
          
          // 全域選定的角色應跨分頁保留（右上角切換器為唯一來源），不再於切換視圖時清空
          if (view === 'characters' && !selectedCharId.value && chars.value.length > 0) {
            // 如果切換到角色視圖且沒有選定角色，預設選擇第一個
            selectedCharId.value = chars.value[0].id;
          }
        };

        /* ===== 資料備份與還原（JSON 匯出 / 匯入） ===== */
        const exportData = () => {
          try {
            // 純資料組裝抽至 shared/services/backup.js（window.DND5E_BACKUP）；UI 保留 Blob/anchor 下載
            const payload = window.DND5E_BACKUP.buildBackupPayload((k) => localStorage.getItem(k));
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = `dnd5e-backup-${stamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            alert('匯出失敗：' + (e && e.message ? e.message : e));
          }
        };

        const importData = (ev) => {
          const f = ev.target && ev.target.files && ev.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              // 解析+驗證抽至 shared/services/backup.js（window.DND5E_BACKUP）
              const BK = window.DND5E_BACKUP;
              const d = BK.parseBackupPayload(reader.result);

              // TC-04：不再無腦全覆蓋，改為 version-aware merge（備份視為另一來源/遠端）
              const imported = BK.extractCollections(d);
              const local = BK.readLocalCollections((k) => localStorage.getItem(k));

              // 偵測衝突（本機已存在且版本號有差異的角色）
              const conflicts = BK.detectConflicts(local, imported);
              const resolutions = {};
              for (const c of conflicts) {
                const keep = !confirm('角色【' + (c.name || c.characterId) + '】已存在本機，且備份進度不同。\n\n按「確定」：用此備份覆蓋本機這個角色；\n按「取消」：不覆蓋，改依版本自動合併（DM／較新的機制進度仍受保護）。');
                // 確定 = 覆蓋；取消 = 不覆蓋，交由版本感知合併決定（文案已與實際行為對齊，TC-04.5）
                if (!keep) resolutions[c.characterId] = 'overwrite';
              }

              // 合併：verison-aware（同 instanceId → DND5E_CHAR.mergeInstance），另附使用者裁決
              const merged = BK.mergeBackup(local, imported, { resolutions });

              const setJSON = (key, val) => {
                if (val === null || val === undefined) return;
                localStorage.setItem(key, JSON.stringify(val));
              };
              setJSON(LS_IDENTITIES, merged.identities);
              setJSON(LS_INSTANCES,  merged.instances);
              if (merged.worlds) setJSON(LS_WORLDS, merged.worlds);
              if (merged.activeWorld) localStorage.setItem(LS_ACTIVE_WORLD, merged.activeWorld);

              const importedCount = (imported.identities || []).length;
              alert('匯入完成（已合併 ' + importedCount + ' 個角色，衝突 ' + conflicts.length + ' 個）！即將重新載入。');
              location.reload();
            } catch (e) {
              alert('匯入失敗：' + (e && e.message ? e.message : e));
            }
          };
          reader.readAsText(f);
          ev.target.value = '';
        };

        /* ===== 刪除：角色（Identity）/ 世界存檔（instance）TC-04.5 ===== */
        // 判斷某世界是否為 DM 世界：只認「實際存在的來源標記」（type:'dm' / roomId / dmId）。
        // 目前單機流程尚未寫入任何 DM 標記（見§7.4/§7.12，DM 世界須經 joinRoom 建立），
        // 故目前實際均會回到「本地世界」（較安全的不可復原警告）。不假造欄位。
        const isDmWorldObj = (w) => !!(w && (w.type === 'dm' || w.roomId || w.dmId));

        const deleteCharacter = (charId) => {
          const id = charId || (selectedChar.value && selectedChar.value.id);
          if (!id) return;
          const ch = chars.value.find(c => c.id === id);
          const nm = (ch && ch.name) || id;
          if (!confirm('確定刪除角色【' + nm + '】？\n\n這會一併清除該角色在「所有世界」的存檔紀錄，且無法復原。')) return;
          if (!confirm('再次確認：永久刪除【' + nm + '】及其所有世界進度？')) return;
          STORE.deleteIdentity(id);
          chars.value = chars.value.filter(c => c.id !== id);
          if (selectedCharId.value === id) {
            selectedCharId.value = chars.value.length ? chars.value[0].id : null;
            selectedWorldKey.value = '__solo__';
            activeModule.value = null;
          }
          if (switcherTempCharId.value === id) { switcherTempCharId.value = null; switcherStep.value = 'char'; }
          isGlobalSwitcherOpen.value = false;
        };

        // 移除目前角色在目前世界的紀錄（單一 instance）。同世界其他角色不受影響。
        const removeCurrentWorldRecord = () => {
          const char = selectedChar.value;
          const wid = selectedWorldKey.value;
          if (!char) return;
          if (wid === '__solo__') { alert('「單人漫遊」為預設沙盒存檔，無法移除。'); return; }
          const w = worlds.value.find(x => x.id === wid);
          const isDM = isDmWorldObj(w);
          const wp = char.worldProgress && char.worldProgress[wid];
          const wname = (w && w.name) || (wp && wp.name) || wid;
          let msg;
          if (isDM) {
            msg = '移除角色【' + char.name + '】在世界【' + wname + '】的本機紀錄？\n\n此世界存檔由 DM 端託管，日後重新入座（掃 QR／握手）可從 DM 版恢復進度。\n\n同世界的其他角色不受影響。';
          } else {
            msg = '移除角色【' + char.name + '】在世界【' + wname + '】的紀錄？\n\n⚠️ 本地世界紀錄刪除後無法復原，建議先到設定頁匯出備份。\n\n同世界的其他角色不受影響。';
          }
          if (!confirm(msg)) return;
          STORE.deleteInstance(char.id + '@' + wid);
          // 同步反應式狀態（目前 per-world 進度存於 char.worldProgress，watcher 會再持久化）
          if (char.worldProgress && Object.prototype.hasOwnProperty.call(char.worldProgress, wid)) {
            delete char.worldProgress[wid];
          }
          if (selectedWorldKey.value === wid) selectedWorldKey.value = '__solo__';
          activeModule.value = null;
        };

        /* ===== P2-A：Firebase 房間（連線基建 + 加入 + 唯讀收訊） =====
         * ⚠️ 延遲初始化：頁面載入不連線；只有按「加入房間」才 init()+signInAnon()。
         * fbApp 為純閉包變數（不可放進 ref：Vue Proxy 包裹 firebase db 會壞掉）。
         */
        const ROOM = (typeof window !== 'undefined') ? window.DND5E_ROOM : null;
        let fbApp = null;
        let roomUnsubs = [];
        const room = Vue.reactive({
          status: 'idle',      // idle | connecting | connected | error
          roomId: '', showConflict: false, conflictSave: null,
          playerId: '',
          meta: null,
          error: '',
          inputRoomId: '',
          players: {},
          messages: [], appliedCommands: new Set() // {type:'broadcast'|'inbox', from, text, ts, _key}
        });

        /* 讀網址 ?room= 自動帶入房號（根入口會帶此參數轉來） */
        try {
          const _qs = new URLSearchParams(location.search);
          const _r = _qs.get('room');
          if (_r && ROOM) room.inputRoomId = ROOM.normRoomId(_r);
        } catch (e) {}

        /* players 快照：當前選定角色的 name/level/characterId + Tier1 關鍵數值（HP/AC） */
        const buildPlayerSnapshot = () => {
          const c = selectedChar.value;
          if (!c) return { name: '(未選角色)', level: 1 };
          const level = (c.classes || []).reduce((s, cl) => s + (Number(cl.level) || 0), 0) || 1;
          const snap = {
            name: c.name || '冒險者',
            level: level,
            characterId: c.id || '',
            hp: { current: (c.hp && Number(c.hp.current)) || 0, max: (c.hp && Number(c.hp.max)) || 0 },
            ac: (computedAC && computedAC.value) || c.ac || 10
          };
          return snap;
        };

        /* §5.6 首入座綁 worldId：於本機建立/更新 DM 世界條目 + 綁 active instance（不覆蓋既有本地世界） */
        
        /* 當前同步世界 id：已連線 DM 房間→ room.meta.worldId；否則 DEFAULT_WORLD_ID。
         * applyCommand 落帳、handleRemoteSave 讀取必須用同一個 instance（worldId 一致性）。 */
        const currentWorldId = () => (room.meta && room.meta.worldId) ? room.meta.worldId : DEFAULT_WORLD_ID;

        /* 指令去重持久化：per room+player 存已套用的 push key，
         * 避免重連 onCommand child_added 重放歷史指令而重複重算。 */
        const appliedStorageKey = () => 'dnd_applied_cmds_' + (room.roomId || '') + '_' + (room.playerId || '');
        const loadAppliedCommands = () => {
          try {
            const raw = localStorage.getItem(appliedStorageKey());
            const arr = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(arr) ? arr : []);
          } catch (e) { return new Set(); }
        };
        const persistAppliedCommands = () => {
          try { localStorage.setItem(appliedStorageKey(), JSON.stringify([...room.appliedCommands])); } catch (e) {}
        };

        const applyCommand = (cmd) => {
          const char = selectedChar.value;
          if (!char) return;
          let text = '';
          const cName = char.name || '角色';
          let changed = false;

          switch(cmd.type) {
            case 'damage': {
              if(!char.hp) char.hp = {current:10, max:10};
              const before = Number(char.hp.current) || 0;
              char.hp.current = Math.max(0, before - (Number(cmd.amount)||0));
              text = `DM 已調整 HP：${before}→${char.hp.current}（${cmd.damageType || cmd.note || '傷害'}）`;
              changed = true;
              break;
            }
            case 'heal': {
              if(!char.hp) char.hp = {current:10, max:10};
              const before = Number(char.hp.current) || 0;
              char.hp.current = Math.min(char.hp.max, before + (Number(cmd.amount)||0));
              text = `DM 已調整 HP：${before}→${char.hp.current}（${cmd.note || '治療'}）`;
              changed = true;
              break;
            }
            case 'gold': {
              if(!char.coins) char.coins = {cp:0, sp:0, gp:0, pp:0};
              char.coins.gp = Math.max(0, (Number(char.coins.gp)||0) + (Number(cmd.amount)||0));
              text = `${cName} 金錢變更 ${cmd.amount} gp`;
              if (cmd.note) text += '（' + cmd.note + '）';
              changed = true;
              break;
            }
            case 'xp': {
              char.xp = (Number(char.xp)||0) + (Number(cmd.amount)||0);
              text = `${cName} 獲得 ${cmd.amount} XP（目前 ${char.xp}）`;
              if (cmd.note) text += '（' + cmd.note + '）';
              changed = true;
              break;
            }
            case 'give-item': {
              if(!char.inventory) char.inventory = [];
              const qty = Number(cmd.qty)||1;
              char.inventory.push({ name: cmd.itemName || '未知物品', qty: qty, desc: cmd.note || '' });
              text = `${cName} 獲得物品：${cmd.itemName || '未知物品'}${qty > 1 ? ' ×' + qty : ''}`;
              changed = true;
              break;
            }
            default:
              text = `未知指令: ${cmd.type}`;
          }

          /* 紅線 R4：DM 指令造成的機制變更「不得」bump 玩家端 version_m，
           * 否則玩家假性領先→之後拒絕 DM 權威存檔。
           * 做法：把變更「直接落帳到 store instance 且保留既有版本」，
           * 如此稍後 reactive watch 的 decomposeC 比對 old==new → 偵測不到差異 → 不 bump。
           * 玩家 version_m 只在「玩家自己主動編輯」時遷增（watch 偵測到 char 與 instance 有差異）。 */
          if (changed && window.DND5E_STORE && char.id) {
            const wid = currentWorldId();
            const inst = STORE.loadInstances()[char.id + '@' + wid];
            STORE.writeInstanceFromChar(char, wid, {
              version_m: inst ? (inst.version_m || 0) : 0,
              version_n: inst ? (inst.version_n || 0) : 0
            });
          }

          room.messages.push({
            type: 'inbox',
            from: '系統 (指令套用)',
            text: text,
            ts: cmd.ts || Date.now(),
            _key: cmd._key + '_log'
          });
        };

        /* 把 DM 權威存檔（remote = 攤平 char 形狀：機制欄位在頂層 + _sync）
         * 真正套用到 live char 與 store instance。
         * 合流一律委派 DND5E_CHAR.mergeInstance；用 extractZone/applyZone 把 merged 結果
         * 明確套回 char（不用 Object.assign(char, merged.mechanical)——mergeInstance 回傳的
         * 是攤平 char，根本沒有 .mechanical，舊寫法會套到 undefined / stale 子物件）。 */
        const adoptRemoteSave = (save, opts) => {
          const char = selectedChar.value;
          const C = window.DND5E_CHAR;
          if (!char || !save || !C) return;
          const wid = (room.meta && room.meta.worldId) || DEFAULT_WORLD_ID;
          /* force：衝突「採用 DM（覆寫本機）」路徑。此時本機 version_m 恆 > DM，
           * 若走 mergeInstance 的版本閘（rm >= local 才套機制區）→ 機制/敘事區永不套 → no-op。
           * 故繞閘：直接以 DM save 為準，用 schema helper（extractZone/applyZone）明確套 DM 的
           * 機制/敘事區（不自寫合併規則），並把 _sync 對齊 DM 版本（避免下次又被判本機領先→假衝突）。 */
          if (opts && opts.force) {
            C.applyZone(char, 'mechanical', C.extractZone(save, 'mechanical'));
            C.applyZone(char, 'narrative', C.extractZone(save, 'narrative'));
            C.ensureSync(char);
            const rs = save._sync || {};
            char._sync.version_m = rs.version_m || 0;
            char._sync.version_n = rs.version_n || 0;
            STORE.writeInstanceFromChar(char, wid, {
              version_m: char._sync.version_m,
              version_n: char._sync.version_n
            });
            return;
          }
          const localInst = STORE.loadInstances()[char.id + '@' + wid];
          // local flat：優先取權威 store instance（巢狀→攤平）；缺 instance（首次入世界）
          // → 由 char 現值攤平且版本歸 0，讓 DM save 必定被採用（rm >= 0）。
          let localFlat;
          if (localInst) {
            localFlat = STORE.instanceToFlat(localInst);
          } else {
            localFlat = C.extractZone(char, 'mechanical');
            Object.assign(localFlat, C.extractZone(char, 'narrative'));
            localFlat._sync = { version_m: 0, version_n: 0 };
          }
          const merged = C.mergeInstance(localFlat, save);   // 回傳「攤平 char 形狀」
          // 用 applyZone 把 merged 的機制/敘事欄位真正套回 live char（HP/金錢/物品/等級/xp…→ DM 值）
          C.applyZone(char, 'mechanical', C.extractZone(merged, 'mechanical'));
          C.applyZone(char, 'narrative', C.extractZone(merged, 'narrative'));
          C.ensureSync(char);
          char._sync.version_m = (merged._sync && merged._sync.version_m) || 0;
          char._sync.version_n = (merged._sync && merged._sync.version_n) || 0;
          // 落回 store instance：採 DM 版本，不 bump（DM 權威）
          STORE.writeInstanceFromChar(char, wid, {
            version_m: char._sync.version_m,
            version_n: char._sync.version_n
          });
        };

        const handleRemoteSave = (save) => {
          const char = selectedChar.value;
          if (!char || !save) return;
          const wid = (room.meta && room.meta.worldId) || DEFAULT_WORLD_ID;
          const localInst = STORE.loadInstances()[char.id + '@' + wid];

          const localVm = localInst ? (localInst.version_m || 0) : 0;
          const remoteVm = (save._sync && save._sync.version_m) || 0;

          if (localVm > remoteVm) {
            // 玩家機制版本真的領先（來自玩家自己的編輯）→ 不靜默覆寫，跳衝突 UI 轉提案。
            room.conflictSave = save;
            room.showConflict = true;
            return;
          }
          // DM 較新或相等（含「恢復」情境）→ 採用 DM 權威。
          adoptRemoteSave(save);
        };

        const bindDmWorld = (meta, rid) => {
          if (!meta || !meta.worldId) return;
          try {
            /* world.rules.allowPactFamiliar 預設 false（familiar-preset-spec §5）。
             * 保留任何既有 rules（如 DM 日後開啟），僅在缺欄時補 false。 */
            const _existW = (worlds.value || []).find((w) => w && (w.worldId === meta.worldId || w.id === meta.worldId));
            const _rules = Object.assign({ allowPactFamiliar: false }, (_existW && _existW.rules) || {});
            STORE.upsertWorld({ worldId: meta.worldId, name: meta.worldId, type: 'dm', roomId: rid, dmId: meta.dmId || null, rules: _rules });
            worlds.value = STORE.loadWorlds() || worlds.value;
            if (selectedChar.value && selectedChar.value.id) {
              STORE.bindActiveWorld(selectedChar.value.id, meta.worldId);
            }
          } catch (e) { console.error('bindDmWorld failed', e); }
        };

        const joinRoom = async () => {
          if (!ROOM || !window.DND5E_FIREBASE) { room.status = 'error'; room.error = '連線模組未載入'; return; }
          const rid = ROOM.normRoomId(room.inputRoomId);
          if (!rid) { room.error = '請輸入房號'; return; }
          if (room.status === 'connecting') return;
          room.status = 'connecting'; room.error = '';
          try {
            if (!fbApp) fbApp = ROOM.init(window.DND5E_FIREBASE.firebaseConfig);
            const uid = await ROOM.signInAnon(fbApp.auth);
            room.playerId = uid;
            const meta = await ROOM.roomMeta(fbApp.db, rid);
            if (!meta) { room.status = 'error'; room.error = '找不到房間「' + rid + '」，請確認房號是否正確。'; return; }
            room.meta = meta;
            room.roomId = rid;
            /* 指令去重持久化：重連時先載回已套用的 push key，避免 onCommand 重放歷史指令重算。 */
            room.appliedCommands = loadAppliedCommands();
            await ROOM.joinRoom(fbApp.db, rid, uid, buildPlayerSnapshot());
            bindDmWorld(meta, rid);
            /* 唯讀訂閱：廣播 + 自己的密報 + 隊伍名單 */
            roomUnsubs.push(ROOM.onBroadcast(fbApp.db, rid, (m) => { room.messages.push(Object.assign({ type: 'broadcast' }, m)); }));
            roomUnsubs.push(ROOM.onInbox(fbApp.db, rid, uid, (m) => { room.messages.push(Object.assign({ type: 'inbox' }, m)); }));
            roomUnsubs.push(ROOM.onPlayers(fbApp.db, rid, (ps) => { room.players = ps || {}; }));
            roomUnsubs.push(ROOM.onCommand(fbApp.db, rid, uid, (cmd) => {
              if (room.appliedCommands.has(cmd._key)) return;
              room.appliedCommands.add(cmd._key);
              persistAppliedCommands();
              applyCommand(cmd);
            }));
            const cId = selectedChar.value ? selectedChar.value.id : null;
            if (cId) {
              roomUnsubs.push(ROOM.onSave(fbApp.db, rid, cId, (save) => {
                if (save) handleRemoteSave(save);
              }));
            }
            room.status = 'connected';
          } catch (e) {
            room.status = 'error';
            room.error = '加入失敗：' + (e && e.message ? e.message : e);
          }
        };

        const sendRoomRequest = async (req) => {
          if (!ROOM || !fbApp || room.status !== 'connected') return;
          try {
            await ROOM.sendRequest(fbApp.db, room.roomId, room.playerId, req);
            alert('請求已送出');
          } catch(e) {
            alert('送出失敗: ' + e.message);
          }
        };
        const resolveConflict = (action) => {
          if (action === 'adopt_dm') {
            // 採用 DM（覆寫本機）：衝突情境下本機 version_m 領先，必須繞過 mergeInstance 版本閘，
            // 強制以 DM 存檔為準（force），否則機制/敘事區永不套用→按鈕靜默無效。
            if (room.conflictSave) adoptRemoteSave(room.conflictSave, { force: true });
          } else if (action === 'keep_local') {
            // 保留本機 → 不靜默覆寫 DM 權威，轉為提案送 DM 審核（請求通道）。
            const c = selectedChar.value;
            const localHp = (c && c.hp) ? c.hp.current : '?';
            const lvl = ((c && c.classes) || []).reduce((a, cl) => a + (Number(cl.level) || 0), 0);
            try {
              sendRoomRequest({ kind: 'ask', text: `【存檔提案】玩家本機進度較新（HP=${localHp}、等級=${lvl}），請 DM 審核是否採用本機版本。` });
            } catch (e) {}
          }
          room.showConflict = false;
          room.conflictSave = null;
        };
        const leaveRoom = () => {


          roomUnsubs.forEach((fn) => { try { fn(); } catch (e) {} });
          roomUnsubs = [];
          room.status = 'idle';
          room.roomId = '';
          room.meta = null;
          room.error = '';
          room.players = {};
          room.messages = [];
        };

        /* 衝突面板實際列出本機 vs DM 的關鍵欄位差異（不是固定文案）。
         * conflictSave = 攤平 char 形狀（機制欄位在頂層）。 */
        const conflictDiff = Vue.computed(() => {
          const c = selectedChar.value;
          const s = room.conflictSave;
          if (!c || !s) return [];
          const rows = [];
          const push = (label, local, dm) => { if (String(local) !== String(dm)) rows.push({ label, local, dm }); };
          const lvl = (arr) => (arr || []).reduce((a, cl) => a + (Number(cl.level) || 0), 0);
          push('HP', (c.hp && c.hp.current != null) ? c.hp.current : '-', (s.hp && s.hp.current != null) ? s.hp.current : '-');
          push('等級', lvl(c.classes), lvl(s.classes));
          push('金錢(gp)', (c.coins && c.coins.gp) || 0, (s.coins && s.coins.gp) || 0);
          push('物品數', (c.inventory || []).length, (s.inventory || []).length);
          push('XP', c.xp || 0, s.xp || 0);
          return rows;
        });

        /* 請求新增物品表單（kind:'add'），與現有 ask 並存。 */
        const addRequestForm = Vue.reactive({ itemName: '', qty: 1, reason: '' });
        const submitAddRequest = () => {
          const name = String(addRequestForm.itemName || '').trim();
          if (!name) { alert('請輸入物品名稱'); return; }
          sendRoomRequest({
            kind: 'add',
            itemName: name,
            qty: Number(addRequestForm.qty) || 1,
            reason: String(addRequestForm.reason || '').trim()
          });
          addRequestForm.itemName = ''; addRequestForm.qty = 1; addRequestForm.reason = '';
        };

        /* ===== 魔寵範本匯入 (Familiar Preset Import) — familiar-preset-spec §5/§6 ===== */
        const FAM_PRESETS = (typeof window !== 'undefined') ? window.DND5E_FAMILIAR_PRESETS : null;
        /* 主權閘門 ctx：接既有狀態，不新造平行狀態。
         *   mode:    DM 世界(isDmWorldObj) → 'dm'，否則本地/單人 → 'local'
         *   started: 已連線 DM 房間(room.status==='connected') = 開團 → 機制面鎖定
         *   allowPactFamiliar: world.rules.allowPactFamiliar（預設 false） */
        const familiarImportCtx = computed(() => {
          const w = selectedWorldObj.value;
          return {
            mode: isDmWorldObj(w) ? 'dm' : 'local',
            started: room.status === 'connected',
            allowPactFamiliar: !!(w && w.rules && w.rules.allowPactFamiliar)
          };
        });
        /* 依 tier 分組，附逐項閘門判定 */
        const familiarPresetGroups = computed(() => {
          if (!FAM_PRESETS || !FAM_PRESETS.PRESETS) return [];
          const ctx = familiarImportCtx.value;
          const groups = {};
          const order = [];
          FAM_PRESETS.PRESETS.forEach((p) => {
            if (!groups[p.tier]) {
              groups[p.tier] = { tier: p.tier, label: (FAM_PRESETS.TIER_LABELS && FAM_PRESETS.TIER_LABELS[p.tier]) || p.tier, items: [] };
              order.push(p.tier);
            }
            const gate = FAM_PRESETS.canImportFamiliar(p, ctx);
            groups[p.tier].items.push({ preset: p, allowed: gate.ok, reason: gate.reason });
          });
          return order.map((k) => groups[k]);
        });
        const familiarImport = Vue.reactive({ pickerOpen: false, confirmPreset: null });
        const openFamiliarPresetPicker = () => { familiarImport.pickerOpen = true; };
        const closeFamiliarPresetPicker = () => { familiarImport.pickerOpen = false; familiarImport.confirmPreset = null; };
        const askImportFamiliarPreset = (entry) => {
          if (!entry || !entry.allowed) return;
          familiarImport.confirmPreset = entry.preset;
        };
        const confirmImportFamiliarPreset = () => {
          const preset = familiarImport.confirmPreset;
          const char = selectedChar.value;
          if (!preset || !char || !FAM_PRESETS) { familiarImport.confirmPreset = null; return; }
          /* 對話框開啟期間狀態可能改變（例如剛開團）→ 再驗一次閘門 */
          const gate = FAM_PRESETS.canImportFamiliar(preset, familiarImportCtx.value);
          if (!gate.ok) { alert(gate.reason || '目前無法匯入此範本。'); familiarImport.confirmPreset = null; return; }
          /* 覆蓋機制面、保留玩家敘事面（name/story/notes） */
          char.familiar = FAM_PRESETS.applyPreset(char.familiar, preset);
          familiarImport.confirmPreset = null;
          familiarImport.pickerOpen = false;
        };

        return {
          familiarImportCtx,
          familiarPresetGroups,
          familiarImport,
          openFamiliarPresetPicker,
          closeFamiliarPresetPicker,
          askImportFamiliarPreset,
          confirmImportFamiliarPreset,
          room,
          conflictDiff,
          addRequestForm,
          submitAddRequest,
          joinRoom,
          leaveRoom,
resolveConflict,
sendRoomRequest,
          sortedMessages: Vue.computed(() => room.messages.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))),
          deleteCharacter,
          removeCurrentWorldRecord,
          isDmWorldObj,
          isMenuOpen,
          isGlobalSwitcherOpen,
          switcherStep,
          switcherTempCharId,
          switcherTempChar,
          openGlobalSwitcher,
          selectSwitcherChar,
          confirmSwitcherWorld,
          createNewWorld,
          createNewChar: () => {
            console.log("createNewChar clicked");
            const newChar = {
              id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
              name: '新冒險者',
              race: '',
              alignment: '',
              classes: [],
              abilities: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
              abilityBonus: { str:0, dex:0, con:0, int:0, wis:0, cha:0 },
              hp: { current:10, max:10, temp:0 },
              ac: 10,
              initiative: 0,
              inventory: [],
              spellbook: [],
              spellSlots: Array.from({length:9}, (_,i)=>({ level:i+1, max:0, used:0 })),
              familiar: null,
              skills: {},
              worldProgress: {}
            };
            chars.value.push(newChar);
            selectedCharId.value = newChar.id;
            switchView('characters');
          },
          currentView,
          viewTitle,
          switchView,

          worlds,
          selectedWorldObj,
          chars,
          stats,
          selectedCharId,
          selectedChar,
          activeWorldProgress,
          selectedWorldKey,
          CLASSES: Vue.computed(() => coreRules.CLASSES),
          SKILLS: Vue.computed(() => coreRules.SKILLS),
          CONDITIONS: Vue.computed(() => coreRules.CONDITIONS),
          COMMON_LANGUAGES: Vue.computed(() => coreRules.COMMON_LANGUAGES),
          ARMOR_OPTIONS: Vue.computed(() => coreRules.ARMOR_OPTIONS),
          WEAPON_OPTIONS: Vue.computed(() => coreRules.WEAPON_OPTIONS),
          TOOL_OPTIONS: Vue.computed(() => coreRules.TOOL_OPTIONS),
          RACES: Vue.computed(() => coreRules.RACES),
          ALIGNMENTS: Vue.computed(() => coreRules.ALIGNMENTS),
          BACKGROUNDS: Vue.computed(() => coreRules.BACKGROUNDS),
          activeModule,
          onAvatarPick,
          isEditMode, isWorldEditMode, worldEditTemp, activeRecordTab, newRecordText, recordTabs, startWorldEdit, saveWorldEdit, addWorldRecord, removeWorldRecord, availableSpells,
          newSpellQuery,
          spellFilterLevel,
          filteredAvailableSpells,
          isSpellInBook,
          customSpell,
          availableItems,
          itemSearch,
          filteredAvailableItems,
          customItem,
          // ===== 內容來源設定（設定頁） =====
          settings,
          sourceGroups,
          enabledCount,
          totalSourceCount,
          sourceCountsText,
          sourceLabelOf,
          isSourceEnabled, raceOptions,
          exportData,
          importData,
          toggleSource,
          selectAllSources,
          groupAllEnabled,
          toggleGroup,
          addItem: (it) => {
            if(!selectedChar.value.inventory) selectedChar.value.inventory = [];
            
            // Fix: Find existing item and increment qty to prevent "missing/reduced quantities" feeling
            let existingItem = selectedChar.value.inventory.find(x => x.name === (it?.name_zh || it?.name_en || it?.name));
            if (existingItem) {
              existingItem.qty = (existingItem.qty || 1) + 1;
              return;
            }

            // Fix: Extract description properly from entries_zh array
            let itemDesc = '';
            if (Array.isArray(it.entries_zh)) itemDesc = it.entries_zh.join('\n');
            else if (Array.isArray(it.entries)) itemDesc = it.entries.join('\n');
            else itemDesc = it.desc || '';

            selectedChar.value.inventory.push({ 
              name: it?.name_zh || it?.name_en || it?.name, 
              qty: 1, 
              desc: itemDesc,
              category: it?.type || it?.category || '',
              equipped: false,
              id: Date.now() + Math.random()
            });
          },
          addCustomItem: () => {
            if(!selectedChar.value.inventory) selectedChar.value.inventory = [];
            if(customItem.value.name) {
              selectedChar.value.inventory.push({ 
                name: customItem.value.name, 
                qty: customItem.value.qty || 1, 
                desc: customItem.value.desc || '',
                equipped: false,
                id: Date.now() + Math.random()
              });
              customItem.value.name = '';
              customItem.value.qty = 1;
              customItem.value.desc = '';
            }
          },
          equippedItems: Vue.computed(() => (selectedChar.value?.inventory || []).filter(i => i.equipped)),
          backpackItems: Vue.computed(() => (selectedChar.value?.inventory || []).filter(i => !i.equipped)),
          clickSpellSlot: (slot, i) => {
            if (slot.used === i) slot.used = i - 1;
            else slot.used = i;
          },
          toggleEquip: (item) => {
            if (item) item.equipped = !item.equipped;
            
            // 清理上一版殘留的髒數據 (防呆還原)
            const char = selectedChar.value;
            if (item._appliedStats && char && char.abilityBonus) {
              for (let k in item._appliedStats) { char.abilityBonus[k] -= item._appliedStats[k]; }
              delete item._appliedStats;
            }

            let text = String(item?.name || '') + ' ' + String(item?.desc || '');
            let acMatch = text.match(/AC\s*\+(\d+)/i) || text.match(/防禦等級.*?\+(\d+)/);
            let saveMatch = text.match(/豁免.*?\+(\d+)/);

            if (acMatch || saveMatch) {
              alert(`【裝備狀態切換】\n\n您${item?.equipped ? '裝備' : '卸下'}了「${item?.name}」\n` + 
                    (acMatch ? `\n• 防禦等級 (AC) ${item?.equipped ? '+' : '-'}${acMatch[1]}` : '') +
                    (saveMatch ? `\n• 豁免檢定 ${item?.equipped ? '+' : '-'}${saveMatch[1]}` : '') +
                    `\n\n(註：能力值已由系統【即時動態運算】，但 AC 與豁免目前請於戰鬥時自行加減！)`);
            }
          },
          removeItem: (idx) => { selectedChar.value.inventory.splice(idx, 1); },
          addSpell: (sp) => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; selectedChar.value.spellbook.push({ id: sp.id || Date.now(), name: sp?.name_zh || sp?.name_en || sp?.name, level: sp?.level, desc: (
  [
    sp.school ? `學派: ${sp.school}` : null,
    sp.time && sp.time.length ? `施法時間: ${sp.time.map(t => t.number + ' ' + t.unit).join(', ')}` : null,
    sp.range && sp.range.distance ? `射程: ${sp.range.distance.amount || ''} ${sp.range.distance.type || ''}` : null,
    sp.components ? `成分: ${Object.keys(sp.components).filter(k=>sp.components[k]).join(', ').toUpperCase()}` : null,
    sp.duration && sp.duration.length ? `持續: ${sp.duration.map(d => d.type === 'instant' ? '瞬間' : (d.duration ? d.duration.amount + ' ' + d.duration.type : d.type)).join(', ')}` : null,
    sp.ritual ? '【儀式】' : null
  ].filter(Boolean).join(' | ') + 
  '\n\n' +
  (Array.isArray(sp.entries_zh) ? sp.entries_zh.join('\n') : (Array.isArray(sp.entries) ? sp.entries.join('\n') : (sp.desc_zh || sp.desc_en || sp.desc || '')))
).trim(), custom: false }); },
          addCustomSpell: () => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; if(customSpell.value.name) { selectedChar.value.spellbook.push({ id: Date.now(), name: customSpell.value.name, level: customSpell.value.level, desc: customSpell.value.desc || '', custom: true }); customSpell.value.name = ''; customSpell.value.desc = ''; } },
          removeSpell: (idx) => { selectedChar.value.spellbook.splice(idx, 1); },
          computedAC,
          abilityTotal,
          abilityMod,
          fmtMod,
          abilityDefs,
          profBonus,
          skillValue,
          isDMWorld,
          requestDMApproval,
          subclassDef: (cl) => {
            const def = (coreRules.CLASSES || []).find(k => k.name_en === (cl?.name_en || cl?.name));
            if(!def || !def.subclasses || !def.subclasses.length) return null;
            return { label: def.subclass_label, level: def.subclass_level, list: def.subclasses };
          },
          selectedSubclassDesc: (cl) => {
            const def = (coreRules.CLASSES || []).find(k => k.name_en === (cl?.name_en || cl?.name));
            if(!def || !def.subclasses || !cl.subclass) return "";
            const sc = def.subclasses.find(x => x?.name_en === cl.subclass);
            return sc ? (sc?.name_zh + "：" + (sc.desc_zh || '')) : "";
          },
          getClassName: (cl) => {
            const def = (coreRules.CLASSES || []).find(k => k.name_en === (cl?.name_en || cl?.name));
            return def ? def?.name_zh : (cl?.name_en || cl?.name);
          },
          getSubclassName: (cl) => {
            const def = (coreRules.CLASSES || []).find(k => k.name_en === (cl?.name_en || cl?.name));
            if(!def || !def.subclasses || !cl.subclass) return "";
            const sc = def.subclasses.find(x => x?.name_en === cl.subclass);
            return sc ? sc?.name_zh : cl.subclass;
          },
          featOpen,
          toggleFeat: (idx) => { featOpen.value[idx] = !featOpen.value[idx]; },
          descOpen,
          toggleDesc,
          needsExpand,
          hasStatEffect,
          classFeaturesFor: (cl) => {
            const def = coreRules.CLASSES.find(k => k.name_en === (cl?.name_en || cl?.name));
            const lv = Number(cl.level) || 0;
            if(!def || !def.features) return [];
            return def.features.filter(f => !f.level || f.level <= lv);
          },
          subclassFeaturesFor: (cl) => {
            const def = coreRules.CLASSES.find(k => k.name_en === (cl?.name_en || cl?.name));
            const lv = Number(cl.level) || 0;
            if(!def || !def.subclasses || !cl.subclass) return [];
            const sc = def.subclasses.find(x => x?.name_en === cl.subclass);
            if(!sc || !sc.features) return [];
            return sc.features.filter(f => !f.level || f.level <= lv);
          }
        };
      }
    });

    
    app.config.errorHandler = (err, vm, info) => {
      console.error('VUE GLOBAL ERROR:', err, info);
      document.body.innerHTML = '<div style="color:red;font-size:20px;padding:20px;"><h1>VUE ERROR</h1><pre>' + err.stack + '</pre><p>Info: ' + info + '</p></div>';
    };

    app.mount('#app');

    /* ===== 挂載完成：淡出開場 Loading Screen ===== */
    (function () {
      const boot = document.getElementById('app-boot');
      if (!boot) return;
      const hide = () => {
        boot.classList.add('boot-hide');
        setTimeout(() => { boot.remove(); }, 400);
      };
      // 至少顯示一瞬間，避免閃一下就消失
      setTimeout(hide, 300);
    })();

    /* ===== PWA：註册 Service Worker ===== */
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(() => {});
      });
    }
