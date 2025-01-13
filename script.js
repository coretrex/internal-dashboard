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

// Add this CSS to your stylesheet or add it inline
const style = document.createElement('style');
style.textContent = `
    .overdue {
        background-color: #ff0000 !important;
        color: white !important;
    }
`;
document.head.appendChild(style);

// Login functionality
document.addEventListener('DOMContentLoaded', () => {
    const correctPassword = "2020";
    const loginOverlay = document.getElementById("loginOverlay");
    const dashboardContent = document.getElementById("dashboardContent");
    const loginButton = document.getElementById("loginButton");
    const passwordInput = document.getElementById("passwordInput");
    const loginError = document.getElementById("loginError");

    // Hide error message initially
    if (loginError) loginError.style.display = "none";

    // Login button click handler
    if (loginButton) {
        loginButton.addEventListener("click", () => {
            if (passwordInput.value === correctPassword) {
                loginOverlay.style.display = "none";
                dashboardContent.style.display = "block";
                // Initialize dashboard after successful login
                initializeDashboard();
            } else {
                loginError.style.display = "block";
                loginError.textContent = "Incorrect password. Please try again.";
            }
        });
    }

    // Enter key handler for password input
    if (passwordInput) {
        passwordInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                loginButton.click();
            }
        });
    }
});

