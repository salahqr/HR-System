
"use strict";

/*
 * PresenceHR Reports
 *
 * This page currently uses generated mock data.
 * Set API.useMock to false when your Laravel endpoints are ready.
 *
 * Suggested API:
 * GET /api/reports?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&department_id=all
 */

const API = {
    useMock: true,
    base: "/api"
};

const DEPARTMENTS = [
    { id: 1, name: "People & Operations", employees: 6, openStrikes: 0 },
    { id: 2, name: "Design & Product", employees: 8, openStrikes: 0 },
    { id: 3, name: "Engineering", employees: 18, openStrikes: 2 },
    { id: 4, name: "Marketing", employees: 7, openStrikes: 0 },
    { id: 5, name: "Finance & Accounting", employees: 5, openStrikes: 1 },
    { id: 6, name: "Customer Success", employees: 4, openStrikes: 0 }
];

const LEAVE_TYPES = [
    { id: "normal", label: "Normal", color: "#3968AC" },
    { id: "medical", label: "Medical", color: "#0F766E" },
    { id: "day_off", label: "Day off", color: "#64748B" }
];

const PROJECT_STATUSES = [
    { id: "in_progress", label: "In progress", count: 6, colorClass: "project-fill" },
    { id: "completed", label: "Completed", count: 9, colorClass: "project-fill completed" },
    { id: "not_started", label: "Not started", count: 2, colorClass: "project-fill not-started" },
    { id: "on_hold", label: "On hold", count: 1, colorClass: "project-fill on-hold" },
    { id: "cancelled", label: "Cancelled", count: 1, colorClass: "project-fill cancelled" }
];

/*
 * Sample monthly payroll totals.
 * These are illustrative amounts, not real payroll records.
 * Change the currency to match your backend data if needed.
 */
const PAYROLL_DATA = [
    { month: "May", amount: 235900 },
    { month: "Jun", amount: 239800 },
    { month: "Jul", amount: 242100 },
    { month: "Aug", amount: 243200 },
    { month: "Sep", amount: 248650 },
    { month: "Oct", amount: 251400 }
];

const state = {
    startDate: "",
    endDate: "",
    departmentId: "all",
    attendance: [],
    leaves: [],
    departments: DEPARTMENTS,
    projects: PROJECT_STATUSES,
    payroll: PAYROLL_DATA
};

const elements = {
    startDate: document.getElementById("start-date"),
    endDate: document.getElementById("end-date"),
    departmentFilter: document.getElementById("department-filter"),
    applyFilters: document.getElementById("apply-filters"),
    reportPeriod: document.getElementById("report-period"),
    reportMessage: document.getElementById("report-message"),

    onTimeRate: document.getElementById("on-time-rate"),
    lateArrivals: document.getElementById("late-arrivals"),
    absences: document.getElementById("absences"),
    leaveDays: document.getElementById("leave-days"),

    weeklyAttendance: document.getElementById("weekly-attendance"),
    leaveDonut: document.getElementById("leave-donut"),
    donutTotal: document.getElementById("donut-total"),
    leaveLegend: document.getElementById("leave-legend"),

    departmentAttendance: document.getElementById("department-attendance"),
    projectStatus: document.getElementById("project-status"),
    overdueCount: document.getElementById("overdue-count"),

    payrollChart: document.getElementById("payroll-chart"),
    departmentTableBody: document.getElementById("department-table-body"),
    departmentTableFooter: document.getElementById("department-table-footer")
};

