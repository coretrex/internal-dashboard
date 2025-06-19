class Navigation extends HTMLElement {
    constructor() {
        super();
        
        // Get current page to set active state
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Get user access from localStorage
        let pageAccess = [];
        let isAdmin = false;
        try {
            pageAccess = JSON.parse(localStorage.getItem('userPageAccess')) || [];
            isAdmin = localStorage.getItem('userRole') === 'admin';
        } catch (e) {
            pageAccess = [];
        }

        // Create admin panel button (only for admin users)
        if (isAdmin) {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'admin-panel-btn';
            adminBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Admin';
            adminBtn.onclick = () => {
                window.location.href = 'admin.html';
            };
            document.body.appendChild(adminBtn);
        }

        // Define all possible pages
        const pages = [
            { id: 'goals', href: 'goals.html', icon: 'fas fa-bullseye', label: 'KPIs' },
            { id: 'kpis', href: 'kpis.html', icon: 'fas fa-chart-bar', label: 'Call Metrics' },
            { id: 'prospects', href: 'prospects.html', icon: 'fas fa-chart-line', label: 'Prospects' },
            { id: 'clients', href: 'clients.html', icon: 'fas fa-users', label: 'Clients' },
        ];

        // Build navigation HTML
        let navHtml = '<div class="nav-buttons">';
        for (const page of pages) {
            if (pageAccess.includes(page.id) || isAdmin) {
                navHtml += `
                    <a href="${page.href}" class="nav-btn ${currentPage === page.href ? 'active' : ''}">
                        <i class="${page.icon}"></i> ${page.label}
                    </a>
                `;
            }
        }
        // Always show Admin Panel for admins
        if (isAdmin) {
            navHtml += `
                <a href="admin.html" class="nav-btn ${currentPage === 'admin.html' ? 'active' : ''}">
                    <i class="fas fa-shield-alt"></i> Admin
                </a>
            `;
        }
        navHtml += '</div>';
        this.innerHTML = navHtml;
    }
}

// Define the custom element
customElements.define('nav-menu', Navigation); 