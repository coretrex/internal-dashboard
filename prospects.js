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
    arrayRemove,
    onSnapshot
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
}

// Constants
const prospectGoal = 30;
const prospectMRRGoal = 100000;

// DOM Elements
const prospectCountEl = document.getElementById('prospectCount');
const prospectMRREl = document.getElementById('prospectMRR');
const averageAgeEl = document.getElementById('averageAge');
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

// New: Format any supported date input to MM/DD (e.g., 08/31)
function formatToMMDD(value) {
    if (!value) return '';
    // If value is ISO (YYYY-MM-DD)
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
        const [, mm, dd] = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
        return `${mm}/${dd}`;
    }
    // If value is like "January 1st"
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const ordinalMatch = /^(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})(?:st|nd|rd|th)?$/;
    const m = value.match(ordinalMatch);
    if (m) {
        const monthIndex = monthNames.indexOf(m[1]);
        const day = String(parseInt(m[2], 10)).padStart(2, '0');
        const mm = String(monthIndex + 1).padStart(2, '0');
        return `${mm}/${day}`;
    }
    // Fallback try Date parsing
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${mm}/${dd}`;
    }
    return '';
}

// New: Normalize various date inputs to ISO YYYY-MM-DD for data-date attributes
function toISODate(value) {
    if (!value) return '';
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value;
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const ordinalMatch = /^(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})(?:st|nd|rd|th)?$/;
    const m = value.match(ordinalMatch);
    if (m) {
        const monthIndex = monthNames.indexOf(m[1]);
        const day = String(parseInt(m[2], 10)).padStart(2, '0');
        const year = new Date().getFullYear();
        const mm = String(monthIndex + 1).padStart(2, '0');
        return `${year}-${mm}-${day}`;
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return '';
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
        const revenueCell = row.cells[6]; // Revenue is in column 7 (index 6 after layout change)
        if (revenueCell) {
            const revenue = parseFloat(revenueCell.textContent.replace(/[^0-9.-]/g, '')) || 0;
            totalRevenue += revenue;
        }
    });
    
    // Add goal-reached class if goal is met
    const goalText = totalRevenue >= prospectMRRGoal ? '<span class="goal-text goal-reached">/$' : '<span class="goal-text">/$';
    prospectMRREl.innerHTML = `$${totalRevenue.toLocaleString()}${goalText}${prospectMRRGoal.toLocaleString()}</span>`;
    
    // Calculate average age of In-Progress prospects
    let totalDays = 0;
    let validProspects = 0;
    const today = new Date();
    
    inProgressProspects.forEach(row => {
        const createdDateCell = row.cells[7]; // Created Date is now column index 7
        if (createdDateCell) {
            // Try to get the date from dataset first, then from text content
            let dateString = createdDateCell.dataset.date;
            if (!dateString) {
                // If no dataset, try to parse from the displayed text
                const displayText = createdDateCell.textContent.trim();
                if (displayText) {
                    // Convert "January 1st" format back to YYYY-MM-DD
                    const currentYear = new Date().getFullYear();
                    const monthNames = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    
                    for (let i = 0; i < monthNames.length; i++) {
                        if (displayText.includes(monthNames[i])) {
                            const dayMatch = displayText.match(/(\d+)/);
                            if (dayMatch) {
                                const day = parseInt(dayMatch[1]);
                                const month = i + 1;
                                dateString = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (dateString) {
                const createdDate = new Date(dateString + 'T00:00:00');
                if (!isNaN(createdDate.getTime())) {
                    const daysDiff = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
                    totalDays += daysDiff;
                    validProspects++;
                    console.log(`Prospect created: ${dateString}, days old: ${daysDiff}`);
                }
            }
        }
    });
    
    // Calculate and display average age
    const averageAge = validProspects > 0 ? Math.round(totalDays / validProspects) : 0;
    console.log(`Total days: ${totalDays}, Valid prospects: ${validProspects}, Average age: ${averageAge}`);
    averageAgeEl.innerHTML = `${averageAge}<span class="goal-text"> days</span>`;
}

// Add prospect function
async function addProspect() {
    const prospectName = document.getElementById('prospectName').value;
    const nextSteps = document.getElementById('nextSteps').value;
    const dueDate = document.getElementById('dueDate').value;
    const signatureExpected = document.getElementById('signatureExpected').value;
    const leadSource = document.getElementById('leadSource').value;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const createdDate = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

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
            leadSource,
            revenueValue: revenue,
            createdDate,
            status: 'In-Progress',
            postProposalChecklist: {
                called: false,
                voicemail: false,
                texted: false,
                emailed: false
            }
        });

        addProspectToTable({
            prospectName,
            nextSteps,
            dueDate,
            signatureExpected,
            leadSource,
            revenueValue: revenue,
            createdDate,
            status: 'In-Progress',
            postProposalChecklist: {
                called: false,
                voicemail: false,
                texted: false,
                emailed: false
            }
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
        <td class="${data.dueDate <= todayString ? 'overdue' : ''}" data-date="${data.dueDate}">${formatToMMDD(data.dueDate)}</td>
        <td data-date="${toISODate(data.signatureExpected)}">${formatToMMDD(data.signatureExpected)}</td>
        <td>${data.leadSource || 'N/A'}</td>
        <td>$${data.revenueValue.toLocaleString()}</td>
        <td data-date="${data.createdDate || new Date().toISOString().split('T')[0]}">${formatToMMDD(data.createdDate || new Date().toISOString().split('T')[0])}</td>
        <td class="followups">
            <span class="followup-toggle ${data.postProposalChecklist?.emailed ? 'active' : ''}" data-key="emailed" title="Email Sent"><i class="fas fa-envelope"></i></span>
            <span class="followup-toggle ${data.postProposalChecklist?.called ? 'active' : ''}" data-key="called" title="Called"><i class="fas fa-phone"></i></span>
            <span class="followup-toggle ${data.postProposalChecklist?.voicemail ? 'active' : ''}" data-key="voicemail" title="Left Voicemail"><i class="fas fa-voicemail"></i></span>
            <span class="followup-toggle ${data.postProposalChecklist?.texted ? 'active' : ''}" data-key="texted" title="Text Sent"><i class="fas fa-comment-dots"></i></span>
        </td>
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
            // Rebuild list for consistent grouping
            await loadProspects();
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Error updating status: " + error.message);
        }
    });

    // Add follow-ups toggle handlers
    const followupToggles = newRow.querySelectorAll('.followup-toggle');
    followupToggles.forEach(toggle => {
        toggle.addEventListener('click', async () => {
            try {
                const key = toggle.dataset.key;
                const newValue = !toggle.classList.contains('active');
                const updatePayload = {};
                updatePayload[`postProposalChecklist.${key}`] = newValue;
                await updateDoc(doc(db, "prospects", docId), updatePayload);
                toggle.classList.toggle('active');
            } catch (error) {
                console.error("Error updating follow-up:", error);
                alert("Error updating follow-up: " + error.message);
            }
        });
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
            leadSource: cells[5].textContent,
            revenueValue: parseFloat(cells[6].textContent.replace(/[$,]/g, '')),
            createdDate: cells[7].dataset.date || new Date().toISOString().split('T')[0],
            status: cells[9].querySelector('select').value
        };

        // Replace cells with input fields
        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.prospectName}">`;
        cells[2].innerHTML = `<input type="text" class="editable-input" value="${currentData.nextSteps}">`;
        cells[3].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[4].innerHTML = `<input type="date" class="editable-input" value="${currentData.signatureExpected}">`;
        cells[5].innerHTML = `
            <select class="editable-input">
                <option value="Meta" ${currentData.leadSource === 'Meta' ? 'selected' : ''}>Meta</option>
                <option value="Referral" ${currentData.leadSource === 'Referral' ? 'selected' : ''}>Referral</option>
                <option value="Email" ${currentData.leadSource === 'Email' ? 'selected' : ''}>Email</option>
                <option value="Cold Call" ${currentData.leadSource === 'Cold Call' ? 'selected' : ''}>Cold Call</option>
                <option value="Google" ${currentData.leadSource === 'Google' ? 'selected' : ''}>Google</option>
                <option value="Door Knock" ${currentData.leadSource === 'Door Knock' ? 'selected' : ''}>Door Knock</option>
            </select>
        `;
        cells[6].innerHTML = `<input type="number" class="editable-input" value="${currentData.revenueValue}">`;
        cells[7].innerHTML = `<input type="date" class="editable-input" value="${currentData.createdDate}">`;

        // Replace edit/delete buttons with save/cancel buttons
        cells[10].innerHTML = `
            <button class="action-btn save-btn" title="Save"><i class="fas fa-save"></i></button>
            <button class="action-btn cancel-btn" title="Cancel"><i class="fas fa-times"></i></button>
        `;

        // Add save functionality
        const saveBtn = cells[10].querySelector(".save-btn");
        saveBtn.addEventListener("click", async () => {
            try {
                const updatedData = {
                    prospectName: cells[1].querySelector('input').value,
                    nextSteps: cells[2].querySelector('input').value,
                    dueDate: cells[3].querySelector('input').value,
                    signatureExpected: cells[4].querySelector('input').value,
                    leadSource: cells[5].querySelector('select').value,
                    revenueValue: parseFloat(cells[6].querySelector('input').value) || 0,
                    createdDate: cells[7].querySelector('input').value, // Allow editing the created date
                    status: currentData.status
                };

                await updateDoc(doc(db, "prospects", docId), updatedData);
                
                // Update the row in place instead of removing and re-adding
                const todayString = new Date().toISOString().split('T')[0];
                
                cells[1].textContent = updatedData.prospectName;
                cells[2].textContent = updatedData.nextSteps;
                cells[3].className = updatedData.dueDate <= todayString ? 'overdue' : '';
                cells[3].dataset.date = updatedData.dueDate;
                cells[3].textContent = formatToMMDD(updatedData.dueDate);
                cells[4].dataset.date = updatedData.signatureExpected;
                cells[4].textContent = formatToMMDD(updatedData.signatureExpected);
                cells[5].textContent = updatedData.leadSource || 'N/A';
                cells[6].textContent = `$${updatedData.revenueValue.toLocaleString()}`;
                cells[7].dataset.date = updatedData.createdDate;
                cells[7].textContent = formatToMMDD(updatedData.createdDate);
                
                // Restore the original action buttons
                cells[10].innerHTML = `
                    <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn activity-btn" title="Activities"><i class="fas fa-history"></i></button>
                    <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                `;
                
                // Re-attach event listeners to the restored buttons
                                attachRowEventListeners(newRow, docId, updatedData);
                
                updateStatistics();
            } catch (error) {
                console.error("Error updating prospect:", error);
                alert("Error updating prospect: " + error.message);
            }
        });

        // Add cancel functionality
        const cancelBtn = cells[10].querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", () => {
            const todayString = new Date().toISOString().split('T')[0];
            
            cells[1].textContent = currentData.prospectName;
            cells[2].textContent = currentData.nextSteps;
            cells[3].className = currentData.dueDate <= todayString ? 'overdue' : '';
            cells[3].dataset.date = currentData.dueDate;
            cells[3].textContent = formatToMMDD(currentData.dueDate);
            cells[4].dataset.date = currentData.signatureExpected;
            cells[4].textContent = formatToMMDD(currentData.signatureExpected);
            cells[5].textContent = currentData.leadSource;
            cells[6].textContent = `$${currentData.revenueValue.toLocaleString()}`;
            cells[7].dataset.date = currentData.createdDate;
            cells[7].textContent = formatToMMDD(currentData.createdDate);
            
            // Restore the original action buttons
            cells[10].innerHTML = `
                <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn activity-btn" title="Activities"><i class="fas fa-history"></i></button>
                <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            `;
            
                                      // Re-attach event listeners to the restored buttons
             attachRowEventListeners(newRow, docId, currentData);
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
            <td colspan="11" class="activities-cell">
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

