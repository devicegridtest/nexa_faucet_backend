document.addEventListener('DOMContentLoaded', () => {
    const addressInput = document.getElementById('address');
    const requestBtn = document.getElementById('requestBtn');
    const messageDiv = document.getElementById('message');

    // =============== BALANCE ===============
    async function updateBalance() {
        try {
            const response = await fetch('https://nexa-faucet-backend-5nxc.onrender.com/balance');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            if (data.success) {
                document.getElementById('balance').textContent = data.balanceInNEXA;
            } else {
                document.getElementById('balance').textContent = 'Error';
            }
        } catch (error) {
            console.error('Error actualizando saldo:', error);
            document.getElementById('balance').textContent = 'Offline';
        }
    }

    updateBalance();
    setInterval(updateBalance, 30000);

    // =============== UTILS ===============
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 8000);
    }

    function isValidNexaAddress(address) {
        return address.startsWith('nexa:') && address.length > 50;
    }

    // =============== FAUCET REQUEST ===============
    requestBtn.addEventListener('click', async () => {
        const address = addressInput.value.trim();

        if (!address) {
            showMessage('Por favor ingresa una dirección.', 'error');
            return;
        }

        if (!isValidNexaAddress(address)) {
            showMessage('Dirección Nexa inválida. Debe empezar con "nexa:"', 'error');
            return;
        }

        // Obtener token de hCaptcha
        const captchaWidget = document.querySelector('.h-captcha iframe');
        if (!captchaWidget) {
            showMessage('CAPTCHA no cargado. Recarga la página.', 'error');
            return;
        }

        const captchaToken = grecaptcha.getResponse();
        if (!captchaToken) {
            showMessage('Por favor completa el CAPTCHA.', 'error');
            return;
        }

        requestBtn.disabled = true;
        requestBtn.textContent = 'Enviando...';

        try {
            const response = await fetch('https://nexa-faucet-backend-5nxc.onrender.com/faucet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, captcha: captchaToken }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Error desconocido');

            const amount = (data.amount / 100000000).toFixed(4);
            const shortTxid = data.txid.substring(0, 12) + '...';
            showMessage(`✅ ¡Enviados ${amount} NEXA! TX: ${shortTxid}`, 'success');

        } catch (error) {
            showMessage('❌ ' + error.message, 'error');
        } finally {
            requestBtn.disabled = false;
            requestBtn.textContent = 'Solicitar 0.01 NEXA';
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
        }
    });

    // =============== DONATION ADDRESS ===============
    async function loadDonationAddress() {
        try {
            const response = await fetch('https://nexa-faucet-backend-5nxc.onrender.com/balance');
            if (!response.ok) throw new Error('No se pudo conectar al servidor');
            const data = await response.json();
            if (data.success) {
                const donationElement = document.getElementById('donationAddress');
                if (donationElement) {
                    donationElement.textContent = data.address;
                }
            } else {
                throw new Error('Respuesta sin éxito del backend');
            }
        } catch (error) {
            console.error('Error cargando dirección de donación:', error);
            const donationElement = document.getElementById('donationAddress');
            if (donationElement) {
                donationElement.textContent = 'Carga fallida. Inténtalo más tarde.';
            }
        }
    }

    // Copiar al portapapeles
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const donationElement = document.getElementById('donationAddress');
            if (!donationElement) {
                alert('Elemento de dirección no encontrado.');
                return;
            }

            const address = donationElement.textContent.trim();
            if (address.includes('Carga fallida') || address === 'Cargando...') {
                alert('La dirección aún no está disponible. Por favor, espera.');
                return;
            }

            navigator.clipboard.writeText(address).then(() => {
                copyBtn.textContent = '¡Copiado!';
                setTimeout(() => {
                    copyBtn.textContent = '📋 Copiar';
                }, 2000);
            }).catch(err => {
                console.error('Error al copiar:', err);
                alert('No se pudo copiar. Intenta manualmente.');
            });
        });
    }

    // =============== LIVE TRANSACTIONS ===============
    async function loadTransactions() {
        try {
            const response = await fetch('https://nexa-faucet-backend-5nxc.onrender.com/transactions');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();

            const grid = document.getElementById('transactionsGrid');
            if (!grid) return;

            grid.innerHTML = '';

            if (data.success && data.transactions?.length > 0) {
                data.transactions.forEach(tx => {
                    const card = document.createElement('div');
                    card.className = 'transaction-card';
                    card.innerHTML = `
                        <h3>🔑 Dirección</h3>
                        <div class="address">${tx.shortAddress}</div>
                        <div class="date">🕒 ${tx.date}</div>
                    `;
                    grid.appendChild(card);
                });
            } else {
                grid.innerHTML = '<p style="text-align:center;color:#aaa">No hay transacciones recientes</p>';
            }
        } catch (error) {
            console.error('Error cargando transacciones:', error);
            const grid = document.getElementById('transactionsGrid');
            if (grid) {
                grid.innerHTML = '<p style="text-align:center;color:#ff6b6b">Error al cargar transacciones</p>';
            }
        }
    }

    // Inicializar
    loadDonationAddress();
    loadTransactions();
    setInterval(loadTransactions, 30000);
});