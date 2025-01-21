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

// DOM Elements
const tasksTable = document.getElementById('tasksTable');
const addTaskBtn = document.getElementById('addTaskBtn');
const tasksDueTodayEl = document.getElementById('tasksDueToday');
const totalTasksEl = document.getElementById('totalTasks');

// Add task function
async function addTask() {
    const taskInput = document.getElementById('taskInput');
    const assigneeInput = document.getElementById('assigneeInput');
    const dueDateInput = document.getElementById('dueDateInput');

    const taskText = taskInput.value.trim();
    const assignee = assigneeInput.value.trim();
    const dueDate = dueDateInput.value;

    if (!taskText) {
        alert("Please enter a task description");
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "tasks"), {
            taskText: taskText,
            assignee: assignee,
            dueDate: dueDate,
            completed: false,
            createdAt: new Date().toISOString()
        });

        console.log("Task added with ID:", docRef.id);

        // Clear inputs
        taskInput.value = '';
        assigneeInput.value = '';
        dueDateInput.value = '';

        // Reload tasks
        loadTasks();
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Error adding task: " + error.message);
    }
}

// Load tasks function
async function loadTasks() {
    console.log('Starting loadTasks function');
    const tbody = document.getElementById('tasksTable').querySelector('tbody');
    
    if (!tbody) {
        console.error('Could not find table body element');
        return;
    }
    
    tbody.innerHTML = '';

    try {
        const querySnapshot = await getDocs(collection(db, "tasks"));
        console.log('Number of tasks found:', querySnapshot.size);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Task data:', data);
            const row = createTaskRow(data, doc.id);
            tbody.appendChild(row);
        });

        updateTaskStatistics();
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

// Create task row function
function createTaskRow(data, id) {
    console.log('Creating row for task:', data);
    
    const row = document.createElement('tr');
    row.dataset.docId = id;
    
    row.innerHTML = `
        <td>${data.taskText || ''}</td>
        <td>${data.assignee || ''}</td>
        <td>${data.dueDate || ''}</td>
        <td>
            <button class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
            <button class="action-btn complete-btn"><i class="fas fa-check"></i></button>
        </td>
    `;

    // Add delete functionality
    row.querySelector('.delete-btn').addEventListener('click', () => deleteTask(id));

    // Add complete functionality
    row.querySelector('.complete-btn').addEventListener('click', () => completeTask(id));

    // Add edit functionality
    row.querySelector('.edit-btn').addEventListener('click', () => {
        const cells = row.cells;
        const currentData = {
            taskText: cells[0].textContent,
            assignee: cells[1].textContent,
            dueDate: cells[2].textContent
        };

        cells[0].innerHTML = `<input type="text" class="editable-input" value="${currentData.taskText}">`;
        cells[1].innerHTML = `<input type="text" class="editable-input" value="${currentData.assignee}">`;
        cells[2].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueDate}">`;
        cells[3].innerHTML = `
            <button class="action-btn save-btn"><i class="fas fa-save"></i></button>
            <button class="action-btn cancel-btn"><i class="fas fa-times"></i></button>
        `;

        // Add save functionality
        cells[3].querySelector('.save-btn').addEventListener('click', async () => {
            try {
                const updatedData = {
                    taskText: cells[0].querySelector('input').value,
                    assignee: cells[1].querySelector('input').value,
                    dueDate: cells[2].querySelector('input').value
                };

                await updateDoc(doc(db, "tasks", id), updatedData);
                loadTasks();
            } catch (error) {
                console.error("Error updating task:", error);
                alert("Error updating task: " + error.message);
            }
        });

        // Add cancel functionality
        cells[3].querySelector('.cancel-btn').addEventListener('click', loadTasks);
    });

    return row;
}

// Delete task function
async function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await deleteDoc(doc(db, "tasks", id));
            loadTasks();
        } catch (error) {
            console.error("Error deleting task:", error);
            alert("Error deleting task: " + error.message);
        }
    }
}

// Complete task function
async function completeTask(id) {
    try {
        await updateDoc(doc(db, "tasks", id), {
            completed: true
        });
        loadTasks();
    } catch (error) {
        console.error("Error completing task:", error);
        alert("Error completing task: " + error.message);
    }
}

// Update statistics
function updateTaskStatistics() {
    const rows = Array.from(tasksTable.getElementsByTagName('tr'));
    const today = new Date().toISOString().split('T')[0];
    
    const tasksDueToday = rows.filter(row => {
        const dueDate = row.cells?.[2]?.textContent;
        return dueDate === today;
    }).length;
    
    tasksDueTodayEl.textContent = tasksDueToday;
    totalTasksEl.textContent = rows.length - 1; // Subtract header row
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing tasks page...');
    loadTasks();
    
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addTask);
    } else {
        console.error('Add Task button not found');
    }
}); 