
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const dashboard = $("calendarDashboard");

    // =========================================
    // NOTIFICATIONS
    // =========================================

    let toastTimeout;

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
    // USER PROFILE
    // =========================================

    async function loadUsername() {
        let username = "";

        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user || data;

                username = user.username || user.name || "";
            }
        } catch {
            // Fall back to locally saved username if necessary.
        }

        if (!username) {
            try {
                username =
                    localStorage.getItem("username") ||
                    localStorage.getItem("userName") ||
                    localStorage.getItem("currentUsername") ||
                    "";

                if (!username) {
                    const savedUser = localStorage.getItem("currentUser");

                    if (savedUser) {
                        const user = JSON.parse(savedUser);
                        username = user.username || user.name || "";
                    }
                }
            } catch {
                // Use the default username.
            }
        }

        const displayName = username.trim() || "username";

        $("profileUsername").textContent = displayName;
        $("profileDialogName").textContent = displayName;
    }

    loadUsername();

    $("profileButton").addEventListener("click", () => {
        $("profileDialog").showModal();
    });

    $("closeProfileButton").addEventListener("click", () => {
        $("profileDialog").close();
    });

    $("profileDialog").addEventListener("click", event => {
        if (event.target === $("profileDialog")) {
            $("profileDialog").close();
        }
    });

    // =========================================
    // TIMER & AUDIO SYSTEM
    // =========================================

    const TIMER_STATE_KEY = "studyQuestTimerState";
    const TIMER_PREFS_KEY = "studyQuestTimerPrefs";

    // Core Timer State
    let timerInterval = null;
    let timerRunning = false;
    let startedAt = null;

    let elapsedMs = 0;
    let remainingMs = 0;
    let initialDurationMs = 0;
    let alarmTarget = null;

    // Independent Reminder Alarm State
    let reminderEnabled = true;
    let reminderThresholdMs = 10 * 60 * 1000; // Default 10 minutes (600,000 ms)
    let reminderTriggered = false; // Ensures triggers only once per countdown cycle
    let reminderAlarmActive = false;
    let reminderAlarmInterval = null;

    // Completion Alarm State
    let completionAlarmActive = false;
    let completionAlarmInterval = null;

    // Audio & Settings State
    let audioContext = null;
    let soundEnabled = true;
    let reminderSound = "chime";
    let completionSound = "triumph";

    // Live Edit State
    let isLiveEditing = false;

    function mode() {
        return $("timerMode").value;
    }

    function formatTime(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            String(hours).padStart(2, "0"),
            String(minutes).padStart(2, "0"),
            String(seconds).padStart(2, "0")
        ].join(":");
    }

    function formatDurationLabel(milliseconds) {
        const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
        return parts.join(" ");
    }

    function stopTimerInterval() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function getCurrentValue() {
        if (!timerRunning || startedAt === null) {
            return mode() === "stopwatch" ? elapsedMs : remainingMs;
        }

        const difference = Date.now() - startedAt;

        if (mode() === "stopwatch") {
            return elapsedMs + difference;
        }

        return Math.max(0, remainingMs - difference);
    }

    function updateTimerDisplay() {
        const currentVal = getCurrentValue();
        $("timerDisplay").textContent = formatTime(currentVal);

        const progress = mode() === "stopwatch"
            ? 0
            : initialDurationMs > 0
                ? 100 * (1 - currentVal / initialDurationMs)
                : 0;

        $("timerProgress").style.width =
            `${Math.max(0, Math.min(100, progress))}%`;

        updateReminderBanner(currentVal);
    }

    function publishTimerState() {
        try {
            localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({
                mode: mode(),
                running: timerRunning,
                startedAt,
                valueMs: mode() === "stopwatch" ? elapsedMs : remainingMs,
                status: $("timerStatus").textContent
            }));
        } catch {
            showToast("Unable to sync the timer with the home page.");
        }
    }

    function updateTimerButtons() {
        $("startTimer").disabled = timerRunning;
        $("pauseTimer").disabled = !timerRunning;
    }

    // =========================================
    // AUDIO SYNTHESIS & CUSTOM SOUNDS
    // =========================================

    function getAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;

        if (!audioContext || audioContext.state === "closed") {
            try {
                audioContext = new AudioContextClass();
            } catch {
                return null;
            }
        }

        if (audioContext && audioContext.state === "suspended") {
            audioContext.resume().catch(() => {});
        }

        return audioContext;
    }

    function playTone(type) {
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;

            if (type === "beep") {
                // Digital double beep
                [0, 0.16].forEach(delay => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime( delay === 0 ? 880 : 1174, now + delay);
                    gain.gain.setValueAtTime(0.0001, now + delay);
                    gain.gain.exponentialRampToValueAtTime(0.22, now + delay + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.12);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + delay);
                    osc.stop(now + delay + 0.13);
                });
            } else if (type === "chime") {
                // Melodic harmonic bell chord (C5, E5, G5, C6)
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const noteStart = now + idx * 0.1;
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(freq, noteStart);
                    gain.gain.setValueAtTime(0.0001, noteStart);
                    gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.025);
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.55);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(noteStart);
                    osc.stop(noteStart + 0.6);
                });
            } else if (type === "marimba") {
                // Warm wooden marimba triad
                const notes = [440, 554.37, 659.25];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const noteStart = now + idx * 0.11;
                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freq, noteStart);
                    gain.gain.setValueAtTime(0.0001, noteStart);
                    gain.gain.exponentialRampToValueAtTime(0.25, noteStart + 0.015);
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.32);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(noteStart);
                    osc.stop(noteStart + 0.35);
                });
            } else if (type === "bell") {
                // Rich singing bell with overtone resonance
                const baseFreq = 587.33; // D5
                [1, 2, 3].forEach(mult => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(baseFreq * mult, now);
                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.exponentialRampToValueAtTime(0.16 / mult, now + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 1.15);
                });
            } else if (type === "triumph") {
                // Celebratory triumphant fanfare: G4 -> C5 -> E5 -> G5
                const notes = [
                    { f: 392.00, d: 0.14, s: 0 },
                    { f: 523.25, d: 0.14, s: 0.14 },
                    { f: 659.25, d: 0.16, s: 0.28 },
                    { f: 783.99, d: 0.85, s: 0.44 }
                ];
                notes.forEach(note => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const noteStart = now + note.s;
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(note.f, noteStart);
                    gain.gain.setValueAtTime(0.0001, noteStart);
                    gain.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.025);
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.d);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(noteStart);
                    osc.stop(noteStart + note.d + 0.05);
                });
            }
        } catch {
            // Audio context failure gracefully caught
        }
    }

    // =========================================
    // REMINDER & COMPLETION ALARM CONTROLLERS
    // =========================================

    function triggerReminderAlarm() {
        reminderTriggered = true;
        reminderAlarmActive = true;
        $("dismissReminderAlarm").hidden = false;
        $("dismissReminderButton").hidden = false;
        updateReminderBanner();

        const label = formatDurationLabel(reminderThresholdMs);
        showToast(`🔔 Reminder Alarm: ${label} remaining!`);

        playTone(reminderSound);

        if (reminderAlarmInterval !== null) {
            clearInterval(reminderAlarmInterval);
        }

        let loopCount = 0;
        reminderAlarmInterval = setInterval(() => {
            loopCount++;
            if (!reminderAlarmActive || loopCount >= 5) {
                stopReminderAlarmSound();
                return;
            }
            playTone(reminderSound);
        }, 2600);
    }

    function stopReminderAlarmSound() {
        reminderAlarmActive = false;
        if (reminderAlarmInterval !== null) {
            clearInterval(reminderAlarmInterval);
            reminderAlarmInterval = null;
        }
        $("dismissReminderAlarm").hidden = true;
        $("dismissReminderButton").hidden = true;
        updateReminderBanner();
    }

    function triggerCompletionAlarm() {
        stopCompletionAlarmSound();
        completionAlarmActive = true;
        $("dismissAlarm").hidden = false;

        playTone(completionSound);

        if (completionAlarmInterval !== null) {
            clearInterval(completionAlarmInterval);
        }

        completionAlarmInterval = setInterval(() => {
            if (!completionAlarmActive) {
                stopCompletionAlarmSound();
                return;
            }
            playTone(completionSound);
        }, 2200);
    }

    function stopCompletionAlarmSound() {
        completionAlarmActive = false;
        if (completionAlarmInterval !== null) {
            clearInterval(completionAlarmInterval);
            completionAlarmInterval = null;
        }
        $("dismissAlarm").hidden = true;
    }

    function stopAllAlarms() {
        stopReminderAlarmSound();
        stopCompletionAlarmSound();
    }

    // =========================================
    // PERSISTENT ON-SCREEN TIME REMINDER BANNER
    // =========================================

    function updateReminderBanner(currentVal) {
        const banner = $("timerReminderBanner");
        const textEl = $("reminderBannerText");
        const iconEl = $("reminderBannerIcon");
        const dismissBtn = $("dismissReminderButton");

        if (mode() !== "countdown" || !reminderEnabled || reminderThresholdMs <= 0) {
            banner.hidden = true;
            return;
        }

        banner.hidden = false;
        const thresholdLabel = formatDurationLabel(reminderThresholdMs);

        if (reminderAlarmActive) {
            banner.classList.add("active-alarm");
            banner.classList.remove("triggered");
            iconEl.textContent = "🔔";
            textEl.textContent = `REMINDER ALARM: ${thresholdLabel} remaining!`;
            dismissBtn.hidden = false;
        } else if (reminderTriggered) {
            banner.classList.remove("active-alarm");
            banner.classList.add("triggered");
            iconEl.textContent = "✓";
            textEl.textContent = `Reminder reached: ${thresholdLabel} left`;
            dismissBtn.hidden = true;
        } else {
            banner.classList.remove("active-alarm", "triggered");
            iconEl.textContent = "⏰";
            textEl.textContent = `Reminder: ${thresholdLabel} left`;
            dismissBtn.hidden = true;
        }
    }

    // =========================================
    // DURATION & REMINDER PARSING
    // =========================================

    function getCountdownDurationFromInputs() {
        const hours = Math.max(0, Math.min(99, Number($("countdownHours").value) || 0));
        const minutes = Math.max(0, Math.min(59, Number($("countdownMinutes").value) || 0));
        const seconds = Math.max(0, Math.min(59, Number($("countdownSeconds").value) || 0));

        const duration = (hours * 3600 + minutes * 60 + seconds) * 1000;
        return duration > 0 ? duration : null;
    }

    function getReminderThresholdFromInputs() {
        const hours = Math.max(0, Math.min(99, Number($("reminderHours").value) || 0));
        const minutes = Math.max(0, Math.min(59, Number($("reminderMinutes").value) || 0));
        const seconds = Math.max(0, Math.min(59, Number($("reminderSeconds").value) || 0));

        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    function syncReminderThresholdFromInputs() {
        reminderThresholdMs = getReminderThresholdFromInputs();
        reminderEnabled = $("reminderAlarmEnabled").checked;

        // If threshold was adjusted higher than remaining time, re-arm trigger
        const currentVal = getCurrentValue();
        if (currentVal > reminderThresholdMs) {
            reminderTriggered = false;
            if (reminderAlarmActive) stopReminderAlarmSound();
        }

        updateReminderBanner(currentVal);
        saveTimerPreferences();
    }

    function getAlarmDuration() {
        const value = $("alarmTime").value;

        if (!value) {
            showToast("Please select an alarm time first.");
            return null;
        }

        const [hours, minutes] = value.split(":").map(Number);
        const now = new Date();
        const target = new Date(now);

        target.setHours(hours, minutes, 0, 0);

        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }

        alarmTarget = target;
        return target.getTime() - now.getTime();
    }

    // =========================================
    // PREFERENCES (LOCALSTORAGE)
    // =========================================

    function loadTimerPreferences() {
        try {
            const saved = JSON.parse(localStorage.getItem(TIMER_PREFS_KEY) || "{}");

            if (typeof saved.countdownHours === "number") $("countdownHours").value = saved.countdownHours;
            if (typeof saved.countdownMinutes === "number") $("countdownMinutes").value = saved.countdownMinutes;
            if (typeof saved.countdownSeconds === "number") $("countdownSeconds").value = saved.countdownSeconds;

            if (typeof saved.reminderEnabled === "boolean") {
                reminderEnabled = saved.reminderEnabled;
                $("reminderAlarmEnabled").checked = reminderEnabled;
            }
            if (typeof saved.reminderHours === "number") $("reminderHours").value = saved.reminderHours;
            if (typeof saved.reminderMinutes === "number") $("reminderMinutes").value = saved.reminderMinutes;
            if (typeof saved.reminderSeconds === "number") $("reminderSeconds").value = saved.reminderSeconds;

            if (typeof saved.soundEnabled === "boolean") {
                soundEnabled = saved.soundEnabled;
                $("soundEnabledToggle").checked = soundEnabled;
            }
            if (saved.reminderSound) {
                reminderSound = saved.reminderSound;
                $("reminderSoundSelect").value = reminderSound;
            }
            if (saved.completionSound) {
                completionSound = saved.completionSound;
                $("completionSoundSelect").value = completionSound;
            }
        } catch {
            // Use defaults
        }

        reminderThresholdMs = getReminderThresholdFromInputs();
        reminderEnabled = $("reminderAlarmEnabled").checked;
    }

    function saveTimerPreferences() {
        try {
            localStorage.setItem(TIMER_PREFS_KEY, JSON.stringify({
                countdownHours: Number($("countdownHours").value) || 0,
                countdownMinutes: Number($("countdownMinutes").value) || 25,
                countdownSeconds: Number($("countdownSeconds").value) || 0,
                reminderEnabled: $("reminderAlarmEnabled").checked,
                reminderHours: Number($("reminderHours").value) || 0,
                reminderMinutes: Number($("reminderMinutes").value) || 10,
                reminderSeconds: Number($("reminderSeconds").value) || 0,
                soundEnabled,
                reminderSound,
                completionSound
            }));
        } catch {
            // Ignore storage errors
        }
    }

    // =========================================
    // LIVE EDIT & QUICK ADJUST CONTROLLERS
    // =========================================

    function toggleLiveEditMode() {
        if (isLiveEditing) {
            cancelLiveEditMode();
        } else {
            enterLiveEditMode();
        }
    }

    function enterLiveEditMode() {
        isLiveEditing = true;
        $("countdownSettings").hidden = false;
        $("liveEditBadge").hidden = !timerRunning;
        $("editTimerActions").hidden = false;
        $("editTimerButton").textContent = "✕ Close Edit";

        // Pre-fill inputs with current remaining time
        const currentVal = getCurrentValue();
        const totalSec = Math.max(0, Math.ceil(currentVal / 1000));
        $("countdownHours").value = Math.floor(totalSec / 3600);
        $("countdownMinutes").value = Math.floor((totalSec % 3600) / 60);
        $("countdownSeconds").value = totalSec % 60;
    }

    function cancelLiveEditMode() {
        isLiveEditing = false;
        $("liveEditBadge").hidden = true;
        $("editTimerActions").hidden = true;
        $("editTimerButton").textContent = "✏️ Edit Timer";

        if (timerRunning) {
            $("countdownSettings").hidden = true;
        }
    }

    function applyLiveDurationEdit() {
        const newDuration = getCountdownDurationFromInputs();
        if (newDuration === null || newDuration <= 0) {
            showToast("Please enter a countdown greater than zero.");
            return;
        }

        remainingMs = newDuration;
        initialDurationMs = Math.max(initialDurationMs, newDuration);

        if (timerRunning) {
            startedAt = Date.now();
        }

        if (newDuration > reminderThresholdMs) {
            reminderTriggered = false;
            if (reminderAlarmActive) stopReminderAlarmSound();
        }

        saveTimerPreferences();
        cancelLiveEditMode();
        updateTimerDisplay();
        publishTimerState();
        showToast("Timer duration updated successfully.");
    }

    function adjustRemainingTime(secondsDelta) {
        if (mode() !== "countdown") return;

        const msDelta = secondsDelta * 1000;
        const currentVal = getCurrentValue();
        const newVal = Math.max(0, currentVal + msDelta);

        if (newVal <= 0) {
            finishTimer();
            return;
        }

        remainingMs = newVal;
        initialDurationMs = Math.max(initialDurationMs, newVal);

        if (timerRunning) {
            startedAt = Date.now();
        }

        if (newVal > reminderThresholdMs) {
            reminderTriggered = false;
            if (reminderAlarmActive) stopReminderAlarmSound();
        }

        updateTimerDisplay();
        publishTimerState();

        const sign = secondsDelta > 0 ? "+" : "";
        const mins = Math.abs(Math.round(secondsDelta / 60));
        showToast(`Timer adjusted: ${sign}${secondsDelta > 0 ? mins : -mins} min`);
    }

    // =========================================
    // TIMER EXECUTION
    // =========================================

    function finishTimer() {
        const finishedMode = mode();

        timerRunning = false;
        startedAt = null;
        stopTimerInterval();
        stopReminderAlarmSound();

        if (finishedMode !== "stopwatch") {
            remainingMs = 0;
        }

        $("timerStatus").textContent =
            finishedMode === "stopwatch"
                ? "Study session stopped."
                : finishedMode === "countdown"
                    ? "Countdown complete!"
                    : "Alarm is ringing!";

        updateTimerButtons();
        updateTimerDisplay();
        publishTimerState();

        if (finishedMode !== "stopwatch") {
            showToast(
                finishedMode === "countdown"
                    ? "Time is up! Great work on your study session."
                    : "Your alarm is ringing!"
            );

            triggerCompletionAlarm();
        }
    }

    function tickTimer() {
        const currentVal = getCurrentValue();

        if (mode() === "countdown") {
            // Independent Reminder Alarm Evaluation
            if (
                reminderEnabled &&
                !reminderTriggered &&
                currentVal <= reminderThresholdMs &&
                currentVal > 0
            ) {
                triggerReminderAlarm();
            }

            // Completion Evaluation
            if (currentVal <= 0) {
                finishTimer();
                return;
            }
        } else if (mode() === "alarm" && currentVal <= 0) {
            finishTimer();
            return;
        }

        updateTimerDisplay();
    }

    function startTimer() {
        if (timerRunning) return;

        const selectedMode = mode();

        if (selectedMode === "countdown" && remainingMs <= 0) {
            const duration = getCountdownDurationFromInputs();

            if (duration === null) {
                showToast("Set a countdown greater than zero.");
                return;
            }

            remainingMs = duration;
            initialDurationMs = duration;
            reminderTriggered = false;
        }

        if (selectedMode === "alarm" && remainingMs <= 0) {
            const duration = getAlarmDuration();

            if (duration === null) return;

            remainingMs = duration;
            initialDurationMs = duration;
        }

        // Initialize AudioContext on user interaction
        if (soundEnabled && selectedMode !== "stopwatch") {
            getAudioContext();
        }

        timerRunning = true;
        startedAt = Date.now();

        const status = {
            stopwatch: "Study session in progress!",
            countdown: "Countdown is running...",
            alarm: alarmTarget
                ? `Alarm set for ${alarmTarget.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                })}`
                : "Alarm is running..."
        };

        $("timerStatus").textContent = status[selectedMode];

        stopTimerInterval();
        timerInterval = setInterval(tickTimer, 200);

        if (selectedMode === "countdown") {
            if (!isLiveEditing) {
                $("countdownSettings").hidden = true;
            }
            $("quickAdjustButtons").hidden = false;
            $("editTimerButton").hidden = false;
        }

        updateTimerButtons();
        updateTimerDisplay();
        publishTimerState();
    }

    function pauseTimer() {
        if (!timerRunning) return;

        const currentValue = getCurrentValue();

        if (mode() === "stopwatch") {
            elapsedMs = currentValue;
        } else {
            remainingMs = currentValue;
        }

        timerRunning = false;
        startedAt = null;

        stopTimerInterval();

        $("timerStatus").textContent = "Timer paused.";

        updateTimerButtons();
        updateTimerDisplay();
        publishTimerState();
    }

    function resetTimer() {
        timerRunning = false;
        startedAt = null;

        stopTimerInterval();
        stopAllAlarms();

        elapsedMs = 0;
        remainingMs = 0;
        initialDurationMs = 0;
        alarmTarget = null;
        reminderTriggered = false;

        cancelLiveEditMode();

        $("timerStatus").textContent = "Ready to study?";

        if (mode() === "countdown") {
            $("countdownSettings").hidden = false;
            const presetDuration = getCountdownDurationFromInputs();
            if (presetDuration) {
                remainingMs = presetDuration;
                initialDurationMs = presetDuration;
            }
        }

        updateTimerButtons();
        updateTimerDisplay();
        publishTimerState();
    }

    function changeTimerMode() {
        resetTimer();

        const selectedMode = mode();

        $("countdownSettings").hidden = selectedMode !== "countdown";
        $("reminderSettings").hidden = selectedMode !== "countdown";
        $("quickAdjustButtons").hidden = selectedMode !== "countdown";
        $("editTimerButton").hidden = selectedMode !== "countdown";
        $("timerReminderBanner").hidden = selectedMode !== "countdown" || !reminderEnabled;

        $("alarmSettings").hidden = selectedMode !== "alarm";

        const headings = {
            stopwatch: "STOPWATCH",
            countdown: "COUNTDOWN",
            alarm: "ALARM CLOCK"
        };

        const hints = {
            stopwatch: "Track how long you spend on a task.",
            countdown: "Set a duration and receive an alert at zero.",
            alarm: "Choose a time for your alarm to ring."
        };

        $("timerHeading").textContent = headings[selectedMode];
        $("timerHint").textContent = hints[selectedMode];

        if (selectedMode === "countdown") {
            const dur = getCountdownDurationFromInputs();
            if (dur) {
                remainingMs = dur;
                initialDurationMs = dur;
            }
        }

        updateTimerDisplay();
    }

    // =========================================
    // EVENT LISTENERS & INITIALIZATION
    // =========================================

    $("timerMode").addEventListener("change", changeTimerMode);
    $("startTimer").addEventListener("click", startTimer);
    $("pauseTimer").addEventListener("click", pauseTimer);
    $("resetTimer").addEventListener("click", resetTimer);

    // Edit Timer
    $("editTimerButton").addEventListener("click", toggleLiveEditMode);
    $("applyDurationEdit").addEventListener("click", applyLiveDurationEdit);
    $("cancelDurationEdit").addEventListener("click", cancelLiveEditMode);

    // Inputs change when stopped updates display immediately
    ["countdownHours", "countdownMinutes", "countdownSeconds"].forEach(id => {
        $(id).addEventListener("input", () => {
            if (!timerRunning) {
                const dur = getCountdownDurationFromInputs();
                if (dur) {
                    remainingMs = dur;
                    initialDurationMs = dur;
                    reminderTriggered = false;
                    updateTimerDisplay();
                }
            }
            saveTimerPreferences();
        });
    });

    // Quick Add / Subtract Buttons
    $("quickAdjustButtons").addEventListener("click", event => {
        const btn = event.target.closest(".quick-adjust-btn");
        if (!btn) return;
        const adjustSec = Number(btn.dataset.adjust);
        if (adjustSec) {
            adjustRemainingTime(adjustSec);
        }
    });

    // Reminder Alarm Settings Changes
    $("reminderAlarmEnabled").addEventListener("change", () => {
        reminderEnabled = $("reminderAlarmEnabled").checked;
        $("reminderConfigPanel").style.opacity = reminderEnabled ? "1" : "0.5";
        $("reminderConfigPanel").style.pointerEvents = reminderEnabled ? "auto" : "none";
        syncReminderThresholdFromInputs();
    });

    ["reminderHours", "reminderMinutes", "reminderSeconds"].forEach(id => {
        $(id).addEventListener("input", () => {
            // Remove active state from preset pills
            document.querySelectorAll(".reminder-preset-btn").forEach(p => p.classList.remove("active"));
            syncReminderThresholdFromInputs();
        });
    });

    // Reminder Presets
    document.querySelectorAll(".reminder-preset-btn").forEach(presetBtn => {
        presetBtn.addEventListener("click", () => {
            document.querySelectorAll(".reminder-preset-btn").forEach(p => p.classList.remove("active"));
            presetBtn.classList.add("active");

            if (presetBtn.dataset.preset === "half") {
                const totalDur = initialDurationMs || getCountdownDurationFromInputs() || (25 * 60 * 1000);
                const halfSec = Math.floor(totalDur / 2000);
                $("reminderHours").value = Math.floor(halfSec / 3600);
                $("reminderMinutes").value = Math.floor((halfSec % 3600) / 60);
                $("reminderSeconds").value = halfSec % 60;
            } else {
                const mins = Number(presetBtn.dataset.presetM) || 10;
                $("reminderHours").value = 0;
                $("reminderMinutes").value = mins;
                $("reminderSeconds").value = 0;
            }
            syncReminderThresholdFromInputs();
        });
    });

    // Alarm Dismissals
    $("dismissReminderAlarm").addEventListener("click", () => {
        stopReminderAlarmSound();
        showToast("Reminder alarm dismissed.");
    });

    $("dismissReminderButton").addEventListener("click", () => {
        stopReminderAlarmSound();
        showToast("Reminder alarm dismissed.");
    });

    $("dismissAlarm").addEventListener("click", () => {
        stopCompletionAlarmSound();
        showToast("Completion alarm dismissed.");
    });

    // Alarm Settings Dialog
    $("openAlarmSettingsButton").addEventListener("click", () => {
        getAudioContext();
        $("alarmSettingsDialog").showModal();
    });

    $("closeAlarmSettingsButton").addEventListener("click", () => {
        $("alarmSettingsDialog").close();
    });

    $("alarmSettingsDialog").addEventListener("click", event => {
        if (event.target === $("alarmSettingsDialog")) {
            $("alarmSettingsDialog").close();
        }
    });

    $("soundEnabledToggle").addEventListener("change", () => {
        soundEnabled = $("soundEnabledToggle").checked;
        saveTimerPreferences();
    });

    $("reminderSoundSelect").addEventListener("change", () => {
        reminderSound = $("reminderSoundSelect").value;
        saveTimerPreferences();
    });

    $("completionSoundSelect").addEventListener("change", () => {
        completionSound = $("completionSoundSelect").value;
        saveTimerPreferences();
    });

    $("testReminderSoundButton").addEventListener("click", () => {
        getAudioContext();
        playTone($("reminderSoundSelect").value);
    });

    $("testCompletionSoundButton").addEventListener("click", () => {
        getAudioContext();
        playTone($("completionSoundSelect").value);
    });

    // Accurate Inactivity / Tab Visibility Handler
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && timerRunning) {
            tickTimer();
        }
    });

    // Load preferences and initialize
    loadTimerPreferences();
    changeTimerMode();

    // =========================================
    // CALENDAR TASK STORAGE
    // =========================================

    const STORAGE_KEY = "studyQuestTasks";

    function dateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function parseDateKey(key) {
        const [year, month, day] = key.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    function formatDate(date) {
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    function loadTasks() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );
            const result = Array.isArray(saved)
                ? saved.filter(task =>
                    task &&
                    typeof task.id === "string" &&
                    typeof task.title === "string" &&
                    typeof task.completed === "boolean" &&
                    ["today", "daily", "weekly"].includes(task.category)
                ).map(task => ({
                    ...task,
                    dueDate:
                        typeof task.dueDate === "string"
                            ? task.dueDate
                            : ""
                }))
                : [];

            const savedCalendarTasks = JSON.parse(
                localStorage.getItem("studyQuestCalendarTasks") || "{}"
            );

            if (
                savedCalendarTasks &&
                typeof savedCalendarTasks === "object" &&
                !Array.isArray(savedCalendarTasks)
            ) {
                Object.entries(savedCalendarTasks).forEach(([key, entries]) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) ||
                        !Array.isArray(entries)) {
                        return;
                    }

                    entries.forEach(task => {
                        if (
                            task &&
                            typeof task.id === "string" &&
                            typeof task.text === "string" &&
                            !result.some(savedTask =>
                                savedTask.id === task.id
                            )
                        ) {
                            result.push({
                                id: task.id,
                                title: task.text,
                                category: "today",
                                completed: Boolean(task.completed),
                                dueDate: key,
                                notes: ""
                            });
                        }
                    });
                });
            }

            return result;
        } catch {
            return [];
        }
    }

    let tasks = loadTasks();

    function tasksForDate(key) {
        return tasks.filter(task => task.dueDate === key);
    }

    function saveTasks() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(tasks)
            );
        } catch {
            showToast("Unable to save tasks in this browser.");
        }
    }

    // =========================================
    // CALENDAR RENDERING
    // =========================================

    const now = new Date();

    let displayedYear = now.getFullYear();
    let displayedMonth = now.getMonth();
    let selectedDate = dateKey(now);

    function renderCalendar() {
        const firstDay = new Date(
            displayedYear,
            displayedMonth,
            1
        );

        $("monthYear").textContent =
            firstDay.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric"
            });

        const calendarDays = $("calendarDays");
        calendarDays.replaceChildren();

        const startingWeekday = firstDay.getDay();
        const todayKey = dateKey(new Date());

        for (let index = 0; index < 42; index++) {
            const dayNumber = index - startingWeekday + 1;

            const date = new Date(
                displayedYear,
                displayedMonth,
                dayNumber
            );

            const key = dateKey(date);

            const button = document.createElement("button");
            button.type = "button";
            button.className = "calendar-day";
            button.textContent = date.getDate();

            const isCurrentMonth =
                date.getMonth() === displayedMonth;
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const hasTasks = tasksForDate(key).length > 0;

            button.setAttribute(
                "aria-label",
                `${formatDate(date)}${hasTasks ? ", has tasks" : ""}`
            );

            button.setAttribute(
                "aria-pressed",
                String(isSelected)
            );

            if (!isCurrentMonth) {
                button.classList.add("other-month");
            }

            if (isToday) button.classList.add("today");
            if (isSelected) button.classList.add("selected");
            if (hasTasks) button.classList.add("has-tasks");

            button.addEventListener("click", () => {
                selectedDate = key;
                displayedYear = date.getFullYear();
                displayedMonth = date.getMonth();

                renderCalendar();
                renderSelectedDateTasks();
            });

            calendarDays.appendChild(button);
        }
    }

    // =========================================
    // TASK LIST FOR SELECTED DATE
    // =========================================

    function renderSelectedDateTasks() {
        $("selectedDate").textContent =
            formatDate(parseDateKey(selectedDate));

        const list = $("calendarTaskList");
        const emptyMessage = $("emptyMessage");
        const dayTasks = tasksForDate(selectedDate);

        list.replaceChildren();
        emptyMessage.hidden = dayTasks.length > 0;

        dayTasks.forEach(task => {
            const item = document.createElement("div");
            item.className = "calendar-task-item";

            if (task.completed) {
                item.classList.add("completed");
            }

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "calendar-task-checkbox";
            checkbox.checked = task.completed;
            checkbox.setAttribute(
                "aria-label",
                `Mark ${task.title} as completed`
            );

            checkbox.addEventListener("change", () => {
                task.completed = checkbox.checked;

                saveTasks();
                renderCalendar();
                renderSelectedDateTasks();

                showToast(
                    task.completed
                        ? "Quest completed! Great job!"
                        : "Task marked as incomplete."
                );
            });

            const name = document.createElement("span");
            name.className = "calendar-task-text";
            name.textContent = task.title;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-calendar-task";
            deleteButton.textContent = "×";
            deleteButton.setAttribute("aria-label", "Delete task");

            deleteButton.addEventListener("click", () => {
                tasks = tasks.filter(
                    savedTask => savedTask.id !== task.id
                );

                saveTasks();
                renderCalendar();
                renderSelectedDateTasks();
                showToast("Calendar task deleted.");
            });

            item.append(checkbox, name, deleteButton);
            list.appendChild(item);
        });
    }

    // =========================================
    // ADD TASK DIALOG
    // =========================================

    const taskDialog = $("taskDialog");
    const taskForm = $("calendarTaskForm");
    const taskTitle = $("calendarTaskTitle");

    $("addCalendarTask").addEventListener("click", () => {
        taskForm.reset();

        $("taskDialogTitle").textContent = "Add a calendar task";
        $("taskDialogDate").textContent =
            formatDate(parseDateKey(selectedDate));

        taskDialog.showModal();
        taskTitle.focus();
    });

    taskForm.addEventListener("submit", event => {
        event.preventDefault();

        const title = taskTitle.value.trim();

        if (!title) {
            showToast("Please enter a task name.");
            taskTitle.focus();
            return;
        }

        tasks.push({
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            title,
            category: "today",
            completed: false,
            dueDate: selectedDate,
            notes: ""
        });

        saveTasks();
        renderCalendar();
        renderSelectedDateTasks();

        taskDialog.close();
        showToast("New calendar task added!");
    });

    $("cancelTaskButton").addEventListener("click", () => {
        taskDialog.close();
    });

    taskDialog.addEventListener("click", event => {
        if (event.target === taskDialog) {
            taskDialog.close();
        }
    });

    // =========================================
    // CALENDAR NAVIGATION
    // =========================================

    $("prevMonth").addEventListener("click", () => {
        const date = new Date(
            displayedYear,
            displayedMonth - 1,
            1
        );

        displayedYear = date.getFullYear();
        displayedMonth = date.getMonth();

        renderCalendar();
    });

    $("nextMonth").addEventListener("click", () => {
        const date = new Date(
            displayedYear,
            displayedMonth + 1,
            1
        );

        displayedYear = date.getFullYear();
        displayedMonth = date.getMonth();

        renderCalendar();
    });

    $("todayButton").addEventListener("click", () => {
        const today = new Date();

        displayedYear = today.getFullYear();
        displayedMonth = today.getMonth();
        selectedDate = dateKey(today);

        renderCalendar();
        renderSelectedDateTasks();

        showToast("Showing today's schedule.");
    });

    // =========================================
    // INITIALIZE
    // =========================================

    renderCalendar();
    renderSelectedDateTasks();
});
