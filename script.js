// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;
  let chartCreated = false;
  let postsUnsubscribe = null;

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

  // Community feed
  const groupListEl = document.getElementById("group-list");
  const currentGroupNameEl = document.getElementById("current-group-name");
  const postForm = document.getElementById("post-form");
  const postText = document.getElementById("post-text");
  const postFile = document.getElementById("post-file");
  const postFeed = document.getElementById("post-feed");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // ==== COMMUNITY GROEPEN ====
  const GROUPS = [
    {
      id: "market-updates",
      name: "Market updates",
      description: "Prijswijzigingen, stock updates, lead times."
    },
    {
      id: "certificates-rfq",
      name: "Certificates & RFQ’s",
      description: "Nieuwe certificaten, RFQ’s en technische documentatie."
    }
  ];
  let activeGroupId = GROUPS[0].id;

  function seedGroupsInFirestore() {
    if (!db) return;
    GROUPS.forEach((g) => {
      db.collection("groups").doc(g.id).set(
        {
          id: g.id,
          name: g.name,
          description: g.description,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });
  }

  function renderGroupList() {
    if (!groupListEl) return;
    groupListEl.innerHTML = "";
    GROUPS.forEach((g) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "group-btn" + (g.id === activeGroupId ? " active" : "");
      btn.textContent = g.name;
      btn.addEventListener("click", () => {
        activeGroupId = g.id;
        if (currentGroupNameEl) currentGroupNameEl.textContent = g.name;
        renderGroupList();
        subscribeToGroupFeed();
      });
      li.appendChild(btn);
      groupListEl.appendChild(li);
    });
  }

  // ==== HELPER FUNCTIES ====

  function showAuth() {
    if (!authWrapper || !app) return;
    authWrapper.classList.remove("hidden");
    app.classList.add("hidden");
  }

  function showApp(name) {
    if (!authWrapper || !app) return;
    authWrapper.classList.add("hidden");
    app.classList.remove("hidden");
    if (name && userTag) userTag.textContent = name;
    showPage("overview");
    initChart();
    syncCartToUI();
    seedGroupsInFirestore();
    renderGroupList();
    if (currentGroupNameEl) currentGroupNameEl.textContent = GROUPS[0].name;
    subscribeToGroupFeed();
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

  // ==== FIREBASE AUTH STATE ====

  auth.onAuthStateChanged((user) => {
    currentUser = user || null;

    if (user) {
      const name = user.displayName || user.email || "User";
      showApp(name);
    } else {
      if (postsUnsubscribe) {
        postsUnsubscribe();
        postsUnsubscribe = null;
      }
      showAuth();
    }
  });

  // ==== TAB WISSELEN LOGIN / SIGNUP ====

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

  // ==== SIGNUP ====

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
        if (signupError) signupError.textContent = "";
        signupForm.reset();
        alert("Account aangemaakt! Je kunt nu inloggen.");
        if (loginTab) loginTab.click();
      } catch (err) {
        console.error(err);
        if (signupError) signupError.textContent = parseFirebaseError(err);
      }
    });
  }

  // ==== LOGIN ====

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

  // ==== LOGOUT ====

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().catch((err) => console.error(err));
    });
  }

  // ==== PAGINA NAVIGATIE ====

  function showPage(id) {
    pages.forEach((page) => {
      page.classList.toggle("active-page", page.id === id);
    });

    navButtons.forEach((btn) => {
      const target = btn.dataset.page;
      btn.classList.toggle("active", target === id);
    });

    if (id === "analytics") {
      initChart();
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
            totalPrice: item.price * item.weight
          });
        }
        syncCartToUI();
      } catch (err) {
        console.error("Fout bij parsen cart-item:", err);
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

  // ==== COMMUNITY FEED (LINKEDIN-STIJL) ====

  function renderPostsSnapshot(snapshot) {
    if (!postFeed) return;
    postFeed.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.groupId !== activeGroupId) return;

      const card = document.createElement("article");
      card.className = "post-card";

      const header = document.createElement("div");
      header.className = "post-header";

      const userEl = document.createElement("div");
      userEl.className = "post-user";
      userEl.textContent = data.userName || "Onbekende user";

      const timeEl = document.createElement("div");
      timeEl.className = "post-time";
      let timeText = "";
      if (data.createdAt && data.createdAt.toDate) {
        const d = data.createdAt.toDate();
        timeText =
          d.toLocaleDateString("nl-NL", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit"
          }) +
          " " +
          d.toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit"
          });
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
        if (data.fileType && data.fileType.startsWith("image/")) {
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
    if (!db || !postFeed) return;

    if (postsUnsubscribe) {
      postsUnsubscribe();
      postsUnsubscribe = null;
    }

    postsUnsubscribe = db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(100)
      .onSnapshot(
        (snapshot) => {
          renderPostsSnapshot(snapshot);
        },
        (err) => {
          console.error("Post feed error", err);
        }
      );
  }

  if (postForm && postText && postFile) {
    postForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) {
        alert("Log eerst in om een update te plaatsen.");
        return;
      }

      const text = postText.value.trim();
      const file = postFile.files[0];

      if (!text && !file) {
        alert("Schrijf een update of voeg een bestand toe.");
        return;
      }

      let fileUrl = null;
      let fileName = null;
      let fileType = null;

      try {
        if (file) {
          const path = `posts/${currentUser.uid}/${Date.now()}_${file.name}`;
          const ref = storage.ref().child(path);
          await ref.put(file);
          fileUrl = await ref.getDownloadURL();
          fileName = file.name;
          fileType = file.type;
        }

        await db.collection("posts").add({
          text,
          fileUrl,
          fileName,
          fileType,
          groupId: activeGroupId,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || "User",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        postText.value = "";
        postFile.value = "";
      } catch (err) {
        console.error("Fout bij plaatsen post:", err);
        alert("Plaatsen mislukt: " + err.message);
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
          "Glass fabric 450 g/m²"
        ],
        datasets: [
          {
            label: "Stock (kg)",
            data: [1500, 3200, 7800]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb"
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#e5e7eb" },
            grid: { display: false }
          },
          y: {
            ticks: { color: "#e5e7eb" },
            grid: { color: "rgba(148,163,184,0.3)" }
          }
        }
      }
    });
  }

  // eerste keer cart ui
  syncCartToUI();
});

