const { Telegraf, Markup } = require('telegraf');

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =======================
// 🔐 Konfigurasi Bot
// =======================
const BOT_TOKEN = '8006865528:AAE0vGWwNX1TpNKkRqShTKCygbq1RkPLm64';
const DANA_QR_LINK = 'https://files.catbox.moe/mxovdq.jpg';
const DANA_NUMBER = '087883536039';
const ADMIN_ID = 6468926488;

const REMINDER_TIMEOUT = 12 * 60 * 60 * 1000;
const PAYMENT_TIMEOUT = 24 * 60 * 60 * 1000;

const bot = new Telegraf(BOT_TOKEN);

// =======================
// Data pengguna
// =======================
const users = {};

// =======================
// Fungsi safe send
// =======================
async function safeSendMessage(chatId, text, extra = {}) {
  try {
    await bot.telegram.sendMessage(chatId, text, extra);
  } catch (e) {
    if (e?.response?.error_code === 403) {
      console.log(`User ${chatId} memblokir bot.`);
      delete users[chatId];
    } else {
      console.error(`Gagal kirim pesan ke ${chatId}:`, e);
    }
  }
}

async function safeSendPhoto(chatId, photo, extra = {}) {
  try {
    await bot.telegram.sendPhoto(chatId, photo, extra);
  } catch (e) {
    if (e?.response?.error_code === 403) {
      console.log(`User ${chatId} memblokir bot.`);
      delete users[chatId];
    } else {
      console.error(`Gagal kirim foto ke ${chatId}:`, e);
    }
  }
}

// =======================
// Daftar Paket
// =======================
const paketList = {
  lokal: { name: "Lokal", harga: 2000, channel: 'https://t.me/+P1hlp7dNmdgyOTVl' },
  cina: { name: "Cina", harga: 2000, channel: 'https://t.me/+eXWEgvPsFpY2MGI1' },
  asia: { name: "Asia", harga: 2000, channel: 'https://t.me/+RdCldl43tqk5YzY1' },
  amerika: { name: "Amerika", harga: 2000, channel: 'https://t.me/+kT7I9m0V85JkZWY1' },
  yaoi: { name: "Yaoi", harga: 2000, channel: 'https://t.me/+B_BQ68aeAd42MTI1' },
  lengkap: {
    name: "Paket Lengkap Semua Channel", harga: 6000, channel: [
      'https://t.me/+RdCldl43tqk5YzY1',
      'https://t.me/+P1hlp7dNmdgyOTVl',
      'https://t.me/+eXWEgvPsFpY2MGI1',
      'https://t.me/+kT7I9m0V85JkZWY1',
      'https://t.me/+B_BQ68aeAd42MTI1'
    ]
  }
};

// =======================
// Menu Utama
// =======================
async function showMainMenu(ctx) {
  const chatId = ctx.chat.id;
  await safeSendMessage(chatId,
    `👋 Selamat datang di bot VIP @ujoyp!\n\nPilih paket yang kamu inginkan:\n` +
    `📦 Lokal - Rp2.000\n📦 Cina - Rp2.000\n📦 Asia - Rp2.000\n` +
    `📦 Amerika - Rp2.000\n📦 Yaoi - Rp2.000\n📦 Paket Lengkap Semua Channel - Rp6.000`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Lokal', callback_data: 'lokal' }],
          [{ text: '📦 Cina', callback_data: 'cina' }],
          [{ text: '📦 Asia', callback_data: 'asia' }],
          [{ text: '📦 Amerika', callback_data: 'amerika' }],
          [{ text: '📦 Yaoi', callback_data: 'yaoi' }],
          [{ text: '📦 Semua Channel - Rp6.000', callback_data: 'lengkap' }]
        ]
      }
    });
}

// =======================
// /start
// =======================
bot.start(showMainMenu);

