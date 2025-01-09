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

// Login functionality
document.addEventListener('DOMContentLoaded', () => {
    const correctPassword = "2020";
    const loginOverlay = document.getElementById("loginOverlay");
    const dashboardContent = document.getElementById("dashboardContent");
    const loginButton = document.getElementById("loginButton");
    const passwordInput = document.getElementById("passwordInput");
    const loginError = document.getElementById("loginError");

    loginButton.addEventListener("click", () => {
        if (passwordInput.value === correctPassword) {
            loginOverlay.style.display = "none";
            dashboardContent.style.display = "block";
        } else {
            loginError.style.display = "block";
            loginError.textContent = "Incorrect password. Please try again.";
        }
    });

    passwordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            loginButton.click();
        }
    });
});

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
let tasksTable, addTaskBtn;

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

// Make sure you have these variables at the top with other constants
let currentSort = {
    column: 4,  // Default to Sales Lead column
    direction: 'asc'
};

// Modify the sortTable function
function sortTable(column) {
    const tbody = document.getElementById('prospectsTable');
    const rows = Array.from(tbody.rows);
    
    // Store the current data before sorting
    const rowData = rows.map(row => ({
        data: {
            prospectName: row.cells[0].textContent,
            nextSteps: row.cells[1].textContent,
            dueDate: row.cells[2].textContent,
            signatureExpected: row.cells[3].textContent,
            salesLead: row.cells[4].textContent,
            revenueValue: parseFloat(row.cells[5].textContent.replace(/[$,]/g, '')),
        },
        docId: row.dataset.docId
    }));

    // Determine sort direction
    const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
    
    // Update sort state
    currentSort.column = column;
    currentSort.direction = direction;

    // Sort the data
    rowData.sort((a, b) => {
        let aValue = Object.values(a.data)[column];
        let bValue = Object.values(b.data)[column];

        if (column === 5) { // Revenue column
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
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

    // Clear and rebuild table
    tbody.innerHTML = '';
    rowData.forEach(({ data, docId }) => {
        addProspectToTable(data, docId);
    });

    // Update sort arrows
    updateSortArrows(column, direction);
}

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
                
                // Re-sort the table after update
                sortTable(currentSort.column);
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

    // Add delete button functionality
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
}

function updateSortArrows(column, direction) {
    const headers = document.querySelectorAll('.dashboard-table th');
    headers.forEach((header, index) => {
        // Store the original header text without arrows if not already stored
        if (!header.dataset.originalText) {
            header.dataset.originalText = header.textContent;
        }
        
        // Reset to original text first
        header.textContent = header.dataset.originalText;
        
        // Add arrow to current sort column
        if (index === column) {
            header.textContent += direction === 'asc' ? ' ↑' : ' ↓';
        }
    });
}

// Make sure to call this in your DOMContentLoaded event
function setupSortableHeaders() {
    const headers = document.querySelectorAll('.dashboard-table th');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTable(index));
    });
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

// Add these new functions after your existing functions
async function addTask() {
    try {
        const taskName = document.getElementById('taskName').value.trim();
        const taskAssignee = document.getElementById('taskAssignee').value;
        const taskDueDate = document.getElementById('taskDueDate').value;

        if (!taskName || !taskDueDate) {
            alert("Please fill in all required fields.");
            return;
        }

        const taskData = {
            taskName,
            assignee: taskAssignee,
            dueDate: taskDueDate,
            completed: false,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "tasks"), taskData);
        addTaskToTable(taskData, docRef.id);

        // Clear form
        document.getElementById('taskName').value = "";
        document.getElementById('taskAssignee').value = "Greyson";
        document.getElementById('taskDueDate').value = "";
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Error adding task: " + error.message);
    }
}

