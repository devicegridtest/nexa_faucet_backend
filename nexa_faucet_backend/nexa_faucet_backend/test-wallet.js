// test-wallet.js
require('dotenv').config();
const { getWallet } = require('./wallet');

async function test() {
    try {
        const wallet = getWallet();
        const address = await wallet.getAddress();
        const balance = await wallet.getBalance();

        console.log('✅ Billetera cargada correctamente');
        console.log('Dirección:', address);
        console.log('Saldo:', balance / 100000000, 'NEXA');
    } catch (error) {
        console.error('❌ Error al cargar billetera:', error.message);
    }
}

test();