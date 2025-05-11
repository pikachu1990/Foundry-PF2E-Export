Hooks.once('ready', () => {
    ui.notifications.info("✅ Module Loaded: Ready for Action!", { permanent: true });
    console.log("✅ PF2E Export Module Loaded and Ready!");

    // Create a visible HTML banner in the UI
    const banner = document.createElement("div");
    banner.innerHTML = "<h1 style='color: red; text-align: center;'>🔥 MODULE IS ACTIVE 🔥</h1>";
    banner.style.position = "absolute";
    banner.style.top = "10%";
    banner.style.left = "25%";
    banner.style.zIndex = 9999;
    banner.style.background = "#000";
    banner.style.padding = "20px";
    banner.style.border = "5px solid red";
    banner.style.borderRadius = "15px";

    document.body.appendChild(banner);

    // Auto remove banner after 10 seconds
    setTimeout(() => {
        banner.remove();
    }, 10000);
});
