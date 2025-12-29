// test-unknown-token.js
import { ethers } from 'ethers';

const tokenAddress = '0x057bf626d52495faaa0c90ed1f669f4b006602f9'; // First token from your list
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

async function testToken() {
  try {
    console.log(`Testing token: ${tokenAddress}`);
    
    // First check if it's even a contract
    const code = await provider.getCode(tokenAddress);
    console.log(`Contract code exists: ${code !== '0x'}`);
    console.log(`Code length: ${code.length} chars`);
    
    if (code === '0x' || code.length < 100) {
      console.log('❌ NOT a valid contract or very small code');
      return;
    }
    
    // Try standard ERC20 ABI
    const erc20Abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    
    console.log('\nTrying standard ERC20 calls...');
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(e => `ERROR: ${e.message}`),
      contract.symbol().catch(e => `ERROR: ${e.message}`),
      contract.decimals().catch(e => `ERROR: ${e.message}`)
    ]);
    
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    
    // Try alternative ABI (bytes32)
    if (name.includes('ERROR') || symbol.includes('ERROR')) {
      console.log('\nTrying bytes32 ABI...');
      const bytes32Abi = [
        'function name() view returns (bytes32)',
        'function symbol() view returns (bytes32)'
      ];
      
      const contract2 = new ethers.Contract(tokenAddress, bytes32Abi, provider);
      const [name2, symbol2] = await Promise.all([
        contract2.name().catch(() => ''),
        contract2.symbol().catch(() => '')
      ]);
      
      if (name2 && name2 !== '0x') {
        console.log(`Name (bytes32): ${ethers.decodeBytes32String(name2)}`);
      }
      if (symbol2 && symbol2 !== '0x') {
        console.log(`Symbol (bytes32): ${ethers.decodeBytes32String(symbol2)}`);
      }
    }
    
  } catch (error) {
    console.error(`General error: ${error.message}`);
  }
}

testToken();