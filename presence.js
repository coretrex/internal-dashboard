// Presence Management System for CoreTrex Dashboard
// This module handles user presence tracking and edit locks across all pages

import { initializeFirebase } from './firebase-config.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    deleteDoc, 
    getDoc,
    onSnapshot,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global variables for Firebase app and db
let app, db;

// Initialize Firebase with secure config
async function initializeFirebaseApp() {
    const firebaseInstance = await initializeFirebase();
    app = firebaseInstance.app;
    db = firebaseInstance.db;
}

class PresenceManager {
    constructor() {
        this.userId = null;
        this.userName = null;
        this.currentPage = null;
        this.presenceInterval = null;
        this.presenceListener = null;
        this.lockListener = null;
        this.otherUsers = new Map();
        this.currentLock = null;
        this.isInitialized = false;
        this.callbacks = {
            onPresenceUpdate: null,
            onLockUpdate: null,
            onLockRequest: null
        };
    }

    // Initialize the presence manager
    async initialize() {
        if (this.isInitialized) return;

        // Initialize Firebase first
        await initializeFirebaseApp();

        // Get user info from localStorage
        this.userId = localStorage.getItem('userId') || this.generateUserId();
        this.userName = localStorage.getItem('userName') || 'Unknown User';
        this.currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Store userId if not already stored
        if (!localStorage.getItem('userId')) {
            localStorage.setItem('userId', this.userId);
        }

        console.log('PresenceManager: Initializing for user:', this.userName, 'on page:', this.currentPage);

        // Set up presence tracking
        await this.setupPresence();
        
        // Set up edit lock tracking
        await this.setupEditLock();
        
        // Set up page unload handlers
        this.setupUnloadHandlers();

        this.isInitialized = true;
        console.log('PresenceManager: Initialized successfully');
    }

