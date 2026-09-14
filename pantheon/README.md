# Durval’s World — Pantheon 1.1.0

For Foundry 14 and PF2e 8.5.x. Installs through the module manifest in this folder.
Enable the module in the world, then open **Game Settings → Configure Settings →
Module Settings → Durval’s World — Pantheon → Manage deities**.

## First use

Installation changes no deity choices or characters. No keys, accounts or server
API connection are needed. The Durval portrait loads from the public campaign website. The settings are shared across clients in this world.

- **Create deity draft** makes a private native Deity item for manual editing.
- **Import prepared deity** accepts a `durval-deity-v1` JSON file prepared by the
  assistant. It fills the portrait, description, edicts, anathema, skill, weapons,
  domains, alternate domains, font, attributes, sanctification and cleric spells.
  It validates choices against the installed PF2e configuration and resolves spell
  UUIDs before creating anything. Imported entries stay private until published.
- **Edit** opens the normal PF2e sheet for changes. **Publish…** shares the reviewed
  deity with players. Reopen old pickers after a new publication.
- Reimporting the same stable key opens the existing entry without overwriting it.
  Same-name collisions are rejected. This is creation, not automatic updates of
  source deities or existing characters.
- The generic GM API is `game.modules.get('durval-pantheon').api.importDeity(spec)`.
  This is a local Foundry API, not a remote connection for the assistant. Currently
  assistant-prepared files require one import by the GM; no automatic delivery
  bridge has been installed. Manual creation continues to work independently.

## Retiring gods (1.1.0)

**Retire…** previews affected character names and asks for confirmation, then clears
those characters' deity items using native PF2e deletion. This applies to characters
whose owners are offline too. Only character Deity items are removed: no manual
skill/feat/gold edits. PF2e recalculates derived values; chosen feats/spells may need
GM review when their deity changes.

Before character removal a private **Pantheon recovery** Journal Entry is created
with default ownership None. It contains original deity item JSON, actor IDs and
per-item status. No backup means no removal. Keep these journals. Recovery should
be reviewed against current character state; showing the god does not restore
worshippers. Do not blindly restore old backups.

The official-gods switch retires PF2e system choices; **Show** exceptions override
it. Retired source UUIDs and names/slugs identify copied character deity items.
Avoid giving distinct gods identical names/slugs. The module also cancels native
creation/update of retired deity items on characters (including ordinary drops)
while enabled. This is client-side Foundry enforcement, not a server security
boundary against disabled modules or deliberately bypassed client hooks.

**Delete…** on a WORLD deity first retires it, downloads the source's JSON backup,
then deletes the world source. Core/compendium gods are not physically deleted.
A connected GM performs character reconciliation. The initiating GM is preferred;
if absent, an active GM is elected. A reconnect checks enforced retirements again.
**Recheck retirements** displays the affected characters and reconciles remaining
entries; use it after upgrading from 1.0.0 to apply old Hide choices to characters.
Existing 1.0.0 hides do NOT silently start deleting characters on upgrade.

## Mechanics and updates

Native PF2e features interpret the deity's fields. Choosing a deity alone is not a
grant of every skill, spell or domain feat. Clerics and other divine characters
still use the system's class features and normal choices. The module contains no
independent actor writer, grant engine or automatic character updates.

Changing a source deity does not refresh existing embedded copies on characters.
Review/reselect on those characters separately when an approved rules change is
intended. Retiring a choice clears the matching native deity item after confirmation.

## Tested scope

Picker inspected against the official `pf2e-8.5.0` source, including the
ABCPicker ApplicationV2, `li[data-uuid]` entries and native deity schema. Automated
tests cover visibility policy and browser integration against a mocked Foundry
host. This is NOT a completed live-world installation or native cleric playtest.
Final live check: enable module, open manager, create/edit private draft, hide one
official deity, reopen picker and confirm hidden, show it again. Then inspect a
test cleric after a deity's mechanical package has been decided. Never use a live
player character as a throwaway test.

Source: https://github.com/foundryvtt/pf2e/blob/pf2e-8.5.0/src/module/actor/character/apps/abc-picker/app.ts

GM-only manager. No background polling, external API writes or credentials. Previously confirmed enforced retirements are reconciled when a GM reconnects.
The module itself does not edit the website Pantheon; website lore and mechanical
publication are separate until explicitly connected in a future feature.

## Prepared-file format

Every prepared file has `format: "durval-deity-v1"`, a stable lowercase `key`,
`name`, optional `image` (HTTPS or Foundry path), and plain-text `description`,
`edicts`, `anathema`. The `mechanics` object requires:

- `skills`: skill slugs (maximum two).
- `weapons`: base weapon/shield slugs.
- `domains`, `alternateDomains`: native domain slugs.
- `font`: `heal`, `harm`, both, or an intentionally empty array.
- `attributes`: native attribute slugs (`str`, `dex`, `con`, `int`, `wis`, `cha`).
- `sanctification`: null, or `{ "modal": "can" | "must", "what": ["holy" | "unholy"] }`.
- `spells`: rank keys mapping to real `Compendium.package.pack.Item.16charID` UUIDs.

Empty arrays mean deliberate absence, never guessed benefits. Agree the package
with the user and verify its PF2e balance before producing a playable deity.
Arbitrary rule elements, ownership, embedded actor updates and HTML from files
are not imported. For custom automation beyond native deity fields, discuss it
separately. Backups from Delete are native Item JSON: restore them using Foundry's
native Item import, not this prepared-file importer.

1.1.0 verification: 15 policy/schema/retirement tests; mocked Foundry real-browser integration
checks include populated import, same-key duplicate prevention, no Durval-specific
button, publication, backup-before-delete, preserved unrelated items, and GM guard.
Live installation of 1.0.0 manager was confirmed by user screenshot (481 entries).
1.1.0 still needs its post-update live check.
