
"use strict";

/*
 * Attendance page
 *
 * Mock mode:
 *   Uses local JavaScript data for testing.
 *
 * API mode:
 *   Set useMock to false and configure apiUrl.
 *
 * Expected API:
 *   GET  /api/attendance?date=&department_id=&search=&status=&page=
 *   POST /api/attendance
 *   PUT  /api/attendance/{id}
 *
 * The API should return:
 * {
 *   data: [],
 *   total: 0,
 *   page: 1,
 *   per_page: 10
 * }
 */

const API = {
    useMock: true,
    apiUrl: "/api/attendance",
    perPage: 10
};

const employees = [
    {
        id: 1,
        employeeId: "EMP-001",
        name: "Yousef Nasser",
        department: "Engineering",
        departmentId: 1
    },
    {
        id: 2,
        employeeId: "EMP-002",
        name: "Maya Saleh",
        department: "Human Resources",
        departmentId: 2
    },
    {
        id: 3,
        employeeId: "EMP-003",
        name: "Ahmad Khalil",
        department: "Finance",
        departmentId: 3
    },
    {
        id: 4,
        employeeId: "EMP-004",
        name: "Lina Haddad",
        department: "Human Resources",
        departmentId: 2
    },
    {
        id: 5,
        employeeId: "EMP-005",
        name: "Omar Hassan",
        department: "Engineering",
        departmentId: 1
    },
    {
        id: 6,
        employeeId: "EMP-006",
        name: "Rana Ibrahim",
        department: "Marketing",
        departmentId: 4
    },
    {
        id: 7,
        employeeId: "EMP-007",
        name: "Khaled Samir",
        department: "Finance",
        departmentId: 3
    },
    {
        id: 8,
        employeeId: "EMP-008",
        name: "Sara Ali",
        department: "Human Resources",
        departmentId: 2
    }
];

const today = getLocalDate();

let attendanceRecords = [
    {
        id: 101,
        employeeId: 1,
        date: today,
        checkIn: "08:54",
        checkOut: "17:02",
        status: "On time"
    },
    {
        id: 102,
        employeeId: 2,
        date: today,
        checkIn: "09:18",
        checkOut: "17:05",
        status: "Late"
    },
    {
        id: 103,
        employeeId: 3,
        date: today,
        checkIn: "08:48",
        checkOut: "16:55",
        status: "On time"
    },
    {
        id: 104,
        employeeId: 4,
        date: today,
        checkIn: "09:25",
        checkOut: "",
        status: "Late"
    },
    {
        id: 105,
        employeeId: 5,
        date: today,
        checkIn: "",
        checkOut: "",
        status: "Absent"
    },
    {
        id: 106,
        employeeId: 6,
        date: today,
        checkIn: "08:57",
        checkOut: "17:10",
        status: "On time"
    },
    {
        id: 107,
        employeeId: 7,
        date: today,
        checkIn: "",
        checkOut: "",
        status: "On leave"
    },
    {
        id: 108,
        employeeId: 8,
        date: today,
        checkIn: "08:51",
        checkOut: "17:00",
        status: "On time"
    }
];

const state = {
    date: today,
    departmentId: "",
    search: "",
    status: "",
    page: 1,
    records: [],
    total: 0
};

