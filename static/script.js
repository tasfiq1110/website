document.addEventListener("DOMContentLoaded", () => {
    const mealForm = document.getElementById("mealForm");
    const bazarForm = document.getElementById("bazarForm");
    const mealDate = document.getElementById("mealDate");
    const bazarDate = document.getElementById("bazarDate");
    const costInput = document.getElementById("cost");
    const detailsInput = document.getElementById("details");
    const extraMeal = document.getElementById("extraMeal");
    const monthPicker = document.getElementById("monthPicker");
    const personalBtn = document.getElementById("personalSummaryBtn");
    const globalBtn = document.getElementById("globalSummaryBtn");
    const costBtn = document.getElementById("calculateCostBtn");
    const notificationToggle = document.getElementById("notificationToggle");
    const notifDot = document.getElementById("notifDot");
    const notificationPanel = document.getElementById("notificationPanel");
    const unseenBadge = document.getElementById("unseenBadge");

    // ========== 🔁 Fetch Functions ==========
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

    async function fetchNotifications() {
        try {
            const res = await fetch("/notifications");
            const data = await res.json();
            const list = document.getElementById("notificationList");
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
            console.error("Notification fetch failed", err);
        }
    }

    // ========== 📥 Form Handlers ==========
    mealForm?.addEventListener("submit", async e => {
        e.preventDefault();
        const selected = Array.from(document.querySelectorAll('input[name="meal"]:checked')).map(cb => cb.value);
        const date = mealDate?.value;
        const extra = parseInt(extraMeal?.value || 0);

        if (!selected.length && extra === 0) {
            showToast("No meals selected, submitting 0 meals.", "success");
        }

        const res = await fetch("/submit_meal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meals: selected, date, extra_meal: extra })
        });

        const msg = await res.text();
        showToast(msg, res.ok ? "success" : "error");
        document.getElementById("mealResult").innerText = msg;
        fetchActiveMealsToday();
        fetchNotifications();
    });

    bazarForm?.addEventListener("submit", async e => {
        e.preventDefault();
        const date = bazarDate?.value;
        const cost = costInput.value;
        const details = detailsInput.value;

        const res = await fetch("/submit_bazar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cost, details, date })
        });

        const msg = await res.text();
        showToast(msg, res.ok ? "success" : "error");
        document.getElementById("bazarResult").innerText = msg;
        fetchNotifications();
    });

    // ========== 📅 Date Pre-fill for Bazar ==========
    bazarDate?.addEventListener("change", async function () {
        try {
            const res = await fetch(`/bazar_entry?date=${this.value}`);
            const data = await res.json();
            costInput.value = data.cost || "";
            detailsInput.value = data.details || "";
        } catch (err) {
            costInput.value = "";
            detailsInput.value = "";
        }
    });

    // ========== 📊 Summary Buttons ==========
    personalBtn?.addEventListener("click", () => fetchSummary("personal"));
    globalBtn?.addEventListener("click", () => fetchSummary("global"));
    costBtn?.addEventListener("click", () => fetchCostSummary());

    async function fetchSummary(type) {
        const res = await fetch(`/summary/${type}?month=${monthPicker.value}`);
        const target = document.getElementById(type === "personal" ? "personalSummary" : "globalSummary");
        target.innerHTML = "";

        if (res.ok) {
            const data = await res.json();
            target.appendChild(generateSummaryTable(data.summary, type === "personal"));
        } else {
            showToast("Summary fetch failed", "error");
        }
    }

    async function fetchCostSummary() {
        const res = await fetch(`/summary/cost?month=${monthPicker.value}`);
        const target = document.getElementById("costResult");
        target.innerHTML = "";

        if (res.ok) {
            const data = await res.json();
            const p = document.createElement("p");
            p.innerText = `Meal Unit Cost: ৳${data.meal_unit_cost.toFixed(2)}`;
            target.appendChild(p);

            const table = document.createElement("table");
            const header = ["Username", "Total Meals", "Bazar Spent (৳)", "Total Cost (৳)", "Balance (৳)"];
            table.appendChild(buildRow(header, "th"));

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
            showToast("Cost calculation failed", "error");
        }
    }

    function buildRow(values, cellType = "td") {
        const tr = document.createElement("tr");
        values.forEach(val => {
            const cell = document.createElement(cellType);
            cell.innerText = val;
            tr.appendChild(cell);
        });
        return tr;
    }

    function generateSummaryTable(summary, isPersonal) {
        const table = document.createElement("table");
        const headers = isPersonal
            ? ["Date", "Count", "Modified", "Bazar ৳", "Details", "Bazar Modified"]
            : ["Username", "Date", "Count", "Modified", "Bazar ৳", "Details", "Bazar Modified"];
        table.appendChild(buildRow(headers, "th"));

        summary.forEach(row => {
            table.appendChild(buildRow(row));
        });

        return table;
    }

    // ========== 📆 Calendar Loader ==========
    function renderCalendar(mealData, monthStr) {
        const calendar = document.getElementById("mealCalendar");
        calendar.innerHTML = "";

        const [year, month] = monthStr.split("-");
        const days = new Date(year, month, 0).getDate();
        const firstDay = new Date(`${monthStr}-01`).getDay();

        let html = "<table class='calendar'><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr><tr>";

        for (let i = 0; i < firstDay; i++) html += "<td></td>";

        for (let d = 1; d <= days; d++) {
            const date = `${monthStr}-${d.toString().padStart(2, '0')}`;
            const status = mealData[date] || "none";

            let bg =
                status === "none" ? "#fce4ec" :
                status === "modified" ? "#fff3cd" :
                "#d4edda";

            html += `<td style="background-color:${bg};">${d}</td>`;
            if ((firstDay + d) % 7 === 0) html += "</tr><tr>";
        }

        html += "</tr></table>";
        calendar.innerHTML = html;
    }

    function loadMealCalendar(month) {
        fetch(`/calendar/meals?month=${month}`)
            .then(res => res.json())
            .then(data => renderCalendar(data.dates, month));
    }

    document.getElementById("calendarMonth")?.addEventListener("change", e => {
        loadMealCalendar(e.target.value);
    });

    // ========== 🔔 Notification Toggle ==========
    notificationToggle?.addEventListener("click", async () => {
        const isOpen = notificationPanel.classList.toggle("active");
        if (isOpen) {
            await fetch("/notifications/mark_seen", { method: "POST" });
            notifDot.style.display = "none";
        }
    });

    // ========== Startup Load ==========
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    document.getElementById("calendarMonth").value = currentMonth;
    loadMealCalendar(currentMonth);
    fetchActiveMealsToday();
    fetchNotifications();
    setInterval(fetchActiveMealsToday, 5000);
    setInterval(fetchNotifications, 2000);

    // ========== Toast ==========
    function showToast(msg, type = "success") {
        const toast = document.getElementById("toast");
        toast.innerText = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => (toast.className = "toast"), 3000);
    }
});
