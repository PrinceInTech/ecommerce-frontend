// ===== CONFIG =====
const API_URL = 'https://ecommerce-backend-45d6.onrender.com/api';

let currentUser = null;
let cart = [];
let allProducts = [];
let editingProductId = null;

// ===== INIT =====
window.onload = () => {
  const saved = localStorage.getItem('shopflow_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    updateNavForUser();
  }
  const savedCart = localStorage.getItem('shopflow_cart');
  if (savedCart) cart = JSON.parse(savedCart);
  updateCartCount();
  loadProducts();
  loadCategories();
};

// ===== PAGE NAVIGATION =====
function showPage(page) {
  const pages = ['home', 'login', 'cart', 'checkout', 'orders', 'admin', 'success'];
  pages.forEach(p => {
    const el = document.getElementById(p + 'Page');
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(page + 'Page');
  if (target) target.style.display = 'block';

  if (page === 'cart') renderCart();
  if (page === 'orders') loadMyOrders();
  if (page === 'admin') { loadAdminProducts(); }
  if (page === 'checkout') renderCheckoutSummary();
  window.scrollTo(0, 0);
}

// ===== AUTH TABS =====
function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerFormDiv').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
}

// ===== REGISTER =====
async function register() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) return showMsg('authMsg', 'Please fill all fields', 'error');
  if (password.length < 6) return showMsg('authMsg', 'Password must be at least 6 characters', 'error');

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) return showMsg('authMsg', data.message, 'error');
    currentUser = data;
    localStorage.setItem('shopflow_user', JSON.stringify(data));
    updateNavForUser();
    showPage('home');
  } catch { showMsg('authMsg', 'Cannot connect to server', 'error'); }
}

// ===== LOGIN =====
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return showMsg('authMsg', 'Please fill all fields', 'error');

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return showMsg('authMsg', data.message, 'error');
    currentUser = data;
    localStorage.setItem('shopflow_user', JSON.stringify(data));
    updateNavForUser();
    showPage('home');
  } catch { showMsg('authMsg', 'Cannot connect to server', 'error'); }
}

// ===== LOGOUT =====
function logout() {
  currentUser = null;
  localStorage.removeItem('shopflow_user');
  document.getElementById('navAuth').style.display = 'block';
  document.getElementById('navUser').style.display = 'none';
  document.getElementById('navOrders').style.display = 'none';
  document.getElementById('navAdmin').style.display = 'none';
  showPage('home');
}

function updateNavForUser() {
  if (!currentUser) return;
  document.getElementById('navAuth').style.display = 'none';
  document.getElementById('navUser').style.display = 'flex';
  document.getElementById('navUsername').textContent = currentUser.name;
  document.getElementById('navOrders').style.display = 'block';
  if (currentUser.role === 'admin') document.getElementById('navAdmin').style.display = 'block';
}

