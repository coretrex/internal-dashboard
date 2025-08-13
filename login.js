// Login specific code
import { initializeFirebase } from './firebase-config.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    getDocs,
    collection
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// ... other imports

// Global variables for Firebase app and db
let app, auth, provider, db;

// Initialize Firebase with secure config
async function initializeFirebaseApp() {
    const firebaseInstance = await initializeFirebase();
    app = firebaseInstance.app;
    db = firebaseInstance.db;
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
}

// Helper: Provision user in Firestore
async function provisionUser(user) {
    const userRef = doc(db, "users", user.email);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        // User exists, return data
        return userSnap.data();
    } else {
        // Check if this is the first user (make admin)
        const usersSnap = await getDocs(collection(db, "users"));
        const isFirstUser = usersSnap.empty;
        const defaultRole = isFirstUser ? "admin" : "user";
        const defaultPageAccess = ["goals", "kpis", "prospects", "clients"];
        const userData = {
            email: user.email,
            name: user.displayName,
            role: defaultRole,
            pageAccess: defaultPageAccess,
            enabled: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
        };
        await setDoc(userRef, userData);
        return userData;
    }
}

// Login functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase first
    await initializeFirebaseApp();
    
    const loginButton = document.getElementById("loginButton");
    const loginError = document.getElementById("loginError");
    const loginContainer = document.querySelector('.login-container');
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'loading-spinner';
    loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    loadingSpinner.style.display = 'none';

    // Check if user is already signed in
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Provision/check user in Firestore
            const userData = await provisionUser(user);
            if (!userData.enabled) {
                // User is disabled
                localStorage.clear();
                if (loginError) {
                    loginError.style.display = "block";
                    loginError.innerHTML = `<strong>Access Denied</strong><br>Your account is disabled. Please contact your administrator.`;
                }
                await signOut(auth);
                return;
            }
            // Store user info and permissions
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userName', user.displayName);
            localStorage.setItem('userPhoto', user.photoURL || '');
            localStorage.setItem('userRole', userData.role);
            localStorage.setItem('userPageAccess', JSON.stringify(userData.pageAccess || []));
            window.location.href = 'goals.html';
        }
    });

    if (loginButton) {
        // Update button text and remove password input
        loginButton.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
        loginButton.style.background = 'linear-gradient(45deg, #4285f4, #34a853)';
        // Remove password input if it exists
        const passwordInput = document.getElementById("passwordInput");
        if (passwordInput) {
            passwordInput.parentElement.remove();
        }
        loginButton.addEventListener("click", async () => {
            try {
                // Show loading spinner
                loginButton.style.display = 'none';
                loginContainer.appendChild(loadingSpinner);
                loadingSpinner.style.display = 'block';
                // Sign in with Google
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                // Provision/check user in Firestore
                const userData = await provisionUser(user);
                if (!userData.enabled) {
                    // User is disabled
                    localStorage.clear();
                    loadingSpinner.style.display = 'none';
                    loginButton.style.display = 'block';
                    if (loginError) {
                        loginError.style.display = "block";
                        loginError.innerHTML = `<strong>Access Denied</strong><br>Your account is disabled. Please contact your administrator.`;
                    }
                    await signOut(auth);
                    return;
                }
                // Store user info and permissions
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userName', user.displayName);
                localStorage.setItem('userPhoto', user.photoURL || '');
                localStorage.setItem('userRole', userData.role);
                localStorage.setItem('userPageAccess', JSON.stringify(userData.pageAccess || []));
                window.location.href = 'goals.html';
            } catch (error) {
                console.error('Sign-in error:', error);
                // Hide loading spinner and show error
                loadingSpinner.style.display = 'none';
                loginButton.style.display = 'block';
                if (loginError) {
                    loginError.style.display = "block";
                    if (error.code === 'auth/configuration-not-found') {
                        loginError.innerHTML = `
                            <strong>Google Authentication Not Configured</strong><br>
                            Please contact your administrator to enable Google sign-in in Firebase.<br>
                            <small>Error: ${error.message}</small>
                        `;
                    } else if (error.code === 'auth/popup-closed-by-user') {
                        loginError.textContent = "Sign-in was cancelled. Please try again.";
                    } else if (error.code === 'auth/popup-blocked') {
                        loginError.textContent = "Pop-up was blocked. Please allow pop-ups and try again.";
                    } else {
                        loginError.textContent = `Sign-in failed: ${error.message}`;
                    }
                }
            }
        });
    }

    // Add sign out functionality (optional - for testing)
    const signOutButton = document.createElement('button');
    signOutButton.textContent = 'Sign Out (Debug)';
    signOutButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #e74c3c;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        z-index: 1000;
    `;
    signOutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            localStorage.removeItem('userPhoto');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userPageAccess');
            window.location.reload();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    });
    document.body.appendChild(signOutButton);
});

function createEmbers() {
    const flamesElement = document.querySelector('.flames');
    if (flamesElement) {
        for (let i = 0; i < 20; i++) {
            const ember = document.createElement('div');
            ember.className = 'ember';
            ember.style.left = `${Math.random() * 100}%`;
            ember.style.animationDuration = `${1 + Math.random() * 2}s`;
            ember.style.animationDelay = `${Math.random() * 2}s`;
            flamesElement.appendChild(ember);
        }
    }
}

// Call this after the DOM is loaded
document.addEventListener('DOMContentLoaded', createEmbers); 