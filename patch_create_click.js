const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetBtn = `<button @click="createNewChar" class="bg-white border border-gray-200 text-gray-700 rounded-xl p-4 text-left shadow-sm hover:bg-gray-50 transition">
            <div class="text-xl mb-1">✍️</div>
            <div class="font-bold text-sm">創建新角色</div>`;

const replaceBtn = `<button @click.prevent="createNewChar" class="bg-white border border-gray-200 text-gray-700 rounded-xl p-4 text-left shadow-sm hover:bg-gray-50 transition">
            <div class="text-xl mb-1">✍️</div>
            <div class="font-bold text-sm">創建新角色</div>`;

html = html.replace(targetBtn, replaceBtn);

const targetAction = `          createNewChar: () => {
            const newChar = {
              id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
              name: '新冒險者',`;

const replaceAction = `          createNewChar: () => {
            console.log("createNewChar clicked");
            const newChar = {
              id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
              name: '新冒險者',`;

html = html.replace(targetAction, replaceAction);
fs.writeFileSync('v2/index.html', html);
