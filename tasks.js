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
    const taskInput = document.getElementById('taskDescription');
    const assigneeInput = document.getElementById('taskAssignee');
    const dueDateInput = document.getElementById('taskDueDate');

    const taskText = taskInput.value.trim();
    const assignee = assigneeInput.value.trim();
    const dueDate = dueDateInput.value;

    if (!taskText || !dueDate || !assignee) {
        alert("Please fill in all required fields");
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "tasks"), {
            task: taskText,
            dueDate,
            assignee,
            completed: false
        });

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

// Create task row
function createTaskRow(data, id) {
    console.log('Creating row for task:', data);
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${data.task}</td>
        <td>${data.assignee}</td>
        <td>${data.dueDate}</td>
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

    return row;
}

// Load tasks
async function loadTasks() {
    console.log('Loading tasks...');
    const tbody = tasksTable.querySelector('tbody');
    tbody.innerHTML = ''; // Clear existing tasks

    try {
        const querySnapshot = await getDocs(collection(db, "tasks"));
        console.log('Found tasks:', querySnapshot.size);

        querySnapshot.forEach((doc) => {
            const taskData = doc.data();
            console.log('Task data:', taskData);
            const row = createTaskRow(taskData, doc.id);
            tbody.appendChild(row);
        });

        updateTaskStatistics();
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

// Delete task
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

// Complete task
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing...');
    loadTasks();
    addTaskBtn.addEventListener('click', addTask);
}); 