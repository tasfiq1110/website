document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const mealForm = document.getElementById("mealForm");
  const summaryBtn = document.getElementById("summaryBtn");
  const summaryResult = document.getElementById("summary");

  // Register
  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(registerForm);
      try {
        const response = await fetch("/register", {
          method: "POST",
          body: formData
        });

        if (response.redirected) {
          window.location.href = response.url;
        } else {
          const text = await response.text();
          document.getElementById("registerResult").innerText = text;
        }
      } catch (error) {
        document.getElementById("registerResult").innerText = "Registration failed.";
      }
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(loginForm);
      try {
        const response = await fetch("/login", {
          method: "POST",
          body: formData
        });

        if (response.redirected) {
          window.location.href = response.url;
        } else {
          const text = await response.text();
          document.getElementById("loginResult").innerText = text;
        }
      } catch (error) {
        document.getElementById("loginResult").innerText = "Login failed.";
      }
    });
  }

  // Meal submission
  if (mealForm) {
    mealForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(mealForm);
      try {
        const response = await fetch("/submit_meal", {
          method: "POST",
          body: formData
        });

        const text = await response.text();
        document.getElementById("mealResult").innerText = text;
      } catch (error) {
        document.getElementById("mealResult").innerText = "Meal submission failed.";
      }
    });
  }

  // Summary fetch
  if (summaryBtn && summaryResult) {
    summaryBtn.addEventListener("click", async function () {
      try {
        const response = await fetch("/summary");
        if (response.ok) {
          const data = await response.json();
          let summaryText = '';
          data.summary.forEach(item => {
            summaryText += `Date: ${item.date}, Meal: ${item.meal_type}, Count: ${item.count}\n`;
          });
          summaryResult.innerText = summaryText;
        } else {
          summaryResult.innerText = "Unauthorized or error occurred.";
        }
      } catch (error) {
        summaryResult.innerText = "Failed to load summary.";
      }
    });
  }
});
