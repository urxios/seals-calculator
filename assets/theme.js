(function () {
    const THEMES = {
        light: {
            name: "Claro",
            vars: {
                "--bg": "#f5f7fb",
                "--card-bg": "rgba(255, 255, 255, 0.96)",
                "--card-border": "#dbe4f1",
                "--panel-bg": "rgba(255, 255, 255, 0.94)",
                "--surface-2": "#f8fbff",
                "--surface-3": "#eef4ff",
                "--surface-accent": "#eff6ff",
                "--input-bg": "#ffffff",
                "--input-border": "#d7e3f1",
                "--primary": "#4995dd",
                "--primary-dark": "#0a36af",
                "--button-text": "#ffffff",
                "--text": "#0f172a",
                "--text-muted": "#64748b",
                "--accent": "#0a36af",
                "--accent-muted": "#eef4ff",
                "--danger": "#b32424",
                "--danger-bg": "#fbeaea",
                "--danger-border": "#d33",
                "--warning": "#8a5a00",
                "--warning-bg": "#fff4d6",
                "--success": "#117a37",
                "--success-bg": "#eaf6ee",
                "--overlay": "rgba(15, 23, 42, 0.36)",
                "--dropdown-bg": "#ffffff",
                "--dropdown-text": "#0f172a",
            },
        },
        dark: {
            name: "Escuro",
            vars: {
                "--bg": "#06111f",
                "--card-bg": "rgba(8, 15, 29, 0.92)",
                "--card-border": "#213147",
                "--panel-bg": "rgba(8, 15, 29, 0.94)",
                "--surface-2": "#132036",
                "--surface-3": "#1b2b42",
                "--surface-accent": "#10243d",
                "--input-bg": "#0d1728",
                "--input-border": "#29415d",
                "--primary": "#7cc3ff",
                "--primary-dark": "#3b82f6",
                "--button-text": "#eff6ff",
                "--text": "#e2e8f0",
                "--text-muted": "#94a3b8",
                "--accent": "#60a5fa",
                "--accent-muted": "rgba(59, 130, 246, 0.14)",
                "--danger": "#f87171",
                "--danger-bg": "#3a2020",
                "--danger-border": "#b84b4b",
                "--warning": "#fbbf24",
                "--warning-bg": "#3b321b",
                "--success": "#4ade80",
                "--success-bg": "#1f3524",
                "--overlay": "rgba(2, 6, 23, 0.68)",
                "--dropdown-bg": "#0d1728",
                "--dropdown-text": "#e2e8f0",
            },
        },
    };

    const THEME_SEQUENCE = ["light", "dark"];

    const THEME_ALIASES = {
        default: "light",
        yellow: "light",
        win95: "light",
        light: "light",
        aurora: "light",
        modern: "light",
        colorful: "light",
        vibrante: "light",
        dark: "dark",
        red: "dark",
        blue: "dark",
        green: "dark",
    };

    function normalizeThemeKey(themeKey) {
        const key = String(themeKey || "").trim().toLowerCase();
        return THEME_ALIASES[key] || "light";
    }

    function getTheme(themeKey) {
        return THEMES[normalizeThemeKey(themeKey)] || THEMES.light;
    }

    function getThemeCycleToggles(extraToggle = null) {
        const toggles = Array.from(document.querySelectorAll("[data-theme-cycle]"));
        if (extraToggle) {
            toggles.push(extraToggle);
        }
        return toggles.filter((toggle, index, list) => toggle && list.indexOf(toggle) === index);
    }

    function styleThemeToggle(toggle, themeKey, theme) {
        if (!toggle) return;
        toggle.dataset.theme = themeKey;
        toggle.setAttribute("aria-label", `Tema: ${theme.name}. Clique para alternar.`);
        toggle.setAttribute("title", `Tema atual: ${theme.name}. Clique para alternar.`);
        toggle.innerHTML = themeKey === "dark"
            ? '<span class="theme-toggle-icon">&#9728;</span>'
            : '<span class="theme-toggle-icon">&#9790;</span>';
        toggle.style.backgroundColor = theme.vars["--surface-2"] || theme.vars["--card-bg"] || "#ffffff";
        toggle.style.color = theme.vars["--text"] || "#202122";
        toggle.style.borderColor = theme.vars["--card-border"] || "#a2a9b1";
        toggle.style.boxShadow = "none";
    }

    function applyTheme(themeKey, options = {}) {
        const normalized = normalizeThemeKey(themeKey);
        const theme = getTheme(normalized);
        Object.entries(theme.vars).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });
        document.documentElement.dataset.theme = normalized;
        document.documentElement.classList.toggle("dark-mode", normalized === "dark");
        document.body?.classList.toggle("dark-mode", normalized === "dark");
        document.body?.classList.add("modern-layout");
        try {
            window.localStorage.setItem("theme", normalized);
            window.localStorage.setItem("dmo_theme_last", normalized);
        } catch (error) {
            // ignora falhas de armazenamento
        }
        getThemeCycleToggles(options.toggleElement || null).forEach((toggle) => {
            styleThemeToggle(toggle, normalized, theme);
        });
        return normalized;
    }

    function resolveInitialTheme() {
        try {
            const stored =
                window.localStorage.getItem("theme") ||
                window.localStorage.getItem("dmo_theme_last") ||
                window.localStorage.getItem("seal_theme_guest") ||
                window.localStorage.getItem("digimon_wiki_theme_guest") ||
                "";
            if (stored) {
                return normalizeThemeKey(stored);
            }
        } catch (error) {
            // ignora falhas de leitura
        }
        const bootstrapTheme =
            (window.PROFILE_PAGE &&
                window.PROFILE_PAGE.profile &&
                window.PROFILE_PAGE.profile.theme) ||
            (window.APP_CONFIG &&
                window.APP_CONFIG.auth &&
                window.APP_CONFIG.auth.theme) ||
            "";
        if (bootstrapTheme) {
            return normalizeThemeKey(bootstrapTheme);
        }
        return "light";
    }

    function getNextThemeKey(current) {
        const normalized = normalizeThemeKey(current);
        const index = THEME_SEQUENCE.indexOf(normalized);
        if (index === -1) {
            return THEME_SEQUENCE[0];
        }
        return THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length];
    }

    function bindThemeCycleToggles() {
        getThemeCycleToggles().forEach((toggle) => {
            if (toggle.dataset.themeCycleBound === "1") {
                return;
            }
            toggle.dataset.themeCycleBound = "1";
            const handleToggle = (event) => {
                if (event.type === "keydown" && !["Enter", " "].includes(event.key)) {
                    return;
                }
                if (event.type === "keydown") {
                    event.preventDefault();
                }
                document.body?.classList.add("theme-switching");
                const currentTheme = document.documentElement.dataset.theme || resolveInitialTheme();
                applyTheme(getNextThemeKey(currentTheme));
                window.setTimeout(() => {
                    document.body?.classList.remove("theme-switching");
                }, 180);
            };
            toggle.addEventListener("click", handleToggle);
            toggle.addEventListener("keydown", handleToggle);
        });
    }

    window.AppThemes = {
        THEMES,
        THEME_SEQUENCE,
        applyTheme,
        getNextThemeKey,
        getTheme,
        normalizeThemeKey,
    };

    bindThemeCycleToggles();
    applyTheme(resolveInitialTheme());
})();
