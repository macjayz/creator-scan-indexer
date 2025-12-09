// Quick fix for the database enum error
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the detectionMethod line
content = content.replace(
  /detectionMethod: `zora_factory_\${result\.method}`,/,
  "detectionMethod: 'zora_factory',  // Use standard value"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed database enum error!');
