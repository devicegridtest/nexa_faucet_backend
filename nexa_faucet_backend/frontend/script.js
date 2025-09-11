document.addEventListener('DOMContentLoaded', () => {
    const addressInput = document.getElementById('address');
    const requestBtn = document.getElementById('requestBtn');
    const messageDiv = document.getElementById('message');

    // =============== BALANCE ===============
    async function updateBalance() {
        try {
            const response = await fetch('https://nexa-faucet-backend.onrender.com/balance');
            const data = await response.json();
            if (data.success) {
                document.getElementById('balance').textContent = data.balanceInNEXA;
            } else {
                document.getElementById('balance').textContent = 'Error';
            }
        } catch (error) {
            document.getElementById('balance').textContent = 'Offline';
        }
    }

    // Actualizar saldo al cargar y cada 30 segundos
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

        requestBtn.disabled = true;
        requestBtn.textContent = 'Enviando...';

        try {
            const response = await fetch('https://nexa-faucet-backend.onrender.com/faucet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
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
            requestBtn.textContent = 'Solicitar 0.01 NEXA'; // Ajustado a 0.01 (coherente con backend)
        }
    });

    // =============== DONATION ADDRESS ===============
    async function loadDonationAddress() {
        try {
            const response = await fetch('https://nexa-faucet-backend.onrender.com/balance');
            const data = await response.json();
            if (data.success) {
                const donationElement = document.getElementById('donationAddress');
                if (donationElement) {
                    donationElement.textContent = data.address;
                }
            }
        } catch (error) {
            const donationElement = document.getElementById('donationAddress');
            if (donationElement) {
                donationElement.textContent = 'Error al cargar';
            }
        }
    }

    // Copiar dirección al portapapeles
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const donationElement = document.getElementById('donationAddress');
            if (!donationElement) return;

            const address = donationElement.textContent;
            navigator.clipboard.writeText(address).then(() => {
                copyBtn.textContent = '¡Copiado!';
                setTimeout(() => {
                    copyBtn.textContent = '📋 Copiar';
                }, 2000);
            }).catch(err => {
                console.error('Error al copiar:', err);
                showMessage('No se pudo copiar al portapapeles', 'error');
            });
        });
    }

    // Inicializar dirección de donación
    loadDonationAddress();
});