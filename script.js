// script.js - MongoDB-powered Consistency Tracker


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

let tasksCache = [];
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
        localStorage.setItem(
            LS_TASKS_KEY,
            JSON.stringify(tasksCache)
        );
    } catch (e) {}
}


function loadTasksFromLocal() {
    try {
        const raw = localStorage.getItem(LS_TASKS_KEY);

        if (raw) {
            tasksCache = JSON.parse(raw);
        }

    } catch (e) {}
}


// ======================================================
// ==================== MONGODB CRUD ====================
// ======================================================

async function fetchTasksFromServer() {

    if (!currentUser) return [];

    try {

        const response = await fetch(
            `http://localhost:4000/tasks/${currentUser.id}`
        );

        if (!response.ok) {
            console.error("Failed to fetch tasks");
            return [];
        }

        const data = await response.json();

        return data.map(task => ({
            id: task._id,
            title: task.title,
            completed: !!task.completed,
            date: task.date
        }));

    } catch (error) {

        console.error(
            "Fetch Tasks Error:",
            error
        );

        return [];
    }
}


// ---------- CREATE TASK ----------

async function createTaskOnServer(title, date) {

    if (!currentUser || !currentUser.id) {

        console.error(
            "Create Task Error: currentUser/id missing",
            currentUser
        );

        return null;
    }

    try {

        const response = await fetch(
            "http://localhost:4000/tasks",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    title: title,
                    date: date,
                    userId: currentUser.id
                })
            }
        );


        const responseText =
            await response.text();


        let data = {};


        try {

            data =
                responseText
                    ? JSON.parse(responseText)
                    : {};

        } catch {

            data = {
                error: responseText
            };

        }


        console.log(
            "Create Task status:",
            response.status
        );


        console.log(
            "Create Task response:",
            data
        );


        if (!response.ok) {

            const message =
                data.error ||
                data.message ||
                `Server returned ${response.status}`;


            console.error(
                "Create Task Error:",
                message
            );


            alert(
                `Task could not be saved.\n\n${message}`
            );


            return null;
        }


        if (!data._id) {

            console.error(
                "Create Task Error: MongoDB did not return _id",
                data
            );


            alert(
                "Task could not be saved: invalid server response."
            );


            return null;
        }


        return {

            id: data._id,

            title: data.title,

            completed: !!data.completed,

            date: data.date

        };


    } catch (error) {

        console.error(
            "Create Task Connection Error:",
            error
        );


        alert(
            "Cannot connect to the backend server.\n\n" +
            "Make sure node server.js is running on port 4000."
        );


        return null;
    }
}


// ---------- UPDATE TASK ----------

async function updateTaskOnServer(id, patch) {

    if (!currentUser) return null;

    try {

        const response = await fetch(
            `http://localhost:4000/tasks/${id}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(patch)
            }
        );


        if (!response.ok) {

            console.error(
                "Failed to update task"
            );

            return null;
        }


        const data =
            await response.json();


        return {

            id: data._id,

            title: data.title,

            completed: !!data.completed,

            date: data.date

        };


    } catch (error) {

        console.error(
            "Update Task Error:",
            error
        );

        return null;
    }
}


// ---------- DELETE TASK ----------

async function deleteTaskOnServer(id) {

    if (!currentUser) return false;

    try {

        const response = await fetch(
            `http://localhost:4000/tasks/${id}`,
            {
                method: "DELETE"
            }
        );


        if (!response.ok) {

            console.error(
                "Failed to delete task"
            );

            return false;
        }


        return true;


    } catch (error) {

        console.error(
            "Delete Task Error:",
            error
        );

        return false;
    }
}


// ======================================================
// ==================== RENDERING =======================
// ======================================================

function computePctFor(date) {

    const items =
        tasksCache.filter(
            t => t.date === date
        );


    if (!items.length) return 0;


    return Math.round(
        items.filter(
            t => t.completed
        ).length /
        items.length *
        100
    );
}


// ---------- Render Main Today ----------

