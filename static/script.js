document.addEventListener("DOMContentLoaded", () => {
  // Elements by ID
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const mealForm = document.getElementById("mealForm");
  const summaryBtn = document.getElementById("summaryBtn");

  // Register
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(registerForm);
      try {
        const response = await fetch("/register", {
          method: "POST",
          body: formData
        });
        const text = await response.text();
        document.getElementById("registerResult").innerText = text;

        if (text.toLowerCase().includes("successful")) {
          setTimeout(() => {
            window.location.href = "/login";
          }, 1000);
        }
      } catch (err) {
        document.getElementById("registerResult").innerText = "Error during registration.";
      }
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      try {
        const response = await fetch("/login", {
          method: "POST",
          body: formData
        });
        const text = await response.text();
        document.getElementById("loginResult").innerText = text;

        if (text.toLowerCase().includes("successful")) {
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1000);
        }
      } catch (err) {
        document.getElementById("loginResult").innerText = "Login failed.";
      }
    });
  }

  // Submit Meal
  if (mealForm) {
    mealForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(mealForm);
      try {
        const response = await fetch("/submit_meal", {
          method: "POST",
          body: formData
        });
        const text = await response.text();
        document.getElementById("mealResult").innerText = text;
      } catch (err) {
        document.getElementById("mealResult").innerText = "Error submitting meal.";
      }
    });
  }

  // Load Summary
  if (summaryBtn) {
    summaryBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/summary");
        if (response.ok) {
          const data = await response.json();
          let summary = data.map(
            ([date, mealType, count]) =>
              `📅 Date: ${date}, 🍽️ Meal: ${mealType}, 🔢 Count: ${count}`
          ).join("\n");
          document.getElementById("summaryResult").innerText = summary;
        } else {
          document.getElementById("summaryResult").innerText = "❌ You must be logged in.";
        }
      } catch (err) {
        document.getElementById("summaryResult").innerText = "Error loading summary.";
      }
    });
  }
});
