document.addEventListener("DOMContentLoaded", () => {
  // AUTH ELEMENTEN
  const authWrapper = document.getElementById("auth-wrapper");
  const app = document.getElementById("app");
  const loginTab = document.getElementById("login-tab");
  const signupTab = document.getElementById("signup-tab");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const loginError = document.getElementById("login-error");
  const signupError = document.getElementById("signup-error");
  const userTag = document.getElementById("user-tag");
  const logoutBtn = document.getElementById("logout-btn");
  const yearSpan = document.getElementById("year");

  // NAV / PAGINA'S
  const navButtons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");
  const internalPageButtons = document.querySelectorAll("[data-page]");

  // CART
  const cartItemsList = document.getElementById("cart-items");
  const cartEmptyMsg = document.getElementById("cart-empty-msg");
  const cartWeightSpan = document.getElementById("cart-weight");
  const cartTotalSpan = document.getElementById("cart-total");
  const addToCartButtons = document.querySelectorAll(".add-to-cart");
  let cart = [];

  // CHECKOUT SUMMARY
  const materialSummarySpan = document.getElementById("summary-material");
  const shippingSummarySpan = document.getElementById("summary-shipping");
  const totalSummarySpan = document.getElementById("summary-total");
  const shippingForm = document.getElementById("shipping-form");
  const shipWeightInput = document.getElementById("ship-weight");

  // COMMUNITY CHAT
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  // CHART
  let chartCreated = false;

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* ---------- AUTH / ACCOUNT ---------- */

  const STORAGE_KEY_USER = "compolinkUser";

  function saveUser(user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }

  function getUser() {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  function showAuth() {
    authWrapper.classList.remove("hidden");
    app.classList.add("hidden");
  }

  function showApp(name) {
    authWrapper.classList.add("hidden");
    app.classList.remove("hidden");
    if (name && userTag) userTag.textContent = name;
    showPage("overview");
    initChart();
    syncCartToUI();
  }

  // Tabs wisselen
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  });

  signupTab.addEventListener("click", () => {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });

  // Sign-up
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(signupForm);
    const name = data.get("name").toString().trim();
    const email = data.get("email").toString().trim().toLowerCase();
    const password = data.get("password").toString().trim();

    if (!name || !email || !password) {
      signupError.textContent = "Vul alle velden in.";
      return;
    }

    saveUser({ name, email, password });
    signupError.textContent = "";
    signupForm.reset();

    // Direct inloggen
    showApp(name);
  });

  // Login
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    const email = data.get("email").toString().trim().toLowerCase();
    const password = data.get("password").toString().trim();

    const storedUser = getUser();

    // Demo login
    if (password === "1234") {
      loginError.textContent = "";
      const demoName = email || "Demo user";
      showApp(demoName);
      return;
    }

    if (!storedUser || storedUser.email !== email || storedUser.password !== password) {
      loginError.textContent = "Onjuiste combinatie van e-mail en wachtwoord.";
      return;
    }

    loginError.textContent = "";
    showApp(storedUser.name);
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    showAuth();
  });

  /* ---------- PAGINA NAVIGATIE ---------- */

  function showPage(id) {
    pages.forEach((page) => {
      page.classList.toggle("active-page", page.id === id);
    });

    navButtons.forEach((btn) => {
      const target = btn.dataset.page;
      btn.classList.toggle("active", target === id);
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      if (!target) return;
      showPage(target);
      if (target === "analytics") initChart();
    });
  });

  internalPageButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      if (!target) return;
      showPage(target);
      if (target === "analytics") initChart();
    });
  });

  /* ---------- CART LOGICA ---------- */

  function syncCartToUI() {
    if (!cartItemsList || !cartWeightSpan || !cartTotalSpan) return;

    cartItemsList.innerHTML = "";
    let totalWeight = 0;
    let totalPrice = 0;

    cart.forEach((item) => {
      totalWeight += item.totalWeight;
      totalPrice += item.totalPrice;

      const li = document.createElement("li");
      li.textContent = `${item.name} – ${item.totalWeight} kg (€${item.totalPrice.toFixed(2)})`;
      cartItemsList.appendChild(li);
    });

    cartWeightSpan.textContent = totalWeight.toFixed(1);
    cartTotalSpan.textContent = totalPrice.toFixed(2);

    if (materialSummarySpan) {
      materialSummarySpan.textContent = totalPrice.toFixed(2);
      if (shipWeightInput && totalWeight > 0) {
        shipWeightInput.value = totalWeight.toFixed(1);
      }
    }

    if (cartEmptyMsg) {
      cartEmptyMsg.style.display = cart.length === 0 ? "block" : "none";
    }
  }

  addToCartButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      if (!row) return;
      const itemData = row.getAttribute("data-item");
      if (!itemData) return;

      try {
        const item = JSON.parse(itemData);
        const existing = cart.find((c) => c.id === item.id);
        if (existing) {
          existing.totalWeight += item.weight;
          existing.totalPrice += item.price * item.weight;
        } else {
          cart.push({
            id: item.id,
            name: item.name,
            totalWeight: item.weight,
            totalPrice: item.price * item.weight,
          });
        }
        syncCartToUI();
      } catch {
        // ignore parse errors
      }
    });
  });

  /* ---------- CHECKOUT / VERZENDKOSTEN ---------- */

  function calculateShipping(region, weightKg) {
    // Demo-tarieven, geïnspireerd op PostNL-achtige logica
    if (weightKg <= 0) return 0;

    let base = 0;
    let step = 0;
    switch (region) {
      case "NL":
        base = 7; // tot 10 kg
        step = 4; // per extra 10 kg
        break;
      case "EU":
        base = 15;
        step = 7;
        break;
      case "WORLD":
        base = 25;
        step = 10;
        break;
      default:
        base = 7;
        step = 4;
    }

    if (weightKg <= 10) {
      return base;
    }
    const extraBlocks = Math.ceil((weightKg - 10) / 10);
    return base + extraBlocks * step;
  }

  if (shippingForm) {
    shippingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const region = document.getElementById("ship-region").value;
      const weight = parseFloat(document.getElementById("ship-weight").value || "0");
      const materialTotal = parseFloat(materialSummarySpan?.textContent || "0");

      const shippingCost = calculateShipping(region, weight);
      const total = materialTotal + shippingCost;

      if (shippingSummarySpan) shippingSummarySpan.textContent = shippingCost.toFixed(2);
      if (totalSummarySpan) totalSummarySpan.textContent = total.toFixed(2);
    });
  }

  /* ---------- COMMUNITY CHAT ---------- */

  const STORAGE_KEY_CHAT = "compolinkChat";

  function loadChatMessages() {
    const raw = localStorage.getItem(STORAGE_KEY_CHAT);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function saveChatMessages(msgs) {
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(msgs));
  }

  let chatMessages = loadChatMessages();
  if (chatMessages.length === 0) {
    chatMessages = [
      {
        user: "MaterialBuyer123",
        text: "Zoekt iemand T700 prepreg met korte lead time binnen de EU?",
        time: "08:15",
      },
      {
        user: "SupplierCarbonEU",
        text: "Wij hebben nog 1.5 ton T700 op voorraad, leverbaar binnen 5 werkdagen.",
        time: "08:22",
      },
    ];
    saveChatMessages(chatMessages);
  }

  function renderChat() {
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = "";
    chatMessages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "chat-message";
      div.innerHTML = `
        <div class="chat-meta">${msg.user} • ${msg.time}</div>
        <div class="chat-text">${msg.text}</div>
      `;
      chatMessagesEl.appendChild(div);
    });
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  renderChat();

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const userName = userTag ? userTag.textContent || "User" : "User";
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,"0")}:${String(
        now.getMinutes()
      ).padStart(2,"0")}`;

      chatMessages.push({ user: userName, text, time });
      saveChatMessages(chatMessages);
      chatInput.value = "";
      renderChat();
    });
  }

  /* ---------- ANALYTICS CHART ---------- */

  function initChart() {
    if (chartCreated) return;
    const ctx = document.getElementById("stockChart");
    if (!ctx || typeof Chart === "undefined") return;

    chartCreated = true;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Carbon prepreg T700", "Epoxy hars 2K", "Glass fabric 450 g/m²"],
        datasets: [
          {
            label: "Stock (kg)",
            data: [1500, 3200, 7800],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#e5e7eb" },
            grid: { display: false },
          },
          y: {
            ticks: { color: "#e5e7eb" },
            grid: { color: "rgba(148,163,184,0.3)" },
          },
        },
      },
    });
  }
});
