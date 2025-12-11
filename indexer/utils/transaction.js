import { ethers } from 'ethers';
import { config } from '../config/index.js';

export async function getTransactionSender(txHash) {
  try {
    const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
    const tx = await provider.getTransaction(txHash);
    return tx?.from?.toLowerCase() || '0x0000000000000000000000000000000000000000';
  } catch (error) {
    console.error(`Error getting transaction ${txHash}:`, error.message);
    return '0x0000000000000000000000000000000000000000';
  }
}
