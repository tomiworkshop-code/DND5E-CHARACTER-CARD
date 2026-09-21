/* archive/dev-scratch/test_class_resources.js
 * 步驟 1 單元測試：職業資源導出引擎測試
 */
const { deriveClassResources } = require('../../shared/class-resource-rules');
const assert = require('assert');

console.log('=== 🧪 開始執行步驟 1 職業資源導出引擎測試 ===\n');

// 1. 測試野蠻人 1級 / 5級 / 20級
console.log('1️⃣ 測試野蠻人 (Barbarian)...');
const barb1 = deriveClassResources({
  classes: [{ name_en: 'Barbarian', level: 1 }]
});
assert.strictEqual(barb1.length, 2);
assert.strictEqual(barb1[0].current, 2);
assert.strictEqual(barb1[0].reset, 'long');
assert.strictEqual(barb1[1].diceValue, '+2');

const barb20 = deriveClassResources({
  classes: [{ name_en: 'Barbarian', level: 20 }]
});
assert.strictEqual(barb20[0].current, 99); // 無限
assert.strictEqual(barb20[1].diceValue, '+4');
console.log('   ✅ 野蠻人 1級/20級 測試通過');

// 2. 測試武僧 (Monk)
console.log('2️⃣ 測試武僧 (Monk)...');
const monk5 = deriveClassResources({
  classes: [{ name_en: 'Monk', level: 5 }]
});
assert.strictEqual(monk5[0].current, 5);
assert.strictEqual(monk5[0].reset, 'short');
console.log('   ✅ 武僧 5級 氣點 (Ki=5, short reset) 測試通過');

// 3. 測試聖騎士 (Paladin)
console.log('3️⃣ 測試聖騎士 (Paladin)...');
const paladin3 = deriveClassResources({
  classes: [{ name_en: 'Paladin', level: 3 }]
});
assert.strictEqual(paladin3.length, 2);
assert.strictEqual(paladin3[0].max, 15); // Lay on Hands = 3*5
assert.strictEqual(paladin3[1].max, 1);  // Channel Divinity
console.log('   ✅ 聖騎士 3級 (聖療池=15, 神聖干預=1) 測試通過');

// 4. 測試戰士(戰術大師) (Fighter Battle Master)
console.log('4️⃣ 測試戰士 戰術大師 (Battle Master)...');
const fighter3 = deriveClassResources({
  classes: [{
    name_en: 'Fighter',
    level: 3,
    subclass: '戰術大師',
    subclass_en: 'Battle Master'
  }]
});
assert.strictEqual(fighter3.length, 3); // 二次風, 行動湧浪, 優勢骰
assert.strictEqual(fighter3[0].label, '二次風 (Second Wind)');
assert.strictEqual(fighter3[1].label, '行動湧浪 (Action Surge)');
assert.strictEqual(fighter3[2].max, 4);
assert.strictEqual(fighter3[2].diceValue, 'd8');
console.log('   ✅ 戰士戰術大師 3級 (二次風/行動湧浪/優勢骰4d8) 測試通過');

// 5. 測試多職業 / 兼職 (Multiclass: Fighter Lv3 / Monk Lv2)
console.log('5️⃣ 測試多職業 (Multiclass: 戰士 Lv3 + 武僧 Lv2)...');
const multiChar = {
  abilities: { cha: 14, wis: 12 },
  classes: [
    { name_en: 'Fighter', level: 3, subclass_en: 'Battle Master' },
    { name_en: 'Monk', level: 2 }
  ]
};
const multiRes = deriveClassResources(multiChar);
assert.strictEqual(multiRes.length, 4); // Fighter(3) + Monk(1)
const monkRes = multiRes.find(r => r.classKey === 'monk');
assert.ok(monkRes);
assert.strictEqual(monkRes.current, 2);
console.log('   ✅ 多職業 (戰士/武僧) 資源同時正確導出無遺漏');

// 6. 測試吟遊詩人 靈感短/長休切換 (Bardic Inspiration)
console.log('6️⃣ 測試吟遊詩人 靈感 (Bardic Inspiration)...');
const bard1 = deriveClassResources({
  abilities: { cha: 16 }, // chaMod = 3
  classes: [{ name_en: 'Bard', level: 1 }]
});
assert.strictEqual(bard1[0].reset, 'long');
assert.strictEqual(bard1[0].max, 3);
assert.strictEqual(bard1[0].diceValue, 'd6');

const bard5 = deriveClassResources({
  abilities: { cha: 16 },
  classes: [{ name_en: 'Bard', level: 5 }]
});
assert.strictEqual(bard5[0].reset, 'short'); // 5級起短休恢復
assert.strictEqual(bard5[0].diceValue, 'd8');
console.log('   ✅ 吟遊詩人 1級(long, d6) 與 5級(short, d8) 測試通過');

console.log('\n🎉 所有單元測試全數通過！(6/6)\n');
