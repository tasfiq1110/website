document.addEventListener("DOMContentLoaded", () => {
  const mealForm = document.getElementById("mealForm");
  const bazarForm = document.getElementById("bazarForm");
  const personalSummaryBtn = document.getElementById("personalSummaryBtn");
  const globalSummaryBtn = document.getElementById("globalSummaryBtn");
  const summaryTable = document.getElementById("summaryTable");

  mealForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(mealForm);
    const res = await fetch("/submit_meal", {
      method: "POST",
      body: formData
    });
    const text = await res.text();
    document.getElementById("mealResult").innerText = text;
  });

  bazarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(bazarForm);
    const res = await fetch("/submit_bazar", {
      method: "POST",
      body: formData
    });
    const text = await res.text();
    document.getElementById("bazarResult").innerText = text;
  });

  personalSummaryBtn.addEventListener("click", () => loadSummary("/summary", "Personal"));
  globalSummaryBtn.addEventListener("click", () => loadSummary("/summary_global", "Global"));

  async function loadSummary(endpoint, label) {
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      renderSummaryTable(data.summary, label);
    } else {
      summaryTable.innerHTML = "Failed to load summary.";
    }
  }

  function renderSummaryTable(data, type) {
    if (data.length === 0) {
      summaryTable.innerHTML = `<p>No ${type} summary available for this month.</p>`;
      return;
    }

    let html = `<h3>${type} Summary for This Month</h3>`;
    html += `<table><thead><tr><th>Date</th><th>User</th><th>Meal Type</th><th>Count</th><th>Modified</th><th>Bazar</th></tr></thead><tbody>`;

    data.forEach(row => {
      const [date, username, meal, count, modified, bazarCost, bazarDetails] = row;
      html += `<tr>
        <td>${date}</td>
        <td>${username || '-'}</td>
        <td>${meal || '-'}</td>
        <td>${count || '-'}</td>
        <td>${modified ? 'Yes' : 'No'}</td>
        <td>${bazarCost ? `${bazarCost} - ${bazarDetails}` : '-'}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    summaryTable.innerHTML = html;
  }
});
