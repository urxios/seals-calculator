(function (root) {
    "use strict";

    function format(value) {
        if (!value) return null;
        const raw = String(value).trim();
        const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
            ? `${raw.replace(" ", "T")}Z`
            : raw;
        const parsed = new Date(timestamp);
        if (Number.isNaN(parsed.getTime())) return null;

        // UTC-3 fixo, inclusive quando o navegador usa outro fuso horário.
        const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
        const pad = (number) => String(number).padStart(2, "0");
        const date = `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
        const hour = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
        return { date, hour, dateTime: parsed.toISOString() };
    }

    function append(card, value, context = "catálogo") {
        const formatted = format(value);
        if (!card || !formatted) return null;
        const element = card.ownerDocument.createElement("time");
        element.className = "seal-card__added-at";
        element.dateTime = formatted.dateTime;
        element.textContent = formatted.date;
        element.title = `Adicionado ao ${context} em ${formatted.date} às ${formatted.hour} (UTC−3)`;
        element.setAttribute("aria-label", element.title);
        element.tabIndex = 0;
        card.appendChild(element);
        return element;
    }

    root.SealCardDate = { format, append };
    if (typeof module !== "undefined" && module.exports) module.exports = { format, append };
})(typeof window !== "undefined" ? window : globalThis);
