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
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('=== GOALS.JS LOADING ===');
console.log('Firebase imports loaded');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo",
    authDomain: "coretrex-internal-dashboard.firebaseapp.com",
    projectId: "coretrex-internal-dashboard",
    storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
    messagingSenderId: "16273988237",
    appId: "1:16273988237:web:956c63742712c22185e0c4"
};

console.log('Firebase config loaded');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase initialized');

// Global flags
let isIdsLoading = false;

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
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM CONTENT LOADED ===');
    console.log('Page: goals.html');
    console.log('DOM fully loaded and parsed');
    
    // PAGE GUARD
    console.log('Checking page access...');
    if (!hasPageAccess('goals')) {
        console.error('Access denied - no permission for goals page');
        alert('Access denied. You do not have permission to view this page.');
        window.location.href = 'index.html';
        return;
    }
    console.log('Page access granted');

    // Check authentication using the correct localStorage key
    console.log('Checking authentication...');
    if (!localStorage.getItem('isLoggedIn')) {
        console.error('Not logged in - redirecting to login');
        window.location.href = 'index.html';
        return;
    }
    console.log('Authentication verified');

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
        const startMRR = 75000;
        const targetMRR = 120000;
        const currentMRR = getMRR();
        const progress = ((currentMRR - startMRR) / (targetMRR - startMRR)) * 100;
        const thermometerProgress = document.querySelector('.thermometer-progress');
        if (thermometerProgress) {
            thermometerProgress.style.width = `${progress}%`;
        }
        if (mrrValueSpan) mrrValueSpan.textContent = formatMRR(currentMRR);
        // --- MILESTONE GLOW LOGIC ---
        const milestones = [
            { value: 94000, selector: '[data-milestone="94k"] .milestone-icon', color: '#2979ff' },
            { value: 100000, selector: '[data-milestone="100k"] .milestone-icon', color: '#2979ff' },
            { value: 110000, selector: '[data-milestone="110k"] .milestone-icon', color: '#f39c12' },
            { value: 115000, selector: '[data-milestone="115k"] .milestone-icon', color: '#2ecc71' },
            { value: 120000, selector: '[data-milestone="120k"] .milestone-icon', color: '#2ecc71' }
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
        '94k': {
            title: '$94K MRR - Projected MRR Start',
            details: 'Starting point for our growth journey (May)'
        },
        '100k': {
            title: '$100K MRR - Team Celebration + Merch',
            details: 'Team Celebration with Branded Merchandise:\n• Journals\n• Shirts\n• Hats\n• Mugs'
        },
        '110k': {
            title: '$110K MRR - Major Perks Unlock',
            details: 'Comprehensive Benefits Package:\n• Private Brand Product Launch\n• MacBook Pro Transition\n• 401k for All Employees'
        },
        '115k': {
            title: '$115K MRR - Team Expansion',
            details: 'New Hire to Expand Team'
        },
        '120k': {
            title: '$120K MRR - Ultimate Team Experience',
            details: 'Team Retreat + H4L Giveaway'
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
                    }
                    return;
                }
                valueEl.textContent = newValue;
                await saveKpiToFirebase(kpi, newValue);
                if (kpi === 'revenue') {
                    revenueValueEl.textContent = newValue;
                    updateThermometer();
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
        const currentGoal = monthlyRevenueGoals[currentMonth] || defaultMonthlyGoals[currentMonth];
        const currentActual = monthlyRevenueActuals[currentMonth] || defaultMonthlyActuals[currentMonth];
        const progress = Math.min((currentActual / currentGoal) * 100, 100);
        
        // Update slider fill and thumb
        const sliderFill = document.getElementById('sliderFill');
        const sliderThumb = document.getElementById('sliderThumb');
        const currentGoalLabel = document.getElementById('currentGoalLabel');
        const currentMonthLabel = document.getElementById('currentMonthLabel');
        
        if (sliderFill) sliderFill.style.width = `${progress}%`;
        if (sliderThumb) sliderThumb.style.left = `${progress}%`;
        if (currentGoalLabel) currentGoalLabel.textContent = `Goal: ${formatMRR(currentGoal)}`;
        if (currentMonthLabel) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
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
                
                // Update slider
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
        const currentGoal = monthlyClientGoals[currentMonth] || defaultMonthlyClientGoals[currentMonth];
        const currentActual = monthlyClientActuals[currentMonth] || defaultMonthlyClientActuals[currentMonth];
        const progress = Math.min((currentActual / currentGoal) * 100, 100);
        
        // Update slider fill and thumb
        const sliderFill = document.getElementById('clientSliderFill');
        const sliderThumb = document.getElementById('clientSliderThumb');
        const currentGoalLabel = document.getElementById('currentClientGoalLabel');
        const currentMonthLabel = document.getElementById('currentClientMonthLabel');
        
        if (sliderFill) sliderFill.style.width = `${progress}%`;
        if (sliderThumb) sliderThumb.style.left = `${progress}%`;
        if (currentGoalLabel) currentGoalLabel.textContent = `Goal: ${currentGoal}`;
        if (currentMonthLabel) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
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
                
                // Update slider
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

    // --- KPI TRACKER TABLE PERSISTENCE (HEADER + BODY) ---
    const KPI_TRACKER_KEY = 'kpiTrackerData';
    const kpiTrackerTable = document.getElementById('kpiTrackerTable');
    const kpiTrackerBody = document.getElementById('kpiTrackerBody');
    const kpiTrackerHeaderRow = document.getElementById('kpiTrackerHeaderRow');

    // State management for KPI Tracker
    let isSavingKpiTracker = false;
    let saveKpiTrackerTimeout = null;
    let kpiTrackerEventListenersAttached = false;

    // Initialize KPI Tracker functionality
    function initializeKpiTracker() {
        if (!kpiTrackerBody) {
            console.log('KPI Tracker body not found, skipping initialization');
            return;
        }

        console.log('Initializing KPI Tracker functionality...');
        
        // Attach event listeners only once
        if (!kpiTrackerEventListenersAttached) {
            attachKpiTrackerEventListeners();
            kpiTrackerEventListenersAttached = true;
        }

        // Load data
        loadKpiTrackerFromFirebase();
    }

    function attachKpiTrackerEventListeners() {
        console.log('Attaching KPI Tracker event listeners...');
        
        // Single event listener for all KPI Tracker changes
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
        }

        // Add week button
        const addWeekBtn = document.getElementById('addWeekBtn');
        if (addWeekBtn && kpiTrackerHeaderRow && kpiTrackerBody) {
            addWeekBtn.addEventListener('click', () => {
                let weekLabel = prompt('Enter new week label (e.g., 6/19):');
                if (!weekLabel) return;
                // Insert new header cell after Goal (index 2)
                const th = document.createElement('th');
                th.textContent = weekLabel;
                kpiTrackerHeaderRow.insertBefore(th, kpiTrackerHeaderRow.children[3]);
                // Insert new editable cell for each row after Goal
                Array.from(kpiTrackerBody.children).forEach(row => {
                    const td = document.createElement('td');
                    td.contentEditable = 'true';
                    td.textContent = '';
                    row.insertBefore(td, row.children[3]);
                });
                saveKpiTrackerToFirebase();
                updateScrollArrows();
                renderDeleteWeekButtons();
            });
        }

        // Add row button
        const addKpiRowBtn = document.getElementById('addKpiRowBtn');
        if (addKpiRowBtn && kpiTrackerHeaderRow && kpiTrackerBody) {
            addKpiRowBtn.addEventListener('click', () => {
                // Create new row
                const newRow = document.createElement('tr');
                
                // Add cells for each column in the header
                for (let i = 0; i < kpiTrackerHeaderRow.children.length; i++) {
                    const td = document.createElement('td');
                    td.contentEditable = 'true';
                    td.textContent = '';
                    
                    // Add special class for owner column (first column)
                    if (i === 0) {
                        td.className = 'kpi-owner';
                    }
                    
                    newRow.appendChild(td);
                }
                
                // Add the new row to the table body
                kpiTrackerBody.appendChild(newRow);
                
                // Save to Firebase
                saveKpiTrackerToFirebase();
                
                // Update scroll arrows
                updateScrollArrows();
            });
        }

        // Save button
        const saveKpiTrackerBtn = document.getElementById('saveKpiTrackerBtn');
        if (saveKpiTrackerBtn) {
            saveKpiTrackerBtn.addEventListener('click', async () => {
                console.log('Save button clicked for KPI Tracker');
                
                // Test Firebase connection first
                try {
                    console.log('Testing Firebase connection...');
                    const testDoc = doc(db, "test", "connection");
                    await setDoc(testDoc, { test: "connection", timestamp: new Date().toISOString() });
                    console.log('Firebase connection test successful');
                    
                    // Now save the actual data
                    await saveKpiTrackerToFirebase();
                    
                    // Visual feedback
                    const originalText = saveKpiTrackerBtn.textContent;
                    saveKpiTrackerBtn.textContent = 'Saved!';
                    saveKpiTrackerBtn.style.background = '#27ae60';
                    setTimeout(() => {
                        saveKpiTrackerBtn.textContent = originalText;
                        saveKpiTrackerBtn.style.background = '#2ecc71';
                    }, 2000);
                    
                } catch (error) {
                    console.error('Firebase connection test failed:', error);
                    saveKpiTrackerBtn.textContent = 'Error!';
                    saveKpiTrackerBtn.style.background = '#e74c3c';
                    setTimeout(() => {
                        saveKpiTrackerBtn.textContent = 'Save Data';
                        saveKpiTrackerBtn.style.background = '#2ecc71';
                    }, 2000);
                }
            });
        }

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

    function getKpiTrackerFullData() {
        // Save both header and body
        const header = Array.from(kpiTrackerHeaderRow.children).map(th => {
            // Only get the text node (label), not the button
            let txt = '';
            for (const node of th.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) txt += node.textContent;
            }
            return txt.trim();
        });
        
        // Convert body to simple object with numbered keys to preserve order
        const bodyObject = {};
        Array.from(kpiTrackerBody.children).forEach((row, rowIndex) => {
            const rowData = {};
            Array.from(row.children).forEach((cell, cellIndex) => {
                rowData[`cell_${cellIndex}`] = cell.textContent.trim();
            });
            bodyObject[`row_${rowIndex.toString().padStart(3, '0')}`] = rowData;
        });
        
        const data = { header, body: bodyObject };
        console.log('Captured KPI tracker data:', data);
        return data;
    }

    function setKpiTrackerFullData(data) {
        if (!data || !Array.isArray(data.header) || !data.body) return;
        // Restore header (except first 3 columns: Owner, KPI, Goal)
        while (kpiTrackerHeaderRow.children.length > 3) {
            kpiTrackerHeaderRow.removeChild(kpiTrackerHeaderRow.children[3]);
        }
        for (let i = 3; i < data.header.length; i++) {
            const th = document.createElement('th');
            th.appendChild(document.createTextNode(data.header[i]));
            kpiTrackerHeaderRow.appendChild(th);
        }
        // Restore body
        kpiTrackerBody.innerHTML = '';
        
        if (typeof data.body === 'object' && !Array.isArray(data.body)) {
            // Handle new numbered key format (preserves order)
            const sortedKeys = Object.keys(data.body).sort();
            sortedKeys.forEach(key => {
                const rowData = data.body[key];
                const tr = document.createElement('tr');
                // Create cells for each column in header
                for (let j = 0; j < data.header.length; j++) {
                    const td = document.createElement('td');
                    td.contentEditable = 'true';
                    td.textContent = rowData[`cell_${j}`] || '';
                    
                    // Add special class for owner column (first column)
                    if (j === 0) {
                        td.className = 'kpi-owner';
                    }
                    
                    tr.appendChild(td);
                }
                kpiTrackerBody.appendChild(tr);
            });
        } else if (Array.isArray(data.body)) {
            // Handle old array format (fallback)
            data.body.forEach((rowData, i) => {
                const tr = document.createElement('tr');
                // Create cells for each column in header
                for (let j = 0; j < data.header.length; j++) {
                    const td = document.createElement('td');
                    td.contentEditable = 'true';
                    td.textContent = rowData.cells ? rowData.cells[`cell_${j}`] || '' : (rowData[j] || '');
                    
                    // Add special class for owner column (first column)
                    if (j === 0) {
                        td.className = 'kpi-owner';
                    }
                    
                    tr.appendChild(td);
                }
                kpiTrackerBody.appendChild(tr);
            });
        }
        renderDeleteWeekButtons();
    }

    // Debounced save function for KPI Tracker
    function debouncedSaveKpiTracker() {
        console.log('Debounced save triggered for KPI Tracker');
        if (saveKpiTrackerTimeout) {
            clearTimeout(saveKpiTrackerTimeout);
        }
        saveKpiTrackerTimeout = setTimeout(() => {
            saveKpiTrackerToFirebase();
        }, 1000);
    }

    async function saveKpiTrackerToFirebase() {
        if (isSavingKpiTracker) {
            console.log('KPI Tracker: Save already in progress, skipping...');
            return;
        }
        
        const data = getKpiTrackerFullData();
        try {
            isSavingKpiTracker = true;
            console.log('Saving KPI tracker data to Firebase:', data);
            // Save with a more explicit structure
            await setDoc(doc(db, "kpiTracker", "data"), {
                header: data.header,
                body: data.body,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('KPI tracker data saved successfully to Firebase');
        } catch (error) {
            console.error("Error saving KPI tracker to Firebase:", error);
        } finally {
            isSavingKpiTracker = false;
        }
    }

    async function loadKpiTrackerFromFirebase() {
        try {
            console.log('Loading KPI tracker data from Firebase...');
            const docRef = doc(db, "kpiTracker", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                console.log('KPI tracker data found in Firebase, applying...');
                const firebaseData = docSnap.data();
                console.log('Firebase data received:', firebaseData);
                
                // Clean up any duplicate data
                const cleanedData = cleanKpiTrackerData(firebaseData);
                console.log('After cleaning:', cleanedData);
                
                // Sort the data by owner
                const sortedData = {
                    header: cleanedData.header,
                    body: sortKpiTrackerByOwner(cleanedData.body)
                };
                console.log('After sorting by owner:', sortedData);
                
                // Always save the cleaned and sorted data back to ensure consistency
                await setDoc(doc(db, "kpiTracker", "data"), sortedData, { merge: true });
                
                setKpiTrackerFullData(sortedData);
            } else {
                console.log('No KPI tracker data found in Firebase, creating default data...');
                // Create default KPI tracker data
                const defaultData = {
                    header: ['Owner', 'KPI', 'Goal', '6/12', '6/5', '5/29', '5/22', '5/15', '5/8', '5/1', '4/24'],
                    body: {
                        'row_000': {
                            'cell_0': 'Stephen', 'cell_1': 'Total Clients', 'cell_2': '30',
                            'cell_3': '19', 'cell_4': '20', 'cell_5': '19', 'cell_6': '18',
                            'cell_7': '19', 'cell_8': '18', 'cell_9': '19', 'cell_10': '21'
                        },
                        'row_001': {
                            'cell_0': 'Robby', 'cell_1': 'New Client Signed', 'cell_2': '1',
                            'cell_3': '1', 'cell_4': '0', 'cell_5': '1', 'cell_6': '0',
                            'cell_7': '0', 'cell_8': '0', 'cell_9': '0', 'cell_10': '0'
                        },
                        'row_002': {
                            'cell_0': 'Robby', 'cell_1': 'Meetings Booked', 'cell_2': '15',
                            'cell_3': '1', 'cell_4': '2', 'cell_5': '1', 'cell_6': '1',
                            'cell_7': '5', 'cell_8': '4', 'cell_9': '0', 'cell_10': '0'
                        },
                        'row_003': {
                            'cell_0': 'Brandon', 'cell_1': 'Clients Managed', 'cell_2': '12',
                            'cell_3': '10', 'cell_4': '11', 'cell_5': '10', 'cell_6': '10',
                            'cell_7': '10', 'cell_8': '10', 'cell_9': '10', 'cell_10': '11'
                        },
                        'row_004': {
                            'cell_0': 'Bobby', 'cell_1': 'Clients Managed', 'cell_2': '12',
                            'cell_3': '9', 'cell_4': '9', 'cell_5': '9', 'cell_6': '8',
                            'cell_7': '9', 'cell_8': '8', 'cell_9': '9', 'cell_10': '9'
                        },
                        'row_005': {
                            'cell_0': 'Noah', 'cell_1': 'Pod 1 Unhappy', 'cell_2': '0',
                            'cell_3': '2', 'cell_4': '1', 'cell_5': '1', 'cell_6': '2',
                            'cell_7': '2', 'cell_8': '1', 'cell_9': '2', 'cell_10': '2'
                        },
                        'row_006': {
                            'cell_0': 'Noah', 'cell_1': 'Pod 2 Unhappy', 'cell_2': '0',
                            'cell_3': '0', 'cell_4': '0', 'cell_5': '1', 'cell_6': '0',
                            'cell_7': '1', 'cell_8': '0', 'cell_9': '1', 'cell_10': '0'
                        }
                    }
                };
                
                // Sort the default data by owner
                const sortedDefaultData = {
                    header: defaultData.header,
                    body: sortKpiTrackerByOwner(defaultData.body)
                };
                
                setKpiTrackerFullData(sortedDefaultData);
                // Save the sorted default data to Firebase
                await saveKpiTrackerToFirebase();
            }
        } catch (error) {
            console.error("Error loading KPI tracker from Firebase:", error);
        }
        renderDeleteWeekButtons();
    }

    function cleanKpiTrackerData(data) {
        if (!data || typeof data !== 'object') return data;
        
        // Clean up body data - remove duplicates and ensure proper structure
        if (data.body && typeof data.body === 'object') {
            const cleanedBody = {};
            const seen = new Set();
            let counter = 0;
            
            // Handle both array and object formats
            let items = [];
            if (Array.isArray(data.body)) {
                items = data.body.map((item, index) => ({ key: `row_${index.toString().padStart(3, '0')}`, data: item }));
            } else {
                items = Object.entries(data.body).map(([key, value]) => ({ key, data: value }));
            }
            
            items.forEach(({ key, data }) => {
                if (!data || typeof data !== 'object') return;
                
                // Create a unique identifier for this row
                const rowData = data.cells || data;
                const uniqueId = `${rowData.cell_0 || ''}-${rowData.cell_1 || ''}-${rowData.cell_2 || ''}`;
                
                // Only add if we haven't seen this exact row before and it has content
                if (!seen.has(uniqueId) && (rowData.cell_0 || rowData.cell_1 || rowData.cell_2)) {
                    seen.add(uniqueId);
                    const newKey = `row_${counter.toString().padStart(3, '0')}`;
                    cleanedBody[newKey] = data;
                    counter++;
                } else {
                    console.log('Removing duplicate or empty KPI tracker row:', uniqueId);
                }
            });
            
            data.body = cleanedBody;
        }
        
        return data;
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

    // --- KPI TRACKER SORTING FUNCTIONALITY ---
    function sortKpiTrackerByOwner(data) {
        // Convert to array, sort, then convert back to object
        const sortedEntries = Object.entries(data).sort(([, a], [, b]) => {
            const ownerA = (a.cell_0 || '').toLowerCase();
            const ownerB = (b.cell_0 || '').toLowerCase();
            return ownerA.localeCompare(ownerB);
        });
        
        // Rebuild object with new keys
        const sortedData = {};
        sortedEntries.forEach(([, rowData], index) => {
            const newKey = `row_${index.toString().padStart(3, '0')}`;
            sortedData[newKey] = rowData;
        });
        
        return sortedData;
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
                th.appendChild(btn);
            }
        }
    }

    // --- MONTHLY SPRINTS SECTION ---
    console.log('=== MONTHLY SPRINTS SECTION INITIALIZATION ===');
    
    const sprintsBody = document.getElementById('monthlySprintsBody');
    const addSprintRowBtn = document.getElementById('addSprintRowBtn');
    const editSprintsBtn = document.getElementById('editSprintsBtn');
    const saveSprintsBtn = document.getElementById('saveSprintsBtn');
    
    console.log('Monthly Sprints elements found:', { sprintsBody, addSprintRowBtn, editSprintsBtn, saveSprintsBtn });

    // State management
    let sprintsData = {};
    let isSavingSprints = false;
    let saveSprintsTimeout = null;
    let sprintsEventListenersAttached = false;

    // Initialize sprints functionality
    function initializeSprints() {
        if (!sprintsBody) {
            console.log('Sprints body not found, skipping initialization');
            return;
        }

        console.log('Initializing sprints functionality...');
        
        // Attach event listeners only once
        if (!sprintsEventListenersAttached) {
            attachSprintsEventListeners();
            sprintsEventListenersAttached = true;
        }

        // Load data
        loadSprintsFromFirebase();
    }

    function attachSprintsEventListeners() {
        console.log('Attaching sprints event listeners...');

        // Edit mode toggle
        if (editSprintsBtn) {
            editSprintsBtn.addEventListener('click', function() {
                console.log('Edit mode toggled for sprints');
                document.body.classList.toggle('sprints-edit-mode');
                renderSprintsRowButtons();
            });
        }

        // Add row button
        if (addSprintRowBtn) {
            addSprintRowBtn.addEventListener('click', function() {
                console.log('Adding new sprint row');
                addSprintRow();
            });
        }

        // Save button
        if (saveSprintsBtn) {
            saveSprintsBtn.addEventListener('click', async () => {
                console.log('Save button clicked for Monthly Sprints');
                try {
                    await saveSprintsToFirebase();
                    const originalText = saveSprintsBtn.textContent;
                    saveSprintsBtn.textContent = 'Saved!';
                    saveSprintsBtn.style.background = '#27ae60';
                    setTimeout(() => {
                        saveSprintsBtn.textContent = originalText;
                        saveSprintsBtn.style.background = '#2ecc71';
                    }, 2000);
                } catch (error) {
                    console.error('Error saving sprints:', error);
                    saveSprintsBtn.textContent = 'Error!';
                    saveSprintsBtn.style.background = '#e74c3c';
                    setTimeout(() => {
                        saveSprintsBtn.textContent = 'Save Data';
                        saveSprintsBtn.style.background = '#2ecc71';
                    }, 2000);
                }
            });
        }

        // Table event listeners
        sprintsBody.addEventListener('input', function(e) {
            if (e.target.matches('[contenteditable]') || e.target.classList.contains('sprint-status')) {
                debouncedSaveSprints();
            }
        }, true);
        
        sprintsBody.addEventListener('change', function(e) {
            if (e.target.classList.contains('sprint-status')) {
                updateSprintStatusColors();
                debouncedSaveSprints();
            }
        }, true);
    }

    function addSprintRow() {
        const tr = document.createElement('tr');
        for (let i = 0; i < 3; i++) {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            tr.appendChild(td);
        }
        const td = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'sprint-status';
        ['Complete','On Track','Off Track'].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            select.appendChild(o);
        });
        td.appendChild(select);
        tr.appendChild(td);
        // Empty cell for row controls
        tr.appendChild(document.createElement('td'));
        sprintsBody.appendChild(tr);
        updateSprintStatusColors();
        renderSprintsRowButtons();
        
        // Save and sort after adding new row
        saveSprintsToFirebase().then(() => {
            // Auto-sort after saving
            const currentData = getSprintsData();
            const sortedData = sortSprintsByOwner(currentData);
            setSprintsData(sortedData);
            // Save the sorted data
            setDoc(doc(db, "monthlySprints", "data"), { 
                sprints: sortedData,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        });
    }

    function renderSprintsRowButtons() {
        if (!sprintsBody) {
            console.log('Sprints body not found');
            return;
        }
        
        console.log('Rendering sprint row buttons, edit mode:', document.body.classList.contains('sprints-edit-mode'));
        Array.from(sprintsBody.rows).forEach((row, idx, arr) => {
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
                        sprintsBody.insertBefore(row, arr[idx - 1]);
                        debouncedSaveSprints();
                        renderSprintsRowButtons();
                    }
                };
                cell.appendChild(upBtn);
                
                // Move down button
                const downBtn = document.createElement('button');
                downBtn.className = 'move-sprint-row-btn';
                downBtn.title = 'Move down';
                downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
                downBtn.onclick = function() {
                    if (idx < arr.length - 1) {
                        sprintsBody.insertBefore(arr[idx + 1], row);
                        debouncedSaveSprints();
                        renderSprintsRowButtons();
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
                        console.log('Deleting sprint row:', idx);
                        
                        // Remove the row from DOM
                        row.remove();
                        
                        // Immediately save to Firebase
                        saveSprintsToFirebase().then(() => {
                            console.log('Sprint deleted and saved successfully');
                            // Re-render buttons to update indices
                            renderSprintsRowButtons();
                        }).catch(error => {
                            console.error('Error saving after delete:', error);
                            alert('Error saving changes. Please try again.');
                        });
                    }
                };
                cell.appendChild(delBtn);
            }
        });
    }

    function debouncedSaveSprints() {
        console.log('Debounced save triggered for sprints');
        if (saveSprintsTimeout) {
            clearTimeout(saveSprintsTimeout);
        }
        saveSprintsTimeout = setTimeout(() => {
            saveSprintsToFirebase();
        }, 500);
    }

    function getSprintsData() {
        const sprints = {};
        if (!sprintsBody) return sprints;
        
        Array.from(sprintsBody.children).forEach((row, index) => {
            const sprintKey = `sprint_${index.toString().padStart(3, '0')}`;
            sprints[sprintKey] = {
                id: sprintKey,
                owner: row.children[0]?.textContent.trim() || '',
                sprint: row.children[1]?.textContent.trim() || '',
                due: row.children[2]?.textContent.trim() || '',
                status: row.children[3]?.querySelector('select')?.value || 'On Track'
            };
        });
        return sprints;
    }
    
    function setSprintsData(data) {
        if (!sprintsBody) return;
        
        console.log('Setting sprints data:', data);
        sprintsBody.innerHTML = '';
        
        if (Array.isArray(data)) {
            // Handle old array format
            data.forEach(arr => {
                const tr = document.createElement('tr');
                for (let i = 0; i < 3; i++) {
                    const td = document.createElement('td');
                    td.contentEditable = 'true';
                    td.textContent = arr[i] || '';
                    tr.appendChild(td);
                }
                const td = document.createElement('td');
                const select = document.createElement('select');
                select.className = 'sprint-status';
                ['Complete','On Track','Off Track'].forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt;
                    o.textContent = opt;
                    if (arr[3] === opt) o.selected = true;
                    select.appendChild(o);
                });
                td.appendChild(select);
                tr.appendChild(td);
                // Empty cell for row controls
                tr.appendChild(document.createElement('td'));
                sprintsBody.appendChild(tr);
            });
        } else if (typeof data === 'object' && !Array.isArray(data)) {
            // Handle new numbered key format (preserves order)
            const sortedKeys = Object.keys(data).sort();
            sortedKeys.forEach(key => {
                const sprint = data[key];
                const tr = document.createElement('tr');
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
        }
        
        updateSprintStatusColors();
        renderSprintsRowButtons();
    }
    
    async function saveSprintsToFirebase() {
        if (isSavingSprints) {
            console.log('Save already in progress, skipping...');
            return;
        }
        
        try {
            isSavingSprints = true;
            const sprintsData = getSprintsData();
            console.log('Saving Monthly Sprints data to Firebase:', sprintsData);
            
            await setDoc(doc(db, "monthlySprints", "data"), { 
                sprints: sprintsData,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('Monthly Sprints data saved successfully to Firebase');
        } catch (error) {
            console.error("Error saving sprints to Firebase:", error);
        } finally {
            isSavingSprints = false;
        }
    }
    
    async function loadSprintsFromFirebase() {
        try {
            console.log('Loading Monthly Sprints data from Firebase...');
            const docRef = doc(db, "monthlySprints", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().sprints) {
                console.log('Monthly Sprints data found in Firebase, applying...');
                const firebaseData = docSnap.data().sprints;
                console.log('Firebase data received:', firebaseData);
                
                // More aggressive cleanup - completely rebuild the data structure
                const cleanedData = aggressivelyCleanSprintsData(firebaseData);
                console.log('After aggressive cleaning:', cleanedData);
                
                // Always save the cleaned data back to ensure consistency
                await setDoc(doc(db, "monthlySprints", "data"), { 
                    sprints: cleanedData,
                    lastUpdated: new Date().toISOString()
                }, { merge: true });
                
                setSprintsData(cleanedData);
            } else {
                console.log('No Monthly Sprints data found in Firebase, starting with empty table...');
                setSprintsData({});
            }
        } catch (error) {
            console.error("Error loading sprints from Firebase:", error);
            setSprintsData({});
        }
    }

    function aggressivelyCleanSprintsData(data) {
        if (!data || typeof data !== 'object') return {};
        
        const cleaned = {};
        const seen = new Set();
        let counter = 0;
        
        // Handle both array and object formats
        let items = [];
        if (Array.isArray(data)) {
            items = data.map((item, index) => ({ key: `sprint_${index.toString().padStart(3, '0')}`, data: item }));
        } else {
            items = Object.entries(data).map(([key, value]) => ({ key, data: value }));
        }
        
        items.forEach(({ key, data }) => {
            if (!data || typeof data !== 'object') return;
            
            // Extract sprint data regardless of format
            let owner = '', sprint = '', due = '', status = 'On Track';
            
            if (Array.isArray(data)) {
                owner = data[0] || '';
                sprint = data[1] || '';
                due = data[2] || '';
                status = data[3] || 'On Track';
            } else {
                owner = data.owner || data.Owner || '';
                sprint = data.sprint || data.Sprint || '';
                due = data.due || data.Due || '';
                status = data.status || data.Status || 'On Track';
            }
            
            // Create a unique identifier
            const uniqueId = `${owner.trim()}-${sprint.trim()}-${due.trim()}`;
            
            // Only add if we haven't seen this exact sprint before and it has content
            if (!seen.has(uniqueId) && (owner.trim() || sprint.trim() || due.trim())) {
                seen.add(uniqueId);
                const newKey = `sprint_${counter.toString().padStart(3, '0')}`;
                cleaned[newKey] = {
                    id: newKey,
                    owner: owner.trim(),
                    sprint: sprint.trim(),
                    due: due.trim(),
                    status: status
                };
                counter++;
            } else {
                console.log('Removing duplicate or empty sprint:', uniqueId);
            }
        });
        
        // Sort by owner name
        const sortedData = sortSprintsByOwner(cleaned);
        
        console.log('Aggressively cleaned and sorted sprints data:', sortedData);
        return sortedData;
    }

    function sortSprintsByOwner(data) {
        // Convert to array, sort, then convert back to object
        const sortedEntries = Object.entries(data).sort(([, a], [, b]) => {
            const ownerA = (a.owner || '').toLowerCase();
            const ownerB = (b.owner || '').toLowerCase();
            return ownerA.localeCompare(ownerB);
        });
        
        // Rebuild object with new keys
        const sortedData = {};
        sortedEntries.forEach(([, sprint], index) => {
            const newKey = `sprint_${index.toString().padStart(3, '0')}`;
            sortedData[newKey] = {
                ...sprint,
                id: newKey
            };
        });
        
        return sortedData;
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

    // Add debugging functions for Monthly Sprints
    window.debugSprints = async function() {
        console.log('=== MONTHLY SPRINTS DEBUG INFO ===');
        console.log('Is saving:', isSavingSprints);
        console.log('Event listeners attached:', sprintsEventListenersAttached);
        console.log('Current table rows:', sprintsBody ? sprintsBody.children.length : 'No body');
        
        // Check Firebase data
        try {
            const docRef = doc(db, "monthlySprints", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Firebase Monthly Sprints data:', data);
                console.log('Sprints keys count:', Object.keys(data.sprints || {}).length);
            } else {
                console.log('No Monthly Sprints data in Firebase');
            }
        } catch (error) {
            console.error('Error checking Monthly Sprints Firebase:', error);
        }
    };

    window.cleanupSprints = async function() {
        if (confirm('This will clean up any duplicate Monthly Sprints data. Continue?')) {
            try {
                console.log('Monthly Sprints cleanup triggered');
                await loadSprintsFromFirebase(); // This will reload and clean the data
                alert('Monthly Sprints cleanup completed. Check the console for details.');
            } catch (error) {
                console.error('Error during Monthly Sprints cleanup:', error);
                alert('Error during cleanup: ' + error.message);
            }
        }
    };

    window.clearSprints = async function() {
        if (confirm('This will clear ALL Monthly Sprints data. This cannot be undone. Continue?')) {
            try {
                await setDoc(doc(db, "monthlySprints", "data"), { 
                    sprints: {},
                    lastUpdated: new Date().toISOString()
                });
                
                if (sprintsBody) {
                    sprintsBody.innerHTML = '';
                }
                
                alert('Monthly Sprints data cleared.');
                location.reload();
            } catch (error) {
                console.error('Error clearing Monthly Sprints data:', error);
                alert('Error clearing data: ' + error.message);
            }
        }
    };

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

    // Add sort button to the page
    setTimeout(() => {
        const sprintsContainer = document.querySelector('.monthly-sprints-container');
        if (sprintsContainer) {
            const buttonContainer = sprintsContainer.querySelector('div');
            if (buttonContainer) {
                // Sort button
                const sortBtn = document.createElement('button');
                sortBtn.textContent = '📊 Sort by Owner';
                sortBtn.style.cssText = `
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 12px;
                    margin-left: 10px;
                    cursor: pointer;
                    font-size: 0.9rem;
                `;
                sortBtn.title = 'Sort sprints by owner name';
                sortBtn.onclick = window.sortSprintsByOwner;
                
                buttonContainer.appendChild(sortBtn);
            }
        }
    }, 1000);

    // --- TO-DO SECTION LOGIC (FIREBASE) ---
    const TODOS_KEY = 'goalsTodos';
    const todoForm = document.getElementById('todoForm');
    const todosTable = document.getElementById('todosTable');
    let todos = [];
    
    async function saveTodosToFirebase() {
        try {
            await setDoc(doc(db, "goalsTodos", "data"), { todos: todos }, { merge: true });
        } catch (error) {
            console.error("Error saving todos to Firebase:", error);
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
            addIdsRowBtn.addEventListener('click', addIdsRow);
            console.log('IDS: Add row button listener added');
        }

        // Save button
        if (saveIdsBtn) {
            saveIdsBtn.addEventListener('click', async () => {
                console.log('IDS: Save button clicked');
                const success = await saveIdsData();
                if (success) {
                    saveIdsBtn.textContent = 'Saved!';
                    saveIdsBtn.style.background = '#27ae60';
                    setTimeout(() => {
                        saveIdsBtn.textContent = 'Save Data';
                        saveIdsBtn.style.background = '#2ecc71';
                    }, 2000);
                }
            });
            console.log('IDS: Save button listener added');
        }

        // Edit mode toggle
        if (editIdsBtn) {
            editIdsBtn.addEventListener('click', () => {
                console.log('IDS: Edit button clicked');
                document.body.classList.toggle('ids-edit-mode');
                renderIdsTable(); // Re-render to show/hide delete buttons
            });
            console.log('IDS: Edit button listener added');
        }

        // Table event listeners
        if (idsBody) {
            idsBody.addEventListener('input', () => {
                console.log('IDS: Table input detected');
                debouncedSaveIds();
            });
            
            idsBody.addEventListener('change', () => {
                console.log('IDS: Table change detected');
                debouncedSaveIds();
            });
            
            console.log('IDS: Table event listeners added');
        }
    }

    // Debounced save function
    function debouncedSaveIds() {
        console.log('Debounced save triggered for IDS');
        if (saveIdsTimeout) {
            clearTimeout(saveIdsTimeout);
        }
        saveIdsTimeout = setTimeout(() => {
            saveIdsData();
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
            
            onSnapshot(idsCollection, (snapshot) => {
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
            
            console.log('Initializing KPI Tracker...');
            initializeKpiTracker();
            
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
            
            console.log('=== PAGE INITIALIZATION COMPLETE ===');
        } catch (error) {
            console.error('=== PAGE INITIALIZATION ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            alert('There was an error loading the page data. Please try refreshing the page.');
        }
    }
    
    // Initialize the page with Firebase data
    initializePage().catch(error => {
        console.error('Failed to initialize page:', error);
        alert('Failed to initialize page. Please try refreshing.');
    });

    // Add debugging functions for KPI Tracker
    window.debugKpiTracker = async function() {
        console.log('=== KPI TRACKER DEBUG INFO ===');
        console.log('Is saving:', isSavingKpiTracker);
        console.log('Event listeners attached:', kpiTrackerEventListenersAttached);
        console.log('Current table rows:', kpiTrackerBody ? kpiTrackerBody.children.length : 'No body');
        
        // Check Firebase data
        try {
            const docRef = doc(db, "kpiTracker", "data");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Firebase KPI Tracker data:', data);
                console.log('Body keys count:', Object.keys(data.body || {}).length);
            } else {
                console.log('No KPI Tracker data in Firebase');
            }
        } catch (error) {
            console.error('Error checking KPI Tracker Firebase:', error);
        }
    };

    window.cleanupKpiTracker = async function() {
        if (confirm('This will clean up any duplicate KPI Tracker data. Continue?')) {
            try {
                console.log('KPI Tracker cleanup triggered');
                await loadKpiTrackerFromFirebase(); // This will reload and clean the data
                alert('KPI Tracker cleanup completed. Check the console for details.');
            } catch (error) {
                console.error('Error during KPI Tracker cleanup:', error);
                alert('Error during cleanup: ' + error.message);
            }
        }
    };

    window.clearKpiTracker = async function() {
        if (confirm('This will clear ALL KPI Tracker data. This cannot be undone. Continue?')) {
            try {
                await setDoc(doc(db, "kpiTracker", "data"), {
                    header: ['Owner', 'KPI', 'Goal'],
                    body: {},
                    lastUpdated: new Date().toISOString()
                });
                
                if (kpiTrackerBody) {
                    kpiTrackerBody.innerHTML = '';
                }
                
                alert('KPI Tracker data cleared.');
                location.reload();
            } catch (error) {
                console.error('Error clearing KPI Tracker data:', error);
                alert('Error clearing data: ' + error.message);
            }
        }
    };

    window.sortKpiTrackerByOwner = async function() {
        try {
            console.log('Manual KPI Tracker sort triggered');
            const currentData = getKpiTrackerFullData();
            const sortedData = {
                header: currentData.header,
                body: sortKpiTrackerByOwner(currentData.body)
            };
            
            // Save the sorted data
            await setDoc(doc(db, "kpiTracker", "data"), sortedData, { merge: true });
            
            // Update the display
            setKpiTrackerFullData(sortedData);
            alert('KPI Tracker sorted by owner name successfully!');
        } catch (error) {
            console.error('Error during KPI Tracker sort:', error);
            alert('Error sorting KPI Tracker: ' + error.message);
        }
    };

    // Add a function to manually trigger cleanup
    window.cleanupKpiTrackerData = async function() {
        if (confirm('This will clean up any duplicate KPI Tracker data. Continue?')) {
            try {
                console.log('Manual KPI Tracker cleanup triggered');
                await loadKpiTrackerFromFirebase(); // This will trigger the cleanup
                alert('KPI Tracker cleanup completed. Check the console for details.');
            } catch (error) {
                console.error('Error during KPI Tracker cleanup:', error);
                alert('Error during cleanup: ' + error.message);
            }
        }
    };

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
        const currentGoal = monthlyNewClientsGoals[currentMonth] || defaultMonthlyNewClientsGoals[currentMonth];
        const currentActual = monthlyNewClientsActuals[currentMonth] || defaultMonthlyNewClientsActuals[currentMonth];
        const progress = Math.min((currentActual / currentGoal) * 100, 100);
        
        // Update slider fill and thumb
        const sliderFill = document.getElementById('newClientsSliderFill');
        const sliderThumb = document.getElementById('newClientsSliderThumb');
        const currentGoalLabel = document.getElementById('currentNewClientsGoalLabel');
        const currentMonthLabel = document.getElementById('currentNewClientsMonthLabel');
        
        if (sliderFill) sliderFill.style.width = `${progress}%`;
        if (sliderThumb) sliderThumb.style.left = `${progress}%`;
        if (currentGoalLabel) currentGoalLabel.textContent = `Goal: ${currentGoal}`;
        if (currentMonthLabel) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
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
                
                // Update slider
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
}); 