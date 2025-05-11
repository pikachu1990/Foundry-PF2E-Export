const MODULE_VERSION = "1.0.8";

// === CONFIGURATION ===
const FOLDER_NAME = "Players"; // ✅ Change this to the name of the folder you want to filter by

// ✅ Confirm module script loaded
console.log(`✅ Module script loaded! Version: ${MODULE_VERSION}`);

// === EXPORT FUNCTION (Filtered and Clean Output) ===
function exportCharacterWealth() {
    console.log("📦 Exporting character wealth...");

    const targetFolder = game.folders.find(f => f.name === FOLDER_NAME && f.type === "Actor");
    if (!targetFolder) {
        ui.notifications.warn(`⚠️ Folder "${FOLDER_NAME}" not found. Export aborted.`);
        console.warn(`⚠️ Folder "${FOLDER_NAME}" not found. Please check the FOLDER_NAME config.`);
        return;
    }

    const actors = targetFolder.contents.filter(a => a.type === "character");

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
            totalWealth: Math.floor(totalWealth)
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

// === CHAT COMMAND TRIGGER ===
Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    if (messageText.trim().toLowerCase() === "/exportwealth") {
        console.log("🧩 Triggered via chat command.");
        exportCharacterWealth();
        return false; // Prevents message from appearing in chat
    }
});
