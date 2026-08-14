const rows = () => Array.from(document.querySelectorAll(".guest-row"));

function activeTags() {
  return Array.from(document.querySelectorAll(".tag-checkbox:checked")).map((cb) => cb.value);
}

function applyFilters() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const tags = activeTags();
  const hideSent = document.getElementById("hide-sent").checked;

  rows().forEach((row) => {
    const name = row.dataset.name;
    const rowTags = row.dataset.tags.split(",");
    const matchesQuery = !query || name.includes(query);
    const matchesTags = tags.length === 0 || tags.some((tag) => rowTags.includes(tag));
    const isSent = row.classList.contains("sent");

    const visible = matchesQuery && matchesTags && !(hideSent && isSent);
    row.classList.toggle("hidden", !visible);
  });
}

function visibleRows() {
  return rows().filter((row) => !row.classList.contains("hidden"));
}

async function markSent(row) {
  const id = row.dataset.id;
  await fetch(`/api/mark-sent/${id}`, { method: "POST" });
  row.classList.add("sent");
  const mark = row.querySelector(".sent-mark");
  if (mark) mark.textContent = "✅";
  updateProgressCount();
}

function updateProgressCount() {
  const sentCount = rows().filter((row) => row.classList.contains("sent")).length;
  document.getElementById("progress-count").textContent = sentCount;
}

function setupFilters() {
  document.getElementById("search").addEventListener("input", applyFilters);
  document.getElementById("hide-sent").addEventListener("change", applyFilters);
  document.querySelectorAll(".tag-checkbox").forEach((cb) => cb.addEventListener("change", applyFilters));
}

function setupSelection() {
  document.getElementById("select-all").addEventListener("click", () => {
    visibleRows().forEach((row) => (row.querySelector(".row-select").checked = true));
  });
  document.getElementById("select-none").addEventListener("click", () => {
    rows().forEach((row) => (row.querySelector(".row-select").checked = false));
  });
}

function setupSendButtons() {
  document.querySelectorAll(".send-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".guest-row");
      markSent(row);
    });
  });
}

function selectedOrVisibleRows() {
  const selected = rows().filter((row) => row.querySelector(".row-select").checked);
  return selected.length > 0 ? selected : visibleRows();
}

function setupQueue() {
  const panel = document.getElementById("queue-panel");
  const nameEl = document.getElementById("queue-name");
  const positionEl = document.getElementById("queue-position");
  const linkEl = document.getElementById("queue-link");
  const nextBtn = document.getElementById("queue-next");
  const stopBtn = document.getElementById("queue-stop");

  let queue = [];
  let index = 0;

  function showCurrent() {
    if (index >= queue.length) {
      panel.classList.add("hidden");
      return;
    }
    const row = queue[index];
    nameEl.textContent = row.dataset.name;
    positionEl.textContent = `${index + 1} / ${queue.length}`;
    linkEl.href = row.dataset.link;
    panel.classList.remove("hidden");
  }

  document.getElementById("start-queue").addEventListener("click", () => {
    queue = selectedOrVisibleRows().filter((row) => !row.classList.contains("sent"));
    index = 0;
    if (queue.length === 0) {
      alert("No hay invitados pendientes en la selección actual.");
      return;
    }
    showCurrent();
  });

  linkEl.addEventListener("click", () => {
    if (index < queue.length) markSent(queue[index]);
  });

  nextBtn.addEventListener("click", () => {
    index += 1;
    showCurrent();
  });

  stopBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });
}

function setupGrouping() {
  const tbody = document.getElementById("guest-rows");
  const originalOrder = Array.from(tbody.children);
  const toggle = document.getElementById("group-mode");
  let groupModeOn = false;

  function partyKeyFor(row) {
    const size = parseInt(row.dataset.partySize || "0", 10);
    return size > 1 ? row.dataset.partyKey : `solo-${row.dataset.id}`;
  }

  function applyGrouping() {
    if (!groupModeOn) {
      tbody.replaceChildren(...originalOrder);
      originalOrder.forEach((row) => row.classList.remove("party-grouped"));
      return;
    }

    const order = [];
    const seen = new Set();
    originalOrder.forEach((row) => {
      const key = partyKeyFor(row);
      if (seen.has(key)) return;
      seen.add(key);
      const groupRows = originalOrder.filter((r) => partyKeyFor(r) === key);
      order.push(...groupRows);
    });
    tbody.replaceChildren(...order);
    order.forEach((row) => {
      row.classList.toggle("party-grouped", parseInt(row.dataset.partySize || "0", 10) > 1);
    });
  }

  toggle.addEventListener("change", () => {
    groupModeOn = toggle.checked;
    applyGrouping();
  });

  tbody.addEventListener("change", (e) => {
    if (!e.target.classList.contains("row-select") || !groupModeOn) return;
    const row = e.target.closest(".guest-row");
    if (parseInt(row.dataset.partySize || "0", 10) <= 1) return;

    const key = row.dataset.partyKey;
    const checked = e.target.checked;
    rows().forEach((r) => {
      if (r !== row && r.dataset.partyKey === key && parseInt(r.dataset.partySize || "0", 10) > 1) {
        r.querySelector(".row-select").checked = checked;
      }
    });
  });
}

function setupTemplateEditor() {
  const textarea = document.getElementById("message-template");
  const saveBtn = document.getElementById("save-template");
  const status = document.getElementById("template-status");

  saveBtn.addEventListener("click", async () => {
    status.textContent = "Guardando…";
    status.className = "template-status";

    const response = await fetch("/api/message-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: textarea.value }),
    });
    const data = await response.json();

    if (!response.ok) {
      status.textContent = data.error || "No se pudo guardar el mensaje.";
      status.className = "template-status error";
      return;
    }

    status.textContent = "Guardado. Actualizando enlaces…";
    status.className = "template-status ok";
    window.location.reload();
  });
}

setupFilters();
setupSelection();
setupSendButtons();
setupQueue();
setupGrouping();
setupTemplateEditor();
