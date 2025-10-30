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

        // Create admin panel button (only for admin users and only on goals.html)
        if (isAdmin && currentPage === 'goals.html') {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'admin-panel-btn';
            adminBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Admin';
            adminBtn.onclick = () => {
                window.location.href = 'admin.html';
            };
            document.body.appendChild(adminBtn);
        }

        // Add user info widget (top right)
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            const userName = localStorage.getItem('userName') || '';
            let userPhoto = localStorage.getItem('userPhoto') || '';
            // Use a silly raccoon photo if userPhoto is missing or empty
            if (!userPhoto) {
                userPhoto = 'https://cdn.pixabay.com/photo/2017/01/06/19/15/raccoon-1956987_1280.jpg';
            }
            let firstName = userName.split(' ')[0] || userName;
            const userInfoDiv = document.createElement('div');
            userInfoDiv.className = 'user-info-widget';
            userInfoDiv.innerHTML = `
                <img src="${userPhoto}" alt="User Photo" class="user-photo">
                <span class="welcome-message">Welcome, <strong>${firstName}!</strong></span>
                <div class="user-dropdown" style="display:none; position:absolute; top:60px; right:0; background:#23272f; color:white; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.18); min-width:120px; z-index:1300;">
                  <button class="logout-btn" style="width:100%; background:none; border:none; color:white; padding:12px 18px; font-size:1em; text-align:left; cursor:pointer; border-radius:10px;">Log Out</button>
                </div>
            `;
            userInfoDiv.style.position = 'fixed';
            userInfoDiv.style.top = '20px';
            userInfoDiv.style.right = '20px';
            userInfoDiv.style.display = 'flex';
            userInfoDiv.style.alignItems = 'center';
            userInfoDiv.style.gap = '12px';
            userInfoDiv.style.background = 'rgba(30, 34, 44, 0.92)';
            userInfoDiv.style.padding = '10px 18px';
            userInfoDiv.style.borderRadius = '32px';
            userInfoDiv.style.boxShadow = '0 4px 16px rgba(41,121,255,0.10)';
            userInfoDiv.style.zIndex = '1200';
            userInfoDiv.style.color = 'white';
            userInfoDiv.style.fontSize = '1.08em';
            userInfoDiv.style.fontWeight = '500';
            userInfoDiv.style.cursor = 'pointer';
            // Style the image
            userInfoDiv.querySelector('img').style.width = '38px';
            userInfoDiv.querySelector('img').style.height = '38px';
            userInfoDiv.querySelector('img').style.borderRadius = '50%';
            userInfoDiv.querySelector('img').style.objectFit = 'cover';
            userInfoDiv.querySelector('img').style.border = '2.5px solid #2979ff';
            userInfoDiv.querySelector('img').style.background = '#fff';
            // Dropdown logic
            userInfoDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                const dropdown = userInfoDiv.querySelector('.user-dropdown');
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
            // Hide dropdown on outside click
            document.addEventListener('click', function() {
                const dropdown = userInfoDiv.querySelector('.user-dropdown');
                if (dropdown) dropdown.style.display = 'none';
            });
            // Log out logic
            userInfoDiv.querySelector('.logout-btn').addEventListener('click', async function(e) {
                e.stopPropagation();
                // Try Firebase sign out if available
                if (window.firebase && window.firebase.auth) {
                    try { await window.firebase.auth().signOut(); } catch (err) {}
                }
                localStorage.clear();
                window.location.href = 'index.html';
            });
            document.body.appendChild(userInfoDiv);
        }

        // Define all possible pages
        const pages = [
            { id: 'goals', href: 'goals.html', icon: 'fas fa-bullseye', label: 'KPIs' },
            { id: 'kpis', href: 'kpis.html', icon: 'fas fa-chart-bar', label: 'Sales Metrics' },
            { id: 'prospects', href: 'prospects.html', icon: 'fas fa-chart-line', label: 'Prospects' },
            { id: 'clients', href: 'clients.html', icon: 'fas fa-users', label: 'Clients' },
            { id: 'projects', href: 'projects.html', icon: 'fas fa-tasks', label: 'Projects' },
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
        
        // Chrome-specific fix to ensure navigation is always visible
        setTimeout(() => {
            const navButtons = this.querySelector('.nav-buttons');
            if (navButtons) {
                // Force a reflow to ensure Chrome renders the element
                navButtons.style.display = 'none';
                navButtons.offsetHeight; // Force reflow
                navButtons.style.display = 'flex';
                
                // Additional Chrome-specific visibility check
                const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                if (isChrome) {
                    // Add Chrome-specific class for CSS targeting
                    navButtons.classList.add('chrome-nav-fix');
                    
                    // Ensure the element is visible and properly positioned
                    navButtons.style.visibility = 'visible';
                    navButtons.style.opacity = '1';
                    navButtons.style.pointerEvents = 'auto';
                    
                    // Force hardware acceleration
                    navButtons.style.transform = 'translateX(-50%) translateZ(0)';
                    navButtons.style.webkitTransform = 'translateX(-50%) translateZ(0)';
                    
                    // Additional Chrome-specific positioning fix
                    navButtons.style.position = 'fixed';
                    navButtons.style.bottom = '20px';
                    navButtons.style.left = '50%';
                }
            }
        }, 100);
    }
}

// Define the custom element
customElements.define('nav-menu', Navigation); 