// Separate function to initialize dashboard components
async function initializeDashboard() {
    await loadProspects();
    await loadTasks();
    await loadBrands();
    
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

    // Single place to initialize task button
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
        // Remove any existing listeners
        const newAddTaskBtn = addTaskBtn.cloneNode(true);
        addTaskBtn.parentNode.replaceChild(newAddTaskBtn, addTaskBtn);
        
        newAddTaskBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await addTask();
        });
    }

    // Set up brand button listener
    const addBrandBtn = document.getElementById('addBrandBtn');
    if (addBrandBtn) {
        addBrandBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await addBrand();
        });
    }

    // Set up prospect button listener
    const addProspectBtn = document.getElementById('addProspectBtn');
    if (addProspectBtn) {
        addProspectBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await addProspect();
        });
    }
}

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
    // Update prospect count - only count In-Progress prospects
    const inProgressProspects = Array.from(prospectsTable.rows).filter(row => {
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
    
    // Update client count by counting Pod 1 + Pod 2 clients from Brand Growth
    const brandsTable = document.getElementById('brandsTable');
    let totalClients = 0;
    if (brandsTable) {
        Array.from(brandsTable.rows).forEach(row => {
            const team = row.cells[1].textContent;
            if (team === 'Pod 1' || team === 'Pod 2') {
                totalClients++;
            }
        });
    }
    clientCountEl.innerHTML = `${totalClients}<span class="goal-text">/${clientGoal}</span>`;
    
    // Get today's date once for all calculations
    const today = new Date();
    
    // Update days before March
    const year = today.getFullYear();
    const marchFirst = new Date(year, 2, 1);
    if (today > marchFirst) {
        marchFirst.setFullYear(year + 1);
    }
    const diffTime = marchFirst - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysBeforeMarchEl.textContent = diffDays;

    // Update Tasks Due Today count
    const todayString = new Date().toISOString().split('T')[0];
    let tasksDueToday = 0;
    
    Array.from(prospectsTable.rows).forEach(row => {
        const nextStepsCell = row.cells[1];
        const dueDateCell = row.cells[2];
        const statusDropdown = row.querySelector('.status-dropdown');
        
        if (statusDropdown?.value === 'In-Progress' && 
            nextStepsCell?.textContent.trim() && 
            dueDateCell?.textContent && 
            dueDateCell.textContent <= todayString) {
            tasksDueToday++;
        }
    });
    
    if (document.getElementById('salesTasksDueToday')) {
        document.getElementById('salesTasksDueToday').textContent = tasksDueToday;
    }
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

    // Update status change handler
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
        cells[6].querySelector(".save-btn").addEventListener("click", async () => {
            try {
                const updatedData = {
                    prospectName: cells[0].querySelector('input').value.trim(),
                    nextSteps: cells[1].querySelector('input').value.trim(),
                    dueDate: cells[2].querySelector('input').value,
                    signatureExpected: cells[3].querySelector('select').value,
                    salesLead: cells[4].querySelector('select').value,
                    revenueValue: parseFloat(cells[5].querySelector('input').value),
                    status: statusDropdown.value
                };

                if (!updatedData.prospectName || !updatedData.dueDate || isNaN(updatedData.revenueValue) || updatedData.revenueValue <= 0) {
                    alert("Please fill in all required fields correctly.");
                    return;
                }

                await updateDoc(doc(db, "prospects", docId), updatedData);
                
                // Get today's date string for comparison
                const todayString = new Date().toISOString().split('T')[0];
                
                // Update cells directly without nesting td tags
                cells[0].textContent = updatedData.prospectName;
                cells[1].textContent = updatedData.nextSteps;
                cells[2].textContent = updatedData.dueDate;
                cells[2].className = updatedData.dueDate <= todayString ? 'overdue' : '';
                cells[3].textContent = updatedData.signatureExpected;
                cells[4].textContent = updatedData.salesLead;
                cells[5].textContent = `$${updatedData.revenueValue.toLocaleString()}`;
                
                // Restore status dropdown
                cells[6].innerHTML = `
                    <select class="status-dropdown">
                        <option value="In-Progress" ${updatedData.status === 'In-Progress' ? 'selected' : ''}>In-Progress</option>
                        <option value="Stalled" ${updatedData.status === 'Stalled' ? 'selected' : ''}>Stalled</option>
                        <option value="Won" ${updatedData.status === 'Won' ? 'selected' : ''}>Won</option>
                        <option value="Lost" ${updatedData.status === 'Lost' ? 'selected' : ''}>Lost</option>
                    </select>
                `;

                // Restore action buttons in the correct cell
                cells[7].innerHTML = `
                    <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                `;

                // Reattach event listeners
                const newStatusDropdown = cells[6].querySelector('.status-dropdown');
                const newEditBtn = cells[7].querySelector(".edit-btn");
                const newDeleteBtn = cells[7].querySelector(".delete-btn");
                
                // Reattach status change handler
                newStatusDropdown.addEventListener('change', statusDropdown.onchange);
                newEditBtn.addEventListener("click", editBtn.onclick);
                newDeleteBtn.addEventListener("click", deleteBtn.onclick);

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
        
        // Convert to array
        const prospects = [];
        querySnapshot.forEach((doc) => {
            prospects.push({
                ...doc.data(),
                id: doc.id
            });
        });

        // Sort by Sales Lead and date
        prospects.sort((a, b) => {
            // First compare by Sales Lead
            const leadCompare = (a.salesLead || '').localeCompare(b.salesLead || '');
            if (leadCompare !== 0) return leadCompare;
            
            // If same Sales Lead, compare by date
            const dateA = new Date(a.dueDate || 0);
            const dateB = new Date(b.dueDate || 0);
            return dateA - dateB;
        });
        
        // Add to table
        prospects.forEach(data => {
            addProspectToTable(data, data.id);
        });
        
        sortProspectsByStatus();
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
                <button class="action-btn complete-btn" title="Complete"><i class="fas fa-check"></i></button>
                <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
            ` : ''}
            <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
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

// Add these new functions for Brand Growth Dashboard
async function addBrand() {
    try {
        const brandName = document.getElementById('brandName').value.trim();
        const teamResponsible = document.getElementById('teamResponsible').value;
        const relationshipStatus = document.getElementById('relationshipStatus').value;
        const currentSensitivity = document.getElementById('currentSensitivity').value;
        const correctiveAction = document.getElementById('correctiveAction').value.trim();
        const dueBy = document.getElementById('dueBy').value;
        const trailing30Revenue = parseFloat(document.getElementById('trailing30Revenue').value);
        const yoyPercentage = parseFloat(document.getElementById('yoyPercentage').value);
        const nextMeetingDate = document.getElementById('nextMeetingDate').value;
        const taskStatus = document.getElementById('taskStatus').value;

        if (!brandName || !dueBy || !nextMeetingDate) {
            alert("Please fill in all required fields.");
            return;
        }

        const brandData = {
            brandName,
            teamResponsible,
            relationshipStatus,
            currentSensitivity,
            correctiveAction: correctiveAction || "None",
            dueBy,
            trailing30Revenue: trailing30Revenue || 0,
            yoyPercentage: yoyPercentage || 0,
            nextMeetingDate,
            taskStatus,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "brands"), brandData);
        addBrandToTable(brandData, docRef.id);

        // Clear form
        document.getElementById('brandName').value = "";
        document.getElementById('teamResponsible').value = "Pod 1";
        document.getElementById('relationshipStatus').value = "Medium";
        document.getElementById('currentSensitivity').value = "Poor Profit";
        document.getElementById('correctiveAction').value = "";
        document.getElementById('dueBy').value = "";
        document.getElementById('trailing30Revenue').value = "";
        document.getElementById('yoyPercentage').value = "";
        document.getElementById('nextMeetingDate').value = "";
        document.getElementById('taskStatus').value = "In Progress";

    } catch (error) {
        console.error("Error adding brand:", error);
        alert("Error adding brand: " + error.message);
    }
}

function addBrandToTable(data, docId) {
    const brandsTable = document.getElementById('brandsTable');
    const newRow = document.createElement("tr");
    newRow.dataset.docId = docId;
    
    // Add pod-specific class
    newRow.classList.add(data.teamResponsible === "Pod 1" ? 'row-pod1' : 'row-pod2');

    // Get today's date string for comparison
    const todayString = new Date().toISOString().split('T')[0];

    // Check if meeting date is in the past
    const isPastMeeting = data.nextMeetingDate < todayString;

    newRow.innerHTML = `
        <td>${data.brandName}</td>
        <td>${data.teamResponsible}</td>
        <td>${data.relationshipStatus}</td>
        <td>${data.currentSensitivity}</td>
        <td>${data.correctiveAction}</td>
        <td class="${data.dueBy <= todayString ? 'overdue' : ''}">${data.dueBy}</td>
        <td>$${data.trailing30Revenue.toLocaleString()}</td>
        <td>${data.yoyPercentage}%</td>
        <td class="${isPastMeeting ? 'past-meeting' : ''}">${data.nextMeetingDate}</td>
        <td>${data.taskStatus}</td>
        <td>
            <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
    `;

    // Add edit button functionality
    const editBtn = newRow.querySelector(".edit-btn");
    editBtn.addEventListener("click", () => {
        const cells = newRow.cells;
        const currentData = {
            brandName: cells[0].textContent,
            teamResponsible: cells[1].textContent,
            relationshipStatus: cells[2].textContent,
            currentSensitivity: cells[3].textContent,
            correctiveAction: cells[4].textContent,
            dueBy: cells[5].textContent,
            trailing30Revenue: parseFloat(cells[6].textContent.replace(/[$,]/g, '')),
            yoyPercentage: parseFloat(cells[7].textContent),
            nextMeetingDate: cells[8].textContent,
            taskStatus: cells[9].textContent
        };

        // Replace cells with input fields
        cells[0].innerHTML = `<input type="text" class="editable-input" value="${currentData.brandName}">`;
        cells[1].innerHTML = createSelectHTML('teamResponsible', ['Pod 1', 'Pod 2'], currentData.teamResponsible);
        cells[2].innerHTML = createSelectHTML('relationshipStatus', ['Poor', 'Medium', 'Strong'], currentData.relationshipStatus);
        cells[3].innerHTML = createSelectHTML('currentSensitivity', 
            ['Poor Profit', 'Stagnant Sales', 'Lack of Clarity', 'CoreTrex Cost', 'Lack of Trust'], 
            currentData.currentSensitivity);
        cells[4].innerHTML = `<input type="text" class="editable-input" value="${currentData.correctiveAction}">`;
        cells[5].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueBy}">`;
        cells[6].innerHTML = `<input type="number" step="0.01" class="editable-input" value="${currentData.trailing30Revenue}">`;
        cells[7].innerHTML = `<input type="number" step="0.01" class="editable-input" value="${currentData.yoyPercentage}">`;
        cells[8].innerHTML = `<input type="date" class="editable-input" value="${currentData.nextMeetingDate}">`;
        cells[9].innerHTML = createSelectHTML('taskStatus', 
            ['In Progress', 'Done', 'Waiting on Client'], 
            currentData.taskStatus);

        // Replace edit/delete buttons with save/cancel buttons
        cells[10].innerHTML = `
            <button class="action-btn save-btn">Save</button>
            <button class="action-btn cancel-btn">Cancel</button>
        `;

        // Add save functionality
        cells[10].querySelector(".save-btn").addEventListener("click", async () => {
            try {
                const updatedData = {
                    brandName: cells[0].querySelector('input').value.trim(),
                    teamResponsible: cells[1].querySelector('select').value,
                    relationshipStatus: cells[2].querySelector('select').value,
                    currentSensitivity: cells[3].querySelector('select').value,
                    correctiveAction: cells[4].querySelector('input').value.trim(),
                    dueBy: cells[5].querySelector('input').value,
                    trailing30Revenue: parseFloat(cells[6].querySelector('input').value),
                    yoyPercentage: parseFloat(cells[7].querySelector('input').value),
                    nextMeetingDate: cells[8].querySelector('input').value,
                    taskStatus: cells[9].querySelector('select').value
                };

                if (!updatedData.brandName || !updatedData.dueBy || !updatedData.nextMeetingDate) {
                    alert("Please fill in all required fields.");
                    return;
                }

                await updateDoc(doc(db, "brands", docId), updatedData);
                
                // Update cells directly
                cells[0].textContent = updatedData.brandName;
                cells[1].textContent = updatedData.teamResponsible;
                cells[2].textContent = updatedData.relationshipStatus;
                cells[3].textContent = updatedData.currentSensitivity;
                cells[4].textContent = updatedData.correctiveAction;
                cells[5].textContent = updatedData.dueBy;
                cells[6].textContent = `$${updatedData.trailing30Revenue.toLocaleString()}`;
                cells[7].textContent = `${updatedData.yoyPercentage}%`;
                cells[8].textContent = updatedData.nextMeetingDate;
                cells[9].textContent = updatedData.taskStatus;
                
                // Restore action buttons
                cells[10].innerHTML = `
                    <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                `;

                // Update row class
                newRow.className = updatedData.teamResponsible === "Pod 1" ? 'row-pod1' : 'row-pod2';

                // Reattach event listeners
                const newEditBtn = cells[10].querySelector(".edit-btn");
                const newDeleteBtn = cells[10].querySelector(".delete-btn");
                newEditBtn.addEventListener("click", editBtn.onclick);
                newDeleteBtn.addEventListener("click", deleteBtn.onclick);

                updateBrandStatistics();
                updateStatistics();
            } catch (error) {
                console.error("Error updating brand:", error);
                alert("Error updating brand: " + error.message);
            }
        });

        // Add cancel functionality
        const cancelBtn = cells[10].querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", () => {
            addBrandToTable(currentData, docId);
            newRow.remove();
        });
    });

    // Add delete button functionality
    const deleteBtn = newRow.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this brand?")) {
            try {
                await deleteDoc(doc(db, "brands", docId));
                newRow.remove();
            } catch (error) {
                console.error("Error deleting brand:", error);
                alert("Error deleting brand: " + error.message);
            }
        }
    });

    brandsTable.appendChild(newRow);
    updateBrandStatistics();
    updateStatistics();
}

