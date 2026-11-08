
document.addEventListener("DOMContentLoaded", () => {
    const dashboard = document.getElementById("protectedHome");

    // Stop if the protected dashboard is not present.
    if (!dashboard) return;

    const $ = (id) => document.getElementById(id);

    const TASKS_KEY = "studyQuestTasks";
    const TIMER_STATE_KEY = "studyQuestTimerState";

    const categories = {
        today: {
            list: "todayTaskList",
            count: "todayCount"
        },
        daily: {
            list: "dailyTaskList",
            count: "dailyCount"
        },
        weekly: {
            list: "weeklyTaskList",
            count: "weeklyCount"
        }
    };

    let tasks = loadTasks();
    // Safely load tasks saved in this browser.
    function loadTasks() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(TASKS_KEY) ||
                localStorage.getItem("studyQuestHomeTasks")
            );

            if (!Array.isArray(saved)) return [];

            return saved.filter(task =>
                task &&
                typeof task.id === "string" &&
                typeof task.title === "string" &&
                ["today", "daily", "weekly"].includes(task.category) &&
                typeof task.completed === "boolean"
            );
        } catch {
            return [];
        }
    }

    // Current date.
    function updateDate() {
        const now = new Date();

        $("dateDay").textContent = String(now.getDate()).padStart(2, "0");

        $("dateMonth").textContent = now.toLocaleDateString("en-US", {
            month: "long"
        });

        $("dateYear").textContent = now.getFullYear();

        $("dateWeekday").textContent = now.toLocaleDateString("en-US", {
            weekday: "long"
        });
    }

    updateDate();

    // Check again periodically in case the date changes at midnight.
    setInterval(updateDate, 60_000);

    // Display the signed-in username when it is available.
    function updateUsername() {
        let username = "";

        try {
            username =
                localStorage.getItem("username") ||
                localStorage.getItem("userName") ||
                localStorage.getItem("currentUsername") ||
                "";

            if (!username) {
                const currentUser = localStorage.getItem("currentUser");

                if (currentUser) {
                    const user = JSON.parse(currentUser);

                    if (typeof user === "object" && user !== null) {
                        username =
                            user.username ||
                            user.userName ||
                            user.name ||
                            user.email ||
                            "";
                    }
                }
            }
        } catch {
            // Use the default label if the saved value is unavailable.
        }

        const displayName = username.trim() || "username";

        $("profileUsername").textContent = displayName;
        $("welcomeText").textContent =
            displayName === "username"
                ? "Your journey starts here."
                : `Welcome back, ${displayName}! Ready for today's quest?`;
    }

    updateUsername();

    // Render the tasks in their respective widgets.
    function renderTasks() {
        Object.entries(categories).forEach(([category, elements]) => {
            const list = $(elements.list);
            const categoryTasks = tasks.filter(
                task => task.category === category
            );

            $(elements.count).textContent = categoryTasks.length;
            list.replaceChildren();

            if (categoryTasks.length === 0) {
                const empty = document.createElement("p");
                empty.className = "empty-state";

                const emptyMessages = {
                    today: "No tasks yet. Add your first task!",
                    daily: "Your daily checklist is empty.",
                    weekly: "No weekly goals added yet."
                };

                empty.textContent = emptyMessages[category];
                list.appendChild(empty);
                return;
            }

            categoryTasks.forEach(task => {
                const item = document.createElement("div");
                item.className = "task-item";

                if (task.completed) {
                    item.classList.add("completed");
                }

                const name = document.createElement("span");
                name.className = "task-name";
                name.textContent = task.title;

                item.appendChild(name);
                list.appendChild(item);
            });
        });

        const completed = tasks.filter(task => task.completed).length;
        const incomplete = tasks.length - completed;

        $("completedCount").textContent = completed;
        $("incompleteCount").textContent = incomplete;
    }

    renderTasks();

    function formatTime(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [hours, minutes, seconds]
            .map(value => String(value).padStart(2, "0"))
            .join(":");
    }

    function renderTimer() {
        let state = null;

        try {
            state = JSON.parse(localStorage.getItem(TIMER_STATE_KEY) || "null");
        } catch {
            state = null;
        }

        if (!state || typeof state.valueMs !== "number") {
            $("studyTime").textContent = "00:00:00";
            $("timerStatus").textContent = "OPEN CALENDAR & TIME TO START";
            return;
        }

        const elapsed = state.running && state.startedAt
            ? Date.now() - state.startedAt
            : 0;
        const value = state.mode === "stopwatch"
            ? state.valueMs + elapsed
            : Math.max(0, state.valueMs - elapsed);

        $("studyTime").textContent = formatTime(value);
        $("timerStatus").textContent = state.status;
    }

    renderTimer();
    setInterval(renderTimer, 500);
    window.addEventListener("storage", event => {
        if (event.key === TIMER_STATE_KEY) renderTimer();
    });

    // Respect the current authentication script's logout button.
    // Logout behavior remains managed by auth.js.
});