// ===== PRODUCTS =====
async function loadProducts() {
  const search = document.getElementById('searchInput')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const sort = document.getElementById('sortFilter')?.value || '';

  let url = `${API_URL}/products?`;
  if (search) url += `search=${search}&`;
  if (category) url += `category=${category}&`;
  if (sort) url += `sort=${sort}`;

  try {
    const res = await fetch(url);
    const products = await res.json();
    allProducts = products;
    renderProducts(products);
  } catch {
    document.getElementById('productsGrid').innerHTML = '<div class="loading">Failed to load products. Check API URL.</div>';
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_URL}/products/meta/categories`);
    const cats = await res.json();
    const sel = document.getElementById('categoryFilter');
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  } catch {}
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products.length) { grid.innerHTML = '<div class="empty">No products found.</div>'; return; }

  grid.innerHTML = products.map(p => `
    <div class="product-card">
      ${p.image
        ? `<div class="product-img"><img src="${p.image}" alt="${escHtml(p.name)}" onerror="this.parentElement.innerHTML='🛍️'"/></div>`
        : `<div class="product-img-placeholder">🛍️</div>`}
      <div class="product-body">
        <div class="product-category">${escHtml(p.category)}</div>
        <div class="product-name">${escHtml(p.name)}</div>
        <div class="product-desc">${escHtml(p.description)}</div>
        <div class="product-footer">
          <div>
            <div class="product-price">₹${p.price.toLocaleString()}</div>
            <div class="product-stock ${p.stock === 0 ? 'out' : p.stock < 5 ? 'low' : ''}">
              ${p.stock === 0 ? 'Out of stock' : p.stock < 5 ? `Only ${p.stock} left` : `In stock: ${p.stock}`}
            </div>
          </div>
          <button class="btn-cart" onclick="addToCart('${p._id}')" ${p.stock === 0 ? 'disabled' : ''}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== CART =====
function addToCart(productId) {
  const product = allProducts.find(p => p._id === productId);
  if (!product) return;

  const existing = cart.find(i => i._id === productId);
  if (existing) {
    if (existing.quantity >= product.stock) return alert('Max stock reached!');
    existing.quantity++;
  } else {
    cart.push({ _id: product._id, name: product.name, price: product.price, image: product.image, quantity: 1, stock: product.stock });
  }
  saveCart();
  updateCartCount();
  showToast('Added to cart!');
}

function removeFromCart(id) {
  cart = cart.filter(i => i._id !== id);
  saveCart();
  updateCartCount();
  renderCart();
}

function updateQty(id, delta) {
  const item = cart.find(i => i._id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(id);
  else { saveCart(); renderCart(); updateCartCount(); }
}

function saveCart() { localStorage.setItem('shopflow_cart', JSON.stringify(cart)); }

function updateCartCount() {
  const total = cart.reduce((sum, i) => sum + i.quantity, 0);
  document.getElementById('cartCount').textContent = total;
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const summary = document.getElementById('cartSummary');

  if (!cart.length) {
    container.innerHTML = '<div class="empty-cart"><p>🛒 Your cart is empty</p><button class="btn-primary" onclick="showPage(\'home\')">Shop Now</button></div>';
    summary.innerHTML = '';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image ? `<img src="${item.image}" alt="${escHtml(item.name)}" onerror="this.parentElement.innerHTML='🛍️'"/>` : '🛍️'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty('${item._id}', -1)">−</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQty('${item._id}', 1)">+</button>
          <button class="cart-item-remove" onclick="removeFromCart('${item._id}')">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = total > 999 ? 0 : 99;

  summary.innerHTML = `
    <div class="cart-summary-card">
      <div class="summary-title">Order Summary</div>
      <div class="summary-row"><span>Subtotal (${cart.reduce((s,i) => s + i.quantity, 0)} items)</span><span>₹${total.toLocaleString()}</span></div>
      <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? 'FREE' : '₹' + shipping}</span></div>
      <div class="summary-total"><span>Total</span><span>₹${(total + shipping).toLocaleString()}</span></div>
      <br/>
      <button class="btn-primary" style="width:100%" onclick="goCheckout()">Proceed to Checkout</button>
      <p style="text-align:center;font-size:0.75rem;color:var(--text-faint);margin-top:10px;font-family:var(--mono)">Free shipping on orders above ₹999</p>
    </div>
  `;
}

function goCheckout() {
  if (!currentUser) { showPage('login'); return; }
  if (!cart.length) return;
  showPage('checkout');
}

function renderCheckoutSummary() {
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = total > 999 ? 0 : 99;
  document.getElementById('checkoutSummary').innerHTML = `
    <div class="cart-summary-card">
      <div class="summary-title">Order Summary</div>
      ${cart.map(i => `<div class="summary-row"><span>${escHtml(i.name)} × ${i.quantity}</span><span>₹${(i.price * i.quantity).toLocaleString()}</span></div>`).join('')}
      <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? 'FREE' : '₹' + shipping}</span></div>
      <div class="summary-total"><span>Total</span><span>₹${(total + shipping).toLocaleString()}</span></div>
    </div>
  `;
}

// ===== PLACE ORDER =====
async function placeOrder() {
  const fullName = document.getElementById('shipName').value.trim();
  const address = document.getElementById('shipAddress').value.trim();
  const city = document.getElementById('shipCity').value.trim();
  const pincode = document.getElementById('shipPincode').value.trim();
  const phone = document.getElementById('shipPhone').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;

  if (!fullName || !address || !city || !pincode || !phone) {
    return showMsg('checkoutMsg', 'Please fill all shipping details', 'error');
  }

  const items = cart.map(i => ({ product: i._id, name: i.name, price: i.price, quantity: i.quantity, image: i.image || '' }));
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = total > 999 ? 0 : 99;

  try {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ items, shippingAddress: { fullName, address, city, pincode, phone }, paymentMethod, totalAmount: total + shipping })
    });
    const data = await res.json();
    if (!res.ok) return showMsg('checkoutMsg', data.message, 'error');

    cart = [];
    saveCart();
    updateCartCount();
    showPage('success');
  } catch { showMsg('checkoutMsg', 'Server error. Try again.', 'error'); }
}

