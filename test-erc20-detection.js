const { ethers } = require('ethers');

// Known ERC-20 contract on Base (WETH for example)
const KNOWN_ERC20 = '0x4200000000000000000000000000000000000006'; // WETH on Base

const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/WP_xuEGBgpHNNkxTHjcTK');

async function testERC20Detection() {
    console.log('Testing ERC-20 detection on known contract...\n');
    
    try {
        // Get bytecode
        const bytecode = await provider.getCode(KNOWN_ERC20);
        console.log(`Contract: ${KNOWN_ERC20}`);
        console.log(`Bytecode length: ${bytecode.length} characters`);
        
        // Check for ERC-20 selectors
        const ERC20_SELECTORS = [
            '0x70a08231', // balanceOf(address)
            '0xa9059cbb', // transfer(address,uint256)
            '0xdd62ed3e', // allowance(address,address)
        ];
        
        let found = 0;
        ERC20_SELECTORS.forEach(selector => {
            if (bytecode.includes(selector.substring(2))) {
                console.log(`✅ Found selector: ${selector}`);
                found++;
            }
        });
        
        console.log(`\n🎯 Result: ${found}/${ERC20_SELECTORS.length} ERC-20 selectors found`);
        
        if (found >= 2) {
            console.log('✅ This looks like an ERC-20 token!');
        } else {
            console.log('❌ Not a typical ERC-20');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testERC20Detection().catch(console.error);
