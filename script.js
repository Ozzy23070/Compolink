document.addEventListener("DOMContentLoaded", () => {
  // ==== FIREBASE INSTELLINGEN ====
  // We gaan ervan uit dat firebase al is geïnitialiseerd in index.html
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;
  let chatUnsubscribe = null;

  // ==== DOM REFERENTIES ====
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

  const navButtons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");
  const internalPageButtons = document.querySelectorAll("[data-page]");

  // Cart
  const cartItemsList = document.getElementById("cart-items");
  const cartEmptyMsg = document.getElementById("cart-empty-msg");
  const cartWeightSpan = document.getElementById("cart-weight");
  const cartTotalSpan = document.getElementById("cart-total");
  const addToCartButtons = document.querySelectorAll(".add-to-cart");
  let cart = [];

  // Checkout
  const materialSummarySpan = document.getElementById("summary-material");
  const shippingSummarySpan = document.getElementById("summary-shipping");
  const totalSummarySpan = document.getElementById("summary-total");
  const shippingForm = document.getElementById("shipping-form");
  const shipWeightInput = document.getElementById("ship-weight");

  // Community chat
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  // Chart
  let chartCreated = false;

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // ==== HELPER FUNCTIES ====

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
    subscribeToChat();
  }

  function parseFirebaseError(err) {
    if (!err || !err.code) return "Er ging iets mis. Probeer het opnieuw.";
    switch (err.code) {
      case "auth/email-already-in-use":
        return "Er bestaat al een account met dit e-mailadres.";
      case "auth/invalid-email":
        return "Dit is geen geldig e-mailadres.";
      case "auth/weak-password":
        return "Kies een sterker wachtwoord (minimaal 6 tekens).";
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Onjuiste combinatie van e-mail en wachtwoord.";
      default:
        return "Er ging iets mis (" + err.code + ").";
    }
  }

  // ==== FIREBASE AUTH: STATE CHANGE ====

  auth.onAuthStateChanged((user) => {
    currentUser = user || null;

    if (user) {
      const name = user.displayName || user.email || "User";
      showApp(name);
    } else {
      // Uitgelogd
      if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
      }
      showAuth();
    }
  });

  // ==== TAB WISSELEN (LOGIN / SIGNUP) ====

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

  // ==== SIGNUP (ACCOUNT AANMAKEN) ====

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(signupForm);
    const name = data.get("name").toString().trim();
    const email = data.get("email").toString().trim().toLowerCase();
    const password = data.get("password").toString().trim();

    if (!name || !email || !password) {
      signupError.textContent = "Vul alle velden in.";
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      if (cred.user && name) {
        await cred.user.updateProfile({ displayName: name });
      }
      signupError.textContent = "";
      signupForm.reset();
      // auth.onAuthStateChanged toont automatisch de app
    } catch (err) {
      signupError.textContent = parseFirebaseError(err);
    }
  });

  // ==== LOGIN ====

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    const email = data.get("email").toString().trim().toLowerCase();
    const password = data.get("password").toString().trim();

    try {
      if (password === "1234") {
        // Demo login als anonieme gebruiker
        await auth.signInAnonymously();
        loginError.textContent = "";
        loginForm.reset();
        return;
      }

      await auth.signInWithEmailAndPassword(email, password);
      loginError.textContent = "";
      loginForm.reset();
    } catch (err) {
      loginError.textContent = parseFirebaseError(err);
    }
  });

  // ==== LOGOUT ====

  logoutBtn.addEventListener("click", () => {
    auth.signOut();
  });

  // ==== PAGINA NAVIGATIE ====

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

  // ==== CART LOGICA ====

  function syncCartToUI() {
    if (!cartItemsList || !cartWeightSpan || !cartTotalSpan) return;

    cartItemsList.innerHTML = "";
    let totalWeight = 0;
    let totalPrice = 0;

    cart.forEach((item) => {
      totalWeight += item.totalWeight;
      totalPrice += item.totalPrice;

      const li = document.createElement("li");
      li.textContent = `${item.name} – ${item.totalWeight} kg (€${item.totalPrice.toFixed(
        2
      )})`;
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

  // ==== CHECKOUT / VERZENDKOSTEN ====

  function calculateShipping(region, weightKg) {
    if (weightKg <= 0) return 0;

    let base = 0;
    let step = 0;
    switch (region) {
      case "NL":
        base = 7;
        step = 4;
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
      const weight = parseFloat(
        document.getElementById("ship-weight").value || "0"
      );
      const materialTotal = parseFloat(
        materialSummarySpan?.textContent || "0"
      );

      const shippingCost = calculateShipping(region, weight);
      const total = materialTotal + shippingCost;

      if (shippingSummarySpan)
        shippingSummarySpan.textContent = shippingCost.toFixed(2);
      if (totalSummarySpan)
        totalSummarySpan.textContent = total.toFixed(2);
    });
  }

  // ==== COMMUNITY CHAT MET FIRESTORE ====

  function renderChatFromSnapshot(docs) {
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = "";
    docs.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "chat-message";
      const user = data.user || "User";
      const time = data.time || "";
      const text = data.text || "";
      div.innerHTML = `
        <div class="chat-meta">${user} • ${time}</div>
        <div class="chat-text">${text}</div>
      `;
      chatMessagesEl.appendChild(div);
    });
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function subscribeToChat() {
    if (!db || !chatMessagesEl) return;

    if (chatUnsubscribe) {
      chatUnsubscribe();
    }

    chatUnsubscribe = db
      .collection("messages")
      .orderBy("createdAt")
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          renderChatFromSnapshot(snapshot.docs);
        },
        (err) => {
          console.error("Chat subscribe error", err);
        }
      );
  }

  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const name = currentUser
        ? currentUser.displayName || currentUser.email || "User"
        : "Anon";
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      try {
        await db.collection("messages").add({
          text,
          user: name,
          time,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        chatInput.value = "";
      } catch (err) {
        console.error("Chat send error", err);
      }
    });
  }

  // ==== ANALYTICS CHART ====

  function initChart() {
    if (chartCreated) return;
    const ctx = document.getElementById("stockChart");
    if (!ctx || typeof Chart === "undefined") return;

    chartCreated = true;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: [
          "Carbon prepreg T700",
          "Epoxy hars 2K",
          "Glass fabric 450 g/m²",
        ],
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
