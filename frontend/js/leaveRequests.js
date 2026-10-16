
"use strict";

/*
 * Leave Requests page
 *
 * This version uses mock data so you can test the page immediately.
 * Replace the mock data operations with Laravel API requests later.
 *
 * Important:
 * Frontend role checks are not security.
 * Laravel must authorize every approval and rejection.
 */

const API = {
    useMock: true,
    base: "/api"
};

const PAGE_SIZE = 10;
const CURRENT_REVIEWER = "Sara Ali";

const state = {
    pending: [],
    history: [],
    currentPage: 1,
    reviewRequestId: null,
    reviewAction: null
};

const elements = {
    fiscalYear: document.getElementById("fiscal-year"),
    pendingCount: document.getElementById("pending-count"),
    pendingBody: document.getElementById("pending-table-body"),

    search: document.getElementById("history-search"),
    statusFilter: document.getElementById("history-status-filter"),
    typeFilter: document.getElementById("history-type-filter"),
    historyBody: document.getElementById("history-table-body"),
    paginationInfo: document.getElementById("history-pagination-info"),
    previousPage: document.getElementById("previous-page"),
    nextPage: document.getElementById("next-page"),

    dialog: document.getElementById("review-dialog"),
    reviewForm: document.getElementById("review-form"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogDescription: document.getElementById("dialog-description"),
    dialogEmployee: document.getElementById("dialog-employee"),
    reviewComment: document.getElementById("review-comment"),
    dialogError: document.getElementById("dialog-error"),
    confirmReview: document.getElementById("confirm-review"),
    closeDialog: document.getElementById("close-dialog"),
    cancelReview: document.getElementById("cancel-review"),

    toast: document.getElementById("toast")
};

let toastTimeout;

/* ---------------------------------------------------------
   1. Date and formatting helpers
--------------------------------------------------------- */

function dateOnly(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function addDays(dateString, amount) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + amount);

    return dateOnly(date);
}

