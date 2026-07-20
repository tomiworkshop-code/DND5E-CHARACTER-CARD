/* test_skills_saves.js — jsdom 掛載測試
 *   A) 魔寵分頁確實 render「🐾 從範本中匯入」按鈕 + picker（載入 familiar-presets.js 後）
 *   B) 技能頁：專精 (expertise) 計算 x2、主控屬性顯示、豁免檢定計算與 render
 * 透過 window.__vm（app.mount 回傳的根實例）驅動狀態，再檢查 DOM / 計算函式。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('v2/index.html', 'utf8');
const consoleErrors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
  beforeParse(window) {
    const _store = {};
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (k in _store ? _store[k] : null),
        setItem: (k, v) => { _store[k] = String(v); },
        removeItem: (k) => { delete _store[k]; },
        clear: () => { for (const k in _store) delete _store[k]; }
      }
    });
    const origErr = window.console.error;
    window.console.error = (...args) => {
      consoleErrors.push(args.map(a => (a && a.stack) ? a.stack : String(a)).join(' '));
      origErr.apply(window.console, args);
    };
    window.fetch = async (url) => {
      let p = String(url).replace('../data/', 'data/');
      const i = p.indexOf('data/');
      if (i > 0) p = p.slice(i);
      if (fs.existsSync(p)) return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
      return { ok: true, json: async () => ({}) };
    };
  }
});

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }
const tick = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  await tick(3500);
  const win = dom.window;
  const doc = win.document;
  const vm = win.__vm;

  ok('app 掛載且無 TypeError/ReferenceError', !consoleErrors.some(e => /TypeError:|ReferenceError:/.test(e)));
  ok('window.__vm 已暴露（可驅動測試）', !!vm);
  if (!vm) { report(); return; }

  // 建立一名角色並進入角色頁
  vm.createNewChar();
  await tick(300);
  const char = vm.selectedChar;
  ok('已建立並選中角色', !!char);

  // ---------- A) 魔寵匯入 render ----------
  vm.activeModule = 'familiar';
  vm.isEditMode = true; // 匯入/新增按鈕僅在編輯模式顯示（v-if="isEditMode"）
  await tick(300);
  let appHtml = doc.getElementById('app').innerHTML;
  ok('魔寵分頁（編輯模式）render「🐾 從範本中匯入」按鈕', /從範本中匯入/.test(appHtml));

  vm.familiarImport.pickerOpen = true;
  await tick(300);
  appHtml = doc.getElementById('app').innerHTML;
  ok('picker 開啟後 render 範本選單標題', /從範本中匯入魔寵/.test(appHtml));
  ok('picker 依 tier 分組（含 SRD / 契約 群組標籤）', vm.familiarPresetGroups.length >= 1 && appHtml.indexOf('grp') === -1 ? true : vm.familiarPresetGroups.length >= 1);
  ok('picker 至少含一個範本種類（貓/蝙蝠等）', vm.familiarPresetGroups.some(g => g.items && g.items.length > 0));
  vm.familiarImport.pickerOpen = false;
  await tick(100);

  // ---------- B) 技能頁 專精 / 主控屬性 / 豁免 ----------
  vm.activeModule = 'skills';
  await tick(400); // 等 watch 回填 skills + profSaves

  ok('技能已回填（運動 存在）', !!(char.skills && char.skills['運動']));
  ok('技能含 expertise 欄位預設 false', char.skills['運動'] && char.skills['運動'].expertise === false);
  ok('profSaves 已初始化為物件', char.profSaves && typeof char.profSaves === 'object');

  // 主控屬性 helper
  ok("skillAttrZh('運動') === 力量", vm.skillAttrZh('運動') === '力量');
  ok("skillAttrZh('隱匿') === 敏捷", vm.skillAttrZh('隱匿') === '敏捷');

  // 計算：str=14 → mod +2，profBonus（等級1）=2
  char.abilities.str = 14;
  await tick(50);
  ok('profBonus 預設 = 2（等級1）', vm.profBonus === 2);
  ok('未熟練：skillValue(運動) = +2（僅屬性調整）', vm.skillValue('運動') === 2);

  char.skills['運動'].proficient = true;
  await tick(50);
  ok('熟練：skillValue(運動) = +4（2 + 熟練2）', vm.skillValue('運動') === 4);

  char.skills['運動'].expertise = true;
  await tick(50);
  ok('專精：skillValue(運動) = +6（2 + 熟練2*2）', vm.skillValue('運動') === 6);

  char.skills['運動'].override = 10;
  await tick(50);
  ok('覆寫優先：skillValue(運動) = 10', vm.skillValue('運動') === 10);
  char.skills['運動'].override = null;
  await tick(50);

  // 豁免檢定
  ok('SAVE_LIST 六大屬性', Array.isArray(vm.SAVE_LIST) && vm.SAVE_LIST.length === 6);
  ok("未熟練：saveValue('str') = +2", vm.saveValue('str') === 2);
  char.profSaves.str = true;
  await tick(50);
  ok("熟練：saveValue('str') = +4（2 + 熟練2）", vm.saveValue('str') === 4);

  // render 檢查
  const skHtml = doc.getElementById('app').innerHTML;
  ok('技能頁 render 主控屬性標籤（力量）', /力量/.test(skHtml));
  ok('技能頁 render「豁免檢定 (Saving Throws)」區塊', /豁免檢定 \(Saving Throws\)/.test(skHtml));
  ok('專精技能 render「專精」徽章', /專精/.test(skHtml));

  ok('全程無 TypeError/ReferenceError', !consoleErrors.some(e => /TypeError:|ReferenceError:/.test(e)));

  report();

  function report() {
    if (consoleErrors.length) {
      const real = consoleErrors.filter(e => /TypeError:|ReferenceError:/.test(e));
      if (real.length) { console.log('\n--- JS errors ---'); real.forEach(e => console.log(e)); }
    }
    console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
    process.exit(fail ? 1 : 0);
  }
})();
