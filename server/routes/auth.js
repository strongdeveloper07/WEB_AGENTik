const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// регистрация врача
router.post('/register', (req, res) => {
  const {
    fullname,
    login,
    password,
    polis,
    phone,
    email,
    birthDate,
    passport,
    clinic
  } = req.body;

  if (!fullname || !login || !password || !polis) {
    return res.status(400).json({ error: 'Укажите fullname, login, password, polis' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    db.prepare(`
      INSERT INTO users (fullname, login, password, polis, phone, email, birth_date, passport, clinic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullname,
      login,
      hashedPassword,
      polis,
      phone || null,
      email || null,
      birthDate || null,
      passport || null,
      clinic || null
    );

    res.status(201).json({ status: 'ok', message: 'Пользователь создан' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Пользователь с таким логином или полисом уже существует' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// логин врача
router.post('/login', (req, res) => {
  const { login, password, polis } = req.body;

  if (!login || !password || !polis) {
    return res.status(400).json({ error: 'Укажите login, password и polis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);

  if (!user) {
    return res.status(401).json({ error: 'Пользователь с таким логином не найден' });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  if (user.polis !== polis) {
    return res.status(401).json({ error: 'Неверный номер полиса' });
  }

  // В токен кладём id, login, fullname
  const token = jwt.sign(
    { id: user.id, login: user.login, fullname: user.fullname },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    status: 'ok',
    access_token: token,
    user: {
      id: user.id,
      fullname: user.fullname,
      login: user.login,
      device_id: user.device_id || null
    }
  });
});

// привязка устройства
router.post('/bind-device', authenticateToken, (req, res) => {
  const { device_id } = req.body;
  if (!device_id) {
    return res.status(400).json({ error: 'Укажите device_id' });
  }

  db.prepare('UPDATE users SET device_id = ? WHERE id = ?')
    .run(device_id, req.user.id);

  res.json({ status: 'ok', device_id });
});

// данные текущего пользователя
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare(
    'SELECT id, fullname, login, device_id, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  res.json(user);
});

module.exports = router;