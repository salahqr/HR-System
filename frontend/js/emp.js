
/* ========================================
   1. API CONFIGURATION
======================================== */

const API_BASE = "http://127.0.0.1:8000";

const API = {
    dashboard: "/api/employee/dashboard",
    logout: "/logout",
    latestPayslip: "/api/employee/payslips/latest/pdf"
};


/* ========================================
   2. DOM HELPERS
======================================== */

const $ = (selector) => document.querySelector(selector);

const elements = {
    greeting: $("#greeting"),
    userName: $("#user-name"),
    avatar: $("#user-avatar"),
    currentDate: $("#current-date"),
    error: $("#dashboard-error"),
    attendancePeriod: $("#attendance-period"),
    pageDialog: $("#page-dialog"),
    pageFrame: $("#page-frame"),
    dialogTitle: $("#dialog-title"),
    toast: $("#toast")
};

let dashboardData = null;
let toastTimeout;


/* ========================================
   3. GENERAL HELPERS
======================================== */

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const characters = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return characters[character];
    });
}

function formatMoney(value, currency = "JOD") {
    if (value === null || value === undefined || value === "") {
        return "--";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "--";
    }

    return new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(value) {
    if (!value) return "--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function getInitials(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 3500);
}

function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
}

function clearError() {
    elements.error.textContent = "";
    elements.error.hidden = true;
}

function formatTime(value) {
    if (!value) return "--";

    // Accept a Laravel time such as "08:52:00".
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);

    if (!match) return escapeHtml(value);

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
        return "--";
    }

    return new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date(2000, 0, 1, hours, minutes));
}


/* ========================================
   4. API REQUEST HELPER
======================================== */

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
            const data = await response.json();
            message = data.message || message;
        } catch {
            // The server might return an HTML error page.
        }

        throw new Error(message);
    }

    return response;
}

async function getJson(path) {
    const response = await apiRequest(path);
    return response.json();
}


/* ========================================
   5. RENDER USER PROFILE
======================================== */

