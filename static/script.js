document.addEventListener("DOMContentLoaded", function () {
    const mealForm = document.getElementById("mealForm");
    const bazarForm = document.getElementById("bazarForm");
    const personalSummaryBtn = document.getElementById("personalSummaryBtn");
    const globalSummaryBtn = document.getElementById("globalSummaryBtn");

    if (mealForm) {
        mealForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const checkboxes = document.querySelectorAll('input[name="meal"]:checked');
            const values = Array.from(checkboxes).map(cb => cb.value);

            if (values.length === 0) {
                document.getElementById("mealResult").innerText = "Please select at least one meal.";
                return;
            }

            const formData = new FormData();
            values.forEach(meal => formData.append('meal', meal));

            const res = await fetch("/submit_meal", {
                method: "POST",
                body: formData
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

            const formData = new FormData();
            formData.append('cost', cost);
            formData.append('details', details);

            const res = await fetch("/submit_bazar", {
                method: "POST",
                body: formData
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
                const table = generateSummaryTable(data.meals, data.bazar, true);
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
                const table = generateSummaryTable(data.meals, data.bazar, false);
                result.appendChild(table);
            } else {
                result.innerText = "Failed to load summary.";
            }
        });
    }

    function generateSummaryTable(meals, bazars, isPersonal) {
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const headers = isPersonal
            ? ["Date", "Meal", "Count", "Modified", "Bazar ৳", "Details"]
            : ["Username", "Date", "Meal", "Count", "Modified", "Bazar ৳", "Details"];

        headers.forEach(h => {
            const th = document.createElement("th");
            th.innerText = h;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");

        meals.forEach(meal => {
            const tr = document.createElement("tr");
            const values = isPersonal
                ? [meal[0], meal[1], meal[2], meal[3] ? 'Yes' : '', '', '']
                : [meal[0], meal[1], meal[2], meal[3], meal[4] ? 'Yes' : '', '', ''];

            values.forEach(val => {
                const td = document.createElement("td");
                td.innerText = val;
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        bazars.forEach(bazar => {
            const tr = document.createElement("tr");
            const values = isPersonal
                ? [bazar[0], '', '', '', bazar[1], bazar[2]]
                : [bazar[0], bazar[1], '', '', bazar[2], bazar[3]];

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
