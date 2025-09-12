// wallet.js
require('dotenv').config();
const { Wallet } = require('@nexajs/wallet');

let walletInstance = null;

function getWallet() {
    if (!walletInstance) {
        const mnemonic = process.env.MNEMONIC;
        if (!mnemonic) {
            throw new Error('MNEMONIC no definido en .env');
        }
        walletInstance = new Wallet(mnemonic);
    }
    return walletInstance;
}

async function sendFaucet(address, amountInSatoshis) {
    const wallet = getWallet();
    
    // Opcional: verifica balance antes de enviar
    const balance = await wallet.getBalance();
    if (balance < amountInSatoshis) {
        throw new Error('Faucet sin fondos suficientes');
    }

    const txid = await wallet.send(address, amountInSatoshis);
    return txid;
}

module.exports = { sendFaucet, getWallet };