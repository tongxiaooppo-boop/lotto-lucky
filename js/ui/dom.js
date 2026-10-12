// 極簡 DOM 小工具。文字一律走 textContent,避免注入。
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

export function toast(msg, err = false) {
  const root = document.getElementById("toast");
  const t = h("div", { class: "toast" + (err ? " err" : "") }, msg);
  root.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function download(filename, text) {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
