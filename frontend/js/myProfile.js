'use strict';

/* =====================================================================
   MY PROFILE PAGE  (the signed-in person looking at their own profile)

   1. API         how the page talks to the server
   2. MOCK SERVER fake server for now (delete it when Laravel is ready)
   3. HELPERS     small tools
   4. RENDER      draws the cards
   5. ACTIONS     save details, change password, enroll face
   6. START UP    loads the data and draws the page
   ===================================================================== */


/* =====================================================================
   1. API
   GET  /auth/me        -> the signed-in person:
                           { user, department, face_profile }
   PUT  /user/:id       -> { user: { phone, address } }  (only these two are allowed)
   POST /auth/password  -> { current_password, new_password }
                           422 + { message } when the current password is wrong
   PUT  /user/:id       -> { face_profile: { status: 'active' } } after enrolling

   To go live: set useMock to false, set base, delete section 2.
   ===================================================================== */
const API = {
  useMock: true,
  base: '/api',
};

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
  save: (id, changes) => request('PUT', '/user/' + id, changes),
  changePassword: (current, next) => request('POST', '/auth/password', { current_password: current, new_password: next }),
};


/* =====================================================================
   2. MOCK SERVER
   Data lives in localStorage. Preview as someone else with ?as=ID:
     ?as=2  Sara Ali (HR, face enrolled)       <- default
     ?as=4  Yousef Nasser (employee, not enrolled)
     ?as=1  Omar Khaled (Admin, no job details)
   In the mock, every password is: password123
   ===================================================================== */
const DB_KEY = 'presencehr-mock-me-v1';
const SESSION_KEY = 'presencehr-me-session';

const DEPARTMENTS = [
  { id: 1, name: 'Corporate Ops' },
  { id: 2, name: 'Human Resources' },
  { id: 3, name: 'Engineering' },
];

function makeSeedData() {
  const person = (id, role, name, email, departmentId, jobTitle, hireDate, phone, address, faceStatus) => ({
    password: 'password123', // only the mock keeps this; the real API never sends it
    user: {
      id, name, email, role, phone, address,
      department_id: departmentId,
      job_title: jobTitle,
      hire_date: hireDate,
      must_change_password: false,
    },
    face_profile: faceStatus ? { status: faceStatus, consent_at: '2026-01-05T09:00' } : null,
  });

  return {
    users: [
      person(1, 'admin', 'Omar Khaled', 'omar@presencehr.internal', null, null, null, '+1 (555) 100-2000', '12 Main Street', null),
      person(2, 'hr', 'Sara Ali', 'sara.ali@presencehr.internal', 2, 'HR Manager', '2024-03-01', '+1 (555) 234-5678', '742 Evergreen Terrace, Springfield, OR 97477', 'active'),
      person(4, 'employee', 'Yousef Nasser', 'yousef@presencehr.internal', 3, 'Backend Developer', '2025-06-02', '+1 (555) 422-1170', '8 Harbor Road, Portland, OR 97201', 'revoked'),
    ],
  };
}

function loadDatabase() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) { /* storage blocked: use fresh data */ }

  const fresh = makeSeedData();
  saveDatabase(fresh);
  return fresh;
}

function saveDatabase(database) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
  } catch (error) { /* storage blocked: changes will not persist */ }
}

/** What the API sends back: the record without the password, plus the department. */
function buildResponse(record) {
  const { password, ...safe } = record;
  return { ...safe, department: DEPARTMENTS.find((d) => d.id === record.user.department_id) || null };
}

async function mockServer(method, path, body) {
  await new Promise((resolve) => setTimeout(resolve, 300)); // pretend the network is slow

  const database = loadDatabase();
  const asParam = new URLSearchParams(location.search).get('as');
  if (asParam) localStorage.setItem(SESSION_KEY, asParam);

  const myId = localStorage.getItem(SESSION_KEY) || 2;
  const me = database.users.find((u) => u.user.id == myId);
  if (!me) throw new Error('Not signed in');

  if (method === 'GET' && path === '/auth/me') {
    return buildResponse(me);
  }

  if (method === 'PUT' && path === '/user/' + me.user.id) {
    // The server only lets you change your own phone and address.
    if (body.user) {
      if ('phone' in body.user) me.user.phone = body.user.phone;
      if ('address' in body.user) me.user.address = body.user.address;
    }
    if (body.face_profile) {
      me.face_profile = { status: 'active', consent_at: new Date().toISOString() };
    }
    saveDatabase(database);
    return buildResponse(me);
  }

  if (method === 'POST' && path === '/auth/password') {
    if (body.current_password !== me.password) throw new Error('Current password is incorrect.');
    me.password = body.new_password;
    me.user.must_change_password = false;
    saveDatabase(database);
    return { ok: true };
  }

  throw new Error('Not found');
}


