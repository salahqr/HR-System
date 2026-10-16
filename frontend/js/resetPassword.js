document.getElementById('togglePassword').addEventListener('click',(e)=>{
    const image = document.getElementById("image");
    const password = document.getElementById("password");

    if (password.type === "password") {
        password.type = "text";
        image.src = '../assets/eyeOpen.svg';  
    } else {
        password.type = "password";
        image.src = '../assets/eyeClosed.svg'; 
    }
});

document.getElementById('toggle-password').addEventListener('click',(e)=>{
    const image = document.getElementById("image2");
    const password = document.getElementById("confirmPassword");

    if (password.type === "password") {
        password.type = "text";
        image.src = '../assets/eyeOpen.svg';  
    } else {
        password.type = "password";
        image.src = '../assets/eyeClosed.svg'; 
    }
});

document.getElementById("backLogin").addEventListener('click',(e)=>{
    window.location.href = './login.html';
});

const errorBox = document.getElementById("error");

function showError(message) {
    errorBox.textContent = message;
}

const form = document.getElementById("form");
const token = new URLSearchParams(window.location.search).get("token");

const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const matchMsg = document.getElementById("matchMsg");

// one function per rule, so adding a rule later is one line
const rules = {
    length:  v => v.length >= 8,
    upper:   v => /[A-Z]/.test(v),
    lower:   v => /[a-z]/.test(v),
    number:  v => /[0-9]/.test(v),
    special: v => /[^A-Za-z0-9]/.test(v)
};

function checkRules() {
    let allOk = true;
    for (const [name, test] of Object.entries(rules)) {
        const ok = test(password.value);
        document.querySelector(`[data-rule="${name}"]`).classList.toggle('ok', ok);
        if (!ok) allOk = false;
    }
    return allOk;
}

function checkMatch() {
    if (confirmPassword.value === '') {
        matchMsg.textContent = '';
        return false;
    }
    const matches = confirmPassword.value === password.value;
    matchMsg.textContent = matches ? 'Passwords match' : 'Passwords do not match';
    matchMsg.classList.toggle('ok', matches);
    return matches;
}

password.addEventListener('input', () => {
    checkRules();
    checkMatch(); // the match can change when the first field changes
});
confirmPassword.addEventListener('input', checkMatch);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError("");

    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        showError("Passwords do not match");
        return;
    }

    try {
        const response = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ token, password })
        });

        const data = await response.json();

        if (response.ok) {
            window.location.href = 'login.html';
        } else {
            showError(data.message || "Reset failed");
        }
    } catch (error) {
        showError("Cannot reach the server");
    }
});