export const hrLinks = [
    { label: 'Dashboard',      href: 'hrdashboard.html' },
    { label: 'Employees',      href: 'employees.html' },
    { label: 'Departments',    href: 'departments.html' },
    { label: 'Attendance',     href: 'attendance.html' },
    { label: 'Leave requests', href: 'leaveRequests.html' },
    { label: 'Projects',       href: 'projects.html' },
    { label: 'Reports',        href: 'reports.html' }
];

export function renderNav(container, links = hrLinks) {
    const currentPage = location.pathname.split('/').pop();

    const items = links.map(link => `
        <li>
            <a href="${link.href}" ${link.href === currentPage ? 'aria-current="page"' : ''}>
                ${link.label}
            </a>
        </li>
    `).join('');

    container.innerHTML = `
        <header class="nav">
            <div class="nav-content">
                <a class="brand" href="${links[0].href}">
                    <img src="../../assets/product.svg" alt="">
                    <span class="brand-name">PresenceHR</span>
                </a>

                <nav class="nav-menu" id="menu">
                    <ul class="nav-links">${items}</ul>
                </nav>

                <div class="user-area">
                    <div class="user-photo">
                        <img src="../../assets/account.svg" alt="photo of account">
                    </div>
                    <div class="user-info">
                        <h3 id="username"></h3>
                    </div>
                    <span class="role-badge" id="roleBadge">HR</span>
                    <button type="button" class="logout-button" id="logoutBtn">Log out</button>
                </div>

                <button type="button" class="burger" id="burger"
                        aria-label="Menu" aria-expanded="false" aria-controls="menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </header>
    `;

    const nav = container.querySelector('.nav');
    const burger = container.querySelector('#burger');

    function setMenu(open) {
        nav.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open);
    }

    burger.addEventListener('click', () => {
        setMenu(!nav.classList.contains('open'));
    });

    nav.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('click', event => {
        if (!nav.contains(event.target)) setMenu(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setMenu(false);
    });

    window.matchMedia('(min-width: 1201px)').addEventListener('change', event => {
        if (event.matches) setMenu(false);
    });

    nav.querySelector('#logoutBtn').addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8000/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
        } finally {
            window.location.href = 'login.html';
        }
    });
}