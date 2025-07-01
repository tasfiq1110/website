document.addEventListener("DOMContentLoaded", function () {
    const mealForm = document.getElementById("mealForm");
    const bazarForm = document.getElementById("bazarForm");
    const personalSummaryBtn = document.getElementById("personalSummaryBtn");
    const globalSummaryBtn = document.getElementById("globalSummaryBtn");

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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meals: values })
        });

        const text = await res.text();
        document.getElementById("mealResult").innerText = text;
    });

    bazarForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const cost = document.getElementById("cost").value;
        const details = document.getElementById("details").value;

        const res = await fetch("/submit_bazar", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cost, details })
        });

        const text = await res.text();
        document.getElementById("bazarResult").innerText = text;
    });

    personalSummaryBtn.addEventListener("click", async function () {
        const res = await fetch("/summary/personal");
        const result = document.getElementById("personalSummary");
        result.innerHTML = "";

        if (res.ok) {
            const data = await res.json();
            const table = generateSummaryTable(data.summary);
            result.appendChild(table);
        } else {
            result.innerText = "Failed to load summary.";
        }
    });

    globalSummaryBtn.addEventListener("click", async function () {
        const res = await fetch("/summary/global");
        const result = document.getElementById("globalSummary");
        result.innerHTML = "";

        if (res.ok) {
            const data = await res.json();
            const table = generateSummaryTable(data.summary);
            result.appendChild(table);
        } else {
            result.innerText = "Failed to load summary.";
        }
    });

    function generateSummaryTable(data) {
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        ["Username", "Date", "Meal", "Count", "Status", "Bazar ৳", "Details"].forEach(h => {
            const th = document.createElement("th");
            th.innerText = h;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        data.forEach(row => {
            const tr = document.createElement("tr");

            const [username, date, meal, count, status, cost, details] = row;

            [username, date, meal, count, status || '', cost || '', details || ''].forEach(val => {
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
