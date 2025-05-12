const MODULE_VERSION = "2.0.0";
const FOLDER_NAME = "Players"; // ✅ Only export characters from this folder

console.log(`✅ Module script loaded! Version: ${MODULE_VERSION}`);

// === EXPORT FUNCTION ===
function exportFullCharacterData() {
    console.log("📦 Exporting full character data...");

    const targetFolder = game.folders.find(f => f.name === FOLDER_NAME && f.type === "Actor");
    if (!targetFolder) {
        ui.notifications.warn(`⚠️ Folder "${FOLDER_NAME}" not found. Export aborted.`);
        console.warn(`⚠️ Folder "${FOLDER_NAME}" not found. Please check the FOLDER_NAME config.`);
        return;
    }

    const actors = targetFolder.contents.filter(a => a.type === "character");

    const characterData = actors.map(actor => {
        const ancestryItem = actor.items.find(i => i.type === "ancestry");
        const heritageItem = actor.items.find(i => i.type === "heritage");
        const backgroundItem = actor.items.find(i => i.type === "background");
        const classItem = actor.items.find(i => i.type === "class");

        // === Wealth Calculation ===
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

        // === Uncommon+ Items ===
        const rarities = ["uncommon", "rare", "unique"];
        const filteredItems = actor.items.filter(item => 
            rarities.includes(item.rarity?.toLowerCase() ?? "") &&
            ["weapon", "armor", "equipment", "consumable", "treasure"].includes(item.type)
        );

        const itemList = filteredItems.map(item => {
            const quantity = item.system?.quantity ?? 1;
            return quantity > 1 ? `${quantity}*${item.name}` : `${item.name}`;
        });

        // === Skills ===
        const skillData = {};
        const skills = actor.system?.skills ?? {};
        Object.entries(skills).forEach(([key, skill]) => {
            skillData[skill.label ?? key.toUpperCase()] = actor.skills?.[key]?.mod ?? 0;
        });

        return {
            name: actor.name,
            ancestry: ancestryItem?.name ?? "Unknown",
            heritage: heritageItem?.name ?? "Unknown",
            background: backgroundItem?.name ?? "Unknown",
            class: classItem?.name ?? "Unknown",
            totalwealth: Math.floor(totalWealth),
            items: itemList,
            skills: skillData
        };
    });

    const jsonData = JSON.stringify(characterData);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // ✅ Old Reliable Download Method
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `character-data-v${MODULE_VERSION}.json`;
    downloadLink.click();

    URL.revokeObjectURL(url);

    ui.notifications.info("📁 Character Data Exported Successfully!");
    console.log("📦 Export Complete. File downloaded.");
}

// === HOOKS ===
Hooks.once('ready', () => {
    console.log("🟢 Module READY hook fired.");

    globalThis.exportFullData = () => {
        console.log("🧩 Triggered via console command.");
        exportFullCharacterData();
    };

    globalThis.moduleVersion = () => {
        console.log(`📖 Current Module Version: ${MODULE_VERSION}`);
        ui.notifications.info(`📖 Current Module Version: ${MODULE_VERSION}`);
    };
});

// === CHAT COMMAND TRIGGER ===
Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    if (messageText.trim().toLowerCase() === "/exportcharacters") {
        console.log("🧩 Triggered via chat command.");
        exportFullCharacterData();
        return false; // Prevents message from appearing in chat
    }
});