function addTaskToTable(data, docId) {
    const newRow = document.createElement("tr");
    newRow.dataset.docId = docId;
    
    // Add completed class if task is completed
    if (data.completed) {
        newRow.classList.add('completed-task');
    }

    newRow.innerHTML = `
        <td>${data.taskName}</td>
        <td>${data.assignee}</td>
        <td>${data.dueDate}</td>
        <td>
            ${!data.completed ? `
                <button class="action-btn complete-btn">Complete</button>
                <button class="action-btn edit-btn">Edit</button>
            ` : ''}
            <button class="action-btn delete-btn">Delete</button>
        </td>
    `;

    // Add complete button functionality
    const completeBtn = newRow.querySelector(".complete-btn");
    if (completeBtn) {
        completeBtn.addEventListener("click", async () => {
            try {
                // Update the data object
                const updatedData = {
                    ...data,
                    completed: true,
                    completedAt: new Date().toISOString()
                };

                // Update in Firebase
                await updateDoc(doc(db, "tasks", docId), updatedData);
                
                // Update the row's appearance immediately
                newRow.classList.add('completed-task');
                
                // Remove the complete and edit buttons
                completeBtn.remove();
                newRow.querySelector('.edit-btn')?.remove();
                
                // Reload tasks to resort the list
                await loadTasks();
            } catch (error) {
                console.error("Error completing task:", error);
                alert("Error completing task: " + error.message);
            }
        });
    }

    // Add delete button functionality
    const deleteBtn = newRow.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async () => {
        try {
            await deleteDoc(doc(db, "tasks", docId));
            newRow.remove();
        } catch (error) {
            console.error("Error deleting task:", error);
            alert("Error deleting task: " + error.message);
        }
    });

    // Add edit button functionality if not completed
    const editBtn = newRow.querySelector(".edit-btn");
    if (editBtn) {
        editBtn.addEventListener("click", () => {
            const cells = newRow.cells;
            const currentData = {
                taskName: cells[0].textContent,
                assignee: cells[1].textContent,
                dueDate: cells[2].textContent
            };

            cells[0].innerHTML = `<input type="text" class="editable-input" value="${currentData.taskName}">`;
            cells[1].innerHTML = `<select class="editable-input">
                <option value="Greyson" ${currentData.assignee === 'Greyson' ? 'selected' : ''}>Greyson</option>
                <option value="Robby" ${currentData.assignee === 'Robby' ? 'selected' : ''}>Robby</option>
                <option value="Stephen" ${currentData.assignee === 'Stephen' ? 'selected' : ''}>Stephen</option>
            </select>`;
            cells[2].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;

            cells[3].innerHTML = `
                <button class="action-btn save-btn">Save</button>
                <button class="action-btn cancel-btn">Cancel</button>
            `;

            // Add save functionality
            const saveBtn = cells[3].querySelector(".save-btn");
            saveBtn.addEventListener("click", async () => {
                try {
                    const updatedData = {
                        taskName: cells[0].querySelector('input').value.trim(),
                        assignee: cells[1].querySelector('select').value,
                        dueDate: cells[2].querySelector('input').value
                    };

                    if (!updatedData.taskName || !updatedData.dueDate) {
                        alert("Please fill in all required fields.");
                        return;
                    }

                    await updateDoc(doc(db, "tasks", docId), updatedData);
                    addTaskToTable(updatedData, docId);
                    newRow.remove();
                } catch (error) {
                    console.error("Error updating task:", error);
                    alert("Error updating task: " + error.message);
                }
            });

            // Add cancel functionality
            const cancelBtn = cells[3].querySelector(".cancel-btn");
            cancelBtn.addEventListener("click", () => {
                addTaskToTable(currentData, docId);
                newRow.remove();
            });
        });
    }

    tasksTable.appendChild(newRow);
}

async function loadTasks() {
    try {
        const querySnapshot = await getDocs(collection(db, "tasks"));
        tasksTable.innerHTML = '';
        
        // Convert to array and sort
        const tasks = [];
        querySnapshot.forEach((doc) => {
            tasks.push({
                ...doc.data(),
                id: doc.id
            });
        });

        // Sort tasks: incomplete first, then by date
        tasks.sort((a, b) => {
            if (a.completed === b.completed) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
            return a.completed ? 1 : -1;
        });

        // Add to table
        tasks.forEach(task => {
            addTaskToTable(task, task.id);
        });
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

// Modify your existing DOMContentLoaded event listener to include this:
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Page loading...");
    
    // Initialize elements
    tasksTable = document.getElementById('tasksTable');
    addTaskBtn = document.getElementById('addTaskBtn');
    
    // Set up task button listener
    if (addTaskBtn) {
        addTaskBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Add task button clicked");
            await addTask();
        });
    }

    // Set up navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.getAttribute('data-page');
            navButtons.forEach(btn => btn.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(pageId).classList.add('active');
        });
    });

    // Load initial data
    setupSortableHeaders();
    await loadProspects();
    await loadTasks();
    console.log("Initial load complete");
});

addProspectBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await addProspect();
});
