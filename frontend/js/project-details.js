
(function () {
"use strict";

/*
 * PresenceHR Project Details
 *
 * Frontend demo using localStorage.
 * Replace loadState() and saveState() with Laravel API requests
 * when your backend endpoints are ready.
 *
 * Demo current user: Sara Ali.
 * Only Sara's own tasks have an enabled status dropdown.
 */

const STORAGE_KEY = "presencehr-project-details-v1";
const CURRENT_USER_ID = 2;
const TASKS_PER_PAGE = 6;

const employees = [
    { id: 1, name: "David Lin", jobTitle: "Senior Product Designer", department: "People & Operations" },
    { id: 2, name: "Sara Ali", jobTitle: "HR Manager", department: "People & Operations" },
    { id: 3, name: "Omar Mansoor", jobTitle: "Frontend Engineer", department: "IT & Systems" },
    { id: 4, name: "Rania Khan", jobTitle: "UI Designer", department: "Design & Product" },
    { id: 5, name: "Tarek Youssef", jobTitle: "QA Specialist", department: "Operations" }
];

const initialState = {
    project: {
        id: 1,
        name: "Website redesign",
        description:
            "Complete redesign and frontend implementation of the corporate web experience, migrating marketing landing pages to the new design system tokens.",
        status: "in_progress",
        departments: ["Marketing", "Design & Product"],
        leadId: 1,
        startDate: "2026-10-02",
        dueDate: "2026-11-15"
    },

    memberIds: [1, 2, 3, 4, 5],

    tasks: [
        {
            id: 101,
            title: "Information architecture & sitemap",
            description: "Finalize the site structure and page hierarchy.",
            assigneeId: 2,
            dueDate: "2026-10-10",
            status: "done"
        },
        {
            id: 102,
            title: "Brand asset & typography review",
            description: "Review approved brand assets and typography.",
            assigneeId: 1,
            dueDate: "2026-10-12",
            status: "in_progress"
        },
        {
            id: 103,
            title: "Wireframe review with marketing",
            description: "Collect feedback on the initial wireframes.",
            assigneeId: 3,
            dueDate: "2026-10-18",
            status: "done"
        },
        {
            id: 104,
            title: "Component library tokenization",
            description: "Create reusable design tokens for the interface.",
            assigneeId: 4,
            dueDate: "2026-10-24",
            status: "todo"
        },
        {
            id: 105,
            title: "Homepage high-fidelity mockups",
            description: "Prepare the final homepage mockups.",
            assigneeId: 2,
            dueDate: "2026-10-25",
            status: "in_progress"
        },
        {
            id: 106,
            title: "Mobile responsive breakpoints review",
            description: "Check layouts on mobile, tablet, and desktop.",
            assigneeId: 5,
            dueDate: "2026-10-28",
            status: "todo"
        },
        {
            id: 107,
            title: "Accessibility audit",
            description: "Review keyboard navigation and accessible labels.",
            assigneeId: 2,
            dueDate: "2026-10-30",
            status: "todo"
        },
        {
            id: 108,
            title: "Landing page implementation",
            description: "Implement the approved landing page design.",
            assigneeId: 3,
            dueDate: "2026-11-02",
            status: "in_progress"
        },
        {
            id: 109,
            title: "Cross-browser testing",
            description: "Test the site in supported browsers.",
            assigneeId: 5,
            dueDate: "2026-11-06",
            status: "todo"
        },
        {
            id: 110,
            title: "Final design approval",
            description: "Get approval for the completed redesign.",
            assigneeId: 1,
            dueDate: "2026-11-10",
            status: "todo"
        }
    ],

    activity: [
        {
            id: 1,
            actorId: 3,
            message: "marked a task as done",
            target: "Wireframe review with marketing",
            icon: "task_alt",
            createdAt: "2026-10-14T12:00:00"
        },
        {
            id: 2,
            actorId: 4,
            message: "was assigned a task",
            target: "Component library tokenization",
            icon: "assignment_ind",
            createdAt: "2026-10-13T10:00:00"
        },
        {
            id: 3,
            actorId: 1,
            message: "updated the project plan",
            target: "Website redesign",
            icon: "edit_note",
            createdAt: "2026-10-12T09:00:00"
        }
    ]
};

const STATUS_LABELS = {
    not_started: "Not started",
    in_progress: "In progress",
    on_hold: "On hold",
    completed: "Completed",
    cancelled: "Cancelled",
    todo: "To do",
    done: "Done"
};

const elements = {
    breadcrumbName: document.getElementById("breadcrumbName"),
    projectNameHeading: document.getElementById("projectNameHeading"),
    projectBadges: document.getElementById("projectBadges"),
    projectDescriptionText: document.getElementById("projectDescriptionText"),
    projectLead: document.getElementById("projectLead"),
    projectStartDate: document.getElementById("projectStartDate"),
    projectDueDate: document.getElementById("projectDueDate"),
    dueDateLabel: document.getElementById("dueDateLabel"),
    progressLabel: document.getElementById("progressLabel"),
    progressTasks: document.getElementById("progressTasks"),
    projectProgressBar: document.getElementById("projectProgressBar"),

    tasksTabCount: document.getElementById("tasksTabCount"),
    membersTabCount: document.getElementById("membersTabCount"),
    tasksPanel: document.getElementById("tasksPanel"),
    membersPanel: document.getElementById("membersPanel"),
    activityPanel: document.getElementById("activityPanel"),

    taskSearch: document.getElementById("taskSearch"),
    taskStatusFilter: document.getElementById("taskStatusFilter"),
    taskAssigneeFilter: document.getElementById("taskAssigneeFilter"),
    tasksTableBody: document.getElementById("tasksTableBody"),
    taskResultsText: document.getElementById("taskResultsText"),
    pageNumber: document.getElementById("pageNumber"),
    previousPage: document.getElementById("previousPage"),
    nextPage: document.getElementById("nextPage"),

    membersGrid: document.getElementById("membersGrid"),
    membersEmptyState: document.getElementById("membersEmptyState"),
    activityList: document.getElementById("activityList"),
    activityEmptyState: document.getElementById("activityEmptyState"),

    projectModal: document.getElementById("projectModal"),
    projectForm: document.getElementById("projectForm"),
    projectModalTitle: document.getElementById("projectModalTitle"),
    editProjectName: document.getElementById("editProjectName"),
    editProjectDescription: document.getElementById("editProjectDescription"),
    editProjectLead: document.getElementById("editProjectLead"),
    editProjectStatus: document.getElementById("editProjectStatus"),
    editProjectStart: document.getElementById("editProjectStart"),
    editProjectDue: document.getElementById("editProjectDue"),
    editProjectDepartments: document.getElementById("editProjectDepartments"),
    projectFormMessage: document.getElementById("projectFormMessage"),

    taskModal: document.getElementById("taskModal"),
    taskForm: document.getElementById("taskForm"),
    taskModalTitle: document.getElementById("taskModalTitle"),
    editTaskId: document.getElementById("editTaskId"),
    editTaskTitle: document.getElementById("editTaskTitle"),
    editTaskDescription: document.getElementById("editTaskDescription"),
    editTaskAssignee: document.getElementById("editTaskAssignee"),
    editTaskDue: document.getElementById("editTaskDue"),
    editTaskStatus: document.getElementById("editTaskStatus"),
    taskFormMessage: document.getElementById("taskFormMessage"),
    deleteTaskButton: document.getElementById("deleteTaskButton"),

    memberModal: document.getElementById("memberModal"),
    memberForm: document.getElementById("memberForm"),
    newMemberSelect: document.getElementById("newMemberSelect"),
    memberFormMessage: document.getElementById("memberFormMessage"),

    toast: document.getElementById("toast")
};

let state = loadState();
let currentPage = 1;
let toastTimeout;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (
                parsed.project &&
                Array.isArray(parsed.tasks) &&
                Array.isArray(parsed.memberIds) &&
                Array.isArray(parsed.activity)
            ) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn("Could not load saved project data.", error);
    }

    return clone(initialState);
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Could not save project data.", error);
        showToast("Could not save changes in this browser.");
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getEmployee(id) {
    return employees.find(employee => employee.id === Number(id));
}

function getEmployeeName(id) {
    return getEmployee(id)?.name || "Unknown employee";
}

function getInitials(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function formatDate(value) {
    if (!value) return "Not set";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "Not set";

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    }).format(date);
}