/* ---------------------------------------------------------
   1. General helpers
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
    const date = new Date(`${dateString}T12:00:00`);

    return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
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

function sum(items, getValue) {
    return items.reduce((total, item) => total + getValue(item), 0);
}

function getDepartment(id) {
    return state.departments.find(department => department.id === id);
}

function getSelectedDepartments() {
    if (state.departmentId === "all") {
        return state.departments;
    }

    return state.departments.filter(
        department => String(department.id) === state.departmentId
    );
}

function getSelectedDepartmentIds() {
    return new Set(getSelectedDepartments().map(department => department.id));
}

function getWeekStart(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    const day = date.getDay();

    // Monday is the first day of the week.
    const offset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + offset);

    return dateOnly(date);
}

function getDateRangeDays(startDate, endDate) {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);

    return Math.max(
        0,
        Math.round((end - start) / 86400000) + 1
    );
}

function getRangeLabel() {
    return `${formatDate(state.startDate)} – ${formatDate(state.endDate)}`;
}

/* ---------------------------------------------------------
   2. Generate mock data
--------------------------------------------------------- */

/*
 * Generates a consistent set of mock attendance records.
 * Weekends are excluded from scheduled attendance.
 *
 * Replace this function with real API data when connecting
 * the page to Laravel.
 */

function createMockAttendance(startDate, endDate) {
    const records = [];
    const employeeCounts = state.departments.map(department => ({
        departmentId: department.id,
        count: department.employees
    }));

    let employeeNumber = 0;

    for (const department of state.departments) {
        for (let employee = 0; employee < department.employees; employee++) {
            employeeNumber++;

            let date = startDate;

            while (date <= endDate) {
                const weekday = new Date(`${date}T12:00:00`).getDay();

                if (weekday !== 0 && weekday !== 6) {
                    /*
                     * Deterministic sample distribution.
                     * No random numbers, so filtering stays consistent.
                     */
                    const score = (employeeNumber * 7 + new Date(
                        `${date}T12:00:00`
                    ).getDate() * 3) % 40;

                    let status = "present";

                    if (score === 0 || score === 1) {
                        status = "absent";
                    } else if (score >= 2 && score <= 5) {
                        status = "late";
                    }

                    records.push({
                        employeeId: employeeNumber,
                        departmentId: department.id,
                        date,
                        status
                    });
                }

                date = addDays(date, 1);
            }
        }
    }

    return records;
}

function createMockLeaves() {
    const today = dateOnly(new Date());

    const records = [
        { id: 1, departmentId: 1, type: "normal", days: 2, offset: -2 },
        { id: 2, departmentId: 2, type: "medical", days: 1, offset: -3 },
        { id: 3, departmentId: 3, type: "normal", days: 4, offset: -5 },
        { id: 4, departmentId: 4, type: "day_off", days: 1, offset: -7 },
        { id: 5, departmentId: 5, type: "medical", days: 2, offset: -8 },
        { id: 6, departmentId: 3, type: "normal", days: 3, offset: -10 },
        { id: 7, departmentId: 2, type: "day_off", days: 1, offset: -12 },
        { id: 8, departmentId: 1, type: "normal", days: 2, offset: -14 },
        { id: 9, departmentId: 4, type: "normal", days: 3, offset: -17 },
        { id: 10, departmentId: 3, type: "medical", days: 1, offset: -20 },
        { id: 11, departmentId: 6, type: "normal", days: 2, offset: -22 },
        { id: 12, departmentId: 5, type: "day_off", days: 1, offset: -24 },
        { id: 13, departmentId: 3, type: "normal", days: 2, offset: -27 },
        { id: 14, departmentId: 2, type: "medical", days: 1, offset: -30 },
        { id: 15, departmentId: 4, type: "normal", days: 2, offset: -32 },
        { id: 16, departmentId: 6, type: "day_off", days: 1, offset: -35 },
        { id: 17, departmentId: 3, type: "normal", days: 3, offset: -38 },
        { id: 18, departmentId: 1, type: "medical", days: 1, offset: -40 }
    ];

    return records.map(record => {
        const startDate = addDays(today, record.offset);

        return {
            id: record.id,
            departmentId: record.departmentId,
            type: record.type,
            days: record.days,
            startDate,
            endDate: addDays(startDate, record.days - 1),
            status: "approved"
        };
    });
}

/* ---------------------------------------------------------
   3. Load data
--------------------------------------------------------- */

