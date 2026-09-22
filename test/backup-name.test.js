const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("backup conta tipos de selos do perfil, sem somar as unidades", async () => {
    const stored = new Map();
    const localStorage = {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, String(value)),
        key: (index) => [...stored.keys()][index],
        get length() { return stored.size; },
    };
    const anchors = [];
    let backupBlob;
    class BrowserUrl extends URL {}
    BrowserUrl.createObjectURL = (blob) => { backupBlob = blob; return "blob:backup"; };
    BrowserUrl.revokeObjectURL = () => {};
    const catalog = {
        catalogVersion: "teste", levels: ["Normal", "Bronze"], attributes: ["AT"], servers: [{ key: "na" }],
        templates: [{ id: 2, name: "Guilmon", attribute: "AT", levels: {
            Normal: { threshold: 1, percentage: 10, value: 15 }, Bronze: { threshold: 500, percentage: 20, value: 30 },
        } }, { id: 3, name: "Devimon", attribute: "AT" }],
    };
    const window = {
        fetch: async () => { throw new Error("API externa não esperada"); },
        SEAL_CATALOG: catalog,
        APP_CONFIG: {},
        SealsRuntime: { state: { account: "Jogador 1", serverKey: "na" } },
        addEventListener: () => {},
    };
    const document = {
        createElement: () => { const anchor = { click: () => anchors.push(anchor.download) }; return anchor; },
    };
    const source = fs.readFileSync(path.join(__dirname, "../assets/local-api.js"), "utf8");
    vm.runInNewContext(source, {
        window, document, localStorage, Response, Request, FormData, Blob, URL: BrowserUrl,
        location: { href: "https://example.org/" }, setTimeout: () => {},
    });
    const saved = await window.fetch("/api/account-seals", {
        method: "POST",
        body: JSON.stringify({ account: "Meu Perfil", serverKey: "na", sealId: 2, quantity: 258 }),
    });
    assert.equal(saved.status, 201);
    const inventory = await (await window.fetch("/api/account-seals?account=Meu%20Perfil&server=na")).json();
    assert.equal(inventory.seals[0].currentLevel.name, "Normal");
    assert.equal(inventory.seals[0].nextLevel.name, "Bronze");
    window.SealsRuntime.state.account = "Meu Perfil";
    window.LocalSealsApi.downloadBackup();
    assert.equal(anchors[0], "MEU-PERFIL-1-SELOS.json");
    const contents = JSON.parse(await backupBlob.text());
    assert.equal(contents.selectedProfileSealCount, 1);
    assert.equal(contents.data.records["Meu Perfil"].na["2"].quantity, 258);
});
