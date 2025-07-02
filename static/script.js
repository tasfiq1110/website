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
    const unseenBadge = document.getElementById("unseenBadge");
    const notificationToggle = document.getElementById("notificationToggle");

    function getSelectedMonth() {
        return monthPicker?.value || new Date().toISOString().slice(0, 7);
    }

    if (mealForm) {
        mealForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const checkboxes = document.querySelectorAll('input[name="meal"]:checked');
            const values = Array.from(checkboxes).map(cb => cb.value);
            const date = mealDateInput?.value || null;
            const extraMeal = parseInt(document.getElementById("extraMeal")?.value) || 0;

            if (values.length === 0 && extraMeal === 0) {
                showToast("Submitting with 0 meals.", "success");
            }

            const res = await fetch("/submit_meal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meals: values, date, extra_meal: extraMeal })
            });

            const text = await res.text();
            document.getElementById("mealResult").innerText = text;
            showToast(text, res.ok ? "success" : "error");
            fetchActiveMealsToday();
            fetchNotifications();
        });
    }

    if (bazarForm) {
        bazarForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const cost = document.getElementById("cost").value;
            const details = document.getElementById("details").value;
            const date = bazarDateInput?.value || null;

            const res = await fetch("/submit_bazar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cost, details, date })
            });

            const text = await res.text();
            document.getElementById("bazarResult").innerText = text;
            showToast(text, res.ok ? "success" : "error");
            fetchNotifications();
        });
    }

    if (personalSummaryBtn) {
        personalSummaryBtn.addEventListener("click", async function () {
            const month = getSelectedMonth();
            const res = await fetch(`/summary/personal?month=${month}`);
            const result = document.getElementById("personalSummary");
            result.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                result.appendChild(generateSummaryTable(data.summary, true));
            } else {
                result.innerText = "Failed to load summary.";
                showToast("Failed to load personal summary", "error");
            }
        });
    }

    if (globalSummaryBtn) {
        globalSummaryBtn.addEventListener("click", async function () {
            const month = getSelectedMonth();
            const res = await fetch(`/summary/global?month=${month}`);
            const result = document.getElementById("globalSummary");
            result.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                result.appendChild(generateSummaryTable(data.summary, false));
            } else {
                result.innerText = "Failed to load summary.";
                showToast("Failed to load global summary", "error");
            }
        });
    }

    if (calculateCostBtn) {
        calculateCostBtn.addEventListener("click", async function () {
            const month = getSelectedMonth();
            const res = await fetch(`/summary/cost?month=${month}`);
            const result = document.getElementById("costResult");
            result.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                const unitCostText = document.createElement("p");
                unitCostText.innerText = `Meal Unit Cost: ৳${data.meal_unit_cost.toFixed(2)}`;
                result.appendChild(unitCostText);

                const table = document.createElement("table");
                const headerRow = document.createElement("tr");
                ["Username", "Total Meals", "Bazar Spent (৳)", "Total Cost (৳)", "Balance (৳)"].forEach(h => {
            const th = document.createElement("th");
            th.innerText = h;
            headerRow.appendChild(th);
            });
                table.appendChild(headerRow);

                data.user_costs.forEach(row => {
        const tr = document.createElement("tr");
        const cells = [
        row.username,
        row.meals,
        row.spent || 0,
        row.meals * data.meal_unit_cost,
        row.balance
        ];

    cells.forEach(val => {
        const td = document.createElement("td");
        td.innerText = typeof val === "number" ? val.toFixed(2) : val;
        tr.appendChild(td);
    });

    table.appendChild(tr);
});

                const wrapper = document.createElement("div");
                wrapper.className = "table-wrapper";
                wrapper.appendChild(table);
                result.appendChild(wrapper);
            } else {
                result.innerText = "Failed to calculate cost.";
                showToast("Cost calculation failed", "error");
            }
        });
    }

    function generateSummaryTable(summary, isPersonal) {
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const headers = isPersonal
            ? ["Date", "Count", "Modified", "Bazar ৳", "Details", "Bazar Modified"]
            : ["Username", "Date", "Count", "Modified", "Bazar ৳", "Details", "Bazar Modified"];

        headers.forEach(h => {
            const th = document.createElement("th");
            th.innerText = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        summary.forEach(row => {
            const tr = document.createElement("tr");
            row.forEach(val => {
                const td = document.createElement("td");
                td.innerText = val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);

        const wrapper = document.createElement("div");
        wrapper.className = "table-wrapper";
        wrapper.appendChild(table);
        return wrapper;
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("toast");
        if (!toast) return;
        toast.className = `toast show ${type}`;
        toast.innerText = message;
        setTimeout(() => toast.className = "toast", 3000);
    }

    async function fetchActiveMealsToday() {
        try {
            const res = await fetch("/active_meals_today");
            const data = await res.json();
            const list = document.getElementById("activeMealsList");
            list.innerHTML = "";

            if (!data.active_meals?.length) {
                const li = document.createElement("li");
                li.className = "no-data";
                li.innerText = "No meals submitted today.";
                list.appendChild(li);
                return;
            }

            data.active_meals.forEach(({ username, meal_count, modified }) => {
                const li = document.createElement("li");
                li.innerHTML = `<span class="username">${username}</span>
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

    async function fetchNotifications() {
    try {
        const res = await fetch("/notifications");
        const data = await res.json();
        const list = document.getElementById("notificationList");

        list.innerHTML = "";

        let unseenCount = 0;

        if (data.notifications.length === 0) {
            const li = document.createElement("li");
            li.innerText = "No notifications yet.";
            list.appendChild(li);
        } else {
            data.notifications.forEach(n => {
                const li = document.createElement("li");
                li.className = "notification-item";
                if (!n.seen) {
                    li.classList.add("unseen");
                    unseenCount++;
                }
                li.innerText = `[${n.timestamp}] ${n.message}`;
                list.appendChild(li);
            });
        }

        const notifDot = document.getElementById("notifDot");
        if (unseenCount > 0) {
            notifDot.style.display = "inline-block";
        } else {
            notifDot.style.display = "none";
        }

    } catch (err) {
        console.error("Failed to fetch notifications", err);
        const list = document.getElementById("notificationList");
        list.innerHTML = "<li>Error loading notifications.</li>";
    }
}


    if (notificationToggle) {
        notificationToggle.addEventListener("click", async () => {
            const isShown = notificationPanel.style.display === "block";
            notificationPanel.style.display = isShown ? "none" : "block";

            if (!isShown) {
    await fetch("/notifications/mark_seen", { method: "POST" });
    unseenBadge.style.display = "none";
    const notifDot = document.getElementById("notifDot");
    if (notifDot) notifDot.style.display = "none"; // ✅ Also hide dot
}
        });
    }

    fetchActiveMealsToday();
    fetchNotifications();
    setInterval(fetchActiveMealsToday, 5000);
    setInterval(fetchNotifications, 2000);
});
