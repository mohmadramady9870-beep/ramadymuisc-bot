const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    } else if (connection === 'open') {
      console.log('BOT CONNECTED ✅');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!text.startsWith('.')) return;
    const args = text.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const query = args.join(' ');

    // ===== أمر تشغيل الأغاني =====
    if (cmd === 'play' || cmd === 'song') {
      if (!query) return sock.sendMessage(from, { text: 'كتب .play + سميت الأغنية\nمثال: .play سعد المجرد' });
      await sock.sendMessage(from, { text: '⏳ جاري البحث عن: ' + query + ' ...' });
      try {
        const res = await axios.get('https://itunes.apple.com/search?term=' + encodeURIComponent(query) + '&media=music&limit=1');
        if (!res.data.results.length) return sock.sendMessage(from, { text: '❌ ما لقيتهاش، جرب سميت أخرى' });
        const song = res.data.results[0];
        await sock.sendMessage(from, { image: { url: song.artworkUrl100.replace('100x100', '600x600') }, caption: '🎵 *' + song.trackName + '*\n👤 ' + song.artistName + '\n💿 ' + song.collectionName + '\n\n🔊 كتسمع 30 ثانية من الأغنية:' });
        await sock.sendMessage(from, { audio: { url: song.previewUrl }, mimetype: 'audio/mp4', ptt: false });
      } catch (e) { await sock.sendMessage(from, { text: '❌ خطأ، عاود جرب' }); }
    }

    // ===== أمر القائمة =====
    if (cmd === 'menu' || cmd === 'help') {
      await sock.sendMessage(from, { text: '🤖 *القائمة* 🤖\n\n.play [سمية الأغنية] - تشغيل أغنية\n.menu - هاد القائمة' });
    }

    // ===== هنا زيد أوامر جديدة في المستقبل =====
    // مثال: 
    // if (cmd === 'ping') { await sock.sendMessage(from, { text: 'بونج! 🏓' }); }
    // غير كولي هاد السطر و بدل ping بأي سميت بغيتي

    // ===== نهاية الأوامر =====

  });
}
start();
