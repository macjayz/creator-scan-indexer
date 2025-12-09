// Fix for tryApproach2 to extract real names/symbols
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the tryApproach2 function
const newApproach2 = `  // Approach 2: Search for addresses AND extract names/symbols
  tryApproach2(data, creatorAddress, log) {
    try {
      // First, try to extract name and symbol from offsets (like decode-zora-event.js)
      let name = 'Unnamed Token';
      let symbol = 'No symbol';
      
      // Parse offsets from fixed data portion
      const nameOffset = parseInt(data.substring(128, 192), 16);
      const symbolOffset = parseInt(data.substring(192, 256), 16);
      
      // Extract name
      if (nameOffset > 0) {
        const namePos = nameOffset * 2;
        if (namePos + 64 <= data.length) {
          const nameLength = parseInt(data.substring(namePos, namePos + 64), 16);
          if (nameLength > 0 && namePos + 64 + (nameLength * 2) <= data.length) {
            const nameHex = data.substring(namePos + 64, namePos + 64 + (nameLength * 2));
            name = Buffer.from(nameHex, 'hex').toString('utf-8').replace(/[^\\x20-\\x7E]/g, '').trim();
          }
        }
      }
      
      // Extract symbol
      if (symbolOffset > 0) {
        const symbolPos = symbolOffset * 2;
        if (symbolPos + 64 <= data.length) {
          const symbolLength = parseInt(data.substring(symbolPos, symbolPos + 64), 16);
          if (symbolLength > 0 && symbolPos + 64 + (symbolLength * 2) <= data.length) {
            const symbolHex = data.substring(symbolPos + 64, symbolPos + 64 + (symbolLength * 2));
            symbol = Buffer.from(symbolHex, 'hex').toString('utf-8').replace(/[^\\x20-\\x7E]/g, '').trim();
          }
        }
      }
      
      // Clean up
      name = name.substring(0, 200) || 'Unnamed Token';
      symbol = symbol.substring(0, 20) || 'No symbol';
      
      console.log(\`   📝 Extracted name/symbol: "\${name}" (\${symbol})\`);
      
      // Now search for token address (same as before)
      const addresses = [];
      
      for (let i = 320; i <= data.length - 64; i += 64) {
        const chunk = data.substring(i, i + 64);
        if (chunk.startsWith('000000000000000000000000')) {
          const addr = '0x' + chunk.substring(24);
          if (ethers.isAddress(addr) && addr !== ethers.ZeroAddress) {
            addresses.push({
              address: addr,
              position: i
            });
          }
        }
      }
      
      if (addresses.length === 0) {
        return { success: false, error: 'No addresses found in data' };
      }
      
      // Try to pick the most likely token address
      const likelyAddresses = addresses.filter(addr => 
        addr.address.toLowerCase() !== creatorAddress.toLowerCase()
      );
      
      if (likelyAddresses.length === 0) {
        return { success: false, error: 'Only found creator address in data' };
      }
      
      // Take the first likely address as the token address
      const tokenAddress = likelyAddresses[0].address;
      
      return {
        success: true,
        tokenAddress,
        name,
        symbol,
        method: 'approach2'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }`;

// Replace the function
const startMarker = '  tryApproach2(data, creatorAddress, log) {';
const endMarker = '  }';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf('  tryApproach3(data', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  content = before + newApproach2 + after;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated tryApproach2 function!');
} else {
  console.log('❌ Could not find function to replace');
}
