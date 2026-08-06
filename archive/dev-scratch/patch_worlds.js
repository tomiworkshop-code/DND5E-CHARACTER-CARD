const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. Add worlds data to setup
const stateToInject = `const worlds = ref([
          {
            id: '__solo__',
            name: '單人漫遊',
            type: 'local',
            dm: '自己 (Local)',
            time: '未知',
            location: '未定',
            quest: '自由探索',
            desc: '本地沙盒世界。在此處的所有數值變更會直接保存，無需等待 DM 批准。'
          },
          {
            id: 'w-demo123',
            name: '阿斯卡利亞的隕落',
            type: 'dm',
            dm: '敘事者 (Narrator)',
            time: '第三紀元 1442 年，初秋',
            location: '迷霧森林邊緣 - 斷劍旅店',
            quest: '尋找失蹤的商隊，並調查森林深處的魔法異變。',
            desc: '已連接敘事者之書的多人戰役。重大數值與物品變更需要 DM 審核。'
          }
        ]);
        const selectedWorldObj = computed(() => worlds.value.find(w => w.id === selectedWorldKey.value) || worlds.value[0]);
`;

html = html.replace("const chars = ref([]);", "const chars = ref([]);\n        " + stateToInject);

// 2. Add to return block
const returnBlockInject = `
          worlds,
          selectedWorldObj,
          chars,`;
html = html.replace("          chars,\n          stats,", returnBlockInject + "\n          stats,");

// 3. Replace Worlds Placeholder HTML
const targetHTML = `<template v-if="currentView === 'worlds'">
        <div class="module-card text-center py-10 text-gray-500">
          這是未來的「冒險世界紀錄」模塊
        </div>
      </template>`;

const replacementHTML = `<template v-if="currentView === 'worlds'">
        <div class="space-y-4">
          <!-- 世界切換與列表 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="w in worlds" :key="w.id" 
                 @click="selectedWorldKey = w.id"
                 :class="['module-card cursor-pointer transition flex items-start gap-4', selectedWorldKey === w.id ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'hover:bg-gray-50']">
              <div class="text-4xl mt-1">
                {{ w.type === 'dm' ? '🌌' : '🧳' }}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-bold text-gray-800 text-lg">{{ w.name }}</h3>
                  <span v-if="w.type === 'local'" class="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">本地單人</span>
                  <span v-else class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.078 2.027-.231 3.021M15.328 14.304c.52.87 1.01 1.776 1.467 2.715m-4.577-4.577l.035.012M12 21a9.003 9.003 0 008.354-5.646"></path></svg>
                    DM 連線
                  </span>
                </div>
                <div class="text-sm text-gray-500 mb-1">主持: {{ w.dm }}</div>
                <div class="text-xs text-gray-400 line-clamp-1">{{ w.desc }}</div>
              </div>
              <div v-if="selectedWorldKey === w.id" class="text-blue-500">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
            </div>
          </div>

          <!-- 當前世界詳細資訊 (第一階段：世界概況) -->
          <div class="module-card mt-6" v-if="selectedWorldObj">
            <div class="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span>{{ selectedWorldObj.name }}</span>
                <span class="text-sm font-normal px-2 py-1 bg-gray-100 text-gray-600 rounded">概況</span>
              </h2>
              <button class="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition">
                進入此世界
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div class="text-xs text-gray-400 mb-1 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> 當前位置</div>
                  <div class="font-bold text-gray-800">{{ selectedWorldObj.location }}</div>
                </div>
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div class="text-xs text-gray-400 mb-1 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 遊戲時間</div>
                  <div class="font-bold text-gray-800">{{ selectedWorldObj.time }}</div>
                </div>
              </div>
              <div class="space-y-4">
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 h-full">
                  <div class="text-xs text-gray-400 mb-1 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg> 當前主要任務</div>
                  <div class="text-gray-700 leading-relaxed">{{ selectedWorldObj.quest }}</div>
                </div>
              </div>
            </div>

            <!-- 未來階段預告 -->
            <div class="mt-8 border-t border-gray-100 pt-6">
              <h3 class="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">世界紀錄 (即將推出)</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="border border-dashed border-gray-200 rounded-lg p-3 text-center text-gray-400 text-sm">
                  <div class="text-xl mb-1">📜</div>
                  戰報與大事紀
                </div>
                <div class="border border-dashed border-gray-200 rounded-lg p-3 text-center text-gray-400 text-sm">
                  <div class="text-xl mb-1">📚</div>
                  NPC與情報網
                </div>
                <div class="border border-dashed border-gray-200 rounded-lg p-3 text-center text-gray-400 text-sm">
                  <div class="text-xl mb-1">🎒</div>
                  隊伍共用物資
                </div>
                <div class="border border-dashed border-gray-200 rounded-lg p-3 text-center text-gray-400 text-sm opacity-50">
                  <div class="text-xl mb-1">⚖️</div>
                  DM 房規與審核
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>`;

html = html.replace(targetHTML, replacementHTML);
fs.writeFileSync('v2/index.html', html);
