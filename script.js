document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const app = document.getElementById("app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const yearSpan = document.getElementById("year");

  const VALID_NAME = "1234";
  const VALID_PASSWORD = "1234";

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // LOGIN LOGICA
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const name = (formData.get("name") || "").toString().trim();
    const password = (formData.get("password") || "").toString().trim();

    if (name === VALID_NAME && password === VALID_PASSWORD) {
      loginError.textContent = "";
      loginScreen.classList.add("hidden");
      app.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    } else {
      loginError.textContent = "Onjuiste demo-login. Gebruik 1234 / 1234.";
    }
  });

  // SLIDER LOGICA
  const slidesContainer = document.querySelector(".slides");
  const slideElements = document.querySelectorAll(".slide");
  const navButtons = document.querySelectorAll("[data-slide]");
  const prevBtn = document.querySelector("[data-action='prev']");
  const nextBtn = document.querySelector("[data-action='next']");
  const indicator = document.getElementById("slide-indicator");

  let currentSlide = 0;

  function updateSlide(index) {
    const total = slideElements.length;
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    currentSlide = index;

    const offset = -index * 100;
    slidesContainer.style.transform = `translateX(${offset}vw)`;

    navButtons.forEach((btn) => {
      const btnIndex = Number(btn.dataset.slide);
      if (!isNaN(btnIndex)) {
        btn.classList.toggle("active", btnIndex === index);
      }
    });

    if (indicator) {
      indicator.textContent = `${index + 1} / ${total}`;
    }
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.slide);
      if (!isNaN(idx)) {
        updateSlide(idx);
      }
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => updateSlide(currentSlide - 1));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => updateSlide(currentSlide + 1));
  }

  updateSlide(0);
});
