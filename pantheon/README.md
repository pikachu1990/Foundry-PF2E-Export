# Durval’s World — Pantheon 1.0.0

For Foundry 14 and PF2e 8.5.x. Installs through the module manifest in this folder.
Enable the module in the world, then open **Game Settings → Configure Settings →
Module Settings → Durval’s World — Pantheon → Manage deities**.

## First use

Installation changes no deity choices or characters. No keys, accounts or server
API connection are needed. The Durval portrait loads from the public campaign website. The settings are shared across clients in this world.

- **Open / create Durval draft** creates a private world Deity item using the
  accepted mortal-form portrait. A same-name world deity is opened, not duplicated.
- Edit the native **Details** tab: divine skill, favored weapon, domains, alternate
  domains, font, sanctification and attributes. Drag spell items into the native
  cleric-spell section and check their ranks. Add lore, edicts and anathema in the
  description. Values are deliberately blank until the campaign decides them.
- Return to the manager and **Publish…** only after reviewing the mechanics.
  Publishing sets Observer permission for players. Reopen an already-open picker
  to gather newly shared items.
- **Create deity draft** does the same for any new name. Native world deity items
  are already supported by PF2e's picker; no separate compendium import is needed.
  They can be exported/backed up like normal Foundry world items. Module updates
  do not overwrite them.

## Removing choices

**Hide** removes an entry from the native character-sheet deity picker. **Show**
restores it. The official-gods switch hides PF2e's system entries; individually
shown exceptions remain visible. World and other module gods are unaffected by
that bulk switch. Drafts remain filtered even for a GM until published.

Nothing is deleted, including official compendiums and deities already on
characters. Hiding is a picker convenience, NOT access control: direct compendium
browsing, macros and drag-and-drop are outside its scope. Disable this module to
remove its picker filtering; world deity documents remain in the world.

## Mechanics and updates

Native PF2e features interpret the deity's fields. Choosing a deity alone is not a
grant of every skill, spell or domain feat. Clerics and other divine characters
still use the system's class features and normal choices. The module contains no
independent actor writer, grant engine or automatic character updates.

Changing a source deity does not refresh existing embedded copies on characters.
Review/reselect on those characters separately when an approved rules change is
intended. Retiring a choice does not clear existing character selections.

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

GM-only manager. No background polling, network writes, credentials or deletions.
The module itself does not edit the website Pantheon; website lore and mechanical
publication are separate until explicitly connected in a future feature.
