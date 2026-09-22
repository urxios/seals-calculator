(function (root) {
    "use strict";

    const W = 595;
    const H = 842;
    const PALETTE = {
        AT: "#fb923c", CT: "#facc15", HT: "#7dd3fc", HP: "#fda4af",
        DS: "#93c5fd", DE: "#cbd5e1", BL: "#86efac", EV: "#d8b4fe",
    };

    function plain(value) {
        return String(value ?? "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'")
            .replace(/[^\x20-\x7e]/g, "?");
    }

    function rgb(hex) {
        return [1, 3, 5].map((index) => (parseInt(hex.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
    }

    function escapePdf(value) {
        return plain(value).replace(/[\\()]/g, "\\$&");
    }

    function drawPage(entries, options, pageNumber, totalPages) {
        const commands = [];
        const firstPage = pageNumber === 1;
        const rectangle = (x, top, width, height, fill, border) => {
            commands.push(`${rgb(fill)} rg`);
            if (border) commands.push(`${rgb(border)} RG 0.7 w`);
            commands.push(`${x} ${H - top - height} ${width} ${height} re ${border ? "B" : "f"}`);
        };
        const label = (value, x, top, size = 10, color = "#dbeafe", bold = false, maxWidth = 500) => {
            const limit = Math.max(1, Math.floor(maxWidth / (size * (bold ? 0.57 : 0.51))));
            const raw = plain(value);
            const display = raw.length > limit ? `${raw.slice(0, Math.max(limit - 3, 1))}...` : raw;
            commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${H - top - size} Tm (${escapePdf(display)}) Tj ET`);
        };

        rectangle(0, 0, W, H, "#080f1c");
        rectangle(0, 0, W, 8, "#8dc8fa");
        if (firstPage) {
            label(options.kind === "plan" ? "DMO / PLANO DE SELOS" : "DMO / SELOS EQUIPADOS", 34, 27, 10, "#8dc8fa", true);
            label(`${options.account} / ${options.server}`, 34, 50, 25, "#f0f6ff", true, 520);
            label(`Gerado em ${options.date}`, 34, 101, 9, "#90a5bd");

            const metrics = options.kind === "plan"
                ? [["TIPOS NO PLANO", String(options.count)], ["SELOS A COMPRAR", options.quantity], ["GOLD NECESSARIO", options.gold]]
                : [["TIPOS DE SELOS", String(options.count)], ["UNIDADES", options.quantity], ["GOLD INVESTIDO", options.gold]];
            metrics.forEach(([title, value], index) => {
                const x = 34 + index * 178;
                rectangle(x, 141, 168, 64, "#122239", "#29415b");
                label(title, x + 11, 151, 8, "#8da7c4", true, 145);
                label(value, x + 11, 166, 15, "#f0f6ff", true, 145);
            });
            label(`${options.kind === "plan" ? "MELHORIAS DO PLANO" : "SELOS EQUIPADOS"}  /  PAGINA ${pageNumber} DE ${totalPages}`, 34, 221, 10, "#8dc8fa", true);
        }
        entries.forEach((entry, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const x = 34 + column * 267;
            const top = firstPage ? 248 + row * 100 : 32 + row * 98;
            const width = 257;
            const attribute = plain(entry.attribute).toUpperCase();
            const accent = PALETTE[attribute] || "#8dc8fa";
            rectangle(x, top, width, 90, "#111f32", "#29415b");
            rectangle(x, top, 4, 90, accent);
            label(attribute, x + 13, top + 10, 9, accent, true, 28);
            label(entry.name, x + 49, top + 9, 12, "#f3f8ff", true, 190);
            if (options.kind === "plan") {
                label(`Comprar +${entry.needed}  /  ${entry.current} -> ${entry.target}`, x + 13, top + 31, 10, "#c4d4e6", false, 230);
                label(`Ganho: +${entry.gain}  |  Openers: ${entry.openers}`, x + 13, top + 50, 9, "#93bde0", true, 230);
                label(`Gold/un.: ${entry.unitGold}  |  Custo: ${entry.totalGold}`, x + 13, top + 68, 8, "#b6c9dc", false, 230);
            } else {
                label(`${entry.quantity} selos  /  ${entry.level}`, x + 13, top + 31, 10, "#c4d4e6", false, 230);
                label(`Bonus: ${entry.bonus}`, x + 13, top + 50, 9, "#93bde0", true, 230);
                label(`Gold/un.: ${entry.unitGold}  |  Total: ${entry.totalGold}`, x + 13, top + 68, 8, "#b6c9dc", false, 230);
            }
        });
        if (!options.count) {
            rectangle(34, 248, 524, 92, "#111f32", "#29415b");
            label(options.kind === "plan" ? "Nenhum selo neste plano." : "Nenhum selo cadastrado neste perfil e servidor.", 52, 282, 12, "#bdcee1");
        }
        rectangle(34, 780, 524, 1, "#29415b");
        label(`Perfil: ${options.account}  |  Servidor: ${options.server}`, 34, 792, 9, "#90a5bd", false, 410);
        label(`${pageNumber} / ${totalPages}`, 520, 792, 9, "#90a5bd", true, 40);
        return commands.join("\n") + "\n";
    }

    function createPdf(entries, options) {
        const pages = [entries.slice(0, 10)];
        for (let i = 10; i < entries.length; i += 14) pages.push(entries.slice(i, i + 14));
        const objects = [null];
        const add = (value) => { objects.push(value); return objects.length - 1; };
        const rootId = add("");
        const pagesId = add("");
        const regularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
        const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
        const pageIds = pages.map((items, index) => {
            const stream = drawPage(items, options, index + 1, pages.length);
            const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
            return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
        });
        objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
        objects[rootId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

        let content = "%PDF-1.4\n";
        const offsets = [0];
        for (let id = 1; id < objects.length; id++) {
            offsets.push(content.length);
            content += `${id} 0 obj\n${objects[id]}\nendobj\n`;
        }
        const xrefOffset = content.length;
        content += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
        for (let id = 1; id < objects.length; id++) content += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
        content += `trailer\n<< /Size ${objects.length} /Root ${rootId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        return Uint8Array.from(content, (character) => character.charCodeAt(0));
    }

    root.SealsPdf = { createPdf };
    if (typeof module !== "undefined" && module.exports) module.exports = { createPdf };
})(typeof window !== "undefined" ? window : globalThis);