/* =====================================================================
   3. HELPERS
   ===================================================================== */
const $ = (selector) => document.querySelector(selector);

const ROLE_LABEL = { admin: 'Admin', hr: 'HR', employee: 'Employee' };
const MIN_PASSWORD_LENGTH = 8;

/** Makes text safe to put inside HTML. */
function esc(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => replacements[char]);
}

const icon = (name) => `<span class="ms" aria-hidden="true">${name}</span>`;
const initials = (name) => name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();

/** "2024-03-01" -> "March 01, 2024" */
function formatDate(value) {
  if (!value) return '-';
  return new Date(value.slice(0, 10) + 'T00:00')
    .toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
}

let toastTimer;
function toast(message, isError) {
  const element = $('#toast');
  element.textContent = message;
  element.className = 'toast show' + (isError ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 2600);
}

/** Shows a short message inside a form (green by default, red for errors). */
function showStatus(selector, message, isError) {
  const element = $(selector);
  element.textContent = message;
  element.className = 'status' + (isError ? ' bad' : '');
}

/** Puts a button into a "working..." state and back. */
function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = `<span class="spin"></span>${esc(busyText)}`;
  } else {
    button.innerHTML = button.dataset.label;
  }
  button.disabled = busy;
}

const state = {
  me: null, // { user, department, face_profile }
};


/* =====================================================================
   4. RENDER
   ===================================================================== */

/** Draws the page frame once. Each card is then updated on its own. */
function renderPage() {
  const { user, department } = state.me;

  $('#me-avatar').textContent = initials(user.name);
  $('#me-name').textContent = user.name;
  document.title = 'My profile · PresenceHR';

  const subtitle = [user.job_title || ROLE_LABEL[user.role], department && department.name].filter(Boolean).join(' • ');

  $('#app').innerHTML = `
    <header class="head">
      <h1>Profile</h1>
      <p>Update your contact details and password.</p>
    </header>

    <section class="card identity">
      <div class="avatar">${initials(user.name)}</div>
      <div><strong>${esc(user.name)}</strong><span>${esc(subtitle)}</span></div>
    </section>

    ${user.must_change_password ? `
      <div class="notice">${icon('lock_reset')}
        <span>HR reset your password. Please choose a new one below.</span>
      </div>` : ''}

    <div class="grid">
      <div class="col">
        <section class="card" id="info-card"></section>
        <section class="card" id="password-card"></section>
      </div>
      <div class="col">
        <section class="card" id="face-card"></section>
      </div>
    </div>`;

  renderInfoCard();
  renderPasswordCard();
  renderFaceCard();
}

function renderInfoCard() {
  const { user, department } = state.me;

  const lockedField = (label, value, wide) => `
    <div class="field ${wide ? 'wide' : ''}">
      <span class="lbl">${label}${icon('lock').replace('class="ms"', 'class="ms lock"')}</span>
      <div class="locked">${esc(value || '-')}</div>
    </div>`;

  $('#info-card').innerHTML = `
    <div class="card-h">
      <div>
        <h2>Personal information</h2>
        <p>Manage your verified profile and communication records.</p>
      </div>
      <span class="chip">${icon('lock')} Only HR can change locked fields</span>
    </div>

    <form id="info-form" novalidate>
      <div class="fields">
        ${lockedField('Full name', user.name)}
        ${lockedField('Email', user.email)}
        ${lockedField('Department', department && department.name)}
        ${lockedField('Job title', user.job_title)}
        ${lockedField('Hire date', user.hire_date && formatDate(user.hire_date), true)}

        <div class="field edit wide">
          <label for="phone">Phone number</label>
          <div class="input has-icon">
            ${icon('call').replace('class="ms"', 'class="ms lead"')}
            <input id="phone" name="phone" type="tel" autocomplete="tel" value="${esc(user.phone)}">
          </div>
          <span class="hint bad" id="phone-error"></span>
        </div>

        <div class="field edit wide">
          <label for="address">Residential address</label>
          <div class="input has-icon">
            ${icon('home_pin').replace('class="ms"', 'class="ms lead"')}
            <input id="address" name="address" type="text" autocomplete="street-address" value="${esc(user.address)}">
          </div>
        </div>
      </div>

      <div class="form-foot">
        <span class="status" id="info-status" role="status"></span>
        <button class="btn" id="info-save" type="submit" disabled>Save changes</button>
      </div>
    </form>`;
}

