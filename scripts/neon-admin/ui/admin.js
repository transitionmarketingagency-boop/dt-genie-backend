const $ = (selector) => document.querySelector(selector);
let csrfToken = "";
let setupMode = false;
const reviewedDocuments = new Set();
let previewingDocument = null;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (csrfToken && !["GET", "HEAD"].includes(options.method || "GET")) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function setMessage(node, message, isError = false) { node.textContent = message || ""; node.classList.toggle("error", isError); }
function showAuth(isSetup) {
  setupMode = isSetup; $("#authPanel").hidden = false; $("#dashboard").hidden = true;
  $("#authTitle").textContent = isSetup ? "Set your admin password." : "Your knowledge, under your control.";
  $("#authCopy").textContent = isSetup ? "Create a unique password with at least 14 characters. It stays on this PC as a salted hash." : "This dashboard runs only on this computer. Your documents stay in your Windows user folder.";
  $("#passwordLabel").textContent = isSetup ? "Create admin password" : "Admin password";
  $("#passwordInput").autocomplete = isSetup ? "new-password" : "current-password";
  $("#passwordInput").placeholder = isSetup ? "Use 14 or more unique characters" : "Enter your password";
  $("#authSubmit").textContent = isSetup ? "Create password and open dashboard" : "Sign in";
  $("#authMessage").textContent = "";
}
function showDashboard() { $("#authPanel").hidden = true; $("#dashboard").hidden = false; refreshAll().catch(error => alert(error.message)); }
function metric(label, value, sub) {
  const card = document.createElement("div"); card.className = "metric";
  const name = document.createElement("span"); name.className = "metric-label"; name.textContent = label;
  const count = document.createElement("span"); count.className = "metric-value"; count.textContent = String(value);
  const detail = document.createElement("span"); detail.className = "metric-sub"; detail.textContent = sub;
  card.append(name, count, detail); return card;
}
async function loadOverview() {
  const data = await request("/api/overview"); const metrics = $("#metrics");
  metrics.replaceChildren(
    metric("Public baseline", data.publicBaselineChunks, "currently deployed source set"),
    metric("Active public additions", data.activePublicChunks, `${data.activePublicDocuments} approved documents`),
    metric("Internal library", data.activeInternalChunks, `${data.internalDocuments} local documents`),
    metric("Needs review", data.draftDocuments, "draft documents not active"),
  );
  $("#dataDirectory").textContent = data.dataDirectory;
}
function makePill(label, kind) { const el = document.createElement("span"); el.className = `pill ${kind || ""}`; el.textContent = label; return el; }
async function loadDocuments() {
  const data = await request("/api/documents"); const body = $("#documentsBody"); body.replaceChildren();
  $("#documentsEmpty").hidden = data.documents.length > 0;
  for (const doc of data.documents) {
    const tr = document.createElement("tr"); const name = document.createElement("td"); name.textContent = doc.fileName;
    const sub = document.createElement("span"); sub.className = "subtext"; sub.textContent = doc.preview || "Imported internal corpus chunk set"; name.append(sub);
    const audience = document.createElement("td"); audience.append(makePill(doc.audience === "public" ? "Public" : "Internal", doc.audience));
    const chunks = document.createElement("td"); chunks.textContent = String(doc.chunkCount);
    const state = document.createElement("td"); state.append(makePill(doc.status, doc.status));
    const added = document.createElement("td"); added.textContent = new Date(doc.createdAt).toLocaleDateString();
    const controls = document.createElement("td"); const row = document.createElement("div"); row.className = "controls";
    const review = document.createElement("button"); review.className = "button button-quiet mini"; review.textContent = "Review";
    review.addEventListener("click", () => openDocumentReview(doc)); row.append(review);
    if (doc.status === "draft" || doc.status === "paused") {
      const activate = document.createElement("button"); activate.className = "button button-secondary mini"; activate.textContent = "Activate";
      activate.addEventListener("click", () => updateStatus(doc, "active")); row.append(activate);
    }
    if (doc.status === "active") {
      const pause = document.createElement("button"); pause.className = "button button-quiet mini"; pause.textContent = "Pause";
      pause.addEventListener("click", () => updateStatus(doc, "paused")); row.append(pause);
    }
    if (doc.status !== "archived") {
      const archive = document.createElement("button"); archive.className = "button button-quiet mini"; archive.textContent = "Archive";
      archive.addEventListener("click", () => updateStatus(doc, "archived")); row.append(archive);
    }
    const remove = document.createElement("button"); remove.className = "button button-quiet mini"; remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteDocument(doc)); row.append(remove); controls.append(row);
    tr.append(name, audience, chunks, state, added, controls); body.append(tr);
  }
}
async function updateStatus(doc, status) {
  if (status === "active" && doc.audience === "public" && !reviewedDocuments.has(doc.id)) { await openDocumentReview(doc); return; }
  let approvalPhrase = "";
  if (status === "active") approvalPhrase = window.prompt(doc.audience === "public" ? "Review this document and confirm public approval by typing APPROVE PUBLIC:" : "Confirm internal-only activation by typing ACTIVATE INTERNAL:") || "";
  if (status === "active" && !approvalPhrase) return;
  try { await request(`/api/documents/${encodeURIComponent(doc.id)}/status`, { method: "PATCH", body: JSON.stringify({ status, approvalPhrase }) }); await refreshAll(); }
  catch (error) { alert(error.message); }
}
async function openDocumentReview(doc) {
  try {
    const full = await request(`/api/documents/${encodeURIComponent(doc.id)}`);
    previewingDocument = full;
    $("#previewTitle").textContent = full.fileName;
    $("#previewMeta").textContent = `${full.audience.toUpperCase()} · ${full.status} · ${full.chunkCount} chunks · SHA-256 ${full.contentHash}`;
    $("#previewText").textContent = full.extractedText || "No extracted text saved.";
    $("#reviewConfirm").checked = false;
    $("#markReviewed").disabled = true;
    $("#previewDialog").showModal();
  } catch (error) { alert(error.message); }
}
async function deleteDocument(doc) {
  if (!window.confirm(`Permanently delete “${doc.fileName}” from the local knowledge dashboard?`)) return;
  try { await request(`/api/documents/${encodeURIComponent(doc.id)}`, { method: "DELETE" }); await refreshAll(); } catch (error) { alert(error.message); }
}
async function loadAudit() {
  const data = await request("/api/audit"); const list = $("#auditList"); list.replaceChildren();
  if (!data.events.length) { const li = document.createElement("li"); li.textContent = "No changes recorded yet."; list.append(li); return; }
  for (const event of data.events) { const li = document.createElement("li"); const time = document.createElement("time"); time.textContent = new Date(event.at).toLocaleString(); const detail = document.createElement("span"); detail.textContent = event.action.replaceAll("_", " "); li.append(time, detail); list.append(li); }
}
async function refreshAll() { await Promise.all([loadOverview(), loadDocuments(), loadAudit()]); }
async function boot() {
  try {
    const statusResponse = await fetch("/api/setup-status", { credentials: "same-origin", cache: "no-store" }); const status = await statusResponse.json();
    const sessionResponse = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
    if (sessionResponse.ok) { const session = await sessionResponse.json(); csrfToken = session.csrf; showDashboard(); return; }
    showAuth(!status.configured);
  } catch { showAuth(false); setMessage($("#authMessage"), "Start the local dashboard with npm run neon:admin, then refresh this page.", true); }
}

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault(); const button = $("#authSubmit"); button.disabled = true;
  try { const data = await request(setupMode ? "/api/setup" : "/api/login", { method: "POST", body: JSON.stringify({ password: $("#passwordInput").value }) }); csrfToken = data.csrf; $("#passwordInput").value = ""; showDashboard(); }
  catch (error) { setMessage($("#authMessage"), error.message, true); } finally { button.disabled = false; }
});
$("#documentFile").addEventListener("change", event => { $("#fileLabel").textContent = event.target.files[0]?.name || "Choose a document"; });
$("#uploadForm").addEventListener("submit", async event => {
  event.preventDefault(); const file = $("#documentFile").files[0]; if (!file) return;
  const button = event.currentTarget.querySelector("button"); button.disabled = true; setMessage($("#uploadMessage"), "Extracting, redacting, and embedding…");
  const form = new FormData(); form.append("document", file); form.append("audience", $("#audienceSelect").value);
  try { const result = await request("/api/upload", { method: "POST", body: form }); setMessage($("#uploadMessage"), `Saved as a draft: ${result.document.chunkCount} chunks from ${result.document.fileName}.`); event.currentTarget.reset(); $("#fileLabel").textContent = "Choose a document"; await refreshAll(); }
  catch (error) { setMessage($("#uploadMessage"), error.message, true); } finally { button.disabled = false; }
});
$("#corpusFile").addEventListener("change", event => { $("#corpusLabel").textContent = event.target.files[0]?.name || "Choose internal corpus JSON"; });
$("#corpusForm").addEventListener("submit", async event => {
  event.preventDefault(); const file = $("#corpusFile").files[0]; if (!file) return;
  if (!window.confirm("Import this file as internal-only knowledge? It will not be published to the public chatbot.")) return;
  const button = event.currentTarget.querySelector("button"); button.disabled = true; setMessage($("#corpusMessage"), "Validating internal-only labels and embeddings…");
  const form = new FormData(); form.append("corpus", file);
  try { const result = await request("/api/import-internal-corpus", { method: "POST", body: form }); setMessage($("#corpusMessage"), `Imported ${result.chunkCount} internal chunks across ${result.documentCount} sources.`); event.currentTarget.reset(); $("#corpusLabel").textContent = "Choose internal corpus JSON"; await refreshAll(); }
  catch (error) { setMessage($("#corpusMessage"), error.message, true); } finally { button.disabled = false; }
});
$("#searchForm").addEventListener("submit", async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector("button"); button.disabled = true;
  const box = $("#searchResults"); box.replaceChildren(); const loading = document.createElement("p"); loading.className = "loading"; loading.textContent = "Searching internal knowledge locally…"; box.append(loading);
  try {
    const data = await request("/api/internal/search", { method: "POST", body: JSON.stringify({ question: $("#questionInput").value }) }); box.replaceChildren();
    if (!data.results.length) { const p = document.createElement("p"); p.className = "loading"; p.textContent = "No internal matches. Search was local; no question or excerpt was sent to a model."; box.append(p); }
    for (const result of data.results) { const card = document.createElement("article"); card.className = "result-card"; const head = document.createElement("div"); head.className = "result-head"; const source = document.createElement("span"); source.textContent = result.source; const score = document.createElement("span"); score.textContent = `match ${Math.round(result.score * 100)}%`; const text = document.createElement("p"); text.textContent = result.text; head.append(source, score); card.append(head, text); box.append(card); }
  } catch (error) { box.replaceChildren(); const p = document.createElement("p"); p.className = "message error"; p.textContent = error.message; box.append(p); } finally { button.disabled = false; }
});
$("#prepareButton").addEventListener("click", async () => {
  const approvalPhrase = window.prompt("This creates a public-only candidate file; it will not deploy. Type PREPARE PUBLIC CANDIDATE to confirm:"); if (!approvalPhrase) return;
  $("#prepareButton").disabled = true; setMessage($("#prepareMessage"), "Checking and preparing public candidate…");
  try { const result = await request("/api/prepare-public-candidate", { method: "POST", body: JSON.stringify({ approvalPhrase }) }); setMessage($("#prepareMessage"), `${result.outputFile}: ${result.chunks} chunks total, ${result.additions} approved additions, zero internal chunks. Candidate only; test before deploying.`); }
  catch (error) { setMessage($("#prepareMessage"), error.message, true); } finally { $("#prepareButton").disabled = false; }
});
$("#refreshButton").addEventListener("click", () => refreshAll().catch(error => alert(error.message)));
$("#changePasswordButton").addEventListener("click", async () => {
  const oldPassword = window.prompt("Enter your current admin password:"); if (!oldPassword) return;
  const newPassword = window.prompt("Enter a new unique password (at least 14 characters):"); if (!newPassword) return;
  const repeatPassword = window.prompt("Enter the new password again:"); if (newPassword !== repeatPassword) { alert("The new passwords did not match."); return; }
  try { const data = await request("/api/change-password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) }); csrfToken = data.csrf; alert("Admin password changed."); }
  catch (error) { alert(error.message); }
});
$("#reviewConfirm").addEventListener("change", event => { $("#markReviewed").disabled = !event.target.checked; });
$("#markReviewed").addEventListener("click", () => {
  if (previewingDocument && $("#reviewConfirm").checked) reviewedDocuments.add(previewingDocument.id);
  $("#previewDialog").close();
});
$("#closePreview").addEventListener("click", () => $("#previewDialog").close());
$("#logoutButton").addEventListener("click", async () => { try { await request("/api/logout", { method: "POST", body: "{}" }); } finally { csrfToken = ""; showAuth(false); } });
boot();
