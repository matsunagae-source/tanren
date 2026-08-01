const STORAGE_KEY = 'tanren.records.v1';
const FOODS_KEY = 'tanren.foods.v1';

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

const $ = (selector) => document.querySelector(selector);
const id = () => crypto.randomUUID();
function localDate(date = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date); }
function currentTime() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
function records() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveRecords(next) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); render(); }
function foods() { return JSON.parse(localStorage.getItem(FOODS_KEY) || JSON.stringify(defaultFoods)); }
function saveFoods(next) { localStorage.setItem(FOODS_KEY, JSON.stringify([...new Set(next)])); }
function formatDate(date) { return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00`)); }

function render() {
  $('#datePicker').value = activeDate;
  const dayRecords = records().filter((r) => r.date === activeDate).sort((a, b) => a.time.localeCompare(b.time));
  $('#recordCount').textContent = dayRecords.length ? `${dayRecords.length}件` : '';
  const root = $('#records'); root.innerHTML = '';
  if (!dayRecords.length) { root.append($('#emptyTemplate').content.cloneNode(true)); return; }
  dayRecords.forEach((record) => {
    const card = document.createElement('article'); card.className = 'record-card';
    const summary = record.type === 'meal' ? record.items.join('、') : record.items.map((x) => `${x.name} ${x.amount}${x.unit}×${x.sets}`).join('、');
    card.innerHTML = `<div class="record-time">${record.time}</div><div class="record-content"><div class="record-kind">${record.type === 'meal' ? record.mealType : 'トレーニング'}</div><div class="record-summary">${summary}</div></div><button class="record-menu" aria-label="編集" data-edit="${record.id}">⋯</button>`;
    root.append(card);
  });
}

function openMeal(mealType, existing) {
  $('#mealForm').reset(); mealItems = existing ? [...existing.items] : [];
  $('#mealId').value = existing?.id || ''; $('#mealType').value = existing?.mealType || mealType; $('#mealTime').value = existing?.time || currentTime();
  $('#mealDialogTitle').textContent = existing ? '食事を編集' : `${mealType}を記録`;
  $('#deleteMealButton').hidden = !existing;
  renderMealChoices(); $('#mealDialog').showModal();
}
function renderMealChoices() {
  const root = $('#foodSuggestions'); root.innerHTML = '';
  foods().filter((food) => !mealItems.includes(food)).slice(0, 12).forEach((food) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = `＋ ${food}`; b.onclick = () => { mealItems.push(food); renderMealChoices(); }; root.append(b); });
  const selected = $('#selectedFoods'); selected.innerHTML = '';
  mealItems.forEach((food, index) => { const item = document.createElement('div'); item.className = 'selected-item'; item.innerHTML = `<span>${food}</span><button class="remove-button" type="button" aria-label="${food}を削除">×</button>`; item.querySelector('button').onclick = () => { mealItems.splice(index, 1); renderMealChoices(); }; selected.append(item); });
}
function addFood() { const input = $('#foodInput'); const name = input.value.trim(); if (!name || mealItems.includes(name)) return; mealItems.push(name); input.value = ''; renderMealChoices(); }

function openWorkout(existing) {
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
  $('#customExerciseName').value = ''; $('#customExerciseAmount').value = ''; $('#customExerciseUnit').value = '回'; $('#customExerciseSets').value = '1';
  renderWorkoutChoices();
}
function renderWorkoutChoices() {
  const choices = $('#workoutSuggestions'); choices.innerHTML = '';
  exerciseCatalog.filter((ex) => !workoutItems.some((item) => item.name === ex.name)).forEach((ex) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'workout-option'; b.innerHTML = `<strong>${ex.name}</strong><small>${ex.amount}${ex.unit} × ${ex.sets}</small>`; b.onclick = () => { workoutItems.push(structuredClone(ex)); renderWorkoutChoices(); }; choices.append(b); });
  const selected = $('#selectedExercises'); selected.innerHTML = '';
  workoutItems.forEach((ex, index) => { const item = document.createElement('div'); item.className = 'selected-item'; item.innerHTML = `<div class="exercise-editor"><strong>${ex.name}</strong><input aria-label="${ex.name}の量" type="number" inputmode="decimal" step="0.1" value="${ex.amount}" data-field="amount" data-index="${index}"><select aria-label="${ex.name}の単位" data-field="unit" data-index="${index}"><option${ex.unit === '回' ? ' selected' : ''}>回</option><option${ex.unit === '秒' ? ' selected' : ''}>秒</option><option${ex.unit === 'km' ? ' selected' : ''}>km</option></select><input aria-label="${ex.name}のセット数" type="number" inputmode="numeric" min="1" value="${ex.sets}" data-field="sets" data-index="${index}"><button class="remove-button" type="button" aria-label="${ex.name}を削除">×</button></div>`; item.querySelectorAll('input, select').forEach((input) => input.onchange = () => { workoutItems[Number(input.dataset.index)][input.dataset.field] = input.dataset.field === 'unit' ? input.value : Number(input.value) || 0; }); item.querySelector('button').onclick = () => { workoutItems.splice(index, 1); renderWorkoutChoices(); }; selected.append(item); });
}

document.querySelectorAll('[data-action="meal"]').forEach((button) => button.onclick = () => openMeal(button.dataset.mealType));
$('[data-action="workout"]').onclick = () => openWorkout();
$('#addExerciseButton').onclick = addExercise;
$('#customExerciseName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } });
$('#addFoodButton').onclick = addFood; $('#foodInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFood(); } });
$('#mealForm').addEventListener('submit', (e) => { e.preventDefault(); if (!mealItems.length) return; const all = records(); const existingId = $('#mealId').value; const record = { id: existingId || id(), type: 'meal', date: activeDate, mealType: $('#mealType').value, time: $('#mealTime').value, items: [...mealItems], updatedAt: new Date().toISOString() }; saveFoods([...foods(), ...mealItems]); saveRecords(existingId ? all.map((x) => x.id === existingId ? record : x) : [...all, record]); $('#mealDialog').close(); });
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
