const API = 'http://127.0.0.1:8000'; // your Laravel address

export function setupAddUser({ openButton, title, onCreated }) {
    const dialog = document.createElement('dialog');
    dialog.className = 'user-dialog';
    dialog.innerHTML = `
        <form class="dialog-body" data-step="form">
            <div class="dialog-head">
                <h2>${title}</h2>
                <button type="button" class="dialog-close" aria-label="Close">&times;</button>
            </div>
            <p class="dialog-error" role="alert"></p>

            <label for="newName">Full name</label>
            <input id="newName" name="name" required>

            <label for="newEmail">Work email</label>
            <input type="email" id="newEmail" name="email" required>

            <label for="newJobTitle">Job title</label>
            <input id="newJobTitle" name="job_title" required>

            <label for="newHireDate">Hire date</label>
            <input type="date" id="newHireDate" name="hire_date" required>

            <div class="dialog-actions">
                <button type="button" class="btn-cancel">Cancel</button>
                <button type="submit" class="btn-primary">Create</button>
            </div>
        </form>

        <div class="dialog-body" data-step="done" hidden>
            <div class="dialog-head">
                <h2>User created</h2>
                <button type="button" class="dialog-close" aria-label="Close">&times;</button>
            </div>
            <p class="dialog-note">Give this temporary password to the user. It is shown only once.</p>
            <div class="temp-password"></div>
            <div class="dialog-actions">
                <button type="button" class="btn-cancel copy-button">Copy</button>
                <button type="button" class="btn-primary done-button">Done</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    const form = dialog.querySelector('[data-step="form"]');
    const doneStep = dialog.querySelector('[data-step="done"]');
    const errorBox = dialog.querySelector('.dialog-error');
    const submitButton = dialog.querySelector('.btn-primary[type="submit"]');
    const passwordBox = dialog.querySelector('.temp-password');
    let created = false;

    function reset() {
        form.reset();
        errorBox.textContent = '';
        form.hidden = false;
        doneStep.hidden = true;
        passwordBox.textContent = '';
        created = false;
    }

    openButton.addEventListener('click', () => {
        reset();
        dialog.showModal();
    });

    dialog.querySelectorAll('.dialog-close, .btn-cancel:not(.copy-button), .done-button')
        .forEach(button => button.addEventListener('click', () => dialog.close()));

    // click on the dark background closes it
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });

    // refresh the page's data after the popup closes
    dialog.addEventListener('close', () => {
        if (created && onCreated) onCreated();
    });

    dialog.querySelector('.copy-button').addEventListener('click', () => {
        navigator.clipboard.writeText(passwordBox.textContent);
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        errorBox.textContent = '';
        submitButton.disabled = true;

        try {
            const response = await fetch(API + '/users', {   // GUESS: endpoint
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            });

            const data = await response.json();

            if (!response.ok) {
                errorBox.textContent = data.message || 'Could not create the user';
                return;
            }

            created = true;
            passwordBox.textContent = data.temporary_password; // GUESS: field name
            form.hidden = true;
            doneStep.hidden = false;
        } catch (error) {
            errorBox.textContent = 'Cannot reach the server';
        } finally {
            submitButton.disabled = false;
        }
    });
}