// Firebase Configuration - Direct Client-Side Loading
// This file contains the Firebase configuration for client-side use

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyDjMtt6gAbbVDbuoUnBnEdSIJVnp6NCUF0",
    authDomain: "coretrex-internal-dashboard.firebaseapp.com",
    projectId: "coretrex-internal-dashboard",
    storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
    messagingSenderId: "16273988237",
    appId: "1:16273988237:web:956c63742712c22185e0c4"
};

// Initialize Firebase with config
async function initializeFirebase() {
    // Import Firebase modules
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    return { app, db };
}

export { initializeFirebase, firebaseConfig };
