# 🔧 Manual Update Guide: Remove Exposed API Key

## 📋 Files That Need Manual Updates

The following files still contain the exposed API key and need to be updated manually:

1. `presence.js` (line 17)
2. `goals.js` (line 23)
3. `admin.js` (line 31)
4. `login.js` (line 21)
5. `script.js` (line 14)
6. `kpi.js` (line 8)
7. `tasks.js` (line 14)

## 🔄 Update Pattern for Each File

For each file, you need to make these changes:

### Step 1: Replace Firebase Imports
**Find this:**
```javascript
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
    arrayUnion,
    arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
```

**Replace with:**
```javascript
// Import Firebase modules and secure configuration
import { initializeFirebase } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    arrayUnion,
    arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
```

### Step 2: Remove Firebase Configuration
**Find and DELETE this entire block:**
```javascript
// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "coretrex-internal-dashboard.firebaseapp.com",
    projectId: "coretrex-internal-dashboard",
    storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
    messagingSenderId: "16273988237",
    appId: "1:16273988237:web:956c63742712c22185e0c4"
};
```

### Step 3: Replace Firebase Initialization
**Find this:**
```javascript
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
```

**Replace with:**
```javascript
// Initialize Firebase securely
let app, db;

async function initializeFirebaseApp() {
    try {
        const firebaseInstance = await initializeFirebase();
        app = firebaseInstance.app;
        db = firebaseInstance.db;
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        alert('Failed to initialize application. Please check your configuration.');
    }
}
```

### Step 4: Update DOMContentLoaded Event
**Find this:**
```javascript
document.addEventListener('DOMContentLoaded', () => {
```

**Replace with:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase first
    await initializeFirebaseApp();
```

## 📝 Example: Updating presence.js

Here's exactly what to do for `presence.js`:

1. **Line 1-15**: Replace imports as shown in Step 1
2. **Line 17-25**: Delete the entire firebaseConfig object
3. **Line 27-28**: Replace with the secure initialization code from Step 3
4. **Find DOMContentLoaded**: Update to async and add Firebase initialization

## 🚀 Quick Commands

If you have Node.js installed, you can run:
```bash
npm install
node update-firebase-config.js
```

If not, follow the manual steps above for each file.

## ✅ Verification

After updating each file:
1. Check that no hardcoded API keys are present in the code
2. Verify that `import { initializeFirebase } from './firebase-config.js';` is added
3. Confirm that `initializeFirebaseApp()` is called in DOMContentLoaded
4. Test the application to ensure it still works

## 🔒 Security Checklist

- [ ] Revoke the old API key in Google Cloud Console
- [ ] Create new API key with restrictions
- [ ] Update all 8 JavaScript files
- [ ] Create `.env` file with new API key
- [ ] Test the application
- [ ] Deploy with secure configuration
- [ ] Add `.env` to `.gitignore`

## 🆘 Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Verify all imports are correct
3. Ensure the `firebase-config.js` file exists
4. Confirm environment variables are set correctly
