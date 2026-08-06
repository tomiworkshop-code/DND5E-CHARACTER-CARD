const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('v2/index.html', 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
  beforeParse(window) {
    const _store = {};
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (k) => _store[k] || null, setItem: (k, v) => _store[k] = String(v), removeItem: (k) => delete _store[k], clear: () => Object.keys(_store).forEach(k => delete _store[k])
    }});
    window.console.error = () => {};
    window.fetch = async (url) => {
      let file = '[]';
      if (url.includes('core-rules.json')) file = fs.readFileSync('data/core-rules.json', 'utf8');
      else if (url.includes('classes.json')) file = fs.readFileSync('data/classes.json', 'utf8');
      else if (url.includes('items.json')) file = fs.readFileSync('data/items.json', 'utf8');
      else if (url.includes('spells.json')) file = fs.readFileSync('data/spells.json', 'utf8');
      else if (url.includes('sources.json')) file = fs.readFileSync('data/sources.json', 'utf8');
      else if (url.includes('races.json')) file = fs.readFileSync('data/races.json', 'utf8');
      return { ok: true, json: async () => JSON.parse(file) };
    };
  }
});

let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

setTimeout(() => {
  const w = dom.window, doc = w.document, vm = w.__vm;
  
  const ch = w.DND5E_CHAR.defaultChar();
  ch.name = 'Test Char';
  ch.familiars = [];
  vm.chars = [ch];
  vm.selectedCharId = ch.id;
  vm.currentView = 'characters';

  vm.$nextTick(() => setTimeout(() => {
    vm.activeModule = 'familiar';
    vm.isEditMode = true;
    
    vm.$nextTick(() => setTimeout(() => {
      
      // 點擊 "＋ 新增魔寵" 按鈕
      const btns = Array.from(doc.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('新增魔寵'));
      if(addBtn) addBtn.click();
      else console.log('找不到 新增魔寵 按鈕');
      
      vm.$nextTick(() => setTimeout(() => {
        let h = doc.getElementById('app').innerHTML;
        ok('新增魔寵後卡片會 render (找到 刪除此魔寵)', h.includes('刪除此魔寵'));
        
        const beforeLen = ch.familiars.length;
        const FP = w.DND5E_FAMILIAR_PRESETS;
        const srd = FP && FP.PRESETS.find(p => p.tier === 'srd');
        
        vm.askImportFamiliarPreset({ allowed: true, preset: srd });
        vm.confirmImportFamiliarPreset();
        
        vm.$nextTick(() => setTimeout(() => {
          ok('匯入後 familiars 長度 +1（append 不覆蓋）', ch.familiars.length === beforeLen + 1);
          
          console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
          process.exit(fail ? 1 : 0);
        }, 50));
      }, 50));
    }, 50));
  }, 100));
}, 2500);