
"use strict";

/*
 * Demo data for the Projects page.
 *
 * This is temporary frontend data, not data from Laravel.
 * Replace the data loading and createProject() functions with
 * API requests when your backend endpoints are ready.
 */

const projects = [
    {
        id: 1,
        name: "Quarterly Workforce Review",
        description: "Review workforce metrics and prepare the quarterly report.",
        status: "in_progress",
        departments: ["People & Operations", "Finance"],
        progress: 40,
        completedTasks: 4,
        totalTasks: 10,
        owner: "Marcus Reed",
        dueDate: "2024-10-18"
    },
    {
        id: 2,
        name: "Biometric Enrollment Sync",
        description: "Synchronize biometric enrollment records across the HR system.",
        status: "completed",
        departments: ["IT & Systems", "Operations"],
        progress: 100,
        completedTasks: 12,
        totalTasks: 12,
        owner: "Sara Ali",
        dueDate: "2024-11-04",
        completedDate: "2024-11-04"
    },
    {
        id: 3,
        name: "HR Portal Modernization",
        description: "Improve the employee portal and its project management features.",
        status: "in_progress",
        departments: ["People & Operations", "Engineering"],
        progress: 85,
        completedTasks: 17,
        totalTasks: 20,
        owner: "David Lin",
        dueDate: "2024-11-22"
    }
];

const statusLabels = {
    not_started: "Not started",
    in_progress: "In progress",
    on_hold: "On hold",
    completed: "Completed",
    cancelled: "Cancelled"
};

const elements = {
    search: document.getElementById("projectSearchInput"),
    status: document.getElementById("statusFilterSelect"),
    grid: document.getElementById("projectsGrid"),
    count: document.getElementById("projectCount"),
    results: document.getElementById("resultsCount"),
    emptyState: document.getElementById("emptyState"),
    emptyMessage: document.getElementById("emptyMessage"),
    clearFilters: document.getElementById("clearFiltersButton"),
    newProject: document.getElementById("newProjectButton"),
    modal: document.getElementById("projectModal"),
    closeModal: document.getElementById("closeModalButton"),
    cancelModal: document.getElementById("cancelModalButton"),
    form: document.getElementById("projectForm"),
    name: document.getElementById("projectName"),
    description: document.getElementById("projectDescription"),
    projectStatus: document.getElementById("projectStatus"),
    dueDate: document.getElementById("projectDueDate"),
    formMessage: document.getElementById("formMessage")
};

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

function getInitials(name) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function formatDate(dateString) {
    if (!dateString) {
        return "No due date";
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "No due date";
    }

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    }).format(date);
}

function isOverdue(project) {
    if (project.status === "completed" || !project.dueDate) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(`${project.dueDate}T00:00:00`);

    return dueDate < today;
}

function renderProject(project) {
    const statusLabel = statusLabels[project.status] || "Unknown";
    const overdue = isOverdue(project);
    const ownerInitials = getInitials(project.owner);

    const departments = project.departments
        .map(department => `
            <span class="department-chip">
                ${escapeHtml(department)}
            </span>
        `)
        .join("");

    const overdueBadge = overdue
        ? `
            <span class="overdue-badge">
                <span class="material-symbols-outlined">error</span>
                Overdue
            </span>
        `
        : "";

    const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));

    let dateText = `Due ${formatDate(project.dueDate)}`;
    let dateClass = "due-date";

    if (project.status === "completed" && project.completedDate) {
        dateText = `Completed ${formatDate(project.completedDate)}`;
        dateClass += " completed";
    } else if (overdue) {
        dateClass += " overdue";
    }

    return `
        <article class="project-card" data-project-id="${Number(project.id)}">
            <div class="project-content">
                <div class="project-header">
                    <h2 class="project-title">
                        ${escapeHtml(project.name)}
                    </h2>

                    <div class="project-badges">
                        ${overdueBadge}
                        <span class="status-badge status-${escapeHtml(project.status)}">
                            ${escapeHtml(statusLabel)}
                        </span>
                    </div>
                </div>

                ${project.description
                    ? `<p class="project-description">${escapeHtml(project.description)}</p>`
                    : ""
                }

                <div class="department-list">
                    ${departments}
                </div>

                <div class="progress-section">
                    <div class="progress-heading">
                        <span>Progress</span>
                        <span class="progress-value">${progress}%</span>
                    </div>

                    <div
                        class="progress-track"
                        role="progressbar"
                        aria-label="Project progress"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="${progress}"
                    >
                        <div
                            class="progress-bar"
                            style="width: ${progress}%"
                        ></div>
                    </div>
                </div>
            </div>

            <div class="project-footer">
                <div class="project-owner">
                    <div class="owner-avatar">${escapeHtml(ownerInitials)}</div>
                    <span class="owner-name">${escapeHtml(project.owner)}</span>
                </div>

                <div class="project-meta">
                    <span>
                        ${Number(project.completedTasks) || 0}
                        of ${Number(project.totalTasks) || 0} tasks done
                    </span>
                    <span aria-hidden="true">•</span>
                    <span class="${dateClass}">${escapeHtml(dateText)}</span>
                </div>
            </div>
        </article>
    `;
}

