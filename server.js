// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// НАСТРОЙКА БАЗЫ ДАННЫХ (JSON файл)
// ============================================

const DB_PATH = path.join(__dirname, 'database.json');

// Загрузка базы данных
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки БД:', error);
    }
    return { players: {} };
}

// Сохранение базы данных
function saveDatabase() {
    try {
        const data = { players: playersDB };
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        console.log('💾 База данных сохранена');
    } catch (error) {
        console.error('❌ Ошибка сохранения БД:', error);
    }
}

// Загружаем базу данных
let playersDB = loadDatabase().players;

// Авто-сохранение каждые 10 секунд
setInterval(saveDatabase, 10000);

// Сохраняем при изменении важных данных
function updateAndSave(username, data) {
    playersDB[username] = data;
    saveDatabase();
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function generateToken() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

// ============================================
// 1️⃣ РЕГИСТРАЦИЯ
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Логин и пароль обязательны'
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Логин должен быть не менее 3 символов'
            });
        }

        if (password.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Пароль должен быть не менее 3 символов'
            });
        }

        if (playersDB[username]) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким именем уже существует'
            });
        }

        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newPlayer = {
            username: username,
            password: hashedPassword,
            slots: [null, null, null, null, null],
            createdAt: new Date().toISOString()
        };

        playersDB[username] = newPlayer;
        saveDatabase();

        const token = generateToken();

        console.log(`✅ Зарегистрирован: ${username}`);

        res.json({
            success: true,
            playerId: username,
            playerName: username,
            sessionToken: token,
            slots: newPlayer.slots,
            message: 'Регистрация успешна!'
        });

    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        });
    }
});

// ============================================
// 2️⃣ ВХОД
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Логин и пароль обязательны'
            });
        }

        const player = playersDB[username];

        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Проверяем пароль
        const isPasswordValid = await bcrypt.compare(password, player.password);

        if (!isPasswordValid) {
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
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        });
    }
});

// ============================================
// 3️⃣ СОХРАНИТЬ СЛОТЫ
// ============================================

app.post('/api/player/slots', (req, res) => {
    try {
        const { username, slots } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Имя пользователя обязательно'
            });
        }

        const player = playersDB[username];

        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }

        if (!Array.isArray(slots) || slots.length !== 5) {
            return res.status(400).json({
                success: false,
                error: 'Должно быть ровно 5 слотов'
            });
        }

        player.slots = slots;
        saveDatabase();

        console.log(`💾 Сохранены слоты для ${username}:`, slots);

        res.json({
            success: true,
            message: 'Слоты сохранены'
        });

    } catch (error) {
        console.error('❌ Ошибка сохранения слотов:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        });
    }
});

// ============================================
// 4️⃣ ПОЛУЧИТЬ ДАННЫЕ ИГРОКА
// ============================================

app.get('/api/player/:username', (req, res) => {
    try {
        const { username } = req.params;
        const player = playersDB[username];

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
        console.error('❌ Ошибка получения данных:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        });
    }
});

// ============================================
// 5️⃣ ВСЕ ИГРОКИ (для отладки)
// ============================================

app.get('/api/debug/players', (req, res) => {
    try {
        const list = Object.keys(playersDB).map(username => ({
            username,
            slots: playersDB[username].slots,
            createdAt: playersDB[username].createdAt
        }));
        res.json({
            success: true,
            count: list.length,
            players: list
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// 6️⃣ УДАЛИТЬ ИГРОКА (для отладки)
// ============================================

app.delete('/api/debug/player/:username', (req, res) => {
    try {
        const { username } = req.params;
        
        if (!playersDB[username]) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }

        delete playersDB[username];
        saveDatabase();

        res.json({
            success: true,
            message: `Игрок ${username} удален`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// 7️⃣ ПРОВЕРКА ЗДОРОВЬЯ
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        players: Object.keys(playersDB).length,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 8️⃣ КОРНЕВОЙ ЭНДПОИНТ
// ============================================

app.get('/', (req, res) => {
    res.send('✅ Сервер работает!');
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════');
    console.log('🚀 WAR RTS СЕРВЕР ЗАПУЩЕН!');
    console.log(`📡 Порт: ${PORT}`);
    console.log(`📡 Локально: http://localhost:${PORT}`);
    console.log(`📡 Внешний: https://war-rts-server.onrender.com`);
    console.log('═══════════════════════════════════════');
    console.log('📋 Эндпоинты:');
    console.log(`  POST /api/auth/register    - Регистрация`);
    console.log(`  POST /api/auth/login       - Вход`);
    console.log(`  POST /api/player/slots     - Сохранить слоты`);
    console.log(`  GET  /api/player/:username - Данные игрока`);
    console.log(`  GET  /api/health           - Проверка здоровья`);
    console.log(`  GET  /api/debug/players    - Все игроки (отладка)`);
    console.log(`  DEL  /api/debug/player/:username - Удалить игрока`);
    console.log('═══════════════════════════════════════');
    console.log(`💾 База данных: ${DB_PATH}`);
    console.log(`👥 Игроков в БД: ${Object.keys(playersDB).length}`);
    console.log('═══════════════════════════════════════');
});
