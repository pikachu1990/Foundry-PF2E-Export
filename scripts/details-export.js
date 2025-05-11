console.log("✅ Module script loaded!");

// Add a manual trigger using Foundry’s developer console
window.testExport = () => {
    console.log("📦 Manual Export Triggered Successfully!");
    ui.notifications.info("📦 Manual Export Triggered Successfully!");
};
