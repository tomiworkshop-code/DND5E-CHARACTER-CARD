const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `        </nav>
      </div>`;

const replacement = `        </nav>
        <div class="p-4 text-center text-xs text-gray-400 border-t border-gray-100">
          v2.0.0 (Build 0716.2)
        </div>
      </div>`;

html = html.replace(target, replacement);
fs.writeFileSync('v2/index.html', html);
