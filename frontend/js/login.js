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

document.getElementById("forgetPass").addEventListener('click',(e)=>{
    window.location.href = './resetPassword.html';
});

const errorBox = document.getElementById("error");

function showError(message) {
    errorBox.textContent = message;
}

document.getElementById("form").addEventListener('submit', async (e) => {
    e.preventDefault();
    showError("");
    
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            switch (response.role) {
                case 'admin':
                    window.location.href = 'admindashboard.html';
                    break;
                case 'admin':
                    window.location.href = 'empdashboard.html';
                    break;        
                case 'admin':
                    window.location.href = 'hrdashboard.html';
                    break;
            }
        } else {
            showError(data.message || 'Login failed');
        }
    } catch (error) {
        showError('Cannot reach the server');
    }
});