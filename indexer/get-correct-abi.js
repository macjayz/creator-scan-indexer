// get-correct-abi.js - Get correct event signature
import { ethers } from 'ethers';

async function getCorrectABI() {
  console.log('Getting correct Zora factory ABI...\n');
  
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  
  // Method 1: Try to get contract interface from contract code
  const zoraFactory = '0x777777751622c0d3258f214f9df38e35bf45baf3';
  
  console.log('Checking Zora factory contract...');
  
  // Let's look at the actual transaction you found
  const txHash = '0x07c8b7c8ccf40ebca02a7ed8154e4eea63556a2af3a52079d20a1cc81a9a9842';
  
  try {
    const tx = await provider.getTransactionReceipt(txHash);
    console.log('Transaction found at block:', tx.blockNumber);
    
    // Look for CoinCreated event in logs
    console.log('\nEvents in transaction:');
    tx.logs.forEach((log, i) => {
      console.log(`Log ${i}: ${log.topics[0]}`);
    });
    
    // The event topic is the first topic
    const eventTopic = '0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81';
    
    console.log(`\nLooking for event with topic: ${eventTopic}`);
    
    const matchingLogs = tx.logs.filter(log => log.topics[0] === eventTopic);
    console.log(`Found ${matchingLogs.length} matching logs`);
    
    if (matchingLogs.length > 0) {
      console.log('\n✅ Correct event topic found!');
      console.log('Update factory watcher to filter by this topic instead of event name');
      console.log('\nChange: queryFilter("CoinCreated", ...)');
      console.log('To:     queryFilter({topics: ["0x2de43610..."]}, ...)');
    }
    
  } catch (error) {
    console.log('Error:', error.message);
  }
}

getCorrectABI().catch(console.error);
