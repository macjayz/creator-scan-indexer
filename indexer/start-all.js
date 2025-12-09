// indexer/start-all.js
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting CreatorScan Indexer System...\n');
console.log('=' .repeat(50));
console.log('Starting components:');
console.log('1. Factory Watcher (Zora/Clanker tokens)');
console.log('2. DEX Watcher (Flaunch/Mint Club tokens)');
console.log('3. Monitor (Real-time dashboard)');
console.log('=' .repeat(50) + '\n');

// Start Factory Watcher
const factoryWatcher = spawn('node', ['factory-watcher/index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

factoryWatcher.on('error', (err) => {
  console.error('Failed to start Factory Watcher:', err);
});

// Start DEX Watcher
const dexWatcher = spawn('node', ['dex-watcher/index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

dexWatcher.on('error', (err) => {
  console.error('Failed to start DEX Watcher:', err);
});

// Start Monitor
const monitor = spawn('node', ['monitor.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

monitor.on('error', (err) => {
  console.error('Failed to start Monitor:', err);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping all services...');
  factoryWatcher.kill();
  dexWatcher.kill();
  monitor.kill();
  process.exit(0);
});

console.log('✅ All services started. Press Ctrl+C to stop.\n');