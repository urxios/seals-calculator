const test = require("node:test");
const assert = require("node:assert/strict");
const { createPdf } = require("../assets/seals-pdf.js");

const options = {
    account: "Jogador 1",
    server: "NA",
    date: "22/09/2026",
    count: 12,
    quantity: "5.200",
    gold: "35T",
};

test("gera PDF escuro de verdade com os selos e páginas próprias", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
        name: `Selo ${index + 1}`,
        attribute: "AT",
        quantity: "250",
        level: "Ouro",
        bonus: "150",
        unitGold: "7M",
        totalGold: "1,75T",
    }));
    const bytes = createPdf(entries, options);
    const pdf = Buffer.from(bytes).toString("ascii");
    assert.match(pdf, /^%PDF-1\.4/);
    assert.match(pdf, /\/Count 2\b/);
    assert.match(pdf, /SELOS EQUIPADOS/);
    assert.match(pdf, /Selo 12/);
    assert.equal((pdf.match(/\(Jogador 1 \/ NA\)/g) || []).length, 1);
    assert.doesNotMatch(pdf, /COLECAO|MEUS SELOS/);
    assert.equal((pdf.match(/\(TIPOS DE SELOS\)/g) || []).length, 1);
    assert.match(pdf, /0\.031 0\.059 0\.110 rg/);
    const xref = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    assert.equal(pdf.slice(xref, xref + 4), "xref");
});

test("páginas seguintes usam espaço extra para até 14 selos sem repetir a capa", () => {
    const entries = Array.from({ length: 38 }, (_, index) => ({
        name: `Selo ${index + 1}`, attribute: "AT", quantity: "1", level: "Normal",
        bonus: "10", unitGold: "1M", totalGold: "1M",
    }));
    const pdf = Buffer.from(createPdf(entries, { ...options, count: entries.length })).toString("ascii");
    assert.match(pdf, /\/Count 3\b/);
    assert.match(pdf, /Selo 38/);
    assert.equal((pdf.match(/\(Jogador 1 \/ NA\)/g) || []).length, 1);
});

test("PDF vazio informa claramente que o perfil não tem selos", () => {
    const pdf = Buffer.from(createPdf([], { ...options, count: 0 })).toString("ascii");
    assert.match(pdf, /Nenhum selo cadastrado/);
    assert.match(pdf, /\/Count 1\b/);
});

test("plano da calculadora também gera PDF próprio e escuro", () => {
    const pdf = Buffer.from(createPdf([{
        name: "Guilmon", attribute: "AT", needed: "50", current: "0", target: "50",
        gain: "30", openers: "1", unitGold: "7M", totalGold: "350M",
    }], { ...options, kind: "plan", count: 1 })).toString("ascii");
    assert.match(pdf, /PLANO DE SELOS/);
    assert.match(pdf, /\(Jogador 1 \/ NA\)/);
    assert.match(pdf, /Comprar \+50/);
    assert.match(pdf, /Gold\/un\.: 7M/);
    assert.doesNotMatch(pdf, /window\.print/);
});
