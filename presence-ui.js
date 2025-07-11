// Presence UI Component for CoreTrex Dashboard
// This module handles the UI for presence notifications and edit lock status

import { presenceManager } from './presence.js';

class PresenceUI {
    constructor() {
        this.notificationContainer = null;
        this.presenceBanner = null;
        this.lockModal = null;
        this.isInitialized = false;
        
        // Immediately block all interactions until we're ready
        this.blockAllInteractions();
    }

    // Initialize the presence UI
    async initialize() {
        if (this.isInitialized) return;

        console.log('PresenceUI: Starting initialization...');

        // Create UI elements first
        this.createNotificationContainer();
        this.createPresenceBanner();
        this.createLockModal();

        // Set up event listeners immediately
        this.setupEventListeners();

        // Disable editing immediately to prevent any interactions
        this.disableAllEditing();

        // Wait for presence manager to initialize
        await presenceManager.initialize();

        // Register callbacks
        presenceManager.onPresenceUpdate((users) => {
            this.updatePresenceBanner(users);
        });

        presenceManager.onLockUpdate((lock) => {
            this.updateLockStatus(lock);
        });

        this.isInitialized = true;
        
        // Remove blocking overlay now that system is ready
        this.removeBlockingOverlay();
        
        // Remove HTML-based immediate blocking overlay
        const immediateOverlay = document.getElementById('immediate-blocking-overlay');
        const immediateMessage = document.getElementById('immediate-loading-message');
        if (immediateOverlay) immediateOverlay.remove();
        if (immediateMessage) immediateMessage.remove();
        
        console.log('PresenceUI: Initialized successfully');
    }

