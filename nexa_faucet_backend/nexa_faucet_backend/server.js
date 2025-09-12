require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Address } = require('@nexajs/address'); // ✅ Importado, ahora lo usamos
const { sendFaucet, getWallet } = require('./wallet'); // ✅ Añadido getWallet
const { canRequest, saveRequest } = require('./database');
const HCaptcha = require('hcaptcha');
const hcaptcha = new HCaptcha(process.env.HCAPTCHA_SECRET);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'null', 'https://tudominio.com'],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());

// Middleware para logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Faucet Backend Activo' });
});

// Ruta principal de faucet
app.post('/faucet', async (req, res) => {
    const { address, captcha } = req.body; // ✅ Destructuramos TODO aquí, no dos veces

    try {
        // Validar CAPTCHA
        if (!captcha) {
            return res.status(400).json({ error: 'CAPTCHA requerido' });
        }

        try {
            await hcaptcha.verify(captcha);
        } catch (err) {
            return res.status(400).json({ error: 'CAPTCHA inválido' });
        }

        // Validar dirección
        if (!address || typeof address !== 'string') {
            return res.status(400).json({ error: 'Dirección requerida' });
        }

        if (!Address.isValid(address)) { // ✅ Usamos la librería real
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
        const amount = parseInt(process.env.FAUCET_AMOUNT);
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
                                { name: "TXID", value: `[Ver en explorer](https://explorer.nexa.org/tx/${txid})`, inline: false }
                            ],
                            timestamp: new Date().toISOString(),
                            footer: { text: "Nexa Faucet" }
                        }]
                    })
                });
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

// Ruta para obtener saldo de la faucet (¡solo una vez!)
app.get('/balance', async (req, res) => {
    try {
        const wallet = getWallet();
        const balance = await wallet.getBalance();
        const balanceInNEXA = (balance / 100000000).toFixed(4); // Convertir a NEXA

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
    const db = require('./database').db; // ✅ Accedemos a la instancia de DB
    db.all(`
        SELECT address, last_request 
        FROM requests 
        ORDER BY last_request DESC 
        LIMIT 5
    `, [], (err, rows) => {
        if (err) {
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Faucet Backend corriendo en http://localhost:${PORT}`);
    console.log(`💡 Usa POST /faucet para solicitar fondos`);
    console.log(`📊 Saldo: GET /balance`);
    console.log(`📡 Transacciones: GET /transactions`);
});