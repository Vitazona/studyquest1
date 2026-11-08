
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    const dashboard = $("protectedTasks");
    const authStatus = $("authStatus");

    const taskDialog = $("taskDialog");
    const taskForm = $("taskForm");
    const taskTitle = $("taskTitle");
    const taskCategory = $("taskCategory");
    const taskDueDate = $("taskDueDate");
    const taskNotes = $("taskNotes");

    const profileDialog = $("profileDialog");
    const deleteDialog = $("deleteDialog");

    const TASKS_KEY = "studyQuestTasks";

    const categories = {
        today: {
            list: "todayTaskList",
            count: "todayCount",
            emptyTitle: "No tasks for today",
            emptyText: "Add a task and start your quest."
        },
        daily: {
            list: "dailyTaskList",
            count: "dailyCount",
            emptyTitle: "Your daily checklist is empty",
            emptyText: "Build your daily routine one task at a time."
        },
        weekly: {
            list: "weeklyTaskList",
            count: "weeklyCount",
            emptyTitle: "No weekly goals yet",
            emptyText: "Set a goal to work toward this week."
        }
    };

    let tasks = [];
    let editingTaskId = null;
    let deletingTaskId = null;
    let toastTimeout = null;
    let currentUsername = "username";

    // =========================================
    // AUTHENTICATION
    // =========================================

    async function initializePage() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (!response.ok) {
                window.location.replace("/login");
                return;
            }

            const data = await response.json();
            const user = data.user || data;

            currentUsername =
                user.username ||
                user.name ||
                user.email ||
                "username";

            $("profileUsername").textContent = currentUsername;
            $("profileDialogName").textContent = currentUsername;

            tasks = loadTasks();

            if (authStatus) {
                authStatus.hidden = true;
            }

            dashboard.hidden = false;

            renderTasks();
            updateOverview();
        } catch (error) {
            console.error("Unable to verify the user session:", error);

            if (authStatus) {
                authStatus.textContent =
                    "Unable to connect to the server. Please start your backend and refresh.";
            }
        }
    }

    $("logoutButton").addEventListener("click", async () => {
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!response.ok) {
                showToast("Unable to log out. Please try again.");
                return;
            }

            window.location.replace("/login");
        } catch {
            showToast("Unable to connect to the server.");
        }
    });

    // =========================================
    // TOAST NOTIFICATIONS
    // =========================================

    function showToast(message) {
        const toast = $("toast");

        clearTimeout(toastTimeout);

        toast.textContent = message;
        toast.hidden = false;

        toastTimeout = setTimeout(() => {
            toast.hidden = true;
        }, 3000);
    }

    // =========================================
    // TASK STORAGE
    // =========================================

    function loadTasks() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(TASKS_KEY) ||
                localStorage.getItem("studyQuestHomeTasks")
            );

            if (!Array.isArray(saved)) {
                return [];
            }

            return saved
                .filter(task =>
                    task &&
                    typeof task.id === "string" &&
                    typeof task.title === "string" &&
                    typeof task.completed === "boolean" &&
                    Object.hasOwn(categories, task.category)
                )
                .map(task => ({
                    id: task.id,
                    title: task.title,
                    category: task.category,
                    completed: task.completed,
                    dueDate:
                        typeof task.dueDate === "string"
                            ? task.dueDate
                            : "",
                    notes:
                        typeof task.notes === "string"
                            ? task.notes
                            : ""
                }));
        } catch {
            return [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(
                TASKS_KEY,
                JSON.stringify(tasks)
            );

            return true;
        } catch (error) {
            console.error("Unable to save tasks:", error);
            showToast("Unable to save tasks in this browser.");
            return false;
        }
    }

    function createTaskId() {
        return globalThis.crypto?.randomUUID
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    // =========================================
    // TASK DATES
    // =========================================

    function parseDate(value) {
        if (!value) return null;

        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

        if (!match) return null;

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);

        const date = new Date(year, month - 1, day);

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    function todayKey() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${now.getFullYear()}-${month}-${day}`;
    }

    function formatDate(value) {
        const date = parseDate(value);

        if (!date) return "";

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function getDateClass(value) {
        if (!value) return "";

        const today = todayKey();

        if (value < today) return "overdue";
        if (value === today) return "due-today";

        return "";
    }

    // =========================================
    // TASK FILTER
    // =========================================

    function getVisibleTasks(category) {
        const filter = $("taskFilter").value;

        return tasks.filter(task => {
            if (task.category !== category) return false;

            if (filter === "completed" && !task.completed) {
                return false;
            }

            if (filter === "incomplete" && task.completed) {
                return false;
            }

            return true;
        });
    }

    $("taskFilter").addEventListener("change", renderTasks);

    // =========================================
    // TASK CARD CREATION
    // =========================================

    function createTaskCard(task) {
        const card = document.createElement("article");
        card.className = "task-card";

        if (task.completed) {
            card.classList.add("completed");
        }

        const top = document.createElement("div");
        top.className = "task-card-top";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = task.completed;

        checkbox.setAttribute(
            "aria-label",
            `Mark ${task.title} as ${
                task.completed ? "incomplete" : "completed"
            }`
        );

        checkbox.addEventListener("change", () => {
            const previous = task.completed;
            task.completed = checkbox.checked;

            if (!saveTasks()) {
                task.completed = previous;
                renderTasks();
                return;
            }

            renderTasks();
            updateOverview();

            showToast(
                task.completed
                    ? "Quest completed! Great job!"
                    : "Task marked as incomplete."
            );
        });

        const title = document.createElement("span");
        title.className = "task-card-title";
        title.textContent = task.title;

        top.append(checkbox, title);
        card.appendChild(top);

        if (task.notes) {
            const notes = document.createElement("p");
            notes.className = "task-card-notes";
            notes.textContent = task.notes;
            card.appendChild(notes);
        }

        if (task.dueDate || task.completed) {
            const meta = document.createElement("div");
            meta.className = "task-card-meta";

            if (task.dueDate) {
                const date = document.createElement("span");
                date.className = "task-date";

                if (!task.completed) {
                    const dateClass = getDateClass(task.dueDate);

                    if (dateClass) {
                        date.classList.add(dateClass);
                    }
                }

                date.textContent = `DUE ${formatDate(task.dueDate)}`;
                meta.appendChild(date);
            }

            if (task.completed) {
                const status = document.createElement("span");
                status.className = "task-status";
                status.textContent = "COMPLETED";
                meta.appendChild(status);
            }

            card.appendChild(meta);
        }

        const actions = document.createElement("div");
        actions.className = "task-card-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "task-action-button";
        editButton.textContent = "EDIT";

        editButton.addEventListener("click", () => {
            openTaskDialog(task.category, task);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className =
            "task-action-button delete-action";
        deleteButton.textContent = "DELETE";

        deleteButton.addEventListener("click", () => {
            openDeleteDialog(task.id);
        });

        actions.append(editButton, deleteButton);
        card.appendChild(actions);

        return card;
    }

    function createEmptyState(category) {
        const info = categories[category];

        const empty = document.createElement("div");
        empty.className = "empty-category";

        const title = document.createElement("strong");
        title.textContent = info.emptyTitle;

        const description = document.createElement("p");
        description.textContent = info.emptyText;

        empty.append(title, description);

        return empty;
    }

    function createAddCard(category) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "add-task-card";
        button.setAttribute(
            "aria-label",
            `Add ${
                category === "today"
                    ? "today's"
                    : category
            } task`
        );

        const plus = document.createElement("span");
        plus.className = "plus";
        plus.textContent = "+";
        plus.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.textContent = "ADD TASK";

        button.append(plus, label);

        button.addEventListener("click", () => {
            openTaskDialog(category);
        });

        return button;
    }

    // =========================================
    // RENDER TASKS
    // =========================================

    function renderTasks() {
        Object.entries(categories).forEach(([category, info]) => {
            const list = $(info.list);
            const categoryTasks = tasks.filter(
                task => task.category === category
            );

            const visibleTasks = getVisibleTasks(category);

            $(info.count).textContent =
                `${categoryTasks.length} ${
                    categoryTasks.length === 1 ? "TASK" : "TASKS"
                }`;

            list.replaceChildren();

            if (visibleTasks.length === 0) {
                list.appendChild(createEmptyState(category));
            } else {
                visibleTasks.forEach(task => {
                    list.appendChild(createTaskCard(task));
                });
            }

            list.appendChild(createAddCard(category));
        });

        updateOverview();
    }

    // =========================================
    // TASK OVERVIEW
    // =========================================

    function updateOverview() {
        const total = tasks.length;
        const completed = tasks.filter(
            task => task.completed
        ).length;

        const remaining = total - completed;

        const percentage = total > 0
            ? Math.round((completed / total) * 100)
            : 0;

        $("totalCount").textContent = total;
        $("completedCount").textContent = completed;
        $("remainingCount").textContent = remaining;
        $("progressPercent").textContent = `${percentage}%`;
        $("progressFill").style.width = `${percentage}%`;

        $("profileCompleted").textContent = completed;
        $("profileTotal").textContent = total;
    }

    // =========================================
    // ADD AND EDIT TASK POP-UP
    // =========================================

    function openTaskDialog(category = "today", task = null) {
        editingTaskId = task ? task.id : null;

        taskForm.reset();

        $("taskDialogTitle").textContent = task
            ? "Edit your task"
            : "Add a task";

        $("saveTaskButton").textContent = task
            ? "SAVE CHANGES"
            : "SAVE TASK";

        taskCategory.value = task ? task.category : category;

        if (task) {
            taskTitle.value = task.title;
            taskDueDate.value = task.dueDate || "";
            taskNotes.value = task.notes || "";
        }

        if (!taskDialog.open) {
            taskDialog.showModal();
        }

        taskTitle.focus();
    }

    $("closeTaskDialog").addEventListener("click", () => {
        taskDialog.close();
    });

    $("cancelTaskButton").addEventListener("click", () => {
        taskDialog.close();
    });

    taskForm.addEventListener("submit", event => {
        event.preventDefault();

        const title = taskTitle.value.trim();
        const category = taskCategory.value;
        const dueDate = taskDueDate.value;
        const notes = taskNotes.value.trim();

        if (!title) {
            showToast("Please enter a task name.");
            taskTitle.focus();
            return;
        }

        if (!Object.hasOwn(categories, category)) {
            showToast("Please choose a valid task category.");
            return;
        }

        if (dueDate && !parseDate(dueDate)) {
            showToast("Please select a valid due date.");
            return;
        }

        if (notes.length > 500) {
            showToast("Notes must be 500 characters or fewer.");
            return;
        }

        if (editingTaskId) {
            const task = tasks.find(
                item => item.id === editingTaskId
            );

            if (!task) {
                showToast("This task could not be found.");
                taskDialog.close();
                return;
            }

            const previous = { ...task };

            task.title = title;
            task.category = category;
            task.dueDate = dueDate;
            task.notes = notes;

            if (!saveTasks()) {
                Object.assign(task, previous);
                return;
            }

            taskDialog.close();
            editingTaskId = null;

            renderTasks();
            showToast("Task updated successfully!");
        } else {
            const newTask = {
                id: createTaskId(),
                title,
                category,
                completed: false,
                dueDate,
                notes
            };

            tasks.push(newTask);

            if (!saveTasks()) {
                tasks = tasks.filter(
                    task => task.id !== newTask.id
                );
                return;
            }

            taskDialog.close();

            renderTasks();
            showToast("New quest added successfully!");
        }
    });

    taskDialog.addEventListener("click", event => {
        if (event.target === taskDialog) {
            taskDialog.close();
        }
    });

    taskDialog.addEventListener("close", () => {
        editingTaskId = null;
    });

    // =========================================
    // DELETE TASK CONFIRMATION
    // =========================================

    function openDeleteDialog(taskId) {
        deletingTaskId = taskId;
        deleteDialog.showModal();
    }

    $("cancelDeleteButton").addEventListener("click", () => {
        deleteDialog.close();
        deletingTaskId = null;
    });

    $("confirmDeleteButton").addEventListener("click", () => {
        if (!deletingTaskId) return;

        const previousTasks = tasks;
        const targetId = deletingTaskId;

        tasks = tasks.filter(task => task.id !== targetId);

        if (!saveTasks()) {
            tasks = previousTasks;
            return;
        }

        deletingTaskId = null;
        deleteDialog.close();

        renderTasks();
        showToast("Task deleted.");
    });

    deleteDialog.addEventListener("click", event => {
        if (event.target === deleteDialog) {
            deleteDialog.close();
            deletingTaskId = null;
        }
    });

    // =========================================
    // PROFILE POP-UP
    // =========================================

    $("profileButton").addEventListener("click", () => {
        updateOverview();
        profileDialog.showModal();
    });

    $("closeProfileButton").addEventListener("click", () => {
        profileDialog.close();
    });

    profileDialog.addEventListener("click", event => {
        if (event.target === profileDialog) {
            profileDialog.close();
        }
    });

    // =========================================
    // INITIALIZE PAGE
    // =========================================

    initializePage();
});
