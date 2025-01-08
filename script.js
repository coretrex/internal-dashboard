// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc 
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
const clientGoal = 30;
const prospectGoal = 30;
const prospectMRRGoal = 100000;

// DOM Elements
const clientCountEl = document.getElementById('clientCount');
const daysBeforeMarchEl = document.getElementById('daysBeforeMarch');
const prospectCountEl = document.getElementById('prospectCount');
const prospectMRREl = document.getElementById('prospectMRR');
const prospectsTable = document.getElementById('prospectsTable');
const addProspectBtn = document.getElementById('addProspectBtn');

// Initialize sort state at the top with other constants
let currentSort = {
    column: 4,  // Default to Sales Lead column (index 4)
    direction: 'asc'
};

// Modify the sortTable function
function sortTable(column) {
    const tbody = document.getElementById('prospectsTable');
    const rows = Array.from(tbody.rows);
    
    // Determine sort direction
    const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
    
    // Update sort state
    currentSort.column = column;
    currentSort.direction = direction;

    // Sort the rows
    rows.sort((a, b) => {
        let aValue = a.cells[column].textContent.trim();
        let bValue = b.cells[column].textContent.trim();

        // Handle different data types
        if (column === 5) { // Revenue column
            aValue = parseFloat(aValue.replace(/[$,]/g, ''));
            bValue = parseFloat(bValue.replace(/[$,]/g, ''));
        } else if (column === 2) { // Due Date column
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }

        if (direction === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });

    // Reorder the table
    rows.forEach(row => tbody.appendChild(row));

    // Update sort arrows
    updateSortArrows(column, direction);
}

// Add this function to update sort arrows
function updateSortArrows(column, direction) {
    const headers = document.querySelectorAll('.dashboard-table th');
    headers.forEach((header, index) => {
        // Remove existing arrows
        header.textContent = header.textContent.replace(' ↑', '').replace(' ↓', '');
        
        // Add arrow to current sort column
        if (index === column) {
            header.textContent += direction === 'asc' ? ' ↑' : ' ↓';
        }
    });
}

// Statistics function
function updateStatistics() {
    // Update prospect count
    const prospectCount = prospectsTable.rows.length;
    prospectCountEl.innerHTML = `${prospectCount}<span class="goal-text">/${prospectGoal}</span>`;
    
    // Update prospect MRR
    let totalRevenue = 0;
    Array.from(prospectsTable.rows).forEach(row => {
        const revenueCell = row.cells[5];
        if (revenueCell) {
            const revenue = parseInt(revenueCell.textContent.replace(/[$,]/g, '')) || 0;
            totalRevenue += revenue;
        }
    });
    prospectMRREl.innerHTML = `$${totalRevenue.toLocaleString()}<span class="goal-text">/$${prospectMRRGoal.toLocaleString()}</span>`;
    
    // Update client count
    clientCountEl.innerHTML = `15<span class="goal-text">/${clientGoal}</span>`;
    
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

// Add prospect to table
function addProspectToTable(data, docId) {
    const newRow = document.createElement("tr");
    newRow.dataset.docId = docId;

    newRow.innerHTML = `
        <td>${data.prospectName}</td>
        <td>${data.nextSteps}</td>
        <td>${data.dueDate}</td>
        <td>${data.signatureExpected}</td>
        <td>${data.salesLead}</td>
        <td>$${data.revenueValue.toLocaleString()}</td>
        <td>
            <button class="action-btn delete-btn">Delete</button>
        </td>
    `;

    const deleteBtn = newRow.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async () => {
        try {
            await deleteDoc(doc(db, "prospects", docId));
            newRow.remove();
            updateStatistics();
        } catch (error) {
            console.error("Error deleting prospect:", error);
            alert("Error deleting prospect: " + error.message);
        }
    });

    prospectsTable.appendChild(newRow);
    updateStatistics();
}

// Add new prospect
async function addProspect() {
    try {
        const prospectName = document.getElementById('prospectName').value.trim();
        const nextSteps = document.getElementById('nextSteps').value.trim();
        const dueDate = document.getElementById('dueDate').value;
        const signatureExpected = document.getElementById('signatureExpected').value;
        const salesLead = document.getElementById('salesLead').value;
        const revenueRaw = parseFloat(document.getElementById('revenueValue').value);

        if (!prospectName || !dueDate || isNaN(revenueRaw) || revenueRaw <= 0) {
            alert("Please fill in all required fields correctly.");
            return;
        }

        const prospectData = {
            prospectName,
            nextSteps: nextSteps || "None",
            dueDate,
            signatureExpected,
            salesLead,
            revenueValue: Math.round(revenueRaw),
            createdAt: new Date().toISOString()
        };

        console.log("Saving prospect:", prospectData);

        const docRef = await addDoc(collection(db, "prospects"), prospectData);
        console.log("Document written with ID:", docRef.id);

        addProspectToTable(prospectData, docRef.id);

        // Clear form
        document.getElementById('prospectName').value = "";
        document.getElementById('nextSteps').value = "";
        document.getElementById('dueDate').value = "";
        document.getElementById('signatureExpected').value = "February 1st";
        document.getElementById('salesLead').value = "Robby";
        document.getElementById('revenueValue').value = "";

        updateStatistics();
    } catch (error) {
        console.error("Error adding prospect:", error);
        alert("Error adding prospect: " + error.message);
    }
}

// Load prospects
async function loadProspects() {
    try {
        const querySnapshot = await getDocs(collection(db, "prospects"));
        prospectsTable.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addProspectToTable(data, doc.id);
        });
        
        // Apply initial sort to Sales Lead column
        sortTable(4);
        updateStatistics();
    } catch (error) {
        console.error("Error loading prospects:", error);
        alert("Error loading prospects: " + error.message);
    }
}

// Add click handlers to headers
function setupSortableHeaders() {
    const headers = document.querySelectorAll('.dashboard-table th');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTable(index));
    });
}

// Event Listeners
window.addEventListener("DOMContentLoaded", async () => {
    console.log("Page loading...");
    setupSortableHeaders();
    await loadProspects();
    console.log("Initial load complete");
});

addProspectBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await addProspect();
});
