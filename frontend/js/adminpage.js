import { API } from './config.js';
import { renderPeopleTable } from './components/dashboard.js';

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

async function getJson(url) {
    const response = await fetch(API + url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
    });

    if (response.status === 401) {
        window.location.href = 'login.html'; // not logged in
        throw new Error('Not logged in');
    }
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

async function loadUser() {
    try {
        const data = await getJson('/auth/me');
        setText('username', data.user.name);
        setText('roleBadge', data.user.role);
    } catch (error) {
        console.error(error);
    }
}

async function loadStats() {
    try {
        const stats = await getJson('/admin/stats');
        setText('numAccounts', `${stats.total} accounts`);
        setText('activeHr', `${stats.active} of ${stats.total}`);
        setText('noFace', stats.face_not_enrolled);
        setText('openStrikes', stats.open_strikes);
    } catch (error) {
        console.error(error);
        setText('activeHr', '-');
        setText('noFace', '-');
        setText('openStrikes', '-');
    }
}

async function logout() {
    try {
        await fetch(API + '/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
    } finally {
        window.location.href = 'login.html';
    }
}

document.getElementById('logoutBtn').addEventListener('click', logout);

renderPeopleTable(document.getElementById('content'));
loadUser();
loadStats();