function renderPasswordCard() {
  const passwordField = (id, label, placeholder, autocomplete) => `
    <div class="field edit">
      <label for="${id}">${label}</label>
      <div class="input has-btn">
        <input id="${id}" type="password" placeholder="${placeholder}" autocomplete="${autocomplete}">
        <button class="eye" type="button" data-action="toggle-password" data-target="${id}" aria-label="Show or hide password">${icon('visibility')}</button>
      </div>
      ${id === 'new-password' ? `<span class="hint" id="length-hint">At least ${MIN_PASSWORD_LENGTH} characters.</span>` : ''}
      ${id === 'confirm-password' ? '<span class="hint" id="match-hint"></span>' : ''}
    </div>`;

  $('#password-card').innerHTML = `
    <div class="card-h">
      <div>
        <h2>Change password</h2>
        <p>Ensure your account uses a secure passphrase.</p>
      </div>
    </div>

    <form id="password-form" class="stack-form" novalidate>
      ${passwordField('current-password', 'Current password', 'Enter current password', 'current-password')}
      <div class="fields">
        ${passwordField('new-password', 'New password', 'At least ' + MIN_PASSWORD_LENGTH + ' characters', 'new-password')}
        ${passwordField('confirm-password', 'Confirm new password', 'Re-type new password', 'new-password')}
      </div>
      <div class="form-foot">
        <span class="status" id="password-status" role="status"></span>
        <button class="btn" id="password-save" type="submit">Update password</button>
      </div>
    </form>`;
}

