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



// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo",
    authDomain: "coretrex-internal-dashboard.firebaseapp.com",
    projectId: "coretrex-internal-dashboard",
    storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
    messagingSenderId: "16273988237",
    appId: "1:16273988237:web:956c63742712c22185e0c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Constants
const prospectGoal = 30;
const prospectMRRGoal = 100000;

// DOM Elements
const prospectCountEl = document.getElementById('prospectCount');
const prospectMRREl = document.getElementById('prospectMRR');
const prospectsTable = document.getElementById('prospectsTable');
const addProspectBtn = document.getElementById('addProspectBtn');
const timerBtn = document.getElementById('timerBtn');
const timerDisplay = document.getElementById('timerDisplay');

// Add this CSS to your stylesheet or add it inline
const style = document.createElement('style');
style.textContent = `
    .overdue {
        background-color: #ff0000 !important;
        color: white !important;
    }
`;
document.head.appendChild(style);

// Add this helper function at the top level
function formatDateWithOrdinal(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate();
    
    // Add ordinal suffix to day
    const ordinal = (day) => {
        if (day > 3 && day < 21) return day + 'th';
        switch (day % 10) {
            case 1: return day + 'st';
            case 2: return day + 'nd';
            case 3: return day + 'rd';
            default: return day + 'th';
        }
    };
    
    return `${month} ${ordinal(day)}`;
}

// Add this helper function to convert formatted date back to YYYY-MM-DD
function convertToYYYYMMDD(formattedDate) {
    if (!formattedDate) return '';
    const date = new Date(formattedDate);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
}

// Statistics function
function updateStatistics() {
    // Update prospect count - only count In-Progress prospects
    const inProgressProspects = Array.from(prospectsTable.getElementsByTagName('tr')).filter(row => {
        const statusDropdown = row.querySelector('.status-dropdown');
        return statusDropdown && statusDropdown.value === 'In-Progress';
    });
    
    // Update prospect count
    const inProgressCount = inProgressProspects.length;
    prospectCountEl.innerHTML = `${inProgressCount}<span class="goal-text">/${prospectGoal}</span>`;
    
    // Update prospect MRR - only sum revenue from In-Progress prospects
    let totalRevenue = 0;
    inProgressProspects.forEach(row => {
        const revenueCell = row.cells[6];
        if (revenueCell) {
            const revenue = parseFloat(revenueCell.textContent.replace(/[^0-9.-]/g, '')) || 0;
            totalRevenue += revenue;
        }
    });
    
    // Add goal-reached class if goal is met
    const goalText = totalRevenue >= prospectMRRGoal ? '<span class="goal-text goal-reached">/$' : '<span class="goal-text">/$';
    prospectMRREl.innerHTML = `$${totalRevenue.toLocaleString()}${goalText}${prospectMRRGoal.toLocaleString()}</span>`;
}

// Add prospect function
async function addProspect() {
    const prospectName = document.getElementById('prospectName').value;
    const nextSteps = document.getElementById('nextSteps').value;
    const dueDate = document.getElementById('dueDate').value;
    const signatureExpected = document.getElementById('signatureExpected').value;
    const salesLead = document.getElementById('salesLead').value;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;

    if (!prospectName || !nextSteps || !dueDate) {
        alert("Please fill in all required fields");
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "prospects"), {
            prospectName,
            nextSteps,
            dueDate,
            signatureExpected,
            salesLead,
            revenueValue: revenue,
            status: 'In-Progress'
        });

        addProspectToTable({
            prospectName,
            nextSteps,
            dueDate,
            signatureExpected,
            salesLead,
            revenueValue: revenue,
            status: 'In-Progress'
        }, docRef.id);

        // Clear form
        document.getElementById('prospectName').value = '';
        document.getElementById('nextSteps').value = '';
        document.getElementById('dueDate').value = '';
        document.getElementById('revenue').value = '';

        updateStatistics();
    } catch (error) {
        console.error("Error adding prospect:", error);
        alert("Error adding prospect: " + error.message);
    }
}

