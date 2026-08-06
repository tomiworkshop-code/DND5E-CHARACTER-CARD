/* test_dmv2_step4_send.js
 * Step 4.4 對接發送 + 指令執行（jsdom Vue + 真實 shared/room.js + mock db）：
 *  - broadcast → rooms/{code}/broadcast push {from:'dm', text}
 *  - command(damage/heal/xp/gold) → 一併廣播敘事 + rooms/{code}/commands/{pid} push {type,amount,note}
 *  - command(item) → give-item payload {type:'give-item', itemName, qty}
 *  - command 對象非 roster → 只廣播、略過指令 + 警告
 *  - inbox → rooms/{code}/inbox/{pid} push
 *  - applyAndSend 守衛：缺對象/缺變數/未開房 → 阻擋不送
 *  - buildCommandPayload 單元
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOM = require('./shared/room.js').DND5E_ROOM;
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* mock db：捕捉 ref(path).push(val) */
function makeMockDb() {
  const pushes = [];
  return {
    pushes: pushes,
    ref: function (p) {
      return {
        push: function (v) { pushes.push({ path: p, val: JSON.parse(JSON.stringify(v)) }); return Promise.resolve({ key: 'k' + pushes.length }); },
        set: function () { return Promise.resolve(); },
        get: function () { return Promise.resolve({ exists: function () { return false; }, val: function () { return null; } }); }
      };
    }
  };
}
function pushesTo(db, sub) { return db.pushes.filter(function (x) { return x.path.indexOf(sub) >= 0; }); }

function boot(sharedStore) {
  return new Promise((resolve, reject) => {
    const jsErrors = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', resources: 'usable',
      url: 'file://' + __dirname + '/worldbuilder-v2/index.html',
      beforeParse(window) {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: {
          getItem: (k) => (k in sharedStore ? sharedStore[k] : null),
          setItem: (k, v) => { sharedStore[k] = String(v); },
          removeItem: (k) => { delete sharedStore[k]; },
          clear: () => Object.keys(sharedStore).forEach((k) => delete sharedStore[k])
        }});
        window.addEventListener('error', (e) => { jsErrors.push(String(e.message || e.error)); });
        window.console.error = function () { jsErrors.push(Array.from(arguments).map(String).join(' ')); };
      }
    });
    const t0 = Date.now();
    (function wait() {
      if (dom.window.__vm) return resolve({ dom, vm: dom.window.__vm, jsErrors });
      if (Date.now() - t0 > 6000) return reject(new Error('vm 未就緒；errors: ' + jsErrors.join(' | ')));
      setTimeout(wait, 50);
    })();
  });
}
function tick(vm) { return new Promise((r) => vm.$nextTick(() => setTimeout(r, 20))); }

async function stage(vm, tplSpec, values, opts) {
  const id = vm.upsertTemplate(tplSpec); await tick(vm);
  vm.openApplyTemplate(vm.templates.find((t) => t.id === id)); await tick(vm);
  Object.keys(values || {}).forEach((k) => vm.setApplyValue(k, values[k]));
  if (opts && opts.inboxPid) vm.applyState.inboxPid = opts.inboxPid;
  await tick(vm);
  return vm.confirmApply();
}