function populateDepartmentFilter() {
    const options = state.departments.map(department => `
        <option value="${department.id}">
            ${escapeHtml(department.name)}
        </option>
    `).join("");

    elements.departmentFilter.innerHTML = `
        <option value="all">All departments</option>
        ${options}
    `;
}

function initializeDateFilters() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    state.startDate = dateOnly(firstDay);
    state.endDate = dateOnly(now);

    elements.startDate.value = state.startDate;
    elements.endDate.value = state.endDate;
}

async function loadReports() {
    try {
        if (API.useMock) {
            state.attendance = createMockAttendance(
                state.startDate,
                state.endDate
            );

            state.leaves = createMockLeaves();
        } else {
            const params = new URLSearchParams({
                start_date: state.startDate,
                end_date: state.endDate,
                department_id: state.departmentId
            });

            const response = await fetch(
                `${API.base}/reports?${params}`,
                {
                    credentials: "include",
                    headers: {
                        Accept: "application/json"
                    }
                }
            );

            if (!response.ok) {
                throw new Error("Unable to load reports.");
            }

            const data = await response.json();

            state.attendance = data.attendance || [];
            state.leaves = data.leaves || [];
            state.departments = data.departments || state.departments;
            state.projects = data.projects || state.projects;
            state.payroll = data.payroll || state.payroll;

            populateDepartmentFilter();
            elements.departmentFilter.value = state.departmentId;
        }

        elements.reportMessage.textContent = "";
        renderReports();
    } catch (error) {
        console.error(error);
        elements.reportMessage.textContent =
            error.message || "Could not load reports.";
    }
}

/* ---------------------------------------------------------
   4. Filter records
--------------------------------------------------------- */

function getFilteredAttendance() {
    const departmentIds = getSelectedDepartmentIds();

    return state.attendance.filter(record => {
        return departmentIds.has(Number(record.departmentId)) &&
            record.date >= state.startDate &&
            record.date <= state.endDate;
    });
}

function getFilteredLeaves() {
    const departmentIds = getSelectedDepartmentIds();

    return state.leaves.filter(record => {
        return departmentIds.has(Number(record.departmentId)) &&
            record.status === "approved" &&
            record.startDate <= state.endDate &&
            record.endDate >= state.startDate;
    });
}

function getLeaveDaysInRange(leave) {
    const start = leave.startDate < state.startDate
        ? state.startDate
        : leave.startDate;

    const end = leave.endDate > state.endDate
        ? state.endDate
        : leave.endDate;

    return getDateRangeDays(start, end);
}

/* ---------------------------------------------------------
   5. Summary cards
--------------------------------------------------------- */

function renderSummary() {
    const attendance = getFilteredAttendance();
    const leaves = getFilteredLeaves();

    const presentCount = attendance.filter(
        record => record.status === "present"
    ).length;

    const lateCount = attendance.filter(
        record => record.status === "late"
    ).length;

    const absentCount = attendance.filter(
        record => record.status === "absent"
    ).length;

    const totalAttendance = attendance.length;

    const onTimeRate = totalAttendance === 0
        ? 0
        : Math.round((presentCount / totalAttendance) * 100);

    const totalLeaveDays = sum(
        leaves,
        leave => getLeaveDaysInRange(leave)
    );

    elements.onTimeRate.textContent = `${onTimeRate}%`;
    elements.lateArrivals.textContent = lateCount.toLocaleString();
    elements.absences.textContent = absentCount.toLocaleString();
    elements.leaveDays.textContent = totalLeaveDays.toLocaleString();

    elements.reportPeriod.textContent =
        `Reporting period: ${getRangeLabel()}`;
}

/* ---------------------------------------------------------
   6. Attendance by week
--------------------------------------------------------- */

function getWeeklyGroups(attendance) {
    const groups = new Map();

    for (const record of attendance) {
        const weekStart = getWeekStart(record.date);

        if (!groups.has(weekStart)) {
            groups.set(weekStart, {
                start: weekStart,
                end: addDays(weekStart, 6),
                present: 0,
                late: 0,
                absent: 0
            });
        }

        groups.get(weekStart)[record.status]++;
    }

    return [...groups.values()]
        .sort((a, b) => a.start.localeCompare(b.start));
}

