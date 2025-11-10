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

        // Removed legacy top-left Admin button; Admin is available via sidebar link

        // Add user info widget (prepare for sidebar insertion)
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn && !document.querySelector('.user-info-widget')) {
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
                <div class="notification-bell-container" id="notificationBell" style="position: relative; cursor: pointer; margin-right: 8px;">
                    <i class="fas fa-bell" style="font-size: 1.3rem; color: #fff;"></i>
                    <span class="notification-badge" id="notificationBadge" style="display: none; position: absolute; top: -8px; right: -8px; background: #ff3b30; color: white; border-radius: 50%; min-width: 20px; height: 20px; font-size: 0.7rem; font-weight: bold; align-items: center; justify-content: center; border: 2px solid rgba(30, 34, 44, 0.92); padding: 2px 4px; box-shadow: 0 2px 6px rgba(255, 59, 48, 0.4);">0</span>
                </div>
                <img src="${userPhoto}" alt="User Photo" class="user-photo">
                <span class="welcome-message">Welcome, <strong>${firstName}!</strong></span>
                <div class="user-dropdown" style="display:none; position:absolute; top:60px; right:0; background:#23272f; color:white; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.18); min-width:120px; z-index:1300;">
                  <button class="logout-btn" style="width:100%; background:none; border:none; color:white; padding:12px 18px; font-size:1em; text-align:left; cursor:pointer; border-radius:10px;">Log Out</button>
                </div>
            `;
            // Note: do not append to body or apply top-right fixed styles to avoid flash
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
                // Try Firebase sign out using v10 modular syntax
                try {
                    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
                    const auth = getAuth();
                    await signOut(auth);
                } catch (err) {
                    console.error('Sign out error:', err);
                }
                localStorage.clear();
                window.location.href = 'index.html';
            });
            // Stash for sidebar insertion without flashing on page load
            this._prebuiltUserInfo = userInfoDiv;
        }

        // Define all possible pages
        const pages = [
            { id: 'goals', href: 'goals.html', icon: 'fas fa-bullseye', label: 'L10' },
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
                        <i class="${page.icon}"></i><span class="nav-label">${page.label}</span>
                    </a>
                `;
            }
        }
        // Admin link will be appended near the bottom (after Notifications) if user is admin
        navHtml += '</div>';
        this.innerHTML = navHtml;
        
        // Apply saved collapsed state immediately to avoid flash on navigation
        const initialNavButtons = this.querySelector('.nav-buttons');
        if (initialNavButtons) {
            if (localStorage.getItem('navCollapsed') === 'true') {
                initialNavButtons.classList.add('collapsed');
            }
        }
        
        // Ensure navigation is visible (sidebar layout)
        setTimeout(() => {
            const navButtons = this.querySelector('.nav-buttons');
            if (navButtons) {
                navButtons.style.display = 'flex';
                navButtons.style.visibility = 'visible';
                navButtons.style.opacity = '1';
                navButtons.classList.add('chrome-nav-fix');
                
                // Add collapse/expand control (we will position it at the bottom later)
                if (!navButtons.querySelector('.nav-collapse-btn')) {
                    const collapseBtn = document.createElement('button');
                    collapseBtn.className = 'nav-collapse-btn';
                    collapseBtn.type = 'button';
                    collapseBtn.innerHTML = '<i class="fas fa-angle-double-left"></i> Collapse';
                    collapseBtn.addEventListener('click', () => {
                        const isCollapsed = navButtons.classList.toggle('collapsed');
                        localStorage.setItem('navCollapsed', String(isCollapsed));
                    collapseBtn.innerHTML = isCollapsed
                          ? '<i class="fas fa-angle-double-right"></i>'
                          : '<i class="fas fa-angle-double-left"></i> Collapse';
                    collapseBtn.title = isCollapsed ? 'Expand menu' : 'Collapse menu';
                    });
                    // Temporarily append; repositioning happens after links/signout exist
                    navButtons.appendChild(collapseBtn);
                    // Initialize from saved state
                    const savedCollapsed = localStorage.getItem('navCollapsed') === 'true';
                    if (savedCollapsed) {
                        navButtons.classList.add('collapsed');
                        collapseBtn.innerHTML = '<i class="fas fa-angle-double-right"></i>';
                        collapseBtn.title = 'Expand menu';
                    }
                }
                
                // Move "Welcome, First Name" widget into the top of the sidebar
                let userInfo = document.querySelector('.user-info-widget') || this._prebuiltUserInfo;
                if (userInfo) {
                    try {
                        userInfo.removeAttribute('style');
                        const img = userInfo.querySelector('img');
                        if (img) img.removeAttribute('style');
                        // Re-arrange structure for sidebar: put name on one line, bell on next line
                        const bell = userInfo.querySelector('.notification-bell-container');
                        const welcome = userInfo.querySelector('.welcome-message');
                        if (bell && welcome && img) {
                            // Create header row (photo + welcome)
                            const headerRow = document.createElement('div');
                            headerRow.className = 'user-header-row';
                            headerRow.appendChild(img);
                            headerRow.appendChild(welcome);
                            // Remove originals from root
                            userInfo.insertBefore(headerRow, userInfo.firstChild);
                            // Detach bell for later placement at end of menu list
                            bell.remove();
                            // Store bell on instance for later insertion
                            this._navBell = bell;
                        }
                        // Insert as first element in the sidebar
                        if (navButtons.firstChild) {
                            navButtons.insertBefore(userInfo, navButtons.firstChild);
                        } else {
                            navButtons.appendChild(userInfo);
                        }
                    } catch (e) {
                        console.warn('Could not move user info widget into navigation:', e);
                    }
                } else {
                    // If the user widget hasn't been created yet (e.g., different page boot order),
                    // observe for it and move it into the nav when it appears.
                    const moveWhenReady = (ui) => {
                        try {
                            ui.removeAttribute('style');
                            const img = ui.querySelector('img');
                            if (img) img.removeAttribute('style');
                            const bell = ui.querySelector('.notification-bell-container');
                            const welcome = ui.querySelector('.welcome-message');
                            if (bell && welcome && img) {
                                const headerRow = document.createElement('div');
                                headerRow.className = 'user-header-row';
                                headerRow.appendChild(img);
                                headerRow.appendChild(welcome);
                                ui.insertBefore(headerRow, ui.firstChild);
                                bell.remove();
                                this._navBell = bell;
                            }
                            if (navButtons.firstChild) {
                                navButtons.insertBefore(ui, navButtons.firstChild);
                            } else {
                                navButtons.appendChild(ui);
                            }
                        } catch (err) {
                            console.warn('Deferred move of user info failed:', err);
                        }
                    };
                    const observer = new MutationObserver(() => {
                        const ui = document.querySelector('.user-info-widget');
                        if (ui) {
                            observer.disconnect();
                            moveWhenReady(ui);
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                    // Fallback timeout
                    setTimeout(() => {
                        const ui = document.querySelector('.user-info-widget');
                        if (ui && !navButtons.contains(ui)) {
                            try { observer.disconnect(); } catch {}
                            moveWhenReady(ui);
                        }
                    }, 600);
                }
                
                // If still no user widget anywhere, create a minimal one and insert it
                if (!document.querySelector('.user-info-widget')) {
                    try {
                        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
                        if (isLoggedIn) {
                            const userName = localStorage.getItem('userName') || '';
                            let userPhoto = localStorage.getItem('userPhoto') || '';
                            if (!userPhoto) {
                                userPhoto = 'https://cdn.pixabay.com/photo/2017/01/06/19/15/raccoon-1956987_1280.jpg';
                            }
                            const firstName = (userName.split(' ')[0] || userName) || 'User';
                            const ui = document.createElement('div');
                            ui.className = 'user-info-widget';
                            ui.innerHTML = `
                                <div class="user-header-row">
                                  <img src="${userPhoto}" alt="User Photo" class="user-photo">
                                  <span class="welcome-message">Welcome, <strong>${firstName}!</strong></span>
                                </div>
                            `;
                            // Basic logout via context menu on user card
                            ui.addEventListener('contextmenu', async (e) => {
                                e.preventDefault();
                                try {
                                    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
                                    const auth = getAuth();
                                    await signOut(auth);
                                } catch (err) {
                                    console.error('Sign out error:', err);
                                }
                                localStorage.clear();
                                window.location.href = 'index.html';
                            });
                            navButtons.insertBefore(ui, navButtons.firstChild.nextSibling || navButtons.firstChild);
                        }
                    } catch (e) {
                        console.warn('Failed to create inline user widget:', e);
                    }
                }
                
                // Move existing global sound toggle into the nav if present (position at bottom later)
                const soundToggle = document.getElementById('soundToggle');
                if (soundToggle) {
                    try {
                        // Remove absolute/fixed positioning so it fits the nav
                        soundToggle.removeAttribute('style');
                        soundToggle.classList.add('nav-sound-toggle');
                        // Temporarily append; reposition later
                        navButtons.appendChild(soundToggle);
                    } catch (e) {
                        console.warn('Could not move sound toggle into navigation:', e);
                    }
                } else {
                    // Create a persistent sound toggle if one doesn't exist on this page
                    const btn = document.createElement('button');
                    btn.id = 'soundToggle';
                    btn.className = 'nav-sound-toggle';
                    btn.title = 'Toggle all sounds';
                    btn.innerHTML = '<i class="fas fa-volume-up"></i>';
                    // Initialize state from localStorage
                    const isMuted = localStorage.getItem('soundsMuted') === 'true';
                    const icon = btn.querySelector('i');
                    if (isMuted) {
                        icon.className = 'fas fa-volume-mute';
                        btn.title = 'All sounds muted - Click to unmute';
                    } else {
                        icon.className = 'fas fa-volume-up';
                        btn.title = 'Sounds on - Click to mute all sounds';
                    }
                    btn.addEventListener('click', () => {
                        const currentlyMuted = localStorage.getItem('soundsMuted') === 'true';
                        const newMuted = !currentlyMuted;
                        localStorage.setItem('soundsMuted', String(newMuted));
                        const icon = btn.querySelector('i');
                        icon.className = newMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
                        btn.title = newMuted ? 'All sounds muted - Click to unmute' : 'Sounds on - Click to mute all sounds';
                    });
                    // Temporarily append; reposition later
                    navButtons.appendChild(btn);
                }

                // Final safeguard: periodically ensure the user widget is embedded
                (() => {
                    let attempts = 0;
                    const MAX_ATTEMPTS = 10;
                    const intervalId = setInterval(() => {
                        attempts++;
                        const uiEls = Array.from(document.querySelectorAll('.user-info-widget'));
                        uiEls.forEach(ui => {
                            if (!navButtons.contains(ui)) {
                                try {
                                    ui.removeAttribute('style');
                                    const img = ui.querySelector('img');
                                    if (img) img.removeAttribute('style');
                                    navButtons.insertBefore(ui, navButtons.firstChild || null);
                                } catch {}
                            }
                        });
                        if (attempts >= MAX_ATTEMPTS) clearInterval(intervalId);
                    }, 400);
                })();

                // Insert MENU label above the first nav link if not already present
                if (!navButtons.querySelector('.nav-section-title')) {
                    const title = document.createElement('div');
                    title.className = 'nav-section-title';
                    title.textContent = 'Menu';
                    const firstLink = navButtons.querySelector('.nav-btn');
                    navButtons.insertBefore(title, firstLink || null);
                }

                // Place notifications at the end of the menu list
                if (this._navBell && !navButtons.querySelector('.nav-notifications')) {
                    const notifRow = document.createElement('a');
                    notifRow.className = 'nav-btn nav-notifications';
                    notifRow.href = '#';
                    notifRow.appendChild(this._navBell);
                    const label = document.createElement('span');
                    label.className = 'nav-label';
                    label.textContent = 'Notifications';
                    notifRow.appendChild(label);
                    notifRow.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            if (typeof window.openNotificationsModal === 'function') {
                                await window.openNotificationsModal();
                            } else {
                                localStorage.setItem('openNotificationsOnLoad', 'true');
                                window.location.href = 'projects.html';
                            }
                        } catch (err) {
                            console.warn('Could not open notifications modal:', err);
                            localStorage.setItem('openNotificationsOnLoad', 'true');
                            window.location.href = 'projects.html';
                        }
                    });
                    const signout = navButtons.querySelector('.nav-signout-container');
                    if (signout) {
                        navButtons.insertBefore(notifRow, signout);
                    } else {
                        navButtons.appendChild(notifRow);
                    }
                }

                // Append Admin link just below Notifications (and above Sign Out) for admin users
                if (isAdmin && !navButtons.querySelector('.nav-admin-link')) {
                    const adminLink = document.createElement('a');
                    adminLink.className = `nav-btn nav-admin-link ${currentPage === 'admin.html' ? 'active' : ''}`;
                    adminLink.href = 'admin.html';
                    adminLink.innerHTML = '<i class="fas fa-shield-alt"></i><span class="nav-label">Admin</span>';
                    const signout = navButtons.querySelector('.nav-signout-container');
                    if (signout) {
                        navButtons.insertBefore(adminLink, signout);
                    } else {
                        navButtons.appendChild(adminLink);
                    }
                }

                // Add Sign Out button at the very bottom
                if (!navButtons.querySelector('.nav-signout-container')) {
                    const container = document.createElement('div');
                    container.className = 'nav-signout-container';
                    const btn = document.createElement('button');
                    btn.className = 'nav-signout-btn';
                    btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
                            const auth = getAuth();
                            await signOut(auth);
                        } catch (err) {
                            console.error('Sign out error:', err);
                        }
                        localStorage.clear();
                        window.location.href = 'index.html';
                    });
                    container.appendChild(btn);
                    navButtons.appendChild(container);
                }
                
                // Reposition collapse button and sound toggle to bottom (just above Sign Out)
                const signoutContainer = navButtons.querySelector('.nav-signout-container');
                const collapseControl = navButtons.querySelector('.nav-collapse-btn');
                const soundControlFinal = navButtons.querySelector('.nav-sound-toggle');
                if (soundControlFinal) {
                    navButtons.insertBefore(soundControlFinal, signoutContainer || null);
                }
                if (collapseControl) {
                    navButtons.insertBefore(collapseControl, signoutContainer || null);
                }
            }
        }, 100);
    }
}

// Define the custom element
customElements.define('nav-menu', Navigation); 