// Add prospect to table function
function addProspectToTable(data, docId) {
    const newRow = document.createElement("tr");
    newRow.dataset.docId = docId;
    
    // Set initial status class
    updateRowStatusClass(newRow, data.status || 'In-Progress');

    // Get today's date string for comparison
    const todayString = new Date().toISOString().split('T')[0];

    newRow.innerHTML = `
        <td><span class="hot-lead ${data.isHotLead ? 'active' : ''}" title="Hot">🔥</span></td>
        <td>${data.prospectName}</td>
        <td>${data.nextSteps}</td>
        <td class="${data.dueDate <= todayString ? 'overdue' : ''}" data-date="${data.dueDate}">${formatDateWithOrdinal(data.dueDate)}</td>
        <td data-date="${data.signatureExpected}">${formatDateWithOrdinal(data.signatureExpected)}</td>
        <td>${data.salesLead}</td>
        <td>$${data.revenueValue.toLocaleString()}</td>
        <td>
            <select class="status-dropdown">
                <option value="In-Progress" ${(data.status || 'In-Progress') === 'In-Progress' ? 'selected' : ''}>In-Progress</option>
                <option value="Stalled" ${data.status === 'Stalled' ? 'selected' : ''}>Stalled</option>
                <option value="Won" ${data.status === 'Won' ? 'selected' : ''}>Won</option>
                <option value="Lost" ${data.status === 'Lost' ? 'selected' : ''}>Lost</option>
            </select>
        </td>
        <td>
            <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="action-btn activity-btn" title="Activities"><i class="fas fa-history"></i></button>
            <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
    `;

    // Add hot lead click handler
    const hotLeadSpan = newRow.querySelector('.hot-lead');
    hotLeadSpan.addEventListener('click', async () => {
        try {
            const newHotLeadStatus = !hotLeadSpan.classList.contains('active');
            await updateDoc(doc(db, "prospects", docId), {
                isHotLead: newHotLeadStatus
            });
            hotLeadSpan.classList.toggle('active');
        } catch (error) {
            console.error("Error updating hot lead status:", error);
            alert("Error updating hot lead status: " + error.message);
        }
    });

    // Add status change handler
    const statusDropdown = newRow.querySelector('.status-dropdown');
    statusDropdown.addEventListener('change', async () => {
        try {
            const newStatus = statusDropdown.value;
            await updateDoc(doc(db, "prospects", docId), {
                status: newStatus
            });
            updateRowStatusClass(newRow, newStatus);
            sortProspectsByStatus();
            updateStatistics();
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Error updating status: " + error.message);
        }
    });

    // Add edit button functionality
    const editBtn = newRow.querySelector(".edit-btn");
    editBtn.addEventListener("click", () => {
        const cells = newRow.cells;
        
        // Get the original data from the row's dataset and data attributes
        const currentData = {
            prospectName: cells[1].textContent,
            nextSteps: cells[2].textContent,
            dueDate: cells[3].dataset.date,  // Get the original date from data attribute
            signatureExpected: cells[4].dataset.date,  // Get the original date from data attribute
            salesLead: cells[5].textContent,
            revenueValue: parseFloat(cells[6].textContent.replace(/[$,]/g, '')),
            status: cells[7].querySelector('select').value
        };

        // Replace cells with input fields
        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.prospectName}">`;
        cells[2].innerHTML = `<input type="text" class="editable-input" value="${currentData.nextSteps}">`;
        cells[3].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[4].innerHTML = `<input type="date" class="editable-input" value="${currentData.signatureExpected}">`;
        cells[5].innerHTML = `
            <select class="editable-input">
                <option value="Robby" ${currentData.salesLead === 'Robby' ? 'selected' : ''}>Robby</option>
                <option value="Greyson" ${currentData.salesLead === 'Greyson' ? 'selected' : ''}>Greyson</option>
            </select>
        `;
        cells[6].innerHTML = `<input type="number" class="editable-input" value="${currentData.revenueValue}">`;

        // Replace edit/delete buttons with save/cancel buttons
        cells[8].innerHTML = `
            <button class="action-btn save-btn" title="Save"><i class="fas fa-save"></i></button>
            <button class="action-btn cancel-btn" title="Cancel"><i class="fas fa-times"></i></button>
        `;

        // Add save functionality
        const saveBtn = cells[8].querySelector(".save-btn");
        saveBtn.addEventListener("click", async () => {
            try {
                const updatedData = {
                    prospectName: cells[1].querySelector('input').value,
                    nextSteps: cells[2].querySelector('input').value,
                    dueDate: cells[3].querySelector('input').value,
                    signatureExpected: cells[4].querySelector('input').value,
                    salesLead: cells[5].querySelector('select').value,
                    revenueValue: parseFloat(cells[6].querySelector('input').value) || 0,
                    status: currentData.status
                };

                await updateDoc(doc(db, "prospects", docId), updatedData);
                addProspectToTable({ ...updatedData, status: currentData.status }, docId);
                newRow.remove();
                updateStatistics();
            } catch (error) {
                console.error("Error updating prospect:", error);
                alert("Error updating prospect: " + error.message);
            }
        });

        // Add cancel functionality
        const cancelBtn = cells[8].querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", () => {
            addProspectToTable(currentData, docId);
            newRow.remove();
        });
    });

    // Add activity button functionality
    const activityBtn = newRow.querySelector(".activity-btn");
    activityBtn.addEventListener("click", () => {
        const currentRow = newRow;
        const nextRow = currentRow.nextElementSibling;
        
        if (nextRow && nextRow.classList.contains('activities-row')) {
            nextRow.classList.toggle('expanded');
            return;
        }

        const activitiesRow = document.createElement('tr');
        activitiesRow.classList.add('activities-row', 'expanded');
        activitiesRow.innerHTML = `
            <td colspan="8" class="activities-cell">
                <div class="activities-container">
                    ${(data.activities || []).map(activity => `
                        <div class="activity-entry">
                            <input type="text" class="activity-input" value="${activity.text}" readonly>
                            <input type="date" class="activity-date" value="${activity.date}" readonly>
                            <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                    <div class="activity-entry new-entry">
                        <input type="text" class="activity-input" placeholder="Enter activity">
                        <input type="date" class="activity-date">
                        <button class="add-activity-btn">Add</button>
                    </div>
                </div>
            </td>
        `;

        // Insert activities row after current row
        currentRow.parentNode.insertBefore(activitiesRow, currentRow.nextSibling);

        // Add event listeners for the new activity entry
        const newActivityInput = activitiesRow.querySelector('.new-entry .activity-input');
        const newActivityDate = activitiesRow.querySelector('.new-entry .activity-date');
        const addActivityBtn = activitiesRow.querySelector('.add-activity-btn');

        addActivityBtn.addEventListener('click', async () => {
            const text = newActivityInput.value.trim();
            const date = newActivityDate.value;

            if (!text || !date) {
                alert('Please enter both activity text and date');
                return;
            }

            try {
                const newActivity = { text, date };
                await updateDoc(doc(db, "prospects", docId), {
                    activities: arrayUnion(newActivity)
                });

                // Add new activity to the display
                const activityEntry = document.createElement('div');
                activityEntry.classList.add('activity-entry');
                activityEntry.innerHTML = `
                    <input type="text" class="activity-input" value="${text}" readonly>
                    <input type="date" class="activity-date" value="${date}" readonly>
                    <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                `;

                // Add event listeners for edit and delete
                setupActivityEntryListeners(activityEntry, docId, newActivity);

                // Insert before the new entry form
                const newEntryDiv = activitiesRow.querySelector('.new-entry');
                newEntryDiv.parentNode.insertBefore(activityEntry, newEntryDiv);

                // Clear input fields
                newActivityInput.value = '';
                newActivityDate.value = '';

            } catch (error) {
                console.error("Error adding activity:", error);
                alert("Error adding activity: " + error.message);
            }
        });

        // Add event listeners for existing activities
        const existingActivities = activitiesRow.querySelectorAll('.activity-entry:not(.new-entry)');
        existingActivities.forEach(entry => {
            setupActivityEntryListeners(entry, docId, {
                text: entry.querySelector('.activity-input').value,
                date: entry.querySelector('.activity-date').value
            });
        });
    });

    // Add delete button functionality
    const deleteBtn = newRow.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this prospect?")) {
            try {
                await deleteDoc(doc(db, "prospects", docId));
                newRow.remove();
                updateStatistics();
            } catch (error) {
                console.error("Error deleting prospect:", error);
                alert("Error deleting prospect: " + error.message);
            }
        }
    });

    // Add row to table
    const tbody = prospectsTable.querySelector("tbody");
    tbody.appendChild(newRow);

    return newRow;
}

// Helper function to update row status classes
function updateRowStatusClass(row, status) {
    row.classList.remove('status-lost', 'status-won', 'status-stalled');
    if (status !== 'In-Progress') {
        row.classList.add(`status-${status.toLowerCase()}`);
    }
}

// Sort prospects by status
function sortProspectsByStatus() {
    const tbody = prospectsTable.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr:not(.pod-header):not(.activities-row):not(.won-prospects-header):not(.won-prospects-row)"));
    
    const statusPriority = {
        'In-Progress': 0,
        'Stalled': 1,
        'Won': 2,
        'Lost': 3
    };
    
    rows.sort((a, b) => {
        const statusDropdownA = a.querySelector('.status-dropdown');
        const statusDropdownB = b.querySelector('.status-dropdown');
        
        if (!statusDropdownA || !statusDropdownB) return 0;
        
        const statusA = statusDropdownA.value || 'In-Progress';
        const statusB = statusDropdownB.value || 'In-Progress';
        
        return statusPriority[statusA] - statusPriority[statusB];
    });
    
    // Clear tbody
    tbody.innerHTML = '';
    
    // Group rows by sales lead
    const rowsBySalesLead = {};
    rows.forEach(row => {
        const salesLeadCell = row.querySelector('td:nth-child(6)');
        if (!salesLeadCell) return;
        
        const salesLead = salesLeadCell.textContent || 'Unknown';
        if (!rowsBySalesLead[salesLead]) {
            rowsBySalesLead[salesLead] = [];
        }
        rowsBySalesLead[salesLead].push(row);
    });
    
    // Add rows back with headers
    Object.entries(rowsBySalesLead).forEach(([salesLead, salesLeadRows]) => {
        if (salesLeadRows.length > 0) {
            // Add header
            const header = document.createElement('tr');
            header.classList.add('pod-header');
            header.innerHTML = `<td colspan="9" class="pod-header">${salesLead}'s Prospects</td>`;
            tbody.appendChild(header);
            
            // Add rows
            salesLeadRows.forEach(row => {
                tbody.appendChild(row);
            });
        }
    });

    // Add Won Prospects section
    const wonProspects = rows.filter(row => {
        const statusDropdown = row.querySelector('.status-dropdown');
        return statusDropdown && statusDropdown.value === 'Won';
    });

    if (wonProspects.length > 0) {
        // Add Won Prospects header
        const wonHeader = document.createElement('tr');
        wonHeader.classList.add('won-prospects-header');
        wonHeader.innerHTML = `
            <td colspan="9" class="won-prospects-header">
                <div class="won-prospects-toggle">
                    <i class="fas fa-chevron-right"></i>
                    Won Prospects (${wonProspects.length})
                </div>
            </td>
        `;
        tbody.appendChild(wonHeader);

        // Add click handler for toggle
        wonHeader.querySelector('.won-prospects-toggle').addEventListener('click', () => {
            const isExpanded = wonHeader.classList.contains('expanded');
            wonHeader.classList.toggle('expanded');
            wonHeader.querySelector('i').classList.toggle('fa-chevron-right');
            wonHeader.querySelector('i').classList.toggle('fa-chevron-down');
            
            // Toggle visibility of won prospects
            wonProspects.forEach(row => {
                row.style.display = isExpanded ? 'none' : 'table-row';
            });
        });

        // Add won prospects (initially hidden)
        wonProspects.forEach(row => {
            row.style.display = 'none';
            tbody.appendChild(row);
        });
    }
}

