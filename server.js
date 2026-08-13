// server.js - с поддержкой Supabase (PostgreSQL)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// ПОДКЛЮЧЕНИЕ К SUPABASE (PostgreSQL)
// ============================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Важно для Supabase
    }
});

// ============================================
// СОЗДАНИЕ ТАБЛИЦ (если их нет)
// ============================================

async function initDatabase() {
    try {
        // Таблица игроков
        await pool.query(`
            CREATE TABLE IF NOT EXISTS players (
                username VARCHAR(50) PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
                slots JSONB DEFAULT '["","","","",""]'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Таблицы созданы/проверены');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
    }
}

initDatabase();

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

        // Проверяем существует ли пользователь
        const checkResult = await pool.query(
            'SELECT username FROM players WHERE username = $1',
            [username]
        );

        if (checkResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким именем уже существует'
            });
        }

        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Сохраняем в БД
        await pool.query(
            'INSERT INTO players (username, password_hash) VALUES ($1, $2)',
            [username, hashedPassword]
        );

        const token = generateToken();

        console.log(`✅ Зарегистрирован: ${username}`);

        res.json({
            success: true,
            playerId: username,
            playerName: username,
            sessionToken: token,
            slots: [null, null, null, null, null],
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

        // Ищем пользователя
        const result = await pool.query(
            'SELECT * FROM players WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        const player = result.rows[0];

        // Проверяем пароль
        const isPasswordValid = await bcrypt.compare(password, player.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Неверный пароль'
            });
        }

        const token = generateToken();

        // Получаем слоты (JSONB → массив)
        const slots = player.slots || [null, null, null, null, null];

        console.log(`✅ Вход: ${username}`);

        res.json({
            success: true,
            playerId: username,
            playerName: username,
            sessionToken: token,
            slots: slots,
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

app.post('/api/player/slots', async (req, res) => {
    try {
        const { username, slots } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Имя пользователя обязательно'
            });
        }

        if (!Array.isArray(slots) || slots.length !== 5) {
            return res.status(400).json({
                success: false,
                error: 'Должно быть ровно 5 слотов'
            });
        }

        // Проверяем что игрок существует
        const checkResult = await pool.query(
            'SELECT username FROM players WHERE username = $1',
            [username]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }

        // Сохраняем слоты
        await pool.query(
            'UPDATE players SET slots = $1::jsonb WHERE username = $2',
            [JSON.stringify(slots), username]
        );

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

app.get('/api/player/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const result = await pool.query(
            'SELECT username, slots FROM players WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }

        const player = result.rows[0];
        const slots = player.slots || [null, null, null, null, null];

        res.json({
            success: true,
            playerId: username,
            playerName: username,
            slots: slots
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

app.get('/api/debug/players', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT username, slots, created_at FROM players'
        );
        res.json({
            success: true,
            count: result.rows.length,
            players: result.rows
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

app.delete('/api/debug/player/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const result = await pool.query(
            'DELETE FROM players WHERE username = $1 RETURNING username',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Игрок не найден'
            });
        }

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

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM players');
        res.json({
            status: 'OK',
            players: parseInt(result.rows[0].count),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
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
    console.log(`📡 Внешний: https://war-rts-server.onrender.com`);
    console.log('═══════════════════════════════════════');
    console.log('📋 Эндпоинты:');
    console.log(`  POST /api/auth/register    - Регистрация`);
    console.log(`  POST /api/auth/login       - Вход`);
    console.log(`  POST /api/player/slots     - Сохранить слоты`);
    console.log(`  GET  /api/player/:username - Данные игрока`);
    console.log(`  GET  /api/health           - Проверка здоровья`);
    console.log(`  GET  /api/debug/players    - Все игроки`);
    console.log(`  DEL  /api/debug/player/:username - Удалить игрока`);
    console.log('═══════════════════════════════════════');
    console.log(`🗄️  База данных: Supabase (PostgreSQL)`);
    console.log('═══════════════════════════════════════');
});