function renderWeeklyAttendance() {
    const attendance = getFilteredAttendance();
    const groups = getWeeklyGroups(attendance);

    if (groups.length === 0) {
        elements.weeklyAttendance.innerHTML =
            `<p class="empty-message">No attendance records for this period.</p>`;
        return;
    }

    const maxTotal = Math.max(
        1,
        ...groups.map(group => group.present + group.late + group.absent)
    );

    elements.weeklyAttendance.innerHTML = groups.map(group => {
        const total = group.present + group.late + group.absent;
        const availableHeight = 190;

        const presentHeight = group.present / maxTotal * availableHeight;
        const lateHeight = group.late / maxTotal * availableHeight;
        const absentHeight = group.absent / maxTotal * availableHeight;

        const labelStart = group.start < state.startDate
            ? state.startDate
            : group.start;

        const labelEnd = group.end > state.endDate
            ? state.endDate
            : group.end;

        const showLabel = height => height >= 17;

        return `
            <div class="week-column">
                <div class="week-stack" title="${total} attendance records">
                    <div
                        class="week-segment absent"
                        style="height:${absentHeight}px"
                        title="Absent: ${group.absent}"
                    >
                        ${showLabel(absentHeight)
                            ? `<span>${group.absent}</span>`
                            : ""}
                    </div>

                    <div
                        class="week-segment late"
                        style="height:${lateHeight}px"
                        title="Late: ${group.late}"
                    >
                        ${showLabel(lateHeight)
                            ? `<span>${group.late}</span>`
                            : ""}
                    </div>

                    <div
                        class="week-segment present"
                        style="height:${presentHeight}px"
                        title="Present: ${group.present}"
                    >
                        ${showLabel(presentHeight)
                            ? `<span>${group.present}</span>`
                            : ""}
                    </div>
                </div>

                <span class="week-label">
                    ${escapeHtml(formatDate(labelStart))}
                    <br>
                    ${escapeHtml(formatDate(labelEnd))}
                </span>
            </div>
        `;
    }).join("");
}

/* ---------------------------------------------------------
   7. Leave days by type
--------------------------------------------------------- */

function renderLeaveChart() {
    const leaves = getFilteredLeaves();

    const totals = Object.fromEntries(
        LEAVE_TYPES.map(type => [type.id, 0])
    );

    for (const leave of leaves) {
        if (Object.hasOwn(totals, leave.type)) {
            totals[leave.type] += getLeaveDaysInRange(leave);
        }
    }

    const total = sum(Object.values(totals), value => value);

    elements.donutTotal.textContent = total.toLocaleString();

    if (total === 0) {
        elements.leaveDonut.style.background = "#E2E8F0";
    } else {
        let currentAngle = 0;

        const segments = LEAVE_TYPES.map(type => {
            const degrees = totals[type.id] / total * 360;
            const startAngle = currentAngle;
            currentAngle += degrees;

            return `${type.color} ${startAngle}deg ${currentAngle}deg`;
        });

        elements.leaveDonut.style.background =
            `conic-gradient(${segments.join(", ")})`;
    }

    elements.leaveLegend.innerHTML = LEAVE_TYPES.map(type => `
        <div class="legend-row">
            <span class="legend-label">
                <i
                    class="legend-color"
                    style="background:${type.color}"
                ></i>
                ${escapeHtml(type.label)}
            </span>

            <span class="legend-value">
                ${totals[type.id].toLocaleString()}
            </span>
        </div>
    `).join("");
}

/* ---------------------------------------------------------
   8. Late and absent by department
--------------------------------------------------------- */