function isOverdue(date, status) {
    if (!date || status === "done" || status === "completed" || status === "cancelled") {
        return false;
    }

    const dueDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 2800);
}

function recordActivity(actorId, message, target, icon = "history") {
    state.activity.unshift({
        id: Date.now() + Math.random(),
        actorId,
        message,
        target,
        icon,
        createdAt: new Date().toISOString()
    });

    saveState();
}

function openModal(modal) {
    if (!modal.open) modal.showModal();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal?.open) modal.close();
}

/* Project summary and progress */

function renderProjectSummary() {
    const project = state.project;
    const lead = getEmployee(project.leadId);

    const completedTasks = state.tasks.filter(task => task.status === "done").length;
    const totalTasks = state.tasks.length;
    const progress = totalTasks === 0
        ? 0
        : Math.round((completedTasks / totalTasks) * 100);

    elements.breadcrumbName.textContent = project.name;
    elements.projectNameHeading.textContent = project.name;
    elements.projectDescriptionText.textContent = project.description || "No description provided.";
    elements.projectLead.textContent = lead?.name || "Not assigned";
    elements.projectStartDate.textContent = formatDate(project.startDate);
    elements.projectDueDate.textContent = formatDate(project.dueDate);

    const overdue = isOverdue(project.dueDate, project.status);
    elements.dueDateLabel.textContent = overdue ? "Overdue — due date" : "Due date";
    elements.projectDueDate.parentElement.parentElement.classList.toggle("overdue", overdue);

    const departmentBadges = project.departments.map(department => `
        <span class="badge">${escapeHtml(department)}</span>
    `).join("");

    elements.projectBadges.innerHTML = `
        <span class="status-badge status-${escapeHtml(project.status)}">
            ${escapeHtml(STATUS_LABELS[project.status] || project.status)}
        </span>
        ${departmentBadges}
        ${overdue ? `
            <span class="overdue-badge">
                <span class="material-symbols-outlined">alarm</span>
                Overdue
            </span>
        ` : ""}
    `;

    elements.progressLabel.textContent = `Progress (${progress}%)`;
    elements.progressTasks.textContent = `${completedTasks} of ${totalTasks} tasks done`;
    elements.projectProgressBar.style.width = `${progress}%`;

    elements.tasksTabCount.textContent = totalTasks;
    elements.membersTabCount.textContent = state.memberIds.length;
}

/* Task search and filters */

function renderAssigneeFilters() {
    const previousValue = elements.taskAssigneeFilter.value;

    elements.taskAssigneeFilter.innerHTML = `
        <option value="all">All assignees</option>
        ${state.memberIds.map(id => {
            const employee = getEmployee(id);
            if (!employee) return "";

            return `
                <option value="${employee.id}">
                    ${escapeHtml(employee.name)}
                </option>
            `;
        }).join("")}
    `;

    if (
        [...elements.taskAssigneeFilter.options]
            .some(option => option.value === previousValue)
    ) {
        elements.taskAssigneeFilter.value = previousValue;
    }
}

function getFilteredTasks() {
    const query = elements.taskSearch.value.trim().toLowerCase();
    const selectedStatus = elements.taskStatusFilter.value;
    const selectedAssignee = elements.taskAssigneeFilter.value;

    return state.tasks.filter(task => {
        const assignee = getEmployeeName(task.assigneeId).toLowerCase();
        const searchableText = `${task.title} ${task.description || ""} ${assignee}`.toLowerCase();

        const matchesSearch = searchableText.includes(query);
        const matchesStatus =
            selectedStatus === "all" || task.status === selectedStatus;
        const matchesAssignee =
            selectedAssignee === "all" ||
            task.assigneeId === Number(selectedAssignee);

        return matchesSearch && matchesStatus && matchesAssignee;
    });
}

function renderTaskRow(task) {
    const employee = getEmployee(task.assigneeId);
    const overdue = isOverdue(task.dueDate, task.status);
    const canChangeStatus = task.assigneeId === CURRENT_USER_ID;

    return `
        <tr>
            <td class="task-title-cell">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description
                    ? `<div class="task-description">${escapeHtml(task.description)}</div>`
                    : ""}
            </td>

            <td class="assignee-cell">
                <div class="assignee">
                    <span class="avatar">${escapeHtml(getInitials(employee?.name))}</span>
                    <span class="assignee-name">${escapeHtml(employee?.name || "Unassigned")}</span>
                    ${task.assigneeId === CURRENT_USER_ID
                        ? `<span class="you-badge">YOU</span>`
                        : ""}
                </div>
            </td>

            <td>
                <span class="task-date ${overdue ? "overdue" : ""}">
                    ${escapeHtml(formatDate(task.dueDate))}
                    ${overdue ? " · Overdue" : ""}
                </span>
            </td>

            <td>
                <select
                    class="task-status-select status-${escapeHtml(task.status)}"
                    data-action="change-status"
                    data-task-id="${task.id}"
                    aria-label="Change status for ${escapeHtml(task.title)}"
                    ${canChangeStatus ? "" : "disabled"}
                    title="${canChangeStatus
                        ? "Change your task status"
                        : "You can only change the status of your own tasks"}"
                >
                    ${["todo", "in_progress", "done"].map(status => `
                        <option value="${status}" ${task.status === status ? "selected" : ""}>
                            ${escapeHtml(STATUS_LABELS[status])}
                        </option>
                    `).join("")}
                </select>
            </td>

            <td class="action-cell">
                <button
                    type="button"
                    class="icon-button"
                    data-action="edit-task"
                    data-task-id="${task.id}"
                    aria-label="Edit ${escapeHtml(task.title)}"
                    title="Edit task"
                >
                    <span class="material-symbols-outlined">edit</span>
                </button>
            </td>
        </tr>
    `;
}

function renderTasks() {
    const filteredTasks = getFilteredTasks();
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));

    currentPage = Math.min(currentPage, totalPages);
    currentPage = Math.max(currentPage, 1);

    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    const visibleTasks = filteredTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);

    elements.tasksTableBody.innerHTML = visibleTasks.length
        ? visibleTasks.map(renderTaskRow).join("")
        : `<tr><td colspan="5"><div class="empty-state">No tasks match these filters.</div></td></tr>`;

    const firstResult = filteredTasks.length ? startIndex + 1 : 0;
    const lastResult = Math.min(startIndex + TASKS_PER_PAGE, filteredTasks.length);

    elements.taskResultsText.textContent =
        `Showing ${firstResult}–${lastResult} of ${filteredTasks.length} tasks`;

    elements.pageNumber.textContent = `${currentPage} / ${totalPages}`;
    elements.previousPage.disabled = currentPage <= 1;
    elements.nextPage.disabled = currentPage >= totalPages;
}