function renderMainToday() {

    const today =
        todayISO();


    const todayTasks =
        tasksCache.filter(
            t => t.date === today
        );


    taskList.innerHTML = "";


    todayTasks.length
        ? todayTasks.forEach(t => {

            const li =
                document.createElement("li");


            li.className =
                t.completed
                    ? "done"
                    : "";


            const bullet =
                document.createElement("div");


            bullet.className =
                "bullet";


            bullet.textContent =
                t.completed
                    ? "✓"
                    : "•";


            li.appendChild(bullet);


            const span =
                document.createElement("div");


            span.style.flex =
                "1";


            span.textContent =
                t.title;


            li.appendChild(span);


            const rem =
                document.createElement("button");


            rem.className =
                "remove";


            rem.textContent =
                "✕";


            rem.onclick =
                async e => {

                    e.stopPropagation();


                    const prev =
                        [...tasksCache];


                    tasksCache =
                        tasksCache.filter(
                            x =>
                                x.id !== t.id
                        );


                    saveTasksToLocal();

                    refreshDashboardColors();


                    const deleted =
                        await deleteTaskOnServer(
                            t.id
                        );


                    if (!deleted) {

                        tasksCache =
                            prev;


                        saveTasksToLocal();

                        refreshDashboardColors();

                    }

                };


            li.appendChild(rem);


            li.onclick =
                async () => {

                    t.completed =
                        !t.completed;


                    saveTasksToLocal();

                    refreshDashboardColors();


                    const updated =
                        await updateTaskOnServer(
                            t.id,
                            {
                                completed:
                                    t.completed
                            }
                        );


                    if (!updated) {

                        t.completed =
                            !t.completed;


                        saveTasksToLocal();

                        refreshDashboardColors();

                    }

                };


            taskList.appendChild(li);

        })

        : taskList.innerHTML =
            `<li class="muted">
                No tasks today. Add one!
             </li>`;


    const pct =
        computePctFor(today);


    todayPct.textContent =
        pct + "%";


    mainProgressFill.style.width =
        pct + "%";


    mainProgressText.textContent =
        pct + "%";
}


// ---------- Dashboard ----------

function refreshDashboardColors() {

    const stats = {};


    tasksCache.forEach(t => {

        stats[t.date] =
            stats[t.date] ||
            {
                done: 0,
                total: 0
            };


        stats[t.date].total++;


        if (t.completed) {

            stats[t.date].done++;

        }

    });


    qsa(".day").forEach(el => {

        const date =
            el.dataset.date;


        el.className =
            "day";


        if (!stats[date]) {

            el.classList.add(
                "pending"
            );

            return;
        }


        const pct =
            Math.round(
                stats[date].done /
                stats[date].total *
                100
            );


        const th =
            Number(
                thresholdInput.value ||
                DEFAULT_THRESHOLD
            );


        pct >= th
            ? el.classList.add(
                "completed"
            )
            : pct > 0
                ? el.classList.add(
                    "partial"
                )
                : el.classList.add(
                    "pending"
                );

    });


    renderMainToday();

    computeStreak();
}


// ---------- Streak ----------

function computeStreak() {

    let streak = 0;


    const doneDates =
        new Set(
            qsa(".day.completed")
                .map(
                    e =>
                        e.dataset.date
                )
        );


    let cursor =
        new Date(
            todayISO()
        );


    while (
        doneDates.has(
            todayISO(cursor)
        )
    ) {

        streak++;


        cursor.setDate(
            cursor.getDate() - 1
        );

    }


    dashboardStreakEl.textContent =
        `Current streak: ${streak} day${streak !== 1 ? "s" : ""}`;
}


// ======================================================
// ==================== DRAWER ==========================
// ======================================================

const openDrawerFor =
    date => {

        currentDate =
            date;


        drawer.classList.add(
            "open"
        );


        drawerDate.textContent =
            new Date(
                date
            ).toDateString();


        renderTaskListForDate(
            date
        );
    };


closeDrawer.onclick =
    () =>
        drawer.classList.remove(
            "open"
        );


// ======================================================
// ==================== CALENDAR ========================
// ======================================================

function buildGrid() {

    const today =
        new Date();


    dayGrid.innerHTML =
        "";


    for (
        let i = -14;
        i <= 15;
        i++
    ) {

        const d =
            new Date(today);


        d.setDate(
            today.getDate() + i
        );


        const dateKey =
            todayISO(d);


        const el =
            document.createElement(
                "div"
            );


        el.className =
            "day";


        el.textContent =
            d.getDate();


        el.dataset.date =
            dateKey;


        if (i === 0) {

            el.classList.add(
                "today"
            );

        }


        el.onclick =
            () =>
                openDrawerFor(
                    dateKey
                );


        dayGrid.appendChild(
            el
        );

    }
}


// ======================================================
// ==================== DRAWER TASKS ====================
// ======================================================

