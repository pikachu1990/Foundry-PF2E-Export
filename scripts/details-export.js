const MODULE_VERSION = "1.0.16";
const FOLDER_NAME = "Players"; // ✅ Only export characters from this folder

console.log(`✅ Module script loaded! Version: ${MODULE_VERSION}`);

// === EXPORT FUNCTION ===
function collectFullCharacterData() {
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
        const level = actor.system?.details?.level?.value ?? 0;

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

        // Only restricted equipment needs individual permission; all rarities
        // remain included in the wealth calculation above.
        const rarities = ["rare", "unique"];
        const filteredItems = actor.items.filter(item => 
            (rarities.includes((item.rarity ?? item.system?.traits?.rarity ?? "").toLowerCase()) ||
             (item.system?.traits?.value ?? []).some(trait => String(trait).toLowerCase() === "artifact")) &&
            ["weapon", "armor", "shield", "backpack", "equipment", "consumable", "treasure"].includes(item.type)
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
            actor_uuid: actor.uuid,
            world_id: game.world.id,
            name: actor.name,
            ancestry: ancestryItem?.name ?? "Unknown",
            heritage: heritageItem?.name ?? "Unknown",
            background: backgroundItem?.name ?? "Unknown",
            class: classItem?.name ?? "Unknown",
            level: level,
            totalwealth: Math.floor(totalWealth),
            items: itemList,
            items_scope: "rare+",
            skills: skillData
        };
    });

    return characterData;
}

function exportFullCharacterData() {
    const characterData = collectFullCharacterData();
    if (!characterData) return;
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

// Explicit upload only. Credentials stay in this GM tab's memory and are never
// sent through Foundry chat, world settings, or character records.
let reviewConnection = { endpoint: "https://durval-world.sparked.network", token: "" };
let reviewUploadRunning = false;

function reviewEndpoint(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("Enter the HTTPS website address, without a personal sheet link.");
    }
    if (url.pathname !== "/" && url.pathname !== "") {
        throw new Error("Enter only the website's base address.");
    }
    return url.origin + "/integration/foundry/snapshots";
}

async function uploadForReview(endpoint, token, data) {
    if (!game.user?.isGM) throw new Error("Only a GM can send character snapshots.");
    if (reviewUploadRunning) throw new Error("A snapshot is already being sent.");
    if (token.length < 4) throw new Error("Enter the configured upload key.");
    if (!data?.length) throw new Error("No characters found directly inside Players.");
    reviewUploadRunning = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(endpoint, {
            method: "POST", credentials: "omit", redirect: "error",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify(data), signal: controller.signal
        });
        if (!response.ok) throw new Error(`Receiver returned HTTP ${response.status}.`);
        const result = await response.json();
        if (!/^[a-f0-9]{64}$/.test(result.snapshot_id) ||
            !['pending_review', 'review_required', 'applied', 'already_applied', 'uncertain'].includes(result.status) ||
            ![true, false, null].includes(result.sheets_updated)) {
            throw new Error("Unexpected receiver response; check the snapshot before retrying.");
        }
        return result;
    } finally {
        clearTimeout(timer);
        reviewUploadRunning = false;
    }
}

function showSendForReview(deploy = false) {
    if (!game.user?.isGM) {
        ui.notifications.warn("Only a GM can send character snapshots.");
        return;
    }
    const data = collectFullCharacterData();
    if (!data?.length) return;
    new Dialog({
        title: deploy ? "Update Google Sheets" : "Send characters for review",
        content: `<p>${deploy
            ? `Update Google Sheets directly from ${data.length} characters in Players. Validation must pass for the whole upload; otherwise it will be held for manual review.`
            : `Send ${data.length} characters from Players for manual review. This command does not update Google Sheets.`}</p>
            <div class="form-group"><label>Receiver website (HTTPS)</label>
            <input name="receiver" type="url" placeholder="https://your-website.example"></div>
            <div class="form-group"><label>Upload key</label>
            <input name="uploadKey" type="password" autocomplete="off"></div>
            <p>The connection is remembered only until this game tab is reloaded.</p>`,
        render: html => {
            html.find('[name="receiver"]').val(reviewConnection.endpoint);
            html.find('[name="uploadKey"]').val(reviewConnection.token);
        },
        buttons: {
            send: { label: deploy ? "Update Google Sheets" : "Send for review", callback: async html => {
                try {
                    const base = html.find('[name="receiver"]').val().trim();
                    const token = html.find('[name="uploadKey"]').val().trim();
                    const endpoint = reviewEndpoint(base) + (deploy ? '?deploy=true' : '?review_only=true');
                    const result = await uploadForReview(endpoint, token, data);
                    reviewConnection = { endpoint: new URL(base).origin, token };
                    const outcome = uploadOutcome(result);
                    ui.notifications.info(outcome);
                    // Receipt is not a credential; useful for retrieving this exact snapshot.
                    new Dialog({title: "Character snapshot received",
                        content: `<p>Snapshot reference:</p><input readonly value="${result.snapshot_id}">
                            <p>${outcome}</p>`,
                        buttons: { close: { label: "Close" } }
                    }).render(true);
                } catch (error) {
                    ui.notifications.error(error.name === "AbortError"
                        ? "Upload timed out. Ask for a receipt check before trying again."
                        : "Could not send snapshot. Check the HTTPS address, upload key and connection.");
                }
            }},
            cancel: { label: "Cancel" }
        },
        default: "cancel"
    }).render(true);
}

// === HOOKS ===
function uploadOutcome(result) {
    if (result.status === 'uncertain') return 'Upload received, but the Sheets update could not be confirmed. Ask for review; do not retry to force an update.';
    if (result.status === 'applied' || result.status === 'already_applied')
        return result.sheets_updated ? 'Sheets update confirmed. Repeated uploads do not repeat this update.' : 'Checked successfully; no Sheets changes were needed.';
    return 'Upload received for manual review. No automatic Sheets changes were made.';
}

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
function exportChatCommand(message) {
    if (typeof message !== "string") return null;
    // V14's rich-text chat wraps typed commands in a paragraph. Accept only
    // a standalone command, not arbitrary HTML, quoted text, or extra content.
    const text = message.trim();
    const plain = text.match(/^\/(review|deploy|exportcharacters)$/i);
    if (plain) return plain[1].toLowerCase();
    const paragraph = text.match(/^<p(?:\s[^>]*)?>\s*\/(review|deploy|exportcharacters)\s*(?:<br\s*\/?>\s*)?<\/p>$/i);
    return paragraph ? paragraph[1].toLowerCase() : null;
}

Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    const command = exportChatCommand(messageText);
    if (command === "review") {
        showSendForReview();
        return false;
    }
    if (command === "deploy") {
        showSendForReview(true);
        return false;
    }
    if (command === "exportcharacters") {
        console.log("🧩 Triggered via chat command.");
        exportFullCharacterData();
        return false; // Prevents message from appearing in chat
    }
});
