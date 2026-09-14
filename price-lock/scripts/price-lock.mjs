export const MESSAGE = 'Item prices are managed by the GM.';

// Only price fields: quantities, coins, runes, charges and equipment state are untouched.
export function touchesPrice(change, prefix = '') {
  if (!change || typeof change !== 'object') return false;
  return Object.entries(change).some(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (path === 'system.-=price' || path.startsWith('system.price.') || path === 'system.price') return true;
    if (path === '-=system' || (path === 'system' && (value === null || typeof value !== 'object'))) return true;
    return touchesPrice(value, path);
  });
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function priceChanged(item, change, merge, expand) {
  if (!touchesPrice(change)) return false;
  const before = item._source ?? item.toObject();
  const after = merge(before, expand(change), {inplace:false, performDeletions:true});
  return JSON.stringify(canonical(before.system?.price)) !== JSON.stringify(canonical(after.system?.price));
}
export function lockInputs(root) {
  if (!root?.querySelectorAll) return;
  for (const input of root.querySelectorAll('[name], [data-property]')) {
    const path = input.getAttribute('name') || input.getAttribute('data-property') || '';
    if (path === 'system.price' || path.startsWith('system.price.')) {
      input.disabled = true;
      input.setAttribute('aria-disabled', 'true');
      input.title = MESSAGE;
    }
  }
}
if (globalThis.Hooks) {
  Hooks.on('preUpdateItem', (item, change) => {
    if (game.system.id !== 'pf2e' || game.user.isGM) return;
    if (priceChanged(item, change, foundry.utils.mergeObject, foundry.utils.expandObject)) {
      ui.notifications.warn(MESSAGE);
      return false;
    }
  });
  const render = (app, html) => {
    if (game.system.id !== 'pf2e' || game.user.isGM) return;
    const item = app.item ?? app.document ?? app.object;
    if (item?.documentName !== 'Item') return;
    lockInputs(html?.querySelectorAll ? html : html?.[0]);
  };
  Hooks.on('renderItemSheet', render);
  Hooks.on('renderApplicationV2', render);
}
