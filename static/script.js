document.addEventListener("DOMContentLoaded", function () {
    const mealForm = document.getElementById("mealForm");
    const bazarForm = document.getElementById("bazarForm");
    const personalSummaryBtn = document.getElementById("personalSummaryBtn");
    const globalSummaryBtn = document.getElementById("globalSummaryBtn");
    const calculateCostBtn = document.getElementById("calculateCostBtn");
    const mealDateInput = document.getElementById("mealDate");
    const bazarDateInput = document.getElementById("bazarDate");
    const monthPicker = document.getElementById("monthPicker");

    function getSelectedMonth() {
        return monthPicker && monthPicker.value ? monthPicker.value : new Date().toISOString().slice(0, 7);
    }

    if (mealForm) {
        mealForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const checkboxes = document.querySelectorAll('input[name="meal"]:checked');
            const values = Array.from(checkboxes).map(cb => cb.value);
            const date = mealDateInput && mealDateInput.value ? mealDateInput.value : null;

            const extraMealInput = document.getElementById("extraMeal");
            const extraMeal = extraMealInput ? parseInt(extraMealInput.value) || 0 : 0;

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
            fetchActiveMealsToday(); // update today's list after meal submission
        });
    }

    if (bazarForm) {
        bazarForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const cost = document.getElementById("cost").value;
            const details = document.getElementById("details").value;
            const date = bazarDateInput && bazarDateInput.value ? bazarDateInput.value : null;

            const res = await fetch("/submit_bazar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cost, details, date })
            });

            const text = await res.text();
            document.getElementById("bazarResult").innerText = text;
            showToast(text, res.ok ? "success" : "error");
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
                const table = generateSummaryTable(data.summary, true);
                result.appendChild(table);
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
                const table = generateSummaryTable(data.summary, false);
                result.appendChild(table);
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

                ["Username", "Total Meals", "Cost/Meal (৳)", "Total Cost (৳)"].forEach(h => {
                    const th = document.createElement("th");
                    th.innerText = h;
                    headerRow.appendChild(th);
                });

                table.appendChild(headerRow);

                data.user_costs.forEach(row => {
                    const tr = document.createElement("tr");
                    const values = [row.username, row.meals, data.meal_unit_cost, row.cost];
                    values.forEach(val => {
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
            const values = isPersonal ? row.slice(1) : row;
            values.forEach(val => {
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

        setTimeout(() => {
            toast.className = "toast";
        }, 3000);
    }

    // 🔥 NEW FUNCTION: Fetch and show active meals today
  async function fetchActiveMealsToday() {
    try {
        const res = await fetch("/active_meals_today");
        const data = await res.json(); // Should be { active_meals: [ { username, meal_count, modified }, ... ] }

        const list = document.getElementById("activeMealsList");
        list.innerHTML = "";

        if (!data.active_meals || data.active_meals.length === 0) {
            const li = document.createElement("li");
            li.className = "no-data";
            li.innerText = "No meals submitted today.";
            list.appendChild(li);
            return;
        }

        data.active_meals.forEach(({ username, meal_count, modified }) => {
            const li = document.createElement("li");

            // Username
            const name = document.createElement("span");
            name.className = "username";
            name.innerText = username;

            // Meal Info
            const mealInfo = document.createElement("span");
            mealInfo.className = "meal-info";
            if (meal_count === 0) mealInfo.classList.add("zero");
            mealInfo.innerText = `${meal_count} meal${meal_count !== 1 ? 's' : ''}`;

            // Show modified tag if needed
            if (modified) {
                const modifiedTag = document.createElement("span");
                modifiedTag.className = "modified";
                modifiedTag.innerText = " (Modified)";
                mealInfo.appendChild(modifiedTag);
            }

            li.appendChild(name);
            li.appendChild(mealInfo);
            list.appendChild(li);
        });
    } catch (error) {
        console.error("Error fetching active meals:", error);
        const list = document.getElementById("activeMealsList");
        list.innerHTML = "<li class='no-data'>Failed to load active meals.</li>";
    }
}


    // Call it on page load
    fetchActiveMealsToday();
});
