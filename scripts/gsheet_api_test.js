const GSheetConfig = {
    tokenAPIUrl: "http://45.43.163.166:25593/get-token", // ✅ Token API endpoint with correct IP and port
    spreadsheetId: "19WLjaJvyk3K02ink6Y8mwPvPCqk_AsH3ZHD49TUvGSQ", // Your Google Sheet ID
    targetRange: "Characters!B2", // Target cell in the sheet
    value: "A" // Value to write
};

async function testGoogleSheetAPI() {
    try {
        // ✅ Fetch fresh token from your bot's API
        const tokenResponse = await fetch(GSheetConfig.tokenAPIUrl);
        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            console.error("❌ Failed to fetch token. API response:", tokenData);
            ui.notifications.warn("❌ Failed to fetch token. Check API.");
            return;
        }

        const accessToken = tokenData.access_token;

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GSheetConfig.spreadsheetId}/values/${GSheetConfig.targetRange}?valueInputOption=USER_ENTERED`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                values: [[GSheetConfig.value]]
            })
        });

        if (response.ok) {
            console.log("📚 Google Sheet Updated Successfully!");
            ui.notifications.info("📚 Sheet Updated!");
        } else {
            const errorText = await response.text();
            console.error("❌ Failed to update Google Sheet:", errorText);
            ui.notifications.warn("❌ Failed to update Google Sheet. Check console for details.");
        }
    } catch (error) {
        console.error("❌ Error during Google Sheet API call:", error);
        ui.notifications.warn("❌ Critical error during Sheet API call.");
    }
}

// ✅ Register globally for Foundry console access
globalThis.testGoogleSheetAPI = testGoogleSheetAPI;