function formatDate(dateString) {
    if (!dateString) {
        return "—";
    }

    const date = new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function formatDateRange(startDate, endDate) {
    if (startDate === endDate) {
        return formatDate(startDate);
    }

    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function getLeaveTypeLabel(type) {
    const labels = {
        normal: "Normal",
        medical: "Medical",
        day_off: "Day off"
    };

    return labels[type] || type;
}

function getStatusLabel(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function getInclusiveDays(startDate, endDate) {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);

    return Math.max(
        1,
        Math.round((end - start) / 86400000) + 1
    );
}

function getFiscalYearLabel() {
    const now = new Date();
    const year = now.getFullYear();

    return `Fiscal year ${year}–${year + 1}`;
}

/* ---------------------------------------------------------
   2. Mock data
--------------------------------------------------------- */

function createMockData() {
    const today = dateOnly(new Date());

    const pending = [
        {
            id: 101,
            employeeName: "Omar Mansoor",
            department: "Engineering",
            leaveType: "medical",
            startDate: addDays(today, 3),
            endDate: addDays(today, 5),
            days: 3,
            note: "Medical appointment and recovery",
            balanceBefore: 2
        },
        {
            id: 102,
            employeeName: "David Lin",
            department: "Design & Product",
            leaveType: "medical",
            startDate: addDays(today, 5),
            endDate: addDays(today, 6),
            days: 2,
            note: "Scheduled dental surgery",
            balanceBefore: 6
        },
        {
            id: 103,
            employeeName: "Layla Mahmoud",
            department: "Marketing",
            leaveType: "day_off",
            startDate: addDays(today, 8),
            endDate: addDays(today, 8),
            days: 1,
            note: "Personal appointment",
            balanceBefore: 4
        },
        {
            id: 104,
            employeeName: "Rania Khan",
            department: "Design & Product",
            leaveType: "normal",
            startDate: addDays(today, 14),
            endDate: addDays(today, 15),
            days: 2,
            note: "Family gathering",
            balanceBefore: 10
        }
    ];

    const historyTemplates = [
        {
            employeeName: "Amira Al-Mansour",
            department: "People & Operations",
            leaveType: "normal",
            days: 5,
            status: "approved",
            comment: "Approved for annual leave."
        },
        {
            employeeName: "Tariq Zahrani",
            department: "Engineering",
            leaveType: "day_off",
            days: 1,
            status: "rejected",
            comment: "Insufficient coverage during sprint release."
        },
        {
            employeeName: "Elena Brooks",
            department: "Design & Product",
            leaveType: "normal",
            days: 2,
            status: "cancelled",
            comment: "Request cancelled by employee."
        },
        {
            employeeName: "Kareem Nader",
            department: "Sales",
            leaveType: "medical",
            days: 3,
            status: "approved",
            comment: "Medical documentation verified."
        },
        {
            employeeName: "Sofia Yilmaz",
            department: "Marketing",
            leaveType: "normal",
            days: 3,
            status: "approved",
            comment: "Leave approved."
        },
        {
            employeeName: "Julien Dubois",
            department: "Engineering",
            leaveType: "day_off",
            days: 1,
            status: "rejected",
            comment: "Conflicts with a mandatory team milestone."
        },
        {
            employeeName: "Mona Zaki",
            department: "Engineering",
            leaveType: "normal",
            days: 5,
            status: "approved",
            comment: "Annual leave approved."
        },
        {
            employeeName: "Youssef Nabil",
            department: "Marketing",
            leaveType: "medical",
            days: 2,
            status: "approved",
            comment: "Medical documentation verified."
        },
        {
            employeeName: "Nouran El-Sayed",
            department: "People & Operations",
            leaveType: "day_off",
            days: 1,
            status: "cancelled",
            comment: "Request cancelled by employee."
        },
        {
            employeeName: "Tarek Youssef",
            department: "Engineering",
            leaveType: "normal",
            days: 5,
            status: "approved",
            comment: "Team coverage arranged."
        },
        {
            employeeName: "Maya Saleh",
            department: "Finance & Accounting",
            leaveType: "normal",
            days: 2,
            status: "approved",
            comment: "Request approved."
        },
        {
            employeeName: "Yousef Nasser",
            department: "Engineering",
            leaveType: "medical",
            days: 1,
            status: "rejected",
            comment: "Please provide the required documentation."
        }
    ];

    const history = historyTemplates.map((item, index) => {
        const startDate = addDays(today, -(index * 5 + 2));
        const endDate = addDays(startDate, item.days - 1);

        return {
            ...item,
            id: 200 + index,
            startDate,
            endDate,
            reviewedBy: item.status === "cancelled" ? "—" : CURRENT_REVIEWER
        };
    });

    return { pending, history };
}

/* ---------------------------------------------------------
   3. Data loading
--------------------------------------------------------- */

async function loadRequests() {
    try {
        if (API.useMock) {
            const mockData = createMockData();

            state.pending = mockData.pending;
            state.history = mockData.history;
        } else {
            const response = await fetch(`${API.base}/leave-requests`, {
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("Unable to load leave requests.");
            }

            const data = await response.json();

            state.pending = data.pending || [];
            state.history = data.history || [];
        }

        elements.fiscalYear.textContent = getFiscalYearLabel();

        renderPendingRequests();
        renderHistory();
    } catch (error) {
        console.error(error);

        elements.pendingBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    Could not load pending requests.
                </td>
            </tr>
        `;

        elements.historyBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    Could not load leave history.
                </td>
            </tr>
        `;

        showToast(error.message || "Something went wrong.");
    }
}

/* ---------------------------------------------------------
   4. Pending requests
--------------------------------------------------------- */

function getBalanceAfter(request) {
    return request.balanceBefore - request.days;
}

function renderBalance(request) {
    const balanceAfter = getBalanceAfter(request);

    if (balanceAfter < 0) {
        return `
            <span class="balance balance-negative">
                Exceeds balance
            </span>
        `;
    }

    return `
        <span class="balance balance-positive">
            ${balanceAfter} ${balanceAfter === 1 ? "day" : "days"} left
        </span>
    `;
}

function renderPendingRequests() {
    elements.pendingCount.textContent =
        `${state.pending.length} pending`;

    if (state.pending.length === 0) {
        elements.pendingBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    No pending leave requests.
                </td>
            </tr>
        `;

        return;
    }

    elements.pendingBody.innerHTML = state.pending.map(request => `
        <tr>
            <td>
                <span class="employee-name">
                    ${escapeHtml(request.employeeName)}
                </span>

                <span class="employee-department">
                    ${escapeHtml(request.department)}
                </span>
            </td>

            <td>
                <span class="leave-type">
                    ${escapeHtml(getLeaveTypeLabel(request.leaveType))}
                </span>
            </td>

            <td>
                <span class="date-range">
                    ${escapeHtml(formatDateRange(
                        request.startDate,
                        request.endDate
                    ))}
                </span>
            </td>

            <td>${request.days}</td>

            <td class="note-cell">
                ${escapeHtml(request.note || "—")}
            </td>

            <td>${renderBalance(request)}</td>

            <td>
                <div class="action-buttons">
                    <button
                        type="button"
                        class="button-approve"
                        data-action="approve"
                        data-id="${request.id}"
                    >
                        Approve
                    </button>

                    <button
                        type="button"
                        class="button-reject"
                        data-action="reject"
                        data-id="${request.id}"
                    >
                        Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

/* ---------------------------------------------------------
   5. History search, filters, and pagination
--------------------------------------------------------- */

function getFilteredHistory() {
    const searchTerm = elements.search.value.trim().toLowerCase();
    const status = elements.statusFilter.value;
    const leaveType = elements.typeFilter.value;

    return state.history.filter(request => {
        const matchesSearch =
            request.employeeName.toLowerCase().includes(searchTerm) ||
            request.department.toLowerCase().includes(searchTerm);

        const matchesStatus =
            status === "all" || request.status === status;

        const matchesType =
            leaveType === "all" || request.leaveType === leaveType;

        return matchesSearch && matchesStatus && matchesType;
    });
}

function renderHistory() {
    const filteredHistory = getFilteredHistory();
    const totalItems = filteredHistory.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    state.currentPage = Math.min(state.currentPage, totalPages);

    const startIndex = (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredHistory.slice(
        startIndex,
        startIndex + PAGE_SIZE
    );

    if (totalItems === 0) {
        elements.historyBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    No leave requests match your filters.
                </td>
            </tr>
        `;
    } else {
        elements.historyBody.innerHTML = pageItems.map(request => `
            <tr>
                <td>
                    <span class="employee-name">
                        ${escapeHtml(request.employeeName)}
                    </span>

                    <span class="employee-department">
                        ${escapeHtml(request.department)}
                    </span>
                </td>

                <td>
                    <span class="leave-type">
                        ${escapeHtml(getLeaveTypeLabel(request.leaveType))}
                    </span>
                </td>

                <td>
                    <span class="date-range">
                        ${escapeHtml(formatDateRange(
                            request.startDate,
                            request.endDate
                        ))}
                    </span>
                </td>

                <td>${request.days}</td>

                <td>
                    <span class="status-badge status-${escapeHtml(request.status)}">
                        ${escapeHtml(getStatusLabel(request.status))}
                    </span>
                </td>

                <td>${escapeHtml(request.reviewedBy || "—")}</td>

                <td class="comment-cell">
                    ${escapeHtml(request.comment || "—")}
                </td>
            </tr>
        `).join("");
    }

    const firstItem = totalItems === 0 ? 0 : startIndex + 1;
    const lastItem = Math.min(startIndex + PAGE_SIZE, totalItems);

    elements.paginationInfo.textContent =
        `Showing ${firstItem}–${lastItem} of ${totalItems} requests`;

    elements.previousPage.disabled = state.currentPage <= 1;
    elements.nextPage.disabled = state.currentPage >= totalPages;
}

/* ---------------------------------------------------------
   6. Approve/reject dialog
--------------------------------------------------------- */

function openReviewDialog(requestId, action) {
    const request = state.pending.find(item => item.id === requestId);

    if (!request) {
        showToast("This request is no longer pending.");
        return;
    }

    state.reviewRequestId = requestId;
    state.reviewAction = action;

    const isApproval = action === "approve";

    elements.dialogTitle.textContent = isApproval
        ? "Approve leave request"
        : "Reject leave request";

    elements.dialogDescription.textContent = isApproval
        ? "Confirm that you want to approve this request."
        : "Confirm that you want to reject this request.";

    elements.dialogEmployee.textContent =
        `${request.employeeName} · ${getLeaveTypeLabel(request.leaveType)} · ` +
        `${formatDateRange(request.startDate, request.endDate)}`;

    elements.confirmReview.textContent = isApproval
        ? "Approve request"
        : "Reject request";

    elements.confirmReview.className = isApproval
        ? "button-primary"
        : "button-reject";

    elements.reviewComment.value = "";
    elements.dialogError.hidden = true;

    elements.dialog.showModal();
}

function closeReviewDialog() {
    elements.dialog.close();

    state.reviewRequestId = null;
    state.reviewAction = null;
}

async function submitReview(event) {
    event.preventDefault();

    const request = state.pending.find(
        item => item.id === state.reviewRequestId
    );

    if (!request || !state.reviewAction) {
        closeReviewDialog();
        showToast("This request is no longer available.");
        return;
    }

    const action = state.reviewAction;
    const comment = elements.reviewComment.value.trim();

    elements.confirmReview.disabled = true;

    try {
        if (API.useMock) {
            /*
             * Mock behavior only.
             * This change disappears when the page reloads.
             */
            const updatedRequest = {
                ...request,
                status: action === "approve" ? "approved" : "rejected",
                reviewedBy: CURRENT_REVIEWER,
                comment: comment || (
                    action === "approve"
                        ? "Request approved."
                        : "Request rejected."
                )
            };

            state.pending = state.pending.filter(
                item => item.id !== request.id
            );

            state.history.unshift(updatedRequest);
        } else {
            const response = await fetch(
                `${API.base}/leave-requests/${request.id}/${action}`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ comment })
                }
            );

            if (!response.ok) {
                throw new Error(
                    "The server could not process this decision."
                );
            }

            /*
             * Reload from Laravel so the server remains the source of truth.
             */
            closeReviewDialog();
            await loadRequests();

            showToast(
                action === "approve"
                    ? "Leave request approved."
                    : "Leave request rejected."
            );

            return;
        }

        closeReviewDialog();
        renderPendingRequests();
        renderHistory();

        showToast(
            action === "approve"
                ? "Leave request approved."
                : "Leave request rejected."
        );
    } catch (error) {
        console.error(error);

        elements.dialogError.textContent =
            error.message || "Unable to process this request.";

        elements.dialogError.hidden = false;
    } finally {
        elements.confirmReview.disabled = false;
    }
}

/* ---------------------------------------------------------
   7. Toast notifications
--------------------------------------------------------- */

function showToast(message) {
    clearTimeout(toastTimeout);

    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 3000);
}

/* ---------------------------------------------------------
   8. Event listeners
--------------------------------------------------------- */

function setupEventListeners() {
    elements.pendingBody.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const requestId = Number(button.dataset.id);
        const action = button.dataset.action;

        if (!["approve", "reject"].includes(action)) {
            return;
        }

        openReviewDialog(requestId, action);
    });

    elements.search.addEventListener("input", () => {
        state.currentPage = 1;
        renderHistory();
    });

    elements.statusFilter.addEventListener("change", () => {
        state.currentPage = 1;
        renderHistory();
    });

    elements.typeFilter.addEventListener("change", () => {
        state.currentPage = 1;
        renderHistory();
    });

    elements.previousPage.addEventListener("click", () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderHistory();
        }
    });

    elements.nextPage.addEventListener("click", () => {
        const totalPages = Math.max(
            1,
            Math.ceil(getFilteredHistory().length / PAGE_SIZE)
        );

        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderHistory();
        }
    });

    elements.reviewForm.addEventListener("submit", submitReview);
    elements.closeDialog.addEventListener("click", closeReviewDialog);
    elements.cancelReview.addEventListener("click", closeReviewDialog);
}

/* ---------------------------------------------------------
   9. Start page
--------------------------------------------------------- */

function initializePage() {
    setupEventListeners();
    loadRequests();
}

initializePage();