/* Task create and edit */

function fillEmployeeSelect(select, allowedIds = employees.map(employee => employee.id)) {
    select.innerHTML = allowedIds.map(id => {
        const employee = getEmployee(id);
        if (!employee) return "";

        return `
            <option value="${employee.id}">
                ${escapeHtml(employee.name)} — ${escapeHtml(employee.jobTitle)}
            </option>
        `;
    }).join("");
}

function openTaskForm(taskId = null) {
    elements.taskForm.reset();
    elements.taskFormMessage.textContent = "";
    elements.editTaskId.value = taskId || "";

    fillEmployeeSelect(elements.editTaskAssignee, state.memberIds);

    const task = taskId
        ? state.tasks.find(item => item.id === Number(taskId))
        : null;

    if (taskId && !task) {
        showToast("Task not found.");
        return;
    }

    if (task) {
        elements.taskModalTitle.textContent = "Edit task";
        elements.editTaskTitle.value = task.title;
        elements.editTaskDescription.value = task.description || "";
        elements.editTaskAssignee.value = String(task.assigneeId);
        elements.editTaskDue.value = task.dueDate || "";
        elements.editTaskStatus.value = task.status;
        elements.deleteTaskButton.hidden = false;
    } else {
        elements.taskModalTitle.textContent = "Add task";
        elements.editTaskAssignee.value = String(CURRENT_USER_ID);
        elements.editTaskDue.value = "";
        elements.editTaskStatus.value = "todo";
        elements.deleteTaskButton.hidden = true;
    }

    openModal(elements.taskModal);
    elements.editTaskTitle.focus();
}

function saveTask(event) {
    event.preventDefault();

    const title = elements.editTaskTitle.value.trim();
    const taskId = Number(elements.editTaskId.value);
    const assigneeId = Number(elements.editTaskAssignee.value);

    if (!title) {
        elements.taskFormMessage.textContent = "Enter a task title.";
        return;
    }

    if (!state.memberIds.includes(assigneeId)) {
        elements.taskFormMessage.textContent =
            "Choose someone who is already a project member.";
        return;
    }

    const status = elements.editTaskStatus.value;

    if (!["todo", "in_progress", "done"].includes(status)) {
        elements.taskFormMessage.textContent = "Choose a valid status.";
        return;
    }

    if (taskId) {
        const task = state.tasks.find(item => item.id === taskId);
        if (!task) return;

        const oldAssignee = task.assigneeId;
        const oldStatus = task.status;
        const oldTitle = task.title;

        Object.assign(task, {
            title,
            description: elements.editTaskDescription.value.trim(),
            assigneeId,
            dueDate: elements.editTaskDue.value,
            status
        });

        if (oldAssignee !== assigneeId) {
            recordActivity(
                CURRENT_USER_ID,
                `reassigned "${oldTitle}" to ${getEmployeeName(assigneeId)}`,
                oldTitle,
                "assignment_ind"
            );
        }

        if (oldStatus !== status) {
            recordActivity(
                CURRENT_USER_ID,
                `changed the status of "${oldTitle}" to ${STATUS_LABELS[status]}`,
                oldTitle,
                "task_alt"
            );
        }

        if (oldTitle !== title) {
            recordActivity(CURRENT_USER_ID, "renamed a task", title, "edit_note");
        }

        if (oldAssignee === assigneeId && oldStatus === status && oldTitle === title) {
            recordActivity(CURRENT_USER_ID, "updated task details", title, "edit_note");
        }

        showToast("Task updated.");
    } else {
        const newTask = {
            id: Date.now(),
            title,
            description: elements.editTaskDescription.value.trim(),
            assigneeId,
            dueDate: elements.editTaskDue.value,
            status
        };

        state.tasks.unshift(newTask);
        recordActivity(CURRENT_USER_ID, "created a task", title, "add_task");
        showToast("Task added.");
    }

    saveState();
    closeModal("taskModal");
    currentPage = 1;
    renderAll();
}

function deleteCurrentTask() {
    const taskId = Number(elements.editTaskId.value);
    const task = state.tasks.find(item => item.id === taskId);

    if (!task) return;

    if (!confirm(`Delete "${task.title}"? This cannot be undone in this demo.`)) {
        return;
    }

    state.tasks = state.tasks.filter(item => item.id !== taskId);
    recordActivity(CURRENT_USER_ID, "deleted a task", task.title, "delete");
    saveState();

    closeModal("taskModal");
    currentPage = 1;
    renderAll();
    showToast("Task deleted.");
}

function changeOwnTaskStatus(taskId, newStatus) {
    const task = state.tasks.find(item => item.id === Number(taskId));

    if (!task) return;

    if (task.assigneeId !== CURRENT_USER_ID) {
        showToast("You can only change your own tasks.");
        renderTasks();
        return;
    }

    if (!["todo", "in_progress", "done"].includes(newStatus)) {
        renderTasks();
        return;
    }

    if (task.status === newStatus) return;

    task.status = newStatus;

    recordActivity(
        CURRENT_USER_ID,
        `changed the status of "${task.title}" to ${STATUS_LABELS[newStatus]}`,
        task.title,
        "task_alt"
    );

    saveState();
    renderAll();
    showToast("Task status updated.");
}

/* Project editing */

function openProjectForm() {
    elements.projectForm.reset();
    elements.projectFormMessage.textContent = "";

    fillEmployeeSelect(elements.editProjectLead);

    const project = state.project;

    elements.projectModalTitle.textContent = "Manage project";
    elements.editProjectName.value = project.name;
    elements.editProjectDescription.value = project.description || "";
    elements.editProjectLead.value = String(project.leadId);
    elements.editProjectStatus.value = project.status;
    elements.editProjectStart.value = project.startDate;
    elements.editProjectDue.value = project.dueDate;
    elements.editProjectDepartments.value = project.departments.join(", ");

    openModal(elements.projectModal);
}

function saveProject(event) {
    event.preventDefault();

    const name = elements.editProjectName.value.trim();
    const startDate = elements.editProjectStart.value;
    const dueDate = elements.editProjectDue.value;

    if (!name) {
        elements.projectFormMessage.textContent = "Enter a project name.";
        return;
    }

    if (startDate && dueDate && dueDate < startDate) {
        elements.projectFormMessage.textContent =
            "The due date cannot be earlier than the start date.";
        return;
    }

    const previousName = state.project.name;
    const previousStatus = state.project.status;

    state.project.name = name;
    state.project.description = elements.editProjectDescription.value.trim();
    state.project.leadId = Number(elements.editProjectLead.value);
    state.project.status = elements.editProjectStatus.value;
    state.project.startDate = startDate;
    state.project.dueDate = dueDate;
    state.project.departments = [
        ...new Set(
            elements.editProjectDepartments.value
                .split(",")
                .map(value => value.trim())
                .filter(Boolean)
        )
    ];

    if (previousName !== name) {
        recordActivity(CURRENT_USER_ID, "renamed the project", name, "edit_note");
    }

    if (previousStatus !== state.project.status) {
        recordActivity(
            CURRENT_USER_ID,
            `changed the project status to ${STATUS_LABELS[state.project.status]}`,
            name,
            "sync"
        );
    }

    if (previousName === name && previousStatus === state.project.status) {
        recordActivity(CURRENT_USER_ID, "updated project details", name, "edit_note");
    }

    saveState();
    closeModal("projectModal");
    renderAll();
    showToast("Project updated.");
}