// ===== MY ORDERS =====
async function loadMyOrders() {
  if (!currentUser) { showPage('login'); return; }
  const container = document.getElementById('ordersList');
  container.innerHTML = '<div class="loading">Loading orders...</div>';
  try {
    const res = await fetch(`${API_URL}/orders/myorders`, {
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });
    const orders = await res.json();
    if (!orders.length) { container.innerHTML = '<div class="empty">No orders yet.</div>'; return; }
    container.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">Order #${o._id.slice(-8).toUpperCase()}</div>
            <div class="order-date">${new Date(o.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
          </div>
          <span class="order-status status-${o.status}">${o.status}</span>
        </div>
        <div class="order-items">${o.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}</div>
        <div class="order-total">₹${o.totalAmount.toLocaleString()} · ${o.paymentMethod}</div>
      </div>
    `).join('');
  } catch { container.innerHTML = '<div class="empty">Failed to load orders.</div>'; }
}

// ===== ADMIN PRODUCTS =====
async function loadAdminProducts() {
  const container = document.getElementById('adminProductList');
  container.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    allProducts = products;
    if (!products.length) { container.innerHTML = '<div class="empty">No products yet. Add your first product!</div>'; return; }
    container.innerHTML = products.map(p => `
      <div class="admin-product-row">
        <div class="admin-product-img">
          ${p.image ? `<img src="${p.image}" alt="${escHtml(p.name)}" onerror="this.innerHTML='🛍️'"/>` : '🛍️'}
        </div>
        <div class="admin-product-info">
          <div class="admin-product-name">${escHtml(p.name)}</div>
          <div class="admin-product-meta">${p.category} · Stock: ${p.stock}</div>
        </div>
        <span class="admin-product-price">₹${p.price.toLocaleString()}</span>
        <div class="admin-actions">
          <button class="btn-edit" onclick="editProduct('${p._id}')">Edit</button>
          <button class="btn-del" onclick="deleteProduct('${p._id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch { container.innerHTML = '<div class="empty">Failed to load.</div>'; }
}

async function loadAdminOrders() {
  const container = document.getElementById('adminOrderList');
  container.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const res = await fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });
    const orders = await res.json();
    if (!orders.length) { container.innerHTML = '<div class="empty">No orders yet.</div>'; return; }
    container.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="admin-product-name">${o.user?.name || 'Unknown'} — <span class="order-id">#${o._id.slice(-8).toUpperCase()}</span></div>
            <div class="order-date">${new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
          </div>
          <select class="status-select" onchange="updateOrderStatus('${o._id}', this.value)">
            ${['pending','processing','shipped','delivered','cancelled'].map(s =>
              `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
        <div class="order-items">${o.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}</div>
        <div class="order-total">₹${o.totalAmount.toLocaleString()} · ${o.paymentMethod}</div>
      </div>
    `).join('');
  } catch { container.innerHTML = '<div class="empty">Failed to load.</div>'; }
}

function switchAdminTab(tab) {
  document.getElementById('adminProducts').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('adminOrders').style.display = tab === 'orders' ? 'block' : 'none';
  document.querySelectorAll('.admin-tab').forEach((t, i) => t.classList.toggle('active', (i === 0 && tab === 'products') || (i === 1 && tab === 'orders')));
  if (tab === 'orders') loadAdminOrders();
}

async function updateOrderStatus(id, status) {
  try {
    await fetch(`${API_URL}/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ status })
    });
  } catch { alert('Error updating order'); }
}

// ===== PRODUCT MODAL =====
function openProductModal(product = null) {
  editingProductId = product ? product._id : null;
  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('pName').value = product?.name || '';
  document.getElementById('pDesc').value = product?.description || '';
  document.getElementById('pPrice').value = product?.price || '';
  document.getElementById('pStock').value = product?.stock || '';
  document.getElementById('pCategory').value = product?.category || '';
  document.getElementById('pImage').value = product?.image || '';
  document.getElementById('productModalMsg').className = 'msg';
  document.getElementById('productModal').style.display = 'flex';
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
  editingProductId = null;
}

function closeProductModalOutside(e) {
  if (e.target === document.getElementById('productModal')) closeProductModal();
}

function editProduct(id) {
  const product = allProducts.find(p => p._id === id);
  if (product) openProductModal(product);
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });
    if (!res.ok) { const d = await res.json(); alert(d.message); return; }
    loadAdminProducts();
    loadProducts();
  } catch { alert('Error deleting product'); }
}

async function saveProduct() {
  const name = document.getElementById('pName').value.trim();
  const description = document.getElementById('pDesc').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const stock = parseInt(document.getElementById('pStock').value);
  const category = document.getElementById('pCategory').value.trim();
  const image = document.getElementById('pImage').value.trim();

  if (!name || !description || !price || !category) return showMsg('productModalMsg', 'Please fill all required fields', 'error');

  const payload = { name, description, price, stock: stock || 0, category, image };
  const url = editingProductId ? `${API_URL}/products/${editingProductId}` : `${API_URL}/products`;
  const method = editingProductId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return showMsg('productModalMsg', data.message, 'error');
    closeProductModal();
    loadAdminProducts();
    loadProducts();
    loadCategories();
  } catch { showMsg('productModalMsg', 'Server error', 'error'); }
}

// ===== HELPERS =====
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#7CFFB2;color:#06120A;padding:12px 20px;border-radius:10px;font-weight:700;z-index:999;font-family:Space Grotesk,sans-serif;font-size:0.9rem;animation:fadeIn .3s ease';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeProductModal();
});
