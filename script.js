// =====================================================
// 0) FIREBASE INIT (V8 CDN) - VUL JE EIGEN CONFIG IN
// =====================================================
const firebaseConfig = {
  apiKey: "VUL_HIER_IN",
  authDomain: "VUL_HIER_IN",
  projectId: "VUL_HIER_IN",
  storageBucket: "VUL_HIER_IN",
  messagingSenderId: "VUL_HIER_IN",
  appId: "VUL_HIER_IN"
};

// Init only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

console.log("Firebase init OK:", firebase.app().options.projectId);

// =====================================================
// 1) Firebase services
// =====================================================
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Extra: vang async errors duidelijker
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

// =====================================================
// 2) APP
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  // ====================================
  // DOM REFERENTIES
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

  // Stock / cart
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

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // ====================================
  // GLOBALE STATE
  // ====================================
  let currentUser = null;
  let currentUserRole = "buyer";

  const cart = [];
  let stockChartInstance = null;

  // Community / Firestore subscriptions
  let postsUnsubscribe = null;

  const GROUPS = [
    { id: "market-updates", label: "Market updates" },
    { id: "certificates-rfq", label: "Certificates & RFQ's" }
  ];
  let activeGroupId = GROUPS[0].id;

  // ====================================
  // HELPER FUNCTIES
  // ====================================

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
    if (!err) return "Er ging iets mis. Probeer het opnieuw.";
    if (err.code) {
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
          return `Er ging iets mis (${err.code}).`;
      }
    }
    return err.message || "Er ging iets mis. Probeer het opnieuw.";
  }

  // ====================================
  // NAVIGATIE
  // ====================================

  function showPage(pageId) {
    pages.forEach((page) => {
      page.classList.toggle("active-page", page.id === pageId);
    });

    navButtons.forEach((btn) => {
      const target = btn.dataset.page;
      btn.classList.toggle("active", target === pageId);
    });

    if (pageId === "analytics") {
      initAnalyticsChart();
    }
  }

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
  // AUTH: LOGIN / SIGNUP / LOGOUT
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

        if (cred.user && name) {
          await cred.user.updateProfile({ displayName: name });
        }

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

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().catch((err) => console.error(err));
    });
  }

  // Auth state listener
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

    // Rol ophalen uit Firestore
    currentUserRole = "buyer";
    try {
      const doc = await db.collection("users").doc(currentUser.uid).get();
      if (doc.exists && doc.data().role) {
        currentUserRole = doc.data().role;
      }
    } catch (err) {
      console.warn("Kon gebruikersrol niet ophalen:", err);
    }

    updateUserTag();
    showApp();
    showPage("overview");

    renderGroupList();
    subscribeToGroupFeed();

    syncCartToUI();
    initAnalyticsChart();
  });

  // ====================================
  // CART LOGICA
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
  // CHECKOUT / VERZENDKOSTEN
  // ====================================

  function calculateShipping(region, weightKg) {
    if (!weightKg || weightKg <= 0) return 0;

    let base = 0;
    let step = 0;

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
  // ANALYTICS (Chart.js)
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
  // COMMUNITY FEED
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

    console.log("Subscribing to posts:", activeGroupId);

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

  // POSTEN (met duidelijke status + disable)
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
        // Upload (als er file is)
        if (file) {
          // Gebruik community/<uid>/... (consistent met nette Storage rules)
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `community/${currentUser.uid}/${Date.now()}_${safeName}`;
          const ref = storage.ref().child(path);

          console.log("Uploading file to:", path);
          const snapshot = await ref.put(file);
          fileUrl = await snapshot.ref.getDownloadURL();
          fileName = file.name;
          fileType = file.type && file.type.startsWith("image/") ? "image" : "file";
        }

        console.log("Writing Firestore post:", { groupId: activeGroupId });

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
        console.log("Post placed OK");
      } catch (err) {
        console.error("Fout bij plaatsen post:", err);
        alert("Plaatsen mislukt: " + (err.message || "onbekende fout"));
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Eerste render van groups (ook als nog niet ingelogd)
  renderGroupList();

  // Cart UI initialiseren
  syncCartToUI();
});

// =====================================================
// OPTIONAL: SEED COMPANIES & CERTIFICATES (blijft werken)
// =====================================================
const companiesSeed = {
  "toray-nijverdal": {
    company: {
      name: "Toray Advanced Composites Netherlands B.V.",
      street: "G. van der Muelenweg 2",
      postalCode: "7443 RE",
      city: "Nijverdal",
      country: "Netherlands",
      website: "https://www.toraytac.com",
      sectors: ["Aerospace", "Industrial"],
      mainCertificates: ["EN 9100", "ISO 9001"],
      continent: "Europe"
    },
    certificates: {
      en9100: {
        standard: "EN 9100:2018 / AS9100D",
        type: "Quality management - aerospace",
        issuer: "LRQA",
        site: "Nijverdal, NL",
        scopeShort: "Prepregs & laminated composites for aerospace and industrial applications",
        downloadUrl: ""
      },
      iso9001: {
        standard: "ISO 9001:2015",
        type: "Quality management",
        issuer: "LRQA",
        site: "Nijverdal, NL",
        scopeShort: "Quality management system for composite material production"
      }
    }
  }
  // (Laat de rest van je seed zoals je het had; je kan het eronder plakken)
};

function setSeedStatus(text) {
  if (window.updateSeedStatus) window.updateSeedStatus(text);
  console.log(text);
}

window.seedCompaniesAndCertificates = async function () {
  try {
    setSeedStatus("Bezig met seeden...");

    const ops = [];
    for (const [companyId, data] of Object.entries(companiesSeed)) {
      const company = data.company;
      const certs = data.certificates || {};

      const companyRef = db.collection("companies").doc(companyId);
      ops.push(companyRef.set(company, { merge: true }));

      for (const [certId, certData] of Object.entries(certs)) {
        const certRef = companyRef.collection("certificates").doc(certId);
        ops.push(certRef.set(certData, { merge: true }));
      }
    }

    await Promise.all(ops);
    setSeedStatus("Klaar! Bedrijven en certificaten staan nu in Firestore.");
  } catch (err) {
    console.error(err);
    setSeedStatus("Fout bij seeden: " + err.message);
  }
};
