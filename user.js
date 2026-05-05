const api = {
  token: localStorage.getItem("token") || "",
};

const loginSectionEl = document.getElementById("loginSection");
const catalogSectionEl = document.getElementById("catalogSection");
const loginFormEl = document.getElementById("loginForm");
const registerFormEl = document.getElementById("registerForm");
const loginMessageEl = document.getElementById("loginMessage");
const sessionLabelEl = document.getElementById("sessionLabel");
const logoutBtnEl = document.getElementById("logoutBtn");
const showLoginBtnEl = document.getElementById("showLoginBtn");
const hideLoginBtnEl = document.getElementById("hideLoginBtn");
const adminLinkEl = document.getElementById("adminLink");
const searchEl = document.getElementById("search");
const tagFilterEl = document.getElementById("tagFilter");
const resultsInfoEl = document.getElementById("resultsInfo");
const catalogEl = document.getElementById("catalog");

let currentUser = null;
let allProducts = [];

function headers() {
  const h = { "Content-Type": "application/json" };
  if (api.token) h.Authorization = `Bearer ${api.token}`;
  return h;
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  } catch {
    throw new Error("network_error");
  }
  let payload = {};
  try {
    payload = await response.json();
  } catch {}
  if (!response.ok) {
    const err = new Error(payload.error || "request_error");
    throw err;
  }
  return payload;
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function updateView() {
  const loggedIn = !!currentUser;
  if (loggedIn) {
    loginSectionEl.classList.add("hidden");
  }
  catalogSectionEl.classList.remove("hidden");
  logoutBtnEl.classList.toggle("hidden", !loggedIn);
  showLoginBtnEl.classList.toggle("hidden", loggedIn);
  adminLinkEl.classList.toggle("hidden", !loggedIn || currentUser.role !== "admin");
  sessionLabelEl.textContent = loggedIn ? `${currentUser.username} (${currentUser.role})` : "No logueado";
}

function renderTags(products) {
  const tags = new Set();
  products.forEach((p) => p.tags.forEach((t) => tags.add(t)));
  const previous = tagFilterEl.value;
  tagFilterEl.innerHTML = '<option value="">Todos los atributos</option>';
  [...tags].sort().forEach((tag) => {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    tagFilterEl.appendChild(opt);
  });
  tagFilterEl.value = previous;
}

function renderProducts() {
  const text = searchEl.value.trim().toLowerCase();
  const tag = tagFilterEl.value;
  const filtered = allProducts.filter((p) => {
    const okText = !text || p.name.toLowerCase().includes(text) || p.description.toLowerCase().includes(text);
    const okTag = !tag || p.tags.includes(tag);
    return okText && okTag;
  });

  resultsInfoEl.textContent = `${filtered.length} producto(s)`;
  catalogEl.innerHTML = "";
  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" loading="lazy" />
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="price">${money(p.price)}</p>
        <p class="desc">${p.description}</p>
        <p class="tagline">${p.tags.map((t) => `#${t}`).join(" ")}</p>
      </div>
    `;
    catalogEl.appendChild(card);
  });
}

async function loadProducts() {
  const data = await request("/api/products");
  allProducts = data.products;
  renderTags(allProducts);
  renderProducts();
}

async function refreshSession() {
  if (!api.token) {
    currentUser = null;
    updateView();
    return;
  }
  try {
    const data = await request("/api/me");
    currentUser = data.user;
  } catch {
    localStorage.removeItem("token");
    api.token = "";
    currentUser = null;
  }
  updateView();
}

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessageEl.textContent = "";
  try {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const data = await request("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    api.token = data.token;
    localStorage.setItem("token", data.token);
    currentUser = data.user;
    loginFormEl.reset();
    updateView();
    loadProducts();
  } catch (error) {
    if (error.message === "invalid_credentials") {
      loginMessageEl.textContent = "Credenciales invalidas.";
      return;
    }
    if (error.message === "network_error") {
      loginMessageEl.textContent = "Servidor no iniciado o URL incorrecta.";
      return;
    }
    loginMessageEl.textContent = "No se pudo iniciar sesion.";
  }
});

registerFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessageEl.textContent = "";
  try {
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    await request("/api/register", { method: "POST", body: JSON.stringify({ username, password }) });
    loginMessageEl.textContent = "Usuario creado. Ahora podes iniciar sesion.";
    registerFormEl.reset();
  } catch (error) {
    if (error.message === "username_exists") {
      loginMessageEl.textContent = "Ese usuario ya existe.";
      return;
    }
    if (error.message === "invalid_input") {
      loginMessageEl.textContent = "Usuario y contrasena deben tener al menos 4 caracteres.";
      return;
    }
    loginMessageEl.textContent = "No se pudo registrar. Verifica que el servidor este iniciado.";
  }
});

logoutBtnEl.addEventListener("click", async () => {
  try {
    await request("/api/logout", { method: "POST" });
  } catch {}
  localStorage.removeItem("token");
  api.token = "";
  currentUser = null;
  updateView();
});

showLoginBtnEl.addEventListener("click", () => {
  loginSectionEl.classList.remove("hidden");
});

hideLoginBtnEl.addEventListener("click", () => {
  loginSectionEl.classList.add("hidden");
});

searchEl.addEventListener("input", renderProducts);
tagFilterEl.addEventListener("change", renderProducts);

(async function init() {
  await refreshSession();
  await loadProducts();
})();
