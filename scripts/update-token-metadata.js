import { ethers } from 'ethers';
import pkg from 'pg';
const { Pool } = pkg;

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const pool = new Pool({
  connectionString: 'postgresql://creator_scan:local_password@localhost:5433/creator_scan'
});

async function updateTokenMetadata(tokenAddress) {
  try {
    const erc20Abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name().catch(() => ''),
      contract.symbol().catch(() => ''),
      contract.decimals().catch(() => 18),
      contract.totalSupply().catch(() => '0')
    ]);
    
    if (name && name.trim() !== '' && symbol && symbol.trim() !== '') {
      await pool.query(
        'UPDATE tokens SET name = $1, symbol = $2, decimals = $3, total_supply = $4 WHERE address = $5',
        [name.substring(0, 200), symbol.substring(0, 50), Number(decimals), totalSupply.toString(), tokenAddress.toLowerCase()]
      );
      console.log(`Updated: ${symbol} (${name})`);
      return true;
    }
    return false;
  } catch (error) {
    console.log(`Failed to update ${tokenAddress}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Updating Zora token metadata...');
  
  const result = await pool.query(
    "SELECT address FROM tokens WHERE platform = 'zora' AND (name = 'Zora Token' OR name = 'Unknown') LIMIT 10"
  );
  
  let updated = 0;
  for (const row of result.rows) {
    const success = await updateTokenMetadata(row.address);
    if (success) updated++;
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  
  console.log(`Updated ${updated} tokens`);
  await pool.end();
}

main().catch(console.error);
