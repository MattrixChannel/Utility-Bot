const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.token;
const TOKEN_LARAVEL = process.env.TOKEN_LARAVEL;
//const LARAVEL_API = 'http://your-laravel-app.com/api/discord'; // Твой Laravel URL

// Конфигурация сервера Laravel (измените по необходимости)
const SERVER_CONFIG = {
    hostname: 'localhost',
    port: 8000,
    path: '/api', // Соответствует маршруту в routes/api.php
    protocol: 'http' // Используйте 'https' для продакшена
};

// Создаём URL для запроса
const SERVER_URL = `${SERVER_CONFIG.protocol}://${SERVER_CONFIG.hostname}:${SERVER_CONFIG.port}${SERVER_CONFIG.path}`;


client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const payload = { event: 'message', guildId: message.guild.id, userId: message.author.id, content: message.content, messageId: message.id, channelId: message.channel.id };
  try {
    const response = await axios.post(`${SERVER_URL}/handle-message`, payload, { headers: { 'Authorization': `Bearer ${TOKEN_LARAVEL}` } });
    if (response.data.action === 'delete') await message.delete();
    if (response.data.action === 'timeout') await message.member.timeout(response.data.duration);
    // Аналогично для других действий
  } catch (error) { console.error('API Error:', error); }
});
/*
client.on('guildMemberAdd', async (member) => {
  const payload = { event: 'memberJoin', guildId: member.guild.id, userId: member.id };
  // Отправь в API, получи роли и выдай: member.roles.add(roleId)
});*/

// Добавь обработчики для других событий: guildMemberUpdate (для возврата ролей), reactionAdd (для кармы) и т.д.
client.login(TOKEN).catch(console.error);
