const service = 'https://teens.make-it.kz/api';
const storage = 'u-epxhsudv';
const modelApi = `${service}/model3d/${storage}`;
const previewForm = document.querySelector('#preview-form');
const modelForm = document.querySelector('#model-form');
const previewStatus = document.querySelector('#preview-status');
const modelStatus = document.querySelector('#model-status');
const preview = document.querySelector('#preview');
const result = document.querySelector('#model-result');
let imageId;
let downloadUrl;

function fileUrl(value) {
  const url = new URL(/^https:\/\//i.test(value)
    ? value
    : `${service}/files/${storage}/${encodeURIComponent(value)}`);
  if (url.origin !== 'https://teens.make-it.kz') throw new Error('Неизвестный адрес файла.');
  return url;
}

function clearModel() {
  result.replaceChildren();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
  modelStatus.textContent = '';
}

previewForm.addEventListener('submit', async event => {
  event.preventDefault();
  const text = document.querySelector('#description').value.trim();
  if (!text) return;
  previewForm.querySelector('button').disabled = true;
  modelForm.hidden = true;
  preview.hidden = true;
  preview.removeAttribute('src');
  imageId = undefined;
  clearModel();
  previewStatus.textContent = 'Создаю картинку…';
  try {
    const response = await fetch(`${service}/preview/${storage}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: window.PREVIEW_INSTRUCTION, text })
    });
    const data = await response.json();
    if (response.status === 429) throw new Error('Лимит картинок на сегодня исчерпан.');
    if (!response.ok || !data.id || data.error === 'skip' || data.result?.error === 'skip') {
      throw new Error('Картинка не получилась. Попробуй изменить описание.');
    }
    imageId = data.id;
    preview.src = fileUrl(data.url || imageId);
    preview.hidden = false;
    modelForm.hidden = false;
    previewStatus.textContent = 'Картинка готова.';
  } catch (error) {
    previewStatus.textContent = error instanceof TypeError ? 'Нет связи с сервисом.' : error.message;
  } finally {
    previewForm.querySelector('button').disabled = false;
  }
});

preview.addEventListener('error', () => {
  preview.hidden = true;
  previewStatus.textContent = 'Картинка создана, но её не удалось показать.';
});

modelForm.addEventListener('submit', async event => {
  event.preventDefault();
  const owner = document.querySelector('#owner');
  const code = owner.value.trim();
  if (!imageId || !code) return;
  owner.value = '';
  const headers = { 'X-Owner': code };
  const buttons = [previewForm.querySelector('button'), modelForm.querySelector('button')];
  buttons.forEach(button => { button.disabled = true; });
  clearModel();
  modelStatus.textContent = 'Создаю 3D-модель…';
  try {
    const response = await fetch(modelApi, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageId }),
      redirect: 'error'
    });
    if (response.status === 403) throw new Error('Проверь код владельца.');
    if (response.status === 429) throw new Error('Лимит 3D-моделей на сегодня исчерпан.');
    const data = await response.json();
    if (!response.ok || !data.ok || !data.job) throw new Error('Не удалось запустить генерацию.');

    for (let attempt = 0; attempt < 180; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const poll = await fetch(`${modelApi}/${encodeURIComponent(data.job)}`, { headers, redirect: 'error' });
      if (!poll.ok) throw new Error('Не удалось проверить состояние модели.');
      const job = await poll.json();
      if (job.status === 'failed') throw new Error('Модель не получилась. Попробуй другую картинку.');
      if (!job.stl) continue;

      const file = await fetch(fileUrl(job.stl), { headers, redirect: 'error' });
      if (!file.ok) throw new Error('Не удалось скачать файл модели.');
      downloadUrl = URL.createObjectURL(await file.blob());
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'фигурка.stl';
      link.textContent = 'Скачать STL';
      result.append(link);
      modelStatus.textContent = 'Модель готова.';
      return;
    }
    throw new Error('Генерация занимает слишком много времени.');
  } catch (error) {
    modelStatus.textContent = error instanceof TypeError ? 'Нет связи с сервисом.' : error.message;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
});
