// Simple script to start both watchers
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Creator Coin Indexer...\n');

// Start factory watcher
console.log('1. Starting Factory Watcher (Zora/Clanker)...');
const factoryWatcher = spawn('node', ['factory-watcher/index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Wait a bit, then start DEX watcher
setTimeout(() => {
  console.log('\n2. Starting DEX Watcher (Uniswap V3)...');
  const dexWatcher = spawn('node', ['dex-watcher/index.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  // Handle termination
  const cleanup = () => {
    console.log('\n🛑 Shutting down both watchers...');
    factoryWatcher.kill();
    dexWatcher.kill();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
}, 3000);

// Handle errors
factoryWatcher.on('error', (err) => {
  console.error('Factory watcher error:', err);
});
