// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ============================================
// БАЗА ДАННЫХ (в памяти, но можно сохранять в файл)
// ============================================

const players = {};

// Функция для создания простого токена
function generateToken() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

// ============================================
// 1️⃣ РЕГИСТРАЦИЯ
// ============================================
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Проверяем что логин и пароль есть
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Логин и пароль обязательны'
            });
        }
        
        // Проверяем что логин не занят
        if (players[username]) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким именем уже существует'
            });
        }
        
        // Создаем игрока
        players[username] = {
            username: username,
            password: password, // В реальном проекте нужно хешировать!
            slots: [null, null, null, null, null],
            createdAt: new Date().toISOString()
        };
        
        const token = generateToken();
        
        console.log(`✅ Зарегистрирован: ${username}`);
        
        res.json({
            success: true,
            playerId: username,
            playerName: username,
            sessionToken: token,
            slots: players[username].slots,
            message: 'Регистрация успешна!'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// 2️⃣ ВХОД (ЛОГИН)
// ============================================
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Проверяем что логин и пароль есть
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Логин и пароль обязательны'
            });
        }
        
        // Ищем игрока
        const player = players[username];
        
        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        // Проверяем пароль
        if (player.password !== password) {
            return res.status(401).json({
                success: false,
                error: 'Неверный пароль'
            });
        }
        
        const token = generateToken();
        
        console.log(`✅ Вход: ${username}`);
        
        res.json({
            success: true,
            playerId: username,
            playerName: username,
            sessionToken: token,
            slots: player.slots,
            message: 'Вход выполнен!'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// 3️⃣ СОХРАНИТЬ СЛОТЫ
// ============================================
app.post('/api/player/slots', (req, res) => {
    try {
        const { username, slots } = req.body;
        const player = players[username];
        
        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }
        
        if (!Array.isArray(slots) || slots.length !== 5) {
            return res.status(400).json({
                success: false,
                error: 'Должно быть 5 слотов'
            });
        }
        
        player.slots = slots;
        console.log(`💾 Сохранены слоты для ${username}:`, slots);
        
        res.json({
            success: true,
            message: 'Слоты сохранены'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// 4️⃣ ПОЛУЧИТЬ ДАННЫЕ ИГРОКА
// ============================================
app.get('/api/player/:username', (req, res) => {
    try {
        const { username } = req.params;
        const player = players[username];
        
        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }
        
        res.json({
            success: true,
            playerId: username,
            playerName: username,
            slots: player.slots
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// 5️⃣ ВСЕ ИГРОКИ (для отладки)
// ============================================
app.get('/api/debug/players', (req, res) => {
    const list = Object.keys(players).map(username => ({
        username,
        slots: players[username].slots
    }));
    res.json(list);
});

// ============================================
// 6️⃣ ПРОВЕРКА ЗДОРОВЬЯ
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        players: Object.keys(players).length,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 7️⃣ КОРНЕВОЙ
// ============================================
app.get('/', (req, res) => {
    res.send('✅ Сервер работает!');
});

// ============================================
// ЗАПУСК
// ============================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
