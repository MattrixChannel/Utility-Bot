const { Client, GatewayIntentBits, Partials } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error('❌ Отсутствует TOKEN в .env');

const TOKEN_LARAVEL = process.env.TOKEN_LARAVEL;
const API_URL = process.env.API_URL || 'http://localhost:8000/api';

async function apiPost(endpoint, data) {
    try {
        const res = await axios.post(`${API_URL}/${endpoint}`, data, {
            headers: { 'Authorization': `Bearer ${TOKEN_LARAVEL}` }
        });
        return res.data;
    } catch (err) {
        console.error(`[API ${endpoint}]`, err.response?.data || err.message);
        return null;
    }
}

async function apiGet(endpoint, params = {}) {
    try {
        const res = await axios.get(`${API_URL}/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${TOKEN_LARAVEL}` },
            params
        });
        return res.data;
    } catch (err) {
        console.error(`[GET ${endpoint}]`, err.response?.data || err.message);
        return null;
    }
}

const PREFIX = '!';

client.on('clientReady', () => {
    console.log(`✅ ${client.user.tag} запущен.`);
    client.user.setActivity('!help | Moderation', { type: 'WATCHING' });
});

// СООБЩЕНИЯ
client.on('messageCreate', async (message) => {
    // Автомодерация
    if (!message.author.bot && message.guild) {
        const res = await apiPost('handle-message', {
            guildId: message.guild.id,
            userId: message.author.id,
            content: message.content,
            messageId: message.id,
            channelId: message.channel.id
        });
        if (!res) return;

        if (res.action === 'delete' && message.deletable) {
            await message.delete().catch(() => { });
        }
        if (res.action === 'timeout' && message.member?.manageable) {
            const ms = (res.duration || 10) * 60 * 1000;
            await message.member.timeout(ms, res.reason || 'Авто-модерация').catch(() => { });
        }
    }

    // Команды
    if (!message.content.startsWith(PREFIX) || !message.guild || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift()?.toLowerCase();

    // !help
    if (cmd === 'help') {
        return message.channel.send(`**🔧 Команды модерации:**
\`!mute @user [мин] [причина]\` — замутить  
\`!unmute @user\` — размутить  
\`!kick @user [причина]\` — кик  
\`!ban @user [причина]\` — бан  
\`!karma [@user]\` — карма  
\`!stats [@user]\` — статистика`);
    }

    // !mute
    if (cmd === 'mute') {
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Укажите участника.');
        if (!message.member.permissions.has('MODERATE_MEMBERS')) {
            return message.reply('❌ Недостаточно прав.');
        }
        const mins = parseInt(args[1]) || 10;
        const reason = args.slice(2).join(' ') || 'Модератор решил';

        const res = await apiPost('manual-punish', {
            guildId: message.guild.id,
            userId: target.id,
            type: 'mute',
            duration: mins,
            reason
        });
        if (res?.action === 'mute') {
            await target.timeout(mins * 60_000, reason)
                .then(() => message.channel.send(`🔇 ${target} замьючен на ${mins} мин.`))
                .catch(() => message.channel.send('⚠ Не удалось замутить (проверьте иерархию ролей).'));
        }
    }

    // !unmute
    if (cmd === 'unmute') {
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Укажите участника.');
        if (!message.member.permissions.has('MODERATE_MEMBERS')) return message.reply('❌ Недостаточно прав.');

        try {
            await target.timeout(null, 'Размут вручную');
            await apiPost('manual-punish', {
                guildId: message.guild.id,
                userId: target.id,
                type: 'unmute',
                reason: 'Ручное снятие'
            });
            message.reply(`🔊 ${target} размучен.`);
        } catch (e) {
            message.reply('⚠ Не удалось размутить.');
        }
    }

    // !kick
    if (cmd === 'kick') {
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Укажите участника.');
        if (!message.member.permissions.has('KICK_MEMBERS')) return message.reply('❌ Недостаточно прав.');

        const reason = args.join(' ') || 'Модератор решил';
        try {
            await target.kick(reason);
            await apiPost('manual-punish', {
                guildId: message.guild.id,
                userId: target.id,
                type: 'kick',
                reason
            });
            message.reply(`👢 ${target} кикнут.`);
        } catch {
            message.reply('⚠ Не удалось кикнуть.');
        }
    }

    // !ban
    if (cmd === 'ban') {
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Укажите участника.');
        if (!message.member.permissions.has('BAN_MEMBERS')) return message.reply('❌ Недостаточно прав.');

        const reason = args.join(' ') || 'Модератор решил';
        try {
            await target.ban({ reason });
            await apiPost('manual-punish', {
                guildId: message.guild.id,
                userId: target.id,
                type: 'ban',
                reason
            });
            message.reply(`🚫 ${target} забанен.`);
        } catch {
            message.reply('⚠ Не удалось забанить.');
        }
    }

    // !karma
    if (cmd === 'karma') {
        const target = message.mentions.users.first() || message.author;
        const res = await apiGet('get-user-stats', {
            guildId: message.guild.id,
            userId: target.id
        });
        if (!res) return message.reply('❌ Пользователь не найден.');
        message.reply(`${target.tag} — **карма: ${res.karma}**, сообщений: ${res.messages}`);
    }

    // !stats
    if (cmd === 'stats') {
        if (message.mentions.users.size > 0) {
            const user = message.mentions.users.first();
            const res = await apiGet('get-user-stats', {
                guildId: message.guild.id,
                userId: user.id
            });
            message.channel.send(`${user.tag}: карма ${res.karma}, сообщений ${res.messages}, наказаний ${res.punishments}`);
        } else {
            const res = await apiGet('get-guild-stats', { guildId: message.guild.id });
            message.channel.send(`📊 Сервер: ${res.members} участников, ${res.messages} сообщений, ${res.punishments} наказаний.`);
        }
    }

    // !autorole add @role welcome|restore
    if (cmd === 'autorole' && args[0] === 'add') {
        if (!message.member.permissions.has('MANAGE_ROLES')) {
            return message.channel.send('❌ Недостаточно прав (нужно: Управление ролями).');
        }

        const role = message.mentions.roles.first();
        const type = args[2]?.toLowerCase();

        if (!role) {
            return message.channel.send('❌ Укажите роль: `!autorole add @Роль welcome`');
        }
        if (!type || !['welcome', 'restore'].includes(type)) {
            return message.channel.send('❌ Укажите тип: `welcome` или `restore`');
        }
        if (role.managed) {
            return message.channel.send('❌ Нельзя назначать роли интеграций (боты, Boost).');
        }
        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.channel.send('❌ Моя роль ниже — не могу выдавать эту роль.');
        }

        const payload = {
            guildId: message.guild.id,
            roleId: role.id,
            type: type,
            roleName: role.name
        };

        const res = await apiPost('setup-autorole', payload);
        if (res?.status === 'ok') {
            message.channel.send(`✅ Роль **${role.name}** добавлена как \`${type}\`.`);
        } else {
            message.channel.send(`⚠ Ошибка: ${res?.message || 'неизвестно'}`);
        }
    }
});

// СОБЫТИЯ
client.on('guildMemberAdd', async (member) => {
    const res = await apiPost('handle-member-join', {
        guildId: member.guild.id,
        userId: member.id
    });
    if (res?.action === 'addRoles' && Array.isArray(res.roles)) {
        await member.roles.add(res.roles).catch(() => { });
    }
});

client.on('guildMemberRemove', async (member) => {
    const roles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.id);
    if (roles.length > 0) {
        await apiPost('handle-member-leave', {
            guildId: member.guild.id,
            userId: member.id,
            roles
        });
    }
});

client.on('guildMemberUpdate', async (old, cur) => {
    if (old.communicationDisabledUntilTimestamp && !cur.communicationDisabledUntilTimestamp) {
        await apiPost('handle-punishment-end', {
            guildId: cur.guild.id,
            userId: cur.id
        });
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    const emoji = reaction.emoji.name;
    if (!['👍', '👎'].includes(emoji)) return;

    const msg = await reaction.message.fetch();
    if (!msg.author || msg.author.bot) return;

    await apiPost('handle-reaction', {
        guildId: reaction.message.guild.id,
        userId: user.id,
        targetUserId: msg.author.id,
        reaction: emoji
    });
});

client.login(TOKEN).catch(console.error);