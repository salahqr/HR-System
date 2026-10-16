function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function createRow(data) {
    const tr = document.createElement("tr");

    const initials = (data.name ?? "")
        .split(" ")
        .filter(Boolean)
        .map(word => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const status = String(data.status ?? "");
    const enrolled = data.enrollment === "Enrolled";

    tr.innerHTML = `
        <td>
            <div class="person-info">
                <div class="avatar avatar-blue">${escapeHtml(initials)}</div>
                <div>
                    <span class="person-name">${escapeHtml(data.name)}</span>
                    <span class="person-email">${escapeHtml(data.email)}</span>
                </div>
            </div>
        </td>
        <td><span class="person-title">${escapeHtml(data.jobTitle)}</span></td>
        <td class="hire-date">${escapeHtml(data.hireDate)}</td>
        <td>
            <span class="status-badge ${enrolled ? "enrolled" : "not-enrolled"}">
                ${escapeHtml(data.enrollment)}
            </span>
        </td>
        <td>
            <span class="status-badge ${escapeHtml(status.toLowerCase())}">
                ${escapeHtml(status)}
            </span>
        </td>
        <td class="actions">
            <button class="view-button" type="button" data-id="${escapeHtml(data.id)}">View</button>
        </td>
    `;
    return tr;
}

export function renderPeopleTable(container) {
    container.innerHTML = `
        <div class="table-card">
            <div class="table-toolbar">
                <div class="search-box">
                    <input type="text" id="search-input" placeholder="Search by name or email">
                </div>
                <select id="filter-status">
                    <option value="">Status: All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                </select>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Job Title</th>
                            <th>Hire Date</th>
                            <th>Face</th>
                            <th>Status</th>
                            <th class="actions-heading">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>

            <div class="table-footer">
                <span id="visible-count"></span>
                <div class="pagination">
                    <span id="page-info"></span>
                    <button type="button" id="previous-button" disabled>Previous</button>
                    <button type="button" id="next-button" disabled>Next</button>
                </div>
            </div>
        </div>
    `;

    const searchInput = container.querySelector("#search-input");
    const filterStatus = container.querySelector("#filter-status");
    const tableBody = container.querySelector("#table-body");
    const visibleCount = container.querySelector("#visible-count");
    const pageInfo = container.querySelector("#page-info");
    const prevButton = container.querySelector("#previous-button");
    const nextButton = container.querySelector("#next-button");

    let currentPage = 1;
    let lastPage = 1;
    let searchTimer;

    async function fetchUsers() {
        const params = new URLSearchParams({
            search: searchInput.value.trim(),
            status: filterStatus.value,
            page: currentPage
        });

        try {
            visibleCount.textContent = "Loading...";
            const response = await fetch(`/users?${params}`, {
                headers: { "Accept": "application/json" },
                credentials: "include"
            });

            if (response.status === 401) {
                window.location.href = "login.html";
                return;
            }
            if (!response.ok) throw new Error("Failed to fetch users");

            const result = await response.json();
            currentPage = result.current_page;
            lastPage = result.last_page;

            tableBody.replaceChildren(...result.data.map(createRow));

            visibleCount.textContent =
                `Showing ${result.from ?? 0}-${result.to ?? 0} of ${result.total} accounts`;
            pageInfo.textContent = `Page ${currentPage} of ${lastPage}`;
            prevButton.disabled = currentPage <= 1;
            nextButton.disabled = currentPage >= lastPage;
        } catch (error) {
            console.error(error);
            tableBody.replaceChildren();
            visibleCount.textContent = "Unable to load users.";
            pageInfo.textContent = "";
            prevButton.disabled = true;
            nextButton.disabled = true;
        }
    }

    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage = 1;
            fetchUsers();
        }, 300);
    });

    filterStatus.addEventListener("change", () => {
        currentPage = 1;
        fetchUsers();
    });

    prevButton.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            fetchUsers();
        }
    });

    nextButton.addEventListener("click", () => {
        if (currentPage < lastPage) {
            currentPage++;
            fetchUsers();
        }
    });

    tableBody.addEventListener("click", event => {
        const button = event.target.closest(".view-button");
        if (!button) return;
        window.location.href = `personDetails.html?id=${button.dataset.id}`;
    });

    fetchUsers(); // first load
}