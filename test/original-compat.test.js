const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("perfil do projeto original importa na versão estática, inclusive selo novo e vários servidores", async () => {
    const backup = {
        appId: "dmowiki-seals-calculator", backupVersion: 1,
        selectedProfile: "Jogador 1", selectedServer: "la", selectedProfileSealCount: 1,
        data: {
            version: 1, accounts: ["Jogador 1"], nextRecordId: 3,
            records: { "Jogador 1": {
                la: { 2: { id: 1, sealId: 2, quantity: 258, createdAt: "2026-01-01T01:15:00Z" } },
                sa: { 999: { id: 2, sealId: 999, quantity: 3 } },
            } },
            prices: { "Jogador 1": { la: { 2: 1234 }, sa: { 999: 500 } } },
            blocked: {},
        },
        preferences: {},
        catalog: {
            catalogVersion: "teste", levels: ["Normal"], attributes: ["AT"],
            servers: [{ key: "la", label: "LA", position: 1 }, { key: "sa", label: "SA", position: 2 }],
            templates: [
                { id: 2, name: "Guilmon", attribute: "AT", baseValue: 150, unitCost: 7000, levels: { Normal: { threshold: 1, value: 15 } } },
                { id: 999, name: "Selo Novo", attribute: "AT", baseValue: 200, unitCost: 500, createdAt: "2026-02-02T12:00:00Z", levels: { Normal: { threshold: 1, value: 20 } } },
            ],
        },
    };
    assert.equal(backup.selectedProfileSealCount, 1);
    assert.equal(backup.data.records["Jogador 1"].sa["999"].quantity, 3);
    assert.equal(backup.data.prices["Jogador 1"].la["2"], 1234);

    const stored = new Map();
    const localStorage = {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, String(value)),
        key: (index) => [...stored.keys()][index],
        get length() { return stored.size; },
    };
    let reloaded = false;
    const window = {
        fetch: async () => { throw new Error("Rede não esperada"); },
        SEAL_CATALOG: {
            catalogVersion: "base", levels: ["Normal"], attributes: ["AT"],
            servers: [{ key: "la", label: "LA", position: 1 }],
            templates: [{ id: 2, name: "Guilmon", attribute: "AT", levels: { Normal: { threshold: 1, value: 15 } } }],
        },
        APP_CONFIG: {}, confirm: () => true, addEventListener: () => {},
    };
    const document = { createElement: () => ({ click() {} }) };
    const source = fs.readFileSync(path.join(__dirname, "../assets/local-api.js"), "utf8");
    vm.runInNewContext(source, {
        window, document, localStorage, Response, Request, FormData, Blob, URL, structuredClone,
        location: { href: "https://example.org/", reload: () => { reloaded = true; } },
        setTimeout: () => {},
    });
    await window.LocalSealsApi.importBackup({
        size: 1000,
        text: async () => JSON.stringify(backup),
    });
    const localData = JSON.parse(stored.get("dmowiki.seals.local.v1"));
    const localCatalog = JSON.parse(stored.get("dmowiki.seals.catalog.v1"));
    assert.equal(localData.records["Jogador 1"].la["2"].quantity, 258);
    assert.equal(localData.records["Jogador 1"].la["2"].createdAt, "2026-01-01T01:15:00Z");
    assert.equal(localData.records["Jogador 1"].sa["999"].quantity, 3);
    assert.equal(localData.prices["Jogador 1"].la["2"], 1234);
    assert.equal(localCatalog.templates.find((seal) => seal.id === 999).name, "Selo Novo");
    assert.equal(localCatalog.templates.find((seal) => seal.id === 999).createdAt, "2026-02-02T12:00:00Z");
    assert.ok(localCatalog.servers.some((server) => server.key === "sa"));
    assert.equal(reloaded, true);

    const reloadedWindow = {
        fetch: async () => { throw new Error("Rede não esperada"); },
        SEAL_CATALOG: window.SEAL_CATALOG,
        APP_CONFIG: {}, addEventListener: () => {},
    };
    vm.runInNewContext(source, {
        window: reloadedWindow, document, localStorage, Response, Request, FormData, Blob, URL, structuredClone,
        location: { href: "https://example.org/" }, setTimeout: () => {},
    });
    const importedSeals = await (await reloadedWindow.fetch("/api/seals?search=Selo%20Novo")).json();
    assert.equal(importedSeals.templates[0].id, 999);
    assert.equal(importedSeals.templates[0].createdAt, "2026-02-02T12:00:00Z");
});
