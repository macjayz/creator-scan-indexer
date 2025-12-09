// decode-zora-event.js - Properly decode Zora event
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function decodeZoraEvent() {
  console.log('Decoding Zora event properly...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  
  // Get the specific transaction you found
  const txHash = '0x07c8b7c8ccf40ebca02a7ed8154e4eea63556a2af3a52079d20a1cc81a9a9842';
  const tx = await provider.getTransactionReceipt(txHash);
  
  console.log('Transaction block:', tx.blockNumber);
  
  // Find the CoinCreatedV4 log
  const eventTopic = '0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81';
  const zoraLog = tx.logs.find(log => log.topics[0] === eventTopic);
  
  if (!zoraLog) {
    console.log('No Zora event log found');
    return;
  }
  
  console.log('Found Zora event log');
  console.log('Data:', zoraLog.data);
  console.log('Data length:', zoraLog.data.length);
  
  // Try to manually decode based on ABI structure
  const data = zoraLog.data.substring(2); // Remove 0x
  
  // Offsets for dynamic types (uri, name, symbol are strings)
  // Each dynamic type has a 32-byte offset pointer
  
  // First 32 bytes: currency (address at bytes 12-32)
  const currency = '0x' + data.substring(24, 64);
  console.log('\nCurrency:', currency);
  
  // Bytes 32-63: offset to uri (pointer)
  const uriOffset = parseInt(data.substring(64, 128), 16) * 2;
  console.log('URI offset (bytes):', uriOffset);
  
  // Bytes 64-95: offset to name
  const nameOffset = parseInt(data.substring(128, 192), 16) * 2;
  console.log('Name offset:', nameOffset);
  
  // Bytes 96-127: offset to symbol  
  const symbolOffset = parseInt(data.substring(192, 256), 16) * 2;
  console.log('Symbol offset:', symbolOffset);
  
  // Bytes 128-159: offset to coin (token address)
  const coinOffset = parseInt(data.substring(256, 320), 16) * 2;
  console.log('Coin offset:', coinOffset);
  
  // The coin address should be at the coinOffset position
  // At that position, we should have 32 bytes: 12 bytes padding + 20 byte address
  const coinDataStart = coinOffset;
  const coinAddress = '0x' + data.substring(coinDataStart + 24, coinDataStart + 64);
  console.log('\nToken address (coin):', coinAddress);
  
  // Also try to extract name and symbol
  if (nameOffset > 0) {
    const nameLength = parseInt(data.substring(nameOffset, nameOffset + 64), 16) * 2;
    const nameHex = data.substring(nameOffset + 64, nameOffset + 64 + nameLength);
    const name = Buffer.from(nameHex, 'hex').toString();
    console.log('Name:', name);
  }
  
  if (symbolOffset > 0) {
    const symbolLength = parseInt(data.substring(symbolOffset, symbolOffset + 64), 16) * 2;
    const symbolHex = data.substring(symbolOffset + 64, symbolOffset + 64 + symbolLength);
    const symbol = Buffer.from(symbolHex, 'hex').toString();
    console.log('Symbol:', symbol);
  }
}

decodeZoraEvent().catch(console.error);
