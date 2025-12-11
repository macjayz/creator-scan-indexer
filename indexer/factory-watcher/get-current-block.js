import Web3 from 'web3';
const web3 = new Web3('https://eth.merkle.io');
web3.eth.getBlockNumber().then(n => console.log(n)).catch(e => console.log('Error:', e));
