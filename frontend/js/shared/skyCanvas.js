// skyCanvas.js: draw a grey image (0..255 per pixel, from analysis.stretchAsinh) and marks on canvases. DOM module shared by both views.
// The picture is a derived display product; measurements never read it back. Mark colours come from the CSS tokens.

/** Paint n x n grey levels, one canvas pixel per image pixel (CSS scales it up, pixelated: the true resolution is shown). */
export function paintGrey(canvas, grey, n) {
  if (canvas.width !== n) { canvas.width = n; canvas.height = n; }
  const ctx = canvas.getContext("2d"), image = ctx.createImageData(n, n), d = image.data;
  for (let i = 0; i < n * n; i++) { const v = grey[i]; d[4 * i] = v; d[4 * i + 1] = v; d[4 * i + 2] = v; d[4 * i + 3] = 255; }
  ctx.putImageData(image, 0, 0);
}

export const token = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

/**
 * Draw marks on an overlay canvas that covers the picture. marks: [{ x, y (image px, edge coordinates), kind: "candidate"|"truth"|"guess",
 * shape: "ring"|"cross"|"dot", label?, strong? }]. The overlay is sized in device pixels so that lines stay sharp.
 */
export function paintMarks(overlay, marks, n) {
  const rect = overlay.getBoundingClientRect(), dpr = globalThis.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
  if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
  const ctx = overlay.getContext("2d"), s = w / n;
  ctx.clearRect(0, 0, w, h);
  const colour = { candidate: token("--mark-candidate"), truth: token("--mark-truth"), guess: token("--mark-guess") };
  for (const m of marks) {
    const cx = m.x * s, cy = m.y * s, r = (m.radiusPx ?? 2.2) * s;
    ctx.strokeStyle = colour[m.kind] ?? colour.candidate; ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = (m.strong ? 3 : 1.5) * dpr;
    ctx.beginPath();
    if (m.shape === "cross") { ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r / 3, cy); ctx.moveTo(cx + r / 3, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r / 3); ctx.moveTo(cx, cy + r / 3); ctx.lineTo(cx, cy + r); ctx.stroke(); }
    else if (m.shape === "dot") { ctx.arc(cx, cy, Math.max(2 * dpr, 0.35 * s), 0, 2 * Math.PI); ctx.fill(); }
    else { ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke(); }
    if (m.label) { ctx.font = `${Math.round(12 * dpr)}px ${token("--font-mono")}`; ctx.fillText(m.label, cx + r + 3 * dpr, cy - r); }
  }
}

/** A pointer event on the picture -> image pixel coordinates (edge coordinates, fractions kept). */
export function eventToPixel(event, element, n) {
  const rect = element.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * n, y: ((event.clientY - rect.top) / rect.height) * n };
}
