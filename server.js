// server.js - МИНИМАЛЬНЫЙ СЕРВЕР ДЛЯ ТЕСТА
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('✅ Сервер работает!');
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});