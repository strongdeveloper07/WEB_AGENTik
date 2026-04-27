const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// регистрация агента
router.post('/register', (req, res) => {
  const { uid, platform, hostname, version } = req.body;

  if (!uid || !platform || !hostname || !version) {
    return res.status(400).json({ error: 'Не хватает полей: uid, platform, hostname, version' });
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  const sessionToken = jwt.sign({ uid, type: 'agent' }, JWT_SECRET);

  db.prepare(`
    INSERT INTO agents (uid, platform, hostname, version, session_token, last_seen)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(uid) DO UPDATE SET
      platform=excluded.platform,
      hostname=excluded.hostname,
      version=excluded.version,
      session_token=excluded.session_token,
      last_seen=CURRENT_TIMESTAMP,
      status='online'
  `).run(uid, platform, hostname, version, sessionToken);

  // автоматически создаём запись кардиографа если ещё нет
  const existing = db.prepare('SELECT id FROM cardiographs WHERE agent_uid = ?').get(uid);
  if (!existing) {
    db.prepare('INSERT INTO cardiographs (agent_uid, name) VALUES (?, ?)').run(uid, uid);
  }

  const cardiograph = db.prepare('SELECT id FROM cardiographs WHERE agent_uid = ?').get(uid);

  res.json({
    status: 'ok',
    session_token: sessionToken,
    cardiograph_id: cardiograph.id,
    poll_interval: parseInt(process.env.POLL_INTERVAL) || 10
  });
});

// агент запрашивает список задач
router.get('/:uid/tasks', (req, res) => {
  const { uid } = req.params;
  db.prepare('UPDATE agents SET last_seen = CURRENT_TIMESTAMP WHERE uid = ?').run(uid);

  const tasks = db.prepare(`
    SELECT id, type, payload FROM tasks
    WHERE agent_uid = ? AND status = 'pending'
    ORDER BY created_at ASC
  `).all(uid);

  res.json({ tasks: tasks.map(t => ({
    id: t.id,
    type: t.type,
    payload: t.payload ? JSON.parse(t.payload) : null
  }))});
});

// агент присылает результат задачи
router.post('/:uid/results', (req, res) => {
  const { uid } = req.params;
  const { task_id, status, result } = req.body;

  if (!task_id || !status) {
    return res.status(400).json({ error: 'Нужны task_id и status' });
  }

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND agent_uid = ?').get(task_id, uid);
  if (!task) return res.status(404).json({ error: 'Задача не найдена' });

  db.prepare(`
    UPDATE tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, result ? JSON.stringify(result) : null, task_id);

  res.json({ status: 'ok' });
});

// загрузка агентом файла
router.post('/:uid/upload', upload.single('file'), (req, res) => {
  const { uid } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Файл не приложен (поле: file)' });

  db.prepare(`
    INSERT INTO uploads (agent_uid, filename, stored_as, size)
    VALUES (?, ?, ?, ?)
  `).run(uid, req.file.originalname, req.file.filename, req.file.size);

  res.json({ status: 'ok', filename: req.file.originalname, size: req.file.size });
});

// создание задачи для агента
router.post('/:uid/tasks', authenticateToken, (req, res) => {
  const { uid } = req.params;
  const { type, payload } = req.body;
  if (!type) return res.status(400).json({ error: 'Укажите type задачи' });

  const agent = db.prepare('SELECT uid FROM agents WHERE uid = ?').get(uid);
  if (!agent) return res.status(404).json({ error: 'Агент не найден' });

  const result = db.prepare(`
    INSERT INTO tasks (agent_uid, type, payload) VALUES (?, ?, ?)
  `).run(uid, type, payload ? JSON.stringify(payload) : null);

  res.status(201).json({ status: 'ok', task_id: result.lastInsertRowid });
});

// список всех агентов с кардиографами
router.get('/', authenticateToken, (req, res) => {
  const agents = db.prepare(`
    SELECT a.uid, a.platform, a.hostname, a.version, a.status, a.last_seen,
           c.id AS cardiograph_id, c.name AS cardiograph_name
    FROM agents a
    LEFT JOIN cardiographs c ON c.agent_uid = a.uid
    ORDER BY a.last_seen DESC
  `).all();
  res.json({ agents });
});

// история задач
router.get('/:uid/history', authenticateToken, (req, res) => {
  const { uid } = req.params;
  const tasks = db.prepare(`
    SELECT id, type, status, result, created_at, updated_at
    FROM tasks WHERE agent_uid = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(uid);
  res.json({ tasks });
});

// список всех кардиографов
router.get('/cardiographs/list', authenticateToken, (req, res) => {
  const list = db.prepare(`
    SELECT c.id, c.name, c.agent_uid, a.status, a.last_seen
    FROM cardiographs c
    LEFT JOIN agents a ON a.uid = c.agent_uid
    ORDER BY c.id ASC
  `).all();
  res.json({ cardiographs: list });
});

// переименовать кардиограф
router.patch('/cardiographs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите name' });

  const cg = db.prepare('SELECT id FROM cardiographs WHERE id = ?').get(id);
  if (!cg) return res.status(404).json({ error: 'Кардиограф не найден' });

  db.prepare('UPDATE cardiographs SET name = ? WHERE id = ?').run(name.trim(), id);
  res.json({ status: 'ok' });
});

module.exports = router;