// Load prospects from Firebase
async function loadProspects() {
    try {
        const tbody = prospectsTable.querySelector("tbody");
        tbody.innerHTML = ''; // Clear existing rows
        
        const querySnapshot = await getDocs(collection(db, "prospects"));
        
        // Create arrays for each status and sales lead
        const robbyProspects = [];
        const greysonProspects = [];
        const wonProspects = [];
        const stalledProspects = [];
        const lostProspects = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'Won') {
                wonProspects.push({ ...data, id: doc.id });
            } else if (data.status === 'Stalled') {
                stalledProspects.push({ ...data, id: doc.id });
            } else if (data.status === 'Lost') {
                lostProspects.push({ ...data, id: doc.id });
            } else if (data.salesLead === 'Robby') {
                robbyProspects.push({ ...data, id: doc.id });
            } else if (data.salesLead === 'Greyson') {
                greysonProspects.push({ ...data, id: doc.id });
            }
        });

        // Sort each array by status
        const sortByStatus = (a, b) => {
            const statusPriority = {
                'In-Progress': 0,
                'Lost': 1
            };
            return statusPriority[a.status] - statusPriority[b.status];
        };

        robbyProspects.sort(sortByStatus);
        greysonProspects.sort(sortByStatus);

        // Add Robby's prospects with header
        if (robbyProspects.length > 0) {
            const robbyHeader = document.createElement('tr');
            robbyHeader.innerHTML = `<td colspan="9" class="pod-header">Robby's Prospects</td>`;
            tbody.appendChild(robbyHeader);
            
            robbyProspects.forEach(prospect => {
                addProspectToTable(prospect, prospect.id);
            });
        }

        // Add Greyson's prospects with header
        if (greysonProspects.length > 0) {
            const greysonHeader = document.createElement('tr');
            greysonHeader.innerHTML = `<td colspan="9" class="pod-header">Greyson's Prospects</td>`;
            tbody.appendChild(greysonHeader);
            
            greysonProspects.forEach(prospect => {
                addProspectToTable(prospect, prospect.id);
            });
        }

        // Helper function to create collapsible section
        const createCollapsibleSection = (prospects, title, className) => {
            if (prospects.length > 0) {
                const header = document.createElement('tr');
                header.classList.add(className);
                header.innerHTML = `
                    <td colspan="9" class="${className}">
                        <div class="collapsible-toggle">
                            <i class="fas fa-chevron-right"></i>
                            ${title} (${prospects.length})
                        </div>
                    </td>
                `;
                tbody.appendChild(header);

                // Add click handler for toggle
                header.querySelector('.collapsible-toggle').addEventListener('click', () => {
                    const isExpanded = header.classList.contains('expanded');
                    header.classList.toggle('expanded');
                    header.querySelector('i').classList.toggle('fa-chevron-right');
                    header.querySelector('i').classList.toggle('fa-chevron-down');
                    
                    // Toggle visibility of prospects
                    prospects.forEach(prospect => {
                        const row = document.querySelector(`tr[data-doc-id="${prospect.id}"]`);
                        if (row) {
                            row.style.display = isExpanded ? 'none' : 'table-row';
                        }
                    });
                });

                // Add prospects (initially hidden)
                prospects.forEach(prospect => {
                    const row = addProspectToTable(prospect, prospect.id);
                    if (row) {
                        row.style.display = 'none';
                    }
                });
            }
        };

        // Add collapsible sections for each status
        createCollapsibleSection(wonProspects, 'Won Prospects', 'won-prospects-header');
        createCollapsibleSection(stalledProspects, 'Stalled Prospects', 'stalled-prospects-header');
        createCollapsibleSection(lostProspects, 'Lost Prospects', 'lost-prospects-header');

        updateStatistics();
    } catch (error) {
        console.error("Error loading prospects:", error);
    }
}

