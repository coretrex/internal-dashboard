// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc 
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
        const revenueCell = row.cells[5];
        if (revenueCell) {
            const revenue = parseFloat(revenueCell.textContent.replace(/[^0-9.]/g, '')) || 0;
            totalRevenue += revenue;
        }
    });
    
    prospectMRREl.innerHTML = `$${totalRevenue.toLocaleString()}<span class="goal-text">/$${prospectMRRGoal.toLocaleString()}</span>`;
    
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
    
    // Set initial status class
    updateRowStatusClass(newRow, data.status || 'In-Progress');

    // Get today's date string for comparison
    const todayString = new Date().toISOString().split('T')[0];

    newRow.innerHTML = `
        <td>${data.prospectName}</td>
        <td>${data.nextSteps}</td>
        <td class="${data.dueDate <= todayString ? 'overdue' : ''}">${data.dueDate}</td>
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
            <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
    `;

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
            prospectName: cells[0].textContent,
            nextSteps: cells[1].textContent,
            dueDate: cells[2].textContent,
            signatureExpected: cells[3].textContent,
            salesLead: cells[4].textContent,
            revenueValue: parseFloat(cells[5].textContent.replace(/[$,]/g, '')),
            status: cells[6].querySelector('select').value
        };

        // Replace cells with input fields
        cells[0].innerHTML = `<input type="text" class="editable-input" value="${currentData.prospectName}">`;
        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.nextSteps}">`;
        cells[2].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[3].innerHTML = `
            <select class="editable-input">
                <option value="February 1st" ${currentData.signatureExpected === 'February 1st' ? 'selected' : ''}>February 1st</option>
                <option value="March 1st" ${currentData.signatureExpected === 'March 1st' ? 'selected' : ''}>March 1st</option>
            </select>
        `;
        cells[4].innerHTML = `
            <select class="editable-input">
                <option value="Robby" ${currentData.salesLead === 'Robby' ? 'selected' : ''}>Robby</option>
                <option value="Greyson" ${currentData.salesLead === 'Greyson' ? 'selected' : ''}>Greyson</option>
            </select>
        `;
        cells[5].innerHTML = `<input type="number" class="editable-input" value="${currentData.revenueValue}">`;

        // Replace edit/delete buttons with save/cancel buttons
        cells[7].innerHTML = `
            <button class="action-btn save-btn" title="Save"><i class="fas fa-save"></i></button>
            <button class="action-btn cancel-btn" title="Cancel"><i class="fas fa-times"></i></button>
        `;

        // Add save functionality
        const saveBtn = cells[7].querySelector(".save-btn");
        saveBtn.addEventListener("click", async () => {
            try {
                const updatedData = {
                    prospectName: cells[0].querySelector('input').value,
                    nextSteps: cells[1].querySelector('input').value,
                    dueDate: cells[2].querySelector('input').value,
                    signatureExpected: cells[3].querySelector('select').value,
                    salesLead: cells[4].querySelector('select').value,
                    revenueValue: parseFloat(cells[5].querySelector('input').value) || 0,
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
        const cancelBtn = cells[7].querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", () => {
            addProspectToTable(currentData, docId);
            newRow.remove();
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
    const rows = Array.from(tbody.getElementsByTagName("tr"));
    
    const statusPriority = {
        'In-Progress': 0,
        'Stalled': 1,
        'Won': 2,
        'Lost': 3
    };
    
    rows.sort((a, b) => {
        const statusA = a.querySelector('.status-dropdown').value;
        const statusB = b.querySelector('.status-dropdown').value;
        return statusPriority[statusA] - statusPriority[statusB];
    });
    
    rows.forEach(row => tbody.appendChild(row));
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
            robbyHeader.innerHTML = `<td colspan="8" class="pod-header">Robby's Prospects</td>`;
            tbody.appendChild(robbyHeader);
            
            robbyProspects.forEach(prospect => {
                addProspectToTable(prospect, prospect.id);
            });
        }

        // Add Greyson's prospects with header
        if (greysonProspects.length > 0) {
            const greysonHeader = document.createElement('tr');
            greysonHeader.innerHTML = `<td colspan="8" class="pod-header">Greyson's Prospects</td>`;
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadProspects();
    
    if (addProspectBtn) {
        addProspectBtn.addEventListener("click", addProspect);
    }
}); 