
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// регистрация
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Укажите username или password' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const stmt = db.prepare(
      'INSERT INTO users (username, password) VALUES (?, ?)'
    );
    stmt.run(username, hashedPassword);
    res.status(201).json({ status: 'ok', message: 'Пользователь создан' });
  } catch (err) {
    res.status(409).json({ error: 'Пользователь уже существует' });
  }
});

// вход
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  // время действия токена: 8 часов
  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    status: 'ok',
    access_token: token,
    device_id: user.device_id || null
  });
});

// привязка кардиографа к аккаунту
router.post('/bind-device', authenticateToken, (req, res) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: 'Укажите device_id' });
  }

  db.prepare('UPDATE users SET device_id = ? WHERE id = ?')
    .run(device_id, req.user.id);

  res.json({ status: 'ok', device_id });
});

router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, device_id, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  res.json(user);
});

module.exports = router;
