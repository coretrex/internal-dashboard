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

    // Add edit button alongside delete button
    newRow.innerHTML = `
        <td>${data.prospectName}</td>
        <td>${data.nextSteps}</td>
        <td>${data.dueDate}</td>
        <td>${data.signatureExpected}</td>
        <td>${data.salesLead}</td>
        <td>$${data.revenueValue.toLocaleString()}</td>
        <td>
            <button class="action-btn edit-btn">Edit</button>
            <button class="action-btn delete-btn">Delete</button>
        </td>
    `;

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
            revenueValue: parseFloat(cells[5].textContent.replace(/[$,]/g, ''))
        };

        // Replace cells with input fields
        cells[0].innerHTML = `<input type="text" class="editable-input" value="${currentData.prospectName}">`;
        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.nextSteps}">`;
        cells[2].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[3].innerHTML = `<select class="editable-input">
            <option value="February 1st" ${currentData.signatureExpected === 'February 1st' ? 'selected' : ''}>February 1st</option>
            <option value="March 1st" ${currentData.signatureExpected === 'March 1st' ? 'selected' : ''}>March 1st</option>
        </select>`;
        cells[4].innerHTML = `<select class="editable-input">
            <option value="Robby" ${currentData.salesLead === 'Robby' ? 'selected' : ''}>Robby</option>
            <option value="Greyson" ${currentData.salesLead === 'Greyson' ? 'selected' : ''}>Greyson</option>
        </select>`;
        cells[5].innerHTML = `<input type="number" class="editable-input" value="${currentData.revenueValue}">`;

        // Replace edit/delete buttons with save/cancel buttons
        cells[6].innerHTML = `
            <button class="action-btn save-btn">Save</button>
            <button class="action-btn cancel-btn">Cancel</button>
        `;

        // Add save functionality
        const saveBtn = cells[6].querySelector(".save-btn");
        saveBtn.addEventListener("click", async () => {
            try {
                const updatedData = {
                    prospectName: cells[0].querySelector('input').value.trim(),
                    nextSteps: cells[1].querySelector('input').value.trim(),
                    dueDate: cells[2].querySelector('input').value,
                    signatureExpected: cells[3].querySelector('select').value,
                    salesLead: cells[4].querySelector('select').value,
                    revenueValue: parseFloat(cells[5].querySelector('input').value)
                };

                // Validate data
                if (!updatedData.prospectName || !updatedData.dueDate || isNaN(updatedData.revenueValue) || updatedData.revenueValue <= 0) {
                    alert("Please fill in all required fields correctly.");
                    return;
                }

                await updateDoc(doc(db, "prospects", docId), updatedData);
                addProspectToTable(updatedData, docId);
                newRow.remove();
                updateStatistics();
            } catch (error) {
                console.error("Error updating prospect:", error);
                alert("Error updating prospect: " + error.message);
            }
        });

        // Add cancel functionality
        const cancelBtn = cells[6].querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", () => {
            addProspectToTable(currentData, docId);
            newRow.remove();
        });
    });

    // Existing delete button functionality
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
        
        updateStatistics();
    } catch (error) {
        console.error("Error loading prospects:", error);
    }
}

// Event Listeners
window.addEventListener("DOMContentLoaded", async () => {
    console.log("Page loading...");
    await loadProspects();
    console.log("Initial load complete");
});

addProspectBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await addProspect();
});
