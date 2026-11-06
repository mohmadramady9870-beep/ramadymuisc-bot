const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false, browser: ['Chrome', 'Chrome', 'Chrome'] });
  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    const phoneNumber = "212725924220";
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('كود الربط ديالك هو: ' + code);
      } catch (e) { console.log('خطأ: ' + e.message); }
    }, 3000);
  }

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
    if (!text.startsWith('.') && !text.startsWith('-')) return;
    const args = text.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const query = args.join(' ');

    if (cmd === 'play' || cmd === 'song' || cmd === 'اغنية' || cmd === 'اغنيه') {
      if (!query) return sock.sendMessage(from, { text: 'كتب .play + سميت الأغنية\nمثال: .play سعد المجرد - انت معلم' });
      await sock.sendMessage(from, { text: '⏳ جاري البحث و تحميل الأغنية كاملة...\n🎵 ' + query });
      try {
        const search = await yts(query);
        if (!search.videos.length) return sock.sendMessage(from, { text: '❌ ما لقيتهاش، جرب سميت أخرى' });
        const video = search.videos[0];
        await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: '🎵 *' + video.title + '*\n👤 ' + video.author.name + '\n⏱️ ' + video.timestamp + '\n\n⏳ كنحملها كاملة دابا، تسنى شوية...' });

        const filePath = './song.mp3';
        const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
        const write = fs.createWriteStream(filePath);
        stream.pipe(write);
        await new Promise((resolve, reject) => { write.on('finish', resolve); write.on('error', reject); });

        // صيفطها فوكال / رسالة صوتية
        await sock.sendMessage(from, { audio: fs.readFileSync(filePath), mimetype: 'audio/mp4', ptt: true, fileName: video.title + '.mp3' });
        fs.unlinkSync(filePath);
      } catch (e) {
        console.log(e);
        await sock.sendMessage(from, { text: '❌ خطأ فـ التحميل، عاود جرب أغنية أخرى' });
      }
    }
  });
}
start();