function renderFaceCard() {
  const face = state.me.face_profile;

  // Admins do not check in with the camera, so they have no face card.
  if (state.me.user.role === 'admin') {
    $('#face-card').hidden = true;
    return;
  }

  const enrolled = Boolean(face && face.status === 'active');

  const faceIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="11" r="5"></circle>
      <path d="M5.5 20.5C5.5 16.5 8.5 15 12 15s6.5 1.5 6.5 5.5"></path>
      ${enrolled ? `<path d="M12 3v2M12 19v2M3 11h2M19 11h2" stroke="#3968AC" stroke-width="2"></path>` : ''}
    </svg>`;

  $('#face-card').innerHTML = `
    <div class="card-h">
      <div>
        <h2>Face enrollment</h2>
        <p>Biometric verification for terminal clock-in.</p>
      </div>
      <span class="pill ${enrolled ? '' : 'off'}">${enrolled ? 'Enrolled' : 'Not enrolled'}</span>
    </div>

    <div class="face-box">
      <div class="face-ring ${enrolled ? '' : 'off'}">
        ${faceIcon}
        ${enrolled ? `<span class="tick">${icon('check')}</span>` : ''}
      </div>
      <p>${enrolled
        ? 'Your face is enrolled. To change it, ask HR to reset it.'
        : 'Enroll your face to enable contactless check-in at all office kiosks.'}</p>
    </div>

    ${enrolled ? '' : `<button class="btn btn-block" type="button" data-action="enroll-face">${icon('face')} Enroll my face</button>`}

    <div class="privacy">
      ${icon('shield')}
      <p>${enrolled
        ? 'Your face image is never stored. Only a secure face signature is kept, and only HR can reset it.'
        : 'Your face image is never stored. Only a secure face signature is kept.'}</p>
    </div>`;
}


/* =====================================================================
   5. ACTIONS
   ===================================================================== */

/* ---------- Personal information ---------- */
const PHONE_PATTERN = /^\+?[\d\s().-]{6,}$/;

/** Turns the Save button on only when something actually changed. */
function updateSaveButton() {
  const { user } = state.me;
  const changed = $('#phone').value.trim() !== (user.phone || '') || $('#address').value.trim() !== (user.address || '');
  $('#info-save').disabled = !changed;
  showStatus('#info-status', '');
}

async function saveInfo() {
  const phone = $('#phone').value.trim();
  const address = $('#address').value.trim();
  const phoneInput = $('#phone');

  if (!PHONE_PATTERN.test(phone)) {
    phoneInput.setAttribute('aria-invalid', 'true');
    $('#phone-error').textContent = 'Enter a valid phone number.';
    phoneInput.focus();
    return;
  }
  phoneInput.removeAttribute('aria-invalid');
  $('#phone-error').textContent = '';

  const button = $('#info-save');
  setBusy(button, true, 'Saving…');
  try {
    state.me = await api.save(state.me.user.id, { user: { phone, address } });
    renderInfoCard();
    showStatus('#info-status', '✓ Changes saved successfully');
    setTimeout(() => showStatus('#info-status', ''), 3000);
  } catch (error) {
    setBusy(button, false);
    showStatus('#info-status', error.message, true);
  }
}

/* ---------- Password ---------- */
function toggleVisibility(button) {
  const input = document.getElementById(button.dataset.target);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.innerHTML = icon(showing ? 'visibility' : 'visibility_off');
}

/** Live hints while typing: length and "passwords match". */
function updatePasswordHints() {
  const next = $('#new-password').value;
  const confirm = $('#confirm-password').value;

  const lengthHint = $('#length-hint');
  const longEnough = next.length >= MIN_PASSWORD_LENGTH;
  lengthHint.className = 'hint' + (next ? (longEnough ? ' ok' : '') : '');
  lengthHint.innerHTML = (longEnough ? icon('check_circle') : '') + `At least ${MIN_PASSWORD_LENGTH} characters.`;

  const matchHint = $('#match-hint');
  if (!confirm) {
    matchHint.className = 'hint';
    matchHint.innerHTML = '';
  } else if (confirm === next) {
    matchHint.className = 'hint ok';
    matchHint.innerHTML = icon('check_circle') + 'Passwords match';
  } else {
    matchHint.className = 'hint bad';
    matchHint.innerHTML = icon('error') + "Passwords don't match";
  }
}

async function updatePassword() {
  const current = $('#current-password').value;
  const next = $('#new-password').value;
  const confirm = $('#confirm-password').value;

  // Check on the page first, so people get quick feedback.
  let problem = '';
  if (!current) problem = 'Please enter your current password.';
  else if (next.length < MIN_PASSWORD_LENGTH) problem = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (next === current) problem = 'New password must be different from the current one.';
  else if (next !== confirm) problem = 'New passwords do not match.';

  if (problem) {
    showStatus('#password-status', problem, true);
    return;
  }

  const button = $('#password-save');
  setBusy(button, true, 'Updating…');
  try {
    await api.changePassword(current, next);
    renderPasswordCard();
    showStatus('#password-status', '✓ Password updated successfully');
    state.me.user.must_change_password = false;
    document.querySelector('.notice')?.remove();
    setTimeout(() => showStatus('#password-status', ''), 3000);
  } catch (error) {
    setBusy(button, false);
    showStatus('#password-status', error.message, true); // e.g. wrong current password
  }
}

/* ---------- Face enrollment ---------- */
async function enrollFace(button) {
  // In the real system this opens the camera or the kiosk link.
  // The mock just marks the face as enrolled.
  setBusy(button, true, 'Starting camera…');
  try {
    state.me = await api.save(state.me.user.id, { face_profile: { status: 'active' } });
    renderFaceCard();
    toast('Face enrolled');
  } catch (error) {
    setBusy(button, false);
    toast(error.message, true);
  }
}

/* ---------- Wiring ---------- */
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const actions = {
    'toggle-password': toggleVisibility,
    'enroll-face': enrollFace,
  };
  actions[button.dataset.action]?.(button);
});

document.addEventListener('input', (event) => {
  if (event.target.closest('#info-form')) {
    updateSaveButton();
    if (event.target.id === 'phone') {
      event.target.removeAttribute('aria-invalid');
      $('#phone-error').textContent = '';
    }
  }
  if (event.target.closest('#password-form')) {
    updatePasswordHints();
    showStatus('#password-status', '');
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'info-form') saveInfo();
  if (event.target.id === 'password-form') updatePassword();
});

$('#logout').onclick = () => toast('Connect log out to POST /auth/logout');


/* =====================================================================
   6. START UP
   ===================================================================== */
async function start() {
  const app = $('#app');
  app.innerHTML = '<div class="state"><div class="spin"></div>Loading your profile…</div>';

  try {
    state.me = await api.me();
    renderPage();
  } catch (error) {
    app.innerHTML = `
      <div class="state">
        <strong>Couldn't load your profile</strong>
        <span>${esc(error.message)}</span>
        <button class="btn" type="button" id="retry">Try again</button>
      </div>`;
    $('#retry').onclick = start;
  }
}

start();