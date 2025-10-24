// TEST SCRIPT LOADING
// GOALS.JS IS LOADING

// Import Firebase modules
import { initializeFirebase } from './firebase-config.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('=== GOALS.JS LOADING ===');
console.log('Firebase imports loaded');

// Global variables for Firebase app and db
let app, db;

// Initialize Firebase with secure config
async function initializeFirebaseApp() {
    const firebaseInstance = await initializeFirebase();
    app = firebaseInstance.app;
    db = firebaseInstance.db;
    console.log('Firebase initialized with secure config');
}

console.log('Firebase config loaded');

    // Global flags
    let isIdsLoading = false;
    let saveIdsTimeout = null;
    let isSavingKpiTracker = false;
    let isSavingSprints = false;
    let isSavingTodos = false;

    // Real-time update listeners
    let sprintsListener = null;
    let todosListener = null;
    let idsListener = null;

    // Multi-cell selection variables
    let isSelecting = false;
    let selectedCells = [];
    let startCell = null;

// Page guard: check login and access
function hasPageAccess(pageId) {
    console.log('=== CHECKING PAGE ACCESS ===');
    console.log('Requested page:', pageId);
    
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    console.log('Is logged in:', isLoggedIn);
    
    const userRole = localStorage.getItem('userRole');
    console.log('User role:', userRole);
    
    let pageAccess = [];
    try {
        pageAccess = JSON.parse(localStorage.getItem('userPageAccess')) || [];
        console.log('User page access:', pageAccess);
    } catch (e) {
        console.error('Error parsing page access:', e);
        pageAccess = [];
    }
    
    const hasAccess = isLoggedIn && (userRole === 'admin' || pageAccess.includes(pageId));
    console.log('Has access:', hasAccess);
    console.log('Access granted:', hasAccess);
    
    return hasAccess;
}

