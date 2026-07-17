const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetToggle = `          toggleEquip: (item) => {
            item.equipped = !item.equipped;
            if (hasStatEffect(item.name, item.desc)) {
              if (item.equipped) {
                alert('【裝備調整建議】\\n\\n「' + item.name + '」可能包含 AC 或能力值加成。\\n請記得前往【能力值】模塊手動設定您的加值喔！');
              } else {
                alert('【卸下裝備提醒】\\n\\n您卸下了「' + item.name + '」。\\n如果它之前有提供 AC 或能力值加成，請記得前往【能力值】模塊將其扣除！');
              }
            }
          },`;

const newToggle = `          toggleEquip: (item) => {
            item.equipped = !item.equipped;
            
            let text = String(item.name || '') + ' ' + String(item.desc || '');
            const abilityMap = { '力量': 'str', '敏捷': 'dex', '體質': 'con', '智力': 'int', '感知': 'wis', '魅力': 'cha' };
            const changes = [];
            const char = selectedChar.value;
            if (!char.abilityBonus) char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            
            // 處理能力值固定 (例如: 力量值變為19)
            for (const [zh, key] of Object.entries(abilityMap)) {
              const setMatch = text.match(new RegExp(zh + '值變為(\\\\d+)'));
              if (setMatch) {
                const targetScore = parseInt(setMatch[1], 10);
                const baseScore = char.abilities[key] || 10;
                
                if (item.equipped) {
                  if (targetScore > baseScore) {
                    const diff = targetScore - baseScore;
                    char.abilityBonus[key] += diff;
                    item._appliedStats = item._appliedStats || {};
                    item._appliedStats[key] = (item._appliedStats[key] || 0) + diff;
                    changes.push(\`\${zh} 提升至 \${targetScore} (自動加值 +\${diff})\`);
                  } else {
                    changes.push(\`\${zh} (您的基礎值大於等於 \${targetScore}，無效果)\`);
                  }
                } else {
                  if (item._appliedStats && item._appliedStats[key]) {
                    const diff = item._appliedStats[key];
                    char.abilityBonus[key] -= diff;
                    delete item._appliedStats[key];
                    changes.push(\`\${zh} 恢復原狀 (自動扣除 +\${diff} 加值)\`);
                  }
                }
              }
            }

            // 處理 AC (目前系統尚未有獨立 AC 欄位，僅做精準文字提示)
            let acMatch = text.match(/AC\\s*\\+(\\d+)/i) || text.match(/防禦等級.*?\\+(\\d+)/);
            if (acMatch) {
              const val = parseInt(acMatch[1], 10);
              if (item.equipped) changes.push(\`防禦等級 (AC) +\${val}\`);
              else changes.push(\`防禦等級 (AC) -\${val}\`);
            }
            
            // 處理豁免
            let saveMatch = text.match(/豁免.*?\\+(\\d+)/);
            if (saveMatch) {
              const val = parseInt(saveMatch[1], 10);
              if (item.equipped) changes.push(\`豁免檢定 +\${val}\`);
              else changes.push(\`豁免檢定 -\${val}\`);
            }

            if (changes.length > 0) {
              alert(\`【裝備系統提示】\\n\\n您\${item.equipped ? '裝備' : '卸下'}了「\${item.name}」：\\n\\n• \` + changes.join('\\n• ') + (acMatch || saveMatch ? '\\n\\n(註：AC與豁免尚未有獨立總表欄位，請在戰鬥時自行加減！能力值已自動幫您修改完畢。)' : ''));
            } else if (hasStatEffect(item.name, item.desc)) {
              // 關鍵字有中，但 parser 沒抓到明確數字
              alert(\`【裝備系統提示】\\n\\n您\${item.equipped ? '裝備' : '卸下'}了「\${item.name}」。\\n此物品似乎帶有特殊數值加成，但系統無法自動解析，請記得手動調整能力值喔！\`);
            }
          },`;

html = html.replace(targetToggle, newToggle);
fs.writeFileSync('v2/index.html', html);