function renderTaskListForDate(date) {

    drawerTaskList.innerHTML =
        "";


    const tasks =
        tasksCache.filter(
            t =>
                t.date === date
        );


    if (!tasks.length) {

        drawerTaskList.innerHTML =
            `<li class="muted">
                No tasks.
             </li>`;


        drawerPct.textContent =
            "0%";


        drawerFill.style.width =
            "0%";


        return;
    }


    tasks.forEach(t => {

        const li =
            document.createElement(
                "li"
            );


        li.className =
            t.completed
                ? "done"
                : "";


        li.textContent =
            t.title;


        li.onclick =
            async () => {

                t.completed =
                    !t.completed;


                saveTasksToLocal();

                refreshDashboardColors();


                const updated =
                    await updateTaskOnServer(
                        t.id,
                        {
                            completed:
                                t.completed
                        }
                    );


                if (!updated) {

                    t.completed =
                        !t.completed;


                    saveTasksToLocal();

                    refreshDashboardColors();

                }


                renderTaskListForDate(
                    date
                );

            };


        drawerTaskList.appendChild(
            li
        );

    });


    const pct =
        computePctFor(date);


    drawerPct.textContent =
        pct + "%";


    drawerFill.style.width =
        pct + "%";
}


// ======================================================
// ==================== ANIMATIONS ======================
// ======================================================

function triggerFlowerRain() {

    const container =
        document.getElementById(
            "flower-container"
        );


    if (!container) return;


    for (
        let i = 0;
        i < 20;
        i++
    ) {

        const flower =
            document.createElement(
                "div"
            );


        flower.classList.add(
            "flower"
        );


        flower.textContent =
            "🌸";


        flower.style.left =
            Math.random() *
            100 +
            "vw";


        flower.style.fontSize =
            (
                Math.random() *
                25 +
                20
            ) +
            "px";


        container.appendChild(
            flower
        );


        setTimeout(
            () =>
                flower.remove(),
            3000
        );

    }
}


function triggerGlow() {

    document.body.classList.add(
        "glow-effect"
    );


    setTimeout(
        () => {

            document.body.classList.remove(
                "glow-effect"
            );

        },
        700
    );
}


// ======================================================
// ==================== SOUND ============================
// ======================================================

function playGoodSound() {

    const sound =
        document.getElementById(
            "good-sound"
        );


    if (!sound) return;


    sound.currentTime =
        0;


    sound.play().catch(
        () => {}
    );
}


// ======================================================
// ==================== CONFETTI =========================
// ======================================================

function triggerConfetti() {

    const canvas =
        document.getElementById(
            "confetti-canvas"
        );


    if (!canvas) return;


    const ctx =
        canvas.getContext(
            "2d"
        );


    canvas.width =
        window.innerWidth;


    canvas.height =
        window.innerHeight;


    const confetti =
        [];


    for (
        let i = 0;
        i < 150;
        i++
    ) {

        confetti.push({

            x:
                Math.random() *
                canvas.width,

            y:
                Math.random() *
                canvas.height -
                canvas.height,

            size:
                Math.random() *
                8 +
                2,

            speed:
                Math.random() *
                3 +
                2,

            color:
                `hsl(${Math.random() * 360}, 100%, 60%)`

        });

    }


    function draw() {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        confetti.forEach(
            c => {

                ctx.fillStyle =
                    c.color;


                ctx.fillRect(
                    c.x,
                    c.y,
                    c.size,
                    c.size
                );


                c.y +=
                    c.speed;

            }
        );


        requestAnimationFrame(
            draw
        );

    }


    draw();


    setTimeout(
        () => {

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

        },
        2000
    );
}


// ======================================================
// ==================== FIREWORKS ========================
// ======================================================

