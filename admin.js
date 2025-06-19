// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    setDoc,
    getDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo",
    authDomain: "coretrex-internal-dashboard.firebaseapp.com",
    projectId: "coretrex-internal-dashboard",
    storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
    messagingSenderId: "16273988237",
    appId: "1:16273988237:web:956c63742712c22185e0c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Available pages for access control
const AVAILABLE_PAGES = [
    { id: 'goals', name: 'KPIs & Goals', icon: 'fas fa-bullseye' },
    { id: 'kpis', name: 'Call Metrics', icon: 'fas fa-chart-bar' },
    { id: 'prospects', name: 'Prospects', icon: 'fas fa-chart-line' },
    { id: 'clients', name: 'Clients', icon: 'fas fa-users' }
];

// User roles
const USER_ROLES = {
    admin: { name: 'Admin', color: '#e74c3c', permissions: ['all'] },
    user: { name: 'User', color: '#3498db', permissions: ['read', 'write'] },
    viewer: { name: 'Viewer', color: '#95a5a6', permissions: ['read'] }
};

document.addEventListener('DOMContentLoaded', () => {
    // PAGE GUARD
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userRole = localStorage.getItem('userRole');
    if (!isLoggedIn || userRole !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = 'index.html';
        return;
    }

    // Check authentication and admin access
    checkAdminAccess();
    
    // Initialize admin panel
    initializeAdminPanel();
    
    // Set up event listeners
    setupEventListeners();
});

// Check if current user has admin access
async function checkAdminAccess() {
    try {
        // Use localStorage data instead of Firebase auth state
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole');
        
        if (!isLoggedIn || userRole !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'index.html';
            return;
        }

        // Update current user display
        const userName = localStorage.getItem('userName') || 'Unknown User';
        document.getElementById('currentUser').textContent = `${userName} (${userEmail})`;
        
    } catch (error) {
        console.error('Error checking admin access:', error);
        window.location.href = 'index.html';
    }
}

// Initialize admin panel
async function initializeAdminPanel() {
    try {
        // Load users
        await loadUsers();
        
        // Load system settings
        await loadSystemSettings();
        
        // Initialize page access grid
        initializePageAccessGrid();
        
    } catch (error) {
        console.error('Error initializing admin panel:', error);
    }
}