// Helper function to create select HTML
function createSelectHTML(name, options, currentValue) {
    const optionsHTML = options.map(option => 
        `<option value="${option}" ${currentValue === option ? 'selected' : ''}>${option}</option>`
    ).join('');
    return `<select class="editable-input">${optionsHTML}</select>`;
}

async function loadBrands() {
    try {
        const querySnapshot = await getDocs(collection(db, "brands"));
        const brandsTable = document.getElementById('brandsTable');
        brandsTable.innerHTML = '';
        
        // Convert to array
        const brands = [];
        querySnapshot.forEach((doc) => {
            brands.push({
                ...doc.data(),
                id: doc.id
            });
        });

        // Sort by Pod first, then by due date
        brands.sort((a, b) => {
            // First compare by team (Pod)
            const teamCompare = a.teamResponsible.localeCompare(b.teamResponsible);
            if (teamCompare !== 0) return teamCompare;
            
            // If same team, compare by due date
            const dateA = a.dueBy || '';
            const dateB = b.dueBy || '';
            return dateA.localeCompare(dateB);
        });
        
        // Add to table
        brands.forEach(brand => {
            addBrandToTable(brand, brand.id);
        });
        
        updateBrandStatistics();
    } catch (error) {
        console.error("Error loading brands:", error);
    }
}

