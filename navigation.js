class Navigation extends HTMLElement {
    constructor() {
        super();
        
        // Get current page to set active state
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Create navigation HTML
        this.innerHTML = `
            <div class="nav-buttons">
                <a href="goals.html" class="nav-btn ${currentPage === 'goals.html' ? 'active' : ''}">
                    <i class="fas fa-bullseye"></i> KPIs
                </a>
                <a href="kpis.html" class="nav-btn ${currentPage === 'kpis.html' ? 'active' : ''}">
                    <i class="fas fa-chart-bar"></i> Call Metrics
                </a>
                <a href="prospects.html" class="nav-btn ${currentPage === 'prospects.html' ? 'active' : ''}">
                    <i class="fas fa-chart-line"></i> Prospects
                </a>
                <a href="clients.html" class="nav-btn ${currentPage === 'clients.html' ? 'active' : ''}">
                    <i class="fas fa-users"></i> Clients
                </a>
            </div>
        `;
    }
}

// Define the custom element
customElements.define('nav-menu', Navigation); 