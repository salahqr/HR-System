'use strict';

const STORAGE_KEY = 'presencehr_departments_v1';

const initialDepartments = [
    {
        id: 1,
        name: 'People & Operations',
        head: 'Sara Ali',
        employees: 6,
        status: 'active'
    },
    {
        id: 2,
        name: 'Design & Product',
        head: 'David Lin',
        employees: 8,
        status: 'active'
    },
    {
        id: 3,
        name: 'Engineering',
        head: 'Mona Zaki',
        employees: 18,
        status: 'active'
    },
    {
        id: 4,
        name: 'Marketing',
        head: 'Layla Mahmoud',
        employees: 7,
        status: 'active'
    },
    {
        id: 5,
        name: 'Finance & Accounting',
        head: '',
        employees: 5,
        status: 'active'
    },
    {
        id: 6,
        name: 'Customer Success',
        head: 'Tarek Youssef',
        employees: 4,
        status: 'inactive'
    }
];

const tableBody = document.getElementById('departments-table-body');
const countLabel = document.getElementById('department-count');
const resultsLabel = document.getElementById('results-label');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const emptyState = document.getElementById('empty-state');

const dialog = document.getElementById('department-dialog');
const form = document.getElementById('department-form');
const formError = document.getElementById('form-error');
const toast = document.getElementById('toast');

let departments = loadDepartments();
let toastTimeout;

/* Load saved data, or use initial demo data. */

function loadDepartments() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved === null) {
            return initialDepartments.map(department => ({ ...department }));
        }

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {
            throw new Error('Saved departments must be an array.');
        }

        return parsed;
    } catch (error) {
        console.error('Could not load departments:', error);
        return initialDepartments.map(department => ({ ...department }));
    }
}

/* Save the current data in the browser. */

function saveDepartments() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(departments));
    } catch (error) {
        console.error('Could not save departments:', error);
        showToast('Could not save changes in this browser.');
    }
}

/* Prevent HTML entered by a user from becoming executable markup. */

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

/* Generate initials for the department head avatar. */

function getInitials(name) {
    return String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('');
}

/* Search and filter. */

function getVisibleDepartments() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;

    return departments.filter(department => {
        const matchesSearch =
            `${department.name} ${department.head}`
                .toLowerCase()
                .includes(search);

        const matchesStatus =
            selectedStatus === 'all' ||
            department.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });
}

/* Render the table using the current department data. */