    // Generate a unique user ID if none exists
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Set up presence tracking
    async setupPresence() {
        // Register initial presence
        await this.updatePresence();

        // Set up heartbeat (update presence every 20 seconds)
        this.presenceInterval = setInterval(() => {
            this.updatePresence();
        }, 20000);

        // Listen for other users' presence
        this.presenceListener = onSnapshot(collection(db, "dashboardPresence"), (snapshot) => {
            const users = new Map();
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (doc.id !== this.userId) { // Don't include self
                    users.set(doc.id, {
                        id: doc.id,
                        name: data.name,
                        page: data.page,
                        lastActive: data.lastActive?.toDate(),
                        isActive: this.isUserActive(data.lastActive?.toDate())
                    });
                }
            });

            this.otherUsers = users;
            
            // Call callback if registered
            if (this.callbacks.onPresenceUpdate) {
                this.callbacks.onPresenceUpdate(Array.from(users.values()));
            }
        });
    }

    // Set up edit lock tracking
    async setupEditLock() {
        this.lockListener = onSnapshot(doc(db, "dashboardEditLock", "lock"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                this.currentLock = {
                    lockedBy: data.lockedBy,
                    lockedAt: data.lockedAt?.toDate(),
                    page: data.page
                };
            } else {
                this.currentLock = null;
            }

            // Call callback if registered
            if (this.callbacks.onLockUpdate) {
                this.callbacks.onLockUpdate(this.currentLock);
            }
        });
    }

    // Update user presence
    async updatePresence() {
        try {
            await setDoc(doc(db, "dashboardPresence", this.userId), {
                name: this.userName,
                page: this.currentPage,
                lastActive: serverTimestamp()
            });
        } catch (error) {
            console.error('PresenceManager: Error updating presence:', error);
        }
    }

    // Check if user is active (within last 2 minutes)
    isUserActive(lastActive) {
        if (!lastActive) return false;
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        return lastActive > twoMinutesAgo;
    }

    // Request edit lock
    async requestEditLock() {
        try {
            const lockDoc = await getDoc(doc(db, "dashboardEditLock", "lock"));
            
            if (!lockDoc.exists()) {
                // No lock exists, we can take it
                await this.acquireEditLock();
                return { success: true, message: 'Edit lock acquired' };
            }

            const lockData = lockDoc.data();
            const lockTime = lockData.lockedAt?.toDate();
            const isStale = lockTime && (Date.now() - lockTime.getTime()) > 2 * 60 * 1000; // 2 minutes

            if (lockData.lockedBy === this.userId) {
                // We already have the lock
                return { success: true, message: 'You already have edit access' };
            }

            if (isStale) {
                // Lock is stale, we can take it
                await this.acquireEditLock();
                return { success: true, message: 'Edit lock acquired (previous lock was stale)' };
            }

            // Lock is held by someone else and not stale
            return { 
                success: false, 
                message: `Currently being edited by ${lockData.lockedBy}`,
                lockedBy: lockData.lockedBy
            };
        } catch (error) {
            console.error('PresenceManager: Error requesting edit lock:', error);
            return { success: false, message: 'Error requesting edit lock' };
        }
    }

    // Acquire edit lock
    async acquireEditLock() {
        try {
            await setDoc(doc(db, "dashboardEditLock", "lock"), {
                lockedBy: this.userName,
                lockedAt: serverTimestamp(),
                page: this.currentPage
            });
            console.log('PresenceManager: Edit lock acquired');
        } catch (error) {
            console.error('PresenceManager: Error acquiring edit lock:', error);
        }
    }

    // Release edit lock
    async releaseEditLock() {
        try {
            await deleteDoc(doc(db, "dashboardEditLock", "lock"));
            console.log('PresenceManager: Edit lock released');
        } catch (error) {
            console.error('PresenceManager: Error releasing edit lock:', error);
        }
    }

    // Force take over edit lock
    async forceTakeOverLock() {
        try {
            await this.acquireEditLock();
            return { success: true, message: 'Edit lock taken over successfully' };
        } catch (error) {
            console.error('PresenceManager: Error taking over lock:', error);
            return { success: false, message: 'Error taking over edit lock' };
        }
    }

    // Set up page unload handlers
    setupUnloadHandlers() {
        // Handle page unload
        window.addEventListener('beforeunload', async (event) => {
            // Release edit lock if we have it
            if (this.currentLock && this.currentLock.lockedBy === this.userName) {
                await this.releaseEditLock();
            }
            
            // Remove presence
            try {
                await deleteDoc(doc(db, "dashboardPresence", this.userId));
            } catch (error) {
                console.error('PresenceManager: Error removing presence on unload:', error);
            }
        });

        // Handle page visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, update presence less frequently
                if (this.presenceInterval) {
                    clearInterval(this.presenceInterval);
                    this.presenceInterval = setInterval(() => {
                        this.updatePresence();
                    }, 60000); // Update every minute when hidden
                }
            } else {
                // Page is visible again, update presence immediately and resume normal interval
                this.updatePresence();
                if (this.presenceInterval) {
                    clearInterval(this.presenceInterval);
                    this.presenceInterval = setInterval(() => {
                        this.updatePresence();
                    }, 20000); // Resume 20-second interval
                }
            }
        });
    }

    // Register callbacks
    onPresenceUpdate(callback) {
        this.callbacks.onPresenceUpdate = callback;
    }

    onLockUpdate(callback) {
        this.callbacks.onLockUpdate = callback;
    }

    onLockRequest(callback) {
        this.callbacks.onLockRequest = callback;
    }

    // Get current presence data
    getOtherUsers() {
        return Array.from(this.otherUsers.values());
    }

    getCurrentLock() {
        return this.currentLock;
    }

    // Check if current user has edit lock
    hasEditLock() {
        return this.currentLock && this.currentLock.lockedBy === this.userName;
    }

    // Cleanup
    cleanup() {
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
        }
        if (this.presenceListener) {
            this.presenceListener();
        }
        if (this.lockListener) {
            this.lockListener();
        }
    }
}

// Create global instance
const presenceManager = new PresenceManager();

// Export for use in other modules
export { presenceManager }; 