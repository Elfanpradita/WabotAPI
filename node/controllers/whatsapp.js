global.crypto = require('crypto');
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function createSocketConnection(app) {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📷 QR Code received. Scan dengan WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('🔴 Connection closed, reason:', reason);

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔁 Reconnecting...');
        createSocketConnection(app);
      } else {
        console.log('❌ Logged out. Hapus folder `session` untuk mulai ulang.');
      }
    }

    if (connection === 'open') {
      console.log('🟢 WhatsApp connected!');
    }
  });

  // ✅ Endpoint test koneksi
  app.get('/ping', (req, res) => {
    res.json({ status: 'alive', message: 'pong 🏓' });
  });

  // ✅ Endpoint kirim pesan
  app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({ error: 'Nomor dan pesan wajib diisi.' });
    }

    try {
      const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: message });
      res.json({ success: true, message: 'Pesan berhasil dikirim.' });
    } catch (err) {
      console.error('❌ Gagal kirim pesan:', err);
      res.status(500).json({ success: false, message: 'Gagal kirim pesan.', error: err.message });
    }
  });
}

module.exports = { createSocketConnection };
