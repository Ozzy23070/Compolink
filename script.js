// ======================================
// Firebase services (init gebeurt in index.html)
// ======================================
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

document.addEventListener("DOMContentLoaded", () => {
  // ====================================
  // DOM
  // ====================================
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
  const cartItemsEl = document.getElementById("cart-items");
  const cartEmptyMsgEl = document.getElementById("cart-empty-msg");
  const cartWeightEl = document.getElementById("cart-weight");
  const cartTotalEl = document.getElementById("cart-total");
  const addToCartButtons = document.querySelectorAll(".add-to-cart");

  // Checkout
  const shippingForm = document.getElementById("shipping-form");
  const shipRegionInput = document.getElementById("ship-region");
  const shipWeightInput = document.getElementById("ship-weight");
  const summaryMaterialEl = document.getElementById("summary-material");
  const summaryShippingEl = document.getElementById("summary-shipping");
  const summaryTotalEl = document.getElementById("summary-total");

  // Community
  const groupListEl = document.getElementById("group-list");
  const currentGroupNameEl = document.getElementById("current-group-name");
  const postFeed = document.getElementById("post-feed");
  const postForm = document.getElementById("post-form");
  const postText = document.getElementById("post-text");
  const postFile = document.getElementById("post-file");

  // Analytics
  const stockChartCanvas = document.getElementById("stockChart");

  // Joint purchase
  const jpListEl = document.getElementById("jp-list");
  const jpCreateForm = document.getElementById("jp-create-form");
  const jpJoinForm = document.getElementById("jp-join-form");
  const jpSelectedEl = document.getElementById("jp-selected");
  const jpCreateMsg = document.getElementById("jp-create-msg");
  const jpJoinMsg = document.getElementById("jp-join-msg");

  const jpTitleInput = document.getElementById("jp-title");
  const jpMaterialInput = document.getElementById("jp-material");
  const jpTargetKgInput = document.getElementById("jp-target-kg");
  const jpBasePriceInput = document.getElementById("jp-base-price");
  const jpAmountInput = document.getElementById("jp-amount");

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // ====================================
  // STATE
  // ====================================
  let currentUser = null;
  let currentUserRole = "buyer";

  const cart = [];
  let stockChartInstance = null;

  let postsUnsubscribe = null;

  const GROUPS = [
    { id: "market-updates", label: "Market updates" },
    { id: "certificates-rfq", label: "Certificates & RFQ's" }
  ];
  let activeGroupId = GROUPS[0].id;

  // Joint purchase state (demo persisted via localStorage)
  const JP_STORAGE_KEY = "compolink_joint_purchases_v1";
  let jpCampaigns = [];
  let jpSelectedId = null;

  // ====================================
  // HELPERS
  // ====================================
  const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

  function showAuth() {
    if (!authWrapper || !app) return;
    authWrapper.classList.remove("hidden");
    app.classList.add("hidden");
  }

  function showApp() {
    if (!authWrapper || !app) return;
    authWrapper.classList.add("hidden");
    app.classList.remove("hidden");
  }

  function updateUserTag() {
    if (!userTag) return;
    if (!currentUser) {
      userTag.textContent = "";
      return;
    }
    const baseName = currentUser.displayName || currentUser.email || "User";
    const roleLabel = currentUserRole ? currentUserRole.toUpperCase() : "USER";
    userTag.textContent = `${roleLabel} ${baseName}`;
  }

  function parseFirebaseError(err) {
    if (!err || !err.code) return "Er ging iets mis. Probeer het opnieuw.";
    switch (err.code) {
      case "auth/email-already-in-use": return "Er bestaat al een account met dit e-mailadres.";
      case "auth/invalid-email": return "Dit is geen geldig e-mailadres.";
      case "auth/weak-password": return "Kies een sterker wachtwoord (minimaal 6 tekens).";
      case "auth/user-not-found":
      case "auth/wrong-password": return "Onjuiste combinatie van e-mail en wachtwoord.";
      default: return `Er ging iets mis (${err.code}).`;
    }
  }

  function showPage(pageId) {
    pages.forEach((page) => {
      page.classList.toggle("active-page", page.id === pageId);
    });

    navButtons.forEach((btn) => {
      const target = btn.dataset.page;
      btn.classList.toggle("active", target === pageId);
    });

    if (pageId === "analytics") initAnalyticsChart();
    if (pageId === "joint") renderJointPurchases(); // ensure visible data
  }

  // ====================================
  // NAV
  // ====================================
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      if (!target) return;
      showPage(target);
    });
  });

  internalPageButtons.forEach((btn) => {
    if (!btn.classList.contains("nav-btn")) {
      btn.addEventListener("click", () => {
        const target = btn.dataset.page;
        if (!target) return;
        showPage(target);
      });
    }
  });

  // ====================================
  // AUTH: tabs
  // ====================================
  if (loginTab && signupTab && loginForm && signupForm) {
    loginTab.addEventListener("click", () => {
      loginTab.classList.add("active");
      signupTab.classList.remove("active");
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
      if (loginError) loginError.textContent = "";
      if (signupError) signupError.textContent = "";
    });

    signupTab.addEventListener("click", () => {
      signupTab.classList.add("active");
      loginTab.classList.remove("active");
      signupForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      if (loginError) loginError.textContent = "";
      if (signupError) signupError.textContent = "";
    });
  }

  // Sign up
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (signupError) signupError.textContent = "";

      const name = document.getElementById("signup-name")?.value.trim();
      const email = document.getElementById("signup-email")?.value.trim().toLowerCase();
      const password = document.getElementById("signup-password")?.value.trim();
      const roleInput = document.querySelector("input[name='signup-role']:checked");
      const role = roleInput ? roleInput.value : null;

      if (!name || !email || !password || !role) {
        if (signupError) signupError.textContent = "Vul alle velden in en kies een accounttype.";
        return;
      }

      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (cred.user && name) await cred.user.updateProfile({ displayName: name });

        await db.collection("users").doc(cred.user.uid).set({
          name,
          email,
          role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        signupForm.reset();
        alert("Account aangemaakt! Je kunt nu inloggen.");
        if (loginTab) loginTab.click();
      } catch (err) {
        console.error(err);
        if (signupError) signupError.textContent = parseFirebaseError(err);
      }
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";

      const email = document.getElementById("login-email")?.value.trim().toLowerCase();
      const password = document.getElementById("login-password")?.value;

      if (!email || !password) {
        if (loginError) loginError.textContent = "Vul e-mail en wachtwoord in.";
        return;
      }

      try {
        await auth.signInWithEmailAndPassword(email, password);
      } catch (err) {
        console.error(err);
        if (loginError) loginError.textContent = parseFirebaseError(err);
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().catch((err) => console.error(err));
    });
  }

  // Auth listener
  auth.onAuthStateChanged(async (user) => {
    currentUser = user || null;

    if (postsUnsubscribe) {
      postsUnsubscribe();
      postsUnsubscribe = null;
    }

    if (!currentUser) {
      currentUserRole = "buyer";
      updateUserTag();
      showAuth();
      return;
    }

    // Role from Firestore
    currentUserRole = "buyer";
    try {
      const doc = await db.collection("users").doc(currentUser.uid).get();
      if (doc.exists && doc.data().role) currentUserRole = doc.data().role;
    } catch (err) {
      console.warn("Kon gebruikersrol niet ophalen:", err);
    }

    updateUserTag();
    showApp();
    showPage("overview");

    // Init pages
    renderGroupList();
    subscribeToGroupFeed();
    syncCartToUI();
    initAnalyticsChart();

    // Joint purchase init/render
    initJointPurchaseData();
    renderJointPurchases();
  });

  // ====================================
  // CART
  // ====================================
  function syncCartToUI() {
    if (!cartItemsEl || !cartWeightEl || !cartTotalEl) return;

    cartItemsEl.innerHTML = "";
    let totalWeight = 0;
    let totalPrice = 0;

    cart.forEach((item) => {
      totalWeight += item.totalWeight;
      totalPrice += item.totalPrice;

      const li = document.createElement("li");
      li.textContent = `${item.name} – ${item.totalWeight.toFixed(1)} kg (€${item.totalPrice.toFixed(2)})`;
      cartItemsEl.appendChild(li);
    });

    cartWeightEl.textContent = totalWeight.toFixed(1);
    cartTotalEl.textContent = totalPrice.toFixed(2);

    if (summaryMaterialEl) summaryMaterialEl.textContent = totalPrice.toFixed(2);
    if (shipWeightInput && totalWeight > 0) shipWeightInput.value = totalWeight.toFixed(1);

    if (cartEmptyMsgEl) cartEmptyMsgEl.style.display = cart.length === 0 ? "block" : "none";
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
            totalPrice: item.price * item.weight
          });
        }
        syncCartToUI();
      } catch (err) {
        console.error("Fout bij parsen cart-item:", err);
      }
    });
  });

  // ====================================
  // CHECKOUT
  // ====================================
  function calculateShipping(region, weightKg) {
    if (!weightKg || weightKg <= 0) return 0;

    let base = 0, step = 0;
    switch (region) {
      case "NL": base = 7; step = 4; break;
      case "EU": base = 15; step = 8; break;
      case "WORLD": base = 25; step = 12; break;
      default: base = 7; step = 4;
    }

    if (weightKg <= 10) return base;
    const extraBlocks = Math.ceil((weightKg - 10) / 10);
    return base + extraBlocks * step;
  }

  if (shippingForm) {
    shippingForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const region = shipRegionInput ? shipRegionInput.value : "NL";
      const weight = parseFloat(shipWeightInput?.value || "0");
      const materialTotal = parseFloat(summaryMaterialEl?.textContent || "0");

      const shippingCost = calculateShipping(region, weight);
      const grandTotal = materialTotal + shippingCost;

      if (summaryShippingEl) summaryShippingEl.textContent = shippingCost.toFixed(2);
      if (summaryTotalEl) summaryTotalEl.textContent = grandTotal.toFixed(2);
    });
  }

  // ====================================
  // ANALYTICS
  // ====================================
  function initAnalyticsChart() {
    if (!stockChartCanvas || typeof Chart === "undefined") return;
    if (stockChartInstance) return;

    const ctx = stockChartCanvas.getContext("2d");
    stockChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Carbon prepreg T700", "Epoxy hars 2K", "Glass fabric 450 g/m²"],
        datasets: [{ label: "Stock (kg)", data: [1500, 3200, 7800] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e5e7eb" } } },
        scales: {
          x: { ticks: { color: "#e5e7eb" }, grid: { display: false } },
          y: { ticks: { color: "#e5e7eb" }, grid: { color: "rgba(148,163,184,0.3)" } }
        }
      }
    });
  }

  // ====================================
  // COMMUNITY
  // ====================================
  function renderGroupList() {
    if (!groupListEl) return;
    groupListEl.innerHTML = "";

    GROUPS.forEach((group) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "group-btn" + (group.id === activeGroupId ? " active" : "");
      btn.textContent = group.label;

      btn.addEventListener("click", () => {
        activeGroupId = group.id;
        renderGroupList();
        if (currentGroupNameEl) currentGroupNameEl.textContent = group.label;
        if (currentUser) subscribeToGroupFeed();
      });

      li.appendChild(btn);
      groupListEl.appendChild(li);
    });

    const active = GROUPS.find((g) => g.id === activeGroupId) || GROUPS[0];
    if (currentGroupNameEl && active) currentGroupNameEl.textContent = active.label;
  }

  function renderPostsSnapshot(snapshot) {
    if (!postFeed) return;
    postFeed.innerHTML = "";

    if (snapshot.empty) {
      const empty = document.createElement("div");
      empty.className = "post-empty";
      empty.textContent = "Nog geen posts in deze groep.";
      postFeed.appendChild(empty);
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();

      const card = document.createElement("article");
      card.className = "post-card";

      const header = document.createElement("div");
      header.className = "post-header";

      const userEl = document.createElement("div");
      userEl.textContent = data.userName || "Onbekende user";

      const timeEl = document.createElement("div");
      let timeText = "";
      if (data.createdAt && data.createdAt.toDate) {
        const d = data.createdAt.toDate();
        timeText =
          d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
          " " +
          d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
      }
      timeEl.textContent = timeText;

      header.appendChild(userEl);
      header.appendChild(timeEl);
      card.appendChild(header);

      if (data.text) {
        const p = document.createElement("p");
        p.className = "post-text";
        p.textContent = data.text;
        card.appendChild(p);
      }

      if (data.fileUrl) {
        if (data.fileType === "image") {
          const img = document.createElement("img");
          img.src = data.fileUrl;
          img.alt = data.fileName || "upload";
          img.className = "post-image";
          card.appendChild(img);
        } else {
          const link = document.createElement("a");
          link.href = data.fileUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "post-file";
          link.textContent = data.fileName || "Bekijk document";
          card.appendChild(link);
        }
      }

      postFeed.appendChild(card);
    });
  }

  function subscribeToGroupFeed() {
    if (!postFeed) return;

    if (postsUnsubscribe) {
      postsUnsubscribe();
      postsUnsubscribe = null;
    }

    postsUnsubscribe = db
      .collection("posts")
      .where("groupId", "==", activeGroupId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .onSnapshot(
        (snapshot) => renderPostsSnapshot(snapshot),
        (err) => console.error("Post feed error:", err)
      );
  }

  if (postForm && postText && postFile) {
    postForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = postForm.querySelector("button[type='submit'], #postBtn");
      if (submitBtn) submitBtn.disabled = true;

      if (!currentUser) {
        alert("Log eerst in om een update te plaatsen.");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const text = postText.value.trim();
      const file = postFile.files[0];

      if (!text && !file) {
        alert("Schrijf een update of voeg een bestand toe.");
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      let fileUrl = null;
      let fileName = null;
      let fileType = null;

      try {
        if (file) {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `community/${currentUser.uid}/${Date.now()}_${safeName}`;
          const ref = storage.ref().child(path);

          const snapshot = await ref.put(file);
          fileUrl = await snapshot.ref.getDownloadURL();
          fileName = file.name;
          fileType = file.type && file.type.startsWith("image/") ? "image" : "file";
        }

        await db.collection("posts").add({
          text,
          fileUrl,
          fileName,
          fileType,
          groupId: activeGroupId,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || "User",
          role: currentUserRole || "buyer",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        postText.value = "";
        postFile.value = "";
      } catch (err) {
        console.error("Fout bij plaatsen post:", err);
        alert("Plaatsen mislukt: " + (err.message || "onbekende fout"));
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ====================================
  // JOINT PURCHASE (DEMO, persistent via localStorage)
  // ====================================
  function initJointPurchaseData() {
    if (!jpListEl) return;

    try {
      const raw = localStorage.getItem(JP_STORAGE_KEY);
      if (raw) {
        jpCampaigns = JSON.parse(raw);
        return;
      }
    } catch (_) {}

    // Default campaigns (mooie bedragen/tiers)
    jpCampaigns = [
      {
        id: "jp-001",
        title: "Q1 T700 prepreg joint purchase",
        material: "Carbon prepreg T700",
        targetKg: 1000,
        basePrice: 38.0,
        tiers: [
          { kg: 250, price: 36.5 },
          { kg: 500, price: 35.2 },
          { kg: 1000, price: 33.9 }
        ],
        raisedEur: 18200,
        participants: 7,
        deadline: "2026-02-15"
      },
      {
        id: "jp-002",
        title: "Epoxy 2K bulk buy (EU only)",
        material: "Epoxy resin system 2K",
        targetKg: 2000,
        basePrice: 9.5,
        tiers: [
          { kg: 500, price: 9.1 },
          { kg: 1200, price: 8.7 },
          { kg: 2000, price: 8.2 }
        ],
        raisedEur: 6400,
        participants: 4,
        deadline: "2026-03-01"
      },
      {
        id: "jp-003",
        title: "Glass fabric 450 g/m² group order",
        material: "Glass fabric 450 g/m²",
        targetKg: 3000,
        basePrice: 4.2,
        tiers: [
          { kg: 800, price: 4.0 },
          { kg: 1600, price: 3.85 },
          { kg: 3000, price: 3.6 }
        ],
        raisedEur: 5100,
        participants: 9,
        deadline: "2026-02-05"
      }
    ];

    saveJointPurchase();
  }

  function saveJointPurchase() {
    try {
      localStorage.setItem(JP_STORAGE_KEY, JSON.stringify(jpCampaigns));
    } catch (_) {}
  }

  function calcCurrentTier(c) {
    // Convert raised € to estimated kg using basePrice (demo assumption)
    const estKg = c.basePrice > 0 ? (c.raisedEur / c.basePrice) : 0;

    // Find best tier reached
    let best = { kg: 0, price: c.basePrice };
    (c.tiers || []).forEach((t) => {
      if (estKg >= t.kg && t.kg >= best.kg) best = t;
    });
    return { estKg, tierKg: best.kg, tierPrice: best.price };
  }

  function renderJointPurchases() {
    if (!jpListEl) return;

    jpListEl.innerHTML = "";

    jpCampaigns.forEach((c) => {
      const { estKg, tierKg, tierPrice } = calcCurrentTier(c);
      const progress = Math.max(0, Math.min(100, (estKg / c.targetKg) * 100));

      const item = document.createElement("div");
      item.className = "jp-item" + (c.id === jpSelectedId ? " selected" : "");
      item.setAttribute("data-id", c.id);

      const deadlineTxt = c.deadline ? new Date(c.deadline).toLocaleDateString("nl-NL") : "—";

      item.innerHTML = `
        <div class="jp-item-header">
          <div>
            <div class="jp-title">${c.title}</div>
            <div class="jp-sub">${c.material} • Target ${c.targetKg.toLocaleString("nl-NL")} kg • Deadline ${deadlineTxt}</div>
          </div>
          <div class="jp-badges">
            <span class="jp-badge">Tier: ${tierKg ? `${tierKg}kg` : "Base"}</span>
            <span class="jp-badge">${eur.format(tierPrice)}/kg</span>
            <span class="jp-badge">${c.participants} participants</span>
          </div>
        </div>

        <div class="jp-progress">
          <div class="jp-progressbar"><div class="jp-progressfill" style="width:${progress.toFixed(0)}%"></div></div>
          <div class="jp-metrics">
            <span>Raised: ${eur.format(c.raisedEur)}</span>
            <span>Progress: ${progress.toFixed(0)}%</span>
          </div>
        </div>
      `;

      item.addEventListener("click", () => {
        jpSelectedId = c.id;
        renderJointPurchases();
        renderSelectedCampaign();
      });

      jpListEl.appendChild(item);
    });

    renderSelectedCampaign();
  }

  function renderSelectedCampaign() {
    if (!jpSelectedEl) return;

    const c = jpCampaigns.find((x) => x.id === jpSelectedId);
    if (!c) {
      jpSelectedEl.textContent = "Select a campaign on the left to see details here.";
      return;
    }

    const { estKg, tierKg, tierPrice } = calcCurrentTier(c);
    const progress = Math.max(0, Math.min(100, (estKg / c.targetKg) * 100));

    const tiers = (c.tiers || [])
      .map((t) => `• ${t.kg} kg → ${eur.format(t.price)}/kg`)
      .join("<br/>");

    jpSelectedEl.innerHTML = `
      <strong>${c.title}</strong><br/>
      Material: ${c.material}<br/>
      Target: ${c.targetKg.toLocaleString("nl-NL")} kg<br/>
      Raised: ${eur.format(c.raisedEur)} (≈ ${estKg.toFixed(0)} kg)<br/>
      Current tier: <strong>${tierKg ? `${tierKg} kg` : "Base"}</strong> at <strong>${eur.format(tierPrice)}/kg</strong><br/>
      Progress: ${progress.toFixed(0)}%<br/><br/>
      <span style="color:#9ca3af">Pricing tiers:</span><br/>
      ${tiers || "—"}
    `;
  }

  if (jpCreateForm) {
    jpCreateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (jpCreateMsg) jpCreateMsg.textContent = "";

      if (!currentUser) {
        if (jpCreateMsg) jpCreateMsg.textContent = "Log eerst in om een campaign te maken.";
        return;
      }

      const title = jpTitleInput?.value.trim();
      const material = jpMaterialInput?.value;
      const targetKg = parseFloat(jpTargetKgInput?.value || "0");
      const basePrice = parseFloat(jpBasePriceInput?.value || "0");

      if (!title || !material || !targetKg || !basePrice) {
        if (jpCreateMsg) jpCreateMsg.textContent = "Vul alle velden correct in.";
        return;
      }

      const id = `jp-${Date.now()}`;
      const newCampaign = {
        id,
        title,
        material,
        targetKg,
        basePrice,
        tiers: [
          { kg: Math.max(100, Math.round(targetKg * 0.25)), price: +(basePrice * 0.96).toFixed(2) },
          { kg: Math.max(200, Math.round(targetKg * 0.5)), price: +(basePrice * 0.92).toFixed(2) },
          { kg: Math.max(300, Math.round(targetKg * 1.0)), price: +(basePrice * 0.88).toFixed(2) }
        ],
        raisedEur: 0,
        participants: 1,
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString().slice(0, 10) // +21 days
      };

      jpCampaigns.unshift(newCampaign);
      jpSelectedId = id;
      saveJointPurchase();
      renderJointPurchases();

      jpCreateForm.reset();
      // Zet defaults terug (gebruiksvriendelijk)
      if (jpTargetKgInput) jpTargetKgInput.value = "500";
      if (jpBasePriceInput) jpBasePriceInput.value = "38";

      if (jpCreateMsg) jpCreateMsg.textContent = "Campaign created. Select it and join to add contributions.";
    });
  }

  if (jpJoinForm) {
    jpJoinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (jpJoinMsg) jpJoinMsg.textContent = "";

      if (!currentUser) {
        if (jpJoinMsg) jpJoinMsg.textContent = "Log eerst in om mee te doen.";
        return;
      }

      const c = jpCampaigns.find((x) => x.id === jpSelectedId);
      if (!c) {
        if (jpJoinMsg) jpJoinMsg.textContent = "Select eerst een campaign links.";
        return;
      }

      const amount = parseFloat(jpAmountInput?.value || "0");
      if (!amount || amount < 50) {
        if (jpJoinMsg) jpJoinMsg.textContent = "Minimale bijdrage is €50.";
        return;
      }

      c.raisedEur = +(c.raisedEur + amount).toFixed(2);
      c.participants = (c.participants || 0) + 1;

      saveJointPurchase();
      renderJointPurchases();

      if (jpJoinForm) jpJoinForm.reset();
      if (jpJoinMsg) jpJoinMsg.textContent = `Joined. Contribution recorded: ${eur.format(amount)}.`;
    });
  }

  // Render groups even before login (safe)
  renderGroupList();
  syncCartToUI();
});
document.getElementById("hamburgerBtn").addEventListener("click", () => {
  document.querySelector(".nav-center").classList.toggle("active");
});
