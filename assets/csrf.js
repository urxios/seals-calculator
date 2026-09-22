(function () {
    if (!window.fetch) {
        return;
    }

    function getTokenMeta() {
        return document.querySelector('meta[name="csrf-token"]');
    }

    function getToken() {
        return getTokenMeta()?.getAttribute("content")?.trim() || "";
    }

    function setToken(nextToken) {
        const token = (nextToken || "").trim();
        if (!token) {
            return;
        }
        let meta = getTokenMeta();
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("name", "csrf-token");
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", token);
    }

    const originalFetch = window.fetch.bind(window);
    const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    let tokenRequest = null;

    async function fetchToken() {
        if (getToken()) {
            return getToken();
        }
        if (!tokenRequest) {
            tokenRequest = originalFetch("/api/csrf-token", {
                headers: { Accept: "application/json" },
                credentials: "same-origin",
            })
                .then(async (response) => {
                    const responseToken = response.headers.get("X-CSRF-Token");
                    if (responseToken) {
                        setToken(responseToken);
                        return responseToken;
                    }
                    try {
                        const payload = await response.json();
                        if (payload?.csrfToken) {
                            setToken(payload.csrfToken);
                            return payload.csrfToken;
                        }
                    } catch (_error) {
                    }
                    return "";
                })
                .finally(() => {
                    tokenRequest = null;
                });
        }
        return tokenRequest;
    }

    window.fetch = async function patchedFetch(input, init) {
        const request = new Request(input, init);
        const url = new URL(request.url, window.location.href);
        const method = (request.method || "GET").toUpperCase();
        const headers = new Headers(request.headers);

        if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && unsafeMethods.has(method)) {
            const token = getToken() || await fetchToken();
            if (token) {
                headers.set("X-CSRF-Token", token);
            }
        }

        const response = await originalFetch(new Request(request, { headers }));
        const responseToken = response.headers.get("X-CSRF-Token");
        if (responseToken) {
            setToken(responseToken);
        }
        return response;
    };
})();
