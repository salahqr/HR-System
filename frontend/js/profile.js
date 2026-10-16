'use strict';

/* =====================================================================
   PROFILE PAGE

   1. API         how the page talks to the server
   2. MOCK SERVER fake server for now (delete it when Laravel is ready)
   3. HELPERS     small tools used everywhere
   4. RENDER      draws the page (one function per tab)
   5. ACTIONS     what happens when you click a button
   6. START UP    loads the data and draws the page
   ===================================================================== */


/* =====================================================================
   1. API
   GET /auth/me   -> the person who is signed in
   GET /user/:id  -> { user, department, departments, face_profile,
                       attendance[], leave_requests[], warnings[], strikes[] }
   PUT /user/:id  -> send only the parts that changed (same shape as GET).
                     Laravel applies the rules and answers with the full record.

   To go live: set useMock to false, set base, delete section 2.
   ===================================================================== */
const API = {
  useMock: true,
  base: '/api',
};

// Where "Back to ..." goes, for example 'employees.html'. null = just show a message.
const LIST_URL = null;

async function request(method, path, body) {
  if (API.useMock) {
    return mockServer(method, path, body);
  }

  const response = await fetch(API.base + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Request failed (' + response.status + ')');
  }
  return response.json();
}

const api = {
  me: () => request('GET', '/auth/me'),
  get: (id) => request('GET', '/user/' + id),
  save: (id, changes) => request('PUT', '/user/' + id, changes),
};


/* =====================================================================
   2. MOCK SERVER
   Data lives in localStorage so changes survive a refresh.
   Preview as someone else: add ?as=2 (HR) or ?as=1 (Admin) to the URL.
   ===================================================================== */
const DB_KEY = 'presencehr-mock-v2';
const SESSION_KEY = 'presencehr-session';

const pad = (n) => String(n).padStart(2, '0');

const DEPARTMENT_NAMES = ['Corporate Ops', 'Human Resources', 'Engineering', 'Design'];
const DEPARTMENTS = DEPARTMENT_NAMES.map((name, index) => ({
  id: index + 1,
  name,
  work_start_time: '09:00',
  grace_period_minutes: 10,
  warnings_per_strike: 3,
  strike_amount: 50,
}));

