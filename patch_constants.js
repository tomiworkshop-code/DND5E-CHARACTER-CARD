const fs = require('fs');
let v2 = fs.readFileSync('v2/index.html', 'utf8');
const constants = fs.readFileSync('/tmp/constants.js', 'utf8');

// The lines I added earlier:
const oldLines = `    const RACES = [{name:"人類"}, {name:"精靈"}, {name:"矮人"}, {name:"半身人"}, {name:"龍裔"}, {name:"地侏"}, {name:"半精靈"}, {name:"半獸人"}, {name:"提夫林"}, {name:"其他/自訂"}];
    const ALIGNMENTS = ["守序善良","中立善良","混亂善良","守序中立","絕對中立","混亂中立","守序邪惡","中立邪惡","混亂邪惡"];
    const BACKGROUNDS = [{name:"侍僕"}, {name:"罪犯"}, {name:"民間英雄"}, {name:"貴族"}, {name:"賢者"}, {name:"士兵"}, {name:"藝人"}, {name:"騙子"}, {name:"公會工匠"}, {name:"隱士"}, {name:"海員"}, {name:"城市浪人"}, {name:"其他/自訂"}];`;

v2 = v2.replace(oldLines, constants);

fs.writeFileSync('v2/index.html', v2);
