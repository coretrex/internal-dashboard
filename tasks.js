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

// Add these global variables at the top
let isEditing = false;
let currentEditId = null;

// Remove any duplicate DOMContentLoaded listeners and combine into one
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing...');
    
    // Add event listener to form submission
    const taskForm = document.querySelector('#taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTaskSubmit();
        });
    }
    
    // Load tasks only once
    loadTasks();
}); 

// New function to handle both add and edit
async function handleTaskSubmit() {
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
        if (isEditing && currentEditId) {
            // Update existing task
            await updateDoc(doc(db, "tasks", currentEditId), {
                task: taskText,
                assignee: assignee,
                dueDate: dueDate
            });
            
            // Reset edit state
            isEditing = false;
            currentEditId = null;
            addTaskBtn.textContent = 'Add Task';
        } else {
            // Add new task
            await addDoc(collection(db, "tasks"), {
                task: taskText,
                assignee: assignee,
                dueDate: dueDate,
                completed: false
            });
        }

        // Clear inputs
        taskInput.value = '';
        assigneeInput.value = '';
        dueDateInput.value = '';

        // Reload tasks
        loadTasks();
    } catch (error) {
        console.error("Error with task:", error);
        alert("Error with task: " + error.message);
    }
}

// Create task row
function createTaskRow(data, id) {
    console.log('Creating row for task:', data);
    
    const row = document.createElement('tr');
    if (data.completed) {
        row.classList.add('completed');
    }
    
    row.innerHTML = `
        <td>${data.task}</td>
        <td>${data.assignee}</td>
        <td>${data.dueDate}</td>
        <td>
            <button class="action-btn edit-btn" ${data.completed ? 'disabled' : ''}><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
            <button class="action-btn complete-btn" ${data.completed ? 'disabled' : ''}><i class="fas fa-check"></i></button>
        </td>
    `;

    // Add delete functionality
    row.querySelector('.delete-btn').addEventListener('click', () => deleteTask(id));

    // Add complete functionality
    row.querySelector('.complete-btn').addEventListener('click', async () => {
        const taskRef = doc(db, "tasks", id);
        try {
            await updateDoc(taskRef, {
                completed: true
            });
            await loadTasks();
        } catch (error) {
            console.error("Error completing task:", error);
            alert("Error completing task: " + error.message);
        }
    });

    // Add edit functionality
    const editBtn = row.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
        const cells = row.querySelectorAll('td');
        
        // Only transform to input fields if not already editing
        if (!row.classList.contains('editing')) {
            row.classList.add('editing');
            
            cells[0].innerHTML = `<input type="text" value="${data.task}" class="edit-input">`;
            cells[1].innerHTML = `
                <select class="edit-input">
                    <option value="Robby" ${data.assignee === 'Robby' ? 'selected' : ''}>Robby</option>
                    <option value="Greyson" ${data.assignee === 'Greyson' ? 'selected' : ''}>Greyson</option>
                    <option value="Stephen" ${data.assignee === 'Stephen' ? 'selected' : ''}>Stephen</option>
                    <option value="Bobby" ${data.assignee === 'Bobby' ? 'selected' : ''}>Bobby</option>
                    <option value="Brandon" ${data.assignee === 'Brandon' ? 'selected' : ''}>Brandon</option>
                    <option value="Noah" ${data.assignee === 'Noah' ? 'selected' : ''}>Noah</option>
                </select>
            `;
            cells[2].innerHTML = `<input type="date" value="${data.dueDate}" class="edit-input">`;
            
            editBtn.innerHTML = '<i class="fas fa-save"></i>';
        } else {
            // Save the changes
            const updatedTask = cells[0].querySelector('input').value;
            const updatedAssignee = cells[1].querySelector('select').value;
            const updatedDueDate = cells[2].querySelector('input').value;

            updateDoc(doc(db, "tasks", id), {
                task: updatedTask,
                assignee: updatedAssignee,
                dueDate: updatedDueDate
            })
            .then(() => {
                loadTasks();
            })
            .catch((error) => {
                console.error("Error updating task:", error);
                alert("Error updating task: " + error.message);
            });
        }
    });

    return row;
}

// Load tasks
async function loadTasks() {
    console.log('Loading tasks...');
    const tbody = tasksTable.querySelector('tbody');
    
    // Clear existing tasks first
    if (tbody) {
        tbody.innerHTML = '';
    }

    try {
        const querySnapshot = await getDocs(collection(db, "tasks"));
        console.log('Found tasks:', querySnapshot.size);

        // Create a Set to track unique IDs
        const processedIds = new Set();

        // Sort tasks by completion status first, then by due date
        const tasks = [];
        querySnapshot.forEach((doc) => {
            if (!processedIds.has(doc.id)) {
                tasks.push({ id: doc.id, ...doc.data() });
                processedIds.add(doc.id);
            }
        });

        tasks.sort((a, b) => {
            // First sort by completion status (completed tasks go to bottom)
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;
            // Then sort by due date for tasks with same completion status
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        // Create rows for sorted tasks
        tasks.forEach((taskData) => {
            const row = createTaskRow(taskData, taskData.id);
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