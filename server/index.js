require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const agentsRouter = require('./routes/agents');
const authRouter = require('./routes/auth');

app.use('/api/v1/agents', require('./routes/agents'));
app.use('/api/v1/auth',   require('./routes/auth'));
app.use('/api/v1/patients', require('./routes/patients'));
app.use('/api/v1/uploads', require('./routes/uploads'));

app.use(express.static(path.join(__dirname, '../web')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../web/index.html')));

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api/v1/`);
});