function triggerFireworks() {

    const canvas =
        document.getElementById(
            "fireworks-canvas"
        );


    if (!canvas) return;


    const ctx =
        canvas.getContext(
            "2d"
        );


    canvas.width =
        window.innerWidth;


    canvas.height =
        window.innerHeight;


    function firework(x, y) {

        const particles =
            [];


        for (
            let i = 0;
            i < 40;
            i++
        ) {

            particles.push({

                x,

                y,

                angle:
                    Math.random() *
                    Math.PI *
                    2,

                speed:
                    Math.random() *
                    4 +
                    2,

                size:
                    Math.random() *
                    4 +
                    2,

                alpha:
                    1

            });

        }


        function animate() {

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );


            particles.forEach(
                p => {

                    const vx =
                        Math.cos(
                            p.angle
                        ) *
                        p.speed;


                    const vy =
                        Math.sin(
                            p.angle
                        ) *
                        p.speed;


                    p.x +=
                        vx;


                    p.y +=
                        vy;


                    p.alpha -=
                        0.02;


                    ctx.fillStyle =
                        `rgba(255,200,50,${p.alpha})`;


                    ctx.beginPath();


                    ctx.arc(
                        p.x,
                        p.y,
                        p.size,
                        0,
                        Math.PI * 2
                    );


                    ctx.fill();

                }
            );


            if (
                particles.some(
                    p =>
                        p.alpha > 0
                )
            ) {

                requestAnimationFrame(
                    animate
                );

            }

        }


        animate();

    }


    firework(
        window.innerWidth / 2,
        window.innerHeight / 2
    );
}


// ======================================================
// ==================== DANGER RAIN ======================
// ======================================================

function triggerDangerRain() {

    const icons = [
        "⚠",
        "🔥"
    ];


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const el =
            document.createElement(
                "div"
            );


        el.className =
            "danger-mini";


        el.textContent =
            icons[
                Math.floor(
                    Math.random() *
                    icons.length
                )
            ];


        el.style.left =
            `calc(50% + ${
                Math.random() *
                120 -
                60
            }px)`;


        el.style.animationDuration =
            (
                1 +
                Math.random()
            ).toFixed(2) +
            "s";


        document.body.appendChild(
            el
        );


        setTimeout(
            () =>
                el.remove(),
            1600
        );

    }
}


// ======================================================
// ==================== AI QUOTE / SLOGAN ==============
// ======================================================

let activeQuoteTimer = null;


function showAIQuote(type, quote) {

    const normalizedType =
        String(type || "")
            .trim()
            .toLowerCase();


    const cleanQuote =
        String(quote || "")
            .trim();


    console.log(
        "========== AI SLOGAN =========="
    );


    console.log(
        "TYPE:",
        normalizedType
    );


    console.log(
        "QUOTE:",
        cleanQuote
    );


    if (!cleanQuote) {

        console.error(
            "❌ Groq returned an empty slogan."
        );

        return;
    }


    // Remove any previous slogan boxes.
    const oldGoodBox =
        document.getElementById(
            "good-quote-box"
        );


    const oldBadBox =
        document.getElementById(
            "bad-quote-box"
        );


    if (oldGoodBox) {
        oldGoodBox.remove();
    }


    if (oldBadBox) {
        oldBadBox.remove();
    }


    // Create a completely fresh box.
    const box =
        document.createElement(
            "div"
        );


    box.id =
        normalizedType === "good"
            ? "good-quote-box"
            : "bad-quote-box";


    box.textContent =
        normalizedType === "good"
            ? `💚 ${cleanQuote}`
            : `⚠️ ${cleanQuote}`;


    // Force visibility directly through JavaScript.
    Object.assign(
        box.style,
        {

            position:
                "fixed",

            top:
                "25px",

            left:
                "50%",

            transform:
                "translateX(-50%)",

            zIndex:
                "2147483647",

            display:
                "block",

            visibility:
                "visible",

            opacity:
                "1",

            width:
                "min(700px, 85vw)",

            boxSizing:
                "border-box",

            padding:
                "18px 25px",

            borderRadius:
                "18px",

            textAlign:
                "center",

            fontFamily:
                "Poppins, sans-serif",

            fontSize:
                "18px",

            fontWeight:
                "700",

            lineHeight:
                "1.5",

            color:
                "#ffffff",

            pointerEvents:
                "none",

            boxShadow:
                "0 12px 40px rgba(0,0,0,0.4)",

            transition:
                "opacity 0.4s ease, transform 0.4s ease"

        }
    );


    if (
        normalizedType === "good"
    ) {

        box.style.background =
            "linear-gradient(135deg, #16c784, #27ae60)";


        triggerFlowerRain();

        triggerConfetti();

        triggerGlow();

        triggerFireworks();

        playGoodSound();

    } else {

        box.style.background =
            "linear-gradient(135deg, #ff3b30, #c0392b)";


        triggerDangerRain();

    }


    // Add the slogan directly to body.
    document.body.appendChild(
        box
    );


    // Animate the slogan in.
    box.animate(
        [

            {
                opacity:
                    0,

                transform:
                    "translateX(-50%) translateY(-25px) scale(0.9)"
            },

            {
                opacity:
                    1,

                transform:
                    "translateX(-50%) translateY(0) scale(1)"
            }

        ],
        {

            duration:
                400,

            easing:
                "ease-out",

            fill:
                "forwards"

        }
    );


    console.log(
        "✅ SLOGAN ADDED TO SCREEN:",
        box.textContent
    );


    // Keep slogan for 4 seconds.
    if (activeQuoteTimer) {

        clearTimeout(
            activeQuoteTimer
        );

    }


    activeQuoteTimer =
        setTimeout(
            () => {

                box.animate(
                    [

                        {
                            opacity:
                                1,

                            transform:
                                "translateX(-50%) translateY(0)"
                        },

                        {
                            opacity:
                                0,

                            transform:
                                "translateX(-50%) translateY(-20px)"
                        }

                    ],
                    {

                        duration:
                            400,

                        easing:
                            "ease-in",

                        fill:
                            "forwards"

                    }
                );


                setTimeout(
                    () => {

                        if (
                            box.parentNode
                        ) {

                            box.remove();

                        }

                    },
                    400
                );


                activeQuoteTimer =
                    null;

            },
            4000
        );
}


