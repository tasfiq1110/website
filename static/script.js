document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");
    const mealForm = document.getElementById("mealForm");
    const summaryBtn = document.getElementById("summaryBtn");
    const summaryBox = document.getElementById("summaryResult");

    // Register User
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
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
            } catch (err) {
                document.getElementById("registerResult").innerText = "Error registering user.";
            }
        });
    }

    // Login User
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
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
            } catch (err) {
                document.getElementById("loginResult").innerText = "Error logging in.";
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
                const resultEl = document.getElementById("mealResult");
                if (resultEl) resultEl.innerText = text;
            } catch (err) {
                const resultEl = document.getElementById("mealResult");
                if (resultEl) resultEl.innerText = "Error submitting meal.";
            }
        });
    }

    // Fetch and Display Meal Summary
    if (summaryBtn && summaryBox) {
        summaryBtn.addEventListener("click", async () => {
            try {
                const response = await fetch("/summary");
                if (response.ok) {
                    const data = await response.json();
                    if (data.summary.length === 0) {
                        summaryBox.innerText = "No meals submitted yet.";
                        return;
                    }

                    let summaryText = "";
                    data.summary.forEach(entry => {
                        summaryText += `🍽 Date: ${entry.date}, Meal: ${entry.meal_type}, Count: ${entry.count}\n`;
                    });

                    summaryBox.innerText = summaryText;
                } else {
                    summaryBox.innerText = "Failed to fetch summary.";
                }
            } catch (err) {
                summaryBox.innerText = "Error retrieving summary.";
            }
        });
    }
});