// Add this function after the existing functions
function updateBrandStatistics() {
    const brandsTable = document.getElementById('brandsTable');
    const rows = Array.from(brandsTable.rows);
    
    let pod1Count = 0;
    let pod2Count = 0;
    let poorRelationships = 0;
    let tasksDueToday = 0;
    let meetingsThisWeek = 0;
    
    // Get today's date string in YYYY-MM-DD format
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // Calculate the start and end of the current work week (Monday-Friday)
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    
    // Format dates for comparison
    const mondayString = monday.toISOString().split('T')[0];
    const fridayString = friday.toISOString().split('T')[0];
    
    rows.forEach(row => {
        const team = row.cells[1]?.textContent;
        const relationship = row.cells[2]?.textContent;
        const dueDateText = row.cells[5]?.textContent;
        const correctiveAction = row.cells[4]?.textContent;
        const nextMeetingDate = row.cells[8]?.textContent;
        
        if (team === 'Pod 1') pod1Count++;
        if (team === 'Pod 2') pod2Count++;
        if (relationship === 'Poor') poorRelationships++;
        
        // Count meetings scheduled for this work week
        if (nextMeetingDate && 
            nextMeetingDate >= mondayString && 
            nextMeetingDate <= fridayString) {
            meetingsThisWeek++;
        }
        
        // Only count tasks that have a corrective action and are due today or earlier
        if (correctiveAction?.trim() && 
            dueDateText && 
            dueDateText <= todayString) {
            tasksDueToday++;
        }
    });
    
    document.getElementById('pod1Count').textContent = pod1Count;
    document.getElementById('pod2Count').textContent = pod2Count;
    document.getElementById('poorRelationships').textContent = poorRelationships;
    document.getElementById('tasksDueToday').textContent = tasksDueToday;
    document.getElementById('meetingsThisWeek').textContent = meetingsThisWeek;
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
    await loadProspects();
    await loadTasks();
    console.log("Initial load complete");

    // Set up brand button listener
    const addBrandBtn = document.getElementById('addBrandBtn');
    if (addBrandBtn) {
        addBrandBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await addBrand();
        });
    }

    // Load brands
    await loadBrands();
});

// Add this function to sort prospects
function sortProspectsByStatus() {
    const tbody = document.getElementById('prospectsTable');
    const rows = Array.from(tbody.rows);
    
    // Define status priority (In-Progress first, others at the bottom)
    const statusPriority = {
        'In-Progress': 0,
        'Stalled': 1,
        'Won': 2,
        'Lost': 3
    };
    
    // Sort rows based on status priority
    rows.sort((a, b) => {
        const statusA = a.querySelector('.status-dropdown').value;
        const statusB = b.querySelector('.status-dropdown').value;
        return statusPriority[statusA] - statusPriority[statusB];
    });
    
    // Clear and re-append rows in new order
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

// Add this helper function to update row status classes
function updateRowStatusClass(row, status) {
    // Remove all status classes
    row.classList.remove('status-lost', 'status-won', 'status-stalled');
    
    // Add appropriate status class
    switch(status) {
        case 'Lost':
            row.classList.add('status-lost');
            break;
        case 'Won':
            row.classList.add('status-won');
            break;
        case 'Stalled':
            row.classList.add('status-stalled');
            break;
    }
}
