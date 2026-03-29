const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// список пациентов врача
router.get('/', authenticateToken, (req, res) => {
  const patients = db.prepare(
    'SELECT * FROM patients WHERE doctor_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json({ patients });
});

// добавить пациента
router.post('/', authenticateToken, (req, res) => {
  const { fullname, phone, polis, clinic } = req.body;

  if (!fullname || !phone || !polis || !clinic) {
    return res.status(400).json({ error: 'Укажите fullname, phone, polis, clinic' });
  }

  if (db.prepare('SELECT id FROM patients WHERE polis = ?').get(polis)) {
    return res.status(409).json({ error: 'Пациент с таким полисом уже существует' });
  }

  const result = db.prepare(`
    INSERT INTO patients (doctor_id, fullname, phone, polis, clinic)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, fullname, phone, polis, clinic);

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ status: 'ok', patient });
});

// досье пациента
router.get('/:id', authenticateToken, (req, res) => {
  const patient = db.prepare(
    'SELECT * FROM patients WHERE id = ? AND doctor_id = ?'
  ).get(req.params.id, req.user.id);

  if (!patient) return res.status(404).json({ error: 'Пациент не найден' });
  res.json(patient);
});

// обновить пациента
router.put('/:id', authenticateToken, (req, res) => {
  const { fullname, phone, polis, clinic, blood_type, allergies, chronic_diseases, photo } = req.body;

  if (!db.prepare('SELECT id FROM patients WHERE id = ? AND doctor_id = ?').get(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Пациент не найден' });
  }

  db.prepare(`
    UPDATE patients SET
      fullname=?, phone=?, polis=?, clinic=?,
      blood_type=?, allergies=?, chronic_diseases=?, photo=?
    WHERE id=?
  `).run(fullname, phone, polis, clinic,
         blood_type || null, allergies || null, chronic_diseases || null, photo || null,
         req.params.id);

  res.json({ status: 'ok', patient: db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id) });
});

// зафиксировать визит
router.post('/:id/visit', authenticateToken, (req, res) => {
  if (!db.prepare('SELECT id FROM patients WHERE id = ? AND doctor_id = ?').get(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Пациент не найден' });
  }

  const today = new Date().toLocaleDateString('ru-RU');
  db.prepare('UPDATE patients SET last_visit=?, total_visits=total_visits+1 WHERE id=?').run(today, req.params.id);
  db.prepare('INSERT INTO visits (patient_id) VALUES (?)').run(req.params.id);

  res.json({ status: 'ok', last_visit: today });
});

module.exports = router;