function renderDepartments() {
    const visibleDepartments = getVisibleDepartments();

    countLabel.textContent =
        `${departments.length} department${departments.length === 1 ? '' : 's'}`;

    resultsLabel.textContent =
        `Showing ${visibleDepartments.length} of ${departments.length} departments`;

    emptyState.classList.toggle(
        'hidden',
        visibleDepartments.length > 0
    );

    tableBody.innerHTML = visibleDepartments.map(department => {
        const headMarkup = department.head
            ? `
                <div class="head-cell">
                    <div class="avatar">
                        ${escapeHtml(getInitials(department.head))}
                    </div>
                    <span>${escapeHtml(department.head)}</span>
                </div>
            `
            : '<span class="no-head">No head assigned</span>';

        const statusAction = department.status === 'active'
            ? `
                <button
                    class="small-button"
                    type="button"
                    data-action="archive"
                    data-id="${Number(department.id)}"
                >Archive</button>
            `
            : `
                <button
                    class="small-button restore"
                    type="button"
                    data-action="restore"
                    data-id="${Number(department.id)}"
                >Restore</button>
            `;

        return `
            <tr>
                <td>
                    <span class="department-name">
                        ${escapeHtml(department.name)}
                    </span>
                </td>

                <td>${headMarkup}</td>

                <td>
                    <span class="employee-count">
                        ${Number(department.employees) || 0}
                    </span>
                </td>

                <td>
                    <span class="status ${department.status}">
                        ${escapeHtml(department.status)}
                    </span>
                </td>

                <td class="actions-cell">
                    <div class="row-actions">
                        <button
                            class="small-button edit"
                            type="button"
                            data-action="edit"
                            data-id="${Number(department.id)}"
                        >Update</button>

                        ${statusAction}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/* Open a blank form for adding a department. */

function openAddDialog() {
    form.reset();

    document.getElementById('department-id').value = '';
    document.getElementById('dialog-title').textContent = 'Add department';
    document.getElementById('save-department-button').textContent =
        'Save department';

    document.getElementById('employee-count').value = '0';

    formError.classList.add('hidden');

    dialog.showModal();
    document.getElementById('department-name').focus();
}

/* Open the form with existing department details. */

function openEditDialog(id) {
    const department = departments.find(
        item => Number(item.id) === Number(id)
    );

    if (!department) return;

    document.getElementById('department-id').value = department.id;
    document.getElementById('department-name').value = department.name;
    document.getElementById('department-head').value = department.head || '';
    document.getElementById('employee-count').value = department.employees;
    document.getElementById('department-status').value = department.status;

    document.getElementById('dialog-title').textContent = 'Update department';
    document.getElementById('save-department-button').textContent =
        'Save changes';

    formError.classList.add('hidden');

    dialog.showModal();
    document.getElementById('department-name').focus();
}

/* Display form validation errors. */

function showFormError(message) {
    formError.textContent = message;
    formError.classList.remove('hidden');
}

/* Display a small notification. */

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2800);
}

/* Add a department or update an existing one. */

function handleFormSubmit(event) {
    event.preventDefault();

    formError.classList.add('hidden');

    const idValue = document.getElementById('department-id').value;
    const name = document.getElementById('department-name').value.trim();
    const head = document.getElementById('department-head').value.trim();
    const employeesInput = document.getElementById('employee-count');
    const employees = Number(employeesInput.value);
    const status = document.getElementById('department-status').value;

    if (!name) {
        showFormError('Please enter a department name.');
        return;
    }

    if (
        employeesInput.value.trim() === '' ||
        !Number.isInteger(employees) ||
        employees < 0 ||
        employees > 100000
    ) {
        showFormError('Enter a valid employee count.');
        return;
    }

    const duplicate = departments.some(department =>
        department.name.toLowerCase() === name.toLowerCase() &&
        Number(department.id) !== Number(idValue)
    );

    if (duplicate) {
        showFormError('A department with this name already exists.');
        return;
    }

    if (idValue) {
        departments = departments.map(department =>
            Number(department.id) === Number(idValue)
                ? { ...department, name, head, employees, status }
                : department
        );

        showToast('Department updated successfully.');
    } else {
        const nextId = departments.reduce(
            (max, department) =>
                Math.max(max, Number(department.id) || 0),
            0
        ) + 1;

        departments.push({
            id: nextId,
            name,
            head,
            employees,
            status
        });

        showToast('Department added successfully.');
    }

    saveDepartments();
    renderDepartments();
    dialog.close();
}

/* Handle Update, Archive, and Restore button clicks. */

function handleTableAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    const department = departments.find(
        item => Number(item.id) === id
    );

    if (!department) return;

    if (action === 'edit') {
        openEditDialog(id);
        return;
    }

    if (action === 'archive') {
        department.status = 'inactive';
        saveDepartments();
        renderDepartments();
        showToast('Department archived.');
        return;
    }

    if (action === 'restore') {
        department.status = 'active';
        saveDepartments();
        renderDepartments();
        showToast('Department restored.');
    }
}

/* Reset the browser's demo data. */

function resetDemoData() {
    const confirmed = window.confirm(
        'Reset all department changes and restore the original demo data?'
    );

    if (!confirmed) return;

    departments = initialDepartments.map(
        department => ({ ...department })
    );

    saveDepartments();

    searchInput.value = '';
    statusFilter.value = 'all';

    renderDepartments();
    showToast('Demo data has been reset.');
}

/* Event listeners. */

document
    .getElementById('add-department-button')
    .addEventListener('click', openAddDialog);

document
    .getElementById('close-dialog-button')
    .addEventListener('click', () => dialog.close());

document
    .getElementById('cancel-dialog-button')
    .addEventListener('click', () => dialog.close());

form.addEventListener('submit', handleFormSubmit);

tableBody.addEventListener('click', handleTableAction);

searchInput.addEventListener('input', renderDepartments);

statusFilter.addEventListener('change', renderDepartments);

document
    .getElementById('reset-demo-data')
    .addEventListener('click', resetDemoData);

/* Initial page rendering. */

renderDepartments();
