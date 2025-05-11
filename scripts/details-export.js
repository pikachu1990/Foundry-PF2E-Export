const MODULE_VERSION = "1.0.5";

// ✅ Confirm module script loaded
console.log(`✅ Module script loaded! Version: ${MODULE_VERSION}`);

// Manual debug version checker
Hooks.once('ready', () => {
    console.log("🟢 Module READY hook fired.");
    globalThis.testExport = () => {
        console.log("📦 Manual Export Triggered Successfully!");
        ui.notifications.info("📦 Manual Export Triggered Successfully!");
    };

    globalThis.moduleVersion = () => {
        console.log(`📖 Current Module Version: ${MODULE_VERSION}`);
        ui.notifications.info(`📖 Current Module Version: ${MODULE_VERSION}`);
    };
});

// Add export button when Settings sidebar is rendered
Hooks.on('renderSidebarTab', (app, html) => {
    if (app.id !== "settings") return;

    console.log("⚙️ Settings Sidebar Rendered. Adding Export Button...");

    if (!html[0].querySelector("#export-button")) {
        const exportButton = document.createElement("button");
        exportButton.id = "export-button";
        exportButton.innerText = "📁 Export Character Details";
        exportButton.style.margin = "10px";
        exportButton.onclick = () => testExport();

        const header = html[0].querySelector(".directory-header");
        if (header) header.appendChild(exportButton);
    }
});
