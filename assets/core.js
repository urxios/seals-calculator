(function () {
    const REMEMBERED_AUTH_KEY = "dmowikiv2.remembered-auth";
    let bootstrapMe = null;
    if (window.APP_CONFIG && typeof window.APP_CONFIG === "object" && window.APP_CONFIG.auth) {
        const payload = window.APP_CONFIG.auth;
        bootstrapMe = {
            response: {
                ok: !!payload.authenticated,
                status: payload.authenticated ? 200 : 401,
            },
            payload,
        };
    }

    function getStorage() {
        try {
            return window.localStorage;
        } catch (error) {
            return null;
        }
    }

    function normalizeEmail(value) {
        return String(value || "").trim().toLowerCase();
    }

    function readRememberedAuth() {
        const storage = getStorage();
        if (!storage) {
            return { email: "", remember: false };
        }
        try {
            const raw = storage.getItem(REMEMBERED_AUTH_KEY);
            if (!raw) {
                return { email: "", remember: false };
            }
            const payload = JSON.parse(raw);
            return {
                email: normalizeEmail(payload.email),
                remember: !!payload.remember,
            };
        } catch (error) {
            return { email: "", remember: false };
        }
    }

    function persistRememberedAuth(email, remember) {
        const storage = getStorage();
        if (!storage) {
            return;
        }
        const normalizedEmail = normalizeEmail(email);
        if (!remember || !normalizedEmail) {
            storage.removeItem(REMEMBERED_AUTH_KEY);
            return;
        }
        storage.setItem(
            REMEMBERED_AUTH_KEY,
            JSON.stringify({
                email: normalizedEmail,
                remember: true,
            }),
        );
    }

    function hydrateRememberedAuth(emailInput, rememberInput) {
        const remembered = readRememberedAuth();
        if (emailInput && remembered.email && !String(emailInput.value || "").trim()) {
            emailInput.value = remembered.email;
        }
        if (rememberInput) {
            rememberInput.checked = !!remembered.remember;
        }
    }

    function syncRememberCheckboxes(inputs = []) {
        const checkboxes = inputs.filter(Boolean);
        if (!checkboxes.length) {
            return;
        }
        const applyCheckedState = (checked) => {
            checkboxes.forEach((input) => {
                input.checked = checked;
            });
        };
        applyCheckedState(checkboxes.some((input) => input.checked));
        checkboxes.forEach((input) => {
            input.addEventListener("change", () => {
                applyCheckedState(!!input.checked);
            });
        });
    }

    async function readPayload(response) {
        try {
            return await response.json();
        } catch (error) {
            return {};
        }
    }

    async function jsonRequest(url, options = {}) {
        const init = {
            method: options.method || "GET",
            headers: new Headers(options.headers || {}),
        };
        if (options.body !== undefined) {
            if (!init.headers.has("Content-Type")) {
                init.headers.set("Content-Type", "application/json");
            }
            init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
        }
        const response = await fetch(url, init);
        const payload = await readPayload(response);
        return { response, payload };
    }

    async function getMe(options = {}) {
        const preferBootstrap = options.preferBootstrap !== false;
        if (preferBootstrap && bootstrapMe) {
            const cached = {
                response: { ...bootstrapMe.response },
                payload: { ...bootstrapMe.payload },
            };
            bootstrapMe = null;
            return cached;
        }
        return jsonRequest("/api/me");
    }

    async function authenticate(mode, email, password, options = {}) {
        const endpoint = mode === "register" ? "/api/register" : "/api/login";
        return jsonRequest(endpoint, {
            method: "POST",
            body: {
                email,
                password,
                remember: !!options.remember,
            },
        });
    }

    async function logout() {
        return jsonRequest("/api/logout", { method: "POST" });
    }

    async function fetchAccounts() {
        return jsonRequest("/api/accounts");
    }

    window.AppCore = {
        authenticate,
        fetchAccounts,
        getMe,
        hydrateRememberedAuth,
        jsonRequest,
        logout,
        persistRememberedAuth,
        syncRememberCheckboxes,
    };
})();
