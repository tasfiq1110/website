document.addEventListener("DOMContentLoaded", function () {
    const mealForm = document.getElementById("mealForm");
    const bazarForm = document.getElementById("bazarForm");
    const personalSummaryBtn = document.getElementById("personalSummaryBtn");
    const globalSummaryBtn = document.getElementById("globalSummaryBtn");
    const calculateCostBtn = document.getElementById("calculateCostBtn");
    const mealDateInput = document.getElementById("mealDate");
    const bazarDateInput = document.getElementById("bazarDate");
    const monthPicker = document.getElementById("monthPicker");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationToggle = document.getElementById("notificationToggle");
    const unseenBadge = document.getElementById("unseenBadge");

    function getSelectedMonth() {
        return monthPicker?.value || new Date().toISOString().slice(0, 7);
    }

    // ========== 🍽 Meal Submission ==========
    if (mealForm) {
        mealForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const checkboxes = document.querySelectorAll('input[name="meal"]:checked');
            const meals = Array.from(checkboxes).map(cb => cb.value);
            const extra = parseInt(document.getElementById("extraMeal")?.value || "0");
            const date = mealDateInput?.value;

            if (!meals.length && extra === 0) {
                showToast("Submitting with 0 meals.", "success");
            }

            const res = await fetch("/submit_meal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meals, extra_meal: extra, date })
            });

            const msg = await res.text();
            document.getElementById("mealResult").innerText = msg;
            showToast(msg, res.ok ? "success" : "error");
            fetchActiveMealsToday();
            fetchNotifications();
            // ✅ Clear checkboxes and extra input
            document.querySelectorAll('input[name="meal"]').forEach(cb => cb.checked = false);
            document.getElementById("extraMeal").value = "0";
        });
    }

    // ========== 💸 Bazar Submission ==========
    if (bazarForm) {
        bazarForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const cost = document.getElementById("cost").value;
            const details = document.getElementById("details").value;
            const date = bazarDateInput?.value;

            const res = await fetch("/submit_bazar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cost, details, date })
            });

            const msg = await res.text();
            document.getElementById("bazarResult").innerText = msg;
            showToast(msg, res.ok ? "success" : "error");
            fetchNotifications();
        });

        // Autofill if data exists for selected date
        bazarDateInput.addEventListener("change", async function () {
            try {
                const res = await fetch(`/bazar_entry?date=${this.value}`);
                const data = await res.json();
                document.getElementById("cost").value = data.cost || "";
                document.getElementById("details").value = data.details || "";
            } catch {
                document.getElementById("cost").value = "";
                document.getElementById("details").value = "";
            }
        });
    }

    // ========== 📊 Summaries ==========
    if (personalSummaryBtn) {
        personalSummaryBtn.addEventListener("click", async () => {
            const month = getSelectedMonth();
            const res = await fetch(`/summary/personal?month=${month}`);
            const target = document.getElementById("personalSummary");
            target.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                target.appendChild(generateSummaryTable(data.summary, true));
            } else {
                target.innerText = "Failed to load summary.";
                showToast("Failed to load personal summary", "error");
            }
        });
    }

    if (globalSummaryBtn) {
        globalSummaryBtn.addEventListener("click", async () => {
            const month = getSelectedMonth();
            const res = await fetch(`/summary/global?month=${month}`);
            const target = document.getElementById("globalSummary");
            target.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                target.appendChild(generateSummaryTable(data.summary, false));
            } else {
                target.innerText = "Failed to load summary.";
                showToast("Failed to load global summary", "error");
            }
        });
    }

    if (calculateCostBtn) {
        calculateCostBtn.addEventListener("click", async () => {
            const month = getSelectedMonth();
            const res = await fetch(`/summary/cost?month=${month}`);
            const target = document.getElementById("costResult");
            target.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                const unitCost = document.createElement("p");
                unitCost.innerText = `Meal Unit Cost: ৳${data.meal_unit_cost.toFixed(2)}`;
                target.appendChild(unitCost);

                const table = document.createElement("table");
                const headers = ["Username", "Total Meals", "Bazar Spent (৳)", "Total Cost (৳)", "Balance (৳)"];
                table.appendChild(buildRow(headers, "th"));

                data.user_costs.forEach(row => {
                    const values = [
                        row.username,
                        row.meals,
                        row.spent || 0,
                        (row.meals * data.meal_unit_cost).toFixed(2),
                        row.balance.toFixed(2)
                    ];
                    table.appendChild(buildRow(values));
                });

                target.appendChild(table);
            } else {
                target.innerText = "Failed to calculate cost.";
                showToast("Cost calculation failed", "error");
            }
        });
    }

    // ========== 🧩 Utility Functions ==========
    function buildRow(values, type = "td") {
        const tr = document.createElement("tr");
        values.forEach(v => {
            const cell = document.createElement(type);
            cell.innerText = v;
            tr.appendChild(cell);
        });
        return tr;
    }

    function generateSummaryTable(data, isPersonal) {
        const headers = isPersonal
            ? ["Date", "Count", "Modified", "Bazar ৳", "Details", "Bazar Modified"]
            : ["Username", "Date", "Count", "Modified", "Bazar ৳", "Details", "Bazar Modified"];

        const table = document.createElement("table");
        table.appendChild(buildRow(headers, "th"));
        data.forEach(row => table.appendChild(buildRow(row)));
        return table;
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("toast");
        toast.innerText = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = "toast";
        }, 3000);
    }

    // ========== 🔔 Notifications ==========
    if (notificationToggle) {
        notificationToggle.addEventListener("click", async () => {
            const isOpen = notificationPanel.classList.toggle("active");
            if (isOpen) {
                await fetch("/notifications/mark_seen", { method: "POST" });
                document.getElementById("notifDot").style.display = "none";
            }
        });
    }

    async function fetchNotifications() {
        try {
            const res = await fetch("/notifications");
            const data = await res.json();
            const list = document.getElementById("notificationList");
            const notifDot = document.getElementById("notifDot");
            list.innerHTML = "";
            let unseenCount = 0;

            data.notifications.forEach(n => {
                const li = document.createElement("li");
                li.innerText = `[${n.timestamp}] ${n.message}`;
                if (!n.seen) {
                    li.classList.add("unseen");
                    unseenCount++;
                }
                list.appendChild(li);
            });

            notifDot.style.display = unseenCount > 0 ? "inline-block" : "none";
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    }

    async function fetchActiveMealsToday() {
        try {
            const res = await fetch("/active_meals_today");
            const data = await res.json();
            const list = document.getElementById("activeMealsList");
            list.innerHTML = "";

            if (!data.active_meals?.length) {
                list.innerHTML = "<li>No meals submitted today.</li>";
                return;
            }

            data.active_meals.forEach(({ username, meal_count, modified }) => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <span class="username">${username}</span>
                    <span class="meal-info ${meal_count === 0 ? 'zero' : ''}">
                        ${meal_count} meal${meal_count !== 1 ? 's' : ''}
                        ${modified ? '<span class="modified"> (Modified)</span>' : ''}
                    </span>`;
                list.appendChild(li);
            });
        } catch (e) {
            console.error("Active meals fetch failed:", e);
        }
    }

   let chartInstance = null;
    let isYearlyView = false;

async function renderMealBazarChart() {
  const ctx = document.getElementById('mealBazarChart').getContext('2d');
  const button = document.getElementById('toggleChartView');

  // Get selected month/year
  const selectedMonth = document.getElementById("monthPicker").value || new Date().toISOString().slice(0, 7);
  const [year, month] = selectedMonth.split("-");

  // Choose API route based on view
  const url = isYearlyView
  ? `/chart_data?mode=yearly&year=${year}`
  : `/chart_data?mode=monthly&month=${selectedMonth}`;
  const res = await fetch(url);
  const data = await res.json();

  // Destroy existing chart if exists
  if (chartInstance) chartInstance.destroy();

  // Create new chart
  chartInstance = new Chart(ctx, {
    data: {
      labels: data.labels,
      datasets: [
        {
          type: 'bar',
          label: isYearlyView ? 'Monthly Meal Count' : 'Daily Meals',
          data: data.meals,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: isYearlyView ? 'Monthly Bazar Cost' : 'Daily Bazar Cost',
          data: data.bazars,
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      stacked: false,
      plugins: {
        legend: {
          labels: {
            font: {
              size: 12
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Meals'
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          title: {
            display: true,
            text: 'Bazar Cost (৳)'
          }
        }
      }
    }
  });

  // Update toggle button text
  button.innerText = isYearlyView ? "Switch to Monthly View" : "Switch to Yearly View";
}

// Attach toggle chart view logic
document.getElementById("toggleChartView").addEventListener("click", () => {
  isYearlyView = !isYearlyView;
  renderMealBazarChart();
});



    // ========== ⏱ Initial Load ==========
    const now = new Date();
    monthPicker.value = now.toISOString().slice(0, 7);
    renderMealBazarChart();
    fetchActiveMealsToday();
    fetchNotifications();
    setInterval(fetchActiveMealsToday, 5000);
    setInterval(fetchNotifications, 2000);
});
