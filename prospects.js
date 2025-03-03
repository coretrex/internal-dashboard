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
const daysBeforeMarchEl = document.getElementById('daysBeforeMarch');
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
    
    // Update days before March
    const today = new Date();
    const year = today.getFullYear();
    const marchFirst = new Date(year, 2, 1);
    if (today > marchFirst) {
        marchFirst.setFullYear(year + 1);
    }
    const diffTime = marchFirst - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysBeforeMarchEl.textContent = diffDays;
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
    
    updateRowStatusClass(newRow, data.status || 'In-Progress');

    // Get today's date string for comparison
    const todayString = new Date().toISOString().split('T')[0];

    // Format the date to show only month and day
    const formatDate = (dateString) => {
        // Add timezone offset to prevent date from shifting
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    };

    newRow.innerHTML = `
        <td><span class="hot-lead ${data.isHotLead ? 'active' : ''}" title="Hot">🔥</span></td>
        <td>${data.prospectName}</td>
        <td>${data.nextSteps}</td>
        <td class="${data.dueDate <= todayString ? 'overdue' : ''}">${formatDate(data.dueDate)}</td>
        <td>${data.signatureExpected}</td>
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
        const currentData = {
            prospectName: cells[1].textContent,
            nextSteps: cells[2].textContent,
            dueDate: cells[3].textContent,
            signatureExpected: cells[4].textContent,
            salesLead: cells[5].textContent,
            revenueValue: parseFloat(cells[6].textContent.replace(/[$,]/g, '')),
            status: cells[7].querySelector('select').value
        };

        // Replace cells with input fields
        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.prospectName}">`;
        cells[2].innerHTML = `<input type="text" class="editable-input" value="${currentData.nextSteps}">`;
        cells[3].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[4].innerHTML = `
            <select class="editable-input">
                <option value="February 1st" ${currentData.signatureExpected === 'February 1st' ? 'selected' : ''}>February 1st</option>
                <option value="March 1st" ${currentData.signatureExpected === 'March 1st' ? 'selected' : ''}>March 1st</option>
                <option value="April 1st" ${currentData.signatureExpected === 'April 1st' ? 'selected' : ''}>April 1st</option>
                <option value="May 1st" ${currentData.signatureExpected === 'May 1st' ? 'selected' : ''}>May 1st</option>
                <option value="June 1st" ${currentData.signatureExpected === 'June 1st' ? 'selected' : ''}>June 1st</option>
            </select>
        `;
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
                    signatureExpected: cells[4].querySelector('select').value,
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

    const rows = Array.from(tbody.querySelectorAll("tr:not(.pod-header):not(.activities-row)"));
    
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
}

// Load prospects from Firebase
async function loadProspects() {
    try {
        const tbody = prospectsTable.querySelector("tbody");
        tbody.innerHTML = ''; // Clear existing rows
        
        const querySnapshot = await getDocs(collection(db, "prospects"));
        
        // Create arrays for each sales lead
        const robbyProspects = [];
        const greysonProspects = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.salesLead === 'Robby') {
                robbyProspects.push({ ...data, id: doc.id });
            } else if (data.salesLead === 'Greyson') {
                greysonProspects.push({ ...data, id: doc.id });
            }
        });

        // Sort each array by status
        const sortByStatus = (a, b) => {
            const statusPriority = {
                'In-Progress': 0,
                'Stalled': 1,
                'Won': 2,
                'Lost': 3
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
    loadProspects();
    
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