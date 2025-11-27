// Simple demo cart using localStorage so it works across pages
const CART_KEY = "compolink_demo_cart";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartCount() {
  const countEl = document.querySelector("[data-cart-count]");
  if (!countEl) return;
  const cart = getCart();
  countEl.textContent = cart.length;
}

function renderCart() {
  const itemsEl = document.querySelector("[data-cart-items]");
  const totalEl = document.querySelector("[data-cart-total]");
  if (!itemsEl || !totalEl) return;

  const cart = getCart();

  if (!cart.length) {
    itemsEl.innerHTML = '<p class="cart-empty">No materials selected yet.</p>';
    totalEl.textContent = "€0.00";
    return;
  }

  itemsEl.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Demo price per kg</div>
      </div>
      <div>
        <div class="cart-item-price">€${item.price.toFixed(2)}</div>
        <button class="cart-remove" data-remove-index="${index}">Remove</button>
      </div>
    `;
    total += item.price;
    itemsEl.appendChild(row);
  });

  totalEl.textContent = `€${total.toFixed(2)}`;
}

// Add item from buttons with data-add-to-cart
function setupAddToCartButtons() {
  const buttons = document.querySelectorAll("[data-add-to-cart]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name || "Unknown material";
      const price = parseFloat(btn.dataset.price || "0") || 0;
      const cart = getCart();
      cart.push({ name, price });
      saveCart(cart);
      updateCartCount();
      renderCart();

      // small feedback
      const originalText = btn.textContent;
      btn.textContent = "Added!";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 800);
    });
  });
}

function setupCartOverlay() {
  const overlay = document.querySelector("[data-cart-overlay]");
  const openBtn = document.querySelector("[data-open-cart]");
  const closeBtn = document.querySelector("[data-close-cart]");

  if (!overlay || !openBtn || !closeBtn) return;

  openBtn.addEventListener("click", () => {
    renderCart();
    overlay.classList.add("visible");
  });

  closeBtn.addEventListener("click", () => {
    overlay.classList.remove("visible");
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("visible");
    }
  });

  // Remove item handler (event delegation)
  overlay.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-index]");
    if (!removeBtn) return;
    const index = parseInt(removeBtn.dataset.removeIndex, 10);
    const cart = getCart();
    if (index >= 0 && index < cart.length) {
      cart.splice(index, 1);
      saveCart(cart);
      updateCartCount();
      renderCart();
    }
  });
}

// Init
updateCartCount();
setupAddToCartButtons();
setupCartOverlay();