    // Create the main notification container
    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'presence-notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    // Create presence banner
    createPresenceBanner() {
        this.presenceBanner = document.createElement('div');
        this.presenceBanner.id = 'presence-banner';
        this.presenceBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(35, 39, 47, 0.95);
            color: white;
            padding: 8px 16px;
            font-size: 0.9rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: none;
            pointer-events: auto;
            backdrop-filter: blur(10px);
            z-index: 10003;
        `;
        this.notificationContainer.appendChild(this.presenceBanner);
        
        // Add global edit access button
        this.createGlobalEditButton();
    }

    // Create lock modal
    createLockModal() {
        this.lockModal = document.createElement('div');
        this.lockModal.id = 'lock-modal';
        this.lockModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            pointer-events: auto;
        `;

        this.lockModal.innerHTML = `
            <div style="
                background: #23272f;
                color: white;
                padding: 24px;
                border-radius: 12px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            ">
                <div style="margin-bottom: 16px;">
                    <i class="fas fa-lock" style="font-size: 2rem; color: #f39c12; margin-bottom: 12px;"></i>
                    <h3 style="margin: 0 0 8px 0; font-size: 1.2rem;">Edit Lock Active</h3>
                    <p id="lock-message" style="margin: 0; color: #b0b8c1; line-height: 1.4;">
                        This dashboard is currently being edited by another user.
                    </p>
                </div>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="take-over-lock-btn" onclick="console.log('Take Over clicked via onclick'); presenceUI && presenceUI.handleTakeOver()" style="
                        background: #2ecc71;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                    ">
                        <i class="fas fa-unlock"></i> Take Over
                    </button>
                    <button id="cancel-lock-btn" onclick="console.log('Cancel clicked via onclick'); presenceUI && presenceUI.hideLockModal()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                    ">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.lockModal);
    }

    // Set up modal-specific event listeners
    setupModalEventListeners() {
        console.log('PresenceUI: Setting up modal event listeners...');
        
        // Take over lock button
        const takeOverBtn = document.getElementById('take-over-lock-btn');
        console.log('PresenceUI: Looking for take-over button, found:', takeOverBtn);
        if (takeOverBtn) {
            console.log('PresenceUI: Found take-over button, adding event listener');
            // Remove any existing event listeners first
            takeOverBtn.replaceWith(takeOverBtn.cloneNode(true));
            const newTakeOverBtn = document.getElementById('take-over-lock-btn');
            console.log('PresenceUI: New take-over button after cloning:', newTakeOverBtn);
            
            newTakeOverBtn.addEventListener('click', async (e) => {
                console.log('PresenceUI: Take-over button clicked - event received!');
                console.log('PresenceUI: Event target:', e.target);
                console.log('PresenceUI: Event type:', e.type);
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    console.log('PresenceUI: Calling forceTakeOverLock...');
                    console.log('PresenceUI: presenceManager available:', !!presenceManager);
                    console.log('PresenceUI: forceTakeOverLock method available:', !!presenceManager.forceTakeOverLock);
                    const result = await presenceManager.forceTakeOverLock();
                    console.log('PresenceUI: forceTakeOverLock result:', result);
                    
                    if (result && result.success) {
                        this.hideLockModal();
                        this.showNotification('Edit access acquired!', 'success');
                    } else {
                        this.showNotification('Failed to take over edit access', 'error');
                    }
                } catch (error) {
                    console.error('PresenceUI: Error in take-over button click handler:', error);
                    this.showNotification('Error taking over edit access', 'error');
                }
            });
        } else {
            console.warn('PresenceUI: Take-over button not found');
        }

        // Cancel lock button
        const cancelBtn = document.getElementById('cancel-lock-btn');
        if (cancelBtn) {
            console.log('PresenceUI: Found cancel button, adding event listener');
            // Remove any existing event listeners first
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            const newCancelBtn = document.getElementById('cancel-lock-btn');
            
            newCancelBtn.addEventListener('click', (e) => {
                console.log('PresenceUI: Cancel button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.hideLockModal();
            });
            
            // Also add a mousedown listener as backup
            newCancelBtn.addEventListener('mousedown', (e) => {
                console.log('PresenceUI: Cancel button mousedown');
                e.preventDefault();
                e.stopPropagation();
                this.hideLockModal();
            });
        } else {
            console.warn('PresenceUI: Cancel button not found');
        }
    }

    // Set up event listeners
    setupEventListeners() {
        console.log('PresenceUI: Setting up event listeners...');
        
        // Set up modal event listeners
        this.setupModalEventListeners();

        // Close modal when clicking outside
        this.lockModal.addEventListener('click', (e) => {
            if (e.target === this.lockModal) {
                console.log('PresenceUI: Modal background clicked, hiding modal');
                this.hideLockModal();
            }
        });
        
        // Global click handler to prevent interactions when editing is disabled
        document.addEventListener('click', (event) => {
            if (!this.hasEditAccess()) {
                const target = event.target;
                
                // Check if the clicked element is an edit-related element
                if (target.matches('.edit-kpi-btn, .edit-comment-btn, .edit-sprints-btn, .edit-btn, .action-btn, .action-btn-small, .add-btn, .save-btn, .delete-btn, .delete-ids-btn, .delete-sprint-row-btn, .move-sprint-row-btn, .complete-btn') ||
                    target.closest('.edit-kpi-btn, .edit-comment-btn, .edit-sprints-btn, .edit-btn, .action-btn, .action-btn-small, .add-btn, .save-btn, .delete-btn, .delete-ids-btn, .delete-sprint-row-btn, .move-sprint-row-btn, .complete-btn')) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showNotification('Edit access is required. Please request edit access first.', 'warning');
                    return false;
                }
                
                // Check if clicking on a form input
                if (target.matches('input, select, textarea') && !target.classList.contains('presence-system-input')) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showNotification('Edit access is required. Please request edit access first.', 'warning');
                    return false;
                }
                
                // Check if clicking on contenteditable elements
                if (target.matches('[contenteditable]')) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showNotification('Edit access is required. Please request edit access first.', 'warning');
                    return false;
                }
            }
        }, true);
    }

    // Update presence banner
    updatePresenceBanner(users) {
        const activeUsers = users.filter(user => user.isActive);
        
        if (activeUsers.length === 0) {
            this.presenceBanner.style.display = 'none';
            document.body.classList.remove('presence-banner-visible');
            this.moveEditButtonFromBanner();
            // Also hide the edit button in the banner if present
            const bannerEditBtnContainer = document.getElementById('banner-edit-button-container');
            if (bannerEditBtnContainer) {
                bannerEditBtnContainer.innerHTML = '';
            }
            return;
        }

        const userNames = activeUsers.map(user => user.name).join(', ');
        const pageNames = [...new Set(activeUsers.map(user => user.page))];
        
        let pageText = '';
        if (pageNames.length === 1) {
            pageText = ` on ${this.getPageDisplayName(pageNames[0])}`;
        } else {
            pageText = ' across the dashboard';
        }

        this.presenceBanner.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-users" style="margin-right: 8px; color: #2979ff;"></i>
                    <strong>${activeUsers.length}</strong>&nbsp;other user${activeUsers.length > 1 ? 's' : ''} online${pageText}: ${userNames}
                </div>
                <div id="banner-edit-button-container"></div>
            </div>
        `;
        this.presenceBanner.style.display = 'block';
        document.body.classList.add('presence-banner-visible');
        
        // Move the global edit button into the banner
        this.moveEditButtonToBanner();
    }

