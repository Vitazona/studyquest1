
"use strict";

(() => {
    let theme = "gradient";

    try {
        const saved = localStorage.getItem("studyQuestAppearance");
        const legacyTheme = localStorage.getItem("studyQuestTheme");
        const appearance = saved ? JSON.parse(saved) : null;

        if (
            appearance &&
            ["gradient", "light", "dark"].includes(appearance.theme)
        ) {
            theme = appearance.theme;
        } else if (["light", "dark"].includes(legacyTheme)) {
            theme = legacyTheme;
        }
    } catch (error) {
        console.warn("Unable to apply saved theme on auth page:", error);
    }

    document.documentElement.dataset.theme = theme;

    window.addEventListener("storage", event => {
        if (event.key !== "studyQuestAppearance") return;

        try {
            const appearance = JSON.parse(event.newValue || "{}");
            if (["gradient", "light", "dark"].includes(appearance.theme)) {
                document.documentElement.dataset.theme = appearance.theme;
            }
        } catch (error) {
            console.warn("Unable to update auth page theme:", error);
        }
    });
})();

async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");
    element.classList.add(type);
}

function passwordIsStrong(password) {
    const byteLength = new TextEncoder().encode(password).length;

    return (
        password.length >= 8 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password) &&
        byteLength <= 72
    );
}

// Show/hide password buttons
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);

        if (!input) return;

        const showPassword = input.type === "password";

        input.type = showPassword ? "text" : "password";
        button.setAttribute("aria-pressed", String(showPassword));
        button.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );
    });
});

// LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const submitButton = document.getElementById("loginSubmit");
    const message = document.getElementById("loginMessage");

    function validateLogin() {
        submitButton.disabled = !(
            username.value.trim() &&
            password.value &&
            loginForm.checkValidity()
        );
    }

    loginForm.addEventListener("input", () => {
        showMessage(message, "");
        validateLogin();
    });

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        validateLogin();

        if (!loginForm.checkValidity() || submitButton.disabled) {
            loginForm.reportValidity();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "LOGGING IN...";
        showMessage(message, "");

        try {
            await requestJSON("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    username: username.value.trim(),
                    password: password.value
                })
            });

            window.location.href = "/home";
        } catch (error) {
            showMessage(message, error.message);
            validateLogin();
        } finally {
            submitButton.textContent = "LOGIN";
            validateLogin();
        }
    });

    const params = new URLSearchParams(window.location.search);
    const savedUsername = params.get("username");

    if (savedUsername) {
        username.value = savedUsername;
        password.focus();
    }

    validateLogin();
}

// REGISTER
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    const username = document.getElementById("regUsername");
    const password = document.getElementById("regPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const email = document.getElementById("regEmail");
    const submitButton = document.getElementById("registerSubmit");
    const message = document.getElementById("registerMessage");

    function validateRegistration() {
        const usernameValid = /^[a-zA-Z0-9_]{5,30}$/.test(
            username.value.trim()
        );

        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email.value.trim()
        );

        const passwordsMatch =
            password.value === confirmPassword.value;

        const valid =
            usernameValid &&
            emailValid &&
            passwordIsStrong(password.value) &&
            passwordsMatch &&
            registerForm.checkValidity();

        submitButton.disabled = !valid;

        confirmPassword.setCustomValidity(
            confirmPassword.value && !passwordsMatch
                ? "Passwords do not match."
                : ""
        );

        return valid;
    }

    registerForm.addEventListener("input", () => {
        showMessage(message, "");
        validateRegistration();
    });

    registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        const valid = validateRegistration();

        if (!valid) {
            registerForm.reportValidity();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "REGISTERING...";
        showMessage(message, "");

        try {
            const data = await requestJSON("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    username: username.value.trim(),
                    password: password.value,
                    confirmPassword: confirmPassword.value,
                    email: email.value.trim()
                })
            });

            showMessage(
                message,
                data.message || "Account created successfully.",
                "success"
            );

            window.location.href =
                "/login?username=" +
                encodeURIComponent(username.value.trim());
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            submitButton.textContent = "REGISTER";
            validateRegistration();
        }
    });

    validateRegistration();
}

// PROTECTED HOME PAGE
const authStatus = document.getElementById("authStatus");
const protectedHome = document.getElementById("protectedHome");
const protectedCalendar = document.getElementById("calendarDashboard");
const protectedPage = protectedHome || protectedCalendar;

if (protectedPage) {
    async function checkSession() {
        try {
            const data = await requestJSON("/api/auth/me");

            const welcomeText = document.getElementById("welcomeText");
            const profileUsername =
                document.getElementById("profileUsername");
            const profileDialogName =
                document.getElementById("profileDialogName");

            if (welcomeText) {
                welcomeText.textContent =
                    `Welcome back, ${data.user.username}!`;
            }

            if (profileUsername) {
                profileUsername.textContent = data.user.username;
            }

            if (profileDialogName) {
                profileDialogName.textContent = data.user.username;
            }

            protectedPage.hidden = false;

            if (authStatus) {
                authStatus.hidden = true;
            }
        } catch {
            window.location.href = "/login";
        }
    }

    checkSession();
}

// LOGOUT
const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            await requestJSON("/api/auth/logout", {
                method: "POST",
                body: JSON.stringify({})
            });

            window.location.href = "/login";
        } catch (error) {
            alert(error.message || "Unable to log out. Please try again.");
            logoutButton.disabled = false;
        }
    });
}
