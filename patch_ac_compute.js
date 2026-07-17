const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The user is asking "How is AC calculated?"
// Currently, AC isn't calculated at all! Familiar has its own AC, but the main character doesn't have an AC field shown on the UI yet in V2. 
// V2's "Stats" only shows Abilities, not Combat stats (HP, AC, Speed, Initiative).
// Let's add an AC display to the Stats module!
const findStatsView = `<div v-if="!isEditMode" class="grid grid-cols-3 gap-3">`;
const replaceStatsView = `<!-- Combat Stats -->
                  <div class="mb-4 grid grid-cols-2 gap-3">
                    <div class="border border-blue-200 p-3 rounded-lg bg-blue-50 flex items-center justify-between shadow-sm">
                      <div class="text-xs font-bold text-blue-800">防禦等級 (AC)</div>
                      <div class="text-2xl font-black text-blue-900">{{ computedAC }}</div>
                    </div>
                    <div class="border border-green-200 p-3 rounded-lg bg-green-50 flex items-center justify-between shadow-sm">
                      <div class="text-xs font-bold text-green-800">先攻加值</div>
                      <div class="text-2xl font-black text-green-900">{{ fmtMod(abilityMod(abilityTotal('dex'))) }}</div>
                    </div>
                  </div>

                  <div v-if="!isEditMode" class="grid grid-cols-3 gap-3">`;
html = html.replace(findStatsView, replaceStatsView);

const findStatsEdit = `<div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">`;
const replaceStatsEdit = `<div v-else>
                    <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <div class="text-xs font-bold text-blue-800">基礎防禦等級 (未穿甲)</div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-blue-600">10 + 敏捷調整值 =</span>
                        <span class="text-lg font-black text-blue-900">{{ 10 + abilityMod(abilityTotal('dex')) }}</span>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">`;
html = html.replace(findStatsEdit, replaceStatsEdit);

const findSetupEnd = `const abilityTotal = (key) => {`;
const replaceSetupEnd = `const computedAC = computed(() => {
          const char = selectedChar.value;
          if (!char) return 10;
          const dexMod = abilityMod((Number(char.abilities?.dex) || 10) + (Number(char.abilityBonus?.dex) || 0));
          
          let baseAC = 10 + dexMod;
          let armorAC = null;
          let bonusAC = 0;
          let shieldAC = 0;
          
          const equipped = (char.inventory || []).filter(i => i.equipped);
          equipped.forEach(item => {
            let text = String(item.name || '') + ' ' + String(item.desc || '');
            
            // 處理護甲基礎AC
            let matchArmor = text.match(/AC:\\s*(\\d+)/);
            if (matchArmor && item.category && item.category.includes('護甲')) {
              let acVal = parseInt(matchArmor[1], 10);
              // 如果是中甲，敏捷加值最多+2
              if (item.category.includes('中型')) acVal += Math.min(2, dexMod);
              // 如果是重甲，不加敏捷
              else if (item.category.includes('重型')) acVal = acVal;
              // 輕甲
              else acVal += dexMod;
              
              if (armorAC === null || acVal > armorAC) armorAC = acVal;
            }
            
            // 處理盾牌
            if (item.category && item.category.includes('盾牌')) shieldAC = 2;
            
            // 處理額外AC加值 (例如 AC +1)
            let matchBonus = text.match(/AC\\s*\\+(\\d+)/i) || text.match(/防禦等級.*?\\+(\\d+)/);
            if (matchBonus) {
              bonusAC += parseInt(matchBonus[1], 10);
            }
          });
          
          return (armorAC !== null ? armorAC : baseAC) + shieldAC + bonusAC;
        });

        const abilityTotal = (key) => {`;
html = html.replace(findSetupEnd, replaceSetupEnd);

const returnFind = `abilityTotal,`;
const returnReplace = `computedAC,
          abilityTotal,`;
html = html.replace(returnFind, returnReplace);

fs.writeFileSync('v2/index.html', html);