// Load all users from Firebase
async function loadUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const users = [];
        
        usersSnapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderUsersTable(users);
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Render users table
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const roleInfo = USER_ROLES[user.role] || USER_ROLES.user;
        
        row.innerHTML = `
            <td>${user.email}</td>
            <td>${user.name || 'N/A'}</td>
            <td>
                <span class="role-badge" style="background-color: ${roleInfo.color}">
                    ${roleInfo.name}
                </span>
            </td>
            <td>
                <div class="page-access-list">
                    ${(user.pageAccess || []).map(page => {
                        const pageInfo = AVAILABLE_PAGES.find(p => p.id === page);
                        return pageInfo ? `<span class="page-badge">${pageInfo.name}</span>` : '';
                    }).join('')}
                </div>
            </td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
            <td>
                <button class="admin-btn small" onclick="editUser('${user.email}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="admin-btn small danger" onclick="deleteUser('${user.email}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Initialize page access grid
function initializePageAccessGrid() {
    const grid = document.getElementById('pageAccessGrid');
    grid.innerHTML = '';
    
    AVAILABLE_PAGES.forEach(page => {
        const pageCard = document.createElement('div');
        pageCard.className = 'page-access-card';
        pageCard.innerHTML = `
            <div class="page-access-header">
                <i class="${page.icon}"></i>
                <h3>${page.name}</h3>
            </div>
            <div class="page-access-controls">
                <label class="checkbox-item">
                    <input type="checkbox" id="page_${page.id}_admin" checked> Admin
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="page_${page.id}_user" checked> User
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="page_${page.id}_viewer" checked> Viewer
                </label>
            </div>
        `;
        grid.appendChild(pageCard);
    });
}

// Load system settings
async function loadSystemSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, "systemSettings", "general"));
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            document.getElementById('defaultRole').value = settings.defaultRole || 'user';
            document.getElementById('sessionTimeout').value = settings.sessionTimeout || 480;
        }
    } catch (error) {
        console.error('Error loading system settings:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Add user button
    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('addUserModal').style.display = 'block';
    });
    
    // Refresh users button
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);
    
    // Save settings button
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSystemSettings);
    
    // Sign out button
    document.getElementById('signOutBtn').addEventListener('click', handleSignOut);
    
    // Modal close buttons
    document.querySelectorAll('.admin-modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.admin-modal').style.display = 'none';
        });
    });
    
    // Cancel buttons
    document.getElementById('cancelAddUser').addEventListener('click', () => {
        document.getElementById('addUserModal').style.display = 'none';
    });
    
    document.getElementById('cancelEditUser').addEventListener('click', () => {
        document.getElementById('editUserModal').style.display = 'none';
    });
    
    // Add user form
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    
    // Edit user form
    document.getElementById('editUserForm').addEventListener('submit', handleEditUser);
    
    // Delete user button
    document.getElementById('deleteUserBtn').addEventListener('click', handleDeleteUser);
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('admin-modal')) {
            e.target.style.display = 'none';
        }
    });
}

// Handle add user
async function handleAddUser(e) {
    e.preventDefault();
    
    const email = document.getElementById('userEmail').value;
    const role = document.getElementById('userRole').value;
    const pageAccess = Array.from(document.querySelectorAll('#addUserForm input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    try {
        // Check if user already exists
        const existingUser = await getDoc(doc(db, "users", email));
        if (existingUser.exists()) {
            alert('User already exists!');
            return;
        }
        
        // Add user to Firebase
        await setDoc(doc(db, "users", email), {
            email: email,
            role: role,
            pageAccess: pageAccess,
            createdAt: new Date().toISOString(),
            createdBy: localStorage.getItem('userEmail')
        });
        
        // Close modal and refresh
        document.getElementById('addUserModal').style.display = 'none';
        document.getElementById('addUserForm').reset();
        await loadUsers();
        
        alert('User added successfully!');
        
    } catch (error) {
        console.error('Error adding user:', error);
        alert('Error adding user. Please try again.');
    }
}

// Edit user function (global for onclick)
window.editUser = async function(email) {
    try {
        const userDoc = await getDoc(doc(db, "users", email));
        if (!userDoc.exists()) {
            alert('User not found!');
            return;
        }
        
        const user = userDoc.data();
        
        // Populate edit form
        document.getElementById('editUserId').value = email;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserRole').value = user.role;
        
        // Populate page access checkboxes
        const pageAccessContainer = document.getElementById('editUserPageAccess');
        pageAccessContainer.innerHTML = '';
        
        AVAILABLE_PAGES.forEach(page => {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <input type="checkbox" value="${page.id}" ${(user.pageAccess || []).includes(page.id) ? 'checked' : ''}>
                ${page.name}
            `;
            pageAccessContainer.appendChild(label);
        });
        
        // Show modal
        document.getElementById('editUserModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading user for edit:', error);
        alert('Error loading user data.');
    }
};

// Handle edit user
async function handleEditUser(e) {
    e.preventDefault();
    
    const email = document.getElementById('editUserId').value;
    const role = document.getElementById('editUserRole').value;
    const pageAccess = Array.from(document.querySelectorAll('#editUserPageAccess input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    try {
        await updateDoc(doc(db, "users", email), {
            role: role,
            pageAccess: pageAccess,
            updatedAt: new Date().toISOString(),
            updatedBy: localStorage.getItem('userEmail')
        });
        
        // Close modal and refresh
        document.getElementById('editUserModal').style.display = 'none';
        await loadUsers();
        
        alert('User updated successfully!');
        
    } catch (error) {
        console.error('Error updating user:', error);
        alert('Error updating user. Please try again.');
    }
}

// Delete user function (global for onclick)
window.deleteUser = async function(email) {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "users", email));
        await loadUsers();
        alert('User deleted successfully!');
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
    }
};

// Handle delete user from modal
async function handleDeleteUser() {
    const email = document.getElementById('editUserId').value;
    await window.deleteUser(email);
    document.getElementById('editUserModal').style.display = 'none';
}

// Save system settings
async function saveSystemSettings() {
    try {
        const defaultRole = document.getElementById('defaultRole').value;
        const sessionTimeout = parseInt(document.getElementById('sessionTimeout').value);
        
        await setDoc(doc(db, "systemSettings", "general"), {
            defaultRole: defaultRole,
            sessionTimeout: sessionTimeout,
            updatedAt: new Date().toISOString(),
            updatedBy: localStorage.getItem('userEmail')
        });
        
        alert('Settings saved successfully!');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings. Please try again.');
    }
}

// Handle sign out
async function handleSignOut() {
    try {
        // Clear localStorage
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userPageAccess');
        
        // Sign out from Firebase
        await signOut(auth);
        
        // Redirect to login
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        // Even if Firebase signout fails, clear localStorage and redirect
        localStorage.clear();
        window.location.href = 'index.html';
    }
} 