// ======================================================
// ==================== GROQ CLASSIFICATION =============
// ======================================================

async function classifyTaskWithGroq(task) {

    try {

        const response =
            await fetch(
                "http://localhost:4000/classify",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            task:
                                task

                        })

                }
            );


        const responseText =
            await response.text();


        let data = {};


        try {

            data =
                responseText
                    ? JSON.parse(
                        responseText
                    )
                    : {};

        } catch {

            data = {

                error:
                    responseText

            };

        }


        if (!response.ok) {

            console.error(
                "Groq classification failed:",
                data
            );


            return null;
        }


        const type =
            String(
                data.type || ""
            )
                .trim()
                .toLowerCase();


        const quote =
            String(
                data.quote || ""
            )
                .trim();


        if (
            type !== "good" &&
            type !== "bad"
        ) {

            console.error(
                "Invalid Groq classification:",
                data
            );


            return null;
        }


        if (!quote) {

            console.error(
                "Groq returned no slogan:",
                data
            );


            return null;
        }


        console.log(
            "Groq result:",
            {

                type:
                    type,

                quote:
                    quote

            }
        );


        console.log(
            "Calling showTaskAIResult with:",
            {

                type:
                    type,

                quote:
                    quote

            }
        );


        return {

            type:
                type,

            quote:
                quote

        };

    } catch (error) {

        console.error(
            "Groq connection error:",
            error
        );


        return null;
    }
}


// ======================================================
// ==================== SHOW AI RESULT ==================
// ======================================================

function showTaskAIResult(aiData) {

    if (!aiData) {

        console.error(
            "No AI data received."
        );

        return;
    }


    const type =
        String(
            aiData.type || ""
        )
            .trim()
            .toLowerCase();


    const quote =
        String(
            aiData.quote || ""
        )
            .trim();


    if (!quote) {

        console.error(
            "AI data contains no quote."
        );

        return;
    }


    if (
        type === "good"
    ) {

        showAIQuote(
            "good",
            quote
        );

    }


    else if (
        type === "bad"
    ) {

        showAIQuote(
            "bad",
            quote
        );

    }


    else {

        console.error(
            "Unknown AI type:",
            type
        );

    }
}


// ======================================================
// ==================== ADD TASK ========================
// ======================================================

addTaskBtn.onclick =
    async () => {

        const text =
            taskInput.value.trim();


        if (!text) return;


        if (!currentUser) {

            alert(
                "Please login first."
            );


            window.location.href =
                "login.html";


            return;
        }


        const tempId =
            "tmp-" +
            Date.now();


        tasksCache.unshift({

            id:
                tempId,

            title:
                text,

            completed:
                false,

            date:
                todayISO()

        });


        taskInput.value =
            "";


        saveTasksToLocal();


        refreshDashboardColors();


        // ==============================================
        // GROQ AI
        // ==============================================

        const aiData =
            await classifyTaskWithGroq(
                text
            );


        showTaskAIResult(
            aiData
        );


        // ==============================================
        // MONGODB
        // ==============================================

        const saved =
            await createTaskOnServer(
                text,
                todayISO()
            );


        if (saved) {

            tasksCache =
                tasksCache.map(
                    t =>
                        t.id === tempId
                            ? saved
                            : t
                );


            saveTasksToLocal();


            refreshDashboardColors();

        }


        else {

            tasksCache =
                tasksCache.filter(
                    t =>
                        t.id !== tempId
                );


            saveTasksToLocal();


            refreshDashboardColors();


            console.error(
                "Task was not saved to MongoDB."
            );

        }

    };