// =======================
// Pilih Paket
// =======================
bot.action(/^(lokal|cina|asia|amerika|yaoi|lengkap)$/, async (ctx) => {
  const paketId = ctx.match[0];
  const userId = ctx.from.id;

  if (users[userId]?.status === 'pending') {
    await ctx.answerCbQuery();
    return ctx.reply(
      `⚠️ Kamu masih memiliki transaksi *${paketList[users[userId].paket].name}* yang belum selesai.\nSilakan lanjutkan bayar atau ketik /batal`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('✅ Lanjutkan Pembayaran', 'continue_payment')],
          [Markup.button.callback('❌ Batalkan Pesanan', 'cancel_order')]
        ])
      }
    );
  }

  const now = Date.now();
  users[userId] = {
    paket: paketId,
    status: 'pending',
    timestamp: now,
    expiredAt: null,
    timeoutIds: []
  };

  const pkg = paketList[paketId];
  const caption = `📦 *${pkg.name}* – Rp${pkg.harga.toLocaleString('id-ID')}\n\n` +
    `Silakan scan QR di atas.\nKirim bukti pembayaran (foto/screenshot) ke sini.\n\n` +
    `*Jangan kirim bukti palsu, kamu bisa di-banned!*\n` +
    `Butuh bantuan? Hubungi admin @ujoyp`;

  await ctx.replyWithPhoto(DANA_QR_LINK, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📞 Hubungi Admin', 'https://t.me/ujoyp')],
      [Markup.button.callback('❌ Batalkan Pesanan', 'cancel_order')]
    ])
  });

  const reminderId = setTimeout(() => {
    if (users[userId]?.status === 'pending') {
      safeSendMessage(userId, `⏰ Pengingat! Kamu masih memiliki pembayaran paket *${pkg.name}*.`, {
        parse_mode: 'Markdown'
      });
    }
  }, REMINDER_TIMEOUT);

  const timeoutId = setTimeout(() => {
    if (users[userId]?.status === 'pending') {
      delete users[userId];
      safeSendMessage(userId, `⏰ Waktu pembayaran habis. Silakan ulangi pembelian.`, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔁 Kembali ke Menu', 'back_to_menu')]
        ])
      });
    }
  }, PAYMENT_TIMEOUT);

  users[userId].timeoutIds.push(reminderId, timeoutId);
  await ctx.answerCbQuery();
});

// =======================
// Bukti pembayaran (photo)
// =======================
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;

  if (!users[userId] || users[userId].status !== 'pending') {
    return await safeSendMessage(userId, '❌ Kamu tidak memiliki transaksi aktif. Ketik /start untuk memulai.');
  }

  const pkg = paketList[users[userId].paket];
  users[userId].status = 'done';
  users[userId].timeoutIds.forEach(id => clearTimeout(id));
  users[userId].timeoutIds = [];

  try {
    const user = ctx.from;
    const pkgNameEscaped = escapeHtml(pkg.name);
    const photo = ctx.message.photo.at(-1).file_id;

    const caption = `📥 *User mengirim bukti transfer!*\n\n` +
      `👤 *Nama:* ${escapeHtml(user.first_name)}\n` +
      `🆔 *ID:* \`${user.id}\`\n` +
      `📦 *Paket:* ${pkgNameEscaped}`;

    let buttons;
    if (user.username) {
      buttons = Markup.inlineKeyboard([
        [Markup.button.url(`👤 @${user.username}`, `https://t.me/${user.username}`)]
      ]);
    } else {
      buttons = Markup.inlineKeyboard([
        [{ text: `🆔 ID: ${user.id}`, callback_data: 'noop' }]
      ]);
    }

    await bot.telegram.sendPhoto(ADMIN_ID, photo, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: buttons.reply_markup
    });

    await sendVerifiedLinks(userId, pkg);
  } catch (e) {
    console.error(e);
  }
});

