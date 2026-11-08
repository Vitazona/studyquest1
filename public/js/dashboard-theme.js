(() => {
    const APPEARANCE_KEY = "studyQuestAppearance";
    const LEGACY_THEME_KEY = "studyQuestTheme";
    const themes = new Set(["gradient", "light", "dark"]);
    const defaultAppearance = {
        theme: "gradient",
        accent: "#8e78d0"
    };
    const accentChoices = [
        { name: "Violet", value: "#8e78d0" },
        { name: "Blue", value: "#548bd8" },
        { name: "Teal", value: "#319a91" },
        { name: "Rose", value: "#cb668b" },
        { name: "Amber", value: "#c78634" }
    ];

    function validColor(value) {
        return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
    }

    function readAppearance() {
        try {
            const saved = localStorage.getItem(APPEARANCE_KEY);
            if (saved) {
                const appearance = JSON.parse(saved);
                return {
                    theme: themes.has(appearance.theme)
                        ? appearance.theme
                        : defaultAppearance.theme,
                    accent: validColor(appearance.accent)
                        ? appearance.accent
                        : defaultAppearance.accent
                };
            }

            const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
            return {
                ...defaultAppearance,
                theme: legacyTheme === "light" || legacyTheme === "dark"
                    ? legacyTheme
                    : defaultAppearance.theme
            };
        } catch (error) {
            console.warn("Unable to read appearance preferences:", error);
            return { ...defaultAppearance };
        }
    }

    let appearance = readAppearance();

    function saveAppearance() {
        try {
            localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
            localStorage.setItem(LEGACY_THEME_KEY, appearance.theme);
        } catch (error) {
            console.warn("Unable to save appearance preferences:", error);
        }
    }

    function updateAppearanceControls() {
        const themeSelect = document.getElementById("themeSelect");
        if (themeSelect) {
            themeSelect.value = appearance.theme;
        }

        const colorPicker = document.getElementById("accentColorPicker");
        if (colorPicker) {
            colorPicker.value = appearance.accent;
        }

        document.querySelectorAll("[data-accent-color]").forEach(button => {
            const selected = button.dataset.accentColor === appearance.accent;
            button.setAttribute("aria-pressed", String(selected));
        });

        const themeDescription = document.getElementById("themeDescription");
        if (themeDescription) {
            const labels = {
                gradient: "Original Study Quest gradient",
                light: "Light background",
                dark: "Dark background"
            };
            themeDescription.textContent = labels[appearance.theme];
        }
    }

    function applyAppearance(save = false) {
        document.documentElement.dataset.theme = appearance.theme;
        document.documentElement.style.setProperty(
            "--sq-accent",
            appearance.accent
        );
        const channels = appearance.accent
            .slice(1)
            .match(/.{2}/g)
            .map(channel => parseInt(channel, 16) / 255)
            .map(channel => channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4);
        const luminance =
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2];
        document.documentElement.style.setProperty(
            "--sq-accent-foreground",
            luminance > 0.179 ? "#211b30" : "#ffffff"
        );
        updateAppearanceControls();

        if (save) {
            saveAppearance();
        }
    }

    applyAppearance();

    window.addEventListener("storage", event => {
        if (
            event.key !== APPEARANCE_KEY &&
            event.key !== LEGACY_THEME_KEY
        ) {
            return;
        }

        appearance = readAppearance();
        applyAppearance();
    });

    function createAppearanceControls(dialog) {
        const content = dialog.querySelector(".profile-dialog-content");
        if (!content || content.querySelector(".sq-appearance-setting")) {
            return;
        }

        const setting = document.createElement("section");
        setting.className = "sq-appearance-setting";
        setting.setAttribute("aria-label", "Appearance settings");
        setting.innerHTML = `
            <div class="sq-appearance-heading">
                <strong>Appearance</strong>
                <span id="themeDescription"></span>
            </div>
            <label class="sq-control-label" for="themeSelect">Background theme</label>
            <select class="sq-theme-select" id="themeSelect">
                <option value="gradient">Original gradient</option>
                <option value="light">Light mode</option>
                <option value="dark">Dark mode</option>
            </select>
            <span class="sq-control-label">Choose an accent color</span>
            <div class="sq-accent-choices" role="group" aria-label="Accent color">
                ${accentChoices.map(({ name, value }) => `
                    <button class="sq-accent-swatch" type="button"
                            data-accent-color="${value}"
                            aria-label="${name} accent"
                            title="${name}"></button>
                `).join("")}
                <label class="sq-custom-color" for="accentColorPicker"
                       title="Choose a custom accent color">
                    <span aria-hidden="true">+</span>
                    <input id="accentColorPicker" type="color"
                           aria-label="Choose a custom accent color">
                </label>
            </div>
        `;

        const themeSelect = setting.querySelector("#themeSelect");
        themeSelect.addEventListener("change", () => {
            if (!themes.has(themeSelect.value)) {
                return;
            }

            appearance.theme = themeSelect.value;
            applyAppearance(true);
        });

        setting.querySelectorAll("[data-accent-color]").forEach(button => {
            button.addEventListener("click", () => {
                appearance.accent = button.dataset.accentColor;
                applyAppearance(true);
            });
        });

        setting.querySelector("#accentColorPicker").addEventListener(
            "input",
            event => {
                if (!validColor(event.currentTarget.value)) {
                    return;
                }

                appearance.accent = event.currentTarget.value;
                applyAppearance(true);
            }
        );

        const closeButton = content.querySelector(
            "#closeProfileButton, .profile-dialog-close"
        );
        if (closeButton) {
            content.insertBefore(setting, closeButton);
        } else {
            content.append(setting);
        }

        applyAppearance();
    }

    function createHomeProfileDialog() {
        const dialog = document.createElement("dialog");
        dialog.id = "profileDialog";
        dialog.className = "sq-profile-dialog";
        dialog.setAttribute("aria-labelledby", "profileDialogName");
        dialog.innerHTML = `
            <div class="sq-profile-content profile-dialog-content">
                <span class="sq-profile-kicker">YOUR STUDY QUEST</span>
                <h2 id="profileDialogName">username</h2>
                <p class="profile-description">Your learning space, your way.</p>
                <button class="sq-profile-close" id="closeProfileButton"
                        type="button">CLOSE</button>
            </div>
        `;
        document.body.append(dialog);

        dialog.querySelector("#closeProfileButton").addEventListener(
            "click",
            () => dialog.close()
        );
        dialog.addEventListener("click", event => {
            if (event.target === dialog) {
                dialog.close();
            }
        });

        return dialog;
    }

    function createAuthAppearanceDialog() {
        const dialog = document.createElement("dialog");
        dialog.id = "authAppearanceDialog";
        dialog.className = "sq-profile-dialog";
        dialog.setAttribute("aria-label", "Appearance settings");
        dialog.innerHTML = `
            <div class="sq-profile-content profile-dialog-content">
                <span class="sq-profile-kicker">STUDY QUEST APPEARANCE</span>
                <h2>Customize your theme</h2>
                <button class="sq-profile-close" id="closeAuthAppearanceButton"
                        type="button">CLOSE</button>
            </div>
        `;
        document.body.append(dialog);

        dialog.querySelector("#closeAuthAppearanceButton").addEventListener(
            "click",
            () => dialog.close()
        );
        dialog.addEventListener("click", event => {
            if (event.target === dialog) {
                dialog.close();
            }
        });

        return dialog;
    }

    function initializeAppearanceControl() {
        let dialog = document.getElementById("profileDialog");
        const authThemeButton = document.getElementById("authThemeButton");

        if (authThemeButton) {
            dialog = createAuthAppearanceDialog();
            createAppearanceControls(dialog);
            authThemeButton.addEventListener("click", () => {
                dialog.showModal();
            });
            return;
        }

        const isHomeProfile = !dialog;

        if (isHomeProfile) {
            dialog = createHomeProfileDialog();
        }

        createAppearanceControls(dialog);

        if (isHomeProfile) {
            const profileButton = document.getElementById("profileButton");
            if (profileButton) {
                profileButton.addEventListener("click", () => {
                    const usernameElement =
                        document.getElementById("profileUsername");
                    document.getElementById("profileDialogName").textContent =
                        usernameElement?.textContent.trim() || "username";
                    dialog.showModal();
                });
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAppearanceControl,
            { once: true }
        );
    } else {
        initializeAppearanceControl();
    }
})();