/** Fake attendance for 1-14 October 2026 (weekends skipped). */
function makeAttendance(seed) {
  const rows = [];

  for (let day = 1; day <= 14; day++) {
    const weekday = new Date(2026, 9, day).getDay();
    if (weekday === 0 || weekday === 6) continue;

    const date = `2026-10-${pad(day)}`;
    const pattern = (day * seed) % 7;
    const row = {
      id: seed * 100 + day,
      date,
      come_in: null,
      get_out: null,
      break_minutes: 0,
      status: 'present',
      verification_method: 'face',
      edited_by: null,
      edit_reason: null,
    };

    if (pattern === 3 && seed % 2) {
      row.status = 'on_leave';
    } else {
      const isLate = pattern === 0;
      const minutes = isLate ? 9 * 60 + 12 + (day % 14) : 9 * 60 - (day % 6);
      row.come_in = `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
      if (day !== 14) { // today is still in progress
        row.get_out = `${date}T17:${pad(30 + (((day * seed) % 25) % 30))}`;
      }
      row.break_minutes = 30 + (day % 3) * 10;
      row.status = isLate ? 'late' : 'present';
    }
    rows.push(row);
  }
  return rows;
}

function makePerson(id, role, name, email, departmentId, jobTitle, hireDate, phone, salary, extra = {}) {
  const isAdmin = role === 'admin';
  return {
    user: {
      id, name, email, role, phone,
      address: '12 Main Street',
      department_id: isAdmin ? null : departmentId,
      job_title: isAdmin ? null : jobTitle,
      hire_date: isAdmin ? null : hireDate,
      salary: isAdmin ? null : salary,
      medical_allowance: isAdmin ? null : 10,
      normal_allowance: isAdmin ? null : 21,
      medical_used: isAdmin ? null : 0,
      normal_used: isAdmin ? null : (extra.normalUsed ?? 3),
      must_change_password: false,
      archived_at: null,
    },
    face_profile: isAdmin ? null : { status: extra.face || 'active', consent_at: hireDate + 'T09:00' },
    attendance: isAdmin ? [] : makeAttendance(id + 2),
    leave_requests: extra.leave || [],
    warnings: extra.warnings || [],
    strikes: extra.strikes || [],
  };
}

function makeWarning(id, date, reason, strikeId = null) {
  return {
    id, reason,
    issued_by: 2,
    issued_by_name: 'Sara Ali',
    strike_id: strikeId,
    revoked_at: null,
    revoked_reason: null,
    created_at: date,
  };
}

function makeLeave(id, type, kind, from, to, amount, note, status, decidedBy) {
  return {
    id, note, status, amount,
    leave_type: type,
    leave_kind: kind,
    start_date: from,
    end_date: to,
    leave_time: kind === 'early' ? '15:30' : null,
    approved_by: decidedBy ? 1 : null,
    approved_by_name: decidedBy || null,
    decision_comment: null,
  };
}

function makeSeedData() {
  return {
    departments: DEPARTMENTS,
    users: [
      makePerson(1, 'admin', 'Omar Khaled', 'omar@co.com', null, null, null, '+1 (555) 100-2000', null),

      makePerson(2, 'hr', 'Sara Ali', 'sara@co.com', 2, 'HR Manager', '2024-03-01', '+1 (555) 234-5678', 4200, {
        leave: [
          makeLeave(201, 'normal', 'full_day', '2026-10-22', '2026-10-23', 2, 'Family event', 'pending'),
          makeLeave(202, 'normal', 'full_day', '2026-08-10', '2026-08-12', 3, 'Summer break', 'approved', 'Omar Khaled'),
        ],
      }),

      makePerson(3, 'hr', 'Lina Haddad', 'lina@co.com', 2, 'HR Specialist', '2025-02-17', '+1 (555) 311-8890', 3500, {
        normalUsed: 6,
      }),

      makePerson(4, 'employee', 'Yousef Nasser', 'yousef@co.com', 3, 'Backend Developer', '2025-06-02', '+1 (555) 422-1170', 3900, {
        face: 'revoked',
        warnings: [
          makeWarning(401, '2026-07-08', 'Late three days in a row', 1),
          makeWarning(402, '2026-08-19', 'Left early without approval', 1),
          makeWarning(403, '2026-09-14', 'Late, no notice', 1),
          makeWarning(404, '2026-10-06', 'Late arrival'),
        ],
        strikes: [
          { id: 1, amount: 50, revoked_at: null, revoked_reason: null, created_at: '2026-09-14' },
        ],
        leave: [
          makeLeave(401, 'medical', 'early', '2026-10-09', '2026-10-09', 1, 'Clinic appointment', 'approved', 'Sara Ali'),
        ],
      }),

      makePerson(5, 'employee', 'Maya Saleh', 'maya@co.com', 4, 'Product Designer', '2025-09-15', '+1 (555) 507-3321', 3600, {
        warnings: [makeWarning(501, '2026-09-30', 'Missed check-in')],
        leave: [
          makeLeave(501, 'normal', 'full_day', '2026-10-28', '2026-10-28', 1, 'Personal errand', 'pending'),
        ],
      }),
    ],
  };
}

function loadDatabase() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) { /* storage blocked: fall through to fresh data */ }

  const fresh = makeSeedData();
  saveDatabase(fresh);
  return fresh;
}

function saveDatabase(database) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
  } catch (error) { /* storage blocked: changes will not persist */ }
}

/** Copies the changes into the target. Objects merge, arrays are replaced. */
function mergeChanges(target, changes) {
  for (const key in changes) {
    const value = changes[key];
    const isPlainObject = value && typeof value === 'object' && !Array.isArray(value);

    if (isPlainObject) {
      const current = target[key] && typeof target[key] === 'object' ? target[key] : {};
      target[key] = mergeChanges(current, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function buildResponse(database, record) {
  return {
    ...record,
    department: database.departments.find((d) => d.id === record.user.department_id) || null,
    departments: database.departments.map((d) => ({ id: d.id, name: d.name })),
  };
}

/* The rules below are what Laravel will do for real. */

/** Approving takes days from the balance, cancelling an approved request gives them back. */
function applyLeaveBalanceRule(record, before) {
  for (const request of record.leave_requests) {
    const previous = before.leave_requests.find((r) => r.id === request.id);
    if (!previous) continue;

    const usedField = request.leave_type + '_used';
    const wasApproved = previous.status === 'approved';

    if (!wasApproved && request.status === 'approved') record.user[usedField] += request.amount;
    if (wasApproved && request.status === 'cancelled') record.user[usedField] -= request.amount;
  }
}

/** Revoking a warning that belongs to a strike revokes that strike too. */
function applyRevokeWarningRule(record, before) {
  for (const warning of record.warnings) {
    const previous = before.warnings.find((w) => w.id === warning.id);
    const strike = record.strikes.find((s) => s.id === warning.strike_id);
    const justRevoked = previous && !previous.revoked_at && warning.revoked_at;

    if (justRevoked && strike && !strike.revoked_at) {
      strike.revoked_at = warning.revoked_at;
      strike.revoked_reason = 'Warning revoked';
    }
  }
}

/** A strike added by HR arrives as { id: 'new' }. The server fills in the rest. */
function applyNewStrikeRule(record, department, day) {
  for (const strike of record.strikes) {
    if (strike.id !== 'new') continue;
    Object.assign(strike, {
      id: Date.now(),
      amount: department.strike_amount,
      revoked_at: null,
      revoked_reason: null,
      created_at: day,
    });
  }
}

/** Enough warnings without a strike become a strike automatically. */
function applyAutoStrikeRule(record, department, day) {
  const perStrike = department.warnings_per_strike;
  const loose = record.warnings.filter((w) => !w.revoked_at && !w.strike_id);

  while (loose.length >= perStrike) {
    const strikeId = Date.now() + record.strikes.length;
    record.strikes.push({
      id: strikeId,
      amount: department.strike_amount,
      revoked_at: null,
      revoked_reason: null,
      created_at: day,
    });
    loose.splice(0, perStrike).forEach((warning) => { warning.strike_id = strikeId; });
  }
}

async function mockServer(method, path, body) {
  await new Promise((resolve) => setTimeout(resolve, 250)); // pretend the network is slow

  const database = loadDatabase();
  const asParam = new URLSearchParams(location.search).get('as');
  if (asParam) localStorage.setItem(SESSION_KEY, asParam);

  if (path === '/auth/me') {
    const myId = localStorage.getItem(SESSION_KEY) || 1;
    return buildResponse(database, database.users.find((u) => u.user.id == myId));
  }

  const match = path.match(/^\/user\/(\d+)$/);
  const record = match && database.users.find((u) => u.user.id == match[1]);
  if (!record) throw new Error('User not found');

  if (method === 'PUT') {
    const before = JSON.parse(JSON.stringify(record));
    mergeChanges(record, body);

    if (record.user.department_id) record.user.department_id = +record.user.department_id;
    const department = database.departments.find((d) => d.id === record.user.department_id) || database.departments[0];
    const day = new Date().toISOString().slice(0, 10);

    applyLeaveBalanceRule(record, before);
    applyRevokeWarningRule(record, before);
    applyNewStrikeRule(record, department, day);
    applyAutoStrikeRule(record, department, day);
    saveDatabase(database);
  }

  return buildResponse(database, record);
}


/* =====================================================================
   3. HELPERS
   ===================================================================== */
const $ = (selector) => document.querySelector(selector);

const ROLE_LABEL = { admin: 'Admin', hr: 'HR', employee: 'Employee' };
const LIST_LABEL = { admin: 'Admins', hr: 'HR people', employee: 'Employees' };
const STATUS_LABEL = { present: 'On time', late: 'Late', absent: 'Absent', on_leave: 'On leave', holiday: 'Holiday' };

/** Makes text safe to put inside HTML. */
function esc(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => replacements[char]);
}

const icon = (name) => `<span class="ms" aria-hidden="true">${name}</span>`;
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
const initials = (name) => name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);

/** "2026-10-14" or "2026-10-14T09:05" -> "Oct 14, 2026" */
function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.slice(0, 10) + 'T00:00');
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026-10-14T09:05" -> "09:05" */
const timeOf = (datetime) => (datetime ? datetime.slice(11, 16) : null);
const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/** Hours worked in a day, after the break. */
function hoursWorked(row) {
  return (minutesOf(timeOf(row.get_out)) - minutesOf(timeOf(row.come_in)) - row.break_minutes) / 60;
}

let toastTimer;
function toast(message, isError) {
  const element = $('#toast');
  element.textContent = message;
  element.className = 'toast show' + (isError ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 2600);
}

/**
 * Opens the popup form.
 * fields: [{ name, label, type, value, options, optional, min }]
 */
function openDialog({ title, description, fields = [], submitLabel, danger, onSubmit }) {
  const dialog = $('#dlg');

  const renderField = (field) => {
    const required = field.optional ? '' : 'required';
    let control;

    if (field.type === 'textarea') {
      control = `<textarea id="d_${field.name}" name="${field.name}" ${required}>${esc(field.value || '')}</textarea>`;
    } else if (field.type === 'select') {
      const options = field.options.map(([value, label]) =>
        `<option value="${value}" ${value == field.value ? 'selected' : ''}>${esc(label)}</option>`).join('');
      control = `<select id="d_${field.name}" name="${field.name}">${options}</select>`;
    } else {
      const min = field.min != null ? `min="${field.min}"` : '';
      control = `<input id="d_${field.name}" name="${field.name}" type="${field.type || 'text'}" value="${esc(field.value ?? '')}" ${min} ${required}>`;
    }
    return `<div class="field"><label for="d_${field.name}">${esc(field.label)}</label>${control}</div>`;
  };

  dialog.innerHTML = `
    <form method="dialog" class="dlg-body">
      <h3>${esc(title)}</h3>
      ${description ? `<p class="note">${esc(description)}</p>` : ''}
      ${fields.map(renderField).join('')}
      <div class="dlg-actions">
        <button class="btn" value="cancel" formnovalidate>Cancel</button>
        <button class="btn ${danger ? 'btn-bad' : 'btn-primary'}" value="ok">${esc(submitLabel)}</button>
      </div>
    </form>`;

  dialog.onclose = () => {
    if (dialog.returnValue === 'ok') {
      onSubmit(Object.fromEntries(new FormData(dialog.querySelector('form'))));
    }
    dialog.returnValue = '';
  };
  dialog.showModal();
}


/* =====================================================================
   STATE AND PERMISSIONS
   ===================================================================== */
const state = {
  viewer: null,  // the person who is signed in
  target: null,  // the person whose profile is open
  tab: 'info',
};

/** Admin manages HR people. HR manages employees. Everyone else can only look. */
function canManage() {
  const viewerRole = state.viewer.user.role;
  const targetRole = state.target.user.role;
  return (viewerRole === 'admin' && targetRole === 'hr')
      || (viewerRole === 'hr' && targetRole === 'employee');
}

const department = () => state.target.department
  || { warnings_per_strike: 3, strike_amount: 50, work_start_time: '' };

const openStrikes = () => state.target.strikes.filter((s) => !s.revoked_at);
const looseWarnings = () => state.target.warnings.filter((w) => !w.revoked_at && !w.strike_id);
const pendingLeaveCount = () => state.target.leave_requests.filter((r) => r.status === 'pending').length;
const strikeTotal = () => openStrikes().reduce((sum, s) => sum + Number(s.amount), 0);

/** Which tabs to show: [id, icon, label] */
function visibleTabs() {
  if (state.target.user.role === 'admin') {
    return [['info', 'badge', 'Info']];
  }
  const tabs = [['info', 'badge', 'Info']];
  if (canManage()) tabs.push(['salary', 'payments', 'Salary']);
  tabs.push(
    ['strikes', 'warning_amber', 'Strikes'],
    ['leave', 'event_busy', 'Leave'],
    ['attendance', 'history_toggle_off', 'Attendance'],
  );
  return tabs;
}

/** Sends changes to the server, then redraws with the fresh record. */
async function saveChanges(changes, successMessage) {
  try {
    state.target = await api.save(state.target.user.id, changes);
    render();
    toast(successMessage);
  } catch (error) {
    toast(error.message, true);
  }
}


/* =====================================================================
   4. RENDER
   ===================================================================== */
function render() {
  const { viewer, target } = state;
  const user = target.user;

  if (!visibleTabs().some(([id]) => id === state.tab)) state.tab = 'info';
  document.title = user.name + ' · PresenceHR';

  renderTopBar(viewer);

  const panels = {
    info: renderInfoTab,
    salary: renderSalaryTab,
    strikes: renderStrikesTab,
    leave: renderLeaveTab,
    attendance: renderAttendanceTab,
  };

  $('#app').innerHTML = `
    ${renderBreadcrumb()}
    ${renderHero()}
    ${renderTabBar()}
    <div class="stack" role="tabpanel">${panels[state.tab]()}</div>`;
}

function renderTopBar(viewer) {
  const role = viewer.user.role;
  $('#console-name').textContent = { admin: 'Enterprise Admin Console', hr: 'HR Console', employee: 'My workspace' }[role];
  $('#nav-list').textContent = { admin: 'HR people', hr: 'Employees', employee: 'My profile' }[role];
  $('#me-avatar').textContent = initials(viewer.user.name);
  $('#me-name').textContent = viewer.user.name;
  $('#me-dept').textContent = viewer.department ? viewer.department.name : 'Corporate Ops';
  $('#me-role').textContent = ROLE_LABEL[role];
}

function renderBreadcrumb() {
  const user = state.target.user;
  const can = canManage();
  return `
    <div class="crumbs">
      <nav>
        <button type="button" data-action="back">${icon('arrow_back')} Back to ${LIST_LABEL[user.role]}</button>
        <span class="sep">/</span>${esc(LIST_LABEL[user.role])}
        <span class="sep">/</span><strong style="color:var(--text)">${esc(user.name)}</strong>
      </nav>
      <span class="scope">${icon(can ? 'verified_user' : 'visibility')} ${can ? 'You can edit this profile' : 'View only'}</span>
    </div>`;
}

function renderHero() {
  const { user, department: dept } = state.target;
  const isDeactivated = Boolean(user.archived_at);
  const isAdmin = user.role === 'admin';
  const open = openStrikes().length;

  const actions = canManage() ? `
    <div class="actions">
      <button class="btn" type="button" data-action="reset-password">${icon('lock_reset')} Reset password</button>
      <button class="btn" type="button" data-action="toggle-status">
        ${icon(isDeactivated ? 'person_check' : 'person_off')} ${isDeactivated ? 'Reactivate' : 'Deactivate'}
      </button>
    </div>` : '';

  const stats = isAdmin ? '' : `
    <div class="stats">
      <div class="stat"><small>Hired</small><strong>${formatDate(user.hire_date)}</strong></div>
      <div class="stat"><small>Department</small><strong>${esc(dept ? dept.name : '-')}</strong></div>
      <div class="stat"><small>Normal leave left</small><strong>${user.normal_allowance - user.normal_used} days</strong></div>
      <div class="stat"><small>Open strikes</small><strong class="${open ? 'bad' : ''}">${open}</strong></div>
    </div>`;

  return `
    <section class="hero">
      <div class="cover"></div>
      <div class="hero-main">
        <div class="who">
          <div class="avatar">${initials(user.name)}<i class="${isDeactivated ? 'off' : ''}"></i></div>
          <div class="who-text">
            <h1>${esc(user.name)}
              <span class="pill ${isDeactivated ? 'pill-muted' : ''}">${isDeactivated ? 'Deactivated' : 'Active'}</span>
              <span class="pill pill-blue">${ROLE_LABEL[user.role]}</span>
            </h1>
            <div class="who-meta">
              ${user.job_title ? `<span>${esc(user.job_title)}</span>` : ''}
              <a href="mailto:${esc(user.email)}">${icon('mail')} ${esc(user.email)}</a>
              ${dept ? `<span>${icon('schedule')} Starts ${esc(dept.work_start_time)}</span>` : ''}
            </div>
          </div>
        </div>
        ${actions}
      </div>
      ${stats}
    </section>`;
}

function renderTabBar() {
  const open = openStrikes().length;
  const pending = pendingLeaveCount();

  const tabs = visibleTabs().map(([id, iconName, label]) => {
    let badge = '';
    if (id === 'strikes') badge = `<span class="count ${open ? 'hot' : ''}">${open}</span>`;
    if (id === 'leave' && pending) badge = `<span class="count warn">${pending}</span>`;

    return `
      <button class="tab" role="tab" type="button" data-action="tab" data-tab="${id}" aria-selected="${state.tab === id}">
        ${icon(iconName)}<span>${label}</span>${badge}
      </button>`;
  });

  return `<nav class="tabs" role="tablist" aria-label="Profile sections">${tabs.join('')}</nav>`;
}

/* ---------- Info tab ---------- */
function renderInfoTab() {
  const { user, face_profile: face, departments } = state.target;
  const can = canManage();
  const disabled = can ? '' : 'disabled';
  const isAdmin = user.role === 'admin';

  const textField = (name, label, type = 'text', required = false) => `
    <div class="field">
      <label for="${name}">${label}${required ? ' *' : ''}</label>
      <input id="${name}" name="${name}" type="${type}" value="${esc(user[name])}" ${required ? 'required' : ''} ${disabled}>
    </div>`;

  const departmentOptions = departments.map((d) =>
    `<option value="${d.id}" ${d.id === user.department_id ? 'selected' : ''}>${esc(d.name)}</option>`).join('');

  const jobFields = isAdmin ? '' : `
    <div class="field">
      <label for="department_id">Department</label>
      <select id="department_id" name="department_id" ${disabled}>${departmentOptions}</select>
    </div>
    ${textField('job_title', 'Job title')}
    ${textField('hire_date', 'Hire date', 'date')}`;

  const saveBar = can ? `
    <footer class="card-f">
      <span>Changes apply to attendance and records straight away.</span>
      <button class="btn btn-primary" type="submit">${icon('check')} Save changes</button>
    </footer>` : '';

  const faceEnrolled = Boolean(face && face.status === 'active');
  const faceCard = isAdmin ? '' : `
    <section class="card">
      <div class="row">
        <div class="row-l">
          <div class="icon-tile ${faceEnrolled ? '' : 'warn'}">${icon('face')}</div>
          <div>
            <strong>Face enrollment</strong>
            <span class="pill ${faceEnrolled ? '' : 'pill-warn'}">${faceEnrolled ? 'Enrolled' : 'Not enrolled'}</span>
            <p class="note">${faceEnrolled ? 'Face check-in is active.' : 'They will enroll at their next login.'}</p>
          </div>
        </div>
        ${can && faceEnrolled ? `<button class="btn" type="button" data-action="reset-face">${icon('sync')} Reset face enrollment</button>` : ''}
      </div>
    </section>`;

  return `
    <section class="card">
      <header class="card-h">
        <div>
          <h2>General information</h2>
          <p>${can ? 'Change the details and save. Use Deactivate at the top to archive the account.' : 'You can see this profile but not change it.'}</p>
        </div>
      </header>
      <form id="info-form">
        <div class="grid2">
          ${textField('name', 'Full name', 'text', true)}
          ${textField('email', 'Email', 'email', true)}
          ${textField('phone', 'Phone', 'tel')}
          ${textField('address', 'Address')}
          ${jobFields}
        </div>
        ${saveBar}
      </form>
    </section>
    ${faceCard}`;
}

/* ---------- Salary tab ---------- */
function renderSalaryTab() {
  const { user } = state.target;
  const deductions = strikeTotal();

  return `
    <section class="card">
      <header class="card-h">
        <div>
          <h2>Salary</h2>
          <p>Set when the account was created and changed for raises.</p>
        </div>
        <button class="btn btn-primary" type="button" data-action="edit-salary">${icon('trending_up')} Change salary</button>
      </header>
      <div class="split">
        <div><div class="big">${money(user.salary)}<small>per month</small></div></div>
        <div>
          <div class="kv"><span>Open strikes</span><span>${openStrikes().length}</span></div>
          <div class="kv"><span>Strike deductions</span><span>${deductions ? '-' + money(deductions) : money(0)}</span></div>
          <div class="kv"><strong>After deductions</strong><strong>${money(user.salary - deductions)}</strong></div>
        </div>
      </div>
    </section>`;
}

/* ---------- Strikes tab ---------- */
function renderStrikesTab() {
  const { warnings, strikes } = state.target;
  const can = canManage();
  const perStrike = department().warnings_per_strike;
  const loose = looseWarnings().length;

  const pips = Array.from({ length: perStrike }, (_, i) =>
    `<span class="pip ${i < loose ? 'on' : ''}"></span>`).join('');

  const addButtons = can ? `
    <div class="actions">
      <button class="btn" type="button" data-action="add-warning">${icon('add')} Add warning</button>
      <button class="btn btn-bad" type="button" data-action="add-strike">${icon('gavel')} Add strike</button>
    </div>` : '';

  const strikeRows = [...strikes].reverse().map((strike) => {
    const revoked = Boolean(strike.revoked_at);
    const reason = strike.revoked_reason ? ` <span class="muted">${esc(strike.revoked_reason)}</span>` : '';
    const action = can && !revoked
      ? `<button class="btn btn-sm" type="button" data-action="revoke-strike" data-id="${strike.id}">Revoke</button>` : '';
    return `
      <tr class="${revoked ? 'archived' : ''}">
        <td>${formatDate(strike.created_at)}</td>
        <td class="num">${money(strike.amount)}</td>
        <td><span class="pill ${revoked ? 'pill-muted' : 'pill-bad'}">${revoked ? 'Revoked' : 'Open'}</span>${reason}</td>
        ${can ? `<td class="right">${action}</td>` : ''}
      </tr>`;
  }).join('');

  const warningRows = [...warnings].reverse().map((warning) => {
    const revoked = Boolean(warning.revoked_at);
    const pillClass = revoked ? 'pill-muted' : warning.strike_id ? 'pill-bad' : 'pill-warn';
    const pillText = revoked ? 'Revoked' : warning.strike_id ? 'In a strike' : 'Active';
    const action = can && !revoked
      ? `<button class="btn btn-sm" type="button" data-action="revoke-warning" data-id="${warning.id}">Revoke</button>` : '';
    return `
      <tr class="${revoked ? 'archived' : ''}">
        <td>${formatDate(warning.created_at)}</td>
        <td>${esc(warning.reason)}</td>
        <td class="muted">${esc(warning.issued_by_name || '-')}</td>
        <td><span class="pill ${pillClass}">${pillText}</span></td>
        ${can ? `<td class="right">${action}</td>` : ''}
      </tr>`;
  }).join('');

  const actionHeader = can ? '<th></th>' : '';

  return `
    <section class="card">
      <header class="card-h">
        <div>
          <h2>Warnings and strikes</h2>
          <p>${perStrike} warnings make 1 strike and each strike takes ${money(department().strike_amount)} from salary. Nothing is deleted, only revoked.</p>
        </div>
        ${addButtons}
      </header>
      <div class="split">
        <div>
          <strong>${loose} of ${perStrike} warnings toward the next strike</strong>
          <div class="pips">${pips}</div>
          <p class="note">The strike is added automatically at ${perStrike}.</p>
        </div>
        <div>
          <div class="kv"><span>Open strikes</span><strong>${openStrikes().length}</strong></div>
          <div class="kv"><span>Deducted from salary</span><strong>${money(strikeTotal())}</strong></div>
        </div>
      </div>
    </section>

    <section class="card">
      <header class="card-h"><div><h2>Strikes</h2></div></header>
      ${strikes.length ? `
        <div class="tbl-wrap"><table>
          <thead><tr><th>Date</th><th>Amount</th><th>Status</th>${actionHeader}</tr></thead>
          <tbody>${strikeRows}</tbody>
        </table></div>` : '<div class="empty"><strong>No strikes</strong>Clean record so far.</div>'}
    </section>

    <section class="card">
      <header class="card-h"><div><h2>Warning log</h2></div></header>
      ${warnings.length ? `
        <div class="tbl-wrap"><table>
          <thead><tr><th>Date</th><th>Reason</th><th>Issued by</th><th>Status</th>${actionHeader}</tr></thead>
          <tbody>${warningRows}</tbody>
        </table></div>` : '<div class="empty"><strong>No warnings</strong>Nothing on record.</div>'}
    </section>`;
}

/* ---------- Leave tab ---------- */
function renderLeaveTab() {
  const { user, leave_requests: requests } = state.target;
  const can = canManage();

  const balanceBar = (label, used, total, extraClass) => {
    const percent = total ? Math.min(100, (used / total) * 100) : 0;
    return `
      <div>
        <strong>${label}</strong>
        <div class="bar ${extraClass}"><i style="width:${percent}%"></i></div>
        <p class="note"><span>${used} used</span><span>${total - used} of ${total} days left</span></p>
      </div>`;
  };

  const statusPill = { pending: 'pill-warn', approved: '', rejected: 'pill-bad', cancelled: 'pill-muted' };

  const buttonsFor = (request) => {
    const button = (to, label, style) =>
      `<button class="btn btn-sm ${style}" type="button" data-action="decide-leave" data-id="${request.id}" data-to="${to}">${label}</button>`;

    if (request.status === 'pending') return button('approved', 'Accept', 'btn-ok') + ' ' + button('rejected', 'Reject', 'btn-bad');
    if (request.status === 'approved') return button('cancelled', 'Cancel', '');
    return '';
  };

  const rows = [...requests].reverse().map((request) => {
    const what = request.leave_kind === 'full_day' ? 'Full day off' : 'Leave early at ' + esc(request.leave_time);
    const sameDay = request.end_date === request.start_date;
    const dates = formatDate(request.start_date) + (sameDay ? '' : ' - ' + formatDate(request.end_date));
    const decidedBy = request.approved_by_name
      ? `<div class="note">by ${esc(request.approved_by_name)}${request.decision_comment ? ': ' + esc(request.decision_comment) : ''}</div>` : '';
    const statusText = request.status[0].toUpperCase() + request.status.slice(1);

    return `
      <tr>
        <td>${request.leave_type === 'medical' ? 'Medical' : 'Normal'}</td>
        <td>${what}</td>
        <td class="num">${dates}</td>
        <td class="num">${request.amount}</td>
        <td class="muted">${esc(request.note)}</td>
        <td><span class="pill ${statusPill[request.status]}">${statusText}</span>${decidedBy}</td>
        ${can ? `<td class="right">${buttonsFor(request)}</td>` : ''}
      </tr>`;
  }).join('');

  return `
    <section class="card">
      <header class="card-h">
        <div><h2>Leave balance</h2><p>Days used this year out of the yearly allowance.</p></div>
      </header>
      <div class="bal">
        ${balanceBar('Normal leave', user.normal_used, user.normal_allowance, '')}
        ${balanceBar('Medical leave', user.medical_used, user.medical_allowance, 'med')}
      </div>
      <h2 style="font-size:16px;font-weight:600;margin-bottom:8px">Requests</h2>
      ${requests.length ? `
        <div class="tbl-wrap"><table>
          <thead><tr><th>Type</th><th>What</th><th>Dates</th><th>Days</th><th>Note</th><th>Status</th>${can ? '<th></th>' : ''}</tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : '<div class="empty"><strong>No leave requests</strong>Requests will show up here.</div>'}
    </section>`;
}

/* ---------- Attendance tab ---------- */
function renderAttendanceTab() {
  const rows = state.target.attendance;
  const can = canManage();
  const byDate = Object.fromEntries(rows.map((row) => [row.date, row]));
  const countOf = (status) => rows.filter((row) => row.status === status).length;
  const finishedDays = rows.filter((row) => row.come_in && row.get_out);

  const averageBreak = finishedDays.length
    ? Math.round(finishedDays.reduce((sum, row) => sum + row.break_minutes, 0) / finishedDays.length) : 0;
  const totalHours = finishedDays.reduce((sum, row) => sum + hoursWorked(row), 0);

  // One small square for every day of the month
  const monthStrip = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const date = `2026-10-${pad(day)}`;
    const weekday = new Date(2026, 9, day).getDay();
    const row = byDate[date];
    const cellClass = row ? row.status : (weekday === 0 || weekday === 6 ? 'off' : 'future');
    const tooltip = formatDate(date) + (row ? ' - ' + STATUS_LABEL[row.status] : '');
    return `<span class="cell ${cellClass}" title="${tooltip}">${day}</span>`;
  }).join('');

  const statusPill = { present: '', late: 'pill-warn', on_leave: 'pill-blue', absent: 'pill-bad', holiday: 'pill-muted' };

  const tableRows = [...rows].reverse().map((row) => {
    const out = timeOf(row.get_out) || (row.come_in ? 'In progress' : '-');
    const worked = row.come_in && row.get_out ? hoursWorked(row).toFixed(1) + ' h' : '-';
    const reasonTip = row.edit_reason ? `title="${esc(row.edit_reason)}"` : '';
    const editButton = can
      ? `<td class="right"><button class="btn btn-sm" type="button" data-action="edit-attendance" data-id="${row.id}">Edit</button></td>` : '';

    return `
      <tr>
        <td>${formatDate(row.date)}</td>
        <td class="num">${timeOf(row.come_in) || '-'}</td>
        <td class="num">${out}</td>
        <td class="num">${row.break_minutes ? row.break_minutes + ' min' : '-'}</td>
        <td class="num">${worked}</td>
        <td class="muted" ${reasonTip}>${row.verification_method === 'face' ? 'Face' : 'Manual'}</td>
        <td><span class="pill ${statusPill[row.status]}">${STATUS_LABEL[row.status]}</span></td>
        ${editButton}
      </tr>`;
  }).join('');

  return `
    <section class="card">
      <header class="card-h">
        <div>
          <h2>October 2026</h2>
          <p>Camera check-ins. ${can ? 'Edit a row to fix a missed check-in; it is marked manual with your reason.' : ''}</p>
        </div>
      </header>
      <div class="sum">
        <div><small>Days present</small><strong>${countOf('present') + countOf('late')}</strong></div>
        <div><small>Late arrivals</small><strong>${countOf('late')}</strong></div>
        <div><small>Average break</small><strong>${averageBreak} min</strong></div>
        <div><small>Hours worked</small><strong>${totalHours.toFixed(1)}</strong></div>
      </div>
      <div class="strip">${monthStrip}</div>
      <div class="legend">
        <span><i style="background:var(--accent)"></i>On time</span>
        <span><i style="background:var(--warn)"></i>Late</span>
        <span><i style="background:var(--primary)"></i>On leave</span>
        <span><i style="background:var(--danger)"></i>Absent</span>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Break</th><th>Worked</th><th>Method</th><th>Status</th>${can ? '<th></th>' : ''}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
    </section>`;
}


/* =====================================================================
   5. ACTIONS
   Each button has data-action="name". The function with that name runs.
   ===================================================================== */

/** Actions anyone can use. */
const viewActions = {
  tab(button) {
    state.tab = button.dataset.tab;
    history.replaceState(null, '', location.search + '#' + state.tab);
    render();
  },

  back() {
    const label = LIST_LABEL[state.target.user.role];
    if (LIST_URL) location.href = LIST_URL;
    else toast('Set LIST_URL in profile.js to open the ' + label + ' list');
  },
};

/** Actions only Admin (on HR) or HR (on employees) can use. */
const manageActions = {
  'reset-password'() {
    const { name, email } = state.target.user;
    openDialog({
      title: 'Reset password?',
      description: `${name} will get an email with a link, and must choose a new password at next login.`,
      submitLabel: 'Send reset link',
      onSubmit: () => saveChanges({ user: { must_change_password: true } }, 'Reset link sent to ' + email),
    });
  },

  'toggle-status'() {
    const deactivating = !state.target.user.archived_at;
    openDialog({
      title: deactivating ? 'Deactivate account?' : 'Reactivate account?',
      description: deactivating ? 'They can no longer log in. All their records are kept.' : 'They can log in again.',
      submitLabel: deactivating ? 'Deactivate' : 'Reactivate',
      danger: deactivating,
      onSubmit: () => saveChanges(
        { user: { archived_at: deactivating ? new Date().toISOString() : null } },
        deactivating ? 'Account deactivated' : 'Account reactivated',
      ),
    });
  },

  'reset-face'() {
    openDialog({
      title: 'Reset face enrollment?',
      description: `The saved face of ${state.target.user.name} is erased and they enroll again at next login.`,
      submitLabel: 'Reset enrollment',
      onSubmit: () => saveChanges({ face_profile: { status: 'revoked' } }, 'Enrollment reset'),
    });
  },

  'edit-salary'() {
    openDialog({
      title: 'Change salary',
      submitLabel: 'Save salary',
      fields: [{ name: 'salary', label: 'Monthly salary ($)', type: 'number', value: state.target.user.salary, min: 0 }],
      onSubmit: (form) => saveChanges({ user: { salary: Number(form.salary) } }, 'Salary updated'),
    });
  },

  'add-warning'() {
    const me = state.viewer.user;
    openDialog({
      title: 'Add warning',
      description: `After ${department().warnings_per_strike} warnings a strike is added automatically.`,
      submitLabel: 'Add warning',
      fields: [{ name: 'reason', label: 'Reason', type: 'textarea' }],
      onSubmit: (form) => {
        const warning = {
          id: Date.now(),
          reason: form.reason,
          issued_by: me.id,
          issued_by_name: me.name,
          strike_id: null,
          revoked_at: null,
          revoked_reason: null,
          created_at: today(),
        };
        saveChanges({ warnings: [...state.target.warnings, warning] }, 'Warning added');
      },
    });
  },

  'add-strike'() {
    openDialog({
      title: 'Add strike',
      description: `This takes ${money(department().strike_amount)} from ${state.target.user.name}'s salary.`,
      submitLabel: 'Add strike',
      danger: true,
      onSubmit: () => saveChanges({ strikes: [...state.target.strikes, { id: 'new' }] }, 'Strike added'),
    });
  },

  'revoke-warning'(button) {
    const id = Number(button.dataset.id);
    openDialog({
      title: 'Revoke warning',
      description: 'If this warning is part of a strike, that strike is revoked too.',
      submitLabel: 'Revoke',
      fields: [{ name: 'why', label: 'Reason' }],
      onSubmit: (form) => saveChanges({
        warnings: state.target.warnings.map((w) =>
          w.id === id ? { ...w, revoked_at: new Date().toISOString(), revoked_reason: form.why } : w),
      }, 'Warning revoked'),
    });
  },

  'revoke-strike'(button) {
    const id = Number(button.dataset.id);
    openDialog({
      title: 'Revoke strike',
      description: 'The deduction is removed.',
      submitLabel: 'Revoke',
      fields: [{ name: 'why', label: 'Reason' }],
      onSubmit: (form) => saveChanges({
        strikes: state.target.strikes.map((s) =>
          s.id === id ? { ...s, revoked_at: new Date().toISOString(), revoked_reason: form.why } : s),
      }, 'Strike revoked'),
    });
  },

  'decide-leave'(button) {
    const id = Number(button.dataset.id);
    const decision = button.dataset.to; // approved | rejected | cancelled
    const me = state.viewer.user;

    const text = {
      approved: { label: 'Accept', note: 'The days are taken from their balance.', done: 'Leave accepted' },
      rejected: { label: 'Reject', note: '', done: 'Leave rejected' },
      cancelled: { label: 'Cancel', note: 'The days go back to their balance.', done: 'Leave cancelled' },
    }[decision];

    openDialog({
      title: text.label + ' this request?',
      description: text.note,
      submitLabel: text.label,
      danger: decision !== 'approved',
      fields: [{ name: 'comment', label: 'Comment (optional)', optional: true }],
      onSubmit: (form) => saveChanges({
        leave_requests: state.target.leave_requests.map((request) => request.id !== id ? request : {
          ...request,
          status: decision,
          approved_by: me.id,
          approved_by_name: me.name,
          decision_comment: form.comment || null,
        }),
      }, text.done),
    });
  },

  'edit-attendance'(button) {
    const id = Number(button.dataset.id);
    const row = state.target.attendance.find((r) => r.id === id);
    const me = state.viewer.user;

    // The popup gives "HH:MM". The database wants "YYYY-MM-DDTHH:MM" (or null if empty).
    const toDatetime = (time) => (time ? row.date + 'T' + time : null);

    openDialog({
      title: 'Edit ' + formatDate(row.date),
      description: 'The row becomes manual and your reason is saved with it.',
      submitLabel: 'Save row',
      fields: [
        { name: 'come_in', label: 'Came in', type: 'time', value: timeOf(row.come_in), optional: true },
        { name: 'get_out', label: 'Got out', type: 'time', value: timeOf(row.get_out), optional: true },
        { name: 'break_minutes', label: 'Break (minutes)', type: 'number', value: row.break_minutes, min: 0 },
        { name: 'status', label: 'Status', type: 'select', value: row.status, options: Object.entries(STATUS_LABEL) },
        { name: 'edit_reason', label: 'Reason for the change', type: 'textarea' },
      ],
      onSubmit: (form) => saveChanges({
        attendance: state.target.attendance.map((r) => r.id !== id ? r : {
          ...r,
          come_in: toDatetime(form.come_in),
          get_out: toDatetime(form.get_out),
          break_minutes: Number(form.break_minutes),
          status: form.status,
          verification_method: 'manual',
          edited_by: me.id,
          edit_reason: form.edit_reason,
        }),
      }, 'Attendance updated'),
    });
  },
};

// One click listener for the whole page
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  event.preventDefault();

  const name = button.dataset.action;
  if (viewActions[name]) {
    viewActions[name](button);
  } else if (manageActions[name] && canManage()) {
    manageActions[name](button);
  }
});

