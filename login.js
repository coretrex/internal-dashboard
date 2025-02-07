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