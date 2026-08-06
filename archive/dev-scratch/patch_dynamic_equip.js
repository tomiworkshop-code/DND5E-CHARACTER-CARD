const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetTotal = `const abilityTotal = (key) => (Number(selectedChar.value?.abilities?.[key]) || 10) + (Number(selectedChar.value?.abilityBonus?.[key]) || 0);`;
const newTotal = `const abilityTotal = (key) => {
          const char = selectedChar.value;
          if (!char) return 10;
          const baseSum = (Number(char.abilities?.[key]) || 10) + (Number(char.abilityBonus?.[key]) || 0);
          
          // 動態計算裝備影響
          const zhMap = { str:'力量', dex:'敏捷', con:'體質', int:'智力', wis:'感知', cha:'魅力' };
          const zh = zhMap[key];
          const equipped = (char.inventory || []).filter(i => i.equipped);
          
          let override = 0;
          equipped.forEach(item => {
            let text = String(item.name || '') + ' ' + String(item.desc || '');
            const match = text.match(new RegExp(zh + '值變為(\\\\d+)'));
            if (match) {
              const val = parseInt(match[1], 10);
              if (val > override) override = val;
            }
          });
          
          return override > baseSum ? override : baseSum;
        };`;
html = html.replace(targetTotal, newTotal);

const targetToggleStart = `          toggleEquip: (item) => {
            item.equipped = !item.equipped;
            
            let text = String(item.name || '') + ' ' + String(item.desc || '');`;
            
const targetToggleEnd = `              // 關鍵字有中，但 parser 沒抓到明確數字
              alert(\`【裝備系統提示】\\n\\n您\${item.equipped ? '裝備' : '卸下'}了「\${item.name}」。\\n此物品似乎帶有特殊數值加成，但系統無法自動解析，請記得手動調整能力值喔！\`);
            }
          },`;

// We use regex to replace the whole toggleEquip function since it's large
const toggleRegex = /toggleEquip:\s*\([\s\S]*?},\n\s*removeItem:/m;

const newToggle = `toggleEquip: (item) => {
            item.equipped = !item.equipped;
            
            // 清理上一版殘留的髒數據 (防呆還原)
            const char = selectedChar.value;
            if (item._appliedStats && char && char.abilityBonus) {
              for (let k in item._appliedStats) { char.abilityBonus[k] -= item._appliedStats[k]; }
              delete item._appliedStats;
            }

            let text = String(item.name || '') + ' ' + String(item.desc || '');
            let acMatch = text.match(/AC\\s*\\+(\\d+)/i) || text.match(/防禦等級.*?\\+(\\d+)/);
            let saveMatch = text.match(/豁免.*?\\+(\\d+)/);

            if (acMatch || saveMatch) {
              alert(\`【裝備狀態切換】\\n\\n您\${item.equipped ? '裝備' : '卸下'}了「\${item.name}」\\n\` + 
                    (acMatch ? \`\\n• 防禦等級 (AC) \${item.equipped ? '+' : '-'}\${acMatch[1]}\` : '') +
                    (saveMatch ? \`\\n• 豁免檢定 \${item.equipped ? '+' : '-'}\${saveMatch[1]}\` : '') +
                    \`\\n\\n(註：能力值已由系統【即時動態運算】，但 AC 與豁免目前請於戰鬥時自行加減！)\`);
            }
          },
          removeItem:`;

html = html.replace(toggleRegex, newToggle);

fs.writeFileSync('v2/index.html', html);
