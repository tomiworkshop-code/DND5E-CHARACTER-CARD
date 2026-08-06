const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `                  </div>
                </div>

                <!-- INVENTORY 裝備與背包 -->`;

const replacement = `                  </div>
                  </div>
                </div>

                <!-- INVENTORY 裝備與背包 -->`;

html = html.replace(target, replacement);
fs.writeFileSync('v2/index.html', html);