function renderUser(user = {}) {
    const name = user.name || "Employee";

    elements.userName.textContent = name;
    elements.avatar.textContent = getInitials(name);
    elements.greeting.textContent = `Welcome back, ${name}`;

    elements.currentDate.textContent =
        new Intl.DateTimeFormat("en", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(new Date());
}


/* ========================================
   6. RENDER TODAY'S ATTENDANCE
======================================== */

function renderTodayAttendance(attendance = {}) {
    const status = attendance.status || "Not recorded";

    $("#attendance-status").textContent = status;
    $("#attendance-status").className =
        `status-badge ${getStatusClass(status)}`;

    $("#check-in-time").textContent =
        formatTime(attendance.check_in);

    $("#attendance-note").textContent =
        attendance.note || "Attendance information";
}


/* ========================================
   7. RENDER ATTENDANCE SUMMARY
======================================== */

function renderAttendanceSummary(attendance = {}) {
    const counts = attendance.counts || {};

    const categories = [
        { key: "present", label: "Present", color: "present" },
        { key: "late", label: "Late", color: "late" },
        { key: "absent", label: "Absent", color: "absent" }
    ];

    const values = categories.map(item => ({
        ...item,
        count: Math.max(0, Number(counts[item.key]) || 0)
    }));

    const total = Number.isFinite(Number(attendance.working_days))
        ? Math.max(0, Number(attendance.working_days))
        : values.reduce((sum, item) => sum + item.count, 0);

    $("#attendance-bar").innerHTML = values.map(item => {
        const percentage = total > 0
            ? (item.count / total) * 100
            : 0;

        return `
            <div
                class="bar-segment bar-${item.color}"
                style="width: ${percentage}%"
                title="${item.label}: ${item.count} days">
            </div>
        `;
    }).join("");

    $("#attendance-legend").innerHTML = values.map(item => {
        const percentage = total > 0
            ? ((item.count / total) * 100).toFixed(1)
            : "0.0";

        return `
            <div class="legend-row">
                <div class="legend-name">
                    <span class="legend-dot bar-${item.color}"></span>
                    ${item.label}
                </div>

                <div class="legend-value">
                    ${item.count} days
                    <span>(${percentage}%)</span>
                </div>
            </div>
        `;
    }).join("");

    $("#working-days").textContent = `${total} days`;
}


/* ========================================
   8. RENDER LEAVE BALANCE
======================================== */

/*
Expected API format:

leave_balance: {
    medical_allowance: 10,
    medical_used: 2,
    normal_allowance: 25,
    normal_used: 5
}

These values come from the authenticated user's database record.
*/

function renderLeaveBalance(balance = {}) {
    const categories = [
        {
            key: "medical",
            label: "Medical",
            allowance: Number(balance.medical_allowance) || 0,
            used: Number(balance.medical_used) || 0
        },
        {
            key: "normal",
            label: "Normal",
            allowance: Number(balance.normal_allowance) || 0,
            used: Number(balance.normal_used) || 0
        }
    ];

    let totalAllowance = 0;
    let totalUsed = 0;

    $("#leave-breakdown").innerHTML = categories.map(item => {
        const remaining = Math.max(0, item.allowance - item.used);

        const percentage = item.allowance > 0
            ? Math.min(100, (item.used / item.allowance) * 100)
            : 0;

        totalAllowance += item.allowance;
        totalUsed += item.used;

        return `
            <div class="leave-item">
                <div class="leave-label-row">
                    <strong>${item.label}</strong>

                    <span class="leave-numbers">
                        <strong>${item.used}</strong> used ·
                        <strong>${remaining}</strong> remaining
                    </span>
                </div>

                <div
                    class="progress-track"
                    role="progressbar"
                    aria-label="${item.label} leave used"
                    aria-valuenow="${percentage}"
                    aria-valuemin="0"
                    aria-valuemax="100">

                    <div
                        class="progress-fill"
                        style="width: ${percentage}%">
                    </div>
                </div>
            </div>
        `;
    }).join("");

    $("#leave-remaining").textContent =
        Math.max(0, totalAllowance - totalUsed);

    $("#leave-total").textContent =
        `${totalAllowance} days (${totalUsed} used)`;
}


/* ========================================
   9. RENDER PROJECTS
======================================== */

function renderProjects(projects = []) {
    const activeProjects = projects.filter(project =>
        String(project.status || "").toLowerCase() === "active"
    );

    $("#active-project-count").textContent = activeProjects.length;
    $("#project-count-badge").textContent =
        `${activeProjects.length} active`;

    if (activeProjects.length === 0) {
        $("#project-list").innerHTML =
            '<p class="muted">No active projects assigned.</p>';
        return;
    }

    $("#project-list").innerHTML = activeProjects.map(project => {
        const progress = Math.min(
            100,
            Math.max(0, Number(project.progress) || 0)
        );

        const dueDate = project.due_date
            ? `Due ${formatDate(project.due_date)}`
            : "No due date";

        const overdue = project.due_date &&
            new Date(project.due_date) < new Date() &&
            progress < 100;

        return `
            <div class="project-item">
                <div class="project-title-row">
                    <span class="project-title">
                        ${escapeHtml(project.name)}
                    </span>

                    ${overdue
                        ? '<span class="request-status status-overdue">Overdue</span>'
                        : `<span class="project-percent">${progress}%</span>`
                    }
                </div>

                <div
                    class="progress-track"
                    role="progressbar"
                    aria-label="${escapeHtml(project.name)} progress"
                    aria-valuenow="${progress}"
                    aria-valuemin="0"
                    aria-valuemax="100">

                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>

                <p class="project-due">${dueDate}</p>
            </div>
        `;
    }).join("");
}


/* ========================================
   10. RENDER LATEST PAYSLIP
======================================== */

function renderPayslip(payslip) {
    const container = $("#latest-payslip");

    if (!payslip) {
        container.innerHTML =
            '<p class="muted">No payslip is available.</p>';
        return;
    }

    const currency = payslip.currency || "JOD";

    container.innerHTML = `
        <div class="payslip-box">
            <div class="payslip-top">
                <span class="payslip-period">
                    ${escapeHtml(payslip.period_label || payslip.period || "Latest period")}
                </span>

                <span class="net-pay">
                    ${formatMoney(payslip.net_pay, currency)}
                    <small>net pay</small>
                </span>
            </div>

            <div class="payslip-details">
                <span>
                    Salary:
                    <strong>${formatMoney(payslip.salary, currency)}</strong>
                </span>

                <span>
                    Absence deductions:
                    <strong>${formatMoney(payslip.absence_deductions, currency)}</strong>
                </span>

                <span>
                    Strike deductions:
                    <strong>${formatMoney(payslip.strike_deductions, currency)}</strong>
                </span>
            </div>
        </div>
    `;
}


/* ========================================
   11. RENDER LEAVE REQUESTS
======================================== */

function getStatusClass(status) {
    const normalized = String(status || "").toLowerCase();

    const classes = {
        present: "status-present",
        active: "status-active",
        approved: "status-approved",
        late: "status-late",
        pending: "status-pending",
        absent: "status-absent",
        rejected: "status-rejected",
        overdue: "status-overdue"
    };

    return classes[normalized] || "status-unknown";
}

function renderLeaveRequests(requests = []) {
    const container = $("#leave-request-list");

    if (requests.length === 0) {
        container.innerHTML =
            '<p class="muted">You have no recent leave requests.</p>';
        return;
    }

    container.innerHTML = requests.map(request => {
        const start = formatDate(request.start_date);
        const end = formatDate(request.end_date);

        const dates = request.start_date === request.end_date
            ? start
            : `${start} – ${end}`;

        const days = request.days !== null &&
            request.days !== undefined
            ? ` (${escapeHtml(request.days)} days)`
            : "";

        const status = request.status || "Pending";

        return `
            <div class="request-item">
                <div>
                    <span class="request-type">
                        ${escapeHtml(request.type || "Leave")}
                    </span>

                    <p class="request-dates">${dates}${days}</p>
                </div>

                <span class="request-status ${getStatusClass(status)}">
                    ${escapeHtml(status)}
                </span>
            </div>
        `;
    }).join("");
}


/* ========================================
   12. LOAD DASHBOARD FROM LARAVEL
======================================== */

async function loadDashboard() {
    clearError();

    try {
        const period = elements.attendancePeriod.value;

        const data = await getJson(
            `${API.dashboard}?period=${encodeURIComponent(period)}`
        );

        dashboardData = data;

        renderUser(data.user || {});
        renderTodayAttendance(data.attendance?.today || {});
        renderAttendanceSummary(data.attendance?.summary || {});
        renderLeaveBalance(data.leave_balance || {});
        renderProjects(data.projects || []);
        renderPayslip(data.latest_payslip || null);
        renderLeaveRequests(data.leave_requests || []);

        $("#open-strikes").textContent =
            Number(data.open_strikes) || 0;

    } catch (error) {
        console.error("Dashboard request failed:", error);

        showError(
            `${error.message}. Check your Laravel API, authentication, and route configuration.`
        );
    }
}


/* ========================================
   13. OPEN PAGES IN THE IFRAME
======================================== */

function openPage(path, title) {
    let url;

    try {
        url = new URL(path, window.location.origin);
    } catch {
        showToast("Invalid page URL.");
        return;
    }

    /*
     * Only allow same-origin pages inside the iframe.
     * This prevents links from opening arbitrary websites
     * inside the dashboard.
     */
    if (url.origin !== window.location.origin) {
        showToast(
            "The iframe page must be hosted on the same origin as this dashboard."
        );
        return;
    }

    elements.dialogTitle.textContent = title || "PresenceHR";
    elements.pageFrame.src = url.href;

    if (!elements.pageDialog.open) {
        elements.pageDialog.showModal();
    }
}


document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-page]");

    if (!button) return;

    const path = button.dataset.page;

    const pages = {
        "/employee/attendance": "attendance.html",
        "/employee/leaves": "leaves.html",
        "/employee/leaves/create": "leave-request.html",
        "/employee/strikes": "strikes.html",
        "/employee/projects": "projects.html",
        "/employee/profile": "profile.html",
        "/employee/payslips": "payslips.html"
    };

    if (pages[path]) {
        window.location.href = pages[path];
    }
});