// Helper function to attach event listeners to a row
function attachRowEventListeners(row, docId, data) {
    const editBtn = row.querySelector(".edit-btn");
    const activityBtn = row.querySelector(".activity-btn");
    const deleteBtn = row.querySelector(".delete-btn");

    // Remove existing event listeners by cloning the buttons
    if (editBtn) {
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    }
    if (activityBtn) {
        const newActivityBtn = activityBtn.cloneNode(true);
        activityBtn.parentNode.replaceChild(newActivityBtn, activityBtn);
    }
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    }

    // Re-attach edit functionality
    const newEditBtn = row.querySelector(".edit-btn");
    newEditBtn.addEventListener("click", () => {
        const cells = row.cells;
        
        const currentData = {
            prospectName: cells[1].textContent,
            nextSteps: cells[2].textContent,
            dueDate: cells[3].dataset.date,
            signatureExpected: cells[4].dataset.date,
            leadSource: cells[5].textContent,
            revenueValue: parseFloat(cells[6].textContent.replace(/[$,]/g, '')),
            createdDate: cells[7].dataset.date || new Date().toISOString().split('T')[0],
            status: cells[9].querySelector('select').value
        };

        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.prospectName}">`;
        cells[2].innerHTML = `<input type="text" class="editable-input" value="${currentData.nextSteps}">`;
        cells[3].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[4].innerHTML = `<input type="date" class="editable-input" value="${currentData.signatureExpected}">`;
        cells[5].innerHTML = `
            <select class="editable-input">
                <option value="Meta" ${currentData.leadSource === 'Meta' ? 'selected' : ''}>Meta</option>
                <option value="Referral" ${currentData.leadSource === 'Referral' ? 'selected' : ''}>Referral</option>
                <option value="Email" ${currentData.leadSource === 'Email' ? 'selected' : ''}>Email</option>
                <option value="Cold Call" ${currentData.leadSource === 'Cold Call' ? 'selected' : ''}>Cold Call</option>
                <option value="Google" ${currentData.leadSource === 'Google' ? 'selected' : ''}>Google</option>
                <option value="Door Knock" ${currentData.leadSource === 'Door Knock' ? 'selected' : ''}>Door Knock</option>
            </select>
        `;
        cells[6].innerHTML = `<input type="number" class="editable-input" value="${currentData.revenueValue}">`;
        cells[7].innerHTML = `<input type="date" class="editable-input" value="${currentData.createdDate}">`;

        cells[10].innerHTML = `
            <button class="action-btn save-btn" title="Save"><i class="fas fa-save"></i></button>
            <button class="action-btn cancel-btn" title="Cancel"><i class="fas fa-times"></i></button>
        `;

        const saveBtn = cells[10].querySelector(".save-btn");
        const cancelBtn = cells[10].querySelector(".cancel-btn");

        saveBtn.addEventListener("click", async () => {
            const updatedData = {
                prospectName: cells[1].querySelector('input').value,
                nextSteps: cells[2].querySelector('input').value,
                dueDate: cells[3].querySelector('input').value,
                signatureExpected: cells[4].querySelector('input').value,
                leadSource: cells[5].querySelector('select').value,
                revenueValue: parseFloat(cells[6].querySelector('input').value) || 0,
                createdDate: cells[7].querySelector('input').value, // Allow editing the created date
                status: currentData.status
            };

            await updateDoc(doc(db, "prospects", docId), updatedData);
            
            const todayString = new Date().toISOString().split('T')[0];
            
            cells[1].textContent = updatedData.prospectName;
            cells[2].textContent = updatedData.nextSteps;
            cells[3].className = updatedData.dueDate <= todayString ? 'overdue' : '';
            cells[3].dataset.date = updatedData.dueDate;
            cells[3].textContent = formatToMMDD(updatedData.dueDate);
            cells[4].dataset.date = updatedData.signatureExpected;
            cells[4].textContent = formatToMMDD(updatedData.signatureExpected);
            cells[5].textContent = updatedData.leadSource || 'N/A';
            cells[6].textContent = `$${updatedData.revenueValue.toLocaleString()}`;
            cells[7].dataset.date = updatedData.createdDate;
            cells[7].textContent = formatToMMDD(updatedData.createdDate);
            
            cells[10].innerHTML = `
                <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn activity-btn" title="Activities"><i class="fas fa-history"></i></button>
                <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            `;
            
            attachRowEventListeners(row, docId, updatedData);
            updateStatistics();
        });

        cancelBtn.addEventListener("click", () => {
            const todayString = new Date().toISOString().split('T')[0];
            
            cells[1].textContent = currentData.prospectName;
            cells[2].textContent = currentData.nextSteps;
            cells[3].className = currentData.dueDate <= todayString ? 'overdue' : '';
            cells[3].dataset.date = currentData.dueDate;
            cells[3].textContent = formatToMMDD(currentData.dueDate);
            cells[4].dataset.date = currentData.signatureExpected;
            cells[4].textContent = formatToMMDD(currentData.signatureExpected);
            cells[5].textContent = currentData.leadSource;
            cells[6].textContent = `$${currentData.revenueValue.toLocaleString()}`;
            cells[7].dataset.date = currentData.createdDate;
            cells[7].textContent = formatToMMDD(currentData.createdDate);
            
            cells[10].innerHTML = `
                <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn activity-btn" title="Activities"><i class="fas fa-history"></i></button>
                <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            `;
            
            attachRowEventListeners(row, docId, currentData);
        });
    });

    // Re-attach activity functionality
    const newActivityBtn = row.querySelector(".activity-btn");
    newActivityBtn.addEventListener("click", () => {
        const currentRow = row;
        const nextRow = currentRow.nextElementSibling;
        
        if (nextRow && nextRow.classList.contains('activities-row')) {
            nextRow.classList.toggle('expanded');
            return;
        }

        const activitiesRow = document.createElement('tr');
        activitiesRow.classList.add('activities-row', 'expanded');
        activitiesRow.innerHTML = `
            <td colspan="11" class="activities-cell">
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

        currentRow.parentNode.insertBefore(activitiesRow, currentRow.nextSibling);

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

                const activityEntry = document.createElement('div');
                activityEntry.classList.add('activity-entry');
                activityEntry.innerHTML = `
                    <input type="text" class="activity-input" value="${text}" readonly>
                    <input type="date" class="activity-date" value="${date}" readonly>
                    <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                `;

                setupActivityEntryListeners(activityEntry, docId, newActivity);

                const newEntryDiv = activitiesRow.querySelector('.new-entry');
                newEntryDiv.parentNode.insertBefore(activityEntry, newEntryDiv);

                newActivityInput.value = '';
                newActivityDate.value = '';

            } catch (error) {
                console.error("Error adding activity:", error);
                alert("Error adding activity: " + error.message);
            }
        });

        const existingActivities = activitiesRow.querySelectorAll('.activity-entry:not(.new-entry)');
        existingActivities.forEach(entry => {
            setupActivityEntryListeners(entry, docId, {
                text: entry.querySelector('.activity-input').value,
                date: entry.querySelector('.activity-date').value
            });
        });
    });

    // Re-attach delete functionality
    const newDeleteBtn = row.querySelector(".delete-btn");
    newDeleteBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this prospect?")) {
            try {
                await deleteDoc(doc(db, "prospects", docId));
                row.remove();
                updateStatistics();
            } catch (error) {
                console.error("Error deleting prospect:", error);
                alert("Error deleting prospect: " + error.message);
            }
        }
    });
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
        const salesLeadCell = row.querySelector('td:nth-child(7)');
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
            header.innerHTML = `<td colspan="11" class="pod-header">${salesLead}'s Prospects</td>`;
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
            <td colspan="11" class="won-prospects-header">
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
        
        // Create arrays for each status
        const inProgressProspects = [];
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
            } else {
                inProgressProspects.push({ ...data, id: doc.id });
            }
        });

        // Helper to convert mixed date values to comparable timestamps
        const toTs = (value) => {
            const iso = toISODate(value) || value;
            const d = new Date((iso || '') + (iso && iso.length === 10 ? 'T00:00:00' : ''));
            const t = d.getTime();
            return isNaN(t) ? Number.POSITIVE_INFINITY : t;
        };

        // Sort all groups by nearest due date ascending
        const sortByDueDateAsc = (a, b) => toTs(a.dueDate) - toTs(b.dueDate);
        inProgressProspects.sort(sortByDueDateAsc);
        wonProspects.sort(sortByDueDateAsc);
        stalledProspects.sort(sortByDueDateAsc);
        lostProspects.sort(sortByDueDateAsc);

        // Add In-Progress prospects (visible)
        inProgressProspects.forEach(prospect => {
            addProspectToTable(prospect, prospect.id);
        });

        // Helper function to create collapsible section
        const createCollapsibleSection = (prospects, title, className) => {
            if (prospects.length > 0) {
                const header = document.createElement('tr');
                header.classList.add(className);
                header.innerHTML = `
                    <td colspan="11" class="${className}">
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
        window.location.href = '/';
        return;
    }

    // Initialize data
    async function initializeEverything() {
        try {
            console.log('=== INITIALIZING PROSPECTS PAGE ===');
            
            // Initialize Firebase first
            console.log('Initializing Firebase...');
            await initializeFirebaseApp();
            
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
            
            if (!db) {
                console.error('Prospects: Database not initialized yet');
                return;
            }
            
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
    initializeEverything().then(() => {
        // Setup real-time listener after initialization is complete
        setupProspectsRealtimeListener();
    });
    
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

    // Set the created date field to today's date
    const createdDateField = document.getElementById('createdDate');
    if (createdDateField) {
        createdDateField.value = new Date().toISOString().split('T')[0];
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