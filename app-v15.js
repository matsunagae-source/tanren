(() => {
const STORAGE_KEY = 'tanren.records.v1';
const FOODS_KEY = 'tanren.foods.v1';
const EXERCISES_KEY = 'tanren.exercises.v1';
const GOOGLE_CLIENT_ID = '303377451250-sasmmjtlbn78fi7njodngu9hntku7sve.apps.googleusercontent.com';
const SPREADSHEET_ID = '14hdbYZBBvR45W-AS9GHChg2yCeHuiNvTmZWAot9v4Hw';

const exerciseCatalog = [
  { name: 'ネガティヴ懸垂', amount: 10, unit: '回', sets: 1 },
  { name: 'デクラインプッシュアップ', amount: 20, unit: '回', sets: 3 },
  { name: 'レッグレイズ', amount: 20, unit: '回', sets: 2 },
  { name: 'バイシクルクランチ', amount: 30, unit: '回', sets: 2 },
  { name: 'ロシアンツイスト', amount: 30, unit: '回', sets: 2 },
  { name: 'ヒールタッチ', amount: 30, unit: '回', sets: 2 },
  { name: 'レッグレイズキープ', amount: 30, unit: '秒', sets: 2 },
  { name: 'ランニング', amount: 5, unit: 'km', sets: 1 },
];
const defaultFoods = ['トースト', 'プロテイン', 'コーヒー', '牛乳', 'ご飯', 'ゆで卵', 'ブロッコリー'];
let activeDate = localDate();
let mealItems = [];
let workoutItems = [];
let showAllFoods = false;
let showAllExercises = false;

const $ = (selector) => document.querySelector(selector);
const id = () => crypto.randomUUID();
function localDate(date = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date); }
function currentTime() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
function records() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveRecords(next) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); render(); }
function setSheetsStatus(message) { $('#sheetsStatus').textContent = message; }
function rowsToRecords(mealRows, workoutRows) {
  const byId = new Map();
  mealRows.forEach(([recordId, date, mealType, time, item, updatedAt]) => { if (!recordId || !date || !item) return; const record = byId.get(recordId) || { id: recordId, type: 'meal', date, mealType, time, items: [], updatedAt }; record.items.push(item); byId.set(recordId, record); });
  workoutRows.forEach(([recordId, date, time, name, amount, unit, sets, updatedAt]) => { if (!recordId || !date || !name) return; const record = byId.get(recordId) || { id: recordId, type: 'workout', date, time, items: [], updatedAt }; record.items.push({ name, amount: Number(amount), unit, sets: Number(sets) }); byId.set(recordId, record); });
  return [...byId.values()];
}
async function loadFromSheets(accessToken) {
  setSheetsStatus('スプレッドシートを読み込んでいます…');
  const ranges = ['Meals!A2:F', 'Workouts!A2:H'].map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${ranges}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('シートを読み込めませんでした。');
  const values = await response.json(); const [mealData = {}, workoutData = {}] = values.valueRanges || [];
  const imported = rowsToRecords(mealData.values || [], workoutData.values || []);
  if (!imported.length) { setSheetsStatus('読み込める記録がありません。シートに Meals・Workouts の記録を追加すると読み込めます。'); return; }
  const merged = new Map(records().map((record) => [record.id, record])); imported.forEach((record) => { const current = merged.get(record.id); if (!current || (record.updatedAt || '') >= (current.updatedAt || '')) merged.set(record.id, record); });
  saveRecords([...merged.values()]); setSheetsStatus(`${imported.length}件の記録を読み込みました。`);
}
function requestSheetsLoad() {
  if (!window.google?.accounts?.oauth2) { setSheetsStatus('Googleログインの準備中です。少し待って再度押してください。'); return; }
  const client = google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', callback: async (token) => { try { await loadFromSheets(token.access_token); } catch (error) { setSheetsStatus(error.message || '読み込み中にエラーが発生しました。'); } } });
  client.requestAccessToken({ prompt: 'consent' });
}
function foods() { return JSON.parse(localStorage.getItem(FOODS_KEY) || JSON.stringify(defaultFoods)); }
function saveFoods(next) { localStorage.setItem(FOODS_KEY, JSON.stringify([...new Set(next)])); }
function exercises() { return [...exerciseCatalog, ...JSON.parse(localStorage.getItem(EXERCISES_KEY) || '[]').filter((item) => !exerciseCatalog.some((base) => base.name === item.name))]; }
function saveExercises(next) { localStorage.setItem(EXERCISES_KEY, JSON.stringify(next)); }
function formatDate(date) { return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00`)); }
function dateBefore(days) { const date = new Date(`${localDate()}T12:00:00`); date.setDate(date.getDate() - days); return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date); }
function workoutSummary(record) { return record.items.map((item) => `${item.name} ${item.amount}${item.unit}×${item.sets}`).join('、'); }

function render() {
  $('#datePicker').value = activeDate;
  const dayRecords = records().filter((r) => r.date === activeDate).sort((a, b) => a.time.localeCompare(b.time));
  $('#recordCount').textContent = dayRecords.length ? `${dayRecords.length}件` : '';
  const root = $('#records'); root.innerHTML = '';
  if (!dayRecords.length) { root.append($('#emptyTemplate').content.cloneNode(true)); return; }
  dayRecords.forEach((record) => {
    const card = document.createElement('article'); card.className = 'record-card';
    const summary = record.type === 'meal' ? record.items.join('、') : workoutSummary(record);
    card.innerHTML = `<div class="record-time">${record.time}</div><div class="record-content"><div class="record-kind">${record.type === 'meal' ? record.mealType : 'トレーニング'}</div><div class="record-summary">${summary}</div></div><button class="record-menu" aria-label="編集" data-edit="${record.id}">⋯</button>`;
    root.append(card);
  });
}
function renderTrainingHistory() {
  const allWorkouts = records().filter((record) => record.type === 'workout');
  const today = localDate();
  const renderDays = (root, dates, emptyText) => {
    root.innerHTML = '';
    const groups = dates.map((date) => ({ date, items: allWorkouts.filter((record) => record.date === date) })).filter((group) => group.items.length);
    if (!groups.length) { root.innerHTML = `<p class="training-empty">${emptyText}</p>`; return; }
    groups.forEach((group) => {
      const card = document.createElement('article'); card.className = 'training-day';
      card.innerHTML = `<h3>${formatDate(group.date)}</h3><p class="training-summary">${group.items.map(workoutSummary).join('、')}</p>`;
      root.append(card);
    });
  };
  renderDays($('#todayTraining'), [today], '今日はまだトレーニングを記録していません。');
  renderDays($('#recentTraining'), Array.from({ length: 30 }, (_, index) => dateBefore(index + 1)), '最近30日間のトレーニング記録はありません。');
}
function renderMealHistory() {
  const allMeals = records().filter((record) => record.type === 'meal');
  const today = localDate();
  const renderDays = (root, dates, emptyText) => {
    root.innerHTML = '';
    const groups = dates.map((date) => ({ date, items: allMeals.filter((record) => record.date === date) })).filter((group) => group.items.length);
    if (!groups.length) { root.innerHTML = `<p class="training-empty">${emptyText}</p>`; return; }
    groups.forEach((group) => {
      const card = document.createElement('article'); card.className = 'training-day';
      const order = ['朝食', '昼食', '夕食', '間食'];
      const byType = order.map((mealType) => ({ mealType, items: group.items.filter((meal) => meal.mealType === mealType) })).filter((meal) => meal.items.length);
      const summary = byType.map((meal) => `${meal.mealType}：${[...new Set(meal.items.flatMap((record) => record.items))].join('、')}`).join('／');
      card.innerHTML = `<h3>${formatDate(group.date)}</h3><p class="training-summary">${summary}</p>`;
      root.append(card);
    });
  };
  renderDays($('#todayMeals'), [today], '今日はまだ食事を記録していません。');
  renderDays($('#recentMeals'), Array.from({ length: 30 }, (_, index) => dateBefore(index + 1)), '最近30日間の食事記録はありません。');
}
function showView(viewId) { document.querySelectorAll('main.app-shell').forEach((view) => { view.hidden = view.id !== viewId; }); window.scrollTo(0, 0); }
function showHistory() { showView('historyView'); renderTrainingHistory(); }
function showMealHistory() { showView('mealHistoryView'); renderMealHistory(); }
function showRecord() { showView(''); }

function openMeal(mealType, existing) {
  showAllFoods = false;
  $('#mealForm').reset(); mealItems = existing ? [...existing.items] : [];
  $('#mealId').value = existing?.id || ''; $('#mealType').value = existing?.mealType || mealType; $('#mealTime').value = existing?.time || currentTime();
  $('#mealDialogTitle').textContent = existing ? '食事を編集' : `${mealType}を記録`;
  $('#deleteMealButton').hidden = !existing;
  renderMealChoices(); $('#mealDialog').showModal();
}
function renderMealChoices() {
  const root = $('#foodSuggestions'); root.innerHTML = '';
  const choices = foods().filter((food) => !mealItems.includes(food)).slice(0, showAllFoods ? 30 : 12);
  choices.forEach((food) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = `＋ ${food}`; b.onclick = () => { mealItems.push(food); renderMealChoices(); }; root.append(b); });
  $('#moreFoodsButton').hidden = showAllFoods || foods().filter((food) => !mealItems.includes(food)).length <= 12;
  const selected = $('#selectedFoods'); selected.innerHTML = '';
  mealItems.forEach((food, index) => { const item = document.createElement('div'); item.className = 'selected-item'; item.innerHTML = `<span>${food}</span><button class="remove-button" type="button" aria-label="${food}を削除">×</button>`; item.querySelector('button').onclick = () => { mealItems.splice(index, 1); renderMealChoices(); }; selected.append(item); });
}
function addFood() { const input = $('#foodInput'); const name = input.value.trim(); if (!name || mealItems.includes(name)) return; mealItems.push(name); input.value = ''; renderMealChoices(); }

function openWorkout(existing) {
  showAllExercises = false;
  $('#workoutForm').reset(); workoutItems = existing ? structuredClone(existing.items) : [];
  $('#workoutEditId').value = existing?.id || ''; $('#workoutTime').value = existing?.time || currentTime(); $('#workoutDialogTitle').textContent = existing ? 'トレーニングを編集' : 'トレーニングを記録'; $('#deleteWorkoutButton').hidden = !existing; renderWorkoutChoices(); $('#workoutDialog').showModal();
}
function addExercise() {
  const name = $('#customExerciseName').value.trim();
  const amount = Number($('#customExerciseAmount').value);
  const unit = $('#customExerciseUnit').value;
  const sets = Number($('#customExerciseSets').value) || 1;
  if (!name || Number.isNaN(amount) || amount <= 0) return;
  workoutItems.push({ name, amount, unit, sets });
  if (!exercises().some((exercise) => exercise.name === name)) saveExercises([...JSON.parse(localStorage.getItem(EXERCISES_KEY) || '[]'), { name, amount, unit, sets }]);
  $('#customExerciseName').value = ''; $('#customExerciseAmount').value = ''; $('#customExerciseUnit').value = '回'; $('#customExerciseSets').value = '1';
  renderWorkoutChoices();
}
function renderWorkoutChoices() {
  const choices = $('#workoutSuggestions'); choices.innerHTML = '';
  const available = exercises().filter((ex) => !workoutItems.some((item) => item.name === ex.name));
  available.slice(0, showAllExercises ? 30 : 12).forEach((ex) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'workout-option'; b.innerHTML = `<strong>${ex.name}</strong><small>${ex.amount}${ex.unit} × ${ex.sets}</small>`; b.onclick = () => { workoutItems.push(structuredClone(ex)); renderWorkoutChoices(); }; choices.append(b); });
  $('#moreExercisesButton').hidden = showAllExercises || available.length <= 12;
  const selected = $('#selectedExercises'); selected.innerHTML = '';
  workoutItems.forEach((ex, index) => { const item = document.createElement('div'); item.className = 'selected-item'; item.innerHTML = `<div class="exercise-editor"><strong>${ex.name}</strong><input aria-label="${ex.name}の量" type="number" inputmode="decimal" step="0.1" value="${ex.amount}" data-field="amount" data-index="${index}"><select aria-label="${ex.name}の単位" data-field="unit" data-index="${index}"><option${ex.unit === '回' ? ' selected' : ''}>回</option><option${ex.unit === '秒' ? ' selected' : ''}>秒</option><option${ex.unit === 'km' ? ' selected' : ''}>km</option></select><input aria-label="${ex.name}のセット数" type="number" inputmode="numeric" min="1" value="${ex.sets}" data-field="sets" data-index="${index}"><button class="remove-button" type="button" aria-label="${ex.name}を削除">×</button></div>`; item.querySelectorAll('input, select').forEach((input) => input.onchange = () => { workoutItems[Number(input.dataset.index)][input.dataset.field] = input.dataset.field === 'unit' ? input.value : Number(input.value) || 0; }); item.querySelector('button').onclick = () => { workoutItems.splice(index, 1); renderWorkoutChoices(); }; selected.append(item); });
}

document.querySelectorAll('[data-action="meal"]').forEach((button) => button.onclick = () => openMeal(button.dataset.mealType));
$('[data-action="workout"]').onclick = () => openWorkout();
$('#showHistoryButton').onclick = showHistory;
$('#showMealHistoryButton').onclick = showMealHistory;
$('#loadSheetsButton').onclick = requestSheetsLoad;
$('#homeLink').onclick = (event) => { event.preventDefault(); showRecord(); };
$('#backToRecordButton')?.addEventListener('click', showRecord);
$('#backFromMealHistoryButton')?.addEventListener('click', showRecord);
$('#addExerciseButton').onclick = addExercise;
$('#moreFoodsButton').onclick = () => { showAllFoods = true; renderMealChoices(); };
$('#moreExercisesButton').onclick = () => { showAllExercises = true; renderWorkoutChoices(); };
$('#customExerciseName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } });
$('#addFoodButton').onclick = addFood; $('#foodInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFood(); } });
$('#mealForm').addEventListener('submit', (e) => { e.preventDefault(); if (!mealItems.length) return; const all = records(); const existingId = $('#mealId').value; const mealType = $('#mealType').value; const duplicate = !existingId && all.find((record) => record.type === 'meal' && record.date === activeDate && record.mealType === mealType); const record = { id: existingId || duplicate?.id || id(), type: 'meal', date: activeDate, mealType, time: duplicate?.time || $('#mealTime').value, items: [...new Set([...(duplicate?.items || []), ...mealItems])], updatedAt: new Date().toISOString() }; saveFoods([...foods(), ...mealItems]); saveRecords(existingId || duplicate ? all.map((x) => x.id === record.id ? record : x) : [...all, record]); $('#mealDialog').close(); });
$('#workoutForm').addEventListener('submit', (e) => { e.preventDefault(); if (!workoutItems.length) return; const all = records(); const existingId = $('#workoutEditId').value; const record = { id: existingId || id(), type: 'workout', date: activeDate, time: $('#workoutTime').value, items: structuredClone(workoutItems), updatedAt: new Date().toISOString() }; saveRecords(existingId ? all.map((x) => x.id === existingId ? record : x) : [...all, record]); $('#workoutDialog').close(); });
document.querySelectorAll('[data-close]').forEach((button) => button.onclick = () => document.getElementById(button.dataset.close).close());
$('#deleteMealButton').onclick = () => { const recordId = $('#mealId').value; if (recordId && confirm('この食事記録を削除しますか？')) saveRecords(records().filter((record) => record.id !== recordId)); $('#mealDialog').close(); };
$('#deleteWorkoutButton').onclick = () => { const recordId = $('#workoutEditId').value; if (recordId && confirm('このトレーニング記録を削除しますか？')) saveRecords(records().filter((record) => record.id !== recordId)); $('#workoutDialog').close(); };
$('#records').onclick = (e) => { const button = e.target.closest('[data-edit]'); if (!button) return; const record = records().find((x) => x.id === button.dataset.edit); if (record.type === 'meal') openMeal(record.mealType, record); else openWorkout(record); };
$('#datePicker').onchange = (event) => { if (event.target.value) { activeDate = event.target.value; render(); } };
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('tanren-')).map((key) => caches.delete(key))));
}
render();
})();