// ================== SUPPLIERS & CERTIFICATES SEED ==================

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
        scopeShort:
          "Prepregs & laminated composites for aerospace and industrial applications",
        downloadUrl: ""
      },
      iso9001: {
        standard: "ISO 9001:2015",
        type: "Quality management",
        issuer: "LRQA",
        site: "Nijverdal, NL",
        scopeShort:
          "Quality management system for composite material production"
      }
    }
  },

  "sgl-meitingen": {
    company: {
      name: "SGL Carbon GmbH",
      street: "Werner-von-Siemens-Straße 18",
      postalCode: "86405",
      city: "Meitingen",
      country: "Germany",
      website: "https://www.sglcarbon.com",
      sectors: ["Aerospace", "Automotive", "Energy"],
      mainCertificates: ["ISO 9001", "ISO 14001", "ISO 45001"],
      continent: "Europe"
    },
    certificates: {
      iso9001: {
        standard: "ISO 9001:2015",
        type: "Quality management",
        issuer: "TÜV",
        site: "Meitingen, DE",
        scopeShort:
          "Quality management for carbon and graphite products"
      },
      iso14001: {
        standard: "ISO 14001:2015",
        type: "Environmental management",
        issuer: "TÜV",
        site: "Meitingen, DE",
        scopeShort:
          "Environmental management system for production sites"
      }
    }
  },

  "gurit-uk": {
    company: {
      name: "Gurit (UK) Ltd",
      street: "St Cross Business Park",
      postalCode: "PO30 5WU",
      city: "Newport, Isle of Wight",
      country: "United Kingdom",
      website: "https://www.gurit.com",
      sectors: ["Wind", "Marine", "Aerospace"],
      mainCertificates: ["ISO 9001", "ISO 14001", "ISO 45001"],
      continent: "Europe"
    },
    certificates: {
      iso9001: {
        standard: "ISO 9001:2015",
        type: "Quality management",
        issuer: "LRQA",
        site: "UK sites",
        scopeShort:
          "Quality management for composite materials and adhesives"
      }
    }
  },

  "porcher-fr": {
    company: {
      name: "Porcher Industries",
      street: "75 Route Départementale 1085",
      postalCode: "38300",
      city: "Eclose-Badinières",
      country: "France",
      website: "https://www.porcher-ind.com",
      sectors: ["Technical textiles", "Thermoplastic composites"],
      mainCertificates: ["ISO 50001", "ISO 9001 (sites)"],
      continent: "Europe"
    },
    certificates: {
      iso50001: {
        standard: "ISO 50001",
        type: "Energy management",
        issuer: "AFNOR",
        site: "French sites",
        scopeShort:
          "Energy management system for industrial sites"
      }
    }
  }
};

function setSeedStatus(text) {
  if (window.updateSeedStatus) {
    window.updateSeedStatus(text);
  }
  console.log(text);
}

window.seedCompaniesAndCertificates = async function () {
  try {
    if (!db) {
      console.error("Firestore 'db' is niet gedefinieerd. Check je firebase init.");
      return;
    }

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
