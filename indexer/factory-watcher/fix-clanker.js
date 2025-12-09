// Fix for Clanker detection
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// First, let's update the Clanker ABI in the config if needed
// But actually, the issue might be in the handleEvent function

// Find the handleEvent function for Clanker
const clankerHandlerStart = '      } else if (platform === \'clanker\') {';
const clankerHandlerEnd = '      }';

const startIndex = content.indexOf(clankerHandlerStart);
let endIndex = content.indexOf(clankerHandlerEnd, startIndex + clankerHandlerStart.length);

// Find the actual end of this block
let braceCount = 0;
for (let i = startIndex; i < content.length; i++) {
  if (content[i] === '{') braceCount++;
  if (content[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  
  // New Clanker handler with better parsing
  const newClankerHandler = `      } else if (platform === 'clanker') {
        console.log(\`   🔍 Processing Clanker event...\`);
        
        try {
          // The Clanker ABI has 14 parameters, let's extract them properly
          // event TokenCreated(address indexed tokenAddress, address indexed creatorAdmin, address indexed interfaceAdmin, 
          //                    address creatorRewardRecipient, address interfaceRewardRecipient, uint256 positionId, 
          //                    string name, string symbol, int24 startingTickIfToken0IsNewToken, string metadata, 
          //                    uint256 amountTokensBought, uint256 vaultDuration, uint8 vaultPercentage, address msgSender)
          
          // Extract all args
          const args = event.args;
          
          if (args.length >= 14) {
            // Based on the ABI, parameters are:
            // 0: tokenAddress
            // 1: creatorAdmin
            // 2: interfaceAdmin  
            // 3: creatorRewardRecipient
            // 4: interfaceRewardRecipient
            // 5: positionId
            // 6: name
            // 7: symbol
            // 8: startingTickIfToken0IsNewToken
            // 9: metadata
            // 10: amountTokensBought
            // 11: vaultDuration
            // 12: vaultPercentage
            // 13: msgSender
            
            const tokenAddress = args[0];
            const creatorAddress = args[1]; // creatorAdmin is the creator
            const name = args[6];
            const symbol = args[7];
            
            console.log(\`   🆕 Clanker: \${symbol} (\${name}) by \${creatorAddress.substring(0, 10)}...\`);
            
            await this.processToken({
              tokenAddress,
              name,
              symbol,
              creatorAddress,
              platform,
              factory,
              event
            });
          } else {
            console.log(\`   ⚠️ Clanker event has only \${args.length} args, expected 14\`);
            console.log(\`   Args: \${JSON.stringify(args)}\`);
            
            // Try fallback: first arg is token, second is creator
            if (args.length >= 2) {
              const tokenAddress = args[0];
              const creatorAddress = args[1];
              const name = args[6] || 'Clanker Token';
              const symbol = args[7] || 'CLANKER';
              
              console.log(\`   🆕 Clanker (fallback): \${symbol} at \${tokenAddress.substring(0, 10)}...\`);
              
              await this.processToken({
                tokenAddress,
                name,
                symbol,
                creatorAddress,
                platform,
                factory,
                event
              });
            }
          }
        } catch (error) {
          console.error(\`❌ Error handling Clanker event: \${error.message}\`);
        }`;
  
  content = before + newClankerHandler + after;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated Clanker handler!');
} else {
  console.log('❌ Could not find Clanker handler to replace');
}
