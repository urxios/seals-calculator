(function () {
    "use strict";

    const APP_ID = "dmowiki-seals-calculator";
    const STORAGE_KEY = "dmowiki.seals.local.v1";
    const CATALOG_STORAGE_KEY = "dmowiki.seals.catalog.v1";
    const BACKUP_VERSION = 1;
    const originalFetch = window.fetch.bind(window);
    let catalogCache = window.SEAL_CATALOG || null;
    try {
        const storedCatalog = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || "null");
        if (storedCatalog) catalogCache = mergeCatalog(catalogCache, storedCatalog);
    } catch (_) {
        // Catálogo embutido continua disponível caso dados locais estejam corrompidos.
    }
    const catalogPromise = catalogCache
        ? Promise.resolve(catalogCache)
        : Promise.reject(new Error("Catálogo local indisponível. Verifique se assets/catalog.js foi publicado."));

    function freshState() {
        return {
            version: 1,
            updatedAt: new Date().toISOString(),
            accounts: ["Meu Perfil"],
            nextRecordId: 1,
            records: {},
            prices: {},
            blocked: {},
        };
    }

    function readState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.accounts)) return freshState();
            parsed.records ||= {};
            parsed.prices ||= {};
            parsed.blocked ||= {};
            parsed.nextRecordId = Math.max(Number(parsed.nextRecordId) || 1, 1);
            if (!parsed.accounts.length) parsed.accounts.push("Meu Perfil");
            return parsed;
        } catch (_) {
            return freshState();
        }
    }

    let localState = readState();
    if (window.APP_CONFIG) {
        window.APP_CONFIG.accounts = localState.accounts.slice();
        window.APP_CONFIG.defaultAccount = localStorage.getItem("seal_account_last") || localState.accounts[0];
    }

    function saveState() {
        localState.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
    }

    function key(value) { return String(value || "").trim(); }

    function mergeCatalog(base, imported) {
        if (!base || !imported || !Array.isArray(imported.templates) || !Array.isArray(imported.servers)) {
            throw new Error("Catálogo de selos inválido no backup.");
        }
        if (imported.templates.length > 2000 || imported.servers.length > 30) {
            throw new Error("Catálogo de selos excede o limite permitido.");
        }
        const templates = new Map(base.templates.map((item) => [item.id, item]));
        for (const seal of imported.templates) {
            const id = Number(seal?.id);
            if (!Number.isSafeInteger(id) || id <= 0 || typeof seal.name !== "string" || !seal.name.trim()
                || !/^[A-Z]{2,4}$/.test(seal.attribute || "") || !seal.levels || typeof seal.levels !== "object") {
                throw new Error("Backup contém dados inválidos de um selo.");
            }
            templates.set(id, {
                id, name: seal.name.slice(0, 120), attribute: seal.attribute,
                baseValue: Number(seal.baseValue) || 0,
                unitCost: Math.max(Number(seal.unitCost) || 0, 0),
                unitCosts: seal.unitCosts && typeof seal.unitCosts === "object" ? seal.unitCosts : {},
                orderIndex: Number(seal.orderIndex) || id,
                levels: seal.levels,
                createdAt: typeof seal.createdAt === "string" ? seal.createdAt : "",
            });
        }
        const servers = new Map(base.servers.map((item) => [item.key, item]));
        for (const server of imported.servers) {
            const serverKey = String(server?.key || "");
            if (!/^[a-z0-9_-]{1,24}$/.test(serverKey)) throw new Error("Backup contém servidor inválido.");
            servers.set(serverKey, {
                key: serverKey,
                label: String(server.label || serverKey).slice(0, 30),
                position: Number(server.position) || servers.size + 1,
            });
        }
        const levels = [...new Set([...base.levels, ...(Array.isArray(imported.levels) ? imported.levels : [])])];
        const attributes = [...new Set([...base.attributes, ...(Array.isArray(imported.attributes) ? imported.attributes : [])])];
        return {
            schemaVersion: 1,
            catalogVersion: imported.catalogVersion || base.catalogVersion,
            levels, attributes,
            servers: [...servers.values()].sort((a, b) => a.position - b.position),
            templates: [...templates.values()].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id),
        };
    }

    function validAccountName(value) {
        const name = key(value).slice(0, 80);
        return name && !["__proto__", "prototype", "constructor"].includes(name.toLowerCase()) ? name : "";
    }
    function scope(root, account, server, create = true) {
        const accountKey = key(account);
        const serverKey = key(server) || "la";
        if (create) {
            root[accountKey] ||= {};
            root[accountKey][serverKey] ||= {};
        }
        return root[accountKey]?.[serverKey] || {};
    }

    function compactTemplate(template, levels) {
        return {
            c: 1, id: template.id, n: template.name, a: template.attribute, b: template.baseValue,
            u: template.unitCost || 0, us: template.unitCosts || {}, o: template.orderIndex,
            ca: template.createdAt || "",
            l: levels.map((name) => {
                const level = template.levels?.[name] || {};
                return [level.threshold ?? null, level.percentage ?? null, level.value ?? null];
            }),
        };
    }

    function response(payload, status = 200) {
        return new Response(JSON.stringify(payload), {
            status,
            headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
    }

    async function requestBody(input, init) {
        const source = init?.body !== undefined ? init.body : input instanceof Request ? await input.clone().text() : "";
        if (!source || source instanceof FormData) return {};
        if (typeof source === "string") {
            try { return JSON.parse(source); } catch (_) { return {}; }
        }
        return source;
    }

    function accountPayload(account) {
        return { accounts: localState.accounts.slice(), account: account || localState.accounts[0] || "" };
    }

    function levelProgress(template, quantity, levels) {
        let currentLevel = null;
        let nextLevel = null;
        if (!template) return { currentLevel, nextLevel };
        for (const name of levels) {
            const details = template.levels?.[name] || {};
            const threshold = Number(details.threshold) || 0;
            const candidate = {
                name, threshold, percentage: details.percentage, value: details.value,
            };
            if (Number(quantity) >= threshold && (!currentLevel || threshold >= currentLevel.threshold)) {
                currentLevel = candidate;
            }
            if (threshold > Number(quantity) && (!nextLevel || threshold < nextLevel.threshold)) {
                nextLevel = candidate;
            }
        }
        return { currentLevel, nextLevel };
    }

    function inventoryPayload(catalog, account, server, compact) {
        const records = scope(localState.records, account, server, false);
        const prices = scope(localState.prices, account, server, false);
        const templates = new Map(catalog.templates.map((template) => [String(template.id), template]));
        const seals = Object.values(records).map((record) => {
            const template = templates.get(String(record.sealId));
            return {
                id: record.id,
                account,
                sealId: Number(record.sealId),
                quantity: Number(record.quantity) || 0,
                createdAt: record.createdAt || null,
                unitCost: Object.prototype.hasOwnProperty.call(prices, record.sealId) ? prices[record.sealId] : null,
                serverKey: server,
                template: compact && template ? compactTemplate(template, catalog.levels) : template,
                ...levelProgress(template, record.quantity, catalog.levels),
            };
        });
        return { account, accounts: localState.accounts.slice(), seals, prices: { ...prices }, blockedTemplateIds: [...(scope(localState.blocked, account, server, false).ids || [])], serverKey: server };
    }

    async function handleApi(input, init = {}) {
        const catalog = await catalogPromise;
        const rawUrl = input instanceof Request ? input.url : String(input);
        const url = new URL(rawUrl, location.href);
        const path = url.pathname.replace(/^.*?(?=\/api\/)/, "");
        const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
        const body = await requestBody(input, init);

        if (path === "/api/me") return response({ authenticated: true, userId: "local", email: "local@navegador", displayName: "Dados locais", isAdmin: false, emailVerified: true, sealTemplatePaginationEnabled: true, theme: localStorage.getItem("theme") || "light" });
        if (path === "/api/logout") return response({ message: "No modo estático os dados continuam neste navegador." });
        if (path === "/api/servers") return response({ servers: catalog.servers, defaultServer: "la" });

        if (path === "/api/accounts" && method === "GET") return response(accountPayload(url.searchParams.get("account")));
        if (path === "/api/accounts" && method === "POST") {
            const name = validAccountName(body.name);
            if (!name) return response({ error: "Informe o nome do perfil de jogo." }, 400);
            if (localState.accounts.some((item) => item.toLowerCase() === name.toLowerCase())) return response({ error: "Esse perfil já existe." }, 409);
            localState.accounts.push(name); saveState();
            return response({ ...accountPayload(name), message: "Perfil de jogo criado neste navegador." }, 201);
        }
        if (path === "/api/accounts/order" && method === "PUT") {
            const order = Array.isArray(body.order) ? body.order.filter((name) => localState.accounts.includes(name)) : [];
            if (order.length === localState.accounts.length) localState.accounts = order;
            saveState();
            return response({ accounts: localState.accounts, message: "Ordem dos perfis atualizada." });
        }
        const accountMatch = path.match(/^\/api\/accounts\/([^/]+)$/);
        if (accountMatch && method === "PUT") {
            const oldName = decodeURIComponent(accountMatch[1]);
            const newName = validAccountName(body.name);
            const index = localState.accounts.indexOf(oldName);
            if (index < 0 || !newName) return response({ error: "Perfil de jogo não encontrado." }, 404);
            if (localState.accounts.some((item, itemIndex) => itemIndex !== index && item.toLowerCase() === newName.toLowerCase())) {
                return response({ error: "Esse perfil já existe." }, 409);
            }
            localState.accounts[index] = newName;
            for (const bucket of [localState.records, localState.prices, localState.blocked]) {
                if (bucket[oldName]) { bucket[newName] = bucket[oldName]; delete bucket[oldName]; }
            }
            saveState();
            return response({ ...accountPayload(newName), message: "Perfil renomeado." });
        }
        if (accountMatch && method === "DELETE") {
            const name = decodeURIComponent(accountMatch[1]);
            localState.accounts = localState.accounts.filter((item) => item !== name);
            delete localState.records[name]; delete localState.prices[name]; delete localState.blocked[name];
            if (!localState.accounts.length) localState.accounts.push("Meu Perfil");
            saveState();
            return response({ ...accountPayload(localState.accounts[0]), message: "Perfil excluído." });
        }

        if (path === "/api/seals" && method === "GET") {
            const compact = url.searchParams.get("compact") === "1";
            const all = url.searchParams.get("all") === "1" || Number(url.searchParams.get("pageSize")) >= 500;
            const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize")) || 24, 1), 500);
            const requestedPage = Math.max(Number(url.searchParams.get("page")) || 1, 1);
            const search = key(url.searchParams.get("search")).toLocaleLowerCase("pt-BR");
            const attribute = key(url.searchParams.get("attribute")).toUpperCase();
            const filtered = catalog.templates.filter((template) => (!search || template.name.toLocaleLowerCase("pt-BR").includes(search) || template.attribute.toLowerCase().includes(search)) && (!attribute || attribute === "TODOS" || template.attribute === attribute));
            const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
            const page = Math.min(requestedPage, totalPages);
            const startIndex = all ? 0 : (page - 1) * pageSize;
            const selected = all ? filtered : filtered.slice(startIndex, startIndex + pageSize);
            return response({ templates: compact ? selected.map((template) => compactTemplate(template, catalog.levels)) : selected, pagination: all ? null : { page, currentPage: page, pageSize, total: filtered.length, totalItems: filtered.length, totalPages, startIndex, endIndex: startIndex + selected.length }, catalogComplete: all, levels: catalog.levels, attributes: catalog.attributes, servers: catalog.servers, defaultServer: "la", serverKey: url.searchParams.get("server") || "la" });
        }

        if (path === "/api/account-seals" && method === "GET") {
            const requested = key(url.searchParams.get("account"));
            const account = localState.accounts.includes(requested) ? requested : localState.accounts[0];
            const server = key(url.searchParams.get("server") || url.searchParams.get("serverKey")) || "la";
            return response(inventoryPayload(catalog, account, server, url.searchParams.get("compact") === "1"));
        }
        if (path === "/api/account-seals" && method === "POST") {
            const account = key(body.account);
            const server = key(body.serverKey || body.server) || "la";
            const id = String(Number(body.sealId));
            if (!localState.accounts.includes(account) || !catalog.templates.some((template) => String(template.id) === id)) return response({ error: "Perfil ou selo não encontrado." }, 404);
            const records = scope(localState.records, account, server);
            let record = records[id];
            if (!record) record = records[id] = { id: localState.nextRecordId++, sealId: Number(id), quantity: 0, createdAt: new Date().toISOString() };
            record.quantity = Math.max(Math.trunc(Number(body.quantity) || 0), 0);
            if (body.unitCost !== null && body.unitCost !== undefined) scope(localState.prices, account, server)[id] = Math.max(Number(body.unitCost) || 0, 0);
            saveState();
            const payload = inventoryPayload(catalog, account, server, false);
            return response({ mySeal: payload.seals.find((entry) => entry.id === record.id), message: "Selo salvo neste navegador." }, 201);
        }
        const recordMatch = path.match(/^\/api\/account-seals\/(\d+)$/);
        if (recordMatch) {
            const recordId = Number(recordMatch[1]);
            for (const account of localState.accounts) for (const server of catalog.servers.map((item) => item.key)) {
                const records = scope(localState.records, account, server, false);
                const entry = Object.values(records).find((item) => item.id === recordId);
                if (!entry) continue;
                if (method === "DELETE" || Number(body.quantity) === 0) delete records[String(entry.sealId)];
                else if (method === "PUT") {
                    entry.quantity = Math.max(Math.trunc(Number(body.quantity) || 0), 0);
                    if (body.unitCost !== null && body.unitCost !== undefined) scope(localState.prices, account, server)[String(entry.sealId)] = Math.max(Number(body.unitCost) || 0, 0);
                }
                saveState();
                return response({ mySeal: entry, message: method === "DELETE" ? "Selo removido." : "Selo atualizado." });
            }
            return response({ error: "Meu Selo não encontrado." }, 404);
        }

        if (path === "/api/seals/mobile/calculate" && method === "POST") {
            const account = key(body.account);
            const server = key(body.serverKey || body.server) || "la";
            const inventory = inventoryPayload(catalog, account, server, false);
            const plan = window.StaticSealPlanner.buildSealPlan({ templates: catalog.templates, seals: inventory.seals, prices: inventory.prices, levels: catalog.levels, serverKey: server, attribute: body.attribute, target: body.target, strategy: body.strategy, openersOwned: body.openersOwned, openerUnitCost: body.openerUnitCost, budget: body.budget, blockedTemplateIds: body.blockedTemplateIds });
            localState.blocked[account] ||= {};
            localState.blocked[account][server] = { ids: Array.isArray(body.blockedTemplateIds) ? body.blockedTemplateIds.map(Number).filter(Number.isFinite) : [] };
            saveState();
            return response({ plan });
        }

        return response({ error: "Este recurso precisa do servidor e não está disponível no modo estático." }, 501);
    }

    window.fetch = function (input, init) {
        const rawUrl = input instanceof Request ? input.url : String(input);
        let url;
        try { url = new URL(rawUrl, location.href); } catch (_) { return originalFetch(input, init); }
        return url.pathname.includes("/api/") ? handleApi(input, init).catch((error) => response({ error: error.message }, 500)) : originalFetch(input, init);
    };

    function preferenceSnapshot() {
        const allowed = /^(theme|dmo_theme_last|dmowiki\.seals\.calculator-state|dmowikiv2\.seals\.(card-view|hide-maxed))$/;
        return Object.fromEntries(Object.keys(localStorage).filter((item) => allowed.test(item) || item.startsWith("seal_")).map((item) => [item, localStorage.getItem(item)]));
    }

    function isAllowedPreference(name) {
        return /^(theme|dmo_theme_last|dmowiki\.seals\.calculator-state|dmowikiv2\.seals\.(card-view|hide-maxed))$/.test(name)
            || name.startsWith("seal_");
    }

    function normalizeData(source) {
        const normalized = freshState();
        const knownSealIds = new Set((catalogCache?.templates || []).map((item) => String(item.id)));
        const knownServers = new Set((catalogCache?.servers || []).map((item) => item.key));
        const seenNames = new Set();
        normalized.accounts = [];

        for (const rawName of Array.isArray(source?.accounts) ? source.accounts : []) {
            const name = validAccountName(rawName);
            const folded = name.toLocaleLowerCase("pt-BR");
            if (name && !seenNames.has(folded)) {
                seenNames.add(folded);
                normalized.accounts.push(name);
            }
        }
        if (!normalized.accounts.length) normalized.accounts.push("Meu Perfil");

        for (const account of normalized.accounts) {
            for (const server of knownServers) {
                const importedRecords = source?.records?.[account]?.[server];
                for (const [rawSealId, rawRecord] of Object.entries(importedRecords && typeof importedRecords === "object" ? importedRecords : {})) {
                    const sealId = String(Number(rawRecord?.sealId ?? rawSealId));
                    if (!knownSealIds.has(sealId)) continue;
                    const quantity = Math.max(Math.trunc(Number(rawRecord?.quantity) || 0), 0);
                    const rawCreatedAt = typeof rawRecord?.createdAt === "string" ? rawRecord.createdAt.trim() : "";
                    const parsedCreatedAt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawCreatedAt)
                        ? `${rawCreatedAt.replace(" ", "T")}Z` : rawCreatedAt;
                    scope(normalized.records, account, server)[sealId] = {
                        id: normalized.nextRecordId++, sealId: Number(sealId), quantity,
                        ...(parsedCreatedAt && Number.isFinite(Date.parse(parsedCreatedAt))
                            ? { createdAt: parsedCreatedAt } : {}),
                    };
                }

                const importedPrices = source?.prices?.[account]?.[server];
                for (const [rawSealId, rawPrice] of Object.entries(importedPrices && typeof importedPrices === "object" ? importedPrices : {})) {
                    const sealId = String(Number(rawSealId));
                    const price = Number(rawPrice);
                    if (knownSealIds.has(sealId) && Number.isFinite(price) && price >= 0) {
                        scope(normalized.prices, account, server)[sealId] = price;
                    }
                }

                const importedBlocked = source?.blocked?.[account]?.[server]?.ids;
                const ids = Array.isArray(importedBlocked)
                    ? [...new Set(importedBlocked.map(Number).filter((id) => Number.isFinite(id) && knownSealIds.has(String(id))))]
                    : [];
                if (ids.length) scope(normalized.blocked, account, server).ids = ids;
            }
        }
        return normalized;
    }

    function getBackupProfileSummary(runtime) {
        const account = validAccountName(runtime?.account) || localState.accounts[0] || "Meu Perfil";
        const server = key(runtime?.serverKey) || "la";
        const records = scope(localState.records, account, server, false);
        const sealCount = Object.values(records).filter((record) => Number(record?.quantity) > 0).length;
        const fileProfile = account
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "PERFIL";
        return { account, server, sealCount, fileProfile };
    }

    function downloadBackup() {
        const runtime = window.SealsRuntime?.state;
        if (runtime) {
            localStorage.setItem("dmowiki.seals.calculator-state", JSON.stringify({
                calculatorAttribute: runtime.calculatorAttribute,
                calculatorStrategy: runtime.calculatorStrategy,
                calculatorBudgetMode: runtime.calculatorBudgetMode,
                calculatorBudget: runtime.calculatorBudget,
                calculatorTarget: runtime.calculatorTarget,
                openersOwned: runtime.openersOwned,
            }));
        }
        const summary = getBackupProfileSummary(runtime);
        const payload = {
            appId: APP_ID,
            backupVersion: BACKUP_VERSION,
            catalogVersion: catalogCache?.catalogVersion || "",
            exportedAt: new Date().toISOString(),
            selectedProfile: summary.account,
            selectedServer: summary.server,
            selectedProfileSealCount: summary.sealCount,
            data: localState,
            preferences: preferenceSnapshot(),
            catalog: catalogCache,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${summary.fileProfile}-${summary.sealCount}-SELOS.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function mergeData(current, incoming) {
        const merged = structuredClone(current);
        merged.accounts = [...new Set([...current.accounts, ...incoming.accounts])];
        for (const rootName of ["records", "prices", "blocked"]) {
            merged[rootName] ||= {};
            for (const [account, servers] of Object.entries(incoming[rootName] || {})) {
                merged[rootName][account] ||= {};
                for (const [server, values] of Object.entries(servers || {})) {
                    merged[rootName][account][server] = { ...(merged[rootName][account][server] || {}), ...(values || {}) };
                }
            }
        }
        return normalizeData(merged);
    }

    async function importBackup(file) {
        if (!file || file.size > 5 * 1024 * 1024) throw new Error("Selecione um backup JSON de até 5 MB.");
        let backup;
        try { backup = JSON.parse(await file.text()); } catch (_) { throw new Error("Arquivo JSON inválido."); }
        if (backup?.appId !== APP_ID || backup?.backupVersion !== BACKUP_VERSION || !Array.isArray(backup?.data?.accounts)) throw new Error("Este arquivo não é um backup válido da calculadora.");
        const combine = window.confirm("Como deseja importar?\n\nOK = COMBINAR com os dados atuais\nCancelar = escolher substituir tudo");
        let mode = "COMBINAR";
        if (!combine) {
            const replace = window.confirm("SUBSTITUIR todos os dados deste navegador pelo backup?\n\nOK = substituir\nCancelar = não importar");
            if (!replace) return false;
            mode = "SUBSTITUIR";
        }
        downloadBackup();
        if (backup.catalog) {
            catalogCache = mergeCatalog(catalogCache, backup.catalog);
            localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalogCache));
            window.SEAL_CATALOG = catalogCache;
        }
        const incoming = normalizeData(backup.data);
        localState = mode === "COMBINAR" ? mergeData(normalizeData(localState), incoming) : incoming;
        saveState();
        for (const [name, value] of Object.entries(backup.preferences || {})) {
            if (isAllowedPreference(name) && typeof value === "string") localStorage.setItem(name, value);
        }
        location.reload();
        return true;
    }

    window.LocalSealsApi = {
        downloadBackup,
        importBackup,
        saveBlocked(account, server, ids) {
            localState.blocked[account] ||= {};
            localState.blocked[account][server] = { ids: [...ids] };
            saveState();
        },
    };

    window.addEventListener("DOMContentLoaded", () => {
        document.getElementById("localManageProfilesButton")?.addEventListener("click", () => document.getElementById("openAccountManager")?.click());
        document.getElementById("localExportButton")?.addEventListener("click", downloadBackup);
        const input = document.getElementById("localImportInput");
        document.getElementById("localImportButton")?.addEventListener("click", () => input?.click());
        input?.addEventListener("change", async () => {
            try { await importBackup(input.files?.[0]); }
            catch (error) { alert(error.message); }
            input.value = "";
        });
    });
})();
