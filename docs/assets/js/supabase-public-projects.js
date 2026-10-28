import { supabase, isSupabaseConfigured } from "./supabase-client.js";

const section = document.querySelector("#managed-projects");
const grid = document.querySelector("#managed-projects-grid");
const message = document.querySelector("#managed-projects-message");

function safeExternalUrl(value) {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}
function addLink(parent, label, value, icon) {
  const url = safeExternalUrl(value); if (!url) return;
  const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  a.className = "btn btn-outline-primary w-100 rounded-pill d-flex align-items-center justify-content-center gap-2";
  const i = document.createElement("i"); i.className = icon; a.append(i, document.createTextNode(label)); parent.append(a);
}
function render(projects) {
  if (!projects.length) { section.hidden = true; return; }
  section.hidden = false; grid.replaceChildren();
  for (const p of projects) {
    const col = document.createElement("div"); col.className = "col-lg-4 animate-on-scroll visible";
    const card = document.createElement("article"); card.className = "card border-0 shadow-sm glass-card p-4 rounded-4 h-100 d-flex flex-column justify-content-between project-card";
    const body = document.createElement("div");
    const icon = document.createElement("div"); icon.className = "mb-3 text-primary fs-2"; icon.innerHTML = '<i class="fa-solid fa-laptop-code" aria-hidden="true"></i>';
    const title = document.createElement("h3"); title.className = "h4 fw-bold mb-3"; title.textContent = p.title;
    const desc = document.createElement("p"); desc.className = "text-muted mb-4"; desc.textContent = p.description;
    const tags = document.createElement("div"); tags.className = "d-flex flex-wrap gap-2 mb-4";
    for (const value of (p.technologies || []).slice(0, 12)) { const badge = document.createElement("span"); badge.className = "badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded"; badge.textContent = value; tags.append(badge); }
    const links = document.createElement("div"); links.className = "d-grid gap-2";
    addLink(links, "View on GitHub", p.github_url, "fa-brands fa-github");
    addLink(links, "Live Demo", p.demo_url, "fa-solid fa-arrow-up-right-from-square");
    body.append(icon, title, desc, tags); card.append(body, links); col.append(card); grid.append(col);
  }
}
async function load() {
  if (!isSupabaseConfigured) { section.hidden = true; return; }
  const { data, error } = await supabase.from("portfolio_projects").select("id,title,description,technologies,github_url,demo_url,created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(18);
  if (error) { section.hidden = true; message.textContent = "Additional projects are temporarily unavailable."; return; }
  render(data || []);
}
load();
