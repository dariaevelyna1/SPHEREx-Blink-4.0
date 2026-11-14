// entry.js: index.html picks the interface: ?view= wins, then the remembered choice, then the screen width (urlState.chooseView),
// and goes there keeping the deep-link parameters. Without JavaScript the page shows two plain links.

import { chooseView, keepQuery, parseQuery, rememberedView } from "./urlState.js";

const q = parseQuery(location.search);
let storage = null; try { storage = localStorage; } catch { /* private mode */ }
const view = chooseView({ view: q.view, remembered: storage ? rememberedView(storage) : null, widthPx: innerWidth });
for (const a of document.querySelectorAll("[data-view-link]")) a.href = `${a.dataset.viewLink}.html${keepQuery(location.search)}`;
document.getElementById("entry-status").textContent = `Opening ${view === "science" ? "Science" : "Learn"}…`;
location.replace(`${view}.html${keepQuery(location.search)}`);
