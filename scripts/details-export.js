const MODULE_VERSION = "1.0.5";

// ✅ Confirm module script loaded
console.log(`✅ Module script loaded! Version: ${MODULE_VERSION}`);

// === EXPORT FUNCTION ===
function exportCharacterWealth() {
    console.log("📦 Exporting character wealth...");

    const actors = game.actors.filter(a => a.type === "character");
    const characterData = actors.map(actor => {
        const coins = actor.system?.currency ?? {};
        const totalCurrency =
            (coins.gp ?? 0) +
            (coins.sp ?? 0) / 10 +
            (coins.cp ?? 0) / 100 +
            (coins.pp ?? 0) * 10;

        let totalItemValue = 0;
        actor.items.forEach(item => {
            const price = item.system?.price?.value?.gp ?? 0;
            const quantity = item.system?.quantity ?? 1;
            totalItemValue += price * quantity;
        });

        const totalWealth = totalCurrency + totalItemValue;

        return {
            name: actor.name,
            id: actor.id,
            level: actor.system?.details?.level?.value ?? "Unknown",
            ancestry: actor.system?.details?.ancestry?.value ?? "Unknown",
            class: actor.system?.details?.class?.value ?? "Unknown",
            totalWealth: Number(totalWealth.toFixed(2)),
            currency: {
                gp: coins.gp ?? 0,
                sp: coins.sp ?? 0,
                cp: coins.cp ?? 0,
                pp: coins.pp ?? 0
            }
        };
    });

    const jsonData = JSON.stringify(characterData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `character-wealth-v${MODULE_VERSION}.json`;
    downloadLink.click();

    URL.revokeObjectURL(url);

    ui.notifications.info("📁 Character Wealth Exported Successfully!");
    console.log("📦 Export Complete. File downloaded.");
}

// === GLOBAL COMMANDS ===
Hooks.once('ready', () => {
    console.log("🟢 Module READY hook fired.");

    globalThis.testExport = () => {
        console.log("🧩 Triggered via console command.");
        exportCharacterWealth();
    };

    globalThis.moduleVersion = () => {
        console.log(`📖 Current Module Version: ${MODULE_VERSION}`);
        ui.notifications.info(`📖 Current Module Version: ${MODULE_VERSION}`);
    };
});

// === BUTTON TRIGGER ===
Hooks.on('renderSidebarTab', (app, html) => {
    if (app.id !== "settings") return;

    console.log("⚙️ Settings Sidebar Rendered. Adding Export Button...");

    if (!html[0].querySelector("#export-button")) {
        const exportButton = document.createElement("button");
        exportButton.id = "export-button";
        exportButton.innerText = "📁 Export Character Wealth";
        exportButton.style.margin = "10px";
        exportButton.onclick = () => {
            console.log("🧩 Triggered via Settings button.");
            exportCharacterWealth();
        };

        const header = html[0].querySelector(".directory-header");
        if (header) header.appendChild(exportButton);
    }
});

// === CHAT COMMAND TRIGGER ===
Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    if (messageText.trim().toLowerCase() === "/exportwealth") {
        console.log("🧩 Triggered via chat command.");
        exportCharacterWealth();
        return false; // Prevents message from appearing in chat
    }
});