// =======================
// Kirim link ke user setelah verifikasi
// =======================
async function sendVerifiedLinks(userId, pkg) {
  try {
    if (Array.isArray(pkg.channel)) {
      await safeSendMessage(userId, `✅ Pembayaran terverifikasi!\n\nBerikut link channel VIP paket lengkap:`);
      for (const link of pkg.channel) {
        await safeSendMessage(userId, link);
      }
    } else {
      const text = `✅ Pembayaran terverifikasi!\n\nBerikut link channel VIP paket <b>${escapeHtml(pkg.name)}</b>:\n${pkg.channel}`;
      await safeSendMessage(userId, text, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('Error kirim link channel:', e);
  }
}

// =======================
// Callback Actions
// =======================
bot.action('continue_payment', async (ctx) => {
  const userId = ctx.from.id;
  const order = users[userId];
  if (!order || order.status !== 'pending') {
    return await ctx.reply('❌ Tidak ada transaksi yang tertunda.');
  }

  const pkg = paketList[order.paket];
  await ctx.replyWithPhoto(DANA_QR_LINK, {
    caption: `📦 *${pkg.name}* – Rp${pkg.harga.toLocaleString('id-ID')}\n\nSilakan lanjutkan pembayaran via DANA ke:\n📱 *${DANA_NUMBER}*`,
    parse_mode: 'Markdown',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📞 Hubungi Admin', 'https://t.me/ujoyp')],
      [Markup.button.callback('❌ Batalkan Pesanan', 'cancel_order')]
    ])
  });

  await ctx.answerCbQuery();
});

bot.action('cancel_order', async (ctx) => {
  const userId = ctx.from.id;
  if (!users[userId] || users[userId].status !== 'pending') {
    return await ctx.answerCbQuery('❌ Tidak ada pesanan yang bisa dibatalkan.', { show_alert: true });
  }

  users[userId].timeoutIds.forEach(id => clearTimeout(id));
  delete users[userId];

  await ctx.answerCbQuery('✅ Pesanan dibatalkan.');
  await ctx.reply('❌ Pesanan kamu sudah dibatalkan.', Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
  ]));
});

bot.action('back_to_menu', async (ctx) => {
  await showMainMenu(ctx);
  await ctx.answerCbQuery();
});

// =======================
// Command Tambahan
// =======================
bot.command('help', async (ctx) => {
  await safeSendMessage(ctx.chat.id,
    `ℹ️ *Panduan Penggunaan Bot:*\n\n` +
    `1. Gunakan /start untuk memilih paket.\n` +
    `2. Bayar menggunakan QR DANA.\n` +
    `3. Kirim bukti pembayaran.\n` +
    `4. Tunggu verifikasi admin.\n` +
    `5. Dapatkan akses ke channel VIP!\n\n` +
    `📌 *Perintah:*\n` +
    `/batal – Batalkan transaksi\n` +
    `/help – Bantuan\n\n` +
    `Hubungi admin: @ujoyp`,
    { parse_mode: 'Markdown' });
});

bot.command('batal', async (ctx) => {
  const userId = ctx.from.id;
  if (!users[userId] || users[userId].status !== 'pending') {
    return await safeSendMessage(userId, '❌ Kamu tidak memiliki transaksi aktif.');
  }

  users[userId].timeoutIds.forEach(id => clearTimeout(id));
  delete users[userId];

  await safeSendMessage(userId, '✅ Transaksi berhasil dibatalkan.');
});

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!['lokal', 'cina', 'asia', 'amerika', 'yaoi', 'lengkap', 'continue_payment', 'cancel_order', 'back_to_menu'].includes(data)) {
    await ctx.answerCbQuery('Perintah tidak dikenali.');
  }
});

// =======================
// Error Global
// =======================
bot.catch((err, ctx) => {
  const chatId = ctx.chat?.id || ctx.callbackQuery?.from?.id;
  if (err?.response?.error_code === 403 && chatId) {
    console.log(`User ${chatId} memblokir bot.`);
    delete users[chatId];
  } else {
    console.error('Unhandled error:', err);
  }
});

// =======================
// Jalankan Bot
// =======================
bot.launch().then(() => {
  console.log('Bot sudah berjalan...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
