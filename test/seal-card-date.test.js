const test = require("node:test");
const assert = require("node:assert/strict");
const { format, append } = require("../assets/seal-card-date.js");

test("data e horario aparecem no UTC-3, inclusive na virada do dia", () => {
    assert.deepEqual(format("2025-11-29T17:25:27Z"), {
        date: "29/11/2025", hour: "14:25", dateTime: "2025-11-29T17:25:27.000Z",
    });
    assert.equal(format("2025-11-29 17:25:27").hour, "14:25");
    assert.equal(format("2026-01-01T01:15:00Z").date, "31/12/2025");
    assert.equal(format("2026-01-01T01:15:00Z").hour, "22:15");
    assert.equal(format("sem data"), null);
});

test("card mostra so a data e deixa o horario na dica ao passar o mouse", () => {
    const children = [];
    const card = {
        ownerDocument: { createElement: () => ({ setAttribute(name, value) { this[name] = value; } }) },
        appendChild(element) { children.push(element); },
    };
    const element = append(card, "2026-01-01T01:15:00Z", "perfil");
    assert.equal(element.textContent, "31/12/2025");
    assert.match(element.title, /22:15 \(UTC−3\)/);
    assert.equal(children.length, 1);
});
