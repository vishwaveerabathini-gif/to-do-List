// script.js - Supabase-powered Consistency Tracker
// Requires: supabase_config.js exposing window.SUPABASE_URL & window.SUPABASE_ANON_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js";
if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  alert("Please configure supabase_config.js with SUPABASE_URL and SUPABASE_ANON_KEY");
}

const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ---------- DOM refs ----------
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

const taskInput = qs("#taskInput");
const addTaskBtn = qs("#addTaskBtn");
const taskList = qs("#taskList");

const drawer = qs("#drawer");
const drawerDate = qs("#drawerDate");
const drawerTaskList = qs("#drawerTaskList");
const drawerTaskInput = qs("#drawerTaskInput");
const drawerAddTaskBtn = qs("#drawerAddTaskBtn");
const drawerPct = qs("#drawerPct");
const drawerFill = qs("#drawerFill");
const closeDrawer = qs("#closeDrawer");

const dayGrid = qs("#dayGrid");
const todayLabel = qs("#todayLabel");
const todayPct = qs("#todayPct");
const mainProgressFill = qs("#mainProgressFill");
const mainProgressText = qs("#mainProgressText");
const dashboardStreakEl = qs("#dashboardStreak");

const refreshBtn = qs("#refreshBtn");
const resetLocalBtn = qs("#resetLocal");
const settingsBtn = qs("#settingsBtn");
const settingsModal = qs("#settingsModal");
const closeSettings = qs("#closeSettings");
const saveSettings = qs("#saveSettings");
const thresholdInput = qs("#thresholdInput");
const themeSelect = qs("#themeSelect");

const celebrate = qs("#celebrate");

// ---------- State ----------
let tasksCache = []; // { id, title, completed, date }
let currentUser = null;
let currentDate = todayISO();
const LS_TASKS_KEY = "consistency_tasks_v1";
const DEFAULT_THRESHOLD = 80;

// ---------- Helpers ----------
function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function saveTasksToLocal() {
  try {
    localStorage.setItem(LS_TASKS_KEY, JSON.stringify(tasksCache));
  } catch (e) {}
}

function loadTasksFromLocal() {
  try {
    const raw = localStorage.getItem(LS_TASKS_KEY);
    if (raw) tasksCache = JSON.parse(raw);
  } catch (e) {}
}

// ---------- Supabase CRUD ----------
async function fetchTasksFromServer() {
  if (!currentUser) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, date, completed, created_at")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return [];
  return data.map(d => ({
    id: d.id,
    title: d.title,
    completed: !!d.completed,
    date: d.date
  }));
}

async function createTaskOnServer(title, date) {
  if (!currentUser) return null;
  const { data, error } = await supabase
    .from("tasks")
    .insert([{ title, date, user_id: currentUser.id }])
    .select()
    .single();
  return error ? null : data;
}

async function updateTaskOnServer(id, patch) {
  if (!currentUser) return null;
  const { data } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  return data;
}

async function deleteTaskOnServer(id) {
  if (!currentUser) return false;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  return !error;
}

// ---------- Rendering ----------
function computePctFor(date) {
  const items = tasksCache.filter(t => t.date === date);
  if (!items.length) return 0;
  return Math.round(items.filter(t => t.completed).length / items.length * 100);
}

function renderMainToday() {
  const today = todayISO();
  const todayTasks = tasksCache.filter(t => t.date === today);
  taskList.innerHTML = "";

  todayTasks.length
    ? todayTasks.forEach(t => {
      const li = document.createElement("li");
      li.className = t.completed ? "done" : "";
      const bullet = document.createElement("div");
      bullet.className = "bullet";
      bullet.textContent = t.completed ? "✓" : "•";
      li.appendChild(bullet);

      const span = document.createElement("div");
      span.style.flex = "1";
      span.textContent = t.title;
      li.appendChild(span);

      const rem = document.createElement("button");
      rem.className = "remove";
      rem.textContent = "✕";
      rem.onclick = async e => {
        e.stopPropagation();
        const prev = [...tasksCache];
        tasksCache = tasksCache.filter(x => x.id !== t.id);
        saveTasksToLocal();
        refreshDashboardColors();
        if (!await deleteTaskOnServer(t.id)) {
          tasksCache = prev;
          refreshDashboardColors();
        }
      };
      li.appendChild(rem);

      li.onclick = async () => {
        t.completed = !t.completed;
        saveTasksToLocal();
        refreshDashboardColors();
        if (!await updateTaskOnServer(t.id, { completed: t.completed })) {
          t.completed = !t.completed;
          refreshDashboardColors();
        }
      };
      taskList.appendChild(li);
    })
    : taskList.innerHTML = `<li class="muted">No tasks today. Add one!</li>`;

  const pct = computePctFor(today);
  todayPct.textContent = pct + "%";
  mainProgressFill.style.width = pct + "%";
  mainProgressText.textContent = pct + "%";
}

