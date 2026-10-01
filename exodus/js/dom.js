// Exodus — tiny DOM helpers. Text always goes in as text nodes, never as HTML.

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v || '';
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'value') el.value = v ?? '';
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k.startsWith('aria-')) el.setAttribute(k, String(v));
      else if (v === true) el.setAttribute(k, '');
      else if (v != null && v !== false) el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : String(k));
  }
}