$("#close-dialog").addEventListener("click", () => {
    elements.pageDialog.close();
});

elements.pageDialog.addEventListener("close", () => {
    elements.pageFrame.src = "about:blank";
});


/* ========================================
   14. DOWNLOAD PAYSLIP PDF
======================================== */

$("#download-payslip").addEventListener("click", async event => {
    const button = event.currentTarget;
    const originalText = button.innerHTML;

    button.disabled = true;
    button.textContent = "Downloading...";

    try {
        const response = await apiRequest(API.latestPayslip);
        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("The payslip PDF is empty.");
        }

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = "payslip.pdf";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(objectUrl);

    } catch (error) {
        console.error("Payslip download failed:", error);
        showToast(error.message || "Could not download the payslip.");
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
});


/* ========================================
   15. LOG OUT
======================================== */

$("#logout-button").addEventListener("click", async () => {
    try {
        await apiRequest(API.logout, {
            method: "POST"
        });

        window.location.href = "/login";

    } catch (error) {
        console.error("Logout failed:", error);
        showToast("Could not log out. Check your session and CSRF settings.");
    }
});


/* ========================================
   16. CHANGE ATTENDANCE PERIOD
======================================== */

elements.attendancePeriod.addEventListener("change", () => {
    loadDashboard();
});


/* ========================================
   17. START THE DASHBOARD
======================================== */

loadDashboard();
