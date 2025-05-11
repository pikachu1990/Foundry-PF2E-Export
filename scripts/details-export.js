const MODULE_VERSION = "1.0.0"; // 📌 Update this when you make changes

Hooks.once('ready', async function () {
    console.log(`✅ PF2e Details Exporter Loaded! [Version: ${MODULE_VERSION}]`);

    // Register a chat command to trigger the export
    Hooks.on("chatMessage", (chatLog, message, chatData) => {
        if (message.trim().toLowerCase() === "/export-details") {
            exportCharacterDetails();
            return false; // Prevents the message from appearing in chat
        }
        return true;
    });
});

function exportCharacterDetails() {
    const actors = game.actors.filter(a => a.type === "character");
    if (!actors.length) {
        ui.notifications.warn("⚠️ No character actors found.");
        return;
    }

    const characterData = actors.map(actor => {
        const coins = actor.system?.currency ?? {};
        const totalCurrency =
            (coins.gp ?? 0) +
            (coins.sp ?? 0) / 10 +
            (coins.cp ?? 0) / 100 +
            (coins.pp ?? 0) * 10;

        let totalItemValue = 0;
        (actor.items ?? []).forEach(item => {
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
            // 📌 Add more fields here if needed
        };
    });

    const jsonData = JSON.stringify(characterData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "character-details.json";
    downloadLink.click();

    URL.revokeObjectURL(url);

    ui.notifications.info("📁 Character Details Exported Successfully!");
    console.log("📁 Export completed. Characters exported:", actors.length);
}
