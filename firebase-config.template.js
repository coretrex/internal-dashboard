// Firebase Configuration Template
// Copy this file to firebase-config.js and replace YOUR_API_KEY_HERE with your actual API key

export async function initializeFirebase() {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

    const firebaseConfig = {
        apiKey: "YOUR_API_KEY_HERE", // Replace with your actual API key
        authDomain: "coretrex-internal-dashboard.firebaseapp.com",
        projectId: "coretrex-internal-dashboard",
        storageBucket: "coretrex-internal-dashboard.appspot.com",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:abcdefghijklmnop"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    return { app, db };
}
