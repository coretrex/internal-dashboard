#!/usr/bin/env node

/**
 * Script to update all JavaScript files to use secure Firebase configuration
 * This script will replace hardcoded Firebase config with secure imports
 */

const fs = require('fs');
const path = require('path');

// Files that need to be updated
const filesToUpdate = [
    'clients.js',
    'presence.js', 
    'goals.js',
    'admin.js',
    'login.js',
    'script.js',
    'kpi.js',
    'tasks.js'
];

// Firebase config pattern to replace
const firebaseConfigPattern = /const firebaseConfig = \{[^}]*apiKey:\s*"AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo"[^}]*\};/s;

// New secure import pattern
const secureImport = `// Import Firebase modules and secure configuration
import { initializeFirebase } from './firebase-config.js';
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
}`;

// Old Firebase initialization pattern
const oldInitPattern = /const app = initializeApp\(firebaseConfig\);\s*const db = getFirestore\(app\);/;

// New initialization pattern
const newInitPattern = `// Initialize Firebase securely
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
}`;

function updateFile(filePath) {
    try {
        console.log(`\n📝 Updating ${filePath}...`);
        
        let content = fs.readFileSync(filePath, 'utf8');
        let updated = false;
        
        // Replace Firebase imports
        if (content.includes('import { initializeApp }')) {
            content = content.replace(
                /import \{ initializeApp \} from "https:\/\/www\.gstatic\.com\/firebasejs\/10\.8\.0\/firebase-app\.js";\s*import \{[\s\S]*?\} from "https:\/\/www\.gstatic\.com\/firebasejs\/10\.8\.0\/firebase-firestore\.js";/,
                secureImport
            );
            updated = true;
        }
        
        // Replace Firebase config
        if (content.includes('AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo')) {
            content = content.replace(firebaseConfigPattern, '');
            updated = true;
        }
        
        // Replace Firebase initialization
        if (content.includes('const app = initializeApp(firebaseConfig)')) {
            content = content.replace(oldInitPattern, newInitPattern);
            updated = true;
        }
        
        // Add initialization call to DOMContentLoaded if it exists
        if (content.includes('DOMContentLoaded') && !content.includes('initializeFirebaseApp()')) {
            content = content.replace(
                /document\.addEventListener\('DOMContentLoaded', \(\) => \{/,
                `document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase first
    await initializeFirebaseApp();`
            );
            updated = true;
        }
        
        if (updated) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Successfully updated ${filePath}`);
        } else {
            console.log(`⚠️  No changes needed for ${filePath}`);
        }
        
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
    }
}

function main() {
    console.log('🔒 Firebase Configuration Security Update Script');
    console.log('================================================');
    
    // Check if files exist
    const existingFiles = filesToUpdate.filter(file => fs.existsSync(file));
    
    if (existingFiles.length === 0) {
        console.log('❌ No files found to update');
        return;
    }
    
    console.log(`\n📁 Found ${existingFiles.length} files to update:`);
    existingFiles.forEach(file => console.log(`   - ${file}`));
    
    console.log('\n🚀 Starting updates...');
    
    existingFiles.forEach(updateFile);
    
    console.log('\n✅ Update complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Review the updated files');
    console.log('2. Test the application');
    console.log('3. Deploy with the new secure configuration');
    console.log('4. Don\'t forget to revoke the old API key!');
}

if (require.main === module) {
    main();
}

module.exports = { updateFile };
