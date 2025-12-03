document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const app = document.getElementById("app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const yearSpan = document.getElementById("year");
  const userTag = document.getElementById("user-tag");

  const navButtons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");
  const internalPageButtons = document.querySelectorAll("[data-page]");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // LOGIN: wachtwoord moet 1234 zijn
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const name = (formData.get("name") || "").toString().trim();
    const password = (formData.get("password") || "").toString().trim();

    if (password === "1234") {
      loginError.textContent = "";
      loginScreen.classList.add("hidden");
      app.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      if (name && userTag) {
        userTag.textContent = name;
      }
      showPage("overview");
      initChart();
    } else {
      loginError.textContent = "Onjuist wachtwoord. Gebruik 1234 voor de demo.";
    }
  });

  // PAGINA WEERGEVEN
  function showPage(id) {
    pages.forEach((page) => {
      page.classList.toggle("active-page", page.id === id);
    });

    navButtons.forEach((btn) => {
      const target = btn.dataset.page;
      btn.classList.toggle("active", target === id);
    });
  }

  // NAV BUTTONS
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      if (target) showPage(target);
    });
  });

  // INTERNE BUTTONS (bijv. "Bekijk stock" in overview)
  internalPageButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      if (target) showPage(target);
    });
  });

  // CHART
  let chartCreated = false;
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
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
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
});