// Helper function to setup activity entry listeners
function setupActivityEntryListeners(entry, docId, activity) {
    const editBtn = entry.querySelector('.edit-btn');
    const deleteBtn = entry.querySelector('.delete-btn');
    const textInput = entry.querySelector('.activity-input');
    const dateInput = entry.querySelector('.activity-date');

    editBtn.addEventListener('click', async () => {
        if (textInput.readOnly) {
            // Enable editing
            textInput.readOnly = false;
            dateInput.readOnly = false;
            editBtn.innerHTML = '<i class="fas fa-save"></i>';
            editBtn.title = "Save";
        } else {
            // Save changes
            const oldActivity = activity;
            const newActivity = {
                text: textInput.value.trim(),
                date: dateInput.value
            };

            try {
                await updateDoc(doc(db, "prospects", docId), {
                    activities: arrayRemove(oldActivity)
                });
                await updateDoc(doc(db, "prospects", docId), {
                    activities: arrayUnion(newActivity)
                });

                textInput.readOnly = true;
                dateInput.readOnly = true;
                editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                editBtn.title = "Edit";
                activity = newActivity;
            } catch (error) {
                console.error("Error updating activity:", error);
                alert("Error updating activity: " + error.message);
            }
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete this activity?")) {
            try {
                await updateDoc(doc(db, "prospects", docId), {
                    activities: arrayRemove(activity)
                });
                entry.remove();
            } catch (error) {
                console.error("Error deleting activity:", error);
                alert("Error deleting activity: " + error.message);
            }
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // PAGE GUARD
    if (!hasPageAccess('prospects')) {
        alert('Access denied. You do not have permission to view this page.');
        window.location.href = 'index.html';
        return;
    }

    // Initialize data
    async function initializeEverything() {
        try {
            console.log('=== INITIALIZING PROSPECTS PAGE ===');
            
            // Load prospects
            console.log('Loading prospects...');
            await loadProspects();
            
            console.log('=== PROSPECTS PAGE INITIALIZED SUCCESSFULLY ===');
        } catch (error) {
            console.error('Failed to initialize prospects page:', error);
            alert('Failed to initialize. Please try refreshing.');
        }
    }

    // Setup real-time listener for prospects
    function setupProspectsRealtimeListener() {
        try {
            console.log('Prospects: Setting up real-time listener...');
            
            const prospectsCollection = collection(db, "prospects");
            
            onSnapshot(prospectsCollection, (snapshot) => {
                console.log('Prospects: Real-time update received');
                
                // Reload prospects when changes are detected
                loadProspects();
                updateStatistics();
            }, (error) => {
                console.error('Prospects: Real-time listener error:', error);
            });
        } catch (error) {
            console.error('Prospects: Error setting up real-time listener:', error);
        }
    }

    // Start initialization
    initializeEverything();
    
    // Setup real-time listener after initialization
    setupProspectsRealtimeListener();
    
    // Add this new code
    const toggleAddProspectBtn = document.querySelector('.toggle-add-prospect');
    const inputSection = document.querySelector('.input-section');
    
    toggleAddProspectBtn.addEventListener('click', () => {
        inputSection.classList.toggle('show');
        const isShowing = inputSection.classList.contains('show');
        toggleAddProspectBtn.innerHTML = isShowing ? 
            '<i class="fas fa-times"></i> Close Form' : 
            '<i class="fas fa-plus"></i> Add New Prospect';
    });
    
    if (addProspectBtn) {
        addProspectBtn.addEventListener("click", addProspect);
    }

    timerBtn.addEventListener('click', () => {
        if (timerInterval) {
            stopTimer();
        } else {
            startTimer();
        }
    });
});

let timerInterval;
let timeLeft;

function startTimer() {
    timeLeft = 15 * 60; // 15 minutes in seconds
    updateTimerDisplay();
    
    timerBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Timer';
    timerBtn.classList.add('running');
    timerDisplay.classList.add('active');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            stopTimer();
            alert('Timer finished!');
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerBtn.innerHTML = '<i class="fas fa-play"></i> Start Timer';
    timerBtn.classList.remove('running');
    timerDisplay.classList.remove('active');
    timerDisplay.textContent = '15:00';
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Page guard: check login and access
function hasPageAccess(pageId) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userRole = localStorage.getItem('userRole');
    let pageAccess = [];
    try {
        pageAccess = JSON.parse(localStorage.getItem('userPageAccess')) || [];
    } catch (e) {
        pageAccess = [];
    }
    return isLoggedIn && (userRole === 'admin' || pageAccess.includes(pageId));
} 