/* Project members */

function openMemberForm() {
    elements.memberForm.reset();
    elements.memberFormMessage.textContent = "";

    const availableEmployees = employees
        .filter(employee => !state.memberIds.includes(employee.id));

    if (availableEmployees.length === 0) {
        showToast("All available demo employees are already members.");
        return;
    }

    fillEmployeeSelect(
        elements.newMemberSelect,
        availableEmployees.map(employee => employee.id)
    );

    openModal(elements.memberModal);
}

function addMember(event) {
    event.preventDefault();

    const memberId = Number(elements.newMemberSelect.value);
    const employee = getEmployee(memberId);

    if (!employee) {
        elements.memberFormMessage.textContent = "Select an employee.";
        return;
    }

    if (state.memberIds.includes(memberId)) {
        elements.memberFormMessage.textContent = "This employee is already a member.";
        return;
    }

    state.memberIds.push(memberId);

    recordActivity(
        CURRENT_USER_ID,
        `added ${employee.name} to the project`,
        state.project.name,
        "person_add"
    );

    saveState();
    closeModal("memberModal");
    renderAll();
    showToast(`${employee.name} added to the project.`);
}

function removeMember(memberId) {
    const employee = getEmployee(memberId);

    if (!employee || !state.memberIds.includes(memberId)) return;

    if (memberId === state.project.leadId) {
        showToast("Assign a different project lead before removing this member.");
        return;
    }

    const assignedTasks = state.tasks.filter(task => task.assigneeId === memberId);

    if (assignedTasks.length > 0) {
        showToast("Reassign this member's tasks before removing them.");
        return;
    }

    if (!confirm(`Remove ${employee.name} from this project?`)) return;

    state.memberIds = state.memberIds.filter(id => id !== memberId);

    recordActivity(
        CURRENT_USER_ID,
        `removed ${employee.name} from the project`,
        state.project.name,
        "person_remove"
    );

    saveState();
    renderAll();
    showToast(`${employee.name} removed.`);
}

function renderMembers() {
    const members = state.memberIds
        .map(getEmployee)
        .filter(Boolean);

    elements.membersGrid.innerHTML = members.map(employee => {
        const isLead = employee.id === state.project.leadId;
        const isCurrentUser = employee.id === CURRENT_USER_ID;
        const hasTasks = state.tasks.some(task => task.assigneeId === employee.id);

        return `
            <article class="member-card">
                <span class="avatar">${escapeHtml(getInitials(employee.name))}</span>

                <div class="member-details">
                    <span class="member-name">${escapeHtml(employee.name)}</span>
                    <span class="member-role">${escapeHtml(employee.jobTitle)}</span>
                    <span class="member-department">${escapeHtml(employee.department)}</span>

                    ${isLead ? `<span class="role-badge">Project lead</span>` : ""}
                    ${isCurrentUser ? `<span class="role-badge">You</span>` : ""}
                </div>

                <div class="member-actions">
                    ${!isLead ? `
                        <button
                            type="button"
                            class="icon-button"
                            data-action="remove-member"
                            data-member-id="${employee.id}"
                            title="${hasTasks ? "Reassign their tasks first" : "Remove member"}"
                            aria-label="Remove ${escapeHtml(employee.name)}"
                        >
                            <span class="material-symbols-outlined">person_remove</span>
                        </button>
                    ` : ""}
                </div>
            </article>
        `;
    }).join("");

    elements.membersEmptyState.hidden = members.length > 0;
    elements.membersGrid.hidden = members.length === 0;
}

/* Activity */

function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return formatDate(value.slice(0, 10));
}

function renderActivity() {
    elements.activityList.innerHTML = state.activity.map(item => `
        <article class="activity-item">
            <div class="activity-dot">
                <span class="material-symbols-outlined">${escapeHtml(item.icon || "history")}</span>
            </div>

            <div class="activity-content">
                <strong>${escapeHtml(getEmployeeName(item.actorId))}</strong>
                ${escapeHtml(item.message)}
                ${item.target ? `<strong>${escapeHtml(item.target)}</strong>` : ""}
                <span class="activity-time">${escapeHtml(relativeTime(item.createdAt))}</span>
            </div>
        </article>
    `).join("");

    elements.activityEmptyState.hidden = state.activity.length > 0;
    elements.activityList.hidden = state.activity.length === 0;
}

/* Tabs */

function activateTab(tabName) {
    const panels = {
        tasks: elements.tasksPanel,
        members: elements.membersPanel,
        activity: elements.activityPanel
    };

    document.querySelectorAll(".tab").forEach(tab => {
        const active = tab.dataset.tab === tabName;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });

    Object.entries(panels).forEach(([name, panel]) => {
        panel.hidden = name !== tabName;
    });
}

/* Rendering and event handlers */

function renderAll() {
    renderProjectSummary();
    renderAssigneeFilters();
    renderTasks();
    renderMembers();
    renderActivity();
}

function handleTaskTableClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "edit-task") {
        openTaskForm(Number(button.dataset.taskId));
    }

    if (action === "remove-member") {
        removeMember(Number(button.dataset.memberId));
    }
}

function handleTaskTableChange(event) {
    const select = event.target.closest('[data-action="change-status"]');
    if (!select) return;

    changeOwnTaskStatus(Number(select.dataset.taskId), select.value);
}

function initializePage() {
    document.getElementById("manageProjectButton")
        .addEventListener("click", openProjectForm);

    document.getElementById("addTaskButton")
        .addEventListener("click", () => openTaskForm());

    document.getElementById("addMemberButton")
        .addEventListener("click", openMemberForm);

    elements.taskSearch.addEventListener("input", () => {
        currentPage = 1;
        renderTasks();
    });

    elements.taskStatusFilter.addEventListener("change", () => {
        currentPage = 1;
        renderTasks();
    });

    elements.taskAssigneeFilter.addEventListener("change", () => {
        currentPage = 1;
        renderTasks();
    });

    elements.previousPage.addEventListener("click", () => {
        currentPage--;
        renderTasks();
    });

    elements.nextPage.addEventListener("click", () => {
        currentPage++;
        renderTasks();
    });

    elements.tasksTableBody.addEventListener("click", handleTaskTableClick);
    elements.tasksTableBody.addEventListener("change", handleTaskTableChange);
    elements.membersGrid.addEventListener("click", handleTaskTableClick);

    elements.taskForm.addEventListener("submit", saveTask);
    elements.projectForm.addEventListener("submit", saveProject);
    elements.memberForm.addEventListener("submit", addMember);

    elements.deleteTaskButton.addEventListener("click", deleteCurrentTask);

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    // Close dialogs when the user clicks the backdrop.
    document.querySelectorAll("dialog.modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                modal.close();
            }
        });
    });

    renderAll();
    activateTab("tasks");
}

