// Login specific code
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// ... other imports

// Login functionality
document.addEventListener('DOMContentLoaded', () => {
    const correctPassword = "2020";
    const loginButton = document.getElementById("loginButton");
    const passwordInput = document.getElementById("passwordInput");
    const loginError = document.getElementById("loginError");

    if (loginButton) {
        loginButton.addEventListener("click", () => {
            if (passwordInput.value === correctPassword) {
                // Store login state if needed
                localStorage.setItem('isLoggedIn', 'true');
                
                // Redirect to leads page
                window.location.href = 'kpis.html';
            } else {
                loginError.style.display = "block";
                loginError.textContent = "Incorrect password. Please try again.";
            }
        });
    }
    // ... rest of login code
});

function createEmbers() {
    const flamesElement = document.querySelector('.flames');
    for (let i = 0; i < 20; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        ember.style.left = `${Math.random() * 100}%`;
        ember.style.animationDuration = `${1 + Math.random() * 2}s`;
        ember.style.animationDelay = `${Math.random() * 2}s`;
        flamesElement.appendChild(ember);
    }
}

// Call this after the DOM is loaded
document.addEventListener('DOMContentLoaded', createEmbers); 