(async () => {
  const store = {};
  const { vm, jsErrors } = await boot(store);
  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  const CODE = 'ROOM4';
  vm.rosterMap = {
    p1: { name: '亞拉岡', level: 5, hp: 30, characterId: 'c-ara' },
    p2: { name: '甘道夫', level: 9, hp: 22, characterId: 'c-gan' }
  };
  await tick(vm);

  /* buildCommandPayload 單元 */
  ok('buildCommandPayload damage', (function () { var p = vm.buildCommandPayload({ text: 'x', command: { type: 'damage', amount: '7' } }); return p.type === 'damage' && p.amount === 7 && p.note === 'x'; })());
  ok('buildCommandPayload item→give-item', (function () { var p = vm.buildCommandPayload({ text: '寶箱', command: { type: 'item', amount: '治療藥水' } }); return p.type === 'give-item' && p.itemName === '治療藥水' && p.qty === 1; })());

  /* 1) broadcast */
  {
    const db = makeMockDb();
    const s = await stage(vm, { name: '旁白', kind: 'broadcast', text: '洞窟深處傳來低吼。' }, {});
    const r = await vm.sendStaged(s, { db: db, code: CODE, room: ROOM });
    ok('broadcast 發送成功', r && r.message === true && r.command === false);
    const bc = pushesTo(db, '/broadcast');
    ok('broadcast 落 rooms/ROOM4/broadcast', bc.length === 1 && bc[0].path === 'rooms/ROOM4/broadcast');
    ok('broadcast payload from=dm/text', bc[0].val.from === 'dm' && bc[0].val.text === '洞窟深處傳來低吼。');
    ok('broadcast 無 command push', pushesTo(db, '/commands/').length === 0);
    ok('發送後清空 stagedApply', vm.stagedApply === null);
  }

  /* 2) command damage → 廣播敘事 + commands/{pid} */
  {
    const db = makeMockDb();
    const s = await stage(vm, { name: '被咬', kind: 'command', text: '{playerName} 被咬，受 {damage} 傷！',
      command: { type: 'damage', amountVar: 'damage', targetVar: 'playerName' } },
      { playerName: '亞拉岡', damage: '7' });
    const r = await vm.sendStaged(s, { db: db, code: CODE, room: ROOM });
    ok('command 發送成功(message+command)', r && r.message === true && r.command === true);
    ok('command 一併廣播敘事', pushesTo(db, '/broadcast').length === 1);
    const cmd = pushesTo(db, '/commands/');
    ok('command 落 commands/p1（正確 pid）', cmd.length === 1 && cmd[0].path === 'rooms/ROOM4/commands/p1');
    ok('command payload type/amount/note', cmd[0].val.type === 'damage' && cmd[0].val.amount === 7 && /受 7 傷/.test(cmd[0].val.note));
    ok('result.target=對象名', r.target === '亞拉岡');
  }

  /* 3) command item → give-item */
  {
    const db = makeMockDb();
    const s = await stage(vm, { name: '寶箱', kind: 'command', text: '{who} 打開寶箱，獲得 {loot}！',
      command: { type: 'item', amountVar: 'loot', targetVar: 'who' } },
      { who: '甘道夫', loot: '魔杖' });
    const r = await vm.sendStaged(s, { db: db, code: CODE, room: ROOM });
    const cmd = pushesTo(db, '/commands/');
    ok('item→give-item 落 commands/p2', cmd.length === 1 && cmd[0].path === 'rooms/ROOM4/commands/p2');
    ok('give-item payload', cmd[0].val.type === 'give-item' && cmd[0].val.itemName === '魔杖' && cmd[0].val.qty === 1);
  }

  /* 4) command 對象非 roster → 只廣播、略過指令 */
  {
    const db = makeMockDb();
    const s = await stage(vm, { name: '亂咬', kind: 'command', text: '{who} 被咬，受 {d} 傷',
      command: { type: 'damage', amountVar: 'd', targetVar: 'who' } },
      { who: '路人甲', d: '3' });   /* 路人甲 不在 roster */
    const r = await vm.sendStaged(s, { db: db, code: CODE, room: ROOM });
    ok('非 roster：仍廣播訊息', r && r.message === true);
    ok('非 roster：略過指令', r.command === false && pushesTo(db, '/commands/').length === 0);
    ok('非 roster：帶警告', /非連線玩家/.test(vm.sendState.error));
  }

  /* 5) inbox → inbox/{pid} */
  {
    const db = makeMockDb();
    const s = await stage(vm, { name: '密語', kind: 'inbox', text: '{who}，你聽見一個聲音…' },
      { who: '亞拉岡' }, { inboxPid: 'p1' });
    const r = await vm.sendStaged(s, { db: db, code: CODE, room: ROOM });
    ok('inbox 發送成功', r && r.message === true);
    const ib = pushesTo(db, '/inbox/');
    ok('inbox 落 inbox/p1', ib.length === 1 && ib[0].path === 'rooms/ROOM4/inbox/p1');
    ok('inbox 未廣播全體', pushesTo(db, '/broadcast').length === 0);
  }

  /* 6) applyAndSend 守衛 */
  {
    /* 未開房（模組 fb=null）→ 阻擋 */
    vm.upsertTemplate({ name: 'g1', kind: 'broadcast', text: 'hi' }); await tick(vm);
    vm.openApplyTemplate(vm.templates.find((t) => t.name === 'g1')); await tick(vm);
    const r0 = await vm.applyAndSend();
    ok('未開房 → 阻擋', r0 === false && /尚未開房/.test(vm.sendState.error));

    /* command 缺對象 → 阻擋（不進入發送）*/
    vm.upsertTemplate({ name: 'g2', kind: 'command', text: '{who} 受 {d}',
      command: { type: 'damage', amountVar: 'd', targetVar: 'who' } }); await tick(vm);
    vm.openApplyTemplate(vm.templates.find((t) => t.name === 'g2')); await tick(vm);
    vm.setApplyValue('d', '5'); await tick(vm);   /* who 未填 */
    const r1 = await vm.applyAndSend();
    ok('command 缺對象 → 阻擋', r1 === false && (/指定對象/.test(vm.sendState.error) || /未填/.test(vm.sendState.error)));

    /* 缺變數 → 阻擋 */
    vm.openApplyTemplate(vm.templates.find((t) => t.name === 'g1')); await tick(vm);
    /* g1 無變數；改測有變數者 */
    vm.upsertTemplate({ name: 'g3', kind: 'broadcast', text: '{a} 出現' }); await tick(vm);
    vm.openApplyTemplate(vm.templates.find((t) => t.name === 'g3')); await tick(vm);
    const r2 = await vm.applyAndSend();
    ok('缺變數 → 阻擋', r2 === false && /未填變數/.test(vm.sendState.error));
  }

  /* 7) sendStaged 無房號(未開房) → 阻擋（不觸網）*/
  {
    /* roomId 從未開房為空字串；空 deps → code='' → 守衛擋下，不會真的送 */
    const r = await vm.sendStaged({ kind: 'broadcast', text: 'x' }, {});
    ok('未開房(空房號) → 阻擋', r === false && /尚未開房/.test(vm.sendState.error));
  }

  /* 資料隔離 */
  ok('未污染玩家版 key', !('dnd_templates_v2' in store));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('測試異常', e); process.exit(1); });