function renderDepartmentAttendance() {
    const attendance = getFilteredAttendance();
    const departments = getSelectedDepartments();

    const totals = departments.map(department => {
        const records = attendance.filter(
            record => Number(record.departmentId) === department.id
        );

        return {
            name: department.name,
            late: records.filter(record => record.status === "late").length,
            absent: records.filter(record => record.status === "absent").length
        };
    });

    const maximum = Math.max(
        1,
        ...totals.flatMap(item => [item.late, item.absent])
    );

    elements.departmentAttendance.innerHTML = totals.map(item => `
        <div class="bar-item">
            <div class="bar-item-header">
                <span>${escapeHtml(item.name)}</span>
            </div>

            <div class="bar-pair">
                <div class="bar-line">
                    <div class="bar-track">
                        <div
                            class="bar-fill late"
                            style="width:${item.late / maximum * 100}%"
                        ></div>
                    </div>
                    <span class="bar-value">${item.late}</span>
                </div>

                <div class="bar-line">
                    <div class="bar-track">
                        <div
                            class="bar-fill absent"
                            style="width:${item.absent / maximum * 100}%"
                        ></div>
                    </div>
                    <span class="bar-value">${item.absent}</span>
                </div>
            </div>
        </div>
    `).join("");
}

/* ---------------------------------------------------------
   9. Projects by status
--------------------------------------------------------- */

function renderProjectStatus() {
    const projects = state.projects;
    const maximum = Math.max(1, ...projects.map(project => project.count));

    elements.projectStatus.innerHTML = projects.map(project => `
        <div class="bar-item">
            <div class="bar-item-header">
                <span>${escapeHtml(project.label)}</span>
                <span>${project.count}</span>
            </div>

            <div class="bar-track">
                <div
                    class="bar-fill ${escapeHtml(project.colorClass)}"
                    style="width:${project.count / maximum * 100}%"
                ></div>
            </div>
        </div>
    `).join("");

    /*
     * Replace this mock count with a server-calculated overdue count.
     */
    const overdueCount = 2;

    elements.overdueCount.textContent =
        `${overdueCount} ${overdueCount === 1 ? "project is" : "projects are"} overdue`;
}

/* ---------------------------------------------------------
   10. Net pay by month
--------------------------------------------------------- */

function renderPayrollChart() {
    const payroll = state.payroll;

    if (payroll.length === 0) {
        elements.payrollChart.innerHTML =
            `<p class="empty-message">No payroll data available.</p>`;
        return;
    }

    const width = 760;
    const height = 260;
    const left = 45;
    const right = 25;
    const top = 30;
    const bottom = 45;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const values = payroll.map(item => Number(item.amount) || 0);
    const minimum = Math.min(...values) * 0.97;
    const maximum = Math.max(...values) * 1.01;
    const valueRange = Math.max(1, maximum - minimum);

    const points = payroll.map((item, index) => {
        const x = payroll.length === 1
            ? left + chartWidth / 2
            : left + index * chartWidth / (payroll.length - 1);

        const y = top + (
            (maximum - item.amount) / valueRange
        ) * chartHeight;

        return {
            ...item,
            x,
            y
        };
    });

    const linePoints = points.map(
        point => `${point.x},${point.y}`
    ).join(" ");

    const areaPoints = [
        `${points[0].x},${top + chartHeight}`,
        ...points.map(point => `${point.x},${point.y}`),
        `${points[points.length - 1].x},${top + chartHeight}`
    ].join(" ");

    const gridLines = [0, 1, 2, 3].map(index => {
        const y = top + index * chartHeight / 3;

        return `
            <line
                x1="${left}"
                y1="${y}"
                x2="${width - right}"
                y2="${y}"
                stroke="#F1F5F9"
            ></line>
        `;
    }).join("");

    const circles = points.map(point => `
        <circle
            cx="${point.x}"
            cy="${point.y}"
            r="4"
            fill="#3968AC"
        >
            <title>
                ${escapeHtml(point.month)}: ${Number(point.amount).toLocaleString()}
            </title>
        </circle>

        <text
            x="${point.x}"
            y="${Math.max(15, point.y - 12)}"
            fill="#3968AC"
            font-size="11"
            font-weight="600"
            text-anchor="middle"
        >${Number(point.amount).toLocaleString()}</text>

        <text
            x="${point.x}"
            y="${height - 12}"
            fill="#5B6573"
            font-size="12"
            text-anchor="middle"
        >${escapeHtml(point.month)}</text>
    `).join("");

    elements.payrollChart.innerHTML = `
        <svg
            viewBox="0 0 ${width} ${height}"
            role="img"
            aria-label="Net pay totals for the last six months"
        >
            <defs>
                <linearGradient id="payroll-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#EBF3FC" stop-opacity="1"></stop>
                    <stop offset="100%" stop-color="#EBF3FC" stop-opacity="0.2"></stop>
                </linearGradient>
            </defs>

            ${gridLines}

            <polygon
                points="${areaPoints}"
                fill="url(#payroll-area)"
            ></polygon>

            <polyline
                points="${linePoints}"
                fill="none"
                stroke="#3968AC"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></polyline>

            ${circles}
        </svg>
    `;
}

