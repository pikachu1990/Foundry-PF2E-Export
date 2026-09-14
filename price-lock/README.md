# Durval’s World — Item Price Lock 1.1.0

For Foundry 14 and PF2e. Blocks normal player and trusted-player edits to existing item prices, including price per quantity. GM and Assistant GM accounts retain access (Foundry isGM). Version 1.1 adds server price history; blocking behavior is unchanged.

## Install on The Forge
1. Extract durval-price-lock-1.1.0.zip.
2. In My Foundry / Games Configuration, click Summon Import Wizard.
3. Select the extracted durval-price-lock folder containing module.json. Finish the import.
4. Open your world. Game Settings → Module Management → enable “Durval’s World — Item Price Lock” → Save Module Settings.
5. Let connected users reload. Enable separately in each world where needed.

For history, Game Settings → Configure Settings → Item Price Lock → Price history upload key: paste the private setup key supplied separately, then save. The key can only append history; it cannot read/delete records. Do not post the setup key publicly. Reload connected clients after upgrading. Owner login is not required for GM changes to be reported.

History records successful raw price/price-per edits to existing items (including actor-level item replacements), with Foundry user ID/name, actor/item UUID/name, old/new raw prices, quantity, client time and server receipt time. It does not record historical edits before installation, new-item creation, deletion, or automatic rune/material-derived price recalculation. Identity is client-reported, not independently attested. Import workflows must be tested before assuming coverage.

Unsent events remain in this browser's local storage and retry every 30 seconds and on reconnect while Foundry is open. Closing the browser postpones retries until it is reopened; clearing browser storage loses unsent events. Storage or delivery failure displays a warning. No periodic Discord posts or gameplay updates are made.

Ask Codex “Check GM price changes” or “Export the full price-change log”. Server records do not expire automatically. See the project's PRICE-HISTORY.md for storage, credentials and full CSV/JSON export instructions.

Do not upload only to the Asset Library: it must be imported as a module.

## Quick player-account test
Use a spare test character and an ordinary Player account, not your GM session.
- Open a physical item: price and price-per-quantity inputs should be disabled.
- Quantity changes, equipping and using an item should still work.
- As GM, price editing should still work.
- Check your usual purchase, transfer and rune workflows before relying on the module during a session. Actual Forge/PF2e integration has not been tested yet.

To remove the restriction, disable this module. No items, prices or permissions are rewritten on activation/deactivation.

## Scope
This is a persistent client-side editing guard while the module is enabled. Foundry preUpdateItem hooks can reject ordinary updates, including normal API/macro edits. It is not server-side anti-cheat: a deliberately modified client can bypass hooks. It does not validate newly created/imported items or correct existing prices. Runes/materials may legitimately change derived PF2e prices; those mechanics are left intact. No inventory, coin, wealth, sync or reward rules are changed.
