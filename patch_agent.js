import fs from 'fs';
const file = '/home/sahi/Desktop/adv/sc/server/services/agent.service.js';
let content = fs.readFileSync(file, 'utf8');

// Update getSession
content = content.replace(
    /history: \[\],\s*\/\/ Stores \{ role: 'user' \| 'model', content: '\.\.\.' \}\s*\}\);/,
    `history: [], // Stores { role: 'user' | 'model', content: '...' }\n            diagnostic_data: null,\n            question_count: 0\n        });`
);

fs.writeFileSync(file, content);