/* ---------------------------------------------------------
   11. Department details table
--------------------------------------------------------- */

function renderDepartmentTable() {
    const departments = getSelectedDepartments();
    const attendance = getFilteredAttendance();
    const leaves = getFilteredLeaves();

    let totals = {
        employees: 0,
        late: 0,
        absent: 0,
        leaveDays: 0,
        openStrikes: 0
    };

    elements.departmentTableBody.innerHTML = departments.map(department => {
        const departmentAttendance = attendance.filter(
            record => Number(record.departmentId) === department.id
        );

        const departmentLeaves = leaves.filter(
            leave => Number(leave.departmentId) === department.id
        );

        const late = departmentAttendance.filter(
            record => record.status === "late"
        ).length;

        const absent = departmentAttendance.filter(
            record => record.status === "absent"
        ).length;

        const leaveDays = sum(
            departmentLeaves,
            leave => getLeaveDaysInRange(leave)
        );

        const openStrikes = Number(department.openStrikes) || 0;

        totals.employees += department.employees;
        totals.late += late;
        totals.absent += absent;
        totals.leaveDays += leaveDays;
        totals.openStrikes += openStrikes;

        return `
            <tr>
                <td>${escapeHtml(department.name)}</td>
                <td>${department.employees}</td>
                <td>${late}</td>
                <td>${absent}</td>
                <td>${leaveDays}</td>
                <td>${openStrikes}</td>
            </tr>
        `;
    }).join("");

    elements.departmentTableFooter.innerHTML = `
        <tr>
            <td>Total</td>
            <td>${totals.employees}</td>
            <td>${totals.late}</td>
            <td>${totals.absent}</td>
            <td>${totals.leaveDays}</td>
            <td>${totals.openStrikes}</td>
        </tr>
    `;
}

/* ---------------------------------------------------------
   12. Render all reports
--------------------------------------------------------- */

function renderReports() {
    renderSummary();
    renderWeeklyAttendance();
    renderLeaveChart();
    renderDepartmentAttendance();
    renderProjectStatus();
    renderPayrollChart();
    renderDepartmentTable();
}

/* ---------------------------------------------------------
   13. Filters and initialization
--------------------------------------------------------- */

function applyFilters() {
    const startDate = elements.startDate.value;
    const endDate = elements.endDate.value;

    if (!startDate || !endDate) {
        elements.reportMessage.textContent =
            "Please select both a start date and an end date.";
        return;
    }

    if (startDate > endDate) {
        elements.reportMessage.textContent =
            "The start date must be before or equal to the end date.";
        return;
    }

    state.startDate = startDate;
    state.endDate = endDate;
    state.departmentId = elements.departmentFilter.value;

    elements.reportMessage.textContent = "";

    loadReports();
}

function initializePage() {
    populateDepartmentFilter();
    initializeDateFilters();

    elements.applyFilters.addEventListener("click", applyFilters);

    elements.departmentFilter.addEventListener("change", () => {
        state.departmentId = elements.departmentFilter.value;
        renderReports();
    });

    loadReports();
}

initializePage();
