// Audit only: no document updates, chat messages, or gameplay changes.
const ID = 'durval-price-lock';
const ENDPOINT = 'https://durval-world.sparked.network/integration/foundry/price-changes';
const copy = value => JSON.parse(JSON.stringify(value ?? null));
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function changed(before, after) { return JSON.stringify(canonical(before)) !== JSON.stringify(canonical(after)); }
const raw = item => copy(item._source?.system?.price);
let busy = false;
let warned = false;
const queueKey = () => `${ID}:price-history:${game.world.id}:${game.user.id}`;
function queue() { return JSON.parse(localStorage.getItem(queueKey()) || '[]'); }
function warn() {
  if (!warned) ui.notifications.warn('Price history could not be saved or delivered. Keep this browser open and contact an Admin.');
  warned = true;
}
export async function flush() {
  if (busy) return;
  busy = true;
  try {
    const key = game.settings.get(ID, 'auditWriteKey');
    const pending = queue().slice(0, 25);
    if (!pending.length) return;
    if (!key) { warn(); return; }
    const response = await fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`}, body:JSON.stringify(pending), signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Delivery unavailable');
    const result = await response.json();
    if (!Array.isArray(result.accepted)) throw new Error('Invalid receipt');
    const sent = new Set(result.accepted);
    localStorage.setItem(queueKey(), JSON.stringify(queue().filter(e => !sent.has(e.event_id))));
    warned = false;
  } catch { warn(); }
  finally { busy = false; }
}
function record(item, before, userId) {
  const after = raw(item);
  if (!changed(before, after)) return;
  const user = game.users.get(userId);
  const actor = item.actor ?? (item.parent?.documentName === 'Actor' ? item.parent : null);
  const event = {
    event_id:crypto.randomUUID(), occurred_at:new Date().toISOString(),
    world_id:game.world.id, user_id:userId, user_name:user?.name ?? userId,
    actor_uuid:actor?.uuid ?? '', actor_name:actor?.name ?? '',
    item_uuid:item.uuid, item_name:item.name, before, after,
    quantity:Number(item._source?.system?.quantity ?? 1),
    foundry_version:String(game.version), pf2e_version:String(game.system.version)
  };
  try { const pending = queue(); pending.push(event); localStorage.setItem(queueKey(), JSON.stringify(pending)); }
  catch { warn(); return; }
  void flush();
}
if (globalThis.Hooks) {
  Hooks.once('init', () => {
    game.settings.register(ID, 'auditWriteKey', {
      name:'Price history upload key', hint:'Admin setup: append-only server key. This key cannot read or delete history.',
      scope:'world', config:true, restricted:true, type:String, default:''
    });
  });
  // Pre-update runs on the initiating client. Log only after a successful update.
  Hooks.on('preUpdateItem', (item, change, options, userId) => {
    if (game.system.id !== 'pf2e' || userId !== game.user.id) return;
    options.durvalPriceBefore = {uuid:item.uuid, price:raw(item)};
  });
  Hooks.on('updateItem', (item, change, options, userId) => {
    if (game.system.id !== 'pf2e' || userId !== game.user.id || options.durvalPriceBefore?.uuid !== item.uuid) return;
    record(item, options.durvalPriceBefore.price, userId);
  });
  // Actor-level embedded-item replacements can bypass the individual item workflow.
  Hooks.on('preUpdateActor', (actor, change, options, userId) => {
    if (game.system.id !== 'pf2e' || userId !== game.user.id || !Array.isArray(change.items)) return;
    options.durvalActorPrices = Object.fromEntries(actor.items.map(i => [i.id, raw(i)]));
  });
  Hooks.on('updateActor', (actor, change, options, userId) => {
    if (game.system.id !== 'pf2e' || userId !== game.user.id || !options.durvalActorPrices) return;
    for (const item of actor.items) {
      if (Object.hasOwn(options.durvalActorPrices, item.id)) record(item, options.durvalActorPrices[item.id], userId);
    }
  });
  Hooks.once('ready', () => {
    if (game.system.id !== 'pf2e') return;
    void flush();
    setInterval(() => void flush(), 30000);
    window.addEventListener('online', () => void flush());
  });
}