    // Update lock status
    updateLockStatus(lock) {
        if (!lock) {
            // No lock, hide any lock-related UI and enable editing
            this.hideLockModal();
            this.enableAllEditing();
            return;
        }

        if (lock.lockedBy === presenceManager.userName) {
            // We have the lock, show success notification and enable editing
            this.showNotification('You have edit access', 'success');
            this.enableAllEditing();
        } else {
            // Someone else has the lock, disable editing
            this.disableAllEditing();
            const lockMessage = document.getElementById('lock-message');
            if (lockMessage) {
                lockMessage.textContent = `This dashboard is currently being edited by ${lock.lockedBy}. You can take over if needed.`;
            }
            this.showLockModal();
        }
    }

    // Show lock modal
    showLockModal() {
        console.log('PresenceUI: Showing lock modal');
        this.lockModal.style.display = 'flex';
        // Re-setup event listeners for the modal buttons
        this.setupModalEventListeners();
    }

    // Handle take over button click (for onclick handler)
    async handleTakeOver() {
        console.log('PresenceUI: handleTakeOver called');
        try {
            console.log('PresenceUI: Calling forceTakeOverLock...');
            console.log('PresenceUI: presenceManager available:', !!presenceManager);
            console.log('PresenceUI: forceTakeOverLock method available:', !!presenceManager.forceTakeOverLock);
            const result = await presenceManager.forceTakeOverLock();
            console.log('PresenceUI: forceTakeOverLock result:', result);
            
            if (result && result.success) {
                this.hideLockModal();
                this.showNotification('Edit access acquired!', 'success');
            } else {
                this.showNotification('Failed to take over edit access', 'error');
            }
        } catch (error) {
            console.error('PresenceUI: Error in handleTakeOver:', error);
            this.showNotification('Error taking over edit access', 'error');
        }
    }

