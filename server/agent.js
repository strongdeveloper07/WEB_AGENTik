require('dotenv').config();
const axios = require('axios');

const CONFIG = {
  UID: 'sviat-008',
  descr: 'web-agentik1',
  access_code: '57756a-4310-f6f0-26fe-17fe4ea9',
  server: 'https://xdev.arkcom.ru:9999/app/webagent1/api',
  interval: 10000 
};

async function getTask() {
  try {
    const res = await axios.post(`${CONFIG.server}/wa_task/`, {
      UID: CONFIG.UID,
      descr: CONFIG.descr,
      access_code: CONFIG.access_code
    });
    return res.data;
  } catch (e) {
    console.error('Ошибка запроса задания:', e.message);
    return null;
  }
}

async function sendResult(session_id, result_data) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('result_code', '0');
    form.append('result', JSON.stringify({
      UID: CONFIG.UID,
      access_code: CONFIG.access_code,
      message: 'задание выполнено',
      files: 0,
      session_id: session_id
    }));

    const res = await axios.post(`${CONFIG.server}/wa_result/`, form, {
      headers: form.getHeaders()
    });
    console.log('Результат отправлен:', res.data);
  } catch (e) {
    console.error('Ошибка отправки результата:', e.message);
  }
}

async function handleTask(task) {
  console.log('Получено задание:', task);

  switch (task.task_code) {
    case 'CONF':
      console.log('Задача: изменить конфигурацию, опции:', task.options);
      await sendResult(task.session_id, {});
      break;

    default:
      console.log('Неизвестный task_code:', task.task_code);
  }
}

async function poll() {
  console.log('Опрос сервера...');
  const task = await getTask();

  if (task && task.status === 'RUN') {
    await handleTask(task);
  } else {
    console.log('Нет задания, ждём...');
  }
}

setInterval(poll, CONFIG.interval);
poll();
