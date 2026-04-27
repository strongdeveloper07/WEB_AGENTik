const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// все загрузки с данными кардиографа, видимые врачу
router.get('/', authenticateToken, (req, res) => {
  const doctorId = req.user.id;

  const uploads = db.prepare(`
    SELECT
      u.id,
      u.agent_uid,
      u.filename,
      u.stored_as,
      u.size,
      u.uploaded_at,
      u.patient_id,
      p.fullname AS patient_name,
      c.id  AS cardiograph_id,
      c.name AS cardiograph_name
    FROM uploads u
    LEFT JOIN patients p    ON u.patient_id = p.id
    LEFT JOIN cardiographs c ON c.agent_uid = u.agent_uid
    WHERE
      p.doctor_id = ?      -- файлы пациентов этого врача
      OR u.patient_id IS NULL  -- и ещё непривязанные файлы (общая корзина)
    ORDER BY u.uploaded_at DESC
  `).all(doctorId);

  res.json({ uploads });
});

// файлы конкретного пациента с данными кардиографа
router.get('/patient/:patient_id', authenticateToken, (req, res) => {
  const patientId = req.params.patient_id;

  // безопасность: проверяем, что пациент принадлежит этому врачу
  const patient = db.prepare(
    'SELECT id FROM patients WHERE id = ? AND doctor_id = ?'
  ).get(patientId, req.user.id);

  if (!patient) {
    return res.status(404).json({ error: 'Пациент не найден' });
  }

  const uploads = db.prepare(`
    SELECT
      u.id,
      u.filename,
      u.stored_as,
      u.size,
      u.uploaded_at,
      c.id   AS cardiograph_id,
      c.name AS cardiograph_name
    FROM uploads u
    LEFT JOIN cardiographs c ON c.agent_uid = u.agent_uid
    WHERE u.patient_id = ?
    ORDER BY u.uploaded_at DESC
  `).all(patientId);

  res.json({ uploads });
});

// скачать файл
router.get('/:id/file', authenticateToken, (req, res) => {
  const uploadId = req.params.id;

  // получаем файл вместе с пациентом и врачом
  const upload = db.prepare(`
    SELECT u.*, p.doctor_id
    FROM uploads u
    LEFT JOIN patients p ON u.patient_id = p.id
    WHERE u.id = ?
  `).get(uploadId);

  if (!upload) {
    return res.status(404).json({ error: 'Файл не найден' });
  }

  // если файл привязан к пациенту, проверяем, что это пациент текущего врача
  if (upload.patient_id && upload.doctor_id && upload.doctor_id !== req.user.id) {
    return res.status(403).json({ error: 'Нет доступа к этому файлу' });
  }

  const filePath = path.join(__dirname, '../uploads', upload.stored_as);
  res.download(filePath, upload.filename);
});

// привязать файл к пациенту
router.patch('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { patient_id } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Укажите patient_id' });
  }

  const upload = db.prepare('SELECT id FROM uploads WHERE id = ?').get(id);
  if (!upload) {
    return res.status(404).json({ error: 'Файл не найден' });
  }

  // пациент должен принадлежать текущему врачу
  const patient = db.prepare(
    'SELECT id FROM patients WHERE id = ? AND doctor_id = ?'
  ).get(patient_id, req.user.id);

  if (!patient) {
    return res.status(404).json({ error: 'Пациент не найден или принадлежит другому врачу' });
  }

  db.prepare('UPDATE uploads SET patient_id = ? WHERE id = ?')
    .run(patient_id, id);

  res.json({ status: 'ok' });
});

module.exports = router;