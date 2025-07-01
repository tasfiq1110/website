document.addEventListener("DOMContentLoaded", function () {
    const mealForm = document.getElementById("mealForm");
    const bazarForm = document.getElementById("bazarForm");
    const personalSummaryBtn = document.getElementById("personalSummaryBtn");
    const globalSummaryBtn = document.getElementById("globalSummaryBtn");
    const calculateCostBtn = document.getElementById("calculateCostBtn");

    if (mealForm) {
        mealForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const checkboxes = document.querySelectorAll('input[name="meal"]:checked');
            const values = Array.from(checkboxes).map(cb => cb.value);

            if (values.length === 0) {
                document.getElementById("mealResult").innerText = "Please select at least one meal.";
                return;
            }

            const res = await fetch("/submit_meal", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ meals: values })
            });

            const text = await res.text();
            document.getElementById("mealResult").innerText = text;
        });
    }

    if (bazarForm) {
        bazarForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const cost = document.getElementById("cost").value;
            const details = document.getElementById("details").value;

            const res = await fetch("/submit_bazar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ cost, details })
            });

            const text = await res.text();
            document.getElementById("bazarResult").innerText = text;
        });
    }

    if (personalSummaryBtn) {
        personalSummaryBtn.addEventListener("click", async function () {
            const res = await fetch("/summary/personal");
            const result = document.getElementById("personalSummary");
            result.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                const table = generateSummaryTable(data.summary, true);
                result.appendChild(table);
            } else {
                result.innerText = "Failed to load summary.";
            }
        });
    }

    if (globalSummaryBtn) {
        globalSummaryBtn.addEventListener("click", async function () {
            const res = await fetch("/summary/global");
            const result = document.getElementById("globalSummary");
            result.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                const table = generateSummaryTable(data.summary, false);
                result.appendChild(table);
            } else {
                result.innerText = "Failed to load summary.";
            }
        });
    }

    if (calculateCostBtn) {
        calculateCostBtn.addEventListener("click", async function () {
            const res = await fetch("/summary/costs");
            const result = document.getElementById("costResult");
            result.innerHTML = "";

            if (res.ok) {
                const data = await res.json();
                const table = document.createElement("table");

                const headerRow = document.createElement("tr");
                ["Username", "Total Meals", "Cost/Meal (৳)", "Total Cost (৳)"].forEach(h => {
                    const th = document.createElement("th");
                    th.innerText = h;
                    headerRow.appendChild(th);
                });
                table.appendChild(headerRow);

                data.costs.forEach(row => {
                    const tr = document.createElement("tr");
                    row.forEach(val => {
                        const td = document.createElement("td");
                        td.innerText = val;
                        tr.appendChild(td);
                    });
                    table.appendChild(tr);
                });

                result.appendChild(table);
            } else {
                result.innerText = "Failed to calculate cost.";
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
        return table;
    }
});