    // Hide lock modal
    hideLockModal() {
        console.log('PresenceUI: Hiding lock modal');
        this.lockModal.style.display = 'none';
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? '#2ecc71' : 
                       type === 'error' ? '#e74c3c' : 
                       type === 'warning' ? '#f39c12' : '#3498db';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            font-weight: 500;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Create global edit access button
    createGlobalEditButton() {
        this.globalEditButton = document.createElement('div');
        this.globalEditButton.id = 'global-edit-button';
        this.globalEditButton.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10002;
            pointer-events: auto;
        `;
        
        this.updateGlobalEditButton();
        document.body.appendChild(this.globalEditButton);
    }
    
    // Move edit button into the banner
    moveEditButtonToBanner() {
        const bannerContainer = document.getElementById('banner-edit-button-container');
        if (bannerContainer && this.globalEditButton) {
            // Clone the button content and move it to the banner
            const buttonContent = this.globalEditButton.innerHTML;
            bannerContainer.innerHTML = buttonContent;
            
            // Hide the original button
            this.globalEditButton.style.display = 'none';
        }
    }
    
    // Move edit button back to original position
    moveEditButtonFromBanner() {
        if (this.globalEditButton) {
            // Hide the original button if the banner is hidden (no users)
            this.globalEditButton.style.display = 'none';
        }
    }
    
    // Update global edit button based on current state
    updateGlobalEditButton() {
        if (!this.globalEditButton) return;
        
        const hasAccess = this.hasEditAccess();
        const currentLock = presenceManager.getCurrentLock();
        
        if (hasAccess) {
            this.globalEditButton.innerHTML = `
                <div style="
                    background: #2ecc71;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    box-shadow: 0 2px 8px rgba(46, 204, 113, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-check"></i>
                    Edit Access Active
                </div>
            `;
        } else if (currentLock) {
            this.globalEditButton.innerHTML = `
                <button onclick="presenceUI.requestEditAccess()" style="
                    background: #f39c12;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(243, 156, 18, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-lock"></i>
                    Request Edit Access
                </button>
            `;
        } else {
            this.globalEditButton.innerHTML = `
                <button onclick="presenceUI.requestEditAccess()" style="
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(52, 152, 219, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-edit"></i>
                    Get Edit Access
                </button>
            `;
        }
        
        // If banner is visible, also update the button in the banner
        if (this.presenceBanner && this.presenceBanner.style.display !== 'none') {
            this.moveEditButtonToBanner();
        }
    }
    
    // Disable all editing functionality
    disableAllEditing() {
        console.log('PresenceUI: Disabling all editing functionality...');
        
        // Disable all edit buttons
        document.querySelectorAll('.edit-kpi-btn, .edit-comment-btn, .edit-sprints-btn, .edit-btn, .action-btn, .action-btn-small, .add-btn, .save-btn, .delete-btn, .delete-ids-btn, .delete-sprint-row-btn, .move-sprint-row-btn, .complete-btn').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
            btn.setAttribute('data-presence-disabled', 'true');
        });
        
        // Disable all form inputs
        document.querySelectorAll('input, select, textarea').forEach(input => {
            if (!input.classList.contains('presence-system-input')) {
                input.disabled = true;
                input.style.opacity = '0.5';
                input.setAttribute('data-presence-disabled', 'true');
            }
        });
        
        // Disable all contenteditable elements
        document.querySelectorAll('[contenteditable]').forEach(el => {
            el.contentEditable = 'false';
            el.style.opacity = '0.5';
            el.setAttribute('data-presence-disabled', 'true');
        });
        
        // Disable form submissions
        document.querySelectorAll('form').forEach(form => {
            form.setAttribute('data-presence-disabled', 'true');
            form.addEventListener('submit', this.preventSubmission, true);
        });
        
        // Add visual indicator
        this.addEditingDisabledOverlay();
        
        // Update global edit button
        this.updateGlobalEditButton();
        
        console.log('PresenceUI: All editing functionality disabled');
    }
    
    // Prevent form submission when editing is disabled
    preventSubmission(event) {
        event.preventDefault();
        event.stopPropagation();
        alert('Edit access is required to make changes. Please request edit access first.');
        return false;
    }
    
    // Enable all editing functionality
    enableAllEditing() {
        console.log('PresenceUI: Enabling all editing functionality...');
        
        // Enable all edit buttons
        document.querySelectorAll('.edit-kpi-btn, .edit-comment-btn, .edit-sprints-btn, .edit-btn, .action-btn, .action-btn-small, .add-btn, .save-btn, .delete-btn, .delete-ids-btn, .delete-sprint-row-btn, .move-sprint-row-btn, .complete-btn').forEach(btn => {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.disabled = false;
            btn.removeAttribute('data-presence-disabled');
        });
        
        // Enable all form inputs
        document.querySelectorAll('input, select, textarea').forEach(input => {
            if (!input.classList.contains('presence-system-input')) {
                input.disabled = false;
                input.style.opacity = '1';
                input.removeAttribute('data-presence-disabled');
            }
        });
        
        // Enable all contenteditable elements
        document.querySelectorAll('[contenteditable]').forEach(el => {
            el.contentEditable = 'true';
            el.style.opacity = '1';
            el.removeAttribute('data-presence-disabled');
        });
        
        // Enable form submissions
        document.querySelectorAll('form').forEach(form => {
            form.removeAttribute('data-presence-disabled');
            form.removeEventListener('submit', this.preventSubmission, true);
        });
        
        // Remove visual indicator
        this.removeEditingDisabledOverlay();
        
        // Update global edit button
        this.updateGlobalEditButton();
        
        console.log('PresenceUI: All editing functionality enabled');
    }
    
    // Add visual overlay to indicate editing is disabled
    addEditingDisabledOverlay() {
        if (document.getElementById('editing-disabled-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'editing-disabled-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.05);
            pointer-events: auto;
            z-index: 9998;
            cursor: not-allowed;
        `;
        
        // Add click handler to show message
        overlay.addEventListener('click', (e) => {
            // Don't block clicks on the global edit button or presence system elements
            if (e.target.closest('#global-edit-button') || 
                e.target.closest('#presence-banner') || 
                e.target.closest('#lock-modal')) {
                return;
            }
            
            this.showNotification('Edit access is required. Please request edit access first.', 'warning');
        });
        
        document.body.appendChild(overlay);
    }
    
    // Block all interactions until presence system is ready
    blockAllInteractions() {
        // Add a blocking overlay immediately
        const blockingOverlay = document.createElement('div');
        blockingOverlay.id = 'blocking-overlay';
        blockingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.02);
            pointer-events: auto;
            z-index: 9999;
            cursor: wait;
        `;
        
        // Add loading message
        const loadingMessage = document.createElement('div');
        loadingMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
        `;
        loadingMessage.textContent = 'Initializing edit lock system...';
        
        document.body.appendChild(blockingOverlay);
        document.body.appendChild(loadingMessage);
        
        // Store references for later removal
        this.blockingOverlay = blockingOverlay;
        this.loadingMessage = loadingMessage;
    }
    
    // Remove blocking overlay when system is ready
    removeBlockingOverlay() {
        if (this.blockingOverlay) {
            this.blockingOverlay.remove();
            this.blockingOverlay = null;
        }
        if (this.loadingMessage) {
            this.loadingMessage.remove();
            this.loadingMessage = null;
        }
    }
    
    // Remove visual overlay
    removeEditingDisabledOverlay() {
        const overlay = document.getElementById('editing-disabled-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    // Get page display name
    getPageDisplayName(page) {
        const pageNames = {
            'goals.html': 'KPIs & Goals',
            'kpis.html': 'Call Metrics',
            'prospects.html': 'Prospects',
            'clients.html': 'Clients',
            'admin.html': 'Admin Panel',
            'index.html': 'Login'
        };
        return pageNames[page] || page;
    }

    // Request edit access (called when user tries to edit)
    async requestEditAccess() {
        const result = await presenceManager.requestEditLock();
        
        if (result.success) {
            this.showNotification(result.message, 'success');
            this.enableAllEditing();
            return true;
        } else {
            // Show lock modal with the message
            const lockMessage = document.getElementById('lock-message');
            if (lockMessage) {
                lockMessage.textContent = result.message;
            }
            this.showLockModal();
            return false;
        }
    }

    // Check if user has edit access
    hasEditAccess() {
        return presenceManager.hasEditLock();
    }

    // Cleanup
    cleanup() {
        if (this.notificationContainer && this.notificationContainer.parentNode) {
            this.notificationContainer.parentNode.removeChild(this.notificationContainer);
        }
        if (this.lockModal && this.lockModal.parentNode) {
            this.lockModal.parentNode.removeChild(this.lockModal);
        }
    }
}

// Create global instance
const presenceUI = new PresenceUI();

// Make requestEditAccess globally accessible
window.presenceUI = presenceUI;

// Initialize immediately to prevent any interactions
presenceUI.initialize().catch(error => {
    console.error('Failed to initialize presence system immediately:', error);
});

// Export for use in other modules
export { presenceUI }; 