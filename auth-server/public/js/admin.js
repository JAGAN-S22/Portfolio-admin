const statusEl = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");
const projectList = document.querySelector("#projectList");
const projectForm = document.querySelector("#projectForm");
const formMessage = document.querySelector("#formMessage");
const saveButton = document.querySelector("#saveProject");
const cancelEditButton = document.querySelector("#cancelEdit");

async function request(url, options = {}) {
  const config = {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  };
  const response = await fetch(url, config);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.replace("/login.html");
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function safeExternalLink(url, label) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const link = document.createElement("a");
    link.href = parsed.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "btn";
    link.textContent = label;
    return link;
  } catch { return null; }
}

function renderProject(project) {
  const card = document.createElement("article");
  card.className = "project";
  const title = document.createElement("h4");
  title.textContent = project.title;
  const description = document.createElement("p");
  description.textContent = project.description;
  card.append(title, description);

  if (project.tags && project.tags.length) {
    const tags = document.createElement("div");
    tags.className = "tags";
    project.tags.forEach(text => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = text;
      tags.appendChild(tag);
    });
    card.appendChild(tags);
  }

  const links = document.createElement("div");
  links.className = "project-actions";
  const git = safeExternalLink(project.githubUrl, "GitHub ↗");
  const demo = safeExternalLink(project.demoUrl, "Live demo ↗");
  if (git) links.appendChild(git);
  if (demo) links.appendChild(demo);
  if (links.childElementCount) card.appendChild(links);

  const actions = document.createElement("div");
  actions.className = "project-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "btn";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => beginEdit(project));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn danger";
  remove.textContent = "Delete";
  remove.addEventListener("click", async () => {
    if (!window.confirm(`Delete “${project.title}” from your portfolio?`)) return;
    remove.disabled = true;
    try {
      await request(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      showFormMessage("Project deleted. The public portfolio has been updated.");
      await loadData();
    } catch (error) {
      showFormMessage(error.message, true);
      remove.disabled = false;
    }
  });
  actions.append(edit, remove);
  card.appendChild(actions);
  return card;
}

function showFormMessage(text, isError = false) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", isError);
}

function beginEdit(project) {
  document.querySelector("#projectId").value = project.id;
  document.querySelector("#title").value = project.title;
  document.querySelector("#description").value = project.description;
  document.querySelector("#tags").value = (project.tags || []).join(", ");
  document.querySelector("#githubUrl").value = project.githubUrl || "";
  document.querySelector("#demoUrl").value = project.demoUrl || "";
  document.querySelector("#formHeading").textContent = "Edit project";
  saveButton.textContent = "Save changes";
  cancelEditButton.hidden = false;
  showFormMessage(`Editing: ${project.title}`);
  document.querySelector("#title").focus();
}

function resetForm() {
  projectForm.reset();
  document.querySelector("#projectId").value = "";
  document.querySelector("#formHeading").textContent = "Add a project";
  saveButton.textContent = "Publish project";
  cancelEditButton.hidden = true;
}

async function loadData() {
  const [summary, projects] = await Promise.all([
    request("/api/admin/summary"),
    request("/api/admin/projects")
  ]);
  document.querySelector("#featuredCount").textContent = summary.featuredProjects;
  document.querySelector("#managedCount").textContent = summary.customProjects;
  document.querySelector("#mfaStatus").textContent = summary.mfaEnabled ? "Enabled" : "Not enabled";
  projectList.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No extra projects yet. Use the form to publish your first project.";
    projectList.appendChild(empty);
  } else {
    projects.forEach(project => projectList.appendChild(renderProject(project)));
  }
}

projectForm.addEventListener("submit", async event => {
  event.preventDefault();
  saveButton.disabled = true;
  showFormMessage("Saving project…");
  const id = document.querySelector("#projectId").value;
  const payload = {
    title: document.querySelector("#title").value.trim(),
    description: document.querySelector("#description").value.trim(),
    tags: document.querySelector("#tags").value.split(",").map(tag => tag.trim()).filter(Boolean),
    githubUrl: document.querySelector("#githubUrl").value.trim(),
    demoUrl: document.querySelector("#demoUrl").value.trim()
  };
  try {
    await request(id ? `/api/admin/projects/${id}` : "/api/admin/projects", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    resetForm();
    showFormMessage(id ? "Project updated successfully." : "Project published successfully. It now appears on your public portfolio.");
    await loadData();
  } catch (error) {
    showFormMessage(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  showFormMessage("Edit cancelled.");
});

document.querySelector("#logout").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await request("/api/logout", { method: "POST", body: "{}" });
    window.location.replace("/login.html");
  } catch (error) {
    statusEl.textContent = error.message;
    button.disabled = false;
  }
});

async function init() {
  try {
    const user = await request("/api/me");
    statusEl.textContent = `Signed in as ${user.email} · Password and MFA verified`;
    dashboard.hidden = false;
    await loadData();
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

init();
