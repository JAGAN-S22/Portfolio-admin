document.addEventListener("DOMContentLoaded", async () => {
  const section = document.querySelector("#managed-projects-section");
  const container = document.querySelector("#managed-projects");
  if (!section || !container) return;

  function externalLink(url, label, iconClass) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) return null;
      const a = document.createElement("a");
      a.href = parsed.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "btn btn-outline-primary w-100 rounded-pill d-flex align-items-center justify-content-center gap-2";
      if (iconClass) {
        const icon = document.createElement("i");
        icon.className = iconClass;
        a.appendChild(icon);
      }
      a.appendChild(document.createTextNode(label));
      return a;
    } catch { return null; }
  }

  try {
    const response = await fetch("/api/projects", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load projects");
    const projects = await response.json();
    if (!Array.isArray(projects) || projects.length === 0) return;

    projects.forEach(project => {
      const column = document.createElement("div");
      column.className = "col-lg-4 col-md-6";
      const card = document.createElement("article");
      card.className = "card border-0 shadow-sm glass-card p-4 rounded-4 h-100 d-flex flex-column justify-content-between project-card";
      const top = document.createElement("div");
      const iconWrap = document.createElement("div");
      iconWrap.className = "mb-3 text-primary fs-2";
      const icon = document.createElement("i");
      icon.className = "fas fa-code";
      iconWrap.appendChild(icon);
      const title = document.createElement("h3");
      title.className = "h4 fw-bold mb-3";
      title.textContent = project.title;
      const description = document.createElement("p");
      description.className = "text-muted mb-4";
      description.textContent = project.description;
      top.append(iconWrap, title, description);
      card.appendChild(top);

      const bottom = document.createElement("div");
      if (Array.isArray(project.tags) && project.tags.length) {
        const tags = document.createElement("div");
        tags.className = "d-flex flex-wrap gap-2 mb-4";
        project.tags.forEach(text => {
          const tag = document.createElement("span");
          tag.className = "badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded";
          tag.textContent = text;
          tags.appendChild(tag);
        });
        bottom.appendChild(tags);
      }
      const linkRow = document.createElement("div");
      linkRow.className = "d-grid gap-2";
      const git = externalLink(project.githubUrl, "View on GitHub", "fab fa-github");
      const demo = externalLink(project.demoUrl, "Live Demo", "fas fa-arrow-up-right-from-square");
      if (git) linkRow.appendChild(git);
      if (demo) linkRow.appendChild(demo);
      if (linkRow.childElementCount) bottom.appendChild(linkRow);
      card.appendChild(bottom);
      column.appendChild(card);
      container.appendChild(column);
    });

    section.hidden = false;
  } catch (error) {
    console.error("Managed projects were not loaded.", error);
  }
});