const elements = {
    date: document.getElementById("attendance-date"),
    department: document.getElementById("department-filter"),
    search: document.getElementById("employee-search"),
    status: document.getElementById("status-filter"),
    reset: document.getElementById("reset-filters"),

    lateCount: document.getElementById("late-count"),
    absenceCount: document.getElementById("absence-count"),
    onTimeRate: document.getElementById("on-time-rate"),

    tableBody: document.getElementById("attendance-table-body"),
    recordCount: document.getElementById("record-count"),
    paginationInfo: document.getElementById("pagination-info"),
    pageNumber: document.getElementById("page-number"),
    previousPage: document.getElementById("previous-page"),
    nextPage: document.getElementById("next-page"),

    manualCheckIn: document.getElementById("manual-check-in"),
    dialog: document.getElementById("attendance-dialog"),
    form: document.getElementById("attendance-form"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogDescription: document.getElementById("dialog-description"),
    recordId: document.getElementById("record-id"),
    formEmployee: document.getElementById("form-employee"),
    formDate: document.getElementById("form-date"),
    formCheckIn: document.getElementById("form-check-in"),
    formCheckOut: document.getElementById("form-check-out"),
    formStatus: document.getElementById("form-status"),
    formError: document.getElementById("form-error"),
    saveRecord: document.getElementById("save-record"),

    closeDialog: document.getElementById("close-dialog"),
    cancelDialog: document.getElementById("cancel-dialog"),
    toast: document.getElementById("toast")
};

let toastTimeout;

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

function getEmployee(employeeId) {
    return employees.find(employee => employee.id === Number(employeeId));
}

function getInitials(name) {
    return String(name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("");
}

function getWorkingHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) {
        return "—";
    }

    const [inHour, inMinute] = checkIn.split(":").map(Number);
    const [outHour, outMinute] = checkOut.split(":").map(Number);

    const start = inHour * 60 + inMinute;
    const end = outHour * 60 + outMinute;
    const minutes = end - start;

    if (minutes <= 0) {
        return "—";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function getStatusClass(status) {
    const classes = {
        "On time": "status-on-time",
        "Late": "status-late",
        "Absent": "status-absent",
        "On leave": "status-on-leave"
    };

    return classes[status] || "";
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 3000);
}

function populateDepartments() {
    const departments = [
        ...new Set(employees.map(employee => employee.department))
    ].sort();

    elements.department.innerHTML = `
        <option value="">All departments</option>
        ${departments.map(department => `
            <option value="${escapeHtml(department)}">
                ${escapeHtml(department)}
            </option>
        `).join("")}
    `;
}

function populateEmployeeOptions() {
    elements.formEmployee.innerHTML = employees.map(employee => `
        <option value="${employee.id}">
            ${escapeHtml(employee.name)} (${escapeHtml(employee.employeeId)})
        </option>
    `).join("");
}

function getFilteredRecords() {
    const search = state.search.trim().toLowerCase();

    return attendanceRecords.filter(record => {
        const employee = getEmployee(record.employeeId);

        if (!employee) {
            return false;
        }

        if (state.date && record.date !== state.date) {
            return false;
        }

        if (
            state.departmentId &&
            employee.department !== state.departmentId
        ) {
            return false;
        }

        if (
            search &&
            !employee.name.toLowerCase().includes(search) &&
            !employee.employeeId.toLowerCase().includes(search)
        ) {
            return false;
        }

        if (state.status && record.status !== state.status) {
            return false;
        }

        return true;
    });
}

async function loadAttendance() {
    try {
        if (API.useMock) {
            const records = getFilteredRecords();
            const start = (state.page - 1) * API.perPage;

            state.records = records.slice(start, start + API.perPage);
            state.total = records.length;

            renderPage(records);
            return;
        }

        const params = new URLSearchParams({
            date: state.date,
            department_id: state.departmentId,
            search: state.search,
            status: state.status,
            page: String(state.page),
            per_page: String(API.perPage)
        });

        const response = await fetch(`${API.apiUrl}?${params}`, {
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Unable to load attendance (${response.status}).`);
        }

        const result = await response.json();

        state.records = result.data ?? [];
        state.total = Number(result.total ?? state.records.length);

        renderPage();
    } catch (error) {
        console.error(error);

        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Could not load attendance records. Please try again.
                </td>
            </tr>
        `;

        showToast(error.message || "Could not load attendance.");
    }
}

function renderPage(allFilteredRecords = null) {
    const records = state.records;
    const filteredRecords = allFilteredRecords ?? records;

    renderStatistics(filteredRecords);
    renderTable(records);
    renderPagination();
}

function renderStatistics(records) {
    const late = records.filter(record => record.status === "Late").length;
    const absent = records.filter(record => record.status === "Absent").length;
    const present = records.filter(record =>
        record.status === "On time" || record.status === "Late"
    );

    const onTime = records.filter(record => record.status === "On time").length;
    const rate = present.length
        ? Math.round((onTime / present.length) * 100)
        : 0;

    elements.lateCount.textContent = late;
    elements.absenceCount.textContent = absent;
    elements.onTimeRate.textContent = `${rate}%`;
}

function renderTable(records) {
    if (!records.length) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No attendance records match your filters.
                </td>
            </tr>
        `;

        return;
    }

    elements.tableBody.innerHTML = records.map(record => {
        const employee = getEmployee(record.employeeId) || {
            name: record.employee_name || "Unknown employee",
            employeeId: record.employee_number || "—",
            department: record.department || "—"
        };

        const workingHours = getWorkingHours(
            record.checkIn || "",
            record.checkOut || ""
        );

        return `
            <tr>
                <td>
                    <div class="employee-cell">
                        <div class="avatar">
                            ${escapeHtml(getInitials(employee.name))}
                        </div>
                        <div>
                            <div class="employee-name">
                                ${escapeHtml(employee.name)}
                            </div>
                            <div class="employee-id">
                                ${escapeHtml(employee.employeeId)}
                            </div>
                        </div>
                    </div>
                </td>

                <td>${escapeHtml(employee.department)}</td>
                <td>${escapeHtml(record.date)}</td>
                <td>${escapeHtml(record.checkIn || "—")}</td>
                <td>${escapeHtml(record.checkOut || "—")}</td>
                <td>${escapeHtml(workingHours)}</td>

                <td>
                    <span class="status ${getStatusClass(record.status)}">
                        ${escapeHtml(record.status)}
                    </span>
                </td>

                <td>
                    <button
                        class="correct-button"
                        type="button"
                        data-action="correct"
                        data-id="${escapeHtml(record.id)}"
                    >
                        Correct
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / API.perPage));
    const start = state.total === 0
        ? 0
        : (state.page - 1) * API.perPage + 1;

    const end = Math.min(state.page * API.perPage, state.total);

    elements.recordCount.textContent =
        `${state.total} record${state.total === 1 ? "" : "s"}`;

    elements.paginationInfo.textContent =
        `Showing ${start}-${end} of ${state.total} records`;

    elements.pageNumber.textContent = `Page ${state.page} of ${totalPages}`;

    elements.previousPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= totalPages;
}

function resetToFirstPage() {
    state.page = 1;
    loadAttendance();
}

function openCreateDialog() {
    elements.form.reset();

    elements.recordId.value = "";
    elements.formDate.value = state.date || getLocalDate();
    elements.formStatus.value = "On time";

    elements.dialogTitle.textContent = "Manual check-in";
    elements.dialogDescription.textContent =
        "Create an attendance record for an employee.";
    elements.saveRecord.textContent = "Save record";
    elements.formError.textContent = "";

    elements.dialog.showModal();
}

function openCorrectionDialog(recordId) {
    const record = attendanceRecords.find(
        item => String(item.id) === String(recordId)
    );

    if (!record) {
        showToast("Record not found.");
        return;
    }

    elements.form.reset();

    elements.recordId.value = record.id;
    elements.formEmployee.value = String(record.employeeId);
    elements.formDate.value = record.date;
    elements.formCheckIn.value = record.checkIn || "";
    elements.formCheckOut.value = record.checkOut || "";
    elements.formStatus.value = record.status;

    elements.dialogTitle.textContent = "Correct attendance";
    elements.dialogDescription.textContent =
        "Update the attendance record and save your changes.";
    elements.saveRecord.textContent = "Save correction";
    elements.formError.textContent = "";

    elements.dialog.showModal();
}

function closeDialog() {
    elements.dialog.close();
    elements.formError.textContent = "";
}

async function saveAttendance(event) {
    event.preventDefault();

    const recordId = elements.recordId.value;
    const employeeId = Number(elements.formEmployee.value);
    const date = elements.formDate.value;
    const checkIn = elements.formCheckIn.value;
    const checkOut = elements.formCheckOut.value;
    const status = elements.formStatus.value;

    if (!date || !employeeId || !status) {
        elements.formError.textContent =
            "Please complete all required fields.";
        return;
    }

    if (
        status === "Absent" || status === "On leave"
    ) {
        if (checkIn || checkOut) {
            elements.formError.textContent =
                "Absent and on-leave records cannot have check-in or check-out times.";
            return;
        }
    }

    if (checkIn && checkOut && checkOut <= checkIn) {
        elements.formError.textContent =
            "Check-out must be later than check-in.";
        return;
    }

    const payload = {
        employee_id: employeeId,
        date,
        check_in: checkIn || null,
        check_out: checkOut || null,
        status
    };

    elements.saveRecord.disabled = true;
    elements.saveRecord.textContent = "Saving...";

    try {
        if (API.useMock) {
            if (recordId) {
                const index = attendanceRecords.findIndex(
                    record => String(record.id) === String(recordId)
                );

                if (index === -1) {
                    throw new Error("Attendance record was not found.");
                }

                attendanceRecords[index] = {
                    ...attendanceRecords[index],
                    employeeId,
                    date,
                    checkIn,
                    checkOut,
                    status
                };
            } else {
                const duplicate = attendanceRecords.some(record =>
                    record.employeeId === employeeId &&
                    record.date === date
                );

                if (duplicate) {
                    throw new Error(
                        "This employee already has a record for that date."
                    );
                }

                attendanceRecords.push({
                    id: Date.now(),
                    employeeId,
                    date,
                    checkIn,
                    checkOut,
                    status
                });
            }
        } else {
            const url = recordId
                ? `${API.apiUrl}/${encodeURIComponent(recordId)}`
                : API.apiUrl;

            const response = await fetch(url, {
                method: recordId ? "PUT" : "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));

                throw new Error(
                    result.message || "Unable to save the attendance record."
                );
            }
        }

        state.date = date;
        elements.date.value = date;

        closeDialog();
        showToast(recordId ? "Attendance corrected." : "Check-in recorded.");

        await loadAttendance();
    } catch (error) {
        elements.formError.textContent =
            error.message || "Something went wrong.";
    } finally {
        elements.saveRecord.disabled = false;
        elements.saveRecord.textContent =
            recordId ? "Save correction" : "Save record";
    }
}

function bindEvents() {
    elements.date.addEventListener("change", () => {
        state.date = elements.date.value;
        resetToFirstPage();
    });

    elements.department.addEventListener("change", () => {
        state.departmentId = elements.department.value;
        resetToFirstPage();
    });

    elements.search.addEventListener("input", () => {
        state.search = elements.search.value;
        resetToFirstPage();
    });

    elements.status.addEventListener("change", () => {
        state.status = elements.status.value;
        resetToFirstPage();
    });

    elements.reset.addEventListener("click", () => {
        elements.date.value = getLocalDate();
        elements.department.value = "";
        elements.search.value = "";
        elements.status.value = "";

        state.date = getLocalDate();
        state.departmentId = "";
        state.search = "";
        state.status = "";
        state.page = 1;

        loadAttendance();
    });

    elements.previousPage.addEventListener("click", () => {
        if (state.page > 1) {
            state.page--;
            loadAttendance();
        }
    });

    elements.nextPage.addEventListener("click", () => {
        const totalPages = Math.ceil(state.total / API.perPage);

        if (state.page < totalPages) {
            state.page++;
            loadAttendance();
        }
    });

    elements.manualCheckIn.addEventListener("click", openCreateDialog);

    elements.tableBody.addEventListener("click", event => {
        const button = event.target.closest('[data-action="correct"]');

        if (button) {
            openCorrectionDialog(button.dataset.id);
        }
    });

    elements.closeDialog.addEventListener("click", closeDialog);
    elements.cancelDialog.addEventListener("click", closeDialog);
    elements.form.addEventListener("submit", saveAttendance);
}

async function init() {
    elements.date.value = state.date;

    populateDepartments();
    populateEmployeeOptions();
    bindEvents();

    await loadAttendance();
}

init();
