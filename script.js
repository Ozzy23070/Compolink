// script.js
document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();
  const db = firebase.firestore();

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

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // ===== Tabs login / signup =====
  function switchTab(target) {
    if (target === "login") {
      loginTab.classList.add("active");
      signupTab.classList.remove("active");
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    } else {
      signupTab.classList.add("active");
      loginTab.classList.remove("active");
      signupForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    }
    if (loginError) loginError.textContent = "";
    if (signupError) signupError.textContent = "";
  }

  loginTab.addEventListener("click", () => switchTab("login"));
  signupTab.addEventListener("click", () => switchTab("signup"));

  // ===== Helper voor nette foutmeldingen =====
  function mapAuthError(code) {
    switch (code) {
      case "auth/user-not-found":
        return "Geen account gevonden met dit e-mailadres.";
      case "auth/wrong-password":
        return "Onjuist wachtwoord.";
      case "auth/invalid-email":
        return "Ongeldig e-mailadres.";
      case "auth/email-already-in-use":
        return "Er bestaat al een account met dit e-mailadres.";
      case "auth/weak-password":
        return "Wachtwoord is te zwak (minimaal 6 tekens).";
      default:
        return null;
    }
  }

  // ===== Inloggen =====
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (loginError) loginError.textContent = "";

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    auth
      .signInWithEmailAndPassword(email, password)
      .catch((err) => {
        console.error(err);
        if (loginError) loginError.textContent = mapAuthError(err.code) || err.message;
      });
  });

  // ===== Account aanmaken =====
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (signupError) signupError.textContent = "";

    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const roleInput = document.querySelector('input[name="signup-role"]:checked');
    const role = roleInput ? roleInput.value : null;

    if (!name || !email || !password || !role) {
      if (signupError) signupError.textContent = "Vul alle velden in en kies een accounttype.";
      return;
    }

    auth
      .createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        return Promise.all([
          cred.user.updateProfile({ displayName: name }),
          db.collection("users").doc(cred.user.uid).set({
            name,
            email,
            role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          }),
        ]);
      })
      .then(() => {
        signupForm.reset();
        switchTab("login");
        alert("Account aangemaakt! Je kunt nu inloggen.");
      })
      .catch((err) => {
        console.error(err);
        if (signupError) signupError.textContent = mapAuthError(err.code) || err.message;
      });
  });

  // ===== Auth state =====
  auth.onAuthStateChanged((user) => {
    if (user) {
      authWrapper.classList.add("hidden");
      app.classList.remove("hidden");
      if (userTag) userTag.textContent = user.displayName || user.email || "Ingelogde gebruiker";
    } else {
      app.classList.add("hidden");
      authWrapper.classList.remove("hidden");
    }
  });

  // ===== Logout =====
  logoutBtn.addEventListener("click", () => {
    auth.signOut().catch((err) => console.error(err));
  });

  // ===== Page navigation =====
  const navButtons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");

  function showPage(pageId) {
    pages.forEach((p) => p.classList.remove("active-page"));
    const page = document.getElementById(pageId);
    if (page) page.classList.add("active-page");

    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === pageId);
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  // Buttons binnen hero-card met data-page
  document.querySelectorAll("[data-page]").forEach((btn) => {
    if (!btn.classList.contains("nav-btn")) {
      btn.addEventListener("click", () => showPage(btn.dataset.page));
    }
  });

  // ===== Chart (analytics) =====
  const chartCanvas = document.getElementById("stockChart");
  if (chartCanvas && window.Chart) {
    new Chart(chartCanvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Carbon prepreg", "Epoxy hars", "Glass fabric"],
        datasets: [
          {
            data: [1500, 3200, 7800],
            backgroundColor: ["#3b82f6", "#22c55e", "#f97316"],
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
              font: { size: 12 },
            },
          },
        },
      },
    });
  }

  // ===== Cart =====
  const cartItemsEl = document.getElementById("cart-items");
  const cartEmptyMsg = document.getElementById("cart-empty-msg");
  const cartWeightEl = document.getElementById("cart-weight");
  const cartTotalEl = document.getElementById("cart-total");
  const summaryMaterialEl = document.getElementById("summary-material");
  const shipWeightInput = document.getElementById("ship-weight");

  const cart = [];

  function updateCartUI() {
    if (!cartItemsEl) return;

    cartItemsEl.innerHTML = "";
    if (cart.length === 0) {
      if (cartEmptyMsg) cartEmptyMsg.classList.remove("hidden");
      if (cartWeightEl) cartWeightEl.textContent = "0";
      if (cartTotalEl) cartTotalEl.textContent = "0.00";
      if (summaryMaterialEl) summaryMaterialEl.textContent = "0.00";
      if (shipWeightInput) shipWeightInput.value = "";
      return;
    }

    if (cartEmptyMsg) cartEmptyMsg.classList.add("hidden");

    let totalWeight = 0;
    let totalPrice = 0;

    cart.forEach((item) => {
      totalWeight += item.weight;
      totalPrice += item.price * (item.weight / item.baseWeight);

      const li = document.createElement("li");
      li.textContent = `${item.name} – ${item.weight} kg`;
      cartItemsEl.appendChild(li);
    });

    if (cartWeightEl) cartWeightEl.textContent = totalWeight.toFixed(1);
    if (cartTotalEl) cartTotalEl.textContent = totalPrice.toFixed(2);
    if (summaryMaterialEl) summaryMaterialEl.textContent = totalPrice.toFixed(2);
    if (shipWeightInput) shipWeightInput.value = totalWeight.toFixed(1);
  }

  document.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      if (!row) return;
      const data = row.getAttribute("data-item");
      if (!data) return;

      const parsed = JSON.parse(data);
      cart.push({
        id: parsed.id,
        name: parsed.name,
        price: parsed.price,
        weight: parsed.weight,
        baseWeight: parsed.weight,
      });
      updateCartUI();
    });
  });

  // ===== Community chat (localStorage) =====
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const CHAT_KEY = "compolink_demo_chat";

  function appendChatMessage(message) {
    if (!chatMessagesEl) return;
    const div = document.createElement("div");
    div.className = "chat-message";
    const time = new Date(message.time).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    div.innerHTML = `<span>[${time}]</span>${message.text}`;
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function loadChat() {
    if (!chatMessagesEl) return;
    const stored = localStorage.getItem(CHAT_KEY);
    const msgs = stored ? JSON.parse(stored) : [];
    chatMessagesEl.innerHTML = "";
    msgs.forEach((m) => appendChatMessage(m));
  }

  if (chatForm && chatInput) {
    loadChat();
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const stored = localStorage.getItem(CHAT_KEY);
      const msgs = stored ? JSON.parse(stored) : [];
      const message = { text, time: Date.now() };
      msgs.push(message);
      localStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
      appendChatMessage(message);
      chatInput.value = "";
    });
  }

  // ===== Shipping cost =====
  const shippingForm = document.getElementById("shipping-form");
  const summaryShippingEl = document.getElementById("summary-shipping");
  const summaryTotalEl = document.getElementById("summary-total");

  function calcShipping(region, weight) {
    weight = Number(weight) || 0;
    if (weight <= 0) return 0;

    let base, step, perStep;
    if (region === "NL") {
      base = 7;
      step = 10;
      perStep = 4;
    } else if (region === "EU") {
      base = 14;
      step = 10;
      perStep = 7;
    } else {
      base = 24;
      step = 10;
      perStep = 9;
    }

    if (weight <= step) return base;
    const extraSteps = Math.ceil((weight - step) / step);
    return base + extraSteps * perStep;
  }

  if (shippingForm) {
    shippingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const region = document.getElementById("ship-region").value;
      const weight = document.getElementById("ship-weight").value;
      const material = Number((summaryMaterialEl?.textContent || "0").replace(",", ".")) || 0;

      const shipping = calcShipping(region, weight);
      if (summaryShippingEl) summaryShippingEl.textContent = shipping.toFixed(2);
      if (summaryTotalEl) summaryTotalEl.textContent = (material + shipping).toFixed(2);
    });
  }

  // Init cart UI
  updateCartUI();
});
