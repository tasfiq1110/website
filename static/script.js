document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const mealForm = document.getElementById("mealForm");
  const summaryBtn = document.getElementById("summaryBtn");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(registerForm);
      const res = await fetch("/register", { method: "POST", body: formData });
      const text = await res.text();
      document.getElementById("registerResult").innerText = text;
      if (text.includes("Successful")) location.href = "/login";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const res = await fetch("/login", { method: "POST", body: formData });
      const text = await res.text();
      document.getElementById("loginResult").innerText = text;
      if (text.includes("Successful")) location.href = "/dashboard";
    });
  }

  if (mealForm) {
    mealForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form
