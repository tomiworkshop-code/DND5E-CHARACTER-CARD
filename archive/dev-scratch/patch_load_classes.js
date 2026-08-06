const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetSetup = `        Vue.onMounted(async () => {
          try {
            const res = await fetch('../data/core-rules.json');
            if(res.ok) {
              const data = await res.json();
              Object.assign(coreRules, data);
            }
          } catch(e) { console.error('Failed to load core-rules.json', e); }
        });`;

const newSetup = `        Vue.onMounted(async () => {
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
                  const fullDef = classData.classes.find(c => c.name_en === baseDef.name_en);
                  if (fullDef) {
                    baseDef.features = fullDef.features || [];
                    (baseDef.subclasses || []).forEach(baseSc => {
                      const fullSc = (fullDef.subclasses || []).find(sc => sc.name_en === baseSc.name_en);
                      if (fullSc) {
                        baseSc.features = fullSc.features || [];
                      }
                    });
                  }
                });
              }
            }
          } catch(e) { console.error('Failed to load rules', e); }
        });`;

html = html.replace(targetSetup, newSetup);
fs.writeFileSync('v2/index.html', html);
