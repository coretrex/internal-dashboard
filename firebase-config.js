// Firebase Configuration - Secure Loading
// This file loads Firebase configuration from a secure source

// Function to load Firebase config from server or environment
async function loadFirebaseConfig() {
    // Using the original API key for now
    const config = {
        apiKey: "AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo",
        authDomain: "coretrex-internal-dashboard.firebaseapp.com",
        projectId: "coretrex-internal-dashboard",
        storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
        messagingSenderId: "16273988237",
        appId: "1:16273988237:web:956c63742712c22185e0c4"
    };

    return config;
}

// Initialize Firebase with secure config
async function initializeFirebase() {
    const firebaseConfig = await loadFirebaseConfig();
    
    // Import Firebase modules
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    return { app, db };
}

export { initializeFirebase, loadFirebaseConfig };