function refreshDashboardColors() {
  const stats = {};
  tasksCache.forEach(t => {
    stats[t.date] = stats[t.date] || { done: 0, total: 0 };
    stats[t.date].total++;
    if (t.completed) stats[t.date].done++;
  });
  qsa(".day").forEach(el => {
    const date = el.dataset.date;
    el.className = "day"; // reset
    if (!stats[date]) {
      el.classList.add("pending");
      return;
    }
    const pct = Math.round(stats[date].done / stats[date].total * 100);
    const th = Number(thresholdInput.value || DEFAULT_THRESHOLD);
    pct >= th ? el.classList.add("completed")
      : pct > 0 ? el.classList.add("partial")
      : el.classList.add("pending");
  });
  renderMainToday();
  computeStreak();
}

function computeStreak() {
  let streak = 0;
  const doneDates = new Set(qsa(".day.completed").map(e => e.dataset.date));
  let cursor = new Date(todayISO());
  while (doneDates.has(todayISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  dashboardStreakEl.textContent = `Current streak: ${streak} day${streak!==1?"s":""}`;
}

const openDrawerFor = date => {
  currentDate = date;
  drawer.classList.add("open");
  drawerDate.textContent = new Date(date).toDateString();
  renderTaskListForDate(date);
};

closeDrawer.onclick = () => drawer.classList.remove("open");

function buildGrid() {
  const today = new Date();
  dayGrid.innerHTML = "";
  for (let i = -14; i <= 15; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateKey = todayISO(d);
    const el = document.createElement("div");
    el.className = "day";
    el.textContent = d.getDate();
    el.dataset.date = dateKey;
    if (i === 0) el.classList.add("today");
    el.onclick = () => openDrawerFor(dateKey);
    dayGrid.appendChild(el);
  }
}

function renderTaskListForDate(date) {
  drawerTaskList.innerHTML = "";
  const tasks = tasksCache.filter(t => t.date === date);
  if (!tasks.length) return drawerTaskList.innerHTML = `<li class="muted">No tasks.</li>`;
  tasks.forEach(t => {
    const li = document.createElement("li");
    li.className = t.completed ? "done" : "";
    li.textContent = t.title;
    li.onclick = async () => {
      t.completed = !t.completed;
      saveTasksToLocal();
      refreshDashboardColors();
      if (!await updateTaskOnServer(t.id, { completed: t.completed })) {
        t.completed = !t.completed;
        refreshDashboardColors();
      }
    };
    drawerTaskList.appendChild(li);
  });
  drawerPct.textContent = computePctFor(date) + "%";
  drawerFill.style.width = computePctFor(date) + "%";
}
function triggerFlowerRain() {
  const container = document.getElementById("flower-container");

  for (let i = 0; i < 20; i++) {
    const flower = document.createElement("div");
    flower.classList.add("flower");
    flower.textContent = "🌸";

    flower.style.left = Math.random() * 100 + "vw";
    flower.style.fontSize = (Math.random() * 25 + 20) + "px";

    container.appendChild(flower);

    setTimeout(() => flower.remove(), 3000);
  }
}
function triggerGlow() {
  document.body.classList.add("glow-effect");
  setTimeout(() => {
    document.body.classList.remove("glow-effect");
  }, 700);
}

// 🔔 Sound Effect
function playGoodSound() {
  const sound = document.getElementById("good-sound");
  sound.currentTime = 0;
  sound.play();
}

// 🎉 Confetti Burst
function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confetti = [];

  for (let i = 0; i < 150; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 2,
      speed: Math.random() * 3 + 2,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confetti.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.size, c.size);
      c.y += c.speed;
    });

    requestAnimationFrame(draw);
  }

  draw();

  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 2000);
}

