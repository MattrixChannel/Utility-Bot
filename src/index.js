require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

client.on('clientReady', (c) => {
    console.log(`${c.user.tag} is online`)
})

client.on('messageCreate', (message) => {
    console.log(message);
    sendJson(message);
})

client.login(process.env.token);


const http = require('http');
const fs = require('fs');

const optionsPost = {
    hostname: 'localhost',
    port: 8000,
    path: '/server.php',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Функция для отправки JSON
const sendJson = (json) => {
    const reqPost = http.request(optionsPost, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('Ответ от сервера (POST):', JSON.parse(data));
        });
    });

    reqPost.on('error', (e) => {
        console.error(`Проблема с запросом: ${e.message}`);
    });

    // Отправляем данные
    reqPost.write(JSON.stringify(json));
    reqPost.end();
};

// Чтение из файла или получение JSON из аргументов командной строки
const input = "{\"content\": \"pong\"}";

if (input) {
    try {
        // Если аргумент - это файл
        if (fs.existsSync(input)) {
            const jsonData = fs.readFileSync(input);
            const jsonObject = JSON.parse(jsonData);
            sendJson(jsonObject);
        } else {
            // Пытаться распарсить как JSON строку
            const jsonObject = JSON.parse(input);
            sendJson(jsonObject);
        }
    } catch (error) {
        console.error('Ошибка при обработке JSON:', error.message);
    }
} else {
    console.error('Пожалуйста, передайте JSON или путь к файлу JSON в качестве аргумента.');
}
