require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
//const fetch = require('node-fetch'); // Установите: npm install node-fetch (если используете Node.js <18)

// Конфигурация сервера Laravel (измените по необходимости)
const SERVER_CONFIG = {
    hostname: 'localhost',
    port: 8000,
    path: '/api/discord-message', // Соответствует маршруту в routes/api.php
    protocol: 'http' // Используйте 'https' для продакшена
};

// Создаём URL для запроса
const SERVER_URL = `${SERVER_CONFIG.protocol}://${SERVER_CONFIG.hostname}:${SERVER_CONFIG.port}${SERVER_CONFIG.path}`;

// Инициализация Discord-клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Для чтения содержимого сообщений
    ]
});

// Токен бота
const TOKEN = process.env.token;

// Функция для отправки JSON на Laravel-сервер
async function sendToLaravel(message) {
    // Извлекаем ключевые данные из сообщения (избегаем циклических ссылок)
    const jsonData = {
        id: message.id,
        content: message.content,
        author: {
            id: message.author.id,
            username: message.author.username,
            discriminator: message.author.discriminator,
            bot: message.author.bot
        },
        channel: {
            id: message.channel.id,
            name: message.channel.name
        },
        guild: message.guild ? {
            id: message.guild.id,
            name: message.guild.name
        } : null,
        timestamp: message.createdAt.toISOString(),
        attachments: message.attachments.map(att => ({ name: att.name, url: att.url })),
        // Добавьте другие поля, если нужно (например, embeds, reactions)
    };

    try {
        console.log(`Отправка данных на сервер: ${JSON.stringify(jsonData, null, 2)}`);

        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Добавьте токен аутентификации, если нужно: 'Authorization': 'Bearer your-token'
            },
            body: JSON.stringify(jsonData)
        });

        if (!response.ok) {
            throw new Error(`Сервер вернул ошибку: ${response.status} ${response.statusText}`);
        }

        const serverResponse = await response.json();
        console.log(`Ответ от сервера:`, serverResponse);

        // Пример: если сервер ответил "pong" на "ping", отправьте сообщение в Discord
        if (message.content.toLowerCase() === 'ping' && serverResponse.reply === 'pong') {
            await message.reply('Pong! (от сервера)');
        }

    } catch (error) {
        console.error('Ошибка при отправке на сервер:', error.message);
        // Опционально: отправьте ошибку в Discord
        await message.reply('Ошибка связи с сервером. Попробуйте позже.');
    }
}

// Обработчик событий: когда бот готов
client.once('clientReady', () => {
    console.log(`Бот ${client.user.tag} запущен и готов к работе!`);
});

// Обработчик сообщений
client.on('messageCreate', async (message) => {
    // Игнорируем сообщения от ботов и свои собственные
    if (message.author.bot || message.author.id === client.user.id) return;

    // Игнорируем команды (если начинается с '!')
    if (message.content.startsWith('!')) return;

    // Отправляем только текстовые сообщения (или с attachments)
    if (message.content || message.attachments.size > 0) {
        await sendToLaravel(message);
    }
});

// Логин бота
client.login(TOKEN).catch(console.error);