// 🎆 Fireworks
function triggerFireworks() {
  const canvas = document.getElementById("fireworks-canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  function firework(x, y) {
    const particles = [];

    for (let i = 0; i < 40; i++) {
      particles.push({
        x,
        y,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 4 + 2,
        size: Math.random() * 4 + 2,
        alpha: 1
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        const vx = Math.cos(p.angle) * p.speed;
        const vy = Math.sin(p.angle) * p.speed;
        p.x += vx;
        p.y += vy;
        p.alpha -= 0.02;

        ctx.fillStyle = `rgba(255,200,50,${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (particles.some(p => p.alpha > 0)) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }

  firework(window.innerWidth / 2, window.innerHeight / 2);
}
function triggerDangerRain() {
  const icons = ["⚠", "🔥"];
  
  for (let i = 0; i < 4; i++) {
    const el = document.createElement("div");
    el.className = "danger-mini";
    el.textContent = icons[Math.floor(Math.random() * icons.length)];

    el.style.left = `calc(50% + ${(Math.random() * 120 - 60)}px)`; // near banner
    el.style.animationDuration = (1 + Math.random()).toFixed(2) + "s";

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}




// Add task
addTaskBtn.onclick = async () => {
  const text = taskInput.value.trim();
  if (!text) return;

  const tempId = "tmp-" + Date.now();
  tasksCache.unshift({ id: tempId, title: text, completed: false, date: todayISO() });
  taskInput.value = "";
  saveTasksToLocal();
  refreshDashboardColors();

  // ⬇️ AI Classification Call Added Here ⬇️
  try {
    const aiRes = await fetch("http://localhost:4000/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: text })
    });
    const aiData = await aiRes.json();
    console.log("AI classification:", aiData);

    if (aiData.type === "good") {
      showAIQuote("good", aiData.quote);

      triggerFlowerRain();
      triggerConfetti();
      triggerGlow();
      triggerFireworks();
    } else {
      showAIQuote("bad", aiData.quote);
       triggerDangerRain();
    }

    // Later we will show aiData.quote in UI
  } catch (err) {
    console.error("AI classification failed:", err);
  }
  // ⬆️ End of AI Call ⬆️

  const saved = await createTaskOnServer(text, todayISO());
  if (saved) {
    tasksCache = tasksCache.map(t => t.id === tempId ? saved : t);
    saveTasksToLocal();
    refreshDashboardColors();
  }
};

// Drawer add
// Drawer add
drawerAddTaskBtn.onclick = async () => {
  const text = drawerTaskInput.value.trim();
  if (!text) return;

  const tempId = "tmp-" + Date.now();
  tasksCache.unshift({ id: tempId, title: text, completed: false, date: currentDate });
  drawerTaskInput.value = "";
  saveTasksToLocal();
  renderTaskListForDate(currentDate);
  refreshDashboardColors();

  // ⬇️ AI Classification Call Added Here ⬇️
  try {
    const aiRes = await fetch("http://localhost:4000/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: text })
    });
    const aiData = await aiRes.json();
    console.log("AI classification:", aiData);
    // Later: store and show aiData.quote for UI enhancement
  } catch (err) {
    console.error("AI classification failed:", err);
  }
  // ⬆️ End of AI Call ⬆️

  const saved = await createTaskOnServer(text, currentDate);
  if (saved) {
    tasksCache = tasksCache.map(t => t.id === tempId ? saved : t);
    saveTasksToLocal();
    renderTaskListForDate(currentDate);
    refreshDashboardColors();
  }
};
// if (ai.type === "good") {
//   showAIQuote("good", ai.quote);

//   triggerFlowerRain();
//   triggerConfetti();
//   triggerGlow();
//   triggerFireworks();
// } else {
//   showAIQuote("bad", ai.quote);
// }

const goodQuoteBox = document.querySelector("#good-quote-box");
const badQuoteBox = document.querySelector("#bad-quote-box");

function showAIQuote(type, quote) {
  const box = type === "good" ? goodQuoteBox : badQuoteBox;

  box.textContent = quote;
  box.classList.add("show");

  setTimeout(() => {
    box.classList.remove("show");
  }, 5000);
}



// Settings
settingsBtn.onclick = () => settingsModal.setAttribute("aria-hidden", "false");
closeSettings.onclick = () => settingsModal.setAttribute("aria-hidden", "true");
saveSettings.onclick = () => {
  localStorage.setItem("consistency_settings", JSON.stringify({
    threshold: thresholdInput.value,
    theme: themeSelect.value
  }));
  settingsModal.setAttribute("aria-hidden", "true");
  refreshDashboardColors();
};

// Reset local
resetLocalBtn.onclick = () => {
  tasksCache = [];
  saveTasksToLocal();
  refreshDashboardColors();
  renderMainToday();
};

// Refresh button sync
refreshBtn.onclick = loadAllForUser;

// Load & sync
async function loadAllForUser() {
  loadTasksFromLocal();
  buildGrid();
  refreshDashboardColors();
  renderMainToday();

  if (!currentUser) return;

  const serverTasks = await fetchTasksFromServer();
  if (serverTasks?.length) {
    tasksCache = serverTasks;
    saveTasksToLocal();
    refreshDashboardColors();
    renderMainToday();
  }
}

// Initial setup
(function init(){
  todayLabel.textContent = new Date().toDateString();
  const set = JSON.parse(localStorage.getItem("consistency_settings") || "{}");
  if (set.threshold) thresholdInput.value = set.threshold;
  if (set.theme) document.documentElement.setAttribute("data-theme", set.theme);

  buildGrid();
  loadTasksFromLocal();
  refreshDashboardColors();
  renderMainToday();
})();

// 🔐 AUTH ENFORCEMENT
supabase.auth.getSession().then(({ data }) => {
  if (!data?.session) {
    window.location.href = "login.html";
  } else {
    currentUser = data.session.user;
    loadAllForUser();
  }
});
