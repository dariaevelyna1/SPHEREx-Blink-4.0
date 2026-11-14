// siteHeader.js: the one piece of interface both views share: the view switch and the two badges in the page header.
// The header's markup is in each HTML shell (so it works as plain links without JavaScript); this module keeps the links' query
// string, remembers the chosen view, applies ?theme=, and fills the badges from contract.badgeModel. DOM module (not pure).

import { badgeModel } from "./contract.js";
import { keepQuery, parseQuery, rememberView } from "./urlState.js";

const safeStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/**
 * Wire the header of the current page. view: "science" | "learn". Returns { setBadges({ health, healthError, sequence }) }.
 * `translate(text) -> text` (optional) turns the English badge words into the page's language (Learn in Romanian); the kind and status
 * attributes, which carry the colours, never change.
 */
export function mountHeader(view, doc = document, { translate = (x) => x } = {}) {
  const q = parseQuery(doc.defaultView.location.search), storage = safeStorage();
  if (q.theme) doc.documentElement.dataset.theme = q.theme;
  if (storage) rememberView(storage, view);
  const links = [...doc.querySelectorAll("[data-view-link]")];
  const refreshLinks = () => { for (const link of links) link.href = `${link.dataset.viewLink}.html${keepQuery(doc.defaultView.location.search)}`; };
  for (const link of links) {
    const target = link.dataset.viewLink;
    if (target === view) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    link.addEventListener("click", () => { if (storage) rememberView(storage, target); });
  }
  refreshLinks();
  const dataBadge = doc.getElementById("badge-data"), backendBadge = doc.getElementById("badge-backend");
  return {
    /** Call after the page changed its own query string (e.g. another sequence was chosen), so the switch carries it over. */
    refreshLinks,
    setBadges(state) {
      const b = badgeModel(state);
      const tl = (x) => (x ? translate(x) : x);
      b.data = { ...b.data, label: tl(b.data.label), detail: tl(b.data.detail) };
      b.backend = { ...b.backend, label: tl(b.backend.label) };
      dataBadge.textContent = b.data.label; dataBadge.dataset.kind = b.data.kind ?? "none"; dataBadge.title = b.data.detail;
      dataBadge.setAttribute("aria-label", `${tl("Data")}: ${b.data.label}. ${b.data.detail}`);
      backendBadge.textContent = b.backend.label; backendBadge.dataset.ok = String(b.backend.ok); backendBadge.title = b.backend.detail;
      backendBadge.setAttribute("aria-label", `${tl("Backend")}: ${b.backend.label}. ${b.backend.detail}`);
      return b;
    },
  };
}