initializePage();
})();

"use strict";

/*
 * PresenceHR Project Details
 *
 * Frontend demo using localStorage.
 * Replace loadState() and saveState() with Laravel API requests
 * when your backend endpoints are ready.
 *
 * Demo current user: Sara Ali.
 * Only Sara's own tasks have an enabled status dropdown.
 */

const STORAGE_KEY = "presencehr-project-details-v1";
const CURRENT_USER_ID = 2;
const TASKS_PER_PAGE = 6;

const employees = [
    { id: 1, name: "David Lin", jobTitle: "Senior Product Designer", department: "People & Operations" },
    { id: 2, name: "Sara Ali", jobTitle: "HR Manager", department: "People & Operations" },
    { id: 3, name: "Omar Mansoor", jobTitle: "Frontend Engineer", department: "IT & Systems" },
    { id: 4, name: "Rania Khan", jobTitle: "UI Designer", department: "Design & Product" },
    { id: 5, name: "Tarek Youssef", jobTitle: "QA Specialist", department: "Operations" }
];

const initialState = {
    project: {
        id: 1,
        name: "Website redesign",
        description:
            "Complete redesign and frontend implementation of the corporate web experience, migrating marketing landing pages to the new design system tokens.",
        status: "in_progress",
        departments: ["Marketing", "Design & Product"],
        leadId: 1,
        startDate: "2026-10-02",
        dueDate: "2026-11-15"
    },

    memberIds: [1, 2, 3, 4, 5],

    tasks: [
        {
            id: 101,
            title: "Information architecture & sitemap",
            description: "Finalize the site structure and page hierarchy.",
            assigneeId: 2,
            dueDate: "2026-10-10",
            status: "done"
        },
        {
            id: 102,
            title: "Brand asset & typography review",
            description: "Review approved brand assets and typography.",
            assigneeId: 1,
            dueDate: "2026-10-12",
            status: "in_progress"
        },
        {
            id: 103,
            title: "Wireframe review with marketing",
            description: "Collect feedback on the initial wireframes.",
            assigneeId: 3,
            dueDate: "2026-10-18",
            status: "done"
        },
        {
            id: 104,
            title: "Component library tokenization",
            description: "Create reusable design tokens for the interface.",
            assigneeId: 4,
            dueDate: "2026-10-24",
            status: "todo"
        },
        {
            id: 105,
            title: "Homepage high-fidelity mockups",
            description: "Prepare the final homepage mockups.",
            assigneeId: 2,
            dueDate: "2026-10-25",
            status: "in_progress"
        },
        {
            id: 106,
            title: "Mobile responsive breakpoints review",
            description: "Check layouts on mobile, tablet, and desktop.",
            assigneeId: 5,
            dueDate: "2026-10-28",
            status: "todo"
        },
        {
            id: 107,
            title: "Accessibility audit",
            description: "Review keyboard navigation and accessible labels.",
            assigneeId: 2,
            dueDate: "2026-10-30",
            status: "todo"
        },
        {
            id: 108,
            title: "Landing page implementation",
            description: "Implement the approved landing page design.",
            assigneeId: 3,
            dueDate: "2026-11-02",
            status: "in_progress"
        },
        {
            id: 109,
            title: "Cross-browser testing",
            description: "Test the site in supported browsers.",
            assigneeId: 5,
            dueDate: "2026-11-06",
            status: "todo"
        },
        {
            id: 110,
            title: "Final design approval",
            description: "Get approval for the completed redesign.",
            assigneeId: 1,
            dueDate: "2026-11-10",
            status: "todo"
        }
    ],

    activity: [
        {
            id: 1,
            actorId: 3,
            message: "marked a task as done",
            target: "Wireframe review with marketing",
            icon: "task_alt",
            createdAt: "2026-10-14T12:00:00"
        },
        {
            id: 2,
            actorId: 4,
            message: "was assigned a task",
            target: "Component library tokenization",
            icon: "assignment_ind",
            createdAt: "2026-10-13T10:00:00"
        },
        {
            id: 3,
            actorId: 1,
            message: "updated the project plan",
            target: "Website redesign",
            icon: "edit_note",
            createdAt: "2026-10-12T09:00:00"
        }
    ]
};

const STATUS_LABELS = {
    not_started: "Not started",
    in_progress: "In progress",
    on_hold: "On hold",
    completed: "Completed",
    cancelled: "Cancelled",
    todo: "To do",
    done: "Done"
};

const elements = {
    breadcrumbName: document.getElementById("breadcrumbName"),
    projectNameHeading: document.getElementById("projectNameHeading"),
    projectBadges: document.getElementById("projectBadges"),
    projectDescriptionText: document.getElementById("projectDescriptionText"),
    projectLead: document.getElementById("projectLead"),
    projectStartDate: document.getElementById("projectStartDate"),
    projectDueDate: document.getElementById("projectDueDate"),
    dueDateLabel: document.getElementById("dueDateLabel"),
    progressLabel: document.getElementById("progressLabel"),
    progressTasks: document.getElementById("progressTasks"),
    projectProgressBar: document.getElementById("projectProgressBar"),

    tasksTabCount: document.getElementById("tasksTabCount"),
    membersTabCount: document.getElementById("membersTabCount"),
    tasksPanel: document.getElementById("tasksPanel"),
    membersPanel: document.getElementById("membersPanel"),
    activityPanel: document.getElementById("activityPanel"),

    taskSearch: document.getElementById("taskSearch"),
    taskStatusFilter: document.getElementById("taskStatusFilter"),
    taskAssigneeFilter: document.getElementById("taskAssigneeFilter"),
    tasksTableBody: document.getElementById("tasksTableBody"),
    taskResultsText: document.getElementById("taskResultsText"),
    pageNumber: document.getElementById("pageNumber"),
    previousPage: document.getElementById("previousPage"),
    nextPage: document.getElementById("nextPage"),

    membersGrid: document.getElementById("membersGrid"),
    membersEmptyState: document.getElementById("membersEmptyState"),
    activityList: document.getElementById("activityList"),
    activityEmptyState: document.getElementById("activityEmptyState"),

    projectModal: document.getElementById("projectModal"),
    projectForm: document.getElementById("projectForm"),
    projectModalTitle: document.getElementById("projectModalTitle"),
    editProjectName: document.getElementById("editProjectName"),
    editProjectDescription: document.getElementById("editProjectDescription"),
    editProjectLead: document.getElementById("editProjectLead"),
    editProjectStatus: document.getElementById("editProjectStatus"),
    editProjectStart: document.getElementById("editProjectStart"),
    editProjectDue: document.getElementById("editProjectDue"),
    editProjectDepartments: document.getElementById("editProjectDepartments"),
    projectFormMessage: document.getElementById("projectFormMessage"),

    taskModal: document.getElementById("taskModal"),
    taskForm: document.getElementById("taskForm"),
    taskModalTitle: document.getElementById("taskModalTitle"),
    editTaskId: document.getElementById("editTaskId"),
    editTaskTitle: document.getElementById("editTaskTitle"),
    editTaskDescription: document.getElementById("editTaskDescription"),
    editTaskAssignee: document.getElementById("editTaskAssignee"),
    editTaskDue: document.getElementById("editTaskDue"),
    editTaskStatus: document.getElementById("editTaskStatus"),
    taskFormMessage: document.getElementById("taskFormMessage"),
    deleteTaskButton: document.getElementById("deleteTaskButton"),

    memberModal: document.getElementById("memberModal"),
    memberForm: document.getElementById("memberForm"),
    newMemberSelect: document.getElementById("newMemberSelect"),
    memberFormMessage: document.getElementById("memberFormMessage"),

    toast: document.getElementById("toast")
};

