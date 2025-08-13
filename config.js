// Firebase configuration - Load from environment variables or secure source
// This file should be served from the server side, not included in client-side bundles

// For development, you can use a server-side approach or environment variables
// For production, this should be loaded from your server

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || window.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || window.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || window.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || window.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || window.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || window.FIREBASE_APP_ID
};

// Export the configuration
export { firebaseConfig };
