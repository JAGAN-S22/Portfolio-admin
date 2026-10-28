import { supabase, isSupabaseConfigured } from "./supabase-client.js";

const statusBox = document.querySelector("#admin-status");
const form = document.querySelector("#project-form");
const list = document.querySelector("#project-list");
const cancelEdit = document.querySelector("#cancel-edit");
let currentUser = null;
let editingId = null;

function status(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("text-danger", error);
  statusBox.classList.toggle("text-success", !error && Boolean(message));
}
function safeExternalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}
function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector("#published").checked = true;
  document.querySelector("#form-title").textContent = "Add a project";
  document.querySelector("#save-button").textContent = "Save project";
  cancelEdit.hidden = true;
}
function makeLink(label, url) {
  const safe = safeExternalUrl(url);
  if (!safe) return null;
  const a = document.createElement("a");
  a.href = safe; a.target = "_blank"; a.rel = "noopener noreferrer";
  a.className = "btn btn-sm btn-outline-primary rounded-pill me-2";
  a.textContent = label;
  return a;
}
function renderProjects(projects) {
  list.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement("p"); empty.className = "text-muted";
    empty.textContent = "No projects yet. Add your first project using the form."; list.append(empty); return;
  }
  for (const project of projects) {
    const card = document.createElement("article"); card.className = "admin-project-row";
    const top = document.createElement("div"); top.className = "d-flex justify-content-between align-items-start gap-2";
    const title = document.createElement("h3"); title.className = "h5 fw-bold mb-1"; title.textContent = project.title;
    const badge = document.createElement("span"); badge.className = `badge ${project.is_published ? "bg-success" : "bg-secondary"}`; badge.textContent = project.is_published ? "Published" : "Draft";
    const desc = document.createElement("p"); desc.className = "text-muted small mt-2 mb-2"; desc.textContent = project.description;
    const tech = document.createElement("p"); tech.className = "small mb-3"; tech.textContent = (project.technologies || []).join(" · ");
    const buttons = document.createElement("div"); buttons.className = "d-flex flex-wrap align-items-center gap-2";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "btn btn-sm btn-outline-secondary rounded-pill"; edit.textContent = "Edit"; edit.addEventListener("click", () => startEdit(project));
    const del = document.createElement("button"); del.type = "button"; del.className = "btn btn-sm btn-outline-danger rounded-pill"; del.textContent = "Delete"; del.addEventListener("click", () => deleteProject(project));
    top.append(title, badge); buttons.append(edit, del);
    const github = makeLink("GitHub", project.github_url); if (github) buttons.append(github);
    const demo = makeLink("Live demo", project.demo_url); if (demo) buttons.append(demo);
    card.append(top, desc, tech, buttons); list.append(card);
  }
}
function startEdit(project) {
  editingId = project.id;
  document.querySelector("#title").value = project.title || "";
  document.querySelector("#description").value = project.description || "";
  document.querySelector("#technologies").value = (project.technologies || []).join(", ");
  document.querySelector("#github-url").value = project.github_url || "";
  document.querySelector("#demo-url").value = project.demo_url || "";
  document.querySelector("#published").checked = Boolean(project.is_published);
  document.querySelector("#form-title").textContent = "Edit project";
  document.querySelector("#save-button").textContent = "Update project";
  cancelEdit.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function loadProjects() {
  list.replaceChildren(); const loading = document.createElement("p"); loading.className = "text-muted"; loading.textContent = "Loading projects…"; list.append(loading);
  const { data, error } = await supabase.from("portfolio_projects").select("id,owner_id,title,description,technologies,github_url,demo_url,is_published,created_at").order("created_at", { ascending: false });
  if (error) { list.textContent = error.message; return; }
  renderProjects(data || []);
}
async function deleteProject(project) {
  if (!window.confirm(`Delete “${project.title}”? This cannot be undone.`)) return;
  status("Deleting project…");
  const { error } = await supabase.from("portfolio_projects").delete().eq("id", project.id);
  if (error) { status(error.message, true); return; }
  status("Project deleted."); await loadProjects();
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  const title = document.querySelector("#title").value.trim();
  const description = document.querySelector("#description").value.trim();
  const githubRaw = document.querySelector("#github-url").value.trim();
  const demoRaw = document.querySelector("#demo-url").value.trim();
  if ((githubRaw && !safeExternalUrl(githubRaw)) || (demoRaw && !safeExternalUrl(demoRaw))) {
    status("GitHub and demo links must be valid HTTPS URLs.", true); return;
  }
  const payload = {
    title, description,
    technologies: document.querySelector("#technologies").value.split(",").map(x => x.trim()).filter(Boolean).slice(0, 20),
    github_url: githubRaw || null,
    demo_url: demoRaw || null,
    is_published: document.querySelector("#published").checked
  };
  status(editingId ? "Updating project…" : "Saving project…");
  const result = editingId
    ? await supabase.from("portfolio_projects").update(payload).eq("id", editingId).select("id").maybeSingle()
    : await supabase.from("portfolio_projects").insert({ ...payload, owner_id: currentUser.id }).select("id").maybeSingle();
  if (result.error) { status(result.error.message, true); return; }
  if (!result.data) { status("No row changed. Check the RLS policies and confirm MFA is verified.", true); return; }
  status("Saved successfully."); resetForm(); await loadProjects();
});
cancelEdit.addEventListener("click", resetForm);
document.querySelector("#refresh-projects").addEventListener("click", loadProjects);
document.querySelector("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut(); window.location.replace("login.html");
});

async function boot() {
  if (!isSupabaseConfigured) { list.textContent = "Set the Supabase publishable key in assets/js/supabase-client.js first."; return; }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) { window.location.replace("login.html"); return; }
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal.currentLevel !== "aal2") { window.location.replace("login.html"); return; }
  currentUser = userData.user;
  document.querySelector("#admin-email").textContent = currentUser.email || "Admin";
  await loadProjects();
}
boot().catch(error => { status(error.message || "Could not load admin dashboard.", true); });