// Goals page functionality
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== DOM CONTENT LOADED ===');
    console.log('Page: goals.html');
    console.log('DOM fully loaded and parsed');
    
    // Initialize Firebase first
    await initializeFirebaseApp();
    
    // PAGE GUARD - TEMPORARILY DISABLED FOR TESTING
    console.log('Checking page access...');
    // Debug: Log all relevant localStorage values
    console.log('DEBUG: localStorage.isLoggedIn =', localStorage.getItem('isLoggedIn'));
    console.log('DEBUG: localStorage.userRole =', localStorage.getItem('userRole'));
    console.log('DEBUG: localStorage.userPageAccess =', localStorage.getItem('userPageAccess'));
    
    // TEMPORARILY DISABLE PAGE ACCESS CHECK FOR TESTING
    console.log('Page access check temporarily disabled for testing');
    
    // Check authentication using the correct localStorage key
    console.log('Checking authentication...');
    if (!localStorage.getItem('isLoggedIn')) {
        console.log('Not logged in - but continuing for testing');
        // TEMPORARILY DISABLE REDIRECT FOR TESTING
        // window.location.href = 'index.html';
        // return;
    }
    console.log('Authentication check completed');

    // Add navigation component
    console.log('Adding navigation component...');
    const navElement = document.createElement('nav-menu');
    document.body.appendChild(navElement);
    console.log('Navigation component added');

    // --- MRR (Revenue) Thermometer Sync with Revenue KPI ---
    const mrrDefaults = 94000;
    const mrrValueKey = 'mrrValue';
    const mrrValueSpan = document.getElementById('mrrValue');
    const mrrValueContainer = document.getElementById('mrrValueContainer');
    const revenueValueEl = document.getElementById('revenueValue');
    function parseRevenue(val) {
        // Remove $ and commas, handle K
        if (typeof val !== 'string') return parseInt(val, 10) || mrrDefaults;
        let v = val.replace(/[$,\s]/g, '');
        if (v.toUpperCase().endsWith('K')) {
            v = v.slice(0, -1);
            return Math.round(parseFloat(v) * 1000);
        }
        return parseInt(v, 10) || mrrDefaults;
    }
    function formatMRR(val) {
        if (isNaN(val)) return val;
        if (val >= 1000) return `$${(val/1000).toFixed(0)}K`;
        return `$${val}`;
    }
    function getMRR() {
        // Always get from Revenue KPI
        return parseRevenue(revenueValueEl ? revenueValueEl.textContent : mrrDefaults);
    }
    // Update thermometer to accept value
    const updateThermometer = () => {
        const startMRR = 120000;
        const targetMRR = 200000;
        const currentMRR = getMRR();
        const progress = ((currentMRR - startMRR) / (targetMRR - startMRR)) * 100;
        const thermometerProgress = document.querySelector('.thermometer-progress');
        if (thermometerProgress) {
            thermometerProgress.style.width = `${Math.max(0, progress)}%`;
        }
        if (mrrValueSpan) mrrValueSpan.textContent = formatMRR(currentMRR);
        // --- MILESTONE GLOW LOGIC ---
        const milestones = [
            { value: 120000, selector: '[data-milestone="120k"] .milestone-icon', color: '#2979ff' },
            { value: 150000, selector: '[data-milestone="150k"] .milestone-icon', color: '#2979ff' },
            { value: 160000, selector: '[data-milestone="160k"] .milestone-icon', color: '#f39c12' },
            { value: 170000, selector: '[data-milestone="170k"] .milestone-icon', color: '#2979ff' },
            { value: 200000, selector: '[data-milestone="200k"] .milestone-icon', color: '#2ecc71' }
        ];
        milestones.forEach((milestone, idx) => {
            const icon = document.querySelector(milestone.selector);
            if (!icon) return;
            // All milestones at or below the current revenue should be orange
            if (currentMRR >= milestone.value) {
                icon.classList.add('glow');
            } else {
                icon.classList.remove('glow');
            }
        });
    };
    // Listen for Revenue KPI edits
    if (revenueValueEl) {
        const observer = new MutationObserver(updateThermometer);
        observer.observe(revenueValueEl, { childList: true, characterData: true, subtree: true });
    }
    // Remove thermometer edit button if present
    const editMrrBtn = document.getElementById('editMrrBtn');
    if (editMrrBtn) editMrrBtn.style.display = 'none';
    // Initialize value
    updateThermometer();

    // Milestone details
    const milestoneDetails = {
        '120k': {
            title: '$120K MRR - Team Celebratory Event Out of Office',
            details: 'Team Celebration:\n• Off-site Event\n• Team Building Activities\n• Celebration Dinner'
        },
        '150k': {
            title: '$150K MRR - CHOP Barbell Membership',
            details: 'Team Fitness Benefit:\n• CHOP Barbell Gym Membership\n• Team Workout Sessions\n• Health & Wellness Focus'
        },
        '160k': {
            title: '$160K MRR - Updated HQ',
            details: 'Office Space Upgrade:\n• Modern Office Renovation\n• Enhanced Work Environment\n• Premium Amenities\n• Collaborative Spaces'
        },
        '170k': {
            title: '$170K MRR - Pod 4 Expansion',
            details: 'Strategic Pod Growth:\n• Launch Pod 4\n• New Team Members\n• Additional Client Capacity\n• Expanded Service Offerings'
        },
        '200k': {
            title: '$200K MRR - Elite Achievement Unlocked',
            details: '????'
        }
    };

    // Modal functionality
    const modal = document.getElementById('milestoneModal');
    const modalContent = document.getElementById('modalContent');
    const closeBtn = document.getElementsByClassName('close')[0];

    // Add click event to all milestone cards
    document.querySelectorAll('.milestone-card').forEach(card => {
        card.addEventListener('click', () => {
            const milestone = card.getAttribute('data-milestone');
            const details = milestoneDetails[milestone];
            
            modalContent.innerHTML = `
                <h2>${details.title}</h2>
                <div class="modal-details">${details.details.replace(/\n/g, '<br>')}</div>
            `;
            
            modal.style.display = 'block';
        });
    });

    // Close modal when clicking the X
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Initialize the page
    updateThermometer();

    // --- KPI BLOCKS INTERACTIVITY ---
    const kpiKeys = ['activeClients', 'revenue', 'clientsClosed'];
    
    // Firebase functions for KPI data
    async function saveKpiToFirebase(kpi, value) {
        try {
            console.log(`Saving KPI ${kpi}: ${value} to Firebase`);
            await setDoc(doc(db, "kpiData", kpi), { value: value }, { merge: true });
            console.log(`Successfully saved KPI ${kpi} to Firebase`);
        } catch (error) {
            console.error("Error saving KPI to Firebase:", error);
        }
    }
    
    async function saveGoalToFirebase(kpi, goal) {
        try {
            console.log(`Saving goal ${kpi}: ${goal} to Firebase`);
            await setDoc(doc(db, "kpiGoals", kpi), { goal: goal }, { merge: true });
            console.log(`Successfully saved goal ${kpi} to Firebase`);
        } catch (error) {
            console.error("Error saving goal to Firebase:", error);
        }
    }
    
    async function saveCommentToFirebase(kpi, comment) {
        try {
            console.log(`Saving comment for ${kpi}: ${comment} to Firebase`);
            await setDoc(doc(db, "kpiComments", kpi), { comment: comment }, { merge: true });
            console.log(`Successfully saved comment for ${kpi} to Firebase`);
        } catch (error) {
            console.error("Error saving comment to Firebase:", error);
        }
    }
    
    async function loadKpiFromFirebase(kpi) {
        try {
            console.log(`Loading KPI ${kpi} from Firebase`);
            const docRef = doc(db, "kpiData", kpi);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const value = docSnap.data().value;
                console.log(`Loaded KPI ${kpi}: ${value} from Firebase`);
                return value;
            }
            console.log(`No KPI data found for ${kpi} in Firebase`);
            return null;
        } catch (error) {
            console.error("Error loading KPI from Firebase:", error);
            return null;
        }
    }
    
    async function loadGoalFromFirebase(kpi) {
        try {
            console.log(`Loading goal ${kpi} from Firebase`);
            const docRef = doc(db, "kpiGoals", kpi);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const goal = docSnap.data().goal;
                console.log(`Loaded goal ${kpi}: ${goal} from Firebase`);
                return goal;
            }
            console.log(`No goal data found for ${kpi} in Firebase`);
            return null;
        } catch (error) {
            console.error("Error loading goal from Firebase:", error);
            return null;
        }
    }
    
    async function loadCommentFromFirebase(kpi) {
        try {
            console.log(`Loading comment for ${kpi} from Firebase`);
            const docRef = doc(db, "kpiComments", kpi);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const comment = docSnap.data().comment;
                console.log(`Loaded comment for ${kpi}: ${comment} from Firebase`);
                return comment;
            }
            console.log(`No comment data found for ${kpi} in Firebase`);
            return null;
        } catch (error) {
            console.error("Error loading comment from Firebase:", error);
            return null;
        }
    }
    
    // Load KPI values from Firebase only (no defaults)
    async function loadAllKpiData() {
        try {
            for (const key of kpiKeys) {
                // Load KPI value from Firebase only
                const val = await loadKpiFromFirebase(key);
                const el = document.getElementById(key.charAt(0).toLowerCase() + key.slice(1) + 'Value');
                if (el && val !== null) {
                    el.textContent = val;
                }
                
                // Load goal value from Firebase only
                const goalVal = await loadGoalFromFirebase(key);
                const goalEl = document.getElementById(key + 'Goal');
                if (goalEl && goalVal !== null) {
                    goalEl.textContent = `Goal: ${goalVal}`;
                    updateGoalStatus(key, val, goalVal);
                }
                
                // Load comment value from Firebase only
                const commentVal = await loadCommentFromFirebase(key);
                updateCommentButtonAppearance(key, commentVal !== null && commentVal.length > 0);
            }
            console.log('KPI data loaded from Firebase');
        } catch (error) {
            console.error('Error loading KPI data:', error);
        }
    }
    
    // Function to update goal status (reached, close, behind)
    function updateGoalStatus(kpi, currentVal, goalVal) {
        const goalEl = document.getElementById(kpi + 'Goal');
        if (!goalEl) return;
        
        // Parse values for comparison
        let current = parseFloat(currentVal.toString().replace(/[$,]/g, ''));
        let goal = parseFloat(goalVal.toString().replace(/[$,]/g, ''));
        
        // Remove existing status classes
        goalEl.classList.remove('goal-reached', 'goal-close', 'goal-behind');
        
        // Determine status
        if (current >= goal) {
            goalEl.classList.add('goal-reached');
        } else if (current >= goal * 0.8) {
            goalEl.classList.add('goal-close');
        } else {
            goalEl.classList.add('goal-behind');
        }
    }
    
    // Function to update comment button appearance
    function updateCommentButtonAppearance(kpi, hasComment) {
        const commentBtn = document.querySelector(`[data-kpi="${kpi}"].edit-comment-btn`);
        if (commentBtn) {
            if (hasComment) {
                commentBtn.style.color = '#9b59b6';
                commentBtn.style.opacity = '0.6';
            } else {
                commentBtn.style.color = '#b0b8c1';
                commentBtn.style.opacity = '0.12';
            }
        }
    }
    
    // Edit button logic for KPI values
    document.querySelectorAll('.edit-kpi-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const kpi = btn.getAttribute('data-kpi');
            const valueEl = document.getElementById(kpi + 'Value');
            if (!valueEl) return;
            // Prevent multiple inputs
            if (valueEl.querySelector('input')) return;
            const currentValue = valueEl.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue;
            input.className = 'kpi-edit-input';
            valueEl.textContent = '';
            valueEl.appendChild(input);
            input.focus();
            // Real-time update for Revenue KPI (directly update thermometer from input value)
            if (kpi === 'revenue') {
                input.addEventListener('input', () => {
                    // Directly update thermometer using input value
                    const tempValue = input.value.trim();
                    const startMRR = 75000;
                    const targetMRR = 120000;
                    let currentMRR = parseRevenue(tempValue);
                    const progress = ((currentMRR - startMRR) / (targetMRR - startMRR)) * 100;
                    const thermometerProgress = document.querySelector('.thermometer-progress');
                    if (thermometerProgress) {
                        thermometerProgress.style.width = `${progress}%`;
                    }
                    if (mrrValueSpan) mrrValueSpan.textContent = formatMRR(currentMRR);
                });
            }
            // Save on blur or Enter
            async function saveKpiEdit() {
                let newValue = input.value.trim();
                if (newValue === '') {
                    // Don't save empty values, just restore the current value
                    valueEl.textContent = currentValue;
                    if (kpi === 'revenue') {
                        revenueValueEl.textContent = currentValue;
                        updateThermometer();
                        updateRevenueGoalSlider();
                    } else if (kpi === 'activeClients') {
                        updateClientGoalSlider();
                    } else if (kpi === 'clientsClosed') {
                        updateNewClientsGoalSlider();
                    }
                    return;
                }
                valueEl.textContent = newValue;
                await saveKpiToFirebase(kpi, newValue);
                if (kpi === 'revenue') {
                    revenueValueEl.textContent = newValue;
                    updateThermometer();
                    updateRevenueGoalSlider();
                } else if (kpi === 'activeClients') {
                    updateClientGoalSlider();
                } else if (kpi === 'clientsClosed') {
                    updateNewClientsGoalSlider();
                }
                // Update goal status
                const goalVal = await loadGoalFromFirebase(kpi);
                if (goalVal !== null) {
                    updateGoalStatus(kpi, newValue, goalVal);
                }
            }
            input.addEventListener('blur', saveKpiEdit);
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    input.blur();
                } else if (evt.key === 'Escape') {
                    valueEl.textContent = currentValue;
                    if (kpi === 'revenue') {
                        revenueValueEl.textContent = currentValue;
                        updateThermometer();
                        updateRevenueGoalSlider();
                    } else if (kpi === 'activeClients') {
                        updateClientGoalSlider();
                    } else if (kpi === 'clientsClosed') {
                        updateNewClientsGoalSlider();
                    }
                }
            });
        });
    });
    
    // Goal edit button logic
    document.querySelectorAll('.edit-goal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const kpi = btn.getAttribute('data-kpi');
            const goalEl = document.getElementById(kpi + 'Goal');
            if (!goalEl) return;
            // Prevent multiple inputs
            if (goalEl.querySelector('input')) return;
            
            // Extract current goal value
            const currentGoalText = goalEl.textContent;
            const currentGoal = currentGoalText.replace('Goal: ', '');
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentGoal;
            input.style.cssText = `
                font-size: 0.9rem;
                font-weight: 500;
                color: #222;
                background: #fff;
                border: 2px solid #f39c12;
                border-radius: 8px;
                padding: 4px 8px;
                width: 80px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(243,156,18,0.08);
            `;
            
            goalEl.textContent = '';
            goalEl.appendChild(input);
            input.focus();
            input.select();
            
            // Save on blur or Enter
            async function saveGoalEdit() {
                let newGoal = input.value.trim();
                if (newGoal === '') {
                    // Don't save empty values, just restore the current value
                    goalEl.textContent = currentGoalText;
                    return;
                }
                goalEl.textContent = `Goal: ${newGoal}`;
                await saveGoalToFirebase(kpi, newGoal);
                
                // Update goal status
                const currentVal = document.getElementById(kpi + 'Value')?.textContent;
                if (currentVal) {
                    updateGoalStatus(kpi, currentVal, newGoal);
                }
            }
            
            input.addEventListener('blur', saveGoalEdit);
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    input.blur();
                } else if (evt.key === 'Escape') {
                    goalEl.textContent = currentGoalText;
                }
            });
        });
    });

    // Comment edit button logic
    document.querySelectorAll('.edit-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const kpi = btn.getAttribute('data-kpi');
            
            // Get current comment value from Firebase
            const currentComment = await loadCommentFromFirebase(kpi) || '';
            
            // Update modal title
            const modalTitle = document.getElementById('commentModalTitle');
            const kpiLabels = {
                'activeClients': 'Active Clients',
                'revenue': 'Revenue',
                'clientsClosed': 'New Clients'
            };
            modalTitle.textContent = `${kpiLabels[kpi]} - Comment`;
            
            // Set display and textarea values
            const commentDisplay = document.getElementById('commentDisplay');
            const textarea = document.getElementById('commentTextarea');
            
            if (currentComment) {
                commentDisplay.textContent = currentComment;
                textarea.value = currentComment;
            } else {
                commentDisplay.textContent = '';
                textarea.value = '';
            }
            
            // Show modal
            const commentModal = document.getElementById('commentModal');
            commentModal.style.display = 'block';
            
            // Store current KPI for save function
            commentModal.setAttribute('data-current-kpi', kpi);
            
            // Reset to view mode
            setModalToViewMode();
        });
    });

    // Comment modal functionality
    const commentModal = document.getElementById('commentModal');
    const closeCommentModal = document.getElementById('closeCommentModal');
    const saveCommentBtn = document.getElementById('saveCommentBtn');
    const cancelCommentBtn = document.getElementById('cancelCommentBtn');
    const editCommentBtn = document.getElementById('editCommentBtn');
    const closeCommentBtn = document.getElementById('closeCommentBtn');
    const commentTextarea = document.getElementById('commentTextarea');
    const commentDisplay = document.getElementById('commentDisplay');

    // Modal mode functions
    function setModalToViewMode() {
        commentDisplay.style.display = 'block';
        commentTextarea.style.display = 'none';
        editCommentBtn.style.display = 'inline-block';
        saveCommentBtn.style.display = 'none';
        cancelCommentBtn.style.display = 'none';
        closeCommentBtn.style.display = 'inline-block';
        commentTextarea.setAttribute('readonly', true); // Ensure textarea is readonly in view mode
    }

    function setModalToEditMode() {
        commentDisplay.style.display = 'none';
        commentTextarea.style.display = 'block';
        editCommentBtn.style.display = 'none';
        saveCommentBtn.style.display = 'inline-block';
        cancelCommentBtn.style.display = 'inline-block';
        closeCommentBtn.style.display = 'none';
        commentTextarea.removeAttribute('readonly'); // Allow editing in edit mode
        // Focus and select textarea
        setTimeout(() => {
            commentTextarea.focus();
            commentTextarea.select();
        }, 100);
    }

    // Close modal functions
    function closeCommentModalFunc() {
        commentModal.style.display = 'none';
        commentTextarea.value = '';
        commentDisplay.textContent = '';
        setModalToViewMode();
    }

    // Close modal when clicking X
    closeCommentModal.onclick = closeCommentModalFunc;

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === commentModal) {
            closeCommentModalFunc();
        }
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Edit button
    editCommentBtn.onclick = setModalToEditMode;

    // Close button
    closeCommentBtn.onclick = closeCommentModalFunc;

    // Cancel button
    cancelCommentBtn.onclick = () => {
        // Restore original comment content
        const currentKpi = commentModal.getAttribute('data-current-kpi');
        loadCommentFromFirebase(currentKpi).then(comment => {
            commentTextarea.value = comment || '';
            commentDisplay.textContent = comment || '';
        });
        setModalToViewMode();
    };

    // Save button
    saveCommentBtn.onclick = async () => {
        const currentKpi = commentModal.getAttribute('data-current-kpi');
        const newComment = commentTextarea.value.trim();
        
        await saveCommentToFirebase(currentKpi, newComment);
        updateCommentButtonAppearance(currentKpi, newComment.length > 0);
        
        // Update display and switch back to view mode
        commentDisplay.textContent = newComment;
        setModalToViewMode();
    };

    // Keyboard shortcuts for comment modal
    document.addEventListener('keydown', (e) => {
        if (commentModal.style.display === 'block') {
            if (e.key === 'Escape') {
                if (commentTextarea.style.display === 'block') {
                    // In edit mode, cancel edit
                    cancelCommentBtn.click();
                } else {
                    // In view mode, close modal
                    closeCommentModalFunc();
                }
            } else if (e.key === 'Enter' && e.ctrlKey && commentTextarea.style.display === 'block') {
                e.preventDefault();
                saveCommentBtn.click();
            }
        }
    });

    // --- REVENUE GOAL SLIDER FUNCTIONALITY ---
    console.log('=== REVENUE GOAL SLIDER INITIALIZATION ===');
    
    // Monthly revenue goals data structure
    let monthlyRevenueGoals = {};
    let monthlyRevenueActuals = {};
    let currentMonth = new Date().getMonth(); // 0-11
    let currentYear = new Date().getFullYear();
    
    // Default monthly goals for 2024
    const defaultMonthlyGoals = {
        0: 85000,   // January
        1: 88000,   // February
        2: 92000,   // March
        3: 95000,   // April
        4: 98000,   // May
        5: 100000,  // June
        6: 105000,  // July
        7: 110000,  // August
        8: 115000,  // September
        9: 118000,  // October
        10: 120000, // November
        11: 125000  // December
    };
    
    // Default monthly actuals for 2024
    const defaultMonthlyActuals = {
        0: 82000,   // January
        1: 85000,   // February
        2: 89000,   // March
        3: 92000,   // April
        4: 95000,   // May
        5: 94000,   // June (current)
        6: 0,       // July
        7: 0,       // August
        8: 0,       // September
        9: 0,       // October
        10: 0,      // November
        11: 0       // December
    };
    
    // Firebase functions for monthly revenue goals and actuals
    async function saveMonthlyRevenueData() {
        try {
            console.log('Saving monthly revenue data to Firebase:', { goals: monthlyRevenueGoals, actuals: monthlyRevenueActuals });
            await setDoc(doc(db, "monthlyRevenueData", "data"), { 
                goals: monthlyRevenueGoals,
                actuals: monthlyRevenueActuals,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('Monthly revenue data saved successfully to Firebase');
        } catch (error) {
            console.error("Error saving monthly revenue data to Firebase:", error);
        }
    }
    
    async function loadMonthlyRevenueData() {
        try {
            console.log('Loading monthly revenue data from Firebase...');
            const docRef = doc(db, "monthlyRevenueData", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Monthly revenue data found in Firebase, applying...');
                monthlyRevenueGoals = data.goals || { ...defaultMonthlyGoals };
                monthlyRevenueActuals = data.actuals || { ...defaultMonthlyActuals };
            } else {
                console.log('No monthly revenue data found in Firebase, using defaults...');
                monthlyRevenueGoals = { ...defaultMonthlyGoals };
                monthlyRevenueActuals = { ...defaultMonthlyActuals };
                // Save default data to Firebase
                await saveMonthlyRevenueData();
            }
        } catch (error) {
            console.error("Error loading monthly revenue data from Firebase:", error);
            monthlyRevenueGoals = { ...defaultMonthlyGoals };
            monthlyRevenueActuals = { ...defaultMonthlyActuals };
        }
        updateRevenueGoalSlider();
    }
    
    // Update revenue goal slider
    function updateRevenueGoalSlider() {
        // Get the current value from the large number above the slider
        const revenueValueEl = document.getElementById('revenueValue');
        let currentValue = 0;
        if (revenueValueEl) {
            let val = revenueValueEl.textContent.trim();
            val = val.replace(/[$,\s]/g, '');
            if (val.toUpperCase().endsWith('K')) {
                val = val.slice(0, -1);
                currentValue = Math.round(parseFloat(val) * 1000);
            } else {
                currentValue = parseFloat(val) || 0;
            }
        }
        
        // Get the current month's goal from monthly goals data
        let goalValue = 0;
        if (typeof monthlyRevenueGoals !== 'undefined' && typeof currentMonth !== 'undefined') {
            goalValue = monthlyRevenueGoals[currentMonth] || defaultMonthlyGoals[currentMonth];
        }
        
        // Fallback to 1 to avoid division by zero
        if (!goalValue) goalValue = 1;
        const progress = Math.min((currentValue / goalValue) * 100, 100);
        
        // Update slider fill and thumb
        const sliderFill = document.getElementById('sliderFill');
        const sliderThumb = document.getElementById('sliderThumb');
        if (sliderFill) sliderFill.style.width = `${progress}%`;
        if (sliderThumb) sliderThumb.style.left = `${progress}%`;
        
        // Update slider colors based on progress
        if (sliderFill) {
            if (progress >= 100) {
                sliderFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            } else if (progress >= 80) {
                sliderFill.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
            } else {
                sliderFill.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
            }
        }
        
        // Always update the goal label with current month's goal
        const currentGoalLabel = document.getElementById('currentGoalLabel');
        if (currentGoalLabel) {
            currentGoalLabel.textContent = `Goal: ${formatMRR(goalValue)}`;
        }
        
        // Update the month label
        const currentMonthLabel = document.getElementById('currentMonthLabel');
        if (currentMonthLabel) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthLabel.textContent = monthNames[currentMonth];
        }
    }
    
    // Initialize revenue goal slider
    function initializeRevenueGoalSlider() {
        console.log('Initializing revenue goal slider...');
        
        // Load monthly goals
        loadMonthlyRevenueData();
        
        // Add click event to slider to open modal
        const revenueGoalSlider = document.getElementById('revenueGoalSlider');
        if (revenueGoalSlider) {
            revenueGoalSlider.addEventListener('click', () => {
                openRevenueGoalsModal();
            });
        }
        
        // Set up modal functionality
        setupRevenueGoalsModal();
    }
    
    // Revenue Goals Modal functionality
    function setupRevenueGoalsModal() {
        const revenueGoalsModal = document.getElementById('revenueGoalsModal');
        const closeRevenueGoalsModal = document.getElementById('closeRevenueGoalsModal');
        const closeRevenueGoalsBtn = document.getElementById('closeRevenueGoalsBtn');
        const saveRevenueGoalsBtn = document.getElementById('saveRevenueGoalsBtn');
        
        // Close modal functions
        function closeRevenueGoalsModalFunc() {
            revenueGoalsModal.style.display = 'none';
        }
        
        // Close modal when clicking X
        if (closeRevenueGoalsModal) {
            closeRevenueGoalsModal.onclick = closeRevenueGoalsModalFunc;
        }
        
        // Close modal when clicking close button
        if (closeRevenueGoalsBtn) {
            closeRevenueGoalsBtn.onclick = closeRevenueGoalsModalFunc;
        }
        
        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === revenueGoalsModal) {
                closeRevenueGoalsModalFunc();
            }
            if (event.target === modal) {
                modal.style.display = 'none';
            }
            if (event.target === commentModal) {
                closeCommentModalFunc();
            }
        };
        
        // Save button functionality
        if (saveRevenueGoalsBtn) {
            saveRevenueGoalsBtn.addEventListener('click', async () => {
                console.log('Saving all revenue goals and actuals...');
                
                // Collect all goal and actual values from inputs - SPECIFIC TO REVENUE MODAL
                const goalInputs = document.querySelectorAll('#revenueGoalsGrid .goal-input');
                const actualInputs = document.querySelectorAll('#revenueGoalsGrid .actual-input');
                
                goalInputs.forEach(input => {
                    const monthIndex = parseInt(input.getAttribute('data-month'));
                    let value = input.value.trim();
                    
                    // Parse the value properly, handling K suffix
                    if (typeof value === 'string') {
                        value = value.replace(/[$,\s]/g, '');
                        if (value.toUpperCase().endsWith('K')) {
                            value = value.slice(0, -1);
                            value = Math.round(parseFloat(value) * 1000);
                        } else {
                            value = parseFloat(value) || 0;
                        }
                    } else {
                        value = parseFloat(value) || 0;
                    }
                    
                    monthlyRevenueGoals[monthIndex] = value;
                });
                
                actualInputs.forEach(input => {
                    const monthIndex = parseInt(input.getAttribute('data-month'));
                    let value = input.value.trim();
                    
                    // Parse the value properly, handling K suffix
                    if (typeof value === 'string') {
                        value = value.replace(/[$,\s]/g, '');
                        if (value.toUpperCase().endsWith('K')) {
                            value = value.slice(0, -1);
                            value = Math.round(parseFloat(value) * 1000);
                        } else {
                            value = parseFloat(value) || 0;
                        }
                    } else {
                        value = parseFloat(value) || 0;
                    }
                    
                    monthlyRevenueActuals[monthIndex] = value;
                });
                
                // Save to Firebase
                await saveMonthlyRevenueData();
                
                // Update slider and goal labels
                updateRevenueGoalSlider();
                
                // Visual feedback
                const originalText = saveRevenueGoalsBtn.textContent;
                saveRevenueGoalsBtn.textContent = 'Saved!';
                saveRevenueGoalsBtn.style.background = '#27ae60';
                setTimeout(() => {
                    saveRevenueGoalsBtn.textContent = originalText;
                    saveRevenueGoalsBtn.style.background = '#4285f4';
                }, 2000);
            });
        }
    }
    
    // Open revenue goals modal
    function openRevenueGoalsModal() {
        console.log('Opening revenue goals modal...');
        console.log('Current revenue goals data:', monthlyRevenueGoals);
        console.log('Current revenue actuals data:', monthlyRevenueActuals);
        
        const revenueGoalsModal = document.getElementById('revenueGoalsModal');
        const revenueGoalsGrid = document.getElementById('revenueGoalsGrid');
        
        if (!revenueGoalsModal || !revenueGoalsGrid) return;
        
        // Populate the grid with monthly goals
        revenueGoalsGrid.innerHTML = '';
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        for (let i = 0; i < 12; i++) {
            const goal = monthlyRevenueGoals[i] || defaultMonthlyGoals[i];
            const actual = monthlyRevenueActuals[i] || defaultMonthlyActuals[i];
            const isCurrentMonth = i === currentMonth;
            const isPastMonth = i < currentMonth;
            const isFutureMonth = i > currentMonth;
            
            // Determine card class
            let cardClass = 'monthly-goal-card';
            if (isCurrentMonth) cardClass += ' current-month';
            else if (isPastMonth) cardClass += ' completed';
            else if (isFutureMonth) cardClass += ' future';
            
            // Determine status
            let status = '';
            if (isCurrentMonth) {
                const progress = Math.min((actual / goal) * 100, 100);
                if (progress >= 100) {
                    status = '✅ Goal Met!';
                } else if (progress >= 80) {
                    status = '🟡 On Track';
                } else {
                    status = '🔴 Behind';
                }
            } else if (isPastMonth) {
                status = '✅ Completed';
            } else {
                status = '⏳ Upcoming';
            }
            
            const card = document.createElement('div');
            card.className = cardClass;
            card.innerHTML = `
                <div class="month-header">${monthNames[i]}</div>
                <div class="input-row">
                    <div class="goal-label">Goal</div>
                    <input type="text" class="goal-input" value="${formatMRR(goal)}" data-month="${i}" data-type="goal">
                </div>
                <div class="input-row">
                    <div class="actual-label">Actual</div>
                    <input type="text" class="actual-input" value="${formatMRR(actual)}" data-month="${i}" data-type="actual">
                </div>
                <div class="goal-status">${status}</div>
            `;
            
            revenueGoalsGrid.appendChild(card);
        }
        
        // Show modal
        revenueGoalsModal.style.display = 'block';
    }
    
    // Update revenue goals summary
    function updateRevenueGoalsSummary() {
        const currentMonthSummary = document.getElementById('currentMonthSummary');
        const currentGoalSummary = document.getElementById('currentGoalSummary');
        const currentActualSummary = document.getElementById('currentActualSummary');
        const ytdGoalSummary = document.getElementById('ytdGoalSummary');
        const ytdActualSummary = document.getElementById('ytdActualSummary');
        
        if (currentMonthSummary) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthSummary.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
        if (currentGoalSummary) {
            const currentGoal = monthlyRevenueGoals[currentMonth] || defaultMonthlyGoals[currentMonth];
            currentGoalSummary.textContent = formatMRR(currentGoal);
        }
        
        if (currentActualSummary) {
            const currentActual = monthlyRevenueActuals[currentMonth] || defaultMonthlyActuals[currentMonth];
            currentActualSummary.textContent = formatMRR(currentActual);
        }
        
        if (ytdGoalSummary) {
            let ytdGoalTotal = 0;
            for (let i = 0; i <= currentMonth; i++) {
                ytdGoalTotal += monthlyRevenueGoals[i] || defaultMonthlyGoals[i];
            }
            ytdGoalSummary.textContent = formatMRR(ytdGoalTotal);
        }
        
        if (ytdActualSummary) {
            let ytdActualTotal = 0;
            for (let i = 0; i <= currentMonth; i++) {
                ytdActualTotal += monthlyRevenueActuals[i] || defaultMonthlyActuals[i];
            }
            ytdActualSummary.textContent = formatMRR(ytdActualTotal);
        }
    }
    
    // Listen for revenue changes to update slider
    if (revenueValueEl) {
        const revenueObserver = new MutationObserver(() => {
            updateRevenueGoalSlider();
        });
        revenueObserver.observe(revenueValueEl, { childList: true, characterData: true, subtree: true });
    }

    // --- CLIENT GOAL SLIDER FUNCTIONALITY ---
    console.log('=== CLIENT GOAL SLIDER INITIALIZATION ===');
    
    // Monthly client goals data structure
    let monthlyClientGoals = {};
    let monthlyClientActuals = {};
    
    // Default monthly client goals for 2025
    const defaultMonthlyClientGoals = {
        0: 25,   // January
        1: 26,   // February
        2: 27,   // March
        3: 28,   // April
        4: 29,   // May
        5: 30,   // June
        6: 31,   // July
        7: 32,   // August
        8: 33,   // September
        9: 34,   // October
        10: 35,  // November
        11: 36   // December
    };
    
    // Default monthly client actuals for 2025
    const defaultMonthlyClientActuals = {
        0: 23,   // January
        1: 24,   // February
        2: 25,   // March
        3: 26,   // April
        4: 27,   // May
        5: 25,   // June (current)
        6: 0,    // July
        7: 0,    // August
        8: 0,    // September
        9: 0,    // October
        10: 0,   // November
        11: 0    // December
    };

    // --- NEW CLIENTS GOAL SLIDER FUNCTIONALITY ---
    console.log('=== NEW CLIENTS GOAL SLIDER INITIALIZATION ===');
    
    // Monthly new clients goals data structure
    let monthlyNewClientsGoals = {};
    let monthlyNewClientsActuals = {};
    
    // Default monthly new clients goals for 2025
    const defaultMonthlyNewClientsGoals = {
        0: 5,    // January
        1: 6,    // February
        2: 7,    // March
        3: 8,    // April
        4: 9,    // May
        5: 10,   // June
        6: 11,   // July
        7: 12,   // August
        8: 13,   // September
        9: 14,   // October
        10: 15,  // November
        11: 16   // December
    };
    
    // Default monthly new clients actuals for 2025
    const defaultMonthlyNewClientsActuals = {
        0: 4,    // January
        1: 5,    // February
        2: 6,    // March
        3: 7,    // April
        4: 8,    // May
        5: 6,    // June (current)
        6: 0,    // July
        7: 0,    // August
        8: 0,    // September
        9: 0,    // October
        10: 0,   // November
        11: 0    // December
    };
    
    // Firebase functions for monthly client goals and actuals
    async function saveMonthlyClientData() {
        try {
            console.log('Saving monthly client data to Firebase:', { goals: monthlyClientGoals, actuals: monthlyClientActuals });
            await setDoc(doc(db, "monthlyClientData", "data"), { 
                goals: monthlyClientGoals,
                actuals: monthlyClientActuals,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('Monthly client data saved successfully to Firebase');
        } catch (error) {
            console.error("Error saving monthly client data to Firebase:", error);
        }
    }
    
    async function loadMonthlyClientData() {
        try {
            console.log('Loading monthly client data from Firebase...');
            const docRef = doc(db, "monthlyClientData", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Monthly client data found in Firebase, applying...');
                monthlyClientGoals = data.goals || { ...defaultMonthlyClientGoals };
                monthlyClientActuals = data.actuals || { ...defaultMonthlyClientActuals };
            } else {
                console.log('No monthly client data found in Firebase, using defaults...');
                monthlyClientGoals = { ...defaultMonthlyClientGoals };
                monthlyClientActuals = { ...defaultMonthlyClientActuals };
                // Save default data to Firebase
                await saveMonthlyClientData();
            }
        } catch (error) {
            console.error("Error loading monthly client data from Firebase:", error);
            monthlyClientGoals = { ...defaultMonthlyClientGoals };
            monthlyClientActuals = { ...defaultMonthlyClientActuals };
        }
        updateClientGoalSlider();
    }
    
    // Update client goal slider
    function updateClientGoalSlider() {
        // Get the current value from the large number above the slider
        const activeClientsValueEl = document.getElementById('activeClientsValue');
        let currentValue = 0;
        if (activeClientsValueEl) {
            let val = activeClientsValueEl.textContent.trim();
            val = val.replace(/[,\s]/g, '');
            currentValue = parseFloat(val) || 0;
        }
        
        // Get the current month's goal from monthly goals data
        let goalValue = 0;
        if (typeof monthlyClientGoals !== 'undefined' && typeof currentMonth !== 'undefined') {
            goalValue = monthlyClientGoals[currentMonth] || defaultMonthlyClientGoals[currentMonth];
        }
        
        // Fallback to 1 to avoid division by zero
        if (!goalValue) goalValue = 1;
        const progress = Math.min((currentValue / goalValue) * 100, 100);
        
        // Update slider fill and thumb
        const sliderFill = document.getElementById('clientSliderFill');
        const sliderThumb = document.getElementById('clientSliderThumb');
        if (sliderFill) sliderFill.style.width = `${progress}%`;
        if (sliderThumb) sliderThumb.style.left = `${progress}%`;
        
        // Update slider colors based on progress
        if (sliderFill) {
            if (progress >= 100) {
                sliderFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            } else if (progress >= 80) {
                sliderFill.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
            } else {
                sliderFill.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
            }
        }
        
        // Always update the goal label with current month's goal
        const currentGoalLabel = document.getElementById('currentClientGoalLabel');
        if (currentGoalLabel) {
            currentGoalLabel.textContent = `Goal: ${goalValue}`;
        }
        
        // Update the month label
        const currentMonthLabel = document.getElementById('currentClientMonthLabel');
        if (currentMonthLabel) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthLabel.textContent = monthNames[currentMonth];
        }
    }
    
    // Initialize client goal slider
    function initializeClientGoalSlider() {
        console.log('Initializing client goal slider...');
        
        // Load monthly goals
        loadMonthlyClientData();
        
        // Add click event to slider to open modal
        const clientGoalSlider = document.getElementById('clientGoalSlider');
        if (clientGoalSlider) {
            clientGoalSlider.addEventListener('click', () => {
                openClientGoalsModal();
            });
        }
        
        // Set up modal functionality
        setupClientGoalsModal();
    }
    
    // Client Goals Modal functionality
    function setupClientGoalsModal() {
        const clientGoalsModal = document.getElementById('clientGoalsModal');
        const closeClientGoalsModal = document.getElementById('closeClientGoalsModal');
        const closeClientGoalsBtn = document.getElementById('closeClientGoalsBtn');
        const saveClientGoalsBtn = document.getElementById('saveClientGoalsBtn');
        
        // Close modal functions
        function closeClientGoalsModalFunc() {
            clientGoalsModal.style.display = 'none';
        }
        
        // Close modal when clicking X
        if (closeClientGoalsModal) {
            closeClientGoalsModal.onclick = closeClientGoalsModalFunc;
        }
        
        // Close modal when clicking close button
        if (closeClientGoalsBtn) {
            closeClientGoalsBtn.onclick = closeClientGoalsModalFunc;
        }
        
        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === clientGoalsModal) {
                closeClientGoalsModalFunc();
            }
            if (event.target === modal) {
                modal.style.display = 'none';
            }
            if (event.target === commentModal) {
                closeCommentModalFunc();
            }
            if (event.target === revenueGoalsModal) {
                closeRevenueGoalsModalFunc();
            }
        };
        
        // Save button functionality
        if (saveClientGoalsBtn) {
            saveClientGoalsBtn.addEventListener('click', async () => {
                console.log('Saving all client goals and actuals...');
                
                // Collect all goal and actual values from inputs
                const goalInputs = document.querySelectorAll('#clientGoalsGrid .goal-input');
                const actualInputs = document.querySelectorAll('#clientGoalsGrid .actual-input');
                
                goalInputs.forEach(input => {
                    const monthIndex = parseInt(input.getAttribute('data-month'));
                    let value = input.value.trim();
                    
                    // Parse the value properly
                    value = parseInt(value.replace(/[,\s]/g, '')) || 0;
                    
                    monthlyClientGoals[monthIndex] = value;
                });
                
                actualInputs.forEach(input => {
                    const monthIndex = parseInt(input.getAttribute('data-month'));
                    let value = input.value.trim();
                    
                    // Parse the value properly
                    value = parseInt(value.replace(/[,\s]/g, '')) || 0;
                    
                    monthlyClientActuals[monthIndex] = value;
                });
                
                // Save to Firebase
                await saveMonthlyClientData();
                
                // Update slider and goal labels
                updateClientGoalSlider();
                
                // Visual feedback
                const originalText = saveClientGoalsBtn.textContent;
                saveClientGoalsBtn.textContent = 'Saved!';
                saveClientGoalsBtn.style.background = '#27ae60';
                setTimeout(() => {
                    saveClientGoalsBtn.textContent = originalText;
                    saveClientGoalsBtn.style.background = '#4285f4';
                }, 2000);
            });
        }
    }
    
    // Open client goals modal
    function openClientGoalsModal() {
        console.log('Opening client goals modal...');
        console.log('Current client goals data:', monthlyClientGoals);
        console.log('Current client actuals data:', monthlyClientActuals);
        
        const clientGoalsModal = document.getElementById('clientGoalsModal');
        const clientGoalsGrid = document.getElementById('clientGoalsGrid');
        
        if (!clientGoalsModal || !clientGoalsGrid) return;
        
        // Populate the grid with monthly goals
        clientGoalsGrid.innerHTML = '';
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        for (let i = 0; i < 12; i++) {
            const goal = monthlyClientGoals[i] || defaultMonthlyClientGoals[i];
            const actual = monthlyClientActuals[i] || defaultMonthlyClientActuals[i];
            const isCurrentMonth = i === currentMonth;
            const isPastMonth = i < currentMonth;
            const isFutureMonth = i > currentMonth;
            
            // Determine card class
            let cardClass = 'monthly-goal-card';
            if (isCurrentMonth) cardClass += ' current-month';
            else if (isPastMonth) cardClass += ' completed';
            else if (isFutureMonth) cardClass += ' future';
            
            // Determine status
            let status = '';
            if (isCurrentMonth) {
                const progress = Math.min((actual / goal) * 100, 100);
                if (progress >= 100) {
                    status = '✅ Goal Met!';
                } else if (progress >= 80) {
                    status = '🟡 On Track';
                } else {
                    status = '🔴 Behind';
                }
            } else if (isPastMonth) {
                status = '✅ Completed';
            } else {
                status = '⏳ Upcoming';
            }
            
            const card = document.createElement('div');
            card.className = cardClass;
            card.innerHTML = `
                <div class="month-header">${monthNames[i]}</div>
                <div class="input-row">
                    <div class="goal-label">Goal</div>
                    <input type="text" class="goal-input" value="${goal}" data-month="${i}" data-type="goal">
                </div>
                <div class="input-row">
                    <div class="actual-label">Actual</div>
                    <input type="text" class="actual-input" value="${actual}" data-month="${i}" data-type="actual">
                </div>
                <div class="goal-status">${status}</div>
            `;
            
            clientGoalsGrid.appendChild(card);
        }
        
        // Show modal
        clientGoalsModal.style.display = 'block';
    }
    
    // Update client goals summary
    function updateClientGoalsSummary() {
        const currentMonthSummary = document.getElementById('currentClientMonthSummary');
        const currentGoalSummary = document.getElementById('currentClientGoalSummary');
        const currentActualSummary = document.getElementById('currentClientActualSummary');
        const ytdGoalSummary = document.getElementById('clientYtdGoalSummary');
        const ytdActualSummary = document.getElementById('clientYtdActualSummary');
        
        if (currentMonthSummary) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthSummary.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
        if (currentGoalSummary) {
            const currentGoal = monthlyClientGoals[currentMonth] || defaultMonthlyClientGoals[currentMonth];
            currentGoalSummary.textContent = currentGoal;
        }
        
        if (currentActualSummary) {
            const currentActual = monthlyClientActuals[currentMonth] || defaultMonthlyClientActuals[currentMonth];
            currentActualSummary.textContent = currentActual;
        }
        
        if (ytdGoalSummary) {
            let ytdGoalTotal = 0;
            for (let i = 0; i <= currentMonth; i++) {
                ytdGoalTotal += monthlyClientGoals[i] || defaultMonthlyClientGoals[i];
            }
            ytdGoalSummary.textContent = ytdGoalTotal;
        }
        
        if (ytdActualSummary) {
            let ytdActualTotal = 0;
            for (let i = 0; i <= currentMonth; i++) {
                ytdActualTotal += monthlyClientActuals[i] || defaultMonthlyClientActuals[i];
            }
            ytdActualSummary.textContent = ytdActualTotal;
        }
    }
    
    // Listen for client changes to update slider
    const activeClientsValueEl = document.getElementById('activeClientsValue');
    if (activeClientsValueEl) {
        const clientObserver = new MutationObserver(() => {
            updateClientGoalSlider();
        });
        clientObserver.observe(activeClientsValueEl, { childList: true, characterData: true, subtree: true });
    }



    function attachKpiTrackerEventListeners() {
        console.log('Attaching KPI Tracker event listeners...');
        
        // Enhanced auto-save functionality for KPI Tracker
        if (kpiTrackerBody) {
            kpiTrackerBody.addEventListener('input', function(e) {
                if (e.target.matches('[contenteditable]')) {
                    console.log('KPI tracker cell input detected, saving...');
                    debouncedSaveKpiTracker();
                }
            }, true);
            
            kpiTrackerBody.addEventListener('keydown', function(e) {
                if (e.target.matches('[contenteditable]') && e.key === 'Enter') {
                    console.log('KPI tracker Enter key detected, saving...');
                    e.target.blur(); // This will trigger the blur event
                }
            }, true);
            
            // Save on blur for contenteditable cells
            kpiTrackerBody.addEventListener('blur', function(e) {
                if (e.target.matches('[contenteditable]')) {
                    console.log('KPI tracker cell blur detected, saving...');
                    debouncedSaveKpiTracker();
                }
            }, true);
        }

        // Add week button
                    const addWeekBtn = document.getElementById('addWeekBtn');
            if (addWeekBtn && kpiTrackerHeaderRow && kpiTrackerBody) {
                console.log('Add week button found, adding event listener');
                addWeekBtn.addEventListener('click', async () => {
                    let weekLabel = prompt('Enter new week label (e.g., 6/19):');
                    if (!weekLabel) return;
                    
                    console.log('=== ADDING NEW WEEK: ' + weekLabel + ' ===');
                    
                                        // SIMPLE APPROACH: Add week to data structure, then rebuild table
                    try {
                        // 1. Get current data
                        const currentData = getKpiTrackerData();
                        
                        // 2. Add new week to header at position 3
                        currentData.header.splice(3, 0, weekLabel);
                        
                        // 3. Add empty cell to each row at position 3
                        let rowIndex = 0;
                        while (currentData[`row${rowIndex}`]) {
                            currentData[`row${rowIndex}`].splice(3, 0, '');
                            rowIndex++;
                        }
                        
                        // 4. Save to Firebase
                        await setDoc(doc(db, "kpiTracker", "data"), currentData, { merge: true });
                        
                        // 5. Rebuild table
                        setKpiTrackerData(currentData);
                        
                        // 6. Update UI
                        updateScrollArrows();
                        renderDeleteWeekButtons();
                        renderDeleteWeekButtons();
                        
                        console.log('Week added successfully');
                        showNotification('Week "' + weekLabel + '" added successfully', 'success');
                        
                    } catch (error) {
                        console.error('Error adding week:', error);
                        showNotification('Error adding week: ' + error.message, 'error');
                    }
                });
            }

        // Test selection button
        const testSelectionBtn = document.getElementById('testSelectionBtn');
        if (testSelectionBtn) {
            testSelectionBtn.addEventListener('click', () => {
                console.log('Test selection button clicked');
                // Select the first few cells to test
                if (kpiTrackerBody && kpiTrackerBody.children.length > 0) {
                    const firstRow = kpiTrackerBody.children[0];
                    if (firstRow.children.length > 3) {
                        clearSelection();
                        // Select first 3 cells of first row
                        for (let i = 3; i < 6 && i < firstRow.children.length; i++) {
                            const cell = firstRow.children[i];
                            if (cell.matches('td[contenteditable]')) {
                                highlightCell(cell);
                            }
                        }
                        console.log('Test selection complete, selected cells:', selectedCells.length);
                        showNotification('Test selection: ' + selectedCells.length + ' cells selected', 'info');
                    }
                }
            });
        }











        // Add row button
        const addKpiRowBtn = document.getElementById('addKpiRowBtn');
        if (addKpiRowBtn && kpiTrackerHeaderRow && kpiTrackerBody) {
            addKpiRowBtn.addEventListener('click', () => {
                // 1. Get current data
                const currentData = getKpiTrackerData();
                
                // 2. Find the next row index
                let rowIndex = 0;
                while (currentData[`row${rowIndex}`]) {
                    rowIndex++;
                }
                
                // 3. Create new row with empty cells
                const newRow = new Array(currentData.header.length).fill('');
                newRow[0] = 'New Owner';
                newRow[1] = 'New KPI';
                newRow[2] = '0';
                
                // 4. Add to data
                currentData[`row${rowIndex}`] = newRow;
                
                // 5. Save to Firebase
                setDoc(doc(db, "kpiTracker", "data"), currentData, { merge: true });
                
                // 6. Rebuild table
                setKpiTrackerData(currentData);
                
                // 7. Update UI
                updateScrollArrows();
            });
        }

        // Edit button for KPI Tracker
        const editKpiBtn = document.getElementById('editKpiBtn');
        if (editKpiBtn) {
            console.log('Edit KPI button found, adding event listener');
            editKpiBtn.addEventListener('click', () => {
                console.log('Edit KPI button clicked');
                
                // Toggle edit mode
                document.body.classList.toggle('kpi-edit-mode');
                
                // Update button text
                if (document.body.classList.contains('kpi-edit-mode')) {
                    editKpiBtn.textContent = 'Done';
                    editKpiBtn.style.background = '#e74c3c';
                    
                    // Show delete buttons
                    renderDeleteWeekButtons();
                    renderDeleteRowButtons();
                } else {
                    editKpiBtn.textContent = 'Edit';
                    editKpiBtn.style.background = '#3498db';
                    
                    // Hide delete buttons
                    const deleteButtons = document.querySelectorAll('.delete-week-btn, .delete-kpi-row-btn');
                    deleteButtons.forEach(btn => btn.remove());
                }
            });
        }

        // Multi-cell selection functionality - TEMPORARILY DISABLED
        // Add selection event listeners to KPI Tracker table
        if (kpiTrackerBody) {
            console.log('Multi-cell selection temporarily disabled for debugging');
            
            // Simple click to clear any existing selection
            kpiTrackerBody.addEventListener('click', function(e) {
                if (e.target.matches('td[contenteditable]')) {
                    clearSelection();
                }
            });
        }

        // Auto-save functionality - removed save button, now auto-saves on changes

        // Scroll arrows
        const scrollLeftBtn = document.getElementById('scrollLeftBtn');
        const scrollRightBtn = document.getElementById('scrollRightBtn');
        const kpiTableScroll = document.getElementById('kpiTableScroll');
        
        if (scrollLeftBtn && scrollRightBtn && kpiTableScroll) {
            scrollLeftBtn.addEventListener('click', () => {
                kpiTableScroll.scrollBy({ left: -200, behavior: 'smooth' });
            });
            scrollRightBtn.addEventListener('click', () => {
                kpiTableScroll.scrollBy({ left: 200, behavior: 'smooth' });
            });
            kpiTableScroll.addEventListener('scroll', updateScrollArrows);
            window.addEventListener('resize', updateScrollArrows);
        }

        // Delete week functionality
        if (kpiTrackerHeaderRow && kpiTrackerBody) {
            kpiTrackerHeaderRow.addEventListener('click', function(e) {
                if (e.target.classList.contains('delete-week-btn')) {
                    const colIdx = parseInt(e.target.getAttribute('data-col'), 10);
                    // Remove header cell
                    kpiTrackerHeaderRow.removeChild(kpiTrackerHeaderRow.children[colIdx]);
                    // Remove cell in each row
                    Array.from(kpiTrackerBody.children).forEach(row => {
                        if (row.children[colIdx]) row.removeChild(row.children[colIdx]);
                    });
                    saveKpiTrackerToFirebase();
                    updateScrollArrows();
                    renderDeleteWeekButtons();
                }
            });
        }

        // Edit week label functionality
        if (kpiTrackerHeaderRow) {
            kpiTrackerHeaderRow.addEventListener('click', function(e) {
                // Only allow editing if clicking the text node, not the delete button
                if (e.target.tagName === 'TH' && e.target.cellIndex >= 3) {
                    const th = e.target;
                    if (th.querySelector('input')) return;
                    // Get only the label text (exclude any buttons)
                    let oldLabel = '';
                    for (const node of th.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            oldLabel += node.textContent;
                        }
                    }
                    oldLabel = oldLabel.trim();
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = oldLabel;
                    input.style.width = '60px';
                    input.style.fontSize = '1em';
                    input.style.textAlign = 'center';
                    // Remove all children (label and buttons)
                    while (th.firstChild) th.removeChild(th.firstChild);
                    th.appendChild(input);
                    input.focus();
                    input.select();
                    function saveEdit() {
                        let newLabel = input.value.trim();
                        // Prevent empty or duplicate labels
                        const labels = Array.from(kpiTrackerHeaderRow.children).map(th => {
                            let txt = '';
                            for (const node of th.childNodes) {
                                if (node.nodeType === Node.TEXT_NODE) txt += node.textContent;
                            }
                            return txt.trim();
                        });
                        if (!newLabel || (labels.includes(newLabel) && newLabel !== oldLabel)) {
                            newLabel = oldLabel;
                        }
                        // Remove all children
                        while (th.firstChild) th.removeChild(th.firstChild);
                        th.appendChild(document.createTextNode(newLabel));
                        // Do NOT add a delete button here; let renderDeleteWeekButtons handle it
                        // Ensure header and body columns match
                        Array.from(kpiTrackerBody.children).forEach(row => {
                            while (row.children.length < kpiTrackerHeaderRow.children.length) {
                                const td = document.createElement('td');
                                td.contentEditable = 'true';
                                td.textContent = '';
                                row.appendChild(td);
                            }
                            while (row.children.length > kpiTrackerHeaderRow.children.length) {
                                row.removeChild(row.lastChild);
                            }
                        });
                        saveKpiTrackerToFirebase();
                        renderDeleteWeekButtons();
                        updateScrollArrows();
                    }
                    input.addEventListener('blur', saveEdit);
                    input.addEventListener('keydown', function(evt) {
                        if (evt.key === 'Enter') {
                            input.blur();
                        } else if (evt.key === 'Escape') {
                            // Restore old label only, do NOT add a delete button here
                            while (th.firstChild) th.removeChild(th.firstChild);
                            th.appendChild(document.createTextNode(oldLabel));
                            renderDeleteWeekButtons();
                        }
                    });
                }
            });
        }
    }

    // Multi-cell selection helper functions
    function clearSelection() {
        console.log('Clearing selection, current cells:', selectedCells.length);
        selectedCells.forEach(cell => {
            cell.classList.remove('selected-cell');
        });
        selectedCells = [];
    }

    function highlightCell(cell) {
        console.log('Highlighting cell:', cell);
        cell.classList.add('selected-cell');
        selectedCells.push(cell);
        console.log('Total selected cells:', selectedCells.length);
    }

    function selectRange(startCell, endCell) {
        if (!startCell || !endCell) return;
        
        const startRow = startCell.parentElement;
        const endRow = endCell.parentElement;
        const startRowIndex = Array.from(kpiTrackerBody.children).indexOf(startRow);
        const endRowIndex = Array.from(kpiTrackerBody.children).indexOf(endRow);
        const startColIndex = Array.from(startRow.children).indexOf(startCell);
        const endColIndex = Array.from(endRow.children).indexOf(endCell);
        
        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);
        
        selectedCells = [];
        
        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
            const row = kpiTrackerBody.children[rowIndex];
            for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
                const cell = row.children[colIndex];
                if (cell && cell.matches('td[contenteditable]')) {
                    highlightCell(cell);
                }
            }
        }
    }

    function copySelectedCells() {
        if (selectedCells.length === 0) return;
        
        // Create a 2D array of selected data
        const selectedData = [];
        const rows = new Set();
        const cols = new Set();
        
        selectedCells.forEach(cell => {
            const row = cell.parentElement;
            const rowIndex = Array.from(kpiTrackerBody.children).indexOf(row);
            const colIndex = Array.from(row.children).indexOf(cell);
            rows.add(rowIndex);
            cols.add(colIndex);
        });
        
        const rowArray = Array.from(rows).sort((a, b) => a - b);
        const colArray = Array.from(cols).sort((a, b) => a - b);
        
        rowArray.forEach(rowIndex => {
            const rowData = [];
            colArray.forEach(colIndex => {
                const cell = kpiTrackerBody.children[rowIndex].children[colIndex];
                rowData.push(cell ? cell.textContent : '');
            });
            selectedData.push(rowData);
        });
        
        // Convert to clipboard-friendly format
        const clipboardText = selectedData.map(row => row.join('\t')).join('\n');
        
        // Copy to clipboard
        navigator.clipboard.writeText(clipboardText).then(() => {
            console.log('Copied to clipboard:', clipboardText);
            showNotification('Copied ' + selectedCells.length + ' cells to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            // Fallback: select the text and let user copy manually
            const textArea = document.createElement('textarea');
            textArea.value = clipboardText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Copied ' + selectedCells.length + ' cells to clipboard', 'success');
        });
    }

    function pasteToSelectedCells() {
        if (selectedCells.length === 0) return;
        
        navigator.clipboard.readText().then(clipboardText => {
            const rows = clipboardText.split('\n').filter(row => row.trim());
            const pasteData = rows.map(row => row.split('\t'));
            
            if (pasteData.length === 0) return;
            
            // Find the top-left cell of the selection
            const topLeftCell = selectedCells.reduce((min, cell) => {
                const rowIndex = Array.from(kpiTrackerBody.children).indexOf(cell.parentElement);
                const colIndex = Array.from(cell.parentElement.children).indexOf(cell);
                const minRowIndex = Array.from(kpiTrackerBody.children).indexOf(min.parentElement);
                const minColIndex = Array.from(min.parentElement.children).indexOf(min);
                
                if (rowIndex < minRowIndex || (rowIndex === minRowIndex && colIndex < minColIndex)) {
                    return cell;
                }
                return min;
            });
            
            const startRowIndex = Array.from(kpiTrackerBody.children).indexOf(topLeftCell.parentElement);
            const startColIndex = Array.from(topLeftCell.parentElement.children).indexOf(topLeftCell);
            
            // Paste data starting from the top-left cell
            pasteData.forEach((rowData, rowOffset) => {
                const targetRow = kpiTrackerBody.children[startRowIndex + rowOffset];
                if (!targetRow) return;
                
                rowData.forEach((cellData, colOffset) => {
                    const targetCell = targetRow.children[startColIndex + colOffset];
                    if (targetCell && targetCell.matches('td[contenteditable]')) {
                        targetCell.textContent = cellData;
                    }
                });
            });
            
            // Save changes
            debouncedSaveKpiTracker();
            showNotification('Pasted data to ' + selectedCells.length + ' cells', 'success');
            
        }).catch(err => {
            console.error('Failed to read clipboard:', err);
            showNotification('Failed to paste data', 'error');
        });
    }

    function showNotification(message, type = 'info') {
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

        // SIMPLE KPI TRACKER DATA FUNCTIONS
    function getKpiTrackerData() {
        const header = [];
        const rows = [];
        
        // Get header
        Array.from(kpiTrackerHeaderRow.children).forEach(th => {
            let text = '';
            for (const node of th.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
            }
            header.push(text.trim());
        });
        
        // Get rows
        Array.from(kpiTrackerBody.children).forEach(row => {
            const rowData = [];
            Array.from(row.children).forEach(cell => {
                rowData.push(cell.textContent.trim());
            });
            rows.push(rowData);
        });
        
        // Convert to flat structure for Firebase
        const flatData = { header };
        rows.forEach((rowData, index) => {
            flatData[`row${index}`] = rowData;
        });
        
        return flatData;
    }

    function setKpiTrackerData(data) {
        if (!data || !data.header) return;
        
        // Clear and rebuild header
        kpiTrackerHeaderRow.innerHTML = '';
        data.header.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            kpiTrackerHeaderRow.appendChild(th);
        });
        
        // Clear and rebuild body
        kpiTrackerBody.innerHTML = '';
        
        // Convert flat structure back to rows
        const rows = [];
        let rowIndex = 0;
        while (data[`row${rowIndex}`]) {
            rows.push(data[`row${rowIndex}`]);
            rowIndex++;
        }
        
        rows.forEach(rowData => {
            const tr = document.createElement('tr');
            rowData.forEach((cellText, index) => {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = cellText;
                if (index === 0) td.className = 'kpi-owner';
                tr.appendChild(td);
            });
            kpiTrackerBody.appendChild(tr);
        });
        
        // Re-render delete buttons if in edit mode (with a small delay to ensure DOM is ready)
        setTimeout(() => {
            // Only render delete buttons if we're actually in edit mode
            if (document.body.classList.contains('kpi-edit-mode')) {
                renderDeleteRowButtons();
            }
        }, 10);
    }

    // Enhanced debounced save function for KPI Tracker with visual feedback
    function debouncedSaveKpiTracker() {
        console.log('Debounced save triggered for KPI Tracker');
        if (saveKpiTrackerTimeout) {
            clearTimeout(saveKpiTrackerTimeout);
        }
        
        // Show saving indicator
        const saveIndicator = document.getElementById('kpi-save-indicator');
        if (saveIndicator) {
            saveIndicator.textContent = 'Saving...';
            saveIndicator.style.display = 'inline';
        }
        
        saveKpiTrackerTimeout = setTimeout(async () => {
            try {
                await saveKpiTrackerToFirebase();
                // Show saved indicator
                if (saveIndicator) {
                    saveIndicator.textContent = 'Saved!';
                    setTimeout(() => {
                        saveIndicator.style.display = 'none';
                    }, 2000);
                }
            } catch (error) {
                console.error('Error saving KPI Tracker data:', error);
                if (saveIndicator) {
                    saveIndicator.textContent = 'Error!';
                    setTimeout(() => {
                        saveIndicator.style.display = 'none';
                    }, 3000);
                }
            }
        }, 1000);
    }

    async function saveKpiTrackerToFirebase() {
        try {
            const saveIndicator = document.getElementById('kpi-save-indicator');
            if (saveIndicator) {
                saveIndicator.textContent = 'Saving...';
                saveIndicator.style.display = 'inline';
            }
            
            const data = getKpiTrackerData();
            await setDoc(doc(db, "kpiTracker", "data"), data, { merge: true });
            
            if (saveIndicator) {
                saveIndicator.textContent = 'Saved!';
                setTimeout(() => {
                    saveIndicator.style.display = 'none';
                }, 2000);
            }
        } catch (error) {
            console.error('Error saving KPI Tracker data:', error);
            const saveIndicator = document.getElementById('kpi-save-indicator');
            if (saveIndicator) {
                saveIndicator.textContent = 'Error!';
                saveIndicator.style.color = '#e74c3c';
                setTimeout(() => {
                    saveIndicator.style.display = 'none';
                    saveIndicator.style.color = '#2ecc71';
                }, 3000);
            }
        }
    }

    async function loadKpiTrackerFromFirebase() {
        try {
            const docRef = doc(db, "kpiTracker", "data");
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setKpiTrackerData(data);
            } else {
                // Create default data with flat structure for Firebase
                const defaultData = {
                    header: ['Owner', 'KPI', 'Goal', '6/12', '6/5', '5/29', '5/22', '5/15', '5/8', '5/1', '4/24'],
                    row0: ['Stephen', 'Total Clients', '30', '19', '20', '19', '18', '19', '18', '19', '21'],
                    row1: ['Robby', 'New Client Signed', '1', '1', '0', '1', '0', '0', '0', '0', '0'],
                    row2: ['Robby', 'Meetings Booked', '15', '1', '2', '1', '1', '5', '4', '0', '0'],
                    row3: ['Brandon', 'Clients Managed', '12', '10', '11', '10', '10', '10', '10', '10', '11'],
                    row4: ['Bobby', 'Clients Managed', '12', '9', '9', '9', '8', '9', '8', '9', '9'],
                    row5: ['Noah', 'Pod 1 Unhappy', '0', '2', '1', '1', '2', '2', '1', '2', '2'],
                    row6: ['Noah', 'Pod 2 Unhappy', '0', '0', '0', '1', '0', '1', '0', '1', '0']
                };
                
                await setDoc(doc(db, "kpiTracker", "data"), defaultData, { merge: true });
                setKpiTrackerData(defaultData);
            }
        } catch (error) {
            console.error('Error loading KPI tracker data:', error);
        }
    }



    // --- KPI TRACKER SCROLL ARROWS ---
    const kpiTableScroll = document.getElementById('kpiTableScroll');
    const scrollLeftBtn = document.getElementById('scrollLeftBtn');
    const scrollRightBtn = document.getElementById('scrollRightBtn');
    function updateScrollArrows() {
        if (!kpiTableScroll) return;
        // Show arrows if the content is scrollable
        const scrollable = kpiTableScroll.scrollWidth > kpiTableScroll.clientWidth;
        if (scrollable) {
            scrollLeftBtn.style.display = '';
            scrollRightBtn.style.display = '';
        } else {
            scrollLeftBtn.style.display = 'none';
            scrollRightBtn.style.display = 'none';
        }
    }



    // --- KPI TRACKER DELETE WEEK FUNCTIONALITY ---
    function renderDeleteWeekButtons() {
        if (!kpiTrackerHeaderRow) return;
        
        // Remove all existing delete buttons from week columns
        for (let i = 3; i < kpiTrackerHeaderRow.children.length; i++) {
            const th = kpiTrackerHeaderRow.children[i];
            // Remove all .delete-week-btn elements robustly
            let btns = th.querySelectorAll('.delete-week-btn');
            while (btns.length > 0) {
                btns[0].remove();
                btns = th.querySelectorAll('.delete-week-btn');
            }
        }
        
        // Add a delete button to each week column (after Goal)
        for (let i = 3; i < kpiTrackerHeaderRow.children.length; i++) {
            const th = kpiTrackerHeaderRow.children[i];
            // Only add if not already present
            if (!th.querySelector('.delete-week-btn')) {
                const btn = document.createElement('button');
                btn.className = 'delete-week-btn';
                btn.setAttribute('data-col', i);
                btn.title = 'Delete week';
                btn.innerHTML = '&times;';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteWeekColumn(i);
                });
                th.appendChild(btn);
            }
        }
    }

    // Delete week column function
    async function deleteWeekColumn(colIndex) {
        const weekLabel = kpiTrackerHeaderRow.children[colIndex].textContent.trim();
        if (confirm(`Are you sure you want to delete the week "${weekLabel}"?`)) {
            try {
                // Get current data
                const currentData = getKpiTrackerData();
                
                // Remove the week from header
                currentData.header.splice(colIndex, 1);
                
                // Remove the week data from each row
                let rowIndex = 0;
                while (currentData[`row${rowIndex}`]) {
                    currentData[`row${rowIndex}`].splice(colIndex, 1);
                    rowIndex++;
                }
                
                // Save to Firebase
                await setDoc(doc(db, "kpiTracker", "data"), currentData, { merge: true });
                
                // Rebuild table
                setKpiTrackerData(currentData);
                
                showNotification(`Week "${weekLabel}" deleted successfully`, 'success');
            } catch (error) {
                console.error('Error deleting week:', error);
                showNotification('Error deleting week: ' + error.message, 'error');
            }
        }
    }

    // Delete KPI row function
    async function deleteKpiRow(rowIndex) {
        const row = kpiTrackerBody.children[rowIndex];
        const ownerName = row.children[0].textContent.trim();
        const kpiName = row.children[1].textContent.trim();
        
        if (confirm(`Are you sure you want to delete the KPI "${kpiName}" for "${ownerName}"?`)) {
            try {
                // Get current data
                const currentData = getKpiTrackerData();
                
                // Remove the row by deleting the key and reindexing
                delete currentData[`row${rowIndex}`];
                
                // Reindex remaining rows
                const reindexedData = { header: currentData.header };
                let newIndex = 0;
                let oldIndex = 0;
                while (currentData[`row${oldIndex}`] !== undefined) {
                    if (currentData[`row${oldIndex}`] !== undefined) {
                        reindexedData[`row${newIndex}`] = currentData[`row${oldIndex}`];
                        newIndex++;
                    }
                    oldIndex++;
                }
                
                // Save to Firebase
                await setDoc(doc(db, "kpiTracker", "data"), reindexedData, { merge: true });
                
                // Rebuild table
                setKpiTrackerData(reindexedData);
                
                showNotification(`KPI "${kpiName}" deleted successfully`, 'success');
            } catch (error) {
                console.error('Error deleting KPI row:', error);
                showNotification('Error deleting KPI row: ' + error.message, 'error');
            }
        }
    }

    // Render delete row buttons
    function renderDeleteRowButtons() {
        if (!kpiTrackerBody) return;
        
        // Only show delete buttons if in edit mode
        const isEditMode = document.body.classList.contains('kpi-edit-mode');
        
        // Remove all existing delete row buttons
        const existingButtons = kpiTrackerBody.querySelectorAll('.delete-kpi-row-btn');
        existingButtons.forEach(btn => btn.remove());
        
        // Double-check: Only add delete buttons if in edit mode
        if (!isEditMode) {
            console.log('Not in edit mode, skipping delete button creation');
            return;
        }
        
        console.log('In edit mode, creating delete buttons');
        
        // Only add delete buttons if in edit mode
        if (isEditMode) {
            Array.from(kpiTrackerBody.children).forEach((row, rowIndex) => {
                const firstCell = row.children[0];
                
                // Remove any existing delete buttons first
                const existingBtn = firstCell.querySelector('.delete-kpi-row-btn');
                if (existingBtn) {
                    existingBtn.remove();
                }
                
                // Create new delete button
                const btn = document.createElement('button');
                btn.className = 'delete-kpi-row-btn';
                btn.setAttribute('data-row', rowIndex);
                btn.title = 'Delete row';
                btn.innerHTML = '&times;';
                btn.style.cssText = `
                    background: transparent;
                    border: none;
                    color: #e57373;
                    font-size: 1.1em;
                    opacity: 0.7;
                    cursor: pointer;
                    transition: opacity 0.2s, color 0.2s;
                    vertical-align: middle;
                    padding: 0 2px;
                    margin-left: 4px;
                `;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteKpiRow(rowIndex);
                });
                
                // Add button to the cell
                firstCell.appendChild(btn);
            });
        }
    }

    // --- MONTHLY SPRINTS SECTION - COMPLETELY REWRITTEN ---
    console.log('=== MONTHLY SPRINTS SECTION INITIALIZATION ===');
    
    const sprintsBody = document.getElementById('monthlySprintsBody');
    const addSprintRowBtn = document.getElementById('addSprintRowBtn');
    const editSprintsBtn = document.getElementById('editSprintsBtn');
    const saveSprintsBtn = document.getElementById('saveSprintsBtn');
    
    console.log('Monthly Sprints elements found:', { sprintsBody, addSprintRowBtn, editSprintsBtn, saveSprintsBtn });

    // Simple array to store sprints
    let sprints = [];

    // Initialize sprints functionality
    function initializeSprints() {
        if (!sprintsBody) {
            console.log('Sprints body not found, skipping initialization');
            return;
        }

        console.log('Initializing sprints functionality...');
        attachSprintsEventListeners();
        loadSprintsFromFirebase();
    }

    function attachSprintsEventListeners() {
        console.log('Attaching sprints event listeners...');

        // Edit mode toggle
        if (editSprintsBtn) {
            editSprintsBtn.addEventListener('click', function() {
                document.body.classList.toggle('sprints-edit-mode');
                renderSprintsRowButtons();
            });
        }

        // Add row button
        if (addSprintRowBtn) {
            addSprintRowBtn.addEventListener('click', function() {
                addSprintRow();
            });
        }

        // Auto-save functionality - removed save button, now auto-saves on changes

        // Enhanced auto-save functionality for sprints table
        sprintsBody.addEventListener('input', function(e) {
            if (e.target.matches('[contenteditable]') || e.target.classList.contains('sprint-status')) {
                // Debounced save to prevent too many Firebase calls
                clearTimeout(window.sprintsSaveTimeout);
                window.sprintsSaveTimeout = setTimeout(() => {
                    saveSprintsFromDOM();
                }, 1000);
            }
        }, true);
        
        sprintsBody.addEventListener('change', function(e) {
            if (e.target.classList.contains('sprint-status')) {
                updateSprintStatusColors();
                // Immediate save for status changes
                saveSprintsFromDOM();
            }
        }, true);
        
        // Save on blur for contenteditable cells
        sprintsBody.addEventListener('blur', function(e) {
            if (e.target.matches('[contenteditable]')) {
                saveSprintsFromDOM();
            }
        }, true);
    }

    function addSprintRow() {
        const newSprint = {
            id: `sprint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            owner: '',
            sprint: '',
            due: '',
            status: 'On Track'
        };
        
        sprints.push(newSprint);
        renderSprints();
        saveSprintsToFirebase();
    }

    function renderSprintsRowButtons() {
        if (!sprintsBody) return;
        
        Array.from(sprintsBody.rows).forEach((row, idx) => {
            let cell = row.cells[row.cells.length - 1];
            if (!cell) return;
            
            cell.innerHTML = '';
            if (document.body.classList.contains('sprints-edit-mode')) {
                // Move up button
                const upBtn = document.createElement('button');
                upBtn.className = 'move-sprint-row-btn';
                upBtn.title = 'Move up';
                upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
                upBtn.onclick = function() {
                    if (idx > 0) {
                        const temp = sprints[idx];
                        sprints[idx] = sprints[idx - 1];
                        sprints[idx - 1] = temp;
                        renderSprints();
                        saveSprintsToFirebase();
                    }
                };
                cell.appendChild(upBtn);
                
                // Move down button
                const downBtn = document.createElement('button');
                downBtn.className = 'move-sprint-row-btn';
                downBtn.title = 'Move down';
                downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
                downBtn.onclick = function() {
                    if (idx < sprints.length - 1) {
                        const temp = sprints[idx];
                        sprints[idx] = sprints[idx + 1];
                        sprints[idx + 1] = temp;
                        renderSprints();
                        saveSprintsToFirebase();
                    }
                };
                cell.appendChild(downBtn);
                
                // Delete button
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-sprint-row-btn';
                delBtn.title = 'Delete row';
                delBtn.textContent = '×';
                delBtn.onclick = function() {
                    if (confirm('Are you sure you want to delete this sprint?')) {
                        console.log('Deleting sprint at index:', idx);
                        sprints.splice(idx, 1);
                        renderSprints();
                        saveSprintsToFirebase();
                    }
                };
                cell.appendChild(delBtn);
            }
        });
    }

    function saveSprintsFromDOM() {
        if (!sprintsBody) return;
        
        const rows = sprintsBody.querySelectorAll('tr');
        sprints = [];
        
        rows.forEach((row, index) => {
            const sprintId = row.getAttribute('data-sprint-id');
            const owner = row.children[0]?.textContent.trim() || '';
            const sprint = row.children[1]?.textContent.trim() || '';
            const due = row.children[2]?.textContent.trim() || '';
            const status = row.children[3]?.querySelector('select')?.value || 'On Track';
            
            sprints.push({
                id: sprintId,
                owner: owner,
                sprint: sprint,
                due: due,
                status: status
            });
        });
        
        console.log('Sprints updated from DOM:', sprints);
        
        // Show saving indicator
        const saveIndicator = document.getElementById('sprints-save-indicator');
        if (saveIndicator) {
            saveIndicator.textContent = 'Saving...';
            saveIndicator.style.display = 'inline';
        }
        
        // Save with visual feedback
        saveSprintsToFirebase().then(() => {
            if (saveIndicator) {
                saveIndicator.textContent = 'Saved!';
                setTimeout(() => {
                    saveIndicator.style.display = 'none';
                }, 2000);
            }
        }).catch((error) => {
            console.error('Error saving sprints:', error);
            if (saveIndicator) {
                saveIndicator.textContent = 'Error!';
                setTimeout(() => {
                    saveIndicator.style.display = 'none';
                }, 3000);
            }
        });
    }
    
    function renderSprints() {
        if (!sprintsBody) return;
        
        console.log('Rendering sprints:', sprints);
        sprintsBody.innerHTML = '';
        
        sprints.forEach(sprint => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-sprint-id', sprint.id);
            
            for (let i = 0; i < 3; i++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = sprint[['owner', 'sprint', 'due'][i]] || '';
                tr.appendChild(td);
            }
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'sprint-status';
            ['Complete','On Track','Off Track'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (sprint.status === opt) o.selected = true;
                select.appendChild(o);
            });
            td.appendChild(select);
            tr.appendChild(td);
            // Empty cell for row controls
            tr.appendChild(document.createElement('td'));
            sprintsBody.appendChild(tr);
        });
        
        updateSprintStatusColors();
        renderSprintsRowButtons();
    }
    
    async function saveSprintsToFirebase() {
        try {
            console.log('Saving sprints to Firebase:', sprints);
            isSavingSprints = true;
            await setDoc(doc(db, "monthlySprints", "data"), { 
                sprints: sprints,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('Sprints saved successfully to Firebase');
        } catch (error) {
            console.error("Error saving sprints to Firebase:", error);
        } finally {
            isSavingSprints = false;
        }
    }
    
    async function loadSprintsFromFirebase() {
        try {
            console.log('Loading sprints from Firebase...');
            const docRef = doc(db, "monthlySprints", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().sprints) {
                const firebaseData = docSnap.data().sprints;
                console.log('Firebase data received:', firebaseData);
                
                // Handle both array and object formats
                if (Array.isArray(firebaseData)) {
                    sprints = firebaseData;
                } else {
                    // Convert object format to array
                    sprints = Object.values(firebaseData);
                }
                
                console.log('Processed sprints:', sprints);
                renderSprints();
            } else {
                console.log('No sprints data found in Firebase, starting with empty array');
                sprints = [];
                renderSprints();
            }
        } catch (error) {
            console.error("Error loading sprints from Firebase:", error);
            sprints = [];
            renderSprints();
        }
    }

    // --- MONTHLY SPRINTS STATUS COLOR CODING ---
    function updateSprintStatusColors() {
        document.querySelectorAll('.sprint-status').forEach(select => {
            select.classList.remove('sprint-status-complete', 'sprint-status-ontrack', 'sprint-status-offtrack');
            if (select.value === 'Complete') {
                select.classList.add('sprint-status-complete');
            } else if (select.value === 'On Track') {
                select.classList.add('sprint-status-ontrack');
            } else if (select.value === 'Off Track') {
                select.classList.add('sprint-status-offtrack');
            }
        });
    }

    window.sortSprintsByOwner = async function() {
        try {
            console.log('Manual sort triggered');
            const currentData = getSprintsData();
            const sortedData = sortSprintsByOwner(currentData);
            
            // Save the sorted data
            await setDoc(doc(db, "monthlySprints", "data"), { 
                sprints: sortedData,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            
            // Update the display
            setSprintsData(sortedData);
            alert('Sprints sorted by owner name successfully!');
        } catch (error) {
            console.error('Error during sort:', error);
            alert('Error sorting sprints: ' + error.message);
        }
    };

    window.forceSaveSprints = async function() {
        try {
            console.log('Force save triggered');
            const currentData = getSprintsData();
            console.log('Force saving data:', currentData);
            
            await setDoc(doc(db, "monthlySprints", "data"), { 
                sprints: currentData,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            
            alert('Sprints force saved successfully!');
        } catch (error) {
            console.error('Error during force save:', error);
            alert('Error force saving sprints: ' + error.message);
        }
    };

    window.cleanupSprintsData = async function() {
        if (confirm('This will clean up any duplicate Monthly Sprints data. Continue?')) {
            try {
                console.log('Manual sprints cleanup triggered');
                await loadSprintsFromFirebase(); // This will trigger the cleanup
                alert('Monthly Sprints cleanup completed. Check the console for details.');
            } catch (error) {
                console.error('Error during sprints cleanup:', error);
                alert('Error during cleanup: ' + error.message);
            }
        }
    };

    // --- TO-DO SECTION LOGIC (FIREBASE) ---
    const TODOS_KEY = 'goalsTodos';
    const todoForm = document.getElementById('todoForm');
    const todosTable = document.getElementById('todosTable');
    let todos = [];
    
    async function saveTodosToFirebase() {
        try {
            isSavingTodos = true;
            await setDoc(doc(db, "goalsTodos", "data"), { todos: todos }, { merge: true });
        } catch (error) {
            console.error("Error saving todos to Firebase:", error);
        } finally {
            isSavingTodos = false;
        }
    }
    
    async function loadTodosFromFirebase() {
        try {
            console.log('Loading Todos data from Firebase...');
            const docRef = doc(db, "goalsTodos", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().todos) {
                console.log('Todos data found in Firebase, applying...');
                todos = docSnap.data().todos;
            } else {
                console.log('No Todos data found in Firebase, using empty array');
                todos = [];
            }
        } catch (error) {
            console.error("Error loading todos from Firebase:", error);
            todos = [];
        }
        renderTodos();
    }
    
    function renderTodos() {
        const tbody = todosTable.querySelector('tbody');
        tbody.innerHTML = '';
        todos.forEach((todo, idx) => {
            const row = document.createElement('tr');
            if (todo.completed) row.classList.add('completed-task');
            row.innerHTML = `
                <td>${todo.text}</td>
                <td>${todo.assignee}</td>
                <td>${todo.dueDate}</td>
                <td>
                    <button class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
                    <button class="action-btn complete-btn" ${todo.completed ? 'disabled' : ''}><i class="fas fa-check"></i></button>
                </td>
            `;
            // Edit
            row.querySelector('.edit-btn').addEventListener('click', () => {
                if (row.classList.contains('editing')) return;
                row.classList.add('editing');
                row.children[0].innerHTML = `<input type="text" value="${todo.text}" class="edit-input">`;
                row.children[1].innerHTML = `
                    <select class="edit-input">
                        <option value="Robby" ${todo.assignee === 'Robby' ? 'selected' : ''}>Robby</option>
                        <option value="Greyson" ${todo.assignee === 'Greyson' ? 'selected' : ''}>Greyson</option>
                        <option value="Stephen" ${todo.assignee === 'Stephen' ? 'selected' : ''}>Stephen</option>
                        <option value="Bobby" ${todo.assignee === 'Bobby' ? 'selected' : ''}>Bobby</option>
                        <option value="Brandon" ${todo.assignee === 'Brandon' ? 'selected' : ''}>Brandon</option>
                        <option value="Noah" ${todo.assignee === 'Noah' ? 'selected' : ''}>Noah</option>
                    </select>
                `;
                row.children[2].innerHTML = `<input type="date" value="${todo.dueDate}" class="edit-input">`;
                row.children[3].innerHTML = `<button class="action-btn save-btn"><i class="fas fa-save"></i></button><button class="action-btn cancel-btn"><i class="fas fa-times"></i></button>`;
                // Save
                row.querySelector('.save-btn').addEventListener('click', async () => {
                    const newText = row.children[0].querySelector('input').value.trim();
                    const newAssignee = row.children[1].querySelector('select').value;
                    const newDueDate = row.children[2].querySelector('input').value;
                    if (!newText || !newAssignee || !newDueDate) {
                        alert('Please fill in all fields');
                        return;
                    }
                    todos[idx] = { text: newText, assignee: newAssignee, dueDate: newDueDate, completed: todo.completed };
                    await saveTodosToFirebase();
                    renderTodos();
                });
                // Cancel
                row.querySelector('.cancel-btn').addEventListener('click', () => {
                    renderTodos();
                });
            });
            // Delete
            row.querySelector('.delete-btn').addEventListener('click', async () => {
                todos.splice(idx, 1);
                await saveTodosToFirebase();
                renderTodos();
            });
            // Complete
            row.querySelector('.complete-btn').addEventListener('click', async () => {
                if (!todo.completed) {
                    todos[idx].completed = true;
                    await saveTodosToFirebase();
                    renderTodos();
                }
            });
            tbody.appendChild(row);
        });
    }
    if (todoForm) {
        todoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const text = document.getElementById('todoDescription').value.trim();
            const assignee = document.getElementById('todoAssignee').value;
            const dueDate = document.getElementById('todoDueDate').value;
            if (!text || !assignee || !dueDate) {
                alert('Please fill in all fields');
                return;
            }
            todos.push({ text, assignee, dueDate });
            await saveTodosToFirebase();
            renderTodos();
            todoForm.reset();
        });
    }
    // loadTodosFromFirebase(); // Removed - now handled by initializePage()

    // --- IDS SECTION - RECREATED FROM SCRATCH ---
    console.log('=== IDS SECTION INITIALIZATION ===');
    
    const idsBody = document.getElementById('idsBody');
    const addIdsRowBtn = document.getElementById('addIdsRowBtn');
    const editIdsBtn = document.getElementById('editIdsBtn');
    const saveIdsBtn = document.getElementById('saveIdsBtn');
    
    console.log('IDS elements found:', { idsBody, addIdsRowBtn, editIdsBtn, saveIdsBtn });

    // State management
    let idsData = {};
    let isSavingIds = false;
    let saveIdsTimeout = null;
    let idsEventListenersAttached = false;

    // Initialize IDS functionality
    function initializeIds() {
        if (!idsBody) {
            console.log('IDS body not found, skipping initialization');
            return;
        }

        console.log('Initializing IDS functionality...');
        
        // Attach event listeners only once
        if (!idsEventListenersAttached) {
            attachIdsEventListeners();
            idsEventListenersAttached = true;
        }

        // Load data
        loadIdsData();
    }

    function attachIdsEventListeners() {
        console.log('Attaching IDS event listeners...');
        
        // Add row button
        if (addIdsRowBtn) {
            addIdsRowBtn.addEventListener('click', () => {
                console.log('IDS: Add row button clicked');
                addIdsRow();
            });
            console.log('IDS: Add row button listener added');
        }

        // Auto-save functionality - removed save button, now auto-saves on changes

        // Edit mode toggle
        if (editIdsBtn) {
            editIdsBtn.addEventListener('click', () => {
                console.log('IDS: Edit button clicked');
                document.body.classList.toggle('ids-edit-mode');
                renderIdsTable(); // Re-render to show/hide delete buttons
            });
            console.log('IDS: Edit button listener added');
        }

        // Enhanced auto-save functionality for IDS table
        if (idsBody) {
            idsBody.addEventListener('input', (e) => {
                console.log('IDS: Table input detected');
                if (e.target.matches('input, select, [contenteditable]')) {
                    debouncedSaveIds();
                }
            });
            
            idsBody.addEventListener('change', (e) => {
                console.log('IDS: Table change detected');
                if (e.target.matches('input, select')) {
                    debouncedSaveIds();
                }
            });
            
            // Save on blur for contenteditable cells
            idsBody.addEventListener('blur', (e) => {
                if (e.target.matches('[contenteditable]')) {
                    debouncedSaveIds();
                }
            }, true);
            
            console.log('IDS: Enhanced table event listeners added');
        }
    }

    // Enhanced debounced save function with visual feedback
    function debouncedSaveIds() {
        console.log('Debounced save triggered for IDS');
        if (saveIdsTimeout) {
            clearTimeout(saveIdsTimeout);
        }
        
        // Show saving indicator
        const saveIndicator = document.getElementById('ids-save-indicator');
        if (saveIndicator) {
            saveIndicator.textContent = 'Saving...';
            saveIndicator.style.display = 'inline';
        }
        
        saveIdsTimeout = setTimeout(async () => {
            try {
                await saveIdsData();
                // Show saved indicator
                if (saveIndicator) {
                    saveIndicator.textContent = 'Saved!';
                    setTimeout(() => {
                        saveIndicator.style.display = 'none';
                    }, 2000);
                }
            } catch (error) {
                console.error('Error saving IDS data:', error);
                if (saveIndicator) {
                    saveIndicator.textContent = 'Error!';
                    setTimeout(() => {
                        saveIndicator.style.display = 'none';
                    }, 3000);
                }
            }
        }, 1000);
    }

    // Save individual IDS item
    async function saveIdsItem(itemId, itemData) {
        try {
            console.log(`IDS: Saving item ${itemId}:`, itemData);
            await setDoc(doc(db, "idsData", itemId), {
                ...itemData,
                lastUpdated: new Date().toISOString(),
                updatedBy: localStorage.getItem('userName') || 'Unknown'
            }, { merge: true });
            console.log(`IDS: Item ${itemId} saved successfully`);
            return true;
        } catch (error) {
            console.error(`IDS: Error saving item ${itemId}:`, error);
            return false;
        }
    }

    // Save all IDS data
    async function saveIdsData() {
        if (isSavingIds) {
            console.log('IDS: Save already in progress, skipping...');
            return false;
        }
        
        try {
            isSavingIds = true;
            console.log('IDS: Saving all data...');
            
            // Collect current data from table
            const currentData = collectIdsData();
            
            // Save each item individually
            const savePromises = Object.entries(currentData).map(([itemId, itemData]) => 
                saveIdsItem(itemId, itemData)
            );
            
            const results = await Promise.all(savePromises);
            const success = results.every(result => result);
            
            if (success) {
                console.log('IDS: All data saved successfully');
                return true;
            } else {
                console.error('IDS: Some items failed to save');
                return false;
            }
        } catch (error) {
            console.error('IDS: Save error:', error);
            return false;
        } finally {
            isSavingIds = false;
        }
    }

    // Load IDS data
    async function loadIdsData() {
        try {
            console.log('IDS: Loading data...');
            
            // First, try to load from the new individual document format
            const idsCollection = collection(db, "idsData");
            const querySnapshot = await getDocs(idsCollection);
            
            idsData = {};
            let hasNewFormatData = false;
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Check if this is a new format document (has topic, who, rank fields)
                if (data.topic || data.who || data.rank) {
                    hasNewFormatData = true;
                    idsData[doc.id] = {
                        topic: data.topic || '',
                        who: data.who || '',
                        rank: data.rank || '',
                        type: data.type || 'Discuss',
                        discussed: data.discussed || false,
                        lastUpdated: data.lastUpdated,
                        updatedBy: data.updatedBy
                    };
                }
            });
            
            // If no new format data found, try to migrate from old format
            if (!hasNewFormatData) {
                console.log('IDS: No new format data found, checking for old format...');
                await migrateIdsFromOldFormat();
            }
            
            console.log('IDS: Loaded data:', idsData);
            renderIdsTable();
            
            // Set up real-time listener for changes from other users
            setupIdsRealtimeListener();
        } catch (error) {
            console.error('IDS: Load error:', error);
            idsData = {};
            renderIdsTable();
        }
    }

    // Migrate from old format to new format
    async function migrateIdsFromOldFormat() {
        try {
            console.log('IDS: Attempting migration from old format...');
            
            // Try to load from the old single document format
            const oldDocRef = doc(db, "idsData", "data");
            const oldDocSnap = await getDoc(oldDocRef);
            
            if (oldDocSnap.exists()) {
                const oldData = oldDocSnap.data();
                if (oldData.data && Array.isArray(oldData.data)) {
                    console.log('IDS: Found old format data, migrating...');
                    
                    // Convert old array format to new individual documents
                    for (let i = 0; i < oldData.data.length; i++) {
                        const item = oldData.data[i];
                        if (item && (item.topic || item.who || item.rank)) {
                            const newItemId = `ids_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
                            
                            const newItemData = {
                                topic: item.topic || '',
                                who: item.who || '',
                                rank: item.rank || '',
                                type: item.type || 'Discuss',
                                discussed: item.discussed || false,
                                lastUpdated: new Date().toISOString(),
                                updatedBy: 'Migration'
                            };
                            
                            // Save as new individual document
                            await setDoc(doc(db, "idsData", newItemId), newItemData);
                            
                            // Add to local data
                            idsData[newItemId] = newItemData;
                        }
                    }
                    
                    console.log('IDS: Migration completed successfully');
                    
                    // Optionally, delete the old document
                    // await deleteDoc(oldDocRef);
                }
            }
        } catch (error) {
            console.error('IDS: Migration error:', error);
        }
    }

    // Set up real-time listener for IDS changes
    function setupIdsRealtimeListener() {
        try {
            console.log('IDS: Setting up real-time listener...');
            
            const idsCollection = collection(db, "idsData");
            
            idsListener = onSnapshot(idsCollection, (snapshot) => {
                console.log('IDS: Real-time update received');
                
                // Only update if we're not currently saving
                if (!isSavingIds) {
                    snapshot.docChanges().forEach((change) => {
                        const docId = change.doc.id;
                        const data = change.doc.data();
                        
                        if (change.type === "added" || change.type === "modified") {
                            if (data.topic || data.who || data.rank) {
                                idsData[docId] = {
                                    topic: data.topic || '',
                                    who: data.who || '',
                                    rank: data.rank || '',
                                    type: data.type || 'Discuss',
                                    discussed: data.discussed || false,
                                    lastUpdated: data.lastUpdated,
                                    updatedBy: data.updatedBy
                                };
                            }
                        } else if (change.type === "removed") {
                            delete idsData[docId];
                        }
                    });
                    
                    // Re-render the table with updated data
                    renderIdsTable();
                }
            }, (error) => {
                console.error('IDS: Real-time listener error:', error);
            });
        } catch (error) {
            console.error('IDS: Error setting up real-time listener:', error);
        }
    }



    // Setup Sprints real-time listener
    function setupSprintsRealtimeListener() {
        try {
            console.log('Sprints: Setting up real-time listener...');
            
            const docRef = doc(db, "monthlySprints", "data");
            
            sprintsListener = onSnapshot(docRef, (docSnap) => {
                console.log('Sprints: Real-time update received, isSavingSprints:', isSavingSprints);
                
                // Only update if we're not currently saving
                if (!isSavingSprints) {
                    if (docSnap.exists()) {
                        const firebaseData = docSnap.data();
                        console.log('Sprints: Firebase data received:', firebaseData);
                        
                        sprints = firebaseData.sprints || [];
                        renderSprints();
                        updateSprintStatusColors();
                    }
                } else {
                    console.log('Sprints: Skipping update because currently saving');
                }
            }, (error) => {
                console.error('Sprints: Real-time listener error:', error);
            });
        } catch (error) {
            console.error('Sprints: Error setting up real-time listener:', error);
        }
    }

    // Setup Todos real-time listener
    function setupTodosRealtimeListener() {
        try {
            console.log('Todos: Setting up real-time listener...');
            
            const docRef = doc(db, "goalsTodos", "data");
            
            todosListener = onSnapshot(docRef, (docSnap) => {
                console.log('Todos: Real-time update received, isSavingTodos:', isSavingTodos);
                
                // Only update if we're not currently saving
                if (!isSavingTodos) {
                    if (docSnap.exists()) {
                        const firebaseData = docSnap.data();
                        console.log('Todos: Firebase data received:', firebaseData);
                        
                        todos = firebaseData.todos || [];
                        renderTodos();
                    }
                } else {
                    console.log('Todos: Skipping update because currently saving');
                }
            }, (error) => {
                console.error('Todos: Real-time listener error:', error);
            });
        } catch (error) {
            console.error('Todos: Error setting up real-time listener:', error);
        }
    }

    // Setup all real-time listeners
    function setupRealtimeListeners() {
        console.log('Setting up real-time listeners for all sections...');
        
        // Setup Sprints real-time listener
        setupSprintsRealtimeListener();
        
        // Setup Todos real-time listener
        setupTodosRealtimeListener();
        
        // Setup IDS real-time listener (already exists)
        setupIdsRealtimeListener();
        
        console.log('All real-time listeners setup complete');
    }

    // Render table function
    function renderIdsTable() {
        if (!idsBody) return;
        
        console.log('IDS: Rendering table with data:', idsData);
        idsBody.innerHTML = '';
        
        Object.entries(idsData).forEach(([itemId, item]) => {
            const row = document.createElement('tr');
            row.setAttribute('data-item-id', itemId);
            const isEditMode = document.body.classList.contains('ids-edit-mode');
            row.innerHTML = `
                <td contenteditable="true">${item.topic || ''}</td>
                <td contenteditable="true">${item.who || ''}</td>
                <td contenteditable="true">${item.rank || ''}</td>
                <td>
                    <select class="ids-type-select">
                        <option value="Inform" ${item.type === 'Inform' ? 'selected' : ''}>Inform</option>
                        <option value="Discuss" ${item.type === 'Discuss' ? 'selected' : ''}>Discuss</option>
                        <option value="Solve" ${item.type === 'Solve' ? 'selected' : ''}>Solve</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="ids-discussed" ${item.discussed ? 'checked' : ''}>
                </td>
                <td style="text-align: center;">
                    ${isEditMode ? `<button class="delete-ids-btn" onclick="deleteIdsRow('${itemId}')" title="Delete row"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            `;
            idsBody.appendChild(row);
        });
        
        console.log('IDS: Table rendered with', Object.keys(idsData).length, 'rows');
    }

    // Add row function
    async function addIdsRow() {
        console.log('IDS: Adding new row');
        const itemId = `ids_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newItem = {
            topic: '',
            who: '',
            rank: '',
            type: 'Discuss',
            discussed: false
        };
        
        // Add to local data
        idsData[itemId] = newItem;
        
        // Save to Firebase immediately
        await saveIdsItem(itemId, newItem);
        
        // Update display
        renderIdsTable();
        console.log('IDS: New row added, total rows:', Object.keys(idsData).length);
    }

    // Delete row function
    async function deleteIdsRow(itemId) {
        console.log('IDS: Deleting row:', itemId);
        
        if (confirm('Are you sure you want to delete this IDS item?')) {
            try {
                // Remove from Firebase
                await deleteDoc(doc(db, "idsData", itemId));
                
                // Remove from local data
                delete idsData[itemId];
                
                // Update display
                renderIdsTable();
                console.log('IDS: Row deleted, total rows:', Object.keys(idsData).length);
            } catch (error) {
                console.error('IDS: Error deleting row:', error);
                alert('Error deleting item: ' + error.message);
            }
        }
    }

    // Make deleteIdsRow globally accessible
    window.deleteIdsRow = deleteIdsRow;

    // Collect data from table
    function collectIdsData() {
        console.log('IDS: Collecting data from table...');
        const rows = idsBody.querySelectorAll('tr');
        const newData = {};
        
        rows.forEach((row) => {
            const itemId = row.getAttribute('data-item-id');
            if (!itemId) return;
            
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                newData[itemId] = {
                    topic: cells[0].textContent.trim(),
                    who: cells[1].textContent.trim(),
                    rank: cells[2].textContent.trim(),
                    type: cells[3].querySelector('select').value,
                    discussed: cells[4].querySelector('input').checked
                };
            }
        });
        
        idsData = newData;
        console.log('IDS: Collected data:', idsData);
        return idsData;
    }

    // Initialize IDS on page load
    // initializeIds(); // REMOVED - now handled by initializePage()

    // Add debugging functions for IDS
    window.debugIds = async function() {
        console.log('=== IDS DEBUG INFO ===');
        console.log('Current IDS data:', idsData);
        console.log('Is saving:', isSavingIds);
        console.log('Event listeners attached:', idsEventListenersAttached);
        
        // Check Firebase data
        try {
            const idsCollection = collection(db, "idsData");
            const querySnapshot = await getDocs(idsCollection);
            console.log('Firebase documents count:', querySnapshot.size);
            
            querySnapshot.forEach((doc) => {
                console.log(`Document ${doc.id}:`, doc.data());
            });
        } catch (error) {
            console.error('Error checking Firebase:', error);
        }
    };

    window.migrateIdsData = async function() {
        if (confirm('This will migrate IDS data from old format to new format. Continue?')) {
            try {
                await migrateIdsFromOldFormat();
                alert('Migration completed. Check console for details.');
                location.reload();
            } catch (error) {
                console.error('Migration failed:', error);
                alert('Migration failed: ' + error.message);
            }
        }
    };

    window.clearIdsData = async function() {
        if (confirm('This will clear ALL IDS data. This cannot be undone. Continue?')) {
            try {
                const idsCollection = collection(db, "idsData");
                const querySnapshot = await getDocs(idsCollection);
                
                const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                
                idsData = {};
                renderIdsTable();
                alert('All IDS data cleared.');
            } catch (error) {
                console.error('Error clearing data:', error);
                alert('Error clearing data: ' + error.message);
            }
        }
    };

    // Load all Firebase data
    async function initializePage() {
        try {
            console.log('=== PAGE INITIALIZATION START ===');
            
            // Load data in sequence
            console.log('Loading KPI data...');
            await loadAllKpiData();
            
            console.log('Loading Todos...');
            await loadTodosFromFirebase();
            
            console.log('Initializing IDS...');
            initializeIds();
            
            console.log('Initializing Monthly Sprints...');
            initializeSprints();
            
            console.log('Initializing Revenue Goal Slider...');
            initializeRevenueGoalSlider();
            
            console.log('Initializing Client Goal Slider...');
            initializeClientGoalSlider();
            
            console.log('Initializing New Clients Goal Slider...');
            initializeNewClientsGoalSlider();
            
            console.log('Initializing Google Sheets Integration...');
            initializeGoogleSheets();
            
            // Setup real-time listeners after all data is loaded
            console.log('Setting up real-time listeners...');
            setupRealtimeListeners();
            
            console.log('=== PAGE INITIALIZATION COMPLETE ===');
        } catch (error) {
            console.error('=== PAGE INITIALIZATION ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            alert('There was an error loading the page data. Please try refreshing the page.');
        }
    }
    
    // Initialize presence system FIRST, then initialize page
    async function initializeEverything() {
        try {
            console.log('=== INITIALIZING EVERYTHING ===');
            
            // Initialize the page
            console.log('Initializing page...');
            await initializePage();
            
            console.log('=== EVERYTHING INITIALIZED SUCCESSFULLY ===');
        } catch (error) {
            console.error('Failed to initialize:', error);
            alert('Failed to initialize. Please try refreshing.');
        }
    }

    // Start initialization
    initializeEverything();



    // Add debugging functions for Revenue Goal Slider
    window.debugRevenueGoals = async function() {
        console.log('=== REVENUE GOALS DEBUG INFO ===');
        console.log('Current month:', currentMonth);
        console.log('Current year:', currentYear);
        console.log('Monthly revenue goals:', monthlyRevenueGoals);
        console.log('Current revenue:', getMRR());
        
        // Check Firebase data
        try {
            const docRef = doc(db, "monthlyRevenueGoals", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Firebase monthly revenue goals data:', data);
            } else {
                console.log('No monthly revenue goals data in Firebase');
            }
        } catch (error) {
            console.error('Error checking monthly revenue goals Firebase:', error);
        }
    };

    window.resetRevenueGoals = async function() {
        if (confirm('This will reset all monthly revenue goals to defaults. Continue?')) {
            try {
                monthlyRevenueGoals = { ...defaultMonthlyGoals };
                await saveMonthlyRevenueGoals();
                updateRevenueGoalSlider();
                alert('Monthly revenue goals reset to defaults.');
            } catch (error) {
                console.error('Error resetting revenue goals:', error);
                alert('Error resetting goals: ' + error.message);
            }
        }
    };

    window.clearRevenueGoals = async function() {
        if (confirm('This will clear ALL monthly revenue goals data. This cannot be undone. Continue?')) {
            try {
                await setDoc(doc(db, "monthlyRevenueGoals", "data"), { 
                    goals: {},
                    lastUpdated: new Date().toISOString()
                });
                
                monthlyRevenueGoals = {};
                updateRevenueGoalSlider();
                alert('All monthly revenue goals data cleared.');
                location.reload();
            } catch (error) {
                console.error('Error clearing monthly revenue goals data:', error);
                alert('Error clearing data: ' + error.message);
            }
        }
    };

    // Add debugging functions for Client Goal Slider
    window.debugClientGoals = async function() {
        console.log('=== CLIENT GOALS DEBUG INFO ===');
        console.log('Current month:', currentMonth);
        console.log('Current year:', currentYear);
        console.log('Monthly client goals:', monthlyClientGoals);
        console.log('Current clients:', document.getElementById('activeClientsValue')?.textContent);
        
        // Check Firebase data
        try {
            const docRef = doc(db, "monthlyClientGoals", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Firebase monthly client goals data:', data);
            } else {
                console.log('No monthly client goals data in Firebase');
            }
        } catch (error) {
            console.error('Error checking monthly client goals Firebase:', error);
        }
    };

    window.resetClientGoals = async function() {
        if (confirm('This will reset all monthly client goals to defaults. Continue?')) {
            try {
                monthlyClientGoals = { ...defaultMonthlyClientGoals };
                await saveMonthlyClientGoals();
                updateClientGoalSlider();
                alert('Monthly client goals reset to defaults.');
            } catch (error) {
                console.error('Error resetting client goals:', error);
                alert('Error resetting goals: ' + error.message);
            }
        }
    };

    window.clearClientGoals = async function() {
        if (confirm('This will clear ALL monthly client goals data. This cannot be undone. Continue?')) {
            try {
                await setDoc(doc(db, "monthlyClientGoals", "data"), { 
                    goals: {},
                    lastUpdated: new Date().toISOString()
                });
                
                monthlyClientGoals = {};
                updateClientGoalSlider();
                alert('All monthly client goals data cleared.');
                location.reload();
            } catch (error) {
                console.error('Error clearing monthly client goals data:', error);
                alert('Error clearing data: ' + error.message);
            }
        }
    };

    // Add debugging functions for New Clients Goal Slider
    window.debugNewClientsGoals = async function() {
        console.log('=== NEW CLIENTS GOALS DEBUG INFO ===');
        console.log('Current month:', currentMonth);
        console.log('Current year:', currentYear);
        console.log('Monthly new clients goals:', monthlyNewClientsGoals);
        console.log('Current new clients:', document.getElementById('clientsClosedValue')?.textContent);
        
        // Check Firebase data
        try {
            const docRef = doc(db, "monthlyNewClientsData", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Firebase monthly new clients data:', data);
            } else {
                console.log('No monthly new clients data in Firebase');
            }
        } catch (error) {
            console.error('Error checking monthly new clients Firebase:', error);
        }
    };

    window.resetNewClientsGoals = async function() {
        if (confirm('This will reset all monthly new clients goals to defaults. Continue?')) {
            try {
                monthlyNewClientsGoals = { ...defaultMonthlyNewClientsGoals };
                monthlyNewClientsActuals = { ...defaultMonthlyNewClientsActuals };
                await saveMonthlyNewClientsData();
                updateNewClientsGoalSlider();
                alert('Monthly new clients goals reset to defaults.');
            } catch (error) {
                console.error('Error resetting new clients goals:', error);
                alert('Error resetting goals: ' + error.message);
            }
        }
    };

    window.clearNewClientsGoals = async function() {
        if (confirm('This will clear ALL monthly new clients goals data. This cannot be undone. Continue?')) {
            try {
                await setDoc(doc(db, "monthlyNewClientsData", "data"), { 
                    goals: {},
                    actuals: {},
                    lastUpdated: new Date().toISOString()
                });
                
                monthlyNewClientsGoals = {};
                monthlyNewClientsActuals = {};
                updateNewClientsGoalSlider();
                alert('All monthly new clients goals data cleared.');
                location.reload();
            } catch (error) {
                console.error('Error clearing monthly new clients goals data:', error);
                alert('Error clearing data: ' + error.message);
            }
        }
    };

    // Firebase functions for monthly new clients goals and actuals
    async function saveMonthlyNewClientsData() {
        try {
            console.log('Saving monthly new clients data to Firebase:', { goals: monthlyNewClientsGoals, actuals: monthlyNewClientsActuals });
            await setDoc(doc(db, "monthlyNewClientsData", "data"), { 
                goals: monthlyNewClientsGoals,
                actuals: monthlyNewClientsActuals,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('Monthly new clients data saved successfully to Firebase');
        } catch (error) {
            console.error("Error saving monthly new clients data to Firebase:", error);
        }
    }
    
    async function loadMonthlyNewClientsData() {
        try {
            console.log('Loading monthly new clients data from Firebase...');
            const docRef = doc(db, "monthlyNewClientsData", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Monthly new clients data found in Firebase, applying...');
                monthlyNewClientsGoals = data.goals || { ...defaultMonthlyNewClientsGoals };
                monthlyNewClientsActuals = data.actuals || { ...defaultMonthlyNewClientsActuals };
            } else {
                console.log('No monthly new clients data found in Firebase, using defaults...');
                monthlyNewClientsGoals = { ...defaultMonthlyNewClientsGoals };
                monthlyNewClientsActuals = { ...defaultMonthlyNewClientsActuals };
                // Save default data to Firebase
                await saveMonthlyNewClientsData();
            }
        } catch (error) {
            console.error("Error loading monthly new clients data from Firebase:", error);
            monthlyNewClientsGoals = { ...defaultMonthlyNewClientsGoals };
            monthlyNewClientsActuals = { ...defaultMonthlyNewClientsActuals };
        }
        updateNewClientsGoalSlider();
    }

    // Update new clients goal slider
    function updateNewClientsGoalSlider() {
        // Get the current value from the large number above the slider
        const clientsClosedValueEl = document.getElementById('clientsClosedValue');
        let currentValue = 0;
        if (clientsClosedValueEl) {
            let val = clientsClosedValueEl.textContent.trim();
            val = val.replace(/[,\s]/g, '');
            currentValue = parseFloat(val) || 0;
        }
        
        // Get the current month's goal from monthly goals data
        let goalValue = 0;
        if (typeof monthlyNewClientsGoals !== 'undefined' && typeof currentMonth !== 'undefined') {
            goalValue = monthlyNewClientsGoals[currentMonth] || defaultMonthlyNewClientsGoals[currentMonth];
        }
        
        // Fallback to 1 to avoid division by zero
        if (!goalValue) goalValue = 1;
        const progress = Math.min((currentValue / goalValue) * 100, 100);
        
        // Update slider fill and thumb
        const sliderFill = document.getElementById('newClientsSliderFill');
        const sliderThumb = document.getElementById('newClientsSliderThumb');
        if (sliderFill) sliderFill.style.width = `${progress}%`;
        if (sliderThumb) sliderThumb.style.left = `${progress}%`;
        
        // Update slider colors based on progress
        if (sliderFill) {
            if (progress >= 100) {
                sliderFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            } else if (progress >= 80) {
                sliderFill.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
            } else {
                sliderFill.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
            }
        }
        
        // Always update the goal label with current month's goal
        const currentGoalLabel = document.getElementById('currentNewClientsGoalLabel');
        if (currentGoalLabel) {
            currentGoalLabel.textContent = `Goal: ${goalValue}`;
        }
        
        // Update the month label
        const currentMonthLabel = document.getElementById('currentNewClientsMonthLabel');
        if (currentMonthLabel) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthLabel.textContent = monthNames[currentMonth];
        }
    }
    
    // Initialize new clients goal slider
    function initializeNewClientsGoalSlider() {
        console.log('Initializing new clients goal slider...');
        
        // Load monthly goals
        loadMonthlyNewClientsData();
        
        // Add click event to slider to open modal
        const newClientsGoalSlider = document.getElementById('newClientsGoalSlider');
        if (newClientsGoalSlider) {
            newClientsGoalSlider.addEventListener('click', () => {
                openNewClientsGoalsModal();
            });
        }
        
        // Set up modal functionality
        setupNewClientsGoalsModal();
    }
    
    // New Clients Goals Modal functionality
    function setupNewClientsGoalsModal() {
        const newClientsGoalsModal = document.getElementById('newClientsGoalsModal');
        const closeNewClientsGoalsModal = document.getElementById('closeNewClientsGoalsModal');
        const closeNewClientsGoalsBtn = document.getElementById('closeNewClientsGoalsBtn');
        const saveNewClientsGoalsBtn = document.getElementById('saveNewClientsGoalsBtn');
        
        // Close modal functions
        function closeNewClientsGoalsModalFunc() {
            newClientsGoalsModal.style.display = 'none';
        }
        
        // Close modal when clicking X
        if (closeNewClientsGoalsModal) {
            closeNewClientsGoalsModal.onclick = closeNewClientsGoalsModalFunc;
        }
        
        // Close modal when clicking close button
        if (closeNewClientsGoalsBtn) {
            closeNewClientsGoalsBtn.onclick = closeNewClientsGoalsModalFunc;
        }
        
        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === newClientsGoalsModal) {
                closeNewClientsGoalsModalFunc();
            }
            if (event.target === modal) {
                modal.style.display = 'none';
            }
            if (event.target === commentModal) {
                closeCommentModalFunc();
            }
            if (event.target === revenueGoalsModal) {
                closeRevenueGoalsModalFunc();
            }
            if (event.target === clientGoalsModal) {
                closeClientGoalsModalFunc();
            }
        };
        
        // Save button functionality
        if (saveNewClientsGoalsBtn) {
            saveNewClientsGoalsBtn.addEventListener('click', async () => {
                console.log('Saving all new clients goals and actuals...');
                
                // Collect all goal and actual values from inputs
                const goalInputs = document.querySelectorAll('#newClientsGoalsGrid .goal-input');
                const actualInputs = document.querySelectorAll('#newClientsGoalsGrid .actual-input');
                
                goalInputs.forEach(input => {
                    const monthIndex = parseInt(input.getAttribute('data-month'));
                    let value = input.value.trim();
                    
                    // Parse the value properly
                    value = parseInt(value.replace(/[,\s]/g, '')) || 0;
                    
                    monthlyNewClientsGoals[monthIndex] = value;
                });
                
                actualInputs.forEach(input => {
                    const monthIndex = parseInt(input.getAttribute('data-month'));
                    let value = input.value.trim();
                    
                    // Parse the value properly
                    value = parseInt(value.replace(/[,\s]/g, '')) || 0;
                    
                    monthlyNewClientsActuals[monthIndex] = value;
                });
                
                // Save to Firebase
                await saveMonthlyNewClientsData();
                
                // Update slider and goal labels
                updateNewClientsGoalSlider();
                
                // Visual feedback
                const originalText = saveNewClientsGoalsBtn.textContent;
                saveNewClientsGoalsBtn.textContent = 'Saved!';
                saveNewClientsGoalsBtn.style.background = '#27ae60';
                setTimeout(() => {
                    saveNewClientsGoalsBtn.textContent = originalText;
                    saveNewClientsGoalsBtn.style.background = '#4285f4';
                }, 2000);
            });
        }
    }
    
    // Open new clients goals modal
    function openNewClientsGoalsModal() {
        console.log('Opening new clients goals modal...');
        console.log('Current new clients goals data:', monthlyNewClientsGoals);
        console.log('Current new clients actuals data:', monthlyNewClientsActuals);
        
        const newClientsGoalsModal = document.getElementById('newClientsGoalsModal');
        const newClientsGoalsGrid = document.getElementById('newClientsGoalsGrid');
        
        if (!newClientsGoalsModal || !newClientsGoalsGrid) return;
        
        // Populate the grid with monthly goals
        newClientsGoalsGrid.innerHTML = '';
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        for (let i = 0; i < 12; i++) {
            const goal = monthlyNewClientsGoals[i] || defaultMonthlyNewClientsGoals[i];
            const actual = monthlyNewClientsActuals[i] || defaultMonthlyNewClientsActuals[i];
            const isCurrentMonth = i === currentMonth;
            const isPastMonth = i < currentMonth;
            const isFutureMonth = i > currentMonth;
            
            // Determine card class
            let cardClass = 'monthly-goal-card';
            if (isCurrentMonth) cardClass += ' current-month';
            else if (isPastMonth) cardClass += ' completed';
            else if (isFutureMonth) cardClass += ' future';
            
            // Determine status
            let status = '';
            if (isCurrentMonth) {
                const progress = Math.min((actual / goal) * 100, 100);
                if (progress >= 100) {
                    status = '✅ Goal Met!';
                } else if (progress >= 80) {
                    status = '🟡 On Track';
                } else {
                    status = '🔴 Behind';
                }
            } else if (isPastMonth) {
                status = '✅ Completed';
            } else {
                status = '⏳ Upcoming';
            }
            
            const card = document.createElement('div');
            card.className = cardClass;
            card.innerHTML = `
                <div class="month-header">${monthNames[i]}</div>
                <div class="input-row">
                    <div class="goal-label">Goal</div>
                    <input type="text" class="goal-input" value="${goal}" data-month="${i}" data-type="goal">
                </div>
                <div class="input-row">
                    <div class="actual-label">Actual</div>
                    <input type="text" class="actual-input" value="${actual}" data-month="${i}" data-type="actual">
                </div>
                <div class="goal-status">${status}</div>
            `;
            
            newClientsGoalsGrid.appendChild(card);
        }
        
        // Update summary
        updateNewClientsGoalsSummary();
        
        // Show modal
        newClientsGoalsModal.style.display = 'block';
    }
    
    // Update new clients goals summary
    function updateNewClientsGoalsSummary() {
        const currentMonthSummary = document.getElementById('currentNewClientsMonthSummary');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (currentMonthSummary) {
            currentMonthSummary.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
        // Calculate current month stats
        const currentGoal = monthlyNewClientsGoals[currentMonth] || defaultMonthlyNewClientsGoals[currentMonth];
        const currentActual = monthlyNewClientsActuals[currentMonth] || defaultMonthlyNewClientsActuals[currentMonth];
        const currentProgress = Math.min((currentActual / currentGoal) * 100, 100);
        
        // Calculate YTD stats
        let ytdGoalTotal = 0;
        let ytdActualTotal = 0;
        
        for (let i = 0; i <= currentMonth; i++) {
            ytdGoalTotal += monthlyNewClientsGoals[i] || defaultMonthlyNewClientsGoals[i];
            ytdActualTotal += monthlyNewClientsActuals[i] || defaultMonthlyNewClientsActuals[i];
        }
        
        const ytdProgress = Math.min((ytdActualTotal / ytdGoalTotal) * 100, 100);
        
        // Update summary elements if they exist
        const summaryElements = document.querySelectorAll('#newClientsGoalsGrid .summary-item');
        summaryElements.forEach(element => {
            const label = element.querySelector('.summary-label');
            const value = element.querySelector('.summary-value');
            
            if (label && value) {
                switch (label.textContent) {
                    case 'Current Month Goal:':
                        value.textContent = currentGoal;
                        break;
                    case 'Current Month Actual:':
                        value.textContent = currentActual;
                        break;
                    case 'Current Month Progress:':
                        value.textContent = `${currentProgress.toFixed(1)}%`;
                        break;
                    case 'YTD Goal:':
                        value.textContent = ytdGoalTotal;
                        break;
                    case 'YTD Actual:':
                        value.textContent = ytdActualTotal;
                        break;
                    case 'YTD Progress:':
                        value.textContent = `${ytdProgress.toFixed(1)}%`;
                        break;
                }
            }
        });
    }
    
    // Google Sheets Integration Functions
    function initializeGoogleSheets() {
        console.log('Initializing Google Sheets integration...');
        
        // Attach event listeners
        attachSheetsEventListeners();
    }
    
    function attachSheetsEventListeners() {
        // Refresh button
        const refreshSheetsBtn = document.getElementById('refreshSheetsBtn');
        const openInNewTabBtn = document.getElementById('openInNewTabBtn');
        
        if (refreshSheetsBtn) {
            refreshSheetsBtn.addEventListener('click', refreshSheetsEmbed);
        }
        
        if (openInNewTabBtn) {
            openInNewTabBtn.addEventListener('click', openSheetsInNewTab);
        }
    }
    
    function refreshSheetsEmbed() {
        const sheetsEmbed = document.getElementById('sheetsEmbed');
        const refreshBtn = document.getElementById('refreshSheetsBtn');
        const originalText = refreshBtn.innerHTML;
        
        if (sheetsEmbed) {
            // Show loading state
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
            
            // Add timestamp to force refresh
            const currentSrc = sheetsEmbed.src;
            const separator = currentSrc.includes('?') ? '&' : '?';
            sheetsEmbed.src = currentSrc + separator + 't=' + Date.now();
            
            // Reset button after a short delay
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
                showNotification('Google Sheet refreshed successfully!', 'success');
            }, 1000);
        }
    }
    
    function openSheetsInNewTab() {
        const sheetsUrl = 'https://docs.google.com/spreadsheets/d/1HnrcogN1Ec6qo4g-yTki7KRwk5Qo-CYOJPDCuec1Gns/edit?usp=sharing';
        window.open(sheetsUrl, '_blank');
    }
    
    // Good News Timer Functionality
    class GoodNewsTimer {
        constructor() {
            this.teamMembers = ['Robby', 'Moe', 'Bobby', 'Brandon', 'Stephen', 'Noah'];
            this.currentPerson = null;
            this.timerInterval = null;
            this.timeLeft = 90; // 90 seconds
            this.isRunning = false;
            this.usedThisRound = []; // Track who has been selected this round
            
            this.modal = document.getElementById('goodNewsTimerModal');
            this.namesDisplay = document.getElementById('namesDisplay');
            this.spinBtn = document.getElementById('spinWheelBtn');
            this.skipBtn = document.getElementById('skipPersonBtn');
            this.nextBtn = document.getElementById('nextPersonBtn');
            this.currentPersonDisplay = document.getElementById('currentPerson');
            this.timerDisplay = document.getElementById('timerDisplayLarge');
            this.openBtn = document.getElementById('openGoodNewsModal');
            this.closeBtn = document.getElementById('closeGoodNewsTimerModal');
            
            this.init();
        }
        
        init() {
            // Event listeners
            this.openBtn.addEventListener('click', () => this.openModal());
            this.closeBtn.addEventListener('click', () => this.closeModal());
            this.spinBtn.addEventListener('click', () => this.spinWheel());
            this.skipBtn.addEventListener('click', () => this.skipPerson());
            this.nextBtn.addEventListener('click', () => this.nextPerson());
            
            // Close modal when clicking outside
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
            
            // Initialize display
            this.updateDisplay();
            this.updateNextButton();
        }
        
        openModal() {
            this.modal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
        
        closeModal() {
            this.modal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
            this.endTimer(false); // Stop timer if running, but don't play sound
            this.usedThisRound = []; // Reset the round when modal is closed
            this.updateNextButton();
            this.resetNameHighlights();
        }
        
        resetNameHighlights() {
            const nameItems = this.namesDisplay.querySelectorAll('.name-item');
            nameItems.forEach(item => {
                item.classList.remove('highlighted', 'selected');
            });
        }
        
        spinWheel() {
            if (this.isRunning) return;
            
            this.spinBtn.disabled = true;
            this.spinBtn.textContent = 'Spinning...';
            
            // Get next available person (not yet selected this round)
            const availablePeople = this.teamMembers.filter(person => !this.usedThisRound.includes(person));
            
            // If all people have been used, reset the round
            if (availablePeople.length === 0) {
                this.usedThisRound = [];
                availablePeople.push(...this.teamMembers);
                this.updateNextButton();
            }
            
            // Select a random person from available people
            const selectedPerson = availablePeople[Math.floor(Math.random() * availablePeople.length)];
            
            console.log(`Selected: ${selectedPerson}`);
            
            // Start cycling animation
            this.cycleThroughNames(selectedPerson);
        }
        
        cycleThroughNames(selectedPerson) {
            const nameItems = this.namesDisplay.querySelectorAll('.name-item');
            const totalCycles = 1.5 + Math.random() * 1; // 1.5-2.5 full cycles
            const totalItems = nameItems.length;
            const totalSteps = Math.floor(totalCycles * totalItems) + Math.random() * totalItems;
            
            let currentStep = 0;
            const cycleInterval = setInterval(() => {
                // Remove previous highlights
                nameItems.forEach(item => {
                    item.classList.remove('highlighted');
                });
                
                // Highlight current item
                const currentIndex = currentStep % totalItems;
                nameItems[currentIndex].classList.add('highlighted');
                
                currentStep++;
                
                // Check if we should stop
                if (currentStep >= totalSteps) {
                    clearInterval(cycleInterval);
                    
                    // Find the selected person's element and highlight it
                    const selectedElement = Array.from(nameItems).find(item => 
                        item.getAttribute('data-person') === selectedPerson
                    );
                    
                    // Remove all highlights
                    nameItems.forEach(item => {
                        item.classList.remove('highlighted');
                    });
                    
                    // Highlight the selected person
                    if (selectedElement) {
                        selectedElement.classList.add('selected');
                    }
                    
                    // Set the selected person
                    this.currentPerson = selectedPerson;
                    this.usedThisRound.push(selectedPerson);
                    
                    this.startTimer();
                    this.updateDisplay();
                    this.updateNextButton();
                    
                    this.spinBtn.disabled = false;
                    this.spinBtn.textContent = 'Pick Again';
                }
            }, 100); // Change every 100ms for faster cycling
        }
        
        startTimer() {
            this.timeLeft = 90;
            this.isRunning = true;
            this.skipBtn.disabled = false;
            
            this.timerInterval = setInterval(() => {
                this.timeLeft--;
                this.updateTimerDisplay();
                
                if (this.timeLeft <= 0) {
                    this.endTimer();
                }
            }, 1000);
        }
        
        endTimer(playSound = true) {
            this.isRunning = false;
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            this.skipBtn.disabled = true;
            this.currentPerson = null;
            this.timeLeft = 90;
            this.updateDisplay();
            this.resetNameHighlights();
            
            // Only play notification sound if timer expired naturally
            if (playSound) {
                this.playNotificationSound();
            }
        }
        
        skipPerson() {
            if (!this.isRunning) return;
            
            this.endTimer(false); // Don't play sound when skipping
            this.spinBtn.textContent = 'Pick Person';
        }
        
        nextPerson() {
            // End current timer if running
            if (this.isRunning) {
                this.endTimer(false); // Don't play sound when moving to next person
            }
            
            // Move to next person in sequence
            this.spinWheel();
        }
        
        updateNextButton() {
            const availablePeople = this.teamMembers.filter(person => !this.usedThisRound.includes(person));
            
            if (availablePeople.length > 0) {
                this.nextBtn.disabled = false;
                this.nextBtn.textContent = `Next Person (${availablePeople.length} left)`;
            } else {
                this.nextBtn.disabled = true;
                this.nextBtn.textContent = 'All Done!';
            }
        }
        
        updateDisplay() {
            if (this.currentPerson && this.isRunning) {
                this.currentPersonDisplay.textContent = `${this.currentPerson}'s Turn`;
                this.updateTimerDisplay();
            } else {
                this.currentPersonDisplay.textContent = 'Ready to Pick!';
                this.timerDisplay.textContent = '1:30';
                this.timerDisplay.style.color = '#fff';
            }
        }
        
        updateTimerDisplay() {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            this.timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Change color when time is running low
            if (this.timeLeft <= 10) {
                this.timerDisplay.style.color = '#ff6b6b';
            } else if (this.timeLeft <= 30) {
                this.timerDisplay.style.color = '#ffa726';
            } else {
                this.timerDisplay.style.color = '#fff';
            }
        }
        
        playNotificationSound() {
            // Play a simple beep sound
            try {
                // Create a simple beep using Web Audio API
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz frequency
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5); // 0.5 second beep
            } catch (e) {
                console.log('Could not play beep sound:', e);
            }
        }
    }
    
    // Initialize Good News Timer when DOM is loaded
    let goodNewsTimer;
    setTimeout(() => {
        if (document.getElementById('openGoodNewsModal')) {
            goodNewsTimer = new GoodNewsTimer();
            console.log('Good News Timer initialized');
        }
    }, 1000);

    // TEST SCRIPT COMPLETION
    console.log('=== GOALS.JS LOADING COMPLETE ===');
}); 