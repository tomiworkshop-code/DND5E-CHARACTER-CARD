/* shared/services/dice.js
 * D&D 5E — 本地擲骰純函式模組（PR-Local-3 / 設計文件 §2.4、決策點 D5）。
 * ─────────────────────────────────────────────────────────────────────
 * 設計原則：
 *   - 純函式、框架無關；可注入 rng 以利「可重現」單元測試。
 *   - 不改任何既有 shared；掛全域 window.DND5E_DICE，同時支援 CommonJS(node 測試)。
 *   - 只負責「算骰」，不碰 store / 不改角色數值（落帳/套用 HP 由 v2 app 走既有路徑）。
 *
 * 支援骰式：
 *   "NdM"      例 2d6            （N 省略視為 1，如 "d20"）
 *   "NdM+K"    例 1d20+5
 *   "NdM-K"    例 2d8-1
 *   純常數     例 "5" / "-2"      （0d0+K，供加值計算）
 * 模式（優勢/劣勢，僅對每顆骰成對取捨；D&D 常用於 d20）：
 *   'normal' | 'adv'(取高) | 'dis'(取低)
 */
(function (global) {
  'use strict';

  /* 預設亂數源：[0,1)。測試可用 opts.rng 注入固定序列以重現。 */
  function defaultRng() { return Math.random(); }

  /* 擲一顆 M 面骰 → 1..M 的整數。 */
  function rollDie(sides, rng) {
    var r = (typeof rng === 'function' ? rng : defaultRng)();
    return Math.floor(r * sides) + 1;
  }

  /* 解析骰式字串 → { count, sides, mod, expr }。無法解析則 throw。 */
  function parse(expr) {
    var s = String(expr == null ? '' : expr).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) throw new Error('空的骰式');
    var m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!m) {
      var c = s.match(/^([+-]?\d+)$/);
      if (c) return { count: 0, sides: 0, mod: parseInt(c[1], 10), expr: s };
      throw new Error('無法解析骰式：' + expr);
    }
    var count = m[1] === '' ? 1 : parseInt(m[1], 10);
    var sides = parseInt(m[2], 10);
    var mod = m[3] ? parseInt(m[3], 10) : 0;
    if (count < 0 || count > 100) throw new Error('骰數超出範圍(0-100)：' + count);
    if (sides < 1 || sides > 1000) throw new Error('骰面超出範圍(1-1000)：' + sides);
    return { count: count, sides: sides, mod: mod, expr: s };
  }

  /* 組人類可讀算式字串。 */
  function buildFormula(p, kept, dropped, mode, total) {
    if (p.count === 0) return String(p.mod); // 純常數
    var base = '[' + kept.join(', ') + ']';
    var mstr = p.mod ? (p.mod > 0 ? '+' + p.mod : String(p.mod)) : '';
    var tag = mode === 'adv' ? ' 優勢' : (mode === 'dis' ? ' 劣勢' : '');
    var dstr = dropped.length ? ' (捨:' + dropped.join(',') + ')' : '';
    return p.count + 'd' + p.sides + tag + ' → ' + base + dstr + mstr + ' = ' + total;
  }

  /* 主入口：roll(expr, opts)
   * opts: { rng?:()=>number, mode?:'normal'|'adv'|'dis' }
   * 回傳結構化結果：
   *   { expr, mode, count, sides, modifier, rolls[], kept[], dropped[], sum, total, formula, ts }
   */
  function roll(expr, opts) {
    opts = opts || {};
    var rng = opts.rng || defaultRng;
    var mode = opts.mode || 'normal';
    if (mode !== 'normal' && mode !== 'adv' && mode !== 'dis') mode = 'normal';
    var p = parse(expr);
    var rolls = [], kept = [], dropped = [];

    if ((mode === 'adv' || mode === 'dis') && p.count > 0) {
      /* 優勢/劣勢：每顆骰擲兩顆，取高(adv)/取低(dis)。 */
      for (var i = 0; i < p.count; i++) {
        var a = rollDie(p.sides, rng);
        var b = rollDie(p.sides, rng);
        rolls.push(a, b);
        var hi = Math.max(a, b), lo = Math.min(a, b);
        if (mode === 'adv') { kept.push(hi); dropped.push(lo); }
        else { kept.push(lo); dropped.push(hi); }
      }
    } else {
      for (var j = 0; j < p.count; j++) {
        var v = rollDie(p.sides, rng);
        rolls.push(v); kept.push(v);
      }
    }

    var sum = kept.reduce(function (x, y) { return x + y; }, 0);
    var total = sum + p.mod;
    return {
      expr: p.expr, mode: mode,
      count: p.count, sides: p.sides, modifier: p.mod,
      rolls: rolls, kept: kept, dropped: dropped,
      sum: sum, total: total,
      formula: buildFormula(p, kept, dropped, mode, total),
      ts: Date.now()
    };
  }

  var API = { parse: parse, roll: roll, rollDie: rollDie };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
  global.DND5E_DICE = API;
})(typeof window !== 'undefined' ? window : this);
