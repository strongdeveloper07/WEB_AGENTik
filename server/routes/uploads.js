const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  const uploads = db.prepare(`
    SELECT u.id, u.agent_uid, u.filename, u.stored_as, u.size, u.uploaded_at,
           u.patient_id, p.fullname AS patient_name
    FROM uploads u
    LEFT JOIN patients p ON u.patient_id = p.id
    ORDER BY u.uploaded_at DESC
  `).all();
  res.json({ uploads });
});

router.get('/patient/:patient_id', authenticateToken, (req, res) => {
  const uploads = db.prepare(`
    SELECT id, filename, stored_as, size, uploaded_at
    FROM uploads WHERE patient_id = ?
    ORDER BY uploaded_at DESC
  `).all(req.params.patient_id);
  res.json({ uploads });
});

router.get('/:id/file', authenticateToken, (req, res) => {
  const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(req.params.id);
  if (!upload) return res.status(404).json({ error: 'Файл не найден' });
  const filePath = path.join(__dirname, '../uploads', upload.stored_as);
  res.download(filePath, upload.filename);
});

router.patch('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { patient_id } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'Укажите patient_id' });
  const upload = db.prepare('SELECT id FROM uploads WHERE id = ?').get(id);
  if (!upload) return res.status(404).json({ error: 'Файл не найден' });
  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patient_id);
  if (!patient) return res.status(404).json({ error: 'Пациент не найден' });
  db.prepare('UPDATE uploads SET patient_id = ? WHERE id = ?').run(patient_id, id);
  res.json({ status: 'ok' });
});

module.exports = router;