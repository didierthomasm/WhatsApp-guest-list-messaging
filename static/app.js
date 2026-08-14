let WEDDING_URL = "";
let EVENT_CODE = "";
let GUESTS = [];
let ALL_TAGS = [];

const S = {
  view: "pending",
  query: "",
  tags: [],
  sentIds: new Set(),
  picked: {},
  collapsed: {},
  groupParties: true,
  selectedId: null,
  tab: "preview",
  template: "",
  draft: "",
  saveStatus: "",
  saveStatusError: false,
  focusOn: false,
  focusIdx: 0,
  queue: [],
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function computeAllTags(guests) {
  const seen = [];
  guests.forEach((g) => g.tags.forEach((t) => { if (!seen.includes(t)) seen.push(t); }));
  return seen;
}

function msgFor(template, guest) {
  if (!guest) return "";
  return template.split("{first_name}").join(guest.first).split("{link}").join(WEDDING_URL).split("{code}").join(EVENT_CODE);
}

function linkFor(guest, template) {
  if (!guest || !guest.hasPhone) return "#";
  return "https://wa.me/" + guest.waPhone + "?text=" + encodeURIComponent(msgFor(template, guest));
}

function matches(g) {
  const q = S.query.trim().toLowerCase();
  const okQ = !q || g.name.toLowerCase().includes(q) || g.phone.includes(q);
  const okT = S.tags.length === 0 || S.tags.some((t) => g.tags.includes(t));
  return okQ && okT;
}

function inView(g) {
  const isSent = S.sentIds.has(g.id);
  if (S.view === "nophone") return !g.hasPhone;
  if (!g.hasPhone) return false;
  return S.view === "sent" ? isSent : !isSent;
}

function visibleGuests() {
  return GUESTS.filter((g) => matches(g) && inView(g));
}

function queueList() {
  const picked = GUESTS.filter((g) => S.picked[g.id] && g.hasPhone && !S.sentIds.has(g.id));
  if (picked.length) return picked;
  return visibleGuests().filter((g) => g.hasPhone && !S.sentIds.has(g.id));
}

function selectedGuest() {
  return GUESTS.find((g) => g.id === S.selectedId) || GUESTS[0];
}

function computeStats() {
  const withPhone = GUESTS.filter((g) => g.hasPhone);
  const sentCount = withPhone.filter((g) => S.sentIds.has(g.id)).length;
  const totalCount = withPhone.length;
  const pct = totalCount ? Math.round((sentCount / totalCount) * 100) : 0;
  return {
    sentCount,
    totalCount,
    pct,
    pendingCount: totalCount - sentCount,
    noPhoneCount: GUESTS.length - totalCount,
  };
}

function setState(patch) {
  Object.assign(S, patch);
  render();
}

async function markSent(id) {
  if (S.sentIds.has(id)) return;
  S.sentIds.add(id);
  render();
  try {
    await fetch(`/api/mark-sent/${id}`, { method: "POST" });
  } catch (err) {
    console.error("No se pudo guardar el estado enviado", err);
  }
}

async function unmarkSent(id) {
  if (!S.sentIds.has(id)) return;
  S.sentIds.delete(id);
  render();
  try {
    await fetch(`/api/unmark-sent/${id}`, { method: "POST" });
  } catch (err) {
    console.error("No se pudo guardar el estado enviado", err);
  }
}

function toggleSent(id) {
  if (S.sentIds.has(id)) unmarkSent(id);
  else markSent(id);
}

function focusNext() {
  if (S.focusIdx + 1 >= S.queue.length) setState({ focusOn: false });
  else setState({ focusIdx: S.focusIdx + 1 });
}

function insertVar(token) {
  S.draft = S.draft + token;
  const ta = document.getElementById("draft-textarea");
  if (ta) { ta.value = S.draft; ta.focus(); }
}

async function saveTemplate() {
  if (!S.draft.trim()) {
    S.saveStatus = "El mensaje no puede estar vacío.";
    S.saveStatusError = true;
    render();
    return;
  }

  try {
    const res = await fetch("/api/message-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: S.draft }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      S.saveStatus = data.error || "No se pudo guardar el mensaje.";
      S.saveStatusError = true;
      render();
      return;
    }

    S.template = S.draft;
    S.saveStatus = "Guardado · enlaces actualizados";
    S.saveStatusError = false;
    render();
  } catch (err) {
    S.saveStatus = "No se pudo guardar el mensaje.";
    S.saveStatusError = true;
    render();
  }
}

// --- Rendering ---

function render() {
  renderHeader();
  renderToolbar();
  renderTagFilters();
  renderList();
  renderPane();
  renderFocus();
}

function viewTabHtml(name, label, count) {
  const active = S.view === name;
  return `<button class="view-tab ${active ? "active" : ""}" data-action="set-view" data-view="${name}">${label} <span class="view-tab-count">${count}</span></button>`;
}

function renderHeader() {
  const { sentCount, totalCount, pct, pendingCount, noPhoneCount } = computeStats();
  const q = queueList();
  const el = document.getElementById("app-header");
  el.innerHTML = `
    <div class="header-top">
      <div>
        <div class="header-title-row">
          <h1>Invitados por WhatsApp</h1>
          <span class="header-eyebrow">Carolina &amp; Didier</span>
        </div>
        <p class="header-subtitle">
          Código <span class="code-chip">${esc(EVENT_CODE)}</span>
          &nbsp;&middot;&nbsp; <a href="${esc(WEDDING_URL)}" target="_blank" rel="noopener">${esc(WEDDING_URL.replace(/^https?:\/\//, ""))}</a>
        </p>
      </div>
      <div class="header-stats-row">
        <div class="stats-box">
          <div class="stats-line">
            <div class="stats-count">
              <span class="stats-count-num">${sentCount}</span>
              <span class="stats-count-of">de ${totalCount} enviados</span>
            </div>
            <span class="stats-pct">${pct}%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <button class="btn-start-queue" data-action="start-queue">Iniciar envío <span>&middot; ${q.length}</span></button>
      </div>
    </div>
    <div class="view-tabs">
      ${viewTabHtml("pending", "Pendientes", pendingCount)}
      ${viewTabHtml("sent", "Enviados", sentCount)}
      ${viewTabHtml("nophone", "Sin teléfono", noPhoneCount)}
      <div class="group-toggle-wrap">
        <label class="group-toggle-label">
          <input type="checkbox" data-action="toggle-group-parties" ${S.groupParties ? "checked" : ""} />
          Agrupar parejas y familias
        </label>
      </div>
    </div>
  `;
}

function renderToolbar() {
  const vis = visibleGuests();
  const resultText = `${vis.length} ${vis.length === 1 ? "invitado" : "invitados"}`;
  const el = document.getElementById("list-toolbar");
  el.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">&#8981;</span>
      <input type="text" id="search-input" class="search-input" placeholder="Buscar nombre o teléfono…" value="${esc(S.query)}" />
    </div>
    <span class="result-label" id="result-label">${resultText}</span>
    <div class="toolbar-actions">
      <button class="btn-ghost" data-action="select-all">Seleccionar visibles</button>
      <button class="btn-text" data-action="select-none">Limpiar</button>
    </div>
  `;
}

function renderTagFilters() {
  const el = document.getElementById("tag-filter-row");
  el.innerHTML = ALL_TAGS.map((t) => {
    const on = S.tags.includes(t);
    const total = GUESTS.filter((g) => g.tags.includes(t) && g.hasPhone).length;
    const done = GUESTS.filter((g) => g.tags.includes(t) && g.hasPhone && S.sentIds.has(g.id)).length;
    return `<button class="tag-chip ${on ? "active" : ""}" data-action="toggle-tag" data-tag="${esc(t)}">${esc(t)} <span class="tag-chip-meta">${done}/${total}</span></button>`;
  }).join("");
}

function buildItems() {
  const vis = visibleGuests();
  const items = [];

  if (!S.groupParties) {
    vis.forEach((g) => items.push({ solo: true, guest: g }));
    return items;
  }

  const done = new Set();
  vis.forEach((g) => {
    const key = g.party;
    const members = key ? GUESTS.filter((x) => x.party === key) : [];
    if (!key || members.length < 2) { items.push({ solo: true, guest: g }); return; }
    if (done.has(key)) return;
    done.add(key);
    items.push({ solo: false, key, members });
  });
  return items;
}

function renderMemberRow(g, inGroup) {
  if (!g.hasPhone) {
    return `
      <div class="guest-row-muted" data-action="select-guest" data-id="${g.id}">
        <div class="guest-info">
          <span class="nophone-name">${esc(g.name)}</span>
          <div class="guest-subtitle">${esc(g.email || "sin contacto ni email")}</div>
        </div>
        <span class="nophone-pill">Sin teléfono</span>
      </div>
    `;
  }

  const isSent = S.sentIds.has(g.id);
  const isSel = S.selectedId === g.id;
  const party = g.party ? GUESTS.filter((x) => x.party === g.party) : [];
  const showBadge = !inGroup && party.length > 1;
  const partyNote = party.filter((m) => m.id !== g.id).map((m) => m.name).join(", ");
  const picked = !!S.picked[g.id];

  return `
    <div class="guest-row ${isSel ? "selected" : ""} ${isSent ? "sent" : ""}" data-action="select-guest" data-id="${g.id}">
      <input type="checkbox" data-action="pick-guest" data-id="${g.id}" ${picked ? "checked" : ""} />
      <div class="guest-avatar ${isSent ? "sent" : ""}">${esc(initialsOf(g.name))}</div>
      <div class="guest-info">
        <div class="guest-name-row">
          <span class="guest-name">${esc(g.name)}</span>
          ${showBadge ? `<span class="party-badge" title="Grupo con: ${esc(partyNote)}">&#8646; ${party.length}</span>` : ""}
        </div>
        <div class="guest-subtitle">${esc(g.phone)}</div>
      </div>
      <div class="guest-chips">${g.tags.slice(0, 2).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
      <div class="guest-status">${isSent ? "Enviado" : ""}</div>
    </div>
  `;
}

function renderGroupItem(item) {
  const { key, members } = item;
  const open = !S.collapsed[key];
  const sendables = members.filter((m) => m.hasPhone);
  const sentIn = sendables.filter((m) => S.sentIds.has(m.id)).length;
  const noPhone = members.length - sendables.length;
  const countLabel = `${members.length} en el grupo` + (noPhone ? ` · ${noPhone} sin teléfono` : "");
  const statusLabel = sendables.length ? `${sentIn} de ${sendables.length} enviados` : "seguimiento por email";

  return `
    <div class="party-group">
      <div class="party-header" data-action="toggle-party" data-party="${esc(key)}">
        <span class="party-caret ${open ? "open" : ""}">&#9656;</span>
        <span class="party-title">${esc(members.map((m) => m.first).join(" & "))}</span>
        <span class="party-count-pill">${esc(countLabel)}</span>
        <span class="party-status">${esc(statusLabel)}</span>
      </div>
      <div class="party-members ${open ? "" : "collapsed"}">
        ${members.map((m) => renderMemberRow(m, true)).join("")}
      </div>
    </div>
  `;
}

function renderList() {
  const el = document.getElementById("list-scroll");
  const items = buildItems();

  if (items.length === 0) {
    el.innerHTML = `<div class="empty-state">Nadie coincide con estos filtros.</div>`;
    return;
  }

  el.innerHTML = items.map((item) => (item.solo ? renderMemberRow(item.guest, false) : renderGroupItem(item))).join("");
}

function paneTabHtml(name, label) {
  const active = S.tab === name;
  return `<button class="pane-tab ${active ? "active" : ""}" data-action="set-tab" data-tab="${name}">${label}</button>`;
}

function previewPaneHtml() {
  const sel = selectedGuest();
  const isSent = S.sentIds.has(sel.id);
  const party = sel.party ? GUESTS.filter((x) => x.party === sel.party && x.id !== sel.id) : [];
  const rendered = msgFor(S.template, sel);
  const now = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return `
    <div class="detail-header">
      <div class="detail-avatar ${isSent ? "sent" : ""}">${esc(initialsOf(sel.name))}</div>
      <div>
        <div class="detail-name">${esc(sel.name)}</div>
        <div class="detail-phone">${esc(sel.hasPhone ? sel.phone : (sel.email || "sin contacto"))}</div>
      </div>
      <div class="detail-status ${isSent ? "sent" : (!sel.hasPhone ? "nophone" : "")}">${isSent ? "Enviado" : (sel.hasPhone ? "Pendiente" : "Sin teléfono")}</div>
    </div>
    <div class="detail-chips">${sel.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
    ${party.length ? `
      <div class="party-box">
        <div class="party-box-title">Va con</div>
        ${party.map((m) => `
          <div class="party-member-row">
            <span class="party-dot ${S.sentIds.has(m.id) ? "sent" : (!m.hasPhone ? "nophone" : "")}"></span>
            ${esc(m.name)}
            <span class="party-member-note">${m.hasPhone ? (S.sentIds.has(m.id) ? "enviado" : "pendiente") : "sin teléfono"}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
    <div class="section-label">Mensaje que se enviará</div>
    <div class="message-preview-wrap">
      <div class="message-bubble">${esc(rendered)}<div class="message-meta">${now} &#10003;&#10003;</div></div>
      <div class="char-count">${rendered.length} caracteres</div>
    </div>
  `;
}

function templatePaneHtml() {
  const sel = selectedGuest();
  const rendered = msgFor(S.template, sel);
  const vars = [
    { token: "{first_name}", hint: "Nombre del invitado" },
    { token: "{link}", hint: WEDDING_URL },
    { token: "{code}", hint: EVENT_CODE },
  ];

  return `
    <div class="template-help">Se aplica a todos los invitados. Las variables se reemplazan al enviar.</div>
    <textarea id="draft-textarea" class="template-textarea" rows="9"></textarea>
    <div class="template-vars">
      ${vars.map((v) => `<button class="var-chip" data-action="insert-var" data-var="${esc(v.token)}" title="${esc(v.hint)}">${esc(v.token)}</button>`).join("")}
    </div>
    <div class="template-actions">
      <button class="btn-primary" data-action="save-template">Guardar mensaje</button>
      <span id="template-status" class="template-status ${S.saveStatusError ? "error" : ""}">${esc(S.saveStatus)}</span>
    </div>
    <div class="template-example">
      <div class="section-label" style="margin-top:0;">Ejemplo con ${esc(sel.name)}</div>
      <div class="example-box" style="margin-top:10px;">${esc(rendered)}</div>
    </div>
  `;
}

function statsPaneHtml() {
  const { sentCount, pendingCount, noPhoneCount } = computeStats();
  return `
    <div class="stats-grid">
      <div class="stat-tile"><div class="stat-tile-value">${pendingCount}</div><div class="stat-tile-label">pendientes</div></div>
      <div class="stat-tile accent"><div class="stat-tile-value">${sentCount}</div><div class="stat-tile-label">enviados</div></div>
    </div>
    <div class="section-label">Por etiqueta</div>
    <div class="tag-stats">
      ${ALL_TAGS.map((t) => {
        const total = GUESTS.filter((g) => g.tags.includes(t) && g.hasPhone).length;
        const doneCount = GUESTS.filter((g) => g.tags.includes(t) && g.hasPhone && S.sentIds.has(g.id)).length;
        const p = total ? Math.round((doneCount / total) * 100) : 0;
        return `
          <div>
            <div class="tag-stat-row"><span>${esc(t)}</span><span>${doneCount} / ${total}</span></div>
            <div class="tag-stat-bar-track"><div class="tag-stat-bar-fill" style="width:${p}%"></div></div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="followup-note">${noPhoneCount} invitados sin teléfono necesitan seguimiento manual por email.</div>
  `;
}

function renderPane() {
  const el = document.getElementById("pane-scroll");
  const body = S.tab === "preview" ? previewPaneHtml() : S.tab === "template" ? templatePaneHtml() : statsPaneHtml();
  el.innerHTML = `
    <div class="pane-tabs">
      ${paneTabHtml("preview", "Vista previa")}
      ${paneTabHtml("template", "Mensaje")}
      ${paneTabHtml("stats", "Progreso")}
    </div>
    <div class="pane-body">${body}</div>
  `;

  if (S.tab === "template") {
    const ta = document.getElementById("draft-textarea");
    if (ta) ta.value = S.draft;
  }

  renderFooter();
}

function renderFooter() {
  const el = document.getElementById("pane-footer");
  const sel = selectedGuest();
  const isSent = S.sentIds.has(sel.id);
  const toggleBtn = `<button class="btn-toggle-sent" data-action="toggle-selected-sent" data-id="${sel.id}">${isSent ? "Desmarcar" : "Marcar enviado"}</button>`;

  if (!sel.hasPhone) {
    el.innerHTML = `<span class="btn-open-wa" style="opacity:0.45;cursor:not-allowed;">Sin teléfono</span>${toggleBtn}`;
    return;
  }

  const link = linkFor(sel, S.template);
  el.innerHTML = `
    <a href="${esc(link)}" target="_blank" rel="noopener" class="btn-open-wa" data-action="open-selected-wa" data-id="${sel.id}">Abrir WhatsApp</a>
    ${toggleBtn}
  `;
}

function renderFocus() {
  const el = document.getElementById("focus-overlay");
  const guest = S.queue[S.focusIdx];

  if (!S.focusOn || !guest) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }

  el.classList.remove("hidden");
  const rendered = msgFor(S.template, guest);
  const pct = S.queue.length ? Math.round(((S.focusIdx + 1) / S.queue.length) * 100) : 0;
  const link = linkFor(guest, S.template);

  el.innerHTML = `
    <div class="focus-card">
      <div class="focus-top">
        <span class="focus-eyebrow">Envío en curso</span>
        <span class="focus-position">${S.focusIdx + 1} de ${S.queue.length}</span>
      </div>
      <div class="focus-progress-track"><div class="focus-progress-fill" style="width:${pct}%"></div></div>
      <div class="focus-guest-row">
        <div class="focus-avatar">${esc(initialsOf(guest.name))}</div>
        <div>
          <div class="focus-name">${esc(guest.name)}</div>
          <div class="focus-phone">${esc(guest.phone)}</div>
        </div>
        <div class="focus-chips">${guest.tags.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
      </div>
      <div class="focus-message-wrap"><div class="focus-message-bubble">${esc(rendered)}</div></div>
      <div class="focus-actions">
        <a href="${esc(link)}" target="_blank" rel="noopener" class="btn-focus-open" data-action="focus-open">Abrir WhatsApp</a>
        <button class="btn-focus-next" data-action="focus-next">Siguiente</button>
        <button class="btn-focus-skip" data-action="focus-skip">Saltar</button>
        <button class="btn-focus-close" data-action="focus-stop">Cerrar</button>
      </div>
      <div class="focus-hint">Abrir marca como enviado &middot; <kbd>N</kbd> siguiente &middot; <kbd>Esc</kbd> cerrar</div>
    </div>
  `;
}

// --- Event delegation ---

document.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "set-view") { setState({ view: actionEl.dataset.view }); return; }

  if (action === "start-queue") {
    const list = queueList();
    if (list.length) setState({ queue: list, focusIdx: 0, focusOn: true });
    return;
  }

  if (action === "select-all") {
    const vis = visibleGuests();
    const picked = Object.assign({}, S.picked);
    vis.forEach((g) => { if (g.hasPhone) picked[g.id] = true; });
    setState({ picked });
    return;
  }

  if (action === "select-none") { setState({ picked: {} }); return; }

  if (action === "toggle-tag") {
    const t = actionEl.dataset.tag;
    const tags = S.tags.includes(t) ? S.tags.filter((x) => x !== t) : S.tags.concat([t]);
    setState({ tags });
    return;
  }

  if (action === "toggle-party") {
    const key = actionEl.dataset.party;
    const collapsed = Object.assign({}, S.collapsed);
    collapsed[key] = !collapsed[key];
    setState({ collapsed });
    return;
  }

  if (action === "select-guest") { setState({ selectedId: Number(actionEl.dataset.id) }); return; }

  if (action === "set-tab") { setState({ tab: actionEl.dataset.tab }); return; }

  if (action === "insert-var") { insertVar(actionEl.dataset.var); return; }

  if (action === "save-template") { saveTemplate(); return; }

  if (action === "open-selected-wa") {
    const g = GUESTS.find((x) => x.id === Number(actionEl.dataset.id));
    if (g && g.hasPhone) markSent(g.id);
    return;
  }

  if (action === "toggle-selected-sent") { toggleSent(Number(actionEl.dataset.id)); return; }

  if (action === "focus-open") {
    const g = S.queue[S.focusIdx];
    if (g) markSent(g.id);
    return;
  }

  if (action === "focus-next" || action === "focus-skip") { focusNext(); return; }

  if (action === "focus-stop") { setState({ focusOn: false }); }
});

document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "pick-guest") {
    const id = Number(el.dataset.id);
    const g = GUESTS.find((x) => x.id === id);
    const on = el.checked;
    const picked = Object.assign({}, S.picked);
    const ids = g && g.party ? GUESTS.filter((x) => x.party === g.party && x.hasPhone).map((x) => x.id) : [id];
    ids.forEach((pid) => { picked[pid] = on; });
    setState({ picked });
    return;
  }

  if (action === "toggle-group-parties") { setState({ groupParties: e.target.checked }); }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "search-input") {
    S.query = e.target.value;
    renderList();
    const label = document.getElementById("result-label");
    if (label) {
      const vis = visibleGuests();
      label.textContent = `${vis.length} ${vis.length === 1 ? "invitado" : "invitados"}`;
    }
    return;
  }

  if (e.target.id === "draft-textarea") {
    S.draft = e.target.value;
    if (S.saveStatus) {
      S.saveStatus = "";
      S.saveStatusError = false;
      const status = document.getElementById("template-status");
      if (status) { status.textContent = ""; status.className = "template-status"; }
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (!S.focusOn) return;
  if (e.key === "Escape") setState({ focusOn: false });
  if (e.key === "n" || e.key === "N") focusNext();
});

// --- Init ---

function init() {
  const data = JSON.parse(document.getElementById("initial-data").textContent);
  WEDDING_URL = data.weddingUrl;
  EVENT_CODE = data.eventCode;
  GUESTS = data.guests;
  ALL_TAGS = computeAllTags(GUESTS);
  S.sentIds = new Set(data.sentIds);
  S.template = data.template;
  S.draft = data.template;
  S.selectedId = GUESTS.length ? GUESTS[0].id : null;
  render();
}

init();
