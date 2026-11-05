const API = "/api";
const $ = (selector) => document.querySelector(selector);

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.className = "form-message show" + (isError ? " error" : "");
}

function saveSession(data) {
  localStorage.setItem("sfcToken", data.token);
  localStorage.setItem("sfcUser", JSON.stringify(data.user));
}

function logout() {
  localStorage.removeItem("sfcToken");
  localStorage.removeItem("sfcUser");
  window.location.href = "login.html";
}

async function apiRequest(url, options = {}) {
  const token = localStorage.getItem("sfcToken");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function setupMenu() {
  const toggle = $(".menu-toggle");
  const links = $(".nav-links");
  if (toggle && links) toggle.addEventListener("click", () => links.classList.toggle("open"));
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(a => {
    if (a.getAttribute("href") === current) a.classList.add("active");
  });
}

async function loadPlans() {
  const target = $("#plans-container");
  if (!target) return;
  try {
    const plans = await apiRequest(`${API}/plans`);
    target.innerHTML = plans.map((p, i) => `
      <article class="card plan-card ${i === 1 ? "featured" : ""}">
        ${i === 1 ? '<span class="badge">POPULAR</span>' : ""}
        <div class="card-body">
          <div class="card-icon">🏋️</div>
          <h3>${p.plan_name}</h3>
          <p>${p.description || "Membership access to our fitness facilities."}</p>
          <div class="price">₹${Number(p.price).toLocaleString("en-IN")} <small>/ ${p.duration_days} days</small></div>
          <ul class="feature-list"><li>Modern gym equipment</li><li>Fitness assessment</li><li>Member support</li></ul>
          <a class="btn ${i === 1 ? "" : "btn-outline"}" href="register.html">Choose plan</a>
        </div>
      </article>`).join("");
    const select = $("#plan_id");
    if (select) select.innerHTML = '<option value="">Select a membership plan</option>' +
      plans.map(p => `<option value="${p.plan_id}">${p.plan_name} - ₹${p.price} (${p.duration_days} days)</option>`).join("");
  } catch (err) {
    target.innerHTML = `<p class="empty">${err.message}. Please check the server and database.</p>`;
  }
}

function setupRegister() {
  const form = $("#register-form");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const message = $("#register-message");
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await apiRequest(`${API}/register`, { method: "POST", body: JSON.stringify(body) });
      saveSession(data);
      showMessage(message, data.message);
      setTimeout(() => location.href = "dashboard.html", 700);
    } catch (err) { showMessage(message, err.message, true); }
  });
}

function setupLogin() {
  const form = $("#login-form");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const message = $("#login-message");
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await apiRequest(`${API}/login`, { method: "POST", body: JSON.stringify(body) });
      saveSession(data);
      showMessage(message, data.message);
      setTimeout(() => location.href = "dashboard.html", 700);
    } catch (err) { showMessage(message, err.message, true); }
  });
}

async function loadDashboard() {
  const target = $("#dashboard-content");
  if (!target) return;
  if (!localStorage.getItem("sfcToken")) { location.href = "login.html"; return; }
  try {
    const data = await apiRequest(`${API}/me`);
    const m = data.member, e = data.enrollment;
    target.innerHTML = `
      <div class="dashboard-grid">
        <div class="info-box"><span>Member name</span><strong>${m.name}</strong></div>
        <div class="info-box"><span>Membership status</span><strong>${m.status}</strong></div>
        <div class="info-box"><span>Current plan</span><strong>${e ? e.plan_name : "No plan"}</strong></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Member ID</th><th>Email</th><th>Phone</th><th>Join date</th><th>Plan expiry</th></tr></thead>
      <tbody><tr><td>${m.member_id}</td><td>${m.email}</td><td>${m.phone}</td><td>${String(m.join_date).slice(0,10)}</td><td>${e ? String(e.expiry_date).slice(0,10) : "-"}</td></tr></tbody></table></div>`;
  } catch (err) {
    target.innerHTML = `<p class="empty">${err.message}</p>`;
    if (err.message.toLowerCase().includes("login")) setTimeout(logout, 1200);
  }
}

async function loadAdmin() {
  const keyInput = $("#admin-key");
  const loginButton = $("#admin-login");
  const area = $("#admin-area");
  if (!keyInput || !loginButton || !area) return;
  loginButton.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    try {
      const headers = { "x-admin-key": key };
      const summary = await apiRequest(`${API}/admin/summary`, { headers });
      const members = await apiRequest(`${API}/admin/members`, { headers });
      area.innerHTML = `
        <div class="dashboard-grid">
          <div class="info-box"><span>Total members</span><strong>${summary.members}</strong></div>
          <div class="info-box"><span>Active members</span><strong>${summary.active}</strong></div>
          <div class="info-box"><span>Recorded revenue</span><strong>₹${Number(summary.revenue).toLocaleString("en-IN")}</strong></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${members.map(m => `<tr><td>${m.member_id}</td><td>${m.name}</td><td>${m.email}</td><td>${m.phone}</td><td>${m.plan_name || "-"}</td><td>${m.status}</td>
        <td><button class="btn btn-outline" data-status="${m.member_id}" data-next="${m.status === "Active" ? "Inactive" : "Active"}">${m.status === "Active" ? "Deactivate" : "Activate"}</button>
        <button class="btn" data-delete="${m.member_id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
      area.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", async () => {
        await apiRequest(`${API}/admin/members/${btn.dataset.status}/status`, { method: "PATCH", headers, body: JSON.stringify({ status: btn.dataset.next }) });
        loginButton.click();
      }));
      area.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
        if (confirm("Delete this member?")) {
          await apiRequest(`${API}/admin/members/${btn.dataset.delete}`, { method: "DELETE", headers });
          loginButton.click();
        }
      }));
    } catch (err) { area.innerHTML = `<p class="form-message show error">${err.message}</p>`; }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupMenu();
  loadPlans();
  setupRegister();
  setupLogin();
  loadDashboard();
  loadAdmin();
  document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", logout));
});