function getFilteredProjects() {
    const query = elements.search.value.trim().toLowerCase();
    const selectedStatus = elements.status.value;

    return projects.filter(project => {
        const searchableText = [
            project.name,
            project.description,
            project.owner,
            ...project.departments
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(query);
        const matchesStatus =
            selectedStatus === "all" || project.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });
}

function renderProjects() {
    const filteredProjects = getFilteredProjects();

    elements.grid.innerHTML = filteredProjects
        .map(renderProject)
        .join("");

    elements.count.textContent =
        `${projects.length} ${projects.length === 1 ? "project" : "projects"}`;

    elements.results.textContent =
        `Showing ${filteredProjects.length} of ${projects.length} assigned projects`;

    elements.emptyState.hidden = filteredProjects.length !== 0;
    elements.grid.hidden = filteredProjects.length === 0;

    if (projects.length === 0) {
        elements.emptyMessage.textContent =
            "You are not on any project yet.";
    } else {
        elements.emptyMessage.textContent =
            "No projects match your search or selected status.";
    }
}

function openProjectModal() {
    elements.form.reset();
    elements.formMessage.textContent = "";
    elements.modal.showModal();
    elements.name.focus();
}

function closeProjectModal() {
    elements.modal.close();
}

function createProject(event) {
    event.preventDefault();

    const name = elements.name.value.trim();

    if (!name) {
        elements.formMessage.textContent = "Please enter a project name.";
        elements.name.focus();
        return;
    }

    const project = {
        id: Date.now(),
        name,
        description: elements.description.value.trim(),
        status: elements.projectStatus.value,
        departments: [],
        progress: elements.projectStatus.value === "completed" ? 100 : 0,
        completedTasks: 0,
        totalTasks: 0,
        owner: "Sara Ali",
        dueDate: elements.dueDate.value,
        completedDate: ""
    };

    if (project.status === "completed") {
        project.completedDate = new Date().toISOString().slice(0, 10);
    }

    projects.unshift(project);

    // Clear filters so the newly created project is visible.
    elements.search.value = "";
    elements.status.value = "all";

    renderProjects();
    closeProjectModal();
}

function clearFilters() {
    elements.search.value = "";
    elements.status.value = "all";
    renderProjects();
}

function initializeProjectsPage() {
    elements.search.addEventListener("input", renderProjects);
    elements.status.addEventListener("change", renderProjects);

    elements.newProject.addEventListener("click", openProjectModal);
    elements.closeModal.addEventListener("click", closeProjectModal);
    elements.cancelModal.addEventListener("click", closeProjectModal);
    elements.form.addEventListener("submit", createProject);
    elements.clearFilters.addEventListener("click", clearFilters);

    // Close the modal if the user clicks outside its content.
    elements.modal.addEventListener("click", event => {
        if (event.target === elements.modal) {
            closeProjectModal();
        }
    });

    renderProjects();
}

initializeProjectsPage();
