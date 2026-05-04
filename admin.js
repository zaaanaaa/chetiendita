const token = localStorage.getItem("token") || "";
if (!token) window.location.href = "./index.html";

const authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const tagFormEl = document.getElementById("tagForm");
const tagNameEl = document.getElementById("tagName");
const tagListEl = document.getElementById("tagList");
const productFormEl = document.getElementById("productForm");
const productIdEl = document.getElementById("productId");
const productNameEl = document.getElementById("productName");
const productPriceEl = document.getElementById("productPrice");
const productImageEl = document.getElementById("productImage");
const productDescriptionEl = document.getElementById("productDescription");
const productFeaturedEl = document.getElementById("productFeatured");
const tagsCheckboxesEl = document.getElementById("tagsCheckboxes");
const cancelEditBtnEl = document.getElementById("cancelEditBtn");
const adminListEl = document.getElementById("adminList");
const logoutBtnEl = document.getElementById("logoutBtn");

let tags = [];
let products = [];

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } });
  if (!response.ok) throw new Error("request_error");
  return response.json();
}

function renderTagsList() {
  tagListEl.innerHTML = "";
  tags.forEach((tag) => {
    const row = document.createElement("div");
    row.className = "admin-item";
    row.innerHTML = `<strong>${tag.name}</strong>`;
    tagListEl.appendChild(row);
  });
}

function renderTagCheckboxes(selected = []) {
  tagsCheckboxesEl.innerHTML = "";
  tags.forEach((tag) => {
    const checked = selected.includes(tag.name) ? "checked" : "";
    const label = document.createElement("label");
    label.className = "check-row";
    label.innerHTML = `<input type="checkbox" value="${tag.name}" ${checked} /> ${tag.name}`;
    tagsCheckboxesEl.appendChild(label);
  });
}

function renderProducts() {
  adminListEl.innerHTML = "";
  products.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-item";
    row.innerHTML = `
      <div>
        <strong>${p.name}</strong>
        <small>$${p.price} - ${p.tags.join(", ")}</small>
      </div>
      <div class="row-actions">
        <button type="button" class="edit-btn" data-id="${p.id}">Editar</button>
        <button type="button" class="delete-btn" data-id="${p.id}">Eliminar</button>
      </div>
    `;
    row.querySelector(".edit-btn").addEventListener("click", () => editProduct(p.id));
    row.querySelector(".delete-btn").addEventListener("click", () => removeProduct(p.id));
    adminListEl.appendChild(row);
  });
}

function selectedTags() {
  return [...tagsCheckboxesEl.querySelectorAll("input[type='checkbox']:checked")].map((el) => el.value);
}

function clearForm() {
  productFormEl.reset();
  productIdEl.value = "";
  renderTagCheckboxes();
}

function editProduct(id) {
  const p = products.find((item) => item.id === id);
  if (!p) return;
  productIdEl.value = String(p.id);
  productNameEl.value = p.name;
  productPriceEl.value = String(p.price);
  productImageEl.value = p.image;
  productDescriptionEl.value = p.description;
  productFeaturedEl.checked = !!p.featured;
  renderTagCheckboxes(p.tags);
}

async function removeProduct(id) {
  if (!window.confirm("Eliminar producto?")) return;
  await request(`/api/products/${id}`, { method: "DELETE" });
  await loadAll();
}

async function loadAll() {
  const me = await request("/api/me");
  if (me.user.role !== "admin") {
    window.location.href = "./index.html";
    return;
  }
  const tagsData = await request("/api/tags");
  const productsData = await request("/api/products");
  tags = tagsData.tags;
  products = productsData.products;
  renderTagsList();
  renderTagCheckboxes();
  renderProducts();
}

tagFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = tagNameEl.value.trim();
  if (!name) return;
  await request("/api/tags", { method: "POST", body: JSON.stringify({ name }) });
  tagFormEl.reset();
  await loadAll();
});

productFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: productNameEl.value.trim(),
    price: Number(productPriceEl.value),
    image: productImageEl.value.trim(),
    description: productDescriptionEl.value.trim(),
    featured: productFeaturedEl.checked,
    tags: selectedTags(),
  };
  const id = productIdEl.value.trim();
  if (id) {
    await request(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await request("/api/products", { method: "POST", body: JSON.stringify(payload) });
  }
  clearForm();
  await loadAll();
});

cancelEditBtnEl.addEventListener("click", clearForm);
logoutBtnEl.addEventListener("click", async () => {
  try { await request("/api/logout", { method: "POST" }); } catch {}
  localStorage.removeItem("token");
  window.location.href = "./index.html";
});

loadAll();