// The Info form
document.addEventListener('submit', (event) => {
  if (event.target.id !== 'info-form') return;
  event.preventDefault();
  if (!canManage()) return;

  const changes = Object.fromEntries(new FormData(event.target));
  if ('department_id' in changes) changes.department_id = Number(changes.department_id);
  saveChanges({ user: changes }, 'Changes saved');
});

$('#logout').onclick = () => toast('Connect log out to POST /auth/logout');

window.addEventListener('hashchange', () => {
  state.tab = location.hash.slice(1) || 'info';
  if (state.target) render();
});


/* =====================================================================
   6. START UP
   ===================================================================== */
async function start() {
  const app = $('#app');
  app.innerHTML = '<div class="state"><div class="spin"></div>Loading profile…</div>';

  try {
    state.tab = location.hash.slice(1) || 'info';
    const targetId = new URLSearchParams(location.search).get('id') || 2; // the person you clicked on
    [state.viewer, state.target] = await Promise.all([api.me(), api.get(targetId)]);
    render();
  } catch (error) {
    app.innerHTML = `
      <div class="state">
        <strong>Couldn't load this profile</strong>
        <span>${esc(error.message)}</span>
        <button class="btn btn-primary" type="button" id="retry">Try again</button>
      </div>`;
    $('#retry').onclick = start;
  }
}

start();