document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const mealForm = document.getElementById("mealForm");
  const summaryBtn = document.getElementById("summaryBtn");

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const res = await fetch("/register", {
      method: "POST",
      body: formData
    });
    const text = await res.text();
    document.getElementById("registerResult").innerText = text;
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const res = await fetch("/login", {
      method: "POST",
      body: formData
    });
    const text = await res.text();
    document.getElementById("loginResult").innerText = text;
  });

  mealForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(mealForm);
    const res = await fetch("/submit_meal", {
      method: "POST",
      body: formData
    });
    const text = await res.text();
    document.getElementById("mealResult").innerText = text;
  });

  summaryBtn.addEventListener("click", async function () {
    const res = await fetch("/summary");
    if (res.status === 200) {
      const data = await res.json();
      document.getElementById("summaryResult").innerText = JSON.stringify(data, null, 2);
    } else {
      document.getElementById("summaryResult").innerText = "Not logged in";
    }
  });
});