let state = loadState();
let currentPage = 1;
let toastTimeout;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (
                parsed.project &&
                Array.isArray(parsed.tasks) &&
                Array.isArray(parsed.memberIds) &&
                Array.isArray(parsed.activity)
            ) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn("Could not load saved project data.", error);
    }

    return clone(initialState);
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Could not save project data.", error);
        showToast("Could not save changes in this browser.");
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getEmployee(id) {
    return employees.find(employee => employee.id === Number(id));
}

function getEmployeeName(id) {
    return getEmployee(id)?.name || "Unknown employee";
}

function getInitials(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function formatDate(value) {
    if (!value) return "Not set";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "Not set";

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    }).format(date);
}

function isOverdue(date, status) {
    if (!date || status === "done" || status === "completed" || status === "cancelled") {
        return false;
    }

    const dueDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 2800);
}

function recordActivity(actorId, message, target, icon = "history") {
    state.activity.unshift({
        id: Date.now() + Math.random(),
        actorId,
        message,
        target,
        icon,
        createdAt: new Date().toISOString()
    });

    saveState();
}

function openModal(modal) {
    if (!modal.open) modal.showModal();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal?.open) modal.close();
}

/* Project summary and progress */

function renderProjectSummary() {
    const project = state.project;
    const lead = getEmployee(project.leadId);

    const completedTasks = state.tasks.filter(task => task.status === "done").length;
    const totalTasks = state.tasks.length;
    const progress = totalTasks === 0
        ? 0
        : Math.round((completedTasks / totalTasks) * 100);

    elements.breadcrumbName.textContent = project.name;
    elements.projectNameHeading.textContent = project.name;
    elements.projectDescriptionText.textContent = project.description || "No description provided.";
    elements.projectLead.textContent = lead?.name || "Not assigned";
    elements.projectStartDate.textContent = formatDate(project.startDate);
    elements.projectDueDate.textContent = formatDate(project.dueDate);

    const overdue = isOverdue(project.dueDate, project.status);
    elements.dueDateLabel.textContent = overdue ? "Overdue — due date" : "Due date";
    elements.projectDueDate.parentElement.parentElement.classList.toggle("overdue", overdue);

    const departmentBadges = project.departments.map(department => `
        <span class="badge">${escapeHtml(department)}</span>
    `).join("");

    elements.projectBadges.innerHTML = `
        <span class="status-badge status-${escapeHtml(project.status)}">
            ${escapeHtml(STATUS_LABELS[project.status] || project.status)}
        </span>
        ${departmentBadges}
        ${overdue ? `
            <span class="overdue-badge">
                <span class="material-symbols-outlined">alarm</span>
                Overdue
            </span>
        ` : ""}
    `;

    elements.progressLabel.textContent = `Progress (${progress}%)`;
    elements.progressTasks.textContent = `${completedTasks} of ${totalTasks} tasks done`;
    elements.projectProgressBar.style.width = `${progress}%`;

    elements.tasksTabCount.textContent = totalTasks;
    elements.membersTabCount.textContent = state.memberIds.length;
}

/* Task search and filters */

function renderAssigneeFilters() {
    const previousValue = elements.taskAssigneeFilter.value;

    elements.taskAssigneeFilter.innerHTML = `
        <option value="all">All assignees</option>
        ${state.memberIds.map(id => {
            const employee = getEmployee(id);
            if (!employee) return "";

            return `
                <option value="${employee.id}">
                    ${escapeHtml(employee.name)}
                </option>
            `;
        }).join("")}
    `;

    if (
        [...elements.taskAssigneeFilter.options]
            .some(option => option.value === previousValue)
    ) {
        elements.taskAssigneeFilter.value = previousValue;
    }
}

function getFilteredTasks() {
    const query = elements.taskSearch.value.trim().toLowerCase();
    const selectedStatus = elements.taskStatusFilter.value;
    const selectedAssignee = elements.taskAssigneeFilter.value;

    return state.tasks.filter(task => {
        const assignee = getEmployeeName(task.assigneeId).toLowerCase();
        const searchableText = `${task.title} ${task.description || ""} ${assignee}`.toLowerCase();

        const matchesSearch = searchableText.includes(query);
        const matchesStatus =
            selectedStatus === "all" || task.status === selectedStatus;
        const matchesAssignee =
            selectedAssignee === "all" ||
            task.assigneeId === Number(selectedAssignee);

        return matchesSearch && matchesStatus && matchesAssignee;
    });
}

function renderTaskRow(task) {
    const employee = getEmployee(task.assigneeId);
    const overdue = isOverdue(task.dueDate, task.status);
    const canChangeStatus = task.assigneeId === CURRENT_USER_ID;

    return `
        <tr>
            <td class="task-title-cell">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description
                    ? `<div class="task-description">${escapeHtml(task.description)}</div>`
                    : ""}
            </td>

            <td class="assignee-cell">
                <div class="assignee">
                    <span class="avatar">${escapeHtml(getInitials(employee?.name))}</span>
                    <span class="assignee-name">${escapeHtml(employee?.name || "Unassigned")}</span>
                    ${task.assigneeId === CURRENT_USER_ID
                        ? `<span class="you-badge">YOU</span>`
                        : ""}
                </div>
            </td>

            <td>
                <span class="task-date ${overdue ? "overdue" : ""}">
                    ${escapeHtml(formatDate(task.dueDate))}
                    ${overdue ? " · Overdue" : ""}
                </span>
            </td>

            <td>
                <select
                    class="task-status-select status-${escapeHtml(task.status)}"
                    data-action="change-status"
                    data-task-id="${task.id}"
                    aria-label="Change status for ${escapeHtml(task.title)}"
                    ${canChangeStatus ? "" : "disabled"}
                    title="${canChangeStatus
                        ? "Change your task status"
                        : "You can only change the status of your own tasks"}"
                >
                    ${["todo", "in_progress", "done"].map(status => `
                        <option value="${status}" ${task.status === status ? "selected" : ""}>
                            ${escapeHtml(STATUS_LABELS[status])}
                        </option>
                    `).join("")}
                </select>
            </td>

            <td class="action-cell">
                <button
                    type="button"
                    class="icon-button"
                    data-action="edit-task"
                    data-task-id="${task.id}"
                    aria-label="Edit ${escapeHtml(task.title)}"
                    title="Edit task"
                >
                    <span class="material-symbols-outlined">edit</span>
                </button>
            </td>
        </tr>
    `;
}

function renderTasks() {
    const filteredTasks = getFilteredTasks();
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));

    currentPage = Math.min(currentPage, totalPages);
    currentPage = Math.max(currentPage, 1);

    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    const visibleTasks = filteredTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);

    elements.tasksTableBody.innerHTML = visibleTasks.length
        ? visibleTasks.map(renderTaskRow).join("")
        : `<tr><td colspan="5"><div class="empty-state">No tasks match these filters.</div></td></tr>`;

    const firstResult = filteredTasks.length ? startIndex + 1 : 0;
    const lastResult = Math.min(startIndex + TASKS_PER_PAGE, filteredTasks.length);

    elements.taskResultsText.textContent =
        `Showing ${firstResult}–${lastResult} of ${filteredTasks.length} tasks`;

    elements.pageNumber.textContent = `${currentPage} / ${totalPages}`;
    elements.previousPage.disabled = currentPage <= 1;
    elements.nextPage.disabled = currentPage >= totalPages;
}

