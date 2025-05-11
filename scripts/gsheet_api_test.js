const GSheetConfig = {
    accessToken: `ya29.c.c0ASRK0GYkhSujq4NDaWCjQyfznBKYhynanZVwNiomj_5zEaGyON-irTh9cGf8ETNItivvmTxFmaLG_c4h-yEONHEJnehZpmPuU81E5lU6hkE1lrdkMhAj4ft8h7_Zbds8tJyDG9uFGAve_v-rzZ_0TfJX3-9jDT3XGBAssVJitYA7QpbOlnGDffLh8CPmcpYP3EU79Z_RHSDGsseSN1GtzqP2UBps6ukHe4DuhE1zk3KVwENlEjxN3EgTycbG60ng-zLmmLjWltWyf2-nWO6EdfLyJBf1MJieZbJlMerkS1FwPg0CPIdBEK-dBECQuD1H3QWTo4Driv0kLkApfqwHuQDFiRocr0VRkuQI2qDs5x0Sx7YnjAFF8wQG384D2Sx6J0rW2tj4Ryohrswqp4dIpjaxFdtU0h704oR6-UuUB8SUyxnoSQ7fIzXvs9aWS3-vaurn--8on51x7oM3SZQrQkiahFy7zSdl92a6vWxrp2On_nj6_hx5as578rz5duzRZ2i8p171IXkbrJ1FZ84tinFOivI1J_9_i1g-bshpIqrOiWlZ381tlmwJpaVOl59OIrcZwe4V3a9qy5vdXW81e5plWMhk7MfyV4zkRWQcxF6v2YcadJf7QJfiJIn7SqdZjMYOtfOXqlqk2dgdl6MF_kmmOeVIZMeI2SQItZRbkIROY8Ol5uoxVd1W8FmjZYgsejMpZ01M8Y-xQ5_uFvmhI6JJYMvjX5c2BFtr9nVjqlnewbVF5QY09O4tu7rva4wn_22kv245sX6pYOdaBsWd0cvh1kf-2z6t3mFq-hlMYOalbZe_2rglSXZUkb0eItOeYhFx8I9s9d2fQwUe0xsi5w9OXk653oBcvS06X5QokY6kIZyW5hWvBBx8IdYWb6V0r4QdVX4YB-dvscZU_s-lr_vBvOcJzvXl8i5Wy1J1xsY-s8782XWI_Jh_2mig2BjeZJR-ZIcUIUlbfUUM0jgs7FrXXdBJWa-j248m238v98fORhSbz9R_mQ0`, 
    spreadsheetId: "19WLjaJvyk3K02ink6Y8mwPvPCqk_AsH3ZHD49TUvGSQ", 
    targetRange: "Characters!B2", 
    value: "A" 
};

async function testGoogleSheetAPI() {
    if (!GSheetConfig.accessToken) {
        console.warn("❌ Access token not set. Please add it to GSheetConfig.accessToken.");
        ui.notifications.warn("❌ Access token missing in GSheetConfig.");
        return;
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GSheetConfig.spreadsheetId}/values/${GSheetConfig.targetRange}?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${GSheetConfig.accessToken}`,
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
}

// ✅ Ensure the function is globally available in Foundry
globalThis.testGoogleSheetAPI = testGoogleSheetAPI;