// ======================================================
// ==================== DRAWER ADD TASK =================
// ======================================================

drawerAddTaskBtn.onclick =
    async () => {

        const text =
            drawerTaskInput.value.trim();


        if (!text) return;


        if (!currentUser) {

            alert(
                "Please login first."
            );


            window.location.href =
                "login.html";


            return;
        }


        const tempId =
            "tmp-" +
            Date.now();


        tasksCache.unshift({

            id:
                tempId,

            title:
                text,

            completed:
                false,

            date:
                currentDate

        });


        drawerTaskInput.value =
            "";


        saveTasksToLocal();


        renderTaskListForDate(
            currentDate
        );


        refreshDashboardColors();


        // ==============================================
        // GROQ AI
        // ==============================================

        const aiData =
            await classifyTaskWithGroq(
                text
            );


        showTaskAIResult(
            aiData
        );


        // ==============================================
        // MONGODB
        // ==============================================

        const saved =
            await createTaskOnServer(
                text,
                currentDate
            );


        if (saved) {

            tasksCache =
                tasksCache.map(
                    t =>
                        t.id === tempId
                            ? saved
                            : t
                );


            saveTasksToLocal();


            renderTaskListForDate(
                currentDate
            );


            refreshDashboardColors();

        }


        else {

            tasksCache =
                tasksCache.filter(
                    t =>
                        t.id !== tempId
                );


            saveTasksToLocal();


            renderTaskListForDate(
                currentDate
            );


            refreshDashboardColors();


            console.error(
                "Task was not saved to MongoDB."
            );

        }

    };


// ======================================================
// ==================== SETTINGS ========================
// ======================================================

settingsBtn.onclick =
    () =>
        settingsModal.setAttribute(
            "aria-hidden",
            "false"
        );


closeSettings.onclick =
    () =>
        settingsModal.setAttribute(
            "aria-hidden",
            "true"
        );


saveSettings.onclick =
    () => {

        localStorage.setItem(

            "consistency_settings",

            JSON.stringify({

                threshold:
                    thresholdInput.value,

                theme:
                    themeSelect.value

            })

        );


        settingsModal.setAttribute(
            "aria-hidden",
            "true"
        );


        refreshDashboardColors();

    };


// ======================================================
// ==================== RESET LOCAL =====================
// ======================================================

resetLocalBtn.onclick =
    () => {

        tasksCache =
            [];


        saveTasksToLocal();


        refreshDashboardColors();


        renderMainToday();

    };


// ======================================================
// ==================== REFRESH =========================
// ======================================================

refreshBtn.onclick =
    loadAllForUser;


// ======================================================
// ==================== LOAD & SYNC =====================
// ======================================================

async function loadAllForUser() {

    buildGrid();


    refreshDashboardColors();


    renderMainToday();


    if (!currentUser) return;


    const serverTasks =
        await fetchTasksFromServer();


    tasksCache =
        serverTasks;


    saveTasksToLocal();


    refreshDashboardColors();


    renderMainToday();

}


// ======================================================
// ==================== INITIAL SETUP ===================
// ======================================================

(function init() {

    todayLabel.textContent =
        new Date().toDateString();


    const set =
        JSON.parse(

            localStorage.getItem(
                "consistency_settings"
            ) || "{}"

        );


    if (set.threshold) {

        thresholdInput.value =
            set.threshold;

    }


    if (set.theme) {

        document.documentElement
            .setAttribute(
                "data-theme",
                set.theme
            );

    }


    buildGrid();


    loadTasksFromLocal();


    refreshDashboardColors();


    renderMainToday();

})();


// ======================================================
// ==================== MONGODB AUTH ====================
// ======================================================

const savedUser =
    localStorage.getItem(
        "currentUser"
    );


if (!savedUser) {

    window.location.href =
        "login.html";

}


else {

    try {

        currentUser =
            JSON.parse(
                savedUser
            );


        loadAllForUser();


    } catch (error) {

        console.error(
            "Invalid user data:",
            error
        );


        localStorage.removeItem(
            "currentUser"
        );


        window.location.href =
            "login.html";

    }

}