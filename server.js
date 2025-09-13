require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Address } = require('@nexajs/address');
const { sendFaucet, getWallet } = require('./wallet');
const { canRequest, saveRequest } = require('./database');

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Configuración de CORS (SIN espacios en dominios)
app.use(cors({
    origin: [
        'null',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:8080',
        'https://tudominio.com',       // ✅ Espacio eliminado
        'https://devicegridtest.org'   // ✅ Espacio eliminado
    ],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());

// Middleware para logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: "🚀 Nexa Faucet Backend",
        endpoints: {
            health: "GET /health",
            balance: "GET /balance",
            faucet: "POST /faucet",
            transactions: "GET /transactions"
        }
    });
});

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Faucet Backend Activo' });
});

// Ruta principal de faucet (SIN CAPTCHA)
app.post('/faucet', async (req, res) => {
    const { address } = req.body; // ✅ Solo address, sin captcha

    try {
        // Validar dirección
        if (!address || typeof address !== 'string') {
            return res.status(400).json({ error: 'Dirección requerida' });
        }

        if (!Address.isValid(address)) {
            return res.status(400).json({ error: 'Dirección Nexa inválida' });
        }

        // Verificar cooldown
        const allowed = await canRequest(address);
        if (!allowed) {
            return res.status(429).json({ 
                error: 'Ya solicitaste fondos. Espera 24 horas.' 
            });
        }

        // Enviar fondos
        const amount = parseInt(process.env.FAUCET_AMOUNT) || 1000000;
        const txid = await sendFaucet(address, amount);

        // Registrar solicitud
        await saveRequest(address);

        // 🚀 ENVIAR NOTIFICACIÓN A DISCORD (si está configurado)
        if (process.env.DISCORD_WEBHOOK_URL) {
            try {
                await fetch(process.env.DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: "💧 ¡Nueva transacción en la faucet!",
                            color: 5814783, // Verde neón
                            fields: [
                                { name: "Dirección", value: `\`${address}\``, inline: true },
                                { name: "Monto", value: `${amount / 100000000} NEXA`, inline: true },
                                { name: "TXID", value: `[Ver en explorer](https://explorer.nexa.org/tx/${txid})`, inline: false } // ✅ Espacio eliminado
                            ],
                            timestamp: new Date().toISOString(),
                            footer: { text: "Nexa Faucet" }
                        }]
                    })
                });
                console.log('✅ Notificación enviada a Discord');
            } catch (err) {
                console.error('❌ Error enviando a Discord:', err.message);
            }
        }

        // Responder con éxito
        console.log(`✅ Enviado ${amount} satoshis a ${address}. TXID: ${txid}`);
        res.json({
            success: true,
            txid,
            amount,
            message: `Enviados ${amount / 100000000} NEXA a ${address}`
        });

    } catch (error) {
        console.error('❌ Error en faucet:', error.message);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Ruta para obtener saldo de la faucet
app.get('/balance', async (req, res) => {
    try {
        const wallet = getWallet();
        const balance = await wallet.getBalance();
        const balanceInNEXA = (balance / 100000000).toFixed(4);

        res.json({
            success: true,
            balance: balance,
            balanceInNEXA: balanceInNEXA,
            address: await wallet.getAddress()
        });
    } catch (error) {
        console.error('Error obteniendo saldo:', error);
        res.status(500).json({ error: 'No se pudo obtener saldo' });
    }
});

// Ruta para obtener últimas transacciones
app.get('/transactions', (req, res) => {
    const db = require('./database').db;
    db.all(`
        SELECT address, last_request 
        FROM requests 
        ORDER BY last_request DESC 
        LIMIT 5
    `, [], (err, rows) => {
        if (err) {
            console.error('Error obteniendo transacciones:', err);
            return res.status(500).json({ error: 'Error obteniendo transacciones' });
        }

        const transactions = rows.map(row => ({
            address: row.address,
            date: new Date(row.last_request).toLocaleString('es-ES'),
            shortAddress: row.address.substring(0, 12) + '...'
        }));

        res.json({ success: true, transactions });
    });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor con manejo de errores
try {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Faucet Backend corriendo en puerto ${PORT}`);
        console.log(`💡 Usa POST /faucet para solicitar fondos`);
        console.log(`📊 Saldo: GET /balance`);
        console.log(`📡 Transacciones: GET /transactions`);
    });
} catch (error) {
    console.error('❌ Error fatal al iniciar servidor:', error);
    process.exit(1);
}