/* Task create and edit */

function fillEmployeeSelect(select, allowedIds = employees.map(employee => employee.id)) {
    select.innerHTML = allowedIds.map(id => {
        const employee = getEmployee(id);
        if (!employee) return "";

        return `
            <option value="${employee.id}">
                ${escapeHtml(employee.name)} — ${escapeHtml(employee.jobTitle)}
            </option>
        `;
    }).join("");
}

function openTaskForm(taskId = null) {
    elements.taskForm.reset();
    elements.taskFormMessage.textContent = "";
    elements.editTaskId.value = taskId || "";

    fillEmployeeSelect(elements.editTaskAssignee, state.memberIds);

    const task = taskId
        ? state.tasks.find(item => item.id === Number(taskId))
        : null;

    if (taskId && !task) {
        showToast("Task not found.");
        return;
    }

    if (task) {
        elements.taskModalTitle.textContent = "Edit task";
        elements.editTaskTitle.value = task.title;
        elements.editTaskDescription.value = task.description || "";
        elements.editTaskAssignee.value = String(task.assigneeId);
        elements.editTaskDue.value = task.dueDate || "";
        elements.editTaskStatus.value = task.status;
        elements.deleteTaskButton.hidden = false;
    } else {
        elements.taskModalTitle.textContent = "Add task";
        elements.editTaskAssignee.value = String(CURRENT_USER_ID);
        elements.editTaskDue.value = "";
        elements.editTaskStatus.value = "todo";
        elements.deleteTaskButton.hidden = true;
    }

    openModal(elements.taskModal);
    elements.editTaskTitle.focus();
}

function saveTask(event) {
    event.preventDefault();

    const title = elements.editTaskTitle.value.trim();
    const taskId = Number(elements.editTaskId.value);
    const assigneeId = Number(elements.editTaskAssignee.value);

    if (!title) {
        elements.taskFormMessage.textContent = "Enter a task title.";
        return;
    }

    if (!state.memberIds.includes(assigneeId)) {
        elements.taskFormMessage.textContent =
            "Choose someone who is already a project member.";
        return;
    }

    const status = elements.editTaskStatus.value;

    if (!["todo", "in_progress", "done"].includes(status)) {
        elements.taskFormMessage.textContent = "Choose a valid status.";
        return;
    }

    if (taskId) {
        const task = state.tasks.find(item => item.id === taskId);
        if (!task) return;

        const oldAssignee = task.assigneeId;
        const oldStatus = task.status;
        const oldTitle = task.title;

        Object.assign(task, {
            title,
            description: elements.editTaskDescription.value.trim(),
            assigneeId,
            dueDate: elements.editTaskDue.value,
            status
        });

        if (oldAssignee !== assigneeId) {
            recordActivity(
                CURRENT_USER_ID,
                `reassigned "${oldTitle}" to ${getEmployeeName(assigneeId)}`,
                oldTitle,
                "assignment_ind"
            );
        }

        if (oldStatus !== status) {
            recordActivity(
                CURRENT_USER_ID,
                `changed the status of "${oldTitle}" to ${STATUS_LABELS[status]}`,
                oldTitle,
                "task_alt"
            );
        }

        if (oldTitle !== title) {
            recordActivity(CURRENT_USER_ID, "renamed a task", title, "edit_note");
        }

        if (oldAssignee === assigneeId && oldStatus === status && oldTitle === title) {
            recordActivity(CURRENT_USER_ID, "updated task details", title, "edit_note");
        }

        showToast("Task updated.");
    } else {
        const newTask = {
            id: Date.now(),
            title,
            description: elements.editTaskDescription.value.trim(),
            assigneeId,
            dueDate: elements.editTaskDue.value,
            status
        };

        state.tasks.unshift(newTask);
        recordActivity(CURRENT_USER_ID, "created a task", title, "add_task");
        showToast("Task added.");
    }

    saveState();
    closeModal("taskModal");
    currentPage = 1;
    renderAll();
}

function deleteCurrentTask() {
    const taskId = Number(elements.editTaskId.value);
    const task = state.tasks.find(item => item.id === taskId);

    if (!task) return;

    if (!confirm(`Delete "${task.title}"? This cannot be undone in this demo.`)) {
        return;
    }

    state.tasks = state.tasks.filter(item => item.id !== taskId);
    recordActivity(CURRENT_USER_ID, "deleted a task", task.title, "delete");
    saveState();

    closeModal("taskModal");
    currentPage = 1;
    renderAll();
    showToast("Task deleted.");
}

function changeOwnTaskStatus(taskId, newStatus) {
    const task = state.tasks.find(item => item.id === Number(taskId));

    if (!task) return;

    if (task.assigneeId !== CURRENT_USER_ID) {
        showToast("You can only change your own tasks.");
        renderTasks();
        return;
    }

    if (!["todo", "in_progress", "done"].includes(newStatus)) {
        renderTasks();
        return;
    }

    if (task.status === newStatus) return;

    task.status = newStatus;

    recordActivity(
        CURRENT_USER_ID,
        `changed the status of "${task.title}" to ${STATUS_LABELS[newStatus]}`,
        task.title,
        "task_alt"
    );

    saveState();
    renderAll();
    showToast("Task status updated.");
}

/* Project editing */

function openProjectForm() {
    elements.projectForm.reset();
    elements.projectFormMessage.textContent = "";

    fillEmployeeSelect(elements.editProjectLead);

    const project = state.project;

    elements.projectModalTitle.textContent = "Manage project";
    elements.editProjectName.value = project.name;
    elements.editProjectDescription.value = project.description || "";
    elements.editProjectLead.value = String(project.leadId);
    elements.editProjectStatus.value = project.status;
    elements.editProjectStart.value = project.startDate;
    elements.editProjectDue.value = project.dueDate;
    elements.editProjectDepartments.value = project.departments.join(", ");

    openModal(elements.projectModal);
}

function saveProject(event) {
    event.preventDefault();

    const name = elements.editProjectName.value.trim();
    const startDate = elements.editProjectStart.value;
    const dueDate = elements.editProjectDue.value;

    if (!name) {
        elements.projectFormMessage.textContent = "Enter a project name.";
        return;
    }

    if (startDate && dueDate && dueDate < startDate) {
        elements.projectFormMessage.textContent =
            "The due date cannot be earlier than the start date.";
        return;
    }

    const previousName = state.project.name;
    const previousStatus = state.project.status;

    state.project.name = name;
    state.project.description = elements.editProjectDescription.value.trim();
    state.project.leadId = Number(elements.editProjectLead.value);
    state.project.status = elements.editProjectStatus.value;
    state.project.startDate = startDate;
    state.project.dueDate = dueDate;
    state.project.departments = [
        ...new Set(
            elements.editProjectDepartments.value
                .split(",")
                .map(value => value.trim())
                .filter(Boolean)
        )
    ];

    if (previousName !== name) {
        recordActivity(CURRENT_USER_ID, "renamed the project", name, "edit_note");
    }

    if (previousStatus !== state.project.status) {
        recordActivity(
            CURRENT_USER_ID,
            `changed the project status to ${STATUS_LABELS[state.project.status]}`,
            name,
            "sync"
        );
    }

    if (previousName === name && previousStatus === state.project.status) {
        recordActivity(CURRENT_USER_ID, "updated project details", name, "edit_note");
    }

    saveState();
    closeModal("projectModal");
    renderAll();
    showToast("Project updated.");
}

/* Project members */

function openMemberForm() {
    elements.memberForm.reset();
    elements.memberFormMessage.textContent = "";

    const availableEmployees = employees
        .filter(employee => !state.memberIds.includes(employee.id));

    if (availableEmployees.length === 0) {
        showToast("All available demo employees are already members.");
        return;
    }

    fillEmployeeSelect(
        elements.newMemberSelect,
        availableEmployees.map(employee => employee.id)
    );

    openModal(elements.memberModal);
}

function addMember(event) {
    event.preventDefault();

    const memberId = Number(elements.newMemberSelect.value);
    const employee = getEmployee(memberId);

    if (!employee) {
        elements.memberFormMessage.textContent = "Select an employee.";
        return;
    }

    if (state.memberIds.includes(memberId)) {
        elements.memberFormMessage.textContent = "This employee is already a member.";
        return;
    }

    state.memberIds.push(memberId);

    recordActivity(
        CURRENT_USER_ID,
        `added ${employee.name} to the project`,
        state.project.name,
        "person_add"
    );

    saveState();
    closeModal("memberModal");
    renderAll();
    showToast(`${employee.name} added to the project.`);
}

function removeMember(memberId) {
    const employee = getEmployee(memberId);

    if (!employee || !state.memberIds.includes(memberId)) return;

    if (memberId === state.project.leadId) {
        showToast("Assign a different project lead before removing this member.");
        return;
    }

    const assignedTasks = state.tasks.filter(task => task.assigneeId === memberId);

    if (assignedTasks.length > 0) {
        showToast("Reassign this member's tasks before removing them.");
        return;
    }

    if (!confirm(`Remove ${employee.name} from this project?`)) return;

    state.memberIds = state.memberIds.filter(id => id !== memberId);

    recordActivity(
        CURRENT_USER_ID,
        `removed ${employee.name} from the project`,
        state.project.name,
        "person_remove"
    );

    saveState();
    renderAll();
    showToast(`${employee.name} removed.`);
}

function renderMembers() {
    const members = state.memberIds
        .map(getEmployee)
        .filter(Boolean);

    elements.membersGrid.innerHTML = members.map(employee => {
        const isLead = employee.id === state.project.leadId;
        const isCurrentUser = employee.id === CURRENT_USER_ID;
        const hasTasks = state.tasks.some(task => task.assigneeId === employee.id);

        return `
            <article class="member-card">
                <span class="avatar">${escapeHtml(getInitials(employee.name))}</span>

                <div class="member-details">
                    <span class="member-name">${escapeHtml(employee.name)}</span>
                    <span class="member-role">${escapeHtml(employee.jobTitle)}</span>
                    <span class="member-department">${escapeHtml(employee.department)}</span>

                    ${isLead ? `<span class="role-badge">Project lead</span>` : ""}
                    ${isCurrentUser ? `<span class="role-badge">You</span>` : ""}
                </div>

                <div class="member-actions">
                    ${!isLead ? `
                        <button
                            type="button"
                            class="icon-button"
                            data-action="remove-member"
                            data-member-id="${employee.id}"
                            title="${hasTasks ? "Reassign their tasks first" : "Remove member"}"
                            aria-label="Remove ${escapeHtml(employee.name)}"
                        >
                            <span class="material-symbols-outlined">person_remove</span>
                        </button>
                    ` : ""}
                </div>
            </article>
        `;
    }).join("");

    elements.membersEmptyState.hidden = members.length > 0;
    elements.membersGrid.hidden = members.length === 0;
}

/* Activity */

function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return formatDate(value.slice(0, 10));
}

function renderActivity() {
    elements.activityList.innerHTML = state.activity.map(item => `
        <article class="activity-item">
            <div class="activity-dot">
                <span class="material-symbols-outlined">${escapeHtml(item.icon || "history")}</span>
            </div>

            <div class="activity-content">
                <strong>${escapeHtml(getEmployeeName(item.actorId))}</strong>
                ${escapeHtml(item.message)}
                ${item.target ? `<strong>${escapeHtml(item.target)}</strong>` : ""}
                <span class="activity-time">${escapeHtml(relativeTime(item.createdAt))}</span>
            </div>
        </article>
    `).join("");

    elements.activityEmptyState.hidden = state.activity.length > 0;
    elements.activityList.hidden = state.activity.length === 0;
}

/* Tabs */

function activateTab(tabName) {
    const panels = {
        tasks: elements.tasksPanel,
        members: elements.membersPanel,
        activity: elements.activityPanel
    };

    document.querySelectorAll(".tab").forEach(tab => {
        const active = tab.dataset.tab === tabName;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });

    Object.entries(panels).forEach(([name, panel]) => {
        panel.hidden = name !== tabName;
    });
}

/* Rendering and event handlers */

function renderAll() {
    renderProjectSummary();
    renderAssigneeFilters();
    renderTasks();
    renderMembers();
    renderActivity();
}

function handleTaskTableClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "edit-task") {
        openTaskForm(Number(button.dataset.taskId));
    }

    if (action === "remove-member") {
        removeMember(Number(button.dataset.memberId));
    }
}

function handleTaskTableChange(event) {
    const select = event.target.closest('[data-action="change-status"]');
    if (!select) return;

    changeOwnTaskStatus(Number(select.dataset.taskId), select.value);
}

function initializePage() {
    document.getElementById("manageProjectButton")
        .addEventListener("click", openProjectForm);

    document.getElementById("addTaskButton")
        .addEventListener("click", () => openTaskForm());

    document.getElementById("addMemberButton")
        .addEventListener("click", openMemberForm);

    elements.taskSearch.addEventListener("input", () => {
        currentPage = 1;
        renderTasks();
    });

    elements.taskStatusFilter.addEventListener("change", () => {
        currentPage = 1;
        renderTasks();
    });

    elements.taskAssigneeFilter.addEventListener("change", () => {
        currentPage = 1;
        renderTasks();
    });

    elements.previousPage.addEventListener("click", () => {
        currentPage--;
        renderTasks();
    });

    elements.nextPage.addEventListener("click", () => {
        currentPage++;
        renderTasks();
    });

    elements.tasksTableBody.addEventListener("click", handleTaskTableClick);
    elements.tasksTableBody.addEventListener("change", handleTaskTableChange);
    elements.membersGrid.addEventListener("click", handleTaskTableClick);

    elements.taskForm.addEventListener("submit", saveTask);
    elements.projectForm.addEventListener("submit", saveProject);
    elements.memberForm.addEventListener("submit", addMember);

    elements.deleteTaskButton.addEventListener("click", deleteCurrentTask);

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    // Close dialogs when the user clicks the backdrop.
    document.querySelectorAll("dialog.modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                modal.close();
            }
        });
    });

    renderAll();
    activateTab("tasks");
}

initializePage();
