// CoreTrex Projects - Firestore-backed project, subproject, and task management
import { initializeFirebase } from './firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  getDocsFromServer,
  getDocFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  limit,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Removed Firebase Storage imports - using base64 storage in Firestore instead

let app, db;
let cachedUsers = null; // [{id, name, email, photoURL}]
// Track tasks that were just marked completed to prevent flicker reappearance
const pendingCompletedTaskIds = new Set();
// Guard against duplicate recurring creations within a short window
const recentRecurringCreations = new Map(); // taskId -> timestamp (ms)
function shouldCreateNextRecurring(taskId) {
  try {
    const now = Date.now();
    // Clean stale entries (> 10s)
    for (const [tid, ts] of recentRecurringCreations.entries()) {
      if (now - ts > 10000) recentRecurringCreations.delete(tid);
    }
    const last = recentRecurringCreations.get(taskId) || 0;
    if (now - last < 3000) {
      // Suppress duplicate within 3s
      return false;
    }
    recentRecurringCreations.set(taskId, now);
    return true;
  } catch (_) {
    return true;
  }
}
// Store real-time listeners for cleanup
const subprojectListeners = new Map(); // podId -> unsubscribe function
const taskListeners = new Map(); // `${podId}_${subId}` -> unsubscribe function

async function initializeFirebaseApp() {
  const firebaseInstance = await initializeFirebase();
  app = firebaseInstance.app;
  db = firebaseInstance.db;
}

async function loadAssignableUsers() {
  if (cachedUsers) return cachedUsers;
  try {
    const snap = await getDocs(collection(db, 'users'));
    const arr = [];
    snap.forEach(d => {
      const u = d.data() || {};
      arr.push({ id: d.id, name: u.displayName || u.name || u.email || 'User', email: u.email || '', photoURL: u.photoURL || '' });
    });
    cachedUsers = arr;
    return cachedUsers;
  } catch (e) {
    // Fallback to current local user if available
    const name = localStorage.getItem('userName') || '';
    const email = localStorage.getItem('userEmail') || '';
    cachedUsers = name || email ? [{ id: 'me', name: name || email, email }] : [];
    return cachedUsers;
  }
}

const podInfo = [
  { id: 'pod1', title: 'Pod 1', icon: 'fa-rocket' },
  { id: 'pod2', title: 'Pod 2', icon: 'fa-dumbbell' },
  { id: 'pod3', title: 'Pod 3', icon: 'fa-meteor' },
  { id: 'sales', title: 'Sales', icon: 'fa-chart-line' },
  { id: 'billing', title: 'Billing', icon: 'fa-credit-card' }
];

// In-memory registry of subprojects keyed by pod id
const podToProjects = new Map();

// Store sorting state for each subproject: { subprojectId: { column: 'dueDate'|'assignee'|'status', direction: 'asc'|'desc' } }
const subprojectSortState = new Map();

// Timer state
let timerInterval = null;
let timerSeconds = 0;
let timerPaused = false;
let currentTimerTask = null;
let originalDocumentTitle = document.title;

function updateTabTitleForTimer() {
  try {
    if (currentTimerTask && typeof timerSeconds === 'number' && timerSeconds >= 0) {
      const minutes = Math.floor(timerSeconds / 60);
      const seconds = timerSeconds % 60;
      const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const icon = timerPaused ? '⏸' : '⏱';
      const rawName = currentTimerTask.taskName || 'Task';
      const shortName = rawName.length > 40 ? rawName.slice(0, 37) + '…' : rawName;
      document.title = `${icon} ${timeStr} • ${shortName}`;
    } else {
      document.title = originalDocumentTitle;
    }
  } catch (_) {
    // Ignore any errors updating the title
  }
}

function resetTabTitle() {
  try { document.title = originalDocumentTitle; } catch (_) {}
}

// Helper function to update task count for a subproject
function updateTaskCount(subprojectCard) {
  const incompleteUl = subprojectCard.querySelector('ul:not(.completed-list)');
  // Count only visible tasks (respecting the My Tasks filter)
  const visibleTasks = incompleteUl ? Array.from(incompleteUl.querySelectorAll('li')).filter(li => {
    const display = li.style.display;
    return !display || display !== 'none';
  }) : [];
  const taskCount = visibleTasks.length;
  const countSpan = subprojectCard.querySelector('.task-count');
  if (countSpan) {
    countSpan.textContent = taskCount;
    // Hide count if there are no tasks
    countSpan.style.display = taskCount > 0 ? 'inline-flex' : 'none';
    
    // Check if any visible tasks are overdue
    const todayStr = getLocalTodayString();
    
    let hasOverdue = false;
    visibleTasks.forEach(taskLi => {
      const dateInput = taskLi.querySelector('.date-input');
      if (dateInput && dateInput.value && dateInput.value < todayStr) {
        hasOverdue = true;
      }
    });
    
    // Apply overdue class if needed
    if (hasOverdue) {
      countSpan.classList.add('has-overdue');
    } else {
      countSpan.classList.remove('has-overdue');
    }
  }
}

// Helper function to update KPI values for the currently visible pod
function updateKPIs() {
  // Get today's date in YYYY-MM-DD format
  const todayStr = getLocalTodayString();
  
  let dueToday = 0;
  let overdue = 0;
  let total = 0;
  let myTasks = 0;
  
  // Get current user's name from localStorage
  const userName = localStorage.getItem('userName') || '';
  const userFirstName = userName.split(' ')[0];
  
  // Get only visible pod cards
  const visiblePods = document.querySelectorAll('.pod-card[style*="display: none"]');
  const allPods = document.querySelectorAll('.pod-card');
  
  // Find which pods are currently visible
  const visiblePodsList = Array.from(allPods).filter(pod => {
    const style = pod.getAttribute('style');
    return !style || !style.includes('display: none');
  });
  
  // Get incomplete tasks only from visible pods - only count visible tasks (respecting filter)
  visiblePodsList.forEach(pod => {
    const incompleteTasks = pod.querySelectorAll('.task-list > ul:not(.completed-list) > li');
    
    incompleteTasks.forEach(taskLi => {
      // Skip hidden tasks (filtered out by My Tasks filter)
      const display = taskLi.style.display;
      if (display === 'none') {
        return;
      }
      
      total++;
      
      // Check if task is assigned to current user
      const assigneeDisplay = taskLi.querySelector('.assignee-display');
      if (assigneeDisplay && userFirstName) {
        const assigneeText = assigneeDisplay.textContent;
        if (assigneeText.includes(userFirstName)) {
          myTasks++;
        }
      }
      
      const dateInput = taskLi.querySelector('.date-input');
      if (dateInput && dateInput.value) {
        const dueDate = dateInput.value; // Format: YYYY-MM-DD
        
        if (dueDate === todayStr) {
          dueToday++;
        } else if (dueDate < todayStr) {
          overdue++;
        }
      }
    });
  });
  
  // Update KPI displays
  const kpiMyTasksEl = document.getElementById('kpiMyTasks');
  const kpiDueTodayEl = document.getElementById('kpiDueToday');
  const kpiOverdueEl = document.getElementById('kpiOverdue');
  const kpiTotalEl = document.getElementById('kpiTotal');
  
  if (kpiMyTasksEl) {
    kpiMyTasksEl.textContent = myTasks;
    // Add visual indicator if there are overdue tasks assigned to user
    if (myTasks > 0) {
      kpiMyTasksEl.style.color = '#2196F3';
    } else {
      kpiMyTasksEl.style.color = '';
    }
  }
  if (kpiDueTodayEl) kpiDueTodayEl.textContent = dueToday;
  if (kpiOverdueEl) kpiOverdueEl.textContent = overdue;
  if (kpiTotalEl) kpiTotalEl.textContent = total;
}

function createPodElement(pod) {
  const podDiv = document.createElement('div');
  podDiv.className = 'pod-card';
  podDiv.dataset.podId = pod.id;

  // Add Subproject Button
  const addSubBtn = document.createElement('button');
  addSubBtn.className = 'add-subproject-link';
  addSubBtn.textContent = '+ Add Subproject';
  podDiv.appendChild(addSubBtn);
  // Subproject container
  const subContainer = document.createElement('div');
  subContainer.className = 'subprojects-container';
  podDiv.appendChild(subContainer);

  // Track subprojects for this pod
  podToProjects.set(pod.id, []);

  // Load live subprojects and tasks from Firestore
  loadSubprojectsInto(pod.id, subContainer);

  // Setup drag & drop ordering for this pod's subprojects (container-level)
  setupDragAndDrop(subContainer, pod.id);
  // Add new subproject interaction
  addSubBtn.addEventListener('click', async () => {
    const newName = "New Project";
    // Persist to Firestore
    const podRef = doc(db, 'pods', pod.id);
    const subCol = collection(podRef, 'subprojects');
    const subDoc = await addDoc(subCol, { name: newName, createdAt: Date.now(), order: 0 });
    // Add to UI
    const sub = createSubProjectElement(newName, pod.id, subDoc.id);
    // Insert at the top of the list
    if (subContainer.firstChild) {
      subContainer.insertBefore(sub, subContainer.firstChild);
    } else {
      subContainer.appendChild(sub);
    }
    // Register at the beginning so ordering is consistent
    registerSubproject(pod.id, newName, sub, subDoc.id, /*addToStart*/ true);
    // Optionally: expand/click header so user sees/focuses the new subproject
    const header = sub.querySelector('.subproject-header');
    if (header) header.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Do not change filters or hide other projects
    // Normalize and persist new order values
    await persistSubprojectOrder(pod.id, subContainer);
  });

  return podDiv;
}

function createSubProjectElement(subTitle, podId, subprojectId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'subproject-card';
  wrapper.dataset.podId = podId;
  wrapper.dataset.projectName = subTitle;
  if (subprojectId) wrapper.dataset.subprojectId = subprojectId;
  // Enable drag & drop reordering
  wrapper.setAttribute('draggable', 'true');

  // Accordion Header
  const header = document.createElement('div');
  header.className = 'subproject-header';
  header.innerHTML = `
    <span class="expand-control"><i class="fas fa-caret-right"></i></span>
    <span class="subproject-title">${subTitle}</span>
    <span class="task-count">0</span>
    <div>
      <button class="action-btn delete-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
    </div>
  `;
  wrapper.appendChild(header);
  // Accordion Content (Initially hidden)
  const taskContent = document.createElement('div');
  taskContent.className = 'task-list hidden'; // toggle .hidden for open/closed
  // Column header
  const headerRow = document.createElement('div');
  headerRow.className = 'task-header';
  headerRow.innerHTML = `
    <div>Task Description</div>
    <div class="sortable-header" data-column="assignee" style="cursor: pointer; user-select: none;">
      Assignee <i class="fas fa-sort sort-icon"></i>
    </div>
    <div class="sortable-header" data-column="dueDate" style="cursor: pointer; user-select: none;">
      Due date <i class="fas fa-sort-up sort-icon active"></i>
    </div>
    <div class="sortable-header" data-column="status" style="cursor: pointer; user-select: none;">
      Status <i class="fas fa-sort sort-icon"></i>
    </div>
  `;
  taskContent.appendChild(headerRow);
  
  // Initialize default sort state (by due date ascending)
  if (subprojectId && !subprojectSortState.has(subprojectId)) {
    subprojectSortState.set(subprojectId, { column: 'dueDate', direction: 'asc' });
  }
  
  // Add click handlers for sortable headers
  headerRow.querySelectorAll('.sortable-header').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.column;
      const currentState = subprojectSortState.get(subprojectId) || { column: 'dueDate', direction: 'asc' };
      
      // Toggle direction if same column, otherwise default to ascending
      let newDirection = 'asc';
      if (currentState.column === column) {
        newDirection = currentState.direction === 'asc' ? 'desc' : 'asc';
      }
      
      // Update sort state
      subprojectSortState.set(subprojectId, { column, direction: newDirection });
      
      // Update sort icons
      headerRow.querySelectorAll('.sortable-header').forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (h.dataset.column === column) {
          icon.className = `fas fa-sort-${newDirection === 'asc' ? 'up' : 'down'} sort-icon active`;
        } else {
          icon.className = 'fas fa-sort sort-icon';
        }
      });
      
      // Re-sort tasks
      const taskUl = wrapper.querySelector('ul:not(.completed-list)');
      if (taskUl) {
        loadTasksInto(podId, subprojectId, taskUl);
      }
    });
  });
  // Tasks list
  const taskUl = document.createElement('ul');
  taskContent.appendChild(taskUl);
  // Completed tasks (hidden by default, controlled globally)
  const completedUl = document.createElement('ul');
  completedUl.className = 'completed-list hidden';
  completedUl.dataset.podId = podId;
  completedUl.dataset.subprojectId = subprojectId;
  taskContent.appendChild(completedUl);
  // Add Task button at the bottom of the task list
  const addTaskBtn = document.createElement('button');
  addTaskBtn.className = 'add-task-link add-task-btn';
  addTaskBtn.type = 'button';
  addTaskBtn.textContent = '+ Add Task';
  // Place Add Task at the bottom (after completed list)
  taskContent.appendChild(addTaskBtn);
  wrapper.appendChild(taskContent);
  // Accordion interaction
  header.querySelector('.expand-control').onclick = () => {
    taskContent.classList.toggle('hidden');
    header.querySelector('.expand-control i').classList.toggle('fa-caret-down');
    header.querySelector('.expand-control i').classList.toggle('fa-caret-right');
    // Toggle expanded style on the subproject bar
    if (taskContent.classList.contains('hidden')) {
      wrapper.classList.remove('expanded');
    } else {
      wrapper.classList.add('expanded');
    }
  };
  // Drag origin handlers
  wrapper.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', wrapper.dataset.subprojectId || '');
    wrapper.classList.add('dragging');
  });
  wrapper.addEventListener('dragend', () => {
    wrapper.classList.remove('dragging');
  });
  // Add task interaction (only visible when expanded)
  addTaskBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const subId = wrapper.dataset.subprojectId;
    if (!subId) return;
    
    // Open the new task modal instead of directly creating
    openNewTaskModal(podId, subId, taskUl, taskContent, header);
  });
  // Rename subproject handled via double-click on title (inline editor below)
  // Inline rename on double-click
  const titleSpan = header.querySelector('.subproject-title');
  titleSpan.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const original = titleSpan.textContent;
    titleSpan.contentEditable = 'true';
    titleSpan.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(titleSpan);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function finish(save) {
      titleSpan.contentEditable = 'false';
      titleSpan.removeEventListener('blur', onBlur);
      titleSpan.removeEventListener('keydown', onKey);
      const next = titleSpan.textContent.trim();
      if (!save || next === '' || next === original) {
        titleSpan.textContent = original;
        return;
      }
      // Persist
      const subId = wrapper.dataset.subprojectId;
      const podRef = doc(db, 'pods', podId);
      const subRef = doc(podRef, 'subprojects', subId);
      updateDoc(subRef, { name: next }).then(() => {
        wrapper.dataset.projectName = next;
        refreshTopLinksSelection(podId, next);
      }).catch(() => {
        titleSpan.textContent = original;
      });
    }

    function onBlur() { finish(true); }
    function onKey(ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    }

    titleSpan.addEventListener('blur', onBlur);
    titleSpan.addEventListener('keydown', onKey);
  });
  // Delete subproject (with custom modal)
  header.querySelector('.delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const confirmed = await showConfirmModal('Are you sure you want to delete this project and all of its tasks?');
    if (!confirmed) return;
    const subId = wrapper.dataset.subprojectId;
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    // Best-effort: UI removal first; Firestore delete
    wrapper.remove();
    await deleteDoc(subRef);
  });
  return wrapper;
}

// Helper function to parse time string (HH:MM) into hour and minute
function parseTime(timeStr) {
  if (!timeStr) return { hour: 9, minute: 0 };
  const parts = timeStr.split(':');
  return {
    hour: parseInt(parts[0]) || 9,
    minute: parseInt(parts[1]) || 0
  };
}

// Helper function to format time for display (HH:MM -> "9:30 AM" or "14:30")
function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const { hour, minute } = parseTime(timeStr);
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

// Helper function to create time string from hour and minute
function createTimeString(hour, minute) {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// Helper function to format date as month/day (e.g., "12/25" or "Jan 25")
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${day}`;
}

// Helper to get today's date string in local timezone (YYYY-MM-DD)
function getLocalTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function createTaskItem(taskData, podId, subId, taskId) {
  const li = document.createElement('li');
  // Store task ID as data attribute for real-time updates
  li.dataset.taskId = taskId;
  const safe = (v) => (v == null ? '' : v);
  const statusLower = (taskData.status || 'Open').toLowerCase();
  const isCompleted = taskData.completed;
  const hasDesc = !!(taskData.longDescription && String(taskData.longDescription).trim().length > 0);
  const hasAtch = Array.isArray(taskData.attachments) && taskData.attachments.length > 0;
  // (deprecated) detailsIcons removed in favor of a single comment icon
  li.innerHTML = `
    <div class="task-checkbox-cell"><input type="checkbox" class="task-toggle" ${isCompleted ? 'checked' : ''}></div>
    <div class="task-name-cell">
      <span class="task-text">${safe(taskData.text)}</span>
      ${hasDesc || hasAtch ? `<span class=\"task-comment-indicator\" title=\"This task has additional details\"><i class=\"fas fa-comment-dots\"></i></span>` : ''}
      <div class="task-timer-buttons">
        <button class="task-timer-btn" data-minutes="10" title="Start 10 minute timer">10m</button>
        <button class="task-timer-btn" data-minutes="30" title="Start 30 minute timer">30m</button>
        <button class="task-timer-btn" data-minutes="60" title="Start 60 minute timer">60m</button>
      </div>
    </div>
    <div class="task-assignee">
      <div class="assignee-multiselect" tabindex="0">
        <div class="assignee-display">${Array.isArray(taskData.assignees) && taskData.assignees.length ? safe(taskData.assignees.map(a=>a.name||a.email).join(', ')) : (safe(taskData.assignee) || 'Unassigned')}</div>
        <div class="assignee-menu hidden"></div>
      </div>
    </div>
    <div class="task-date ${taskData.dueTime ? 'has-time-set' : ''}">
      <input class="task-input date-input" type="date" value="${safe(taskData.dueDate)}" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;" />
      ${taskData.dueDate ? `<span class="date-display" style="cursor: pointer; user-select: none;">${formatDateDisplay(taskData.dueDate)}</span>` : '<span class="date-placeholder" style="cursor: pointer; user-select: none; color: #999; font-style: italic;">Add date</span>'}
      ${taskData.dueTime ? `
        <span class="time-display" data-time="${safe(taskData.dueTime)}">${formatTimeDisplay(taskData.dueTime)}</span>
        <button class="time-icon-btn has-time" type="button" title="Change time">
          <i class="fas fa-clock"></i>
        </button>
      ` : `
        <button class="time-icon-btn" type="button" title="Set time">
          <i class="fas fa-clock"></i>
        </button>
      `}
      <button class="date-icon-btn ${taskData.dueDate ? 'has-date' : ''}" type="button" title="${taskData.dueDate ? 'Change date' : 'Add date'}">
        <i class="fas fa-calendar"></i>
      </button>
      <div class="time-picker-container" style="display: none;">
        <div class="time-picker">
          <div class="time-picker-section">
            <label>Hour</label>
            <input type="range" class="time-hour-slider" min="0" max="23" value="${taskData.dueTime ? parseTime(taskData.dueTime).hour : 9}" />
            <span class="time-hour-display">${taskData.dueTime ? (() => { const h = parseTime(taskData.dueTime).hour; const dh = h % 12 || 12; const ampm = h < 12 ? 'AM' : 'PM'; return `${dh} ${ampm}`; })() : '9 AM'}</span>
          </div>
          <div class="time-picker-section">
            <label>Minute</label>
            <div class="time-minute-buttons">
              <button class="time-minute-btn ${taskData.dueTime && parseTime(taskData.dueTime).minute === 0 ? 'active' : ''}" data-minute="0">:00</button>
              <button class="time-minute-btn ${taskData.dueTime && parseTime(taskData.dueTime).minute === 30 ? 'active' : ''}" data-minute="30">:30</button>
            </div>
          </div>
          <div class="time-picker-actions">
            <button class="time-picker-clear" type="button">Clear</button>
            <button class="time-picker-save" type="button">Save</button>
          </div>
        </div>
      </div>
    </div>
    <div class="task-status">
      <select class="task-select status-select">
        <option value="Open" ${statusLower==='open' ? 'selected' : ''}>Open</option>
        <option value="Recurring" ${statusLower==='recurring' ? 'selected' : ''}>Recurring</option>
        <option value="On-Hold" ${statusLower==='on-hold' ? 'selected' : ''}>On-Hold</option>
        <option value="Waiting on Client Feedback" ${statusLower==='waiting on client feedback' ? 'selected' : ''}>Waiting on Client Feedback</option>
        <option value="In-Progress" ${statusLower==='in-progress' ? 'selected' : ''}>In-Progress</option>
        <option value="Awaiting Front-End Verification" ${statusLower==='awaiting front-end verification' ? 'selected' : ''}>Awaiting Front-End Verification</option>
      </select>
    </div>
    <div class="task-actions" style="display:flex; align-items:center; gap:4px; justify-content:flex-end; min-width:76px; padding-left:10px;">
      <button class="action-btn duplicate-btn" title="Duplicate" style="background:#f5f7ff; border:1px solid #dbe3ff; color:#3f51b5; border-radius:8px; padding:6px 8px;">
        <i class="fa-regular fa-clone"></i>
      </button>
      <button class="action-btn delete-btn" title="Delete" style="border-radius:8px; padding:6px 8px;">
        <i class="fa-regular fa-trash-can"></i>
      </button>
    </div>
  `;
  const checkbox = li.querySelector('.task-toggle');
  const textSpan = li.querySelector('.task-text');
  const assigneeMulti = li.querySelector('.assignee-multiselect');
  const dateInput = li.querySelector('.date-input');
  const datePlaceholder = li.querySelector('.date-placeholder');
  const dateIconBtn = li.querySelector('.date-icon-btn');
  const timeIconBtn = li.querySelector('.time-icon-btn');
  const timeDisplay = li.querySelector('.time-display');
  const timePickerContainer = li.querySelector('.time-picker-container');
  const timeHourSlider = li.querySelector('.time-hour-slider');
  const timeHourDisplay = li.querySelector('.time-hour-display');
  const timeMinuteButtons = li.querySelectorAll('.time-minute-btn');
  const timePickerSave = li.querySelector('.time-picker-save');
  const timePickerClear = li.querySelector('.time-picker-clear');
  const statusSelect = li.querySelector('.status-select');
  
  // Function to open date picker
  const openDatePicker = () => {
    if (dateInput.showPicker) {
      dateInput.showPicker();
    } else {
      dateInput.click();
    }
  };
  
  // Make date placeholder clickable
  if (datePlaceholder) {
    datePlaceholder.addEventListener('click', (e) => {
      e.stopPropagation();
      openDatePicker();
    });
  }
  
  // Make calendar icon button clickable
  if (dateIconBtn) {
    dateIconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDatePicker();
    });
  }
  async function handleCompletionToggle(isCompleted) {
    // Capture row position BEFORE checkbox hides the row via CSS
    const liRect = li.getBoundingClientRect();
    const centerX = liRect.left + liRect.width / 2;
    const centerY = liRect.top + liRect.height / 2;
    checkbox.checked = isCompleted;
    textSpan.classList.toggle('task-completed', checkbox.checked);
    const parentListContainer = li.closest('.task-list');
    const incompleteUl = parentListContainer?.querySelector('ul');
    const completedUl = parentListContainer?.querySelector('.completed-list');
    console.log('[Projects] Completion toggle', {
      podId,
      subId,
      taskId,
      isCompleted,
      hasCompletedUl: !!completedUl,
      hasIncompleteUl: !!incompleteUl
    });
    if (checkbox.checked) {
      if (taskId) pendingCompletedTaskIds.add(taskId);
      // Use captured position so the animation is centered even if the row hides immediately
      triggerBobbyFirework(centerX, centerY);
      // Play completion sound
      playCompletionSound();
      
      // Persist completion status to Firestore FIRST before creating recurring task
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        try {
          await updateDoc(taskRef, { 
            completed: true,
            lastModifiedBy: currentUserName,
            lastModifiedByEmail: currentUserEmail,
            lastModifiedAt: Date.now()
          });
        } catch (e) {
          console.error('[Projects] Error persisting completion:', e);
        }
      }
      
      // Fetch latest task data from Firestore to check for recurring settings
      let latestTaskData = taskData;
      if (podId && subId && taskId) {
        try {
          const podRef = doc(db, 'pods', podId);
          const subRef = doc(podRef, 'subprojects', subId);
          const taskRef = doc(subRef, 'tasks', taskId);
          const taskSnap = await getDoc(taskRef);
          if (taskSnap.exists()) {
            latestTaskData = taskSnap.data();
          }
        } catch (e) {
          console.error('[Recurring] Error fetching latest task data:', e);
        }
      }
      
      // Handle recurring tasks - create next instance
      if (latestTaskData.recurring && latestTaskData.recurring.isRecurring && shouldCreateNextRecurring(taskId)) {
        // Calculate from TODAY's date, not the task's original due date
        const todayStr = getLocalTodayString();
        const nextDueDate = calculateNextRecurringDate(todayStr, latestTaskData.recurring);
        if (nextDueDate && podId && subId) {
          // Create a new task with the next due date
          const podRef = doc(db, 'pods', podId);
          const subRef = doc(podRef, 'subprojects', subId);
          // Determine creator for the new recurring instance
          const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
          const currentUserEmail = localStorage.getItem('userEmail') || '';
          // Use deterministic ID to prevent duplicates if triggered twice
          const newTaskId = `${taskId || 'task'}__next__${nextDueDate}`;
          await setDoc(doc(subRef, 'tasks', newTaskId), {
            text: latestTaskData.text,
            completed: false,
            createdBy: currentUserName,
            createdByEmail: currentUserEmail,
            assignee: latestTaskData.assignee || '',
            assignees: latestTaskData.assignees || [],
            dueDate: nextDueDate,
            dueTime: latestTaskData.dueTime || '',
            status: latestTaskData.status || 'Open',
            longDescription: latestTaskData.longDescription || '',
            attachments: latestTaskData.attachments || [],
            recurring: latestTaskData.recurring,
            createdAt: Date.now()
          });
          // After real-time listener adds it, highlight the new task
          setTimeout(() => {
            try { highlightNewTask(newTaskId); } catch(_) {}
          }, 500);
          // Real-time listener will automatically add the new task to the UI
        }
      }
      
      // Remove from DOM immediately - real-time listener will handle the rest
      li.remove();
      console.log('[Projects] Task completed and removed from UI', { taskId });
      
      // If completed list is currently visible, add it there
      if (completedUl && !completedUl.classList.contains('hidden')) {
        // Reload completed tasks to include this newly completed task
        await loadCompletedTasksInto(podId, subId, completedUl);
      }
      
      updateCompletedToggleText(incompleteUl);
      // Update task count
      const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
      if (subprojectCard) updateTaskCount(subprojectCard);
      // Update KPIs
      updateKPIs();
    }
    if (!checkbox.checked) {
      if (taskId) pendingCompletedTaskIds.delete(taskId);
      
      // Persist unchecked status - real-time listener will handle UI update
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        try {
          await updateDoc(taskRef, { 
            completed: false,
            lastModifiedBy: currentUserName,
            lastModifiedByEmail: currentUserEmail,
            lastModifiedAt: Date.now()
          });
        } catch (e) {
          console.error('[Projects] Error uncompleting task:', e);
        }
      }
      
      // Remove from completed list DOM - real-time listener will add it to incomplete list
      li.remove();
      console.log('[Projects] Task uncompleted and removed from completed list', { taskId });
      
      updateCompletedToggleText(incompleteUl);
      // Update task count
      const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
      if (subprojectCard) updateTaskCount(subprojectCard);
      // Update KPIs
      updateKPIs();
    }
  }

  checkbox.addEventListener('change', async () => { await handleCompletionToggle(checkbox.checked); });
  // Inline edit on double-click
  textSpan.addEventListener('dblclick', () => startInlineEdit());

  // Open drawer when clicking row outside of editable controls
  li.addEventListener('click', async (e) => {
    const editableTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'];
    // Ignore clicks that are within interactive controls
    if (
      editableTags.includes(e.target.tagName) ||
      e.target.closest('.task-actions') ||
      e.target.closest('.assignee-multiselect') ||
      e.target.closest('.task-assignee')
    ) return;
    await openTaskDrawer({
      podId,
      subId,
      taskId,
      title: textSpan.textContent,
      longDescription: taskData.longDescription || '',
      attachments: taskData.attachments || []
    });
  });
  // Inline editors for other columns
  // Build multiselect options
  (async () => {
    const users = await loadAssignableUsers();
    const menu = assigneeMulti.querySelector('.assignee-menu');
    menu.innerHTML = users.map(u => {
      const checked = (Array.isArray(taskData.assignees) ? taskData.assignees : []).some(a => a.id === u.id);
      return `<label class="assignee-option"><input type="checkbox" data-user-id="${u.id}" ${checked ? 'checked' : ''}/> <span>${u.name || u.email}</span></label>`;
    }).join('');
  })();
  function openMenu() { 
    const menu = assigneeMulti.querySelector('.assignee-menu');
    menu.classList.remove('hidden'); 
    
    // Check if menu would be cut off at bottom and open upward if needed
    const rect = assigneeMulti.getBoundingClientRect();
    const menuHeight = 250; // Approximate max height of the menu
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // If not enough space below (less than menu height + 80px for nav), but more space above, open upward
    if (spaceBelow < menuHeight + 80 && spaceAbove > menuHeight) {
      menu.classList.add('open-upward');
    } else {
      menu.classList.remove('open-upward');
    }
  }
  function closeMenu() { 
    const menu = assigneeMulti.querySelector('.assignee-menu');
    menu.classList.add('hidden'); 
    menu.classList.remove('open-upward');
  }
  assigneeMulti.addEventListener('click', (e) => {
    const menu = assigneeMulti.querySelector('.assignee-menu');
    if (e.target.tagName === 'INPUT') return; // checkbox click
    if (menu.classList.contains('hidden')) {
      openMenu();
    } else {
      closeMenu();
    }
  });
  document.addEventListener('click', (e)=>{ if(!assigneeMulti.contains(e.target)) closeMenu(); });
  assigneeMulti.addEventListener('change', async () => {
    const checked = Array.from(assigneeMulti.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.getAttribute('data-user-id'));
    const users = await loadAssignableUsers();
    const selected = users.filter(u => checked.includes(u.id));
    // Update display
    assigneeMulti.querySelector('.assignee-display').textContent = selected.length ? selected.map(s=>s.name||s.email).join(', ') : 'Unassigned';
    // Save array and legacy single assignee (first)
    quickSave('assignees', selected);
    if (selected.length) quickSave('assignee', selected[0].name || selected[0].email); else quickSave('assignee', '');
  });
  // Update date display when date changes
  const dateDisplay = li.querySelector('.date-display');
  const dateCell = dateInput.parentElement;
  
  function updateDateDisplay() {
    if (dateInput.value) {
      // Remove placeholder if it exists
      const placeholder = dateCell.querySelector('.date-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
      
      if (dateDisplay) {
        dateDisplay.textContent = formatDateDisplay(dateInput.value);
        dateDisplay.style.display = 'inline';
      } else {
        const newDateDisplay = document.createElement('span');
        newDateDisplay.className = 'date-display';
        newDateDisplay.textContent = formatDateDisplay(dateInput.value);
        newDateDisplay.style.cursor = 'pointer';
        newDateDisplay.style.userSelect = 'none';
        // Insert after the hidden date input
        dateInput.insertAdjacentElement('afterend', newDateDisplay);
        // Make date display clickable to open date picker
        newDateDisplay.addEventListener('click', (e) => {
          e.stopPropagation();
          openDatePicker();
        });
      }
      
      // Update calendar button title and class
      if (dateIconBtn) {
        dateIconBtn.title = 'Change date';
        dateIconBtn.classList.add('has-date');
      }
    } else {
      // Remove date display if it exists
      if (dateDisplay) {
        dateDisplay.remove();
      }
      
      // Add placeholder if it doesn't exist
      if (!dateCell.querySelector('.date-placeholder')) {
        const newPlaceholder = document.createElement('span');
        newPlaceholder.className = 'date-placeholder';
        newPlaceholder.style.cursor = 'pointer';
        newPlaceholder.style.userSelect = 'none';
        newPlaceholder.style.color = '#999';
        newPlaceholder.style.fontStyle = 'italic';
        newPlaceholder.textContent = 'Add date';
        dateInput.insertAdjacentElement('afterend', newPlaceholder);
        // Make placeholder clickable
        newPlaceholder.addEventListener('click', (e) => {
          e.stopPropagation();
          openDatePicker();
        });
      }
      
      // Update calendar button title and class
      if (dateIconBtn) {
        dateIconBtn.title = 'Add date';
        dateIconBtn.classList.remove('has-date');
      }
    }
  }
  
  // Make date display clickable to open date picker
  if (dateDisplay) {
    dateDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      openDatePicker();
    });
  }
  
  dateInput.addEventListener('change', () => {
    quickSave('dueDate', dateInput.value);
    updateDateDisplay();
    updateKPIs();
  });
  
  // Initialize date display
  updateDateDisplay();
  
  // Initialize time picker
  let currentHour = taskData.dueTime ? parseTime(taskData.dueTime).hour : 9;
  let currentMinute = taskData.dueTime ? parseTime(taskData.dueTime).minute : 0;
  
  // Close time picker when clicking outside (only for this specific task)
  const closeTimePicker = (e) => {
    if (timePickerContainer && timePickerContainer.style.display !== 'none' && 
        !timePickerContainer.contains(e.target) && 
        !timeIconBtn?.contains(e.target)) {
      timePickerContainer.style.display = 'none';
      document.removeEventListener('click', closeTimePicker);
    }
  };
  
  // Update hour display as slider moves
  if (timeHourSlider && timeHourDisplay) {
    timeHourSlider.addEventListener('input', () => {
      currentHour = parseInt(timeHourSlider.value);
      const displayHour = currentHour % 12 || 12;
      const ampm = currentHour < 12 ? 'AM' : 'PM';
      timeHourDisplay.textContent = `${displayHour} ${ampm}`;
    });
  }
  
  // Handle minute button clicks
  timeMinuteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timeMinuteButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMinute = parseInt(btn.dataset.minute);
    });
  });
  
  // Save time
  if (timePickerSave) {
    timePickerSave.addEventListener('click', (e) => {
      e.stopPropagation();
      const timeString = createTimeString(currentHour, currentMinute);
      quickSave('dueTime', timeString);
      
      // Update UI to show time display
      if (timeDisplay) {
        timeDisplay.textContent = formatTimeDisplay(timeString);
        timeDisplay.setAttribute('data-time', timeString);
        timeDisplay.style.display = 'inline';
      } else {
        // Create time display if it doesn't exist
        const newTimeDisplay = document.createElement('span');
        newTimeDisplay.className = 'time-display';
        newTimeDisplay.textContent = formatTimeDisplay(timeString);
        newTimeDisplay.setAttribute('data-time', timeString);
        dateInput.insertAdjacentElement('afterend', newTimeDisplay);
      }
      
      // Add class to date cell to hide calendar icon
      const dateCell = dateInput.parentElement;
      if (dateCell) {
        dateCell.classList.add('has-time-set');
      }
      
      if (timeIconBtn) {
        timeIconBtn.classList.add('has-time');
        timeIconBtn.title = `Time: ${formatTimeDisplay(timeString)}`;
      }
      
      timePickerContainer.style.display = 'none';
      document.removeEventListener('click', closeTimePicker);
    });
  }
  
  // Clear time
  if (timePickerClear) {
    timePickerClear.addEventListener('click', (e) => {
      e.stopPropagation();
      quickSave('dueTime', '');
      
      // Remove time display
      if (timeDisplay) {
        timeDisplay.remove();
      }
      
      // Remove class from date cell to show calendar icon again
      const dateCell = dateInput.parentElement;
      if (dateCell) {
        dateCell.classList.remove('has-time-set');
      }
      
      if (timeIconBtn) {
        timeIconBtn.classList.remove('has-time');
        timeIconBtn.title = 'Set time';
      }
      
      timePickerContainer.style.display = 'none';
      document.removeEventListener('click', closeTimePicker);
    });
  }
  
  // Toggle time picker visibility when clock icon is clicked
  if (timeIconBtn) {
    timeIconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timePickerContainer.style.display === 'none') {
        timePickerContainer.style.display = 'flex';
        // Decide direction: open upward for bottom three visible tasks in this list
        try {
          const ul = li.parentElement;
          if (ul) {
            const visibleLis = Array.from(ul.querySelectorAll(':scope > li')).filter(row => row.style.display !== 'none');
            const idx = visibleLis.indexOf(li);
            const isBottomThree = idx >= Math.max(0, visibleLis.length - 3);
            if (isBottomThree) {
              timePickerContainer.classList.add('open-upward');
            } else {
              timePickerContainer.classList.remove('open-upward');
            }
          }
        } catch (_) {
          // ignore any measurement errors
        }
        // Reset to current time or default
        if (taskData.dueTime) {
          const parsed = parseTime(taskData.dueTime);
          currentHour = parsed.hour;
          currentMinute = parsed.minute;
        } else {
          currentHour = 9;
          currentMinute = 0;
        }
        if (timeHourSlider) {
          timeHourSlider.value = currentHour;
          const displayHour = currentHour % 12 || 12;
          const ampm = currentHour < 12 ? 'AM' : 'PM';
          if (timeHourDisplay) timeHourDisplay.textContent = `${displayHour} ${ampm}`;
        }
        timeMinuteButtons.forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.minute) === currentMinute);
        });
        // Add listener to close when clicking outside
        setTimeout(() => {
          document.addEventListener('click', closeTimePicker);
        }, 0);
      } else {
        timePickerContainer.style.display = 'none';
        timePickerContainer.classList.remove('open-upward');
        document.removeEventListener('click', closeTimePicker);
      }
    });
  }
  
  // Add recurring icon button next to date input
  const recurringBtn = document.createElement('button');
  recurringBtn.className = 'recurring-icon-btn';
  recurringBtn.innerHTML = '<i class="fas fa-repeat"></i>';
  recurringBtn.title = 'Set recurring';
  recurringBtn.type = 'button';
  recurringBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openRecurringModal(podId, subId, taskId, dateInput, taskData.recurring);
  });
  dateCell.appendChild(recurringBtn);
  
  // Update recurring button appearance if task is recurring
  if (taskData.recurring && taskData.recurring.isRecurring) {
    recurringBtn.classList.add('is-recurring');
  }
  // style status select based on value
  function applyStatusStyle() {
    const val = (statusSelect.value || 'Open').toLowerCase();
    statusSelect.classList.remove('status-open', 'status-recurring', 'status-on-hold', 'status-waiting', 'status-in-progress', 'status-awaiting');
    if (val === 'open') statusSelect.classList.add('status-open');
    else if (val === 'recurring') statusSelect.classList.add('status-recurring');
    else if (val === 'on-hold') statusSelect.classList.add('status-on-hold');
    else if (val === 'waiting on client feedback') statusSelect.classList.add('status-waiting');
    else if (val === 'in-progress') statusSelect.classList.add('status-in-progress');
    else if (val === 'awaiting front-end verification') statusSelect.classList.add('status-awaiting');
  }
  applyStatusStyle();
  statusSelect.addEventListener('change', async () => {
    applyStatusStyle();
    const value = statusSelect.value;
    
    // Save status normally
    quickSave('status', value);
  });

  function startInlineEdit() {
    const original = textSpan.textContent;
    textSpan.contentEditable = 'true';
    textSpan.focus();
    const range = document.createRange();
    range.selectNodeContents(textSpan);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function finish(save) {
      textSpan.contentEditable = 'false';
      textSpan.removeEventListener('blur', onBlur);
      textSpan.removeEventListener('keydown', onKey);
      const next = textSpan.textContent.trim();
      if (!save || next === '' || next === original) {
        textSpan.textContent = original;
        return;
      }
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        updateDoc(taskRef, { 
          text: next,
          lastModifiedBy: currentUserName,
          lastModifiedByEmail: currentUserEmail,
          lastModifiedAt: Date.now()
        });
      }
    }

    function onBlur() { finish(true); }
    function onKey(ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    }
    textSpan.addEventListener('blur', onBlur);
    textSpan.addEventListener('keydown', onKey);
  }

  function quickSave(field, value) {
    if (podId && subId && taskId) {
      const podRef = doc(db, 'pods', podId);
      const subRef = doc(podRef, 'subprojects', subId);
      const taskRef = doc(subRef, 'tasks', taskId);
      // Always track who made the change and when
      const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
      const currentUserEmail = localStorage.getItem('userEmail') || '';
      updateDoc(taskRef, { 
        [field]: value,
        lastModifiedBy: currentUserName,
        lastModifiedByEmail: currentUserEmail,
        lastModifiedAt: Date.now()
      }).then(() => {
        console.log('[Projects] Saved', field, '=', value, 'for task', taskId);
      }).catch((error) => {
        console.error('[Projects] Error saving', field, ':', error);
      });
    }
  }
  // Duplicate task handler
  const duplicateBtn = li.querySelector('.duplicate-btn');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const newTaskId = await duplicateTask(podId, subId, taskId);
        if (newTaskId) {
          setTimeout(() => {
            highlightNewTask(newTaskId);
          }, 400);
        }
      } catch (err) {
        console.error('[Projects] Duplicate failed:', err);
        alert('Failed to duplicate task. Please try again.');
      }
    });
  }
  li.querySelector('.delete-btn').addEventListener('click', () => {
    showConfirmModal('Are you sure you want to delete this task?').then((ok) => {
      if (!ok) return;
      li.remove();
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        deleteDoc(taskRef);
      }
      // Update task count after deletion
      const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
      if (subprojectCard) {
        updateTaskCount(subprojectCard);
      }
      // Update KPIs
      updateKPIs();
    });
  });
  
  // Timer button handlers
  li.querySelectorAll('.task-timer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const minutes = parseInt(btn.dataset.minutes);
      startTaskTimer(taskData.text, minutes, podId, subId, taskId, taskData.longDescription, taskData.attachments);
    });
  });
  
  return li;
}

// Create a duplicate of a task in Firestore (returns new task id)
async function duplicateTask(podId, subId, taskId) {
  if (!podId || !subId || !taskId) return null;
  try {
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) return null;
    const src = snap.data() || {};
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    // Prepare cloned payload
    const cloned = {
      text: (src.text || 'Untitled') + ' (Copy)',
      completed: false,
      createdAt: Date.now(),
      createdBy: currentUserName,
      createdByEmail: currentUserEmail,
      assignee: src.assignee || '',
      assignees: Array.isArray(src.assignees) ? src.assignees : [],
      dueDate: src.dueDate || '',
      dueTime: src.dueTime || '',
      status: src.status || 'Open',
      longDescription: src.longDescription || '',
      attachments: Array.isArray(src.attachments) ? src.attachments.map(a => ({ ...a })) : [],
      recurring: src.recurring || null,
      lastModifiedBy: currentUserName,
      lastModifiedByEmail: currentUserEmail,
      lastModifiedAt: Date.now()
    };
    const tasksCol = collection(subRef, 'tasks');
    const newDoc = await addDoc(tasksCol, cloned);
    return newDoc.id;
  } catch (e) {
    console.error('[Projects] Error duplicating task:', e);
    throw e;
  }
}

// Timer functions
async function startTaskTimer(taskName, minutes, podId, subId, taskId, longDescription = '', attachments = []) {
  // Fetch fresh task data from Firestore to ensure we have latest description and attachments
  if (podId && subId && taskId) {
    try {
      const podRef = doc(db, 'pods', podId);
      const subRef = doc(podRef, 'subprojects', subId);
      const taskRef = doc(subRef, 'tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        const taskData = taskSnap.data();
        longDescription = taskData.longDescription || '';
        attachments = taskData.attachments || [];
      }
    } catch (error) {
      console.error('Error fetching task data for timer:', error);
    }
  }
  
  // Store current task info
  currentTimerTask = { taskName, podId, subId, taskId, longDescription, attachments: attachments || [] };
  
  // Set timer duration
  timerSeconds = minutes * 60;
  timerPaused = false;
  
  // Show timer modal
  const timerModal = document.getElementById('taskTimerModal');
  if (timerModal) {
    timerModal.style.display = 'flex';
    document.getElementById('timerTaskName').textContent = taskName;
    updateTimerDisplay();
    
    // Update long description textarea - prepare for editing
    const descContainer = document.getElementById('timerDescriptionContainer');
    const descTextarea = document.getElementById('timerDescriptionTextarea');
    if (descContainer && descTextarea) {
      descTextarea.value = longDescription || '';
    }
    
    // Update attachments - prepare for editing
    renderTimerAttachments();
    
    // Hide details section by default
    const detailsSection = document.getElementById('timerDetailsSection');
    if (detailsSection) {
      detailsSection.style.display = 'none';
    }
    
    // Reset toggle button
    const toggleBtn = document.getElementById('toggleTimerDetailsBtn');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show Details';
    }
    
    // Update stats
    updateTimerStats();
    
    // Start countdown
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!timerPaused && timerSeconds > 0) {
        timerSeconds--;
        updateTimerDisplay();
        
        // Play alarm when timer reaches 0
        if (timerSeconds === 0) {
          playTimerAlarm();
          stopTaskTimer();
        }
      }
    }, 1000);
  }
}

// Render attachments in timer modal
function renderTimerAttachments() {
  if (!currentTimerTask) return;
  
  const attachmentsList = document.getElementById('timerAttachmentsList');
  if (!attachmentsList) return;
  
  const attachments = currentTimerTask.attachments || [];
  
  if (attachments.length === 0) {
    attachmentsList.innerHTML = '<div style="color: rgba(255, 255, 255, 0.5); font-size: 0.85rem; padding: 8px 0;">No attachments yet</div>';
    return;
  }
  
  attachmentsList.innerHTML = attachments.map((att, index) => {
    const icon = getFileIcon(att.type || '');
    const downloadUrl = att.data ? att.data : (att.url || '#');
    return `
      <div class="timer-attachment-item">
        <i class="fas ${icon} file-icon"></i>
        <a href="${downloadUrl}" download="${att.name}" target="_blank">${att.name}</a>
        <button class="timer-attachment-delete" data-index="${index}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }).join('');
  
  // Add delete handlers
  attachmentsList.querySelectorAll('.timer-attachment-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const index = parseInt(btn.dataset.index);
      await deleteTimerAttachment(index);
    });
  });
}

// Save description from timer
async function saveTimerDescription() {
  if (!currentTimerTask) return;
  
  const { podId, subId, taskId } = currentTimerTask;
  const descTextarea = document.getElementById('timerDescriptionTextarea');
  
  if (!podId || !subId || !taskId || !descTextarea) return;
  
  const newDescription = descTextarea.value;
  
  try {
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    
    await updateDoc(taskRef, {
      longDescription: newDescription,
      lastModifiedBy: currentUserName,
      lastModifiedByEmail: currentUserEmail,
      lastModifiedAt: Date.now()
    });
    
    // Update current task info
    currentTimerTask.longDescription = newDescription;
    
    // Visual feedback
    const saveBtn = document.getElementById('timerSaveDescriptionBtn');
    if (saveBtn) {
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
      }, 2000);
    }
  } catch (error) {
    console.error('Error saving description:', error);
    alert('Failed to save description');
  }
}

// Delete attachment from timer
async function deleteTimerAttachment(index) {
  if (!currentTimerTask) return;
  
  const { podId, subId, taskId } = currentTimerTask;
  if (!podId || !subId || !taskId) return;
  
  try {
    const attachments = [...(currentTimerTask.attachments || [])];
    attachments.splice(index, 1);
    
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    
    await updateDoc(taskRef, {
      attachments,
      lastModifiedBy: currentUserName,
      lastModifiedByEmail: currentUserEmail,
      lastModifiedAt: Date.now()
    });
    
    // Update current task info
    currentTimerTask.attachments = attachments;
    
    // Re-render
    renderTimerAttachments();
  } catch (error) {
    console.error('Error deleting attachment:', error);
    alert('Failed to delete attachment');
  }
}

// Add attachment from timer
async function addTimerAttachment(files) {
  if (!currentTimerTask || !files || files.length === 0) return;
  
  const { podId, subId, taskId } = currentTimerTask;
  if (!podId || !subId || !taskId) return;
  
  try {
    const attachments = [...(currentTimerTask.attachments || [])];
    
    // Convert files to base64 and add to attachments
    for (const file of files) {
      const base64 = await fileToBase64(file);
      attachments.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
        uploadedAt: Date.now()
      });
    }
    
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    
    await updateDoc(taskRef, {
      attachments,
      lastModifiedBy: currentUserName,
      lastModifiedByEmail: currentUserEmail,
      lastModifiedAt: Date.now()
    });
    
    // Update current task info
    currentTimerTask.attachments = attachments;
    
    // Re-render
    renderTimerAttachments();
  } catch (error) {
    console.error('Error adding attachment:', error);
    alert('Failed to add attachment');
  }
}

// Helper function to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper function to get file icon
function getFileIcon(type) {
  if (type.startsWith('image/')) return 'fa-file-image';
  if (type.startsWith('video/')) return 'fa-file-video';
  if (type.startsWith('audio/')) return 'fa-file-audio';
  if (type.includes('pdf')) return 'fa-file-pdf';
  if (type.includes('word') || type.includes('document')) return 'fa-file-word';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'fa-file-excel';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'fa-file-powerpoint';
  if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return 'fa-file-archive';
  return 'fa-file';
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay) {
    timerDisplay.textContent = display;
  }
  // Also mirror the countdown in the browser tab title
  updateTabTitleForTimer();
}

function stopTaskTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  const timerModal = document.getElementById('taskTimerModal');
  if (timerModal) {
    timerModal.style.display = 'none';
  }
  
  // Restore original tab title
  resetTabTitle();
  
  timerSeconds = 0;
  timerPaused = false;
  currentTimerTask = null;
}

function pauseTaskTimer() {
  timerPaused = !timerPaused;
  const pauseBtn = document.getElementById('pauseTimerBtn');
  if (pauseBtn) {
    pauseBtn.textContent = timerPaused ? 'Resume Timer' : 'Pause Timer';
  }
  // Reflect pause/resume state in tab title
  updateTabTitleForTimer();
}

async function completeTaskFromTimer() {
  if (!currentTimerTask) return;
  
  const { podId, subId, taskId } = currentTimerTask;
  
  // Mark task as complete in Firestore
  if (podId && subId && taskId) {
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    
    try {
      await updateDoc(taskRef, { 
        completed: true,
        lastModifiedBy: currentUserName,
        lastModifiedByEmail: currentUserEmail,
        lastModifiedAt: Date.now()
      });
      
      // Recurring: create the next instance (mirror checkbox behavior)
      try {
        const snap = await getDoc(taskRef);
        if (snap.exists()) {
          const latestTaskData = snap.data() || {};
          if (latestTaskData.recurring && latestTaskData.recurring.isRecurring && shouldCreateNextRecurring(taskId)) {
            // Calculate next due date starting from today
            const todayStr = getLocalTodayString();
            const nextDueDate = calculateNextRecurringDate(todayStr, latestTaskData.recurring);
            if (nextDueDate) {
              // Use deterministic ID to prevent duplicates if triggered twice
              const newTaskId = `${taskId || 'task'}__next__${nextDueDate}`;
              await setDoc(doc(subRef, 'tasks', newTaskId), {
                text: latestTaskData.text,
                completed: false,
                createdBy: currentUserName,
                createdByEmail: currentUserEmail,
                assignee: latestTaskData.assignee || '',
                assignees: latestTaskData.assignees || [],
                dueDate: nextDueDate,
                dueTime: latestTaskData.dueTime || '',
                status: latestTaskData.status || 'Open',
                longDescription: latestTaskData.longDescription || '',
                attachments: latestTaskData.attachments || [],
                recurring: latestTaskData.recurring,
                createdAt: Date.now()
              });
              // Optionally highlight when returning to the list
              setTimeout(() => {
                try { highlightNewTask(newTaskId); } catch(_) {}
              }, 500);
            }
          }
        }
      } catch (recurringError) {
        console.error('[Timer] Error creating next recurring task:', recurringError);
      }
      
      // Play completion sound and show firework
      playCompletionSound();
      
      // Stop timer
      stopTaskTimer();
      
      // Update UI
      updateKPIs();
    } catch (e) {
      console.error('[Timer] Error completing task:', e);
    }
  }
}

function updateTimerStats() {
  // Get stats from the page
  const totalTasks = document.getElementById('kpiTotal')?.textContent || '0';
  const onHoldTasks = document.querySelectorAll('.status-select[value="On-Hold"]').length;
  const completedTasks = document.querySelectorAll('.completed-list li').length;
  
  const statsDiv = document.getElementById('timerStats');
  if (statsDiv) {
    statsDiv.innerHTML = `Tasks: ${totalTasks} &nbsp;&nbsp; On-Hold: ${onHoldTasks} &nbsp;&nbsp; Completed: ${completedTasks}`;
  }
}

function playTimerAlarm() {
  // Check if sound is muted
  const isMuted = localStorage.getItem('soundsMuted') === 'true';
  if (isMuted) {
    console.log('[Timer] Alarm sound is muted');
    return;
  }
  
  try {
    const audio = new Audio('Alarm.mp3');
    audio.volume = 0.6;
    audio.play().catch(e => {
      console.log('[Timer] Could not play alarm sound:', e);
    });
  } catch (e) {
    console.log('[Timer] Error creating alarm audio:', e);
  }
}

function initTimerModal() {
  const stopBtn = document.getElementById('stopTimerBtn');
  const pauseBtn = document.getElementById('pauseTimerBtn');
  const doneBtn = document.getElementById('doneTimerBtn');
  const soundBtn = document.getElementById('timerSoundBtn');
  const saveDescBtn = document.getElementById('timerSaveDescriptionBtn');
  const addAttachBtn = document.getElementById('timerAddAttachmentBtn');
  const attachInput = document.getElementById('timerAttachmentInput');
  const toggleDetailsBtn = document.getElementById('toggleTimerDetailsBtn');
  
  if (stopBtn) {
    stopBtn.addEventListener('click', stopTaskTimer);
  }
  
  if (pauseBtn) {
    pauseBtn.addEventListener('click', pauseTaskTimer);
  }
  
  if (doneBtn) {
    doneBtn.addEventListener('click', completeTaskFromTimer);
  }
  
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const currentlyMuted = localStorage.getItem('soundsMuted') === 'true';
      localStorage.setItem('soundsMuted', String(!currentlyMuted));
      
      // Update icon
      const icon = soundBtn.querySelector('i');
      if (icon) {
        icon.className = currentlyMuted ? 'fas fa-volume-up' : 'fas fa-volume-mute';
      }
    });
  }
  
  if (saveDescBtn) {
    saveDescBtn.addEventListener('click', saveTimerDescription);
  }
  
  if (addAttachBtn && attachInput) {
    addAttachBtn.addEventListener('click', () => {
      attachInput.click();
    });
    
    attachInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await addTimerAttachment(Array.from(e.target.files));
        e.target.value = ''; // Reset input
      }
    });
  }
  
  if (toggleDetailsBtn) {
    toggleDetailsBtn.addEventListener('click', () => {
      const detailsSection = document.getElementById('timerDetailsSection');
      if (detailsSection) {
        const isHidden = detailsSection.style.display === 'none';
        detailsSection.style.display = isHidden ? 'flex' : 'none';
        toggleDetailsBtn.innerHTML = isHidden 
          ? '<i class="fas fa-chevron-up"></i> Hide Details' 
          : '<i class="fas fa-chevron-down"></i> Show Details';
      }
    });
  }
}

function renderPods() {
  const mainDiv = document.getElementById('main-pods');
  mainDiv.innerHTML = '';
  podInfo.forEach(pod => {
    mainDiv.appendChild(createPodElement(pod));
  });
}

function registerSubproject(podId, name, element, subprojectId, addToStart = false) {
  const arr = podToProjects.get(podId) || [];
  const entry = { name, element, subprojectId };
  if (addToStart) arr.unshift(entry); else arr.push(entry);
  podToProjects.set(podId, arr);
}

// Filters logic
function populatePodOptions() {
  const podSelect = document.getElementById('podFilter');
  if (!podSelect) return;
  podSelect.innerHTML = '';
  for (const pod of podInfo) {
    const opt = document.createElement('option');
    opt.value = pod.id;
    opt.textContent = pod.title;
    podSelect.appendChild(opt);
  }
}

function populateProjectOptions(podId) {
  const projSelect = document.getElementById('projectFilter');
  if (!projSelect) return;
  projSelect.innerHTML = '';
  const projects = podToProjects.get(podId) || [];
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    projSelect.appendChild(opt);
  });
}

function applyFilter(podId, projectName) {
  // Hide all pods first
  document.querySelectorAll('.pod-card').forEach(p => p.style.display = 'none');
  // Hide all subprojects
  document.querySelectorAll('.subproject-card').forEach(s => s.style.display = 'none');

  // Show selected pod and project
  const podEl = document.querySelector(`.pod-card[data-pod-id="${podId}"]`);
  if (podEl) podEl.style.display = '';
  const projEl = document.querySelector(`.subproject-card[data-pod-id="${podId}"][data-project-name="${CSS.escape(projectName)}"]`);
  if (projEl) {
    projEl.style.display = '';
    // Ensure the task list is visible (expanded)
    const expand = projEl.querySelector('.expand-control');
    const content = projEl.querySelector('.task-list');
    if (content && content.classList.contains('hidden')) expand?.click();
  }
  // Update page header to selected project name
  if (projectName) setProjectsHeader(projectName);
}

function initFilters() {
  // Build centered hyperlinks for master projects (pods)
  const linksBar = document.getElementById('projectsTopLinks');
  if (!linksBar) return;
  linksBar.innerHTML = '';

  podInfo.forEach((pod, idx) => {
    const a = document.createElement('a');
    a.href = '#';
    a.innerHTML = `<i class="fas ${pod.icon}"></i> ${pod.title}`;
    a.dataset.podId = pod.id;
    if (idx === 0) a.classList.add('active');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      // set active link
      linksBar.querySelectorAll('a').forEach(el => el.classList.remove('active'));
      a.classList.add('active');
      // show only selected pod (don't auto-filter to a single project)
      showOnlyPod(pod.id);
      // Always set header to pod name when clicking top link
      setProjectsHeader(pod.title, pod.icon);
    });
    linksBar.appendChild(a);
  });

  // Initial view: first pod and first project
  const firstPodId = podInfo[0].id;
  showOnlyPod(firstPodId);
  // Set header to first pod name by default
  const firstPodTitle = podInfo[0].title;
  const firstPodIcon = podInfo[0].icon;
  setProjectsHeader(firstPodTitle, firstPodIcon);
}

function showOnlyPod(podId) {
  document.querySelectorAll('.pod-card').forEach(pod => {
    pod.style.display = pod.dataset.podId === podId ? '' : 'none';
  });
  // Update KPIs for the newly visible pod
  updateKPIs();
}

function initGlobalCompletedSection() {
  const toggleBtn = document.getElementById('toggleGlobalCompleted');
  const globalSection = document.getElementById('globalCompletedSection');
  
  console.log('[Projects] initGlobalCompletedSection called', { 
    toggleBtn: !!toggleBtn, 
    globalSection: !!globalSection 
  });
  
  if (!toggleBtn || !globalSection) {
    console.error('[Projects] Missing completed section elements!', {
      toggleBtn: !!toggleBtn,
      globalSection: !!globalSection
    });
    return;
  }
  
  // Update the toggle button and section visibility
  async function updateGlobalToggle() {
    const allCompletedLists = document.querySelectorAll('.completed-list');
    
    // Count completed tasks from Firestore (not DOM, since they're not loaded yet)
    let totalCount = 0;
    const countPromises = [];
    
    // Get all visible pods
    const visiblePods = Array.from(document.querySelectorAll('.pod-card')).filter(pod => {
      const style = pod.getAttribute('style');
      return !style || !style.includes('display: none');
    });
    
    // For each visible pod, count completed tasks in all its subprojects
    for (const podCard of visiblePods) {
      const podId = podCard.dataset.podId;
      const subprojects = podCard.querySelectorAll('.subproject-card');
      
      subprojects.forEach(subCard => {
        const subId = subCard.dataset.subprojectId;
        if (podId && subId) {
          const countPromise = (async () => {
            try {
              const podRef = doc(db, 'pods', podId);
              const subRef = doc(podRef, 'subprojects', subId);
              const tasksCol = collection(subRef, 'tasks');
              const completedQuery = query(tasksCol, where('completed', '==', true));
              const snapshot = await getDocs(completedQuery);
              return snapshot.size;
            } catch (e) {
              console.error('[Projects] Error counting completed tasks:', e);
              return 0;
            }
          })();
          countPromises.push(countPromise);
        }
      });
    }
    
    const counts = await Promise.all(countPromises);
    totalCount = counts.reduce((sum, count) => sum + count, 0);
    
    if (totalCount === 0) {
      globalSection.style.display = 'none';
      return;
    }
    
    // Always show the section if there are completed tasks
    globalSection.style.display = 'block';
    
    // Update button text based on visibility state
    const allHidden = Array.from(allCompletedLists).every(list => list.classList.contains('hidden'));
    toggleBtn.textContent = allHidden ? `Show completed tasks (${totalCount})` : `Hide completed tasks (${totalCount})`;
  }
  
  toggleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const allCompletedLists = document.querySelectorAll('.completed-list');
    const allHidden = Array.from(allCompletedLists).every(list => list.classList.contains('hidden'));
    
    if (allHidden) {
      // Load completed tasks for all visible subprojects
      console.log('[Projects] Loading completed tasks for all visible subprojects...');
      console.log('[Projects] Found completed lists:', allCompletedLists.length);
      
      const loadPromises = [];
      allCompletedLists.forEach((list, index) => {
        const podId = list.dataset.podId;
        const subprojectId = list.dataset.subprojectId;
        
        console.log(`[Projects] List ${index}:`, { podId, subprojectId, element: list });
        
        if (podId && subprojectId) {
          // Load completed tasks for this subproject
          loadPromises.push(loadCompletedTasksInto(podId, subprojectId, list));
        } else {
          console.warn(`[Projects] List ${index} missing podId or subprojectId`);
        }
      });
      
      console.log('[Projects] Starting', loadPromises.length, 'load operations...');
      
      // Wait for all completed tasks to load
      await Promise.all(loadPromises);
      
      console.log('[Projects] All loads complete, showing lists...');
      
      // Now show all completed lists
      allCompletedLists.forEach(list => {
        list.classList.remove('hidden');
        console.log('[Projects] Showing list:', list);
      });
      
      console.log('[Projects] Done showing completed tasks');
    } else {
      // Hide all completed lists (clear them to save memory)
      allCompletedLists.forEach(list => {
        list.classList.add('hidden');
        // Clear the list to free up memory
        list.innerHTML = '';
      });
    }
    
    updateGlobalToggle();
  });
  
  // Store update function globally for use elsewhere
  window.updateGlobalCompletedToggle = updateGlobalToggle;
}

// Initialize sound toggle button
function initSoundToggle() {
  const soundToggle = document.getElementById('soundToggle');
  if (!soundToggle) return;
  
  // Get initial mute state from localStorage
  const isMuted = localStorage.getItem('soundsMuted') === 'true';
  
  // Update button appearance based on mute state
  function updateSoundIcon() {
    const icon = soundToggle.querySelector('i');
    const isMuted = localStorage.getItem('soundsMuted') === 'true';
    
    if (isMuted) {
      icon.className = 'fas fa-volume-mute';
      soundToggle.style.color = '#999';
      soundToggle.style.borderColor = '#ccc';
      soundToggle.title = 'All sounds muted - Click to unmute';
    } else {
      icon.className = 'fas fa-volume-up';
      soundToggle.style.color = '#4CAF50';
      soundToggle.style.borderColor = '#4CAF50';
      soundToggle.title = 'Sounds on - Click to mute all sounds';
    }
  }
  
  // Set initial state
  updateSoundIcon();
  
  // Toggle mute on click
  soundToggle.addEventListener('click', (e) => {
    const currentlyMuted = localStorage.getItem('soundsMuted') === 'true';
    const newMutedState = !currentlyMuted;
    
    localStorage.setItem('soundsMuted', String(newMutedState));
    updateSoundIcon();
    
    // Show a subtle feedback animation
    soundToggle.style.transform = 'scale(0.9)';
    setTimeout(() => {
      soundToggle.style.transform = 'scale(1)';
    }, 100);
    
    console.log('[Projects] All sounds', newMutedState ? 'muted' : 'unmuted');
  });
  
  // Add hover effect
  soundToggle.addEventListener('mouseenter', () => {
    soundToggle.style.transform = 'scale(1.05)';
    soundToggle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  });
  
  soundToggle.addEventListener('mouseleave', () => {
    soundToggle.style.transform = 'scale(1)';
    soundToggle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  });
}

// Global filter state
let isMyTasksFilterActive = false;

// Initialize My Tasks filter button
function initMyTasksFilter() {
  const filterBtn = document.getElementById('myTasksFilterBtn');
  if (!filterBtn) return;
  
  filterBtn.addEventListener('click', () => {
    const userName = localStorage.getItem('userName') || '';
    const userFirstName = userName.split(' ')[0];
    
    if (!userFirstName) {
      alert('Unable to determine current user. Please log in again.');
      return;
    }
    
    isMyTasksFilterActive = !isMyTasksFilterActive;
    
    // Update button appearance
    if (isMyTasksFilterActive) {
      filterBtn.classList.add('active');
      filterBtn.title = 'Show all tasks';
      console.log('[My Tasks Filter] Showing only tasks assigned to:', userFirstName);
    } else {
      filterBtn.classList.remove('active');
      filterBtn.title = 'Show only tasks assigned to me';
      console.log('[My Tasks Filter] Showing all tasks');
    }
    
    // Apply filter to all visible tasks
    applyMyTasksFilter();
    
    // Update task counts for all visible subprojects
    document.querySelectorAll('.subproject-card').forEach(subCard => {
      updateTaskCount(subCard);
    });
    
    // Update KPIs
    updateKPIs();
    
    // Add a subtle animation
    filterBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      filterBtn.style.transform = 'scale(1)';
    }, 100);
  });
}

// Apply My Tasks filter to all visible tasks
function applyMyTasksFilter() {
  const userName = localStorage.getItem('userName') || '';
  const userFirstName = userName.split(' ')[0];
  
  const allTaskItems = document.querySelectorAll('.task-list > ul:not(.completed-list) > li');
  
  allTaskItems.forEach(taskLi => {
    const assigneeDisplay = taskLi.querySelector('.assignee-display');
    
    if (!assigneeDisplay) {
      // No assignee found, hide if filtering
      taskLi.style.display = isMyTasksFilterActive ? 'none' : '';
      return;
    }
    
    const assigneeText = assigneeDisplay.textContent;
    
    if (isMyTasksFilterActive) {
      // Show only if assigned to current user
      const isAssignedToMe = assigneeText.includes(userFirstName);
      taskLi.style.display = isAssignedToMe ? '' : 'none';
    } else {
      // Show all tasks
      taskLi.style.display = '';
    }
  });
}

// Recurring Task Modal Logic
let currentRecurringTask = null;

// Calculate next recurring date based on frequency and settings
function calculateNextRecurringDate(currentDueDate, recurringData) {
  if (!currentDueDate || !recurringData) return null;
  
  const currentDate = new Date(currentDueDate + 'T00:00:00'); // Parse in local timezone
  if (isNaN(currentDate.getTime())) return null;
  
  const frequency = recurringData.frequency;
  let nextDate = new Date(currentDate);
  
  if (frequency === 'daily') {
    // Add 1 day
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (frequency === 'weekly') {
    // Find the next occurrence based on selected days
    const selectedDays = recurringData.days || [];
    
    if (selectedDays.length === 0) {
      // Default to 7 days if no days selected
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      // Sort days for easier processing
      const sortedDays = [...selectedDays].sort((a, b) => a - b);
      const currentDay = currentDate.getDay();
      
      // Find next occurrence in the cycle
      // IMPORTANT: We need to find the NEXT occurrence, not the current day
      let nextOccurrenceDay = null;
      let daysToAdd = 0;
      
      // First, check if there's a selected day later in the current week (after today)
      for (const day of sortedDays) {
        if (day > currentDay) {
          nextOccurrenceDay = day;
          daysToAdd = day - currentDay;
          break;
        }
      }
      
      // If no day found later this week, wrap to first selected day of next week
      if (nextOccurrenceDay === null) {
        nextOccurrenceDay = sortedDays[0];
        // Calculate days to add (go to next week)
        // If current day is same as the recurring day, add full 7 days
        // Otherwise, calculate days remaining in week + days into next week
        if (currentDay === nextOccurrenceDay) {
          daysToAdd = 7;
        } else {
          daysToAdd = (7 - currentDay) + nextOccurrenceDay;
        }
      }
      
      nextDate.setDate(nextDate.getDate() + daysToAdd);
    }
  } else if (frequency === 'monthly') {
    // Add 1 month, keeping the same day
    nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  // Format as YYYY-MM-DD
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const day = String(nextDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function initRecurringModal() {
  const modal = document.getElementById('recurringModal');
  const closeBtn = document.getElementById('closeRecurringModal');
  const saveBtn = document.getElementById('saveRecurringBtn');
  const clearBtn = document.getElementById('clearRecurringBtn');
  const frequencySelect = document.getElementById('recurringFrequency');
  const daysSection = document.getElementById('recurringDaysSection');
  
  if (!modal) return;
  
  // Close modal handlers
  const closeModal = () => {
    modal.classList.add('hidden');
    currentRecurringTask = null;
  };
  
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Toggle days section based on frequency
  if (frequencySelect) {
    frequencySelect.addEventListener('change', () => {
      if (daysSection) {
        daysSection.style.display = frequencySelect.value === 'weekly' ? 'block' : 'none';
      }
    });
  }
  
  // Save recurring settings
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!currentRecurringTask) return;
      
      const { podId, subId, taskId, dateInput } = currentRecurringTask;
      const frequency = document.getElementById('recurringFrequency').value;
      
      let days = [];
      if (frequency === 'weekly') {
        const dayCheckboxes = document.querySelectorAll('#recurringDaysSection input[type="checkbox"]:checked');
        days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));
      }
      
      const recurringData = {
        isRecurring: true,
        frequency,
        days
      };
      
      // Save to Firestore
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        await updateDoc(taskRef, { 
          recurring: recurringData,
          lastModifiedBy: currentUserName,
          lastModifiedByEmail: currentUserEmail,
          lastModifiedAt: Date.now()
        });
        
        // Update icon to green immediately
        const recurringBtn = dateInput?.parentElement?.querySelector('.recurring-icon-btn');
        if (recurringBtn) {
          recurringBtn.classList.add('is-recurring');
        }
        
        // Update task list to show the recurring badge
        const container = document.querySelector(`.subproject-card[data-subproject-id="${subId}"] ul`);
        if (container) await loadTasksInto(podId, subId, container);
      }
      
      closeModal();
    });
  }
  
  // Clear recurring settings
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!currentRecurringTask) return;
      
      const { podId, subId, taskId, dateInput } = currentRecurringTask;
      
      // Remove recurring from Firestore
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        await updateDoc(taskRef, { 
          recurring: null,
          lastModifiedBy: currentUserName,
          lastModifiedByEmail: currentUserEmail,
          lastModifiedAt: Date.now()
        });
        
        // Update icon to grey immediately
        const recurringBtn = dateInput?.parentElement?.querySelector('.recurring-icon-btn');
        if (recurringBtn) {
          recurringBtn.classList.remove('is-recurring');
        }
        
        // Update task list to remove the recurring badge
        const container = document.querySelector(`.subproject-card[data-subproject-id="${subId}"] ul`);
        if (container) await loadTasksInto(podId, subId, container);
      }
      
      closeModal();
    });
  }
}

function openRecurringModal(podId, subId, taskId, dateInput, recurringData = null) {
  const modal = document.getElementById('recurringModal');
  const frequencySelect = document.getElementById('recurringFrequency');
  const daysSection = document.getElementById('recurringDaysSection');
  
  if (!modal) return;
  
  // Store current task context
  currentRecurringTask = { podId, subId, taskId, dateInput };
  
  // Populate modal with existing data or defaults
  if (frequencySelect) {
    frequencySelect.value = recurringData?.frequency || 'weekly';
    // Trigger change event to show/hide days section
    frequencySelect.dispatchEvent(new Event('change'));
  }
  
  // Set day checkboxes
  const dayCheckboxes = document.querySelectorAll('#recurringDaysSection input[type="checkbox"]');
  dayCheckboxes.forEach(cb => {
    const dayValue = parseInt(cb.value);
    if (recurringData?.days && Array.isArray(recurringData.days)) {
      cb.checked = recurringData.days.includes(dayValue);
    } else {
      // Default to the current task's due date day of week
      if (dateInput.value) {
        const dueDate = new Date(dateInput.value);
        cb.checked = dayValue === dueDate.getDay();
      } else {
        // If no due date, default to today
        const today = new Date();
        cb.checked = dayValue === today.getDay();
      }
    }
  });
  
  // Show modal
  modal.classList.remove('hidden');
}

// ============ NEW TASK MODAL ============

let currentNewTaskContext = null;

function initNewTaskModal() {
  const modal = document.getElementById('newTaskModal');
  const input = document.getElementById('newTaskInput');
  
  if (!modal || !input) return;
  
  // Close modal handlers
  const closeModal = () => {
    modal.style.display = 'none';
    currentNewTaskContext = null;
    input.value = '';
  };
  
  // Click outside to close (on the blurred background)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Create task handler
  const createTask = async () => {
    if (!currentNewTaskContext) return;
    
    const taskName = input.value.trim();
    if (!taskName) {
      input.focus();
      return;
    }
    
    const { podId, subId, taskUl, taskContent, header } = currentNewTaskContext;
    
    try {
      // Create task in Firestore
      const podRef = doc(db, 'pods', podId);
      const subRef = doc(podRef, 'subprojects', subId);
      const tasksCol = collection(subRef, 'tasks');
      const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
      const currentUserEmail = localStorage.getItem('userEmail') || '';
      const taskDoc = await addDoc(tasksCol, { 
        text: taskName, 
        completed: false, 
        createdAt: Date.now(),
        createdBy: currentUserName,
        createdByEmail: currentUserEmail,
        assignee: '', 
        dueDate: '', 
        dueTime: '',
        status: 'Open' 
      });
      
      // Store the new task ID for highlighting
      const newTaskId = taskDoc.id;
      
      // Reload tasks to maintain sorted order
      await loadTasksInto(podId, subId, taskUl);
      updateCompletedToggleText(taskUl);
      
      // Ensure task list is open to show the new task
      if (taskContent.classList.contains('hidden')) {
        header.querySelector('.expand-control').click();
      }
      
      // Close the modal
      closeModal();
      
      console.log('[New Task] Created task:', taskName, 'with ID:', newTaskId);
      
      // Highlight the newly created task after a brief delay (to ensure it's rendered)
      setTimeout(() => {
        highlightNewTask(newTaskId);
      }, 300);
      
    } catch (error) {
      console.error('[New Task] Error creating task:', error);
      alert('Error creating task. Please try again.');
    }
  };
  
  // Keyboard shortcuts
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createTask();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  });
}

function openNewTaskModal(podId, subId, taskUl, taskContent, header) {
  const modal = document.getElementById('newTaskModal');
  const input = document.getElementById('newTaskInput');
  
  if (!modal || !input) return;
  
  // Store context
  currentNewTaskContext = { podId, subId, taskUl, taskContent, header };
  
  // Clear input
  input.value = '';
  
  // Show modal
  modal.style.display = 'flex';
  
  // Auto-focus the input after animation starts
  setTimeout(() => {
    input.focus();
  }, 100);
}

// Highlight a newly created task
function highlightNewTask(taskId) {
  // Find the task element by its data-task-id attribute
  const taskElement = document.querySelector(`li[data-task-id="${taskId}"]`);
  
  if (!taskElement) {
    console.warn('[New Task] Could not find task element to highlight:', taskId);
    return;
  }
  
  // Scroll the task into view smoothly
  taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Apply highlight animation
  taskElement.style.transition = 'all 0.3s ease';
  taskElement.style.backgroundColor = '#e3f2fd';
  taskElement.style.boxShadow = '0 0 0 4px rgba(33, 150, 243, 0.3)';
  taskElement.style.transform = 'scale(1.02)';
  
  // Create a sparkle effect
  const sparkle = document.createElement('div');
  sparkle.innerHTML = '✨';
  sparkle.style.position = 'absolute';
  sparkle.style.left = '-30px';
  sparkle.style.top = '50%';
  sparkle.style.transform = 'translateY(-50%)';
  sparkle.style.fontSize = '1.5rem';
  sparkle.style.animation = 'sparkleFloat 1.5s ease-out forwards';
  sparkle.style.pointerEvents = 'none';
  
  taskElement.style.position = 'relative';
  taskElement.appendChild(sparkle);
  
  // Pulse effect
  let pulseCount = 0;
  const pulseInterval = setInterval(() => {
    pulseCount++;
    if (pulseCount % 2 === 0) {
      taskElement.style.backgroundColor = '#e3f2fd';
      taskElement.style.boxShadow = '0 0 0 4px rgba(33, 150, 243, 0.3)';
    } else {
      taskElement.style.backgroundColor = '#bbdefb';
      taskElement.style.boxShadow = '0 0 0 6px rgba(33, 150, 243, 0.4)';
    }
    
    if (pulseCount >= 4) {
      clearInterval(pulseInterval);
      // Fade out the highlight
      setTimeout(() => {
        taskElement.style.backgroundColor = '';
        taskElement.style.boxShadow = '';
        taskElement.style.transform = '';
        
        // Remove sparkle after animation
        setTimeout(() => {
          if (sparkle.parentNode) {
            sparkle.remove();
          }
        }, 500);
      }, 300);
    }
  }, 300);
  
  console.log('[New Task] Highlighting task:', taskId);
}

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    await initializeFirebaseApp();
    await ensureDefaultPods();
    renderPods();
    initFilters();
    initTaskDrawer();
    initGlobalCompletedSection();
    initRecurringModal();
    initNewTaskModal();
    initMyTasksModal();
    initNotificationsModal();
    initNotificationListener();
    initSoundToggle();
    initMyTasksFilter();
    initTimerModal();
    // Check URL hash/query for deep link first; fall back to pending session nav
    const navigatedViaUrl = await checkUrlForTaskNavigation();
    if (!navigatedViaUrl) {
      // Check if we need to navigate to a task from a notification
      checkPendingNavigation();
    }
    // If another page requested to open notifications, do it now
    try {
      const shouldOpenNotifications = localStorage.getItem('openNotificationsOnLoad') === 'true';
      if (shouldOpenNotifications && typeof openNotificationsModal === 'function') {
        await openNotificationsModal();
        localStorage.removeItem('openNotificationsOnLoad');
      }
    } catch (e) {
      console.warn('Deferred notifications open failed:', e);
      localStorage.removeItem('openNotificationsOnLoad');
    }
  })();
});

// Parse URL hash/query and navigate to task if present, returns true if handled
async function checkUrlForTaskNavigation() {
  try {
    // Prefer hash params: #pod=...&sub=...&task=...
    const rawHash = (window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(rawHash);
    let podId = hashParams.get('pod');
    let subId = hashParams.get('sub');
    let taskId = hashParams.get('task');
    // Fallback to query params ?pod=&sub=&task=
    if (!podId && !subId && !taskId) {
      const queryParams = new URLSearchParams(window.location.search || '');
      podId = podId || queryParams.get('pod');
      subId = subId || queryParams.get('sub');
      taskId = taskId || queryParams.get('task');
    }
    if (podId && subId) {
      // Defer slightly to allow initial listeners to settle
      setTimeout(() => navigateToTask(podId, subId, taskId || ''), 800);
      // Clean the hash to avoid re-triggering on refresh
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) {}
      return true;
    }
  } catch (e) {
    console.warn('[DeepLink] Failed to parse URL for task navigation:', e);
  }
  return false;
}

// Firestore helpers
async function ensureDefaultPods() {
  // Create pods collection docs if they don't exist (idempotent via read-only first)
  const podsCol = collection(db, 'pods');
  const snapshot = await getDocs(podsCol);
  const existing = new Set();
  snapshot.forEach(d => existing.add(d.id));
  // We are not auto-creating here beyond collection presence; pods are fixed identifiers used as parents
  // If needed, the UI will still function even if docs are absent; sub-doc writes will create parents implicitly in Firestore
}

async function loadSubprojectsInto(podId, containerEl) {
  // Clean up existing listener if present
  if (subprojectListeners.has(podId)) {
    const oldUnsubscribe = subprojectListeners.get(podId);
    if (oldUnsubscribe) oldUnsubscribe();
    subprojectListeners.delete(podId);
  }
  
  const podRef = doc(db, 'pods', podId);
  const subCol = collection(podRef, 'subprojects');
  
  // Use onSnapshot for real-time updates
  const unsubscribe = onSnapshot(subCol, (snapshot) => {
    console.log('[Projects] Subprojects snapshot received for pod:', podId, 'count:', snapshot.size);
    
    // Track existing subproject elements
    const existingSubprojects = new Map();
    containerEl.querySelectorAll('.subproject-card').forEach(el => {
      const subId = el.dataset.subprojectId;
      if (subId) existingSubprojects.set(subId, el);
    });
    
    const projects = [];
    snapshot.forEach(s => {
      const data = s.data();
      const name = data.name || 'Untitled';
      
      // Check if element already exists
      let subEl = existingSubprojects.get(s.id);
      if (subEl) {
        // Update existing element if name changed
        const titleSpan = subEl.querySelector('.subproject-title');
        if (titleSpan && titleSpan.textContent !== name) {
          titleSpan.textContent = name;
          subEl.dataset.projectName = name;
        }
        existingSubprojects.delete(s.id);
      } else {
        // Create new element for new subproject
        subEl = createSubProjectElement(name, podId, s.id);
        registerSubproject(podId, name, subEl, s.id);
        console.log('[Projects] New subproject detected:', name);
      }
      
      projects.push({ 
        id: s.id, 
        name, 
        el: subEl, 
        order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER, 
        createdAt: data.createdAt || 0 
      });
    });
    
    // Remove deleted subprojects
    existingSubprojects.forEach((el) => {
      console.log('[Projects] Subproject deleted, removing from UI');
      el.remove();
    });
    
    // Sort by saved order first, then createdAt
    projects.sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    
    // Re-append in sorted order
    containerEl.innerHTML = '';
    projects.forEach(p => {
      containerEl.appendChild(p.el);
      // Load tasks with real-time listener (only if not already loaded)
      const taskUl = p.el.querySelector('ul');
      if (taskUl) {
        loadTasksInto(podId, p.id, taskUl);
      }
      
      // Restore sort icon state for this subproject
      const sortState = subprojectSortState.get(p.id) || { column: 'dueDate', direction: 'asc' };
      const headerRow = p.el.querySelector('.task-header');
      if (headerRow) {
        headerRow.querySelectorAll('.sortable-header').forEach(h => {
          const icon = h.querySelector('.sort-icon');
          if (h.dataset.column === sortState.column) {
            icon.className = `fas fa-sort-${sortState.direction === 'asc' ? 'up' : 'down'} sort-icon active`;
          } else {
            icon.className = 'fas fa-sort sort-icon';
          }
        });
      }
    });
    
    // Update KPIs after subproject changes
    updateKPIs();
  });
  
  // Store unsubscribe function
  subprojectListeners.set(podId, unsubscribe);
}

async function loadTasksInto(podId, subId, listEl) {
  const listenerKey = `${podId}_${subId}`;
  
  // Clean up existing listener if present
  if (taskListeners.has(listenerKey)) {
    const oldUnsubscribe = taskListeners.get(listenerKey);
    if (oldUnsubscribe) oldUnsubscribe();
    taskListeners.delete(listenerKey);
  }
  
  const completedUl = listEl.parentElement?.querySelector('.completed-list');
  
  const podRef = doc(db, 'pods', podId);
  const subRef = doc(podRef, 'subprojects', subId);
  const tasksCol = collection(subRef, 'tasks');
  
  // OPTIMIZATION: Only load incomplete tasks by default (completed = false)
  // This prevents loading hundreds/thousands of completed tasks on page load
  const incompleteQuery = query(tasksCol, where('completed', '==', false));
  
  // Use onSnapshot for real-time updates - only for INCOMPLETE tasks
  const unsubscribe = onSnapshot(incompleteQuery, (snapshot) => {
    console.log('[Projects] Incomplete tasks snapshot received for subproject:', subId, 'count:', snapshot.size);
    
    // Track existing task elements in incomplete list
    const existingTasks = new Map();
    if (listEl) {
      listEl.querySelectorAll('li').forEach(li => {
        const taskId = li.dataset?.taskId;
        if (taskId) existingTasks.set(taskId, li);
      });
    }
    
    const items = [];
    snapshot.forEach(t => {
      const data = t.data();
      items.push({
        id: t.id,
        text: data.text || 'Untitled',
        completed: !!data.completed,
        assignee: data.assignee || '',
        assignees: Array.isArray(data.assignees) ? data.assignees : [],
        dueDate: data.dueDate || '',
        dueTime: data.dueTime || '',
        status: data.status || 'Open',
        longDescription: data.longDescription || '',
        attachments: data.attachments || [],
        recurring: data.recurring || null
      });
    });
    
    // Get sort state for this subproject (default to due date ascending)
    const sortState = subprojectSortState.get(subId) || { column: 'dueDate', direction: 'asc' };
    
    // Sort by the selected column and direction
    function parseDate(s) {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    
    items.sort((a, b) => {
      let compareResult = 0;
      
      if (sortState.column === 'dueDate') {
        const da = parseDate(a.dueDate);
        const db = parseDate(b.dueDate);
        if (da && db) compareResult = da - db;
        else if (da && !db) compareResult = -1;
        else if (!da && db) compareResult = 1;
        else compareResult = 0;
      } else if (sortState.column === 'assignee') {
        const assigneeA = (Array.isArray(a.assignees) && a.assignees.length 
          ? a.assignees.map(x => x.name || x.email).join(', ')
          : (a.assignee || 'Unassigned')).toLowerCase();
        const assigneeB = (Array.isArray(b.assignees) && b.assignees.length 
          ? b.assignees.map(x => x.name || x.email).join(', ')
          : (b.assignee || 'Unassigned')).toLowerCase();
        compareResult = assigneeA.localeCompare(assigneeB);
      } else if (sortState.column === 'status') {
        const statusA = (a.status || 'Open').toLowerCase();
        const statusB = (b.status || 'Open').toLowerCase();
        compareResult = statusA.localeCompare(statusB);
      }
      
      // Apply direction (multiply by -1 for descending)
      return sortState.direction === 'asc' ? compareResult : -compareResult;
    });
    
    // Clear incomplete list only
    if (listEl) listEl.innerHTML = '';
    
    items.forEach(d => {
      // Check if task element already exists
      let li = existingTasks.get(d.id);
      if (li) {
        // Update existing task element
        updateTaskElement(li, d, podId, subId);
        existingTasks.delete(d.id);
      } else {
        // Create new task element
        li = createTaskItem({
          text: d.text,
          completed: d.completed,
          assignee: d.assignee,
          assignees: d.assignees,
          dueDate: d.dueDate,
          dueTime: d.dueTime,
          status: d.status,
          longDescription: d.longDescription,
          attachments: d.attachments,
          recurring: d.recurring
        }, podId, subId, d.id);
        
        // Set up change listener for notifications
        setupTaskChangeListener(podId, subId, d.id, {
          text: d.text,
          completed: d.completed,
          assignee: d.assignee,
          assignees: d.assignees,
          dueDate: d.dueDate,
          dueTime: d.dueTime,
          status: d.status,
          longDescription: d.longDescription,
          attachments: d.attachments,
          recurring: d.recurring
        });
      }
      
      // All items here are incomplete, so add to main list
      // Skip rendering items we just marked complete but server hasn't caught up yet
      if (!pendingCompletedTaskIds.has(d.id)) {
        if (listEl) listEl.appendChild(li);
      }
    });
    
    // Remove deleted tasks from incomplete list
    existingTasks.forEach((li) => {
      console.log('[Projects] Task deleted or completed, removing from incomplete list');
      li.remove();
    });
    
    updateCompletedToggleText(listEl);
    
    // Update task count for this subproject
    const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
    if (subprojectCard) {
      updateTaskCount(subprojectCard);
    }
    
    // Apply My Tasks filter if active
    if (isMyTasksFilterActive) {
      applyMyTasksFilter();
    }
    
    // Update KPIs
    updateKPIs();
  });
  
  // Store unsubscribe function
  taskListeners.set(listenerKey, unsubscribe);
}

// Load completed tasks on-demand (called when user clicks "Show completed")
async function loadCompletedTasksInto(podId, subId, completedUl) {
  if (!completedUl) return;
  
  // Show loading indicator
  completedUl.innerHTML = '<li style="padding: 1rem; text-align: center; color: #999; list-style: none;"><i class="fas fa-spinner fa-spin"></i> Loading completed tasks...</li>';
  
  const podRef = doc(db, 'pods', podId);
  const subRef = doc(podRef, 'subprojects', subId);
  const tasksCol = collection(subRef, 'tasks');
  
  // Try to query with ordering first (requires index)
  const completedQueryWithOrder = query(
    tasksCol, 
    where('completed', '==', true),
    orderBy('lastModifiedAt', 'desc'),
    limit(50)
  );
  
  // Fallback query without ordering (works without index)
  const completedQuerySimple = query(
    tasksCol, 
    where('completed', '==', true),
    limit(50)
  );
  
  try {
    let snapshot;
    let usedFallback = false;
    
    try {
      // Try the ordered query first
      snapshot = await getDocs(completedQueryWithOrder);
    } catch (indexError) {
      // Check if this is an index error by looking at code or message
      const isIndexError = 
        (indexError.code && indexError.code === 'failed-precondition') ||
        (indexError.message && indexError.message.toLowerCase().includes('index')) ||
        (indexError.message && indexError.message.includes('requires an index'));
      
      if (isIndexError) {
        console.log('[Projects] Index not created yet, using simple query. Error:', indexError.message);
        snapshot = await getDocs(completedQuerySimple);
        usedFallback = true;
      } else {
        console.error('[Projects] Non-index error:', indexError);
        throw indexError;
      }
    }
    
    console.log('[Projects] Loaded completed tasks for subproject:', subId, 'count:', snapshot.size, 'usedFallback:', usedFallback);
    
    // Clear completed list
    completedUl.innerHTML = '';
    
    // Create task elements
    const tasks = [];
    snapshot.forEach(t => {
      const data = t.data();
      tasks.push({
        id: t.id,
        data: data,
        lastModifiedAt: data.lastModifiedAt || 0
      });
    });
    
    // Sort by lastModifiedAt client-side if using fallback
    if (usedFallback) {
      tasks.sort((a, b) => b.lastModifiedAt - a.lastModifiedAt);
    }
    
    // Create task list items
    tasks.forEach(({ id, data }) => {
      const li = createTaskItem({
        text: data.text || 'Untitled',
        completed: true,
        assignee: data.assignee || '',
        assignees: Array.isArray(data.assignees) ? data.assignees : [],
        dueDate: data.dueDate || '',
        dueTime: data.dueTime || '',
        status: data.status || 'Open',
        longDescription: data.longDescription || '',
        attachments: data.attachments || [],
        recurring: data.recurring || null
      }, podId, subId, id);
      
      completedUl.appendChild(li);
    });
    
    // Show a message if we hit the limit
    if (snapshot.size >= 50) {
      const notice = document.createElement('li');
      notice.style.cssText = 'padding: 0.5rem; text-align: center; color: #666; font-size: 0.85rem; list-style: none;';
      notice.textContent = 'Showing 50 most recent completed tasks';
      completedUl.appendChild(notice);
    }
    
    // If no tasks found
    if (snapshot.size === 0 && !usedFallback) {
      const emptyNotice = document.createElement('li');
      emptyNotice.style.cssText = 'padding: 1rem; text-align: center; color: #999; font-size: 0.9rem; list-style: none;';
      emptyNotice.textContent = 'No completed tasks yet';
      completedUl.appendChild(emptyNotice);
    }
    
  } catch (error) {
    console.error('[Projects] Error loading completed tasks:', error);
    
    // Show user-friendly error message
    completedUl.innerHTML = '';
    const errorNotice = document.createElement('li');
    errorNotice.style.cssText = 'padding: 1rem; background: #ffebee; border-left: 4px solid #f44336; margin-bottom: 0.5rem; list-style: none; border-radius: 4px;';
    errorNotice.innerHTML = `
      <div style="font-weight: 600; color: #c62828; margin-bottom: 0.5rem;">❌ Error Loading Completed Tasks</div>
      <div style="color: #c62828; font-size: 0.9rem;">
        ${error.message || 'Unknown error occurred'}
      </div>
    `;
    completedUl.appendChild(errorNotice);
  }
}

// Helper function to update existing task element with new data
function updateTaskElement(li, taskData, podId, subId) {
  // Update task text
  const textSpan = li.querySelector('.task-text');
  if (textSpan && textSpan.textContent !== taskData.text) {
    textSpan.textContent = taskData.text;
  }
  
  // Update checkbox
  const checkbox = li.querySelector('.task-toggle');
  if (checkbox && checkbox.checked !== taskData.completed) {
    checkbox.checked = taskData.completed;
    textSpan.classList.toggle('task-completed', checkbox.checked);
  }
  
  // Update assignee display
  const assigneeDisplay = li.querySelector('.assignee-display');
  if (assigneeDisplay) {
    const displayText = Array.isArray(taskData.assignees) && taskData.assignees.length 
      ? taskData.assignees.map(a => a.name || a.email).join(', ')
      : (taskData.assignee || 'Unassigned');
    if (assigneeDisplay.textContent !== displayText) {
      assigneeDisplay.textContent = displayText;
    }
  }
  
  // Update due date
  const dateInput = li.querySelector('.date-input');
  const dateDisplay = li.querySelector('.date-display');
  const dateCell = dateInput?.parentElement;
  const dateIconBtn = li.querySelector('.date-icon-btn');
  
  // Function to open date picker
  const openDatePicker = () => {
    if (dateInput?.showPicker) {
      dateInput.showPicker();
    } else {
      dateInput?.click();
    }
  };
  
  if (dateInput && dateInput.value !== taskData.dueDate) {
    dateInput.value = taskData.dueDate || '';
    
    // Update or create date display
    if (taskData.dueDate) {
      // Remove placeholder if it exists
      const placeholder = dateCell?.querySelector('.date-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
      
      if (dateDisplay) {
        dateDisplay.textContent = formatDateDisplay(taskData.dueDate);
        dateDisplay.style.display = 'inline';
      } else {
        const newDateDisplay = document.createElement('span');
        newDateDisplay.className = 'date-display';
        newDateDisplay.textContent = formatDateDisplay(taskData.dueDate);
        newDateDisplay.style.cursor = 'pointer';
        newDateDisplay.style.userSelect = 'none';
        dateInput.insertAdjacentElement('afterend', newDateDisplay);
        // Make date display clickable
        newDateDisplay.addEventListener('click', (e) => {
          e.stopPropagation();
          openDatePicker();
        });
      }
      
      // Update calendar button title and class
      if (dateIconBtn) {
        dateIconBtn.title = 'Change date';
        dateIconBtn.classList.add('has-date');
      }
    } else {
      // Remove date display if it exists
      if (dateDisplay) {
        dateDisplay.remove();
      }
      
      // Add placeholder if it doesn't exist
      if (dateCell && !dateCell.querySelector('.date-placeholder')) {
        const newPlaceholder = document.createElement('span');
        newPlaceholder.className = 'date-placeholder';
        newPlaceholder.style.cursor = 'pointer';
        newPlaceholder.style.userSelect = 'none';
        newPlaceholder.style.color = '#999';
        newPlaceholder.style.fontStyle = 'italic';
        newPlaceholder.textContent = 'Add date';
        dateInput.insertAdjacentElement('afterend', newPlaceholder);
        // Make placeholder clickable
        newPlaceholder.addEventListener('click', (e) => {
          e.stopPropagation();
          openDatePicker();
        });
      }
      
      // Update calendar button title and class
      if (dateIconBtn) {
        dateIconBtn.title = 'Add date';
        dateIconBtn.classList.remove('has-date');
      }
    }
  }
  
  // Update due time
  const timeIconBtn = li.querySelector('.time-icon-btn');
  const timeDisplay = li.querySelector('.time-display');
  
    if (taskData.dueTime) {
      // Time is set - ensure display is visible
      if (timeDisplay) {
        timeDisplay.textContent = formatTimeDisplay(taskData.dueTime);
        timeDisplay.setAttribute('data-time', taskData.dueTime);
        timeDisplay.style.display = 'inline';
      } else {
        // Create time display if it doesn't exist
        const newTimeDisplay = document.createElement('span');
        newTimeDisplay.className = 'time-display';
        newTimeDisplay.textContent = formatTimeDisplay(taskData.dueTime);
        newTimeDisplay.setAttribute('data-time', taskData.dueTime);
        const dateInput = li.querySelector('.date-input');
        if (dateInput) {
          dateInput.insertAdjacentElement('afterend', newTimeDisplay);
        }
      }
      
      // Add class to date cell to hide calendar icon
      const dateInput = li.querySelector('.date-input');
      const dateCell = dateInput?.parentElement;
      if (dateCell) {
        dateCell.classList.add('has-time-set');
      }
      
      if (timeIconBtn) {
        timeIconBtn.classList.add('has-time');
        timeIconBtn.title = `Time: ${formatTimeDisplay(taskData.dueTime)}`;
      }
    } else {
      // No time set - remove display if it exists
      if (timeDisplay) {
        timeDisplay.remove();
      }
      
      // Remove class from date cell to show calendar icon again
      const dateInput = li.querySelector('.date-input');
      const dateCell = dateInput?.parentElement;
      if (dateCell) {
        dateCell.classList.remove('has-time-set');
      }
      
      if (timeIconBtn) {
        timeIconBtn.classList.remove('has-time');
        timeIconBtn.title = 'Set time';
      }
    }
  
  // Update status
  const statusSelect = li.querySelector('.status-select');
  if (statusSelect && statusSelect.value !== taskData.status) {
    statusSelect.value = taskData.status || 'Open';
    // Trigger style update
    const event = new Event('change');
    statusSelect.dispatchEvent(event);
  }
  
  console.log('[Projects] Updated task element:', taskData.text);
}

function refreshTopLinksSelection(podId, projectName) {
  // If current visible pod matches, just update header; keep all subprojects visible
  const activeLink = document.querySelector('.projects-top-links a.active');
  if (activeLink && activeLink.dataset.podId === podId) {
    // Find the pod info to get the proper title and icon
    const pod = podInfo.find(p => p.id === podId);
    const title = projectName || pod?.title || 'Projects';
    const icon = projectName ? null : pod?.icon; // Only show icon for pod-level, not subproject
    setProjectsHeader(title, icon);
  }
}

function setProjectsHeader(title, icon = null) {
  const h1 = document.querySelector('.page-content h1');
  if (h1) {
    // Always render plain text without an icon for a cleaner header
    h1.textContent = title || 'Projects';
  }
}

function updateCompletedToggleText(incompleteUl) {
  // Update the global completed toggle instead of per-project toggles
  if (window.updateGlobalCompletedToggle) {
    window.updateGlobalCompletedToggle();
  }
}

// NOTE: These functions are kept for backwards compatibility but are no longer needed
// with on-demand completed task loading. Completed tasks are now loaded separately.

// Defensive rule: ensure completed tasks are not visible in the main list
// DEPRECATED: No longer needed with on-demand loading
function enforceCompletedHidden(containerEl, doNotHide = false) {
  // No-op: Real-time listeners handle task separation automatically
  console.log('[Projects] enforceCompletedHidden called (deprecated, no-op)');
}

// Always keep lists partitioned: completed items in completedUl, others in incompleteUl
// DEPRECATED: No longer needed with on-demand loading
function partitionTasks(containerEl) {
  // No-op: Real-time listeners handle task separation automatically
  console.log('[Projects] partitionTasks called (deprecated, no-op)');
}

// (Removed) global completed visibility controls; per-project toggle only

// Play completion sound
function playCompletionSound() {
  // Check if sound is muted
  const isMuted = localStorage.getItem('soundsMuted') === 'true';
  if (isMuted) {
    console.log('[Projects] Completion sound is muted');
    return;
  }
  
  try {
    const audio = new Audio('complete.mp3');
    audio.volume = 0.5; // Set volume to 50% to avoid being too loud
    audio.play().catch(e => {
      console.log('[Projects] Could not play completion sound:', e);
    });
  } catch (e) {
    console.log('[Projects] Error creating audio:', e);
  }
}

// Bobby firework effect
function triggerBobbyFirework(clientX, clientY) {
  const container = document.createElement('div');
  container.className = 'projects-firework';
  document.body.appendChild(container);
  const num = 34; // more bobbies :)
  for (let i = 0; i < num; i++) {
    const img = document.createElement('img');
    img.src = 'bobby.png';
    img.className = 'particle';
    // Heart curve: scale and rotate so heart points upward
    const t = (Math.PI * 2 * i) / num;
    // Parametric heart
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const scale = 10 + Math.random() * 3; // size of heart
    const dx = hx * scale;
    const dy = hy * scale;
    const startX = clientX + (Math.random() * 12 - 6);
    const startY = clientY + (Math.random() * 8 - 4);
    img.style.setProperty('--x', startX + 'px');
    img.style.setProperty('--y', startY + 'px');
    img.style.setProperty('--dx', startX + dx + 'px');
    img.style.setProperty('--dy', startY + dy + 'px');
    container.appendChild(img);
  }
  // cleanup
  setTimeout(() => container.remove(), 3000);
}

// Persist the current DOM order of subprojects under a pod
async function persistSubprojectOrder(podId, containerEl) {
  const cards = Array.from(containerEl.querySelectorAll('.subproject-card'));
  let index = 0;
  for (const card of cards) {
    const subId = card.dataset.subprojectId;
    if (!subId) continue;
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    try {
      await updateDoc(subRef, { order: index });
    } catch (e) {
      // ignore
    }
    index++;
  }
}

// Container-level drag & drop with drop indicator line
function setupDragAndDrop(container, podId) {
  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator hidden';
  container.appendChild(indicator);

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(container, e.clientY);
    indicator.classList.remove('hidden');
    if (afterElement == null) {
      container.appendChild(indicator);
    } else {
      container.insertBefore(indicator, afterElement);
    }
  });

  container.addEventListener('dragleave', (e) => {
    // hide only when leaving the container bounds
    if (!container.contains(e.relatedTarget)) {
      indicator.classList.add('hidden');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.subproject-card.dragging');
    if (!dragging) return;
    const afterElement = indicator.nextSibling && indicator.nextSibling.classList?.contains('subproject-card')
      ? indicator.nextSibling
      : null;
    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
    indicator.classList.add('hidden');
    await persistSubprojectOrder(podId, container);
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.subproject-card:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}
// Minimal confirmation modal helper
function showConfirmModal(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('taskDeleteModal');
    const msg = document.getElementById('taskDeleteMessage');
    const btnOk = document.getElementById('taskDeleteConfirm');
    const btnCancel = document.getElementById('taskDeleteCancel');
    const btnClose = document.getElementById('taskDeleteClose');
    if (!modal || !msg || !btnOk || !btnCancel) {
      resolve(confirm(message));
      return;
    }
    msg.textContent = message;
    modal.style.display = 'block';

    function cleanup(result) {
      modal.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      if (btnClose) btnClose.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk(e) { e.preventDefault(); cleanup(true); }
    function onCancel(e) { e.preventDefault(); cleanup(false); }

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    if (btnClose) btnClose.addEventListener('click', onCancel);
    // Close when clicking outside
    const outsideHandler = (ev) => {
      if (ev.target === modal) {
        document.removeEventListener('click', outsideHandler);
        cleanup(false);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler), 0);
  });
}

// Task Drawer logic
let currentDrawerContext = null;
let uploadingFiles = new Map(); // Track ongoing uploads
let activeCommentsUnsubscribe = null; // Active comments listener for drawer
let activeSubtasksUnsubscribe = null; // Active subtasks listener for drawer

function initTaskDrawer() {
  const drawer = document.getElementById('taskDrawer');
  const closeBtn = document.getElementById('closeTaskDrawer');
  const cancelBtn = document.getElementById('cancelTaskDetailsBtn');
  const saveBtn = document.getElementById('saveTaskDetailsBtn');
  const fileInput = document.getElementById('attachmentFileInput');
  const postCommentBtn = document.getElementById('postCommentBtn');
  const newCommentTextarea = document.getElementById('newCommentTextarea');
  const mentionSuggestions = document.getElementById('mentionSuggestions');
  
  if (!drawer) return;
  
  function close() {
    drawer.classList.add('hidden');
    currentDrawerContext = null;
    uploadingFiles.clear();
    // Clean up comments listener and UI
    if (typeof activeCommentsUnsubscribe === 'function') {
      try { activeCommentsUnsubscribe(); } catch(_) {}
      activeCommentsUnsubscribe = null;
    }
    // Clean up subtasks listener
    if (typeof activeSubtasksUnsubscribe === 'function') {
      try { activeSubtasksUnsubscribe(); } catch(_) {}
      activeSubtasksUnsubscribe = null;
    }
    if (mentionSuggestions) mentionSuggestions.style.display = 'none';
    if (newCommentTextarea) newCommentTextarea.value = '';
  }
  
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  
  // Handle file selection
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      if (!currentDrawerContext) return;
      const { podId, subId, taskId } = currentDrawerContext;
      
      // Upload each file
      for (const file of files) {
        await uploadFileAttachment(file, podId, subId, taskId);
      }
      
      // Clear the input so the same file can be selected again
      fileInput.value = '';
    });
  }
  
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    if (!currentDrawerContext) return;
    const { podId, subId, taskId } = currentDrawerContext;
    const longDescription = document.getElementById('drawerLongDescription').value;
    
    // Get current attachments from Firestore (don't modify them here, just update description)
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    
    await updateDoc(taskRef, { 
      longDescription,
      lastModifiedBy: currentUserName,
      lastModifiedByEmail: currentUserEmail,
      lastModifiedAt: Date.now()
    });
    
    // Refresh the task list to update detail icons
    const container = document.querySelector(`.subproject-card[data-subproject-id="${subId}"] ul`);
    if (container) await loadTasksInto(podId, subId, container);
    close();
  });

  // Comments: Post button
  if (postCommentBtn) {
    postCommentBtn.addEventListener('click', async () => {
      await postCurrentDrawerComment();
    });
  }

  // Comments: Mention suggestions
  if (newCommentTextarea) {
    // Show suggestions when typing '@' and some query
    newCommentTextarea.addEventListener('keyup', async (e) => {
      await handleMentionSuggestions(e);
    });
    newCommentTextarea.addEventListener('keydown', (e) => {
      // Hide suggestions on Escape
      if (e.key === 'Escape' && mentionSuggestions && mentionSuggestions.style.display !== 'none') {
        mentionSuggestions.style.display = 'none';
      }
      // Submit with Cmd/Ctrl+Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        postCurrentDrawerComment();
      }
    });
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (mentionSuggestions && !mentionSuggestions.contains(e.target) && e.target !== newCommentTextarea) {
        mentionSuggestions.style.display = 'none';
      }
    });
  }
}

// Live Subtasks list for task drawer (CRUD on tasks/{taskId}/subtasks subcollection)
async function setupSubtasksForTask(podId, subId, taskId) {
  try {
    const listEl = document.getElementById('subtasksList');
    const addBtn = document.getElementById('addSubtaskBtn');
    if (!listEl) return;
    // Clear previous listener
    if (typeof activeSubtasksUnsubscribe === 'function') {
      try { activeSubtasksUnsubscribe(); } catch(_) {}
      activeSubtasksUnsubscribe = null;
    }
    listEl.innerHTML = '';
    // Build refs
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const subtasksCol = collection(taskRef, 'subtasks');
    const qRef = query(subtasksCol, orderBy('order', 'asc'));
    // Subscribe
    activeSubtasksUnsubscribe = onSnapshot(qRef, (snap) => {
      listEl.innerHTML = '';
      snap.forEach((docSnap) => {
        const s = docSnap.data();
        const sid = docSnap.id;
        const li = document.createElement('li');
        li.className = 'subtask-item';
        li.dataset.subtaskId = sid;
        li.setAttribute('draggable', 'true');
        // Checkbox
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'task-toggle subtask-toggle';
        cb.checked = !!s.completed;
        // Text
        const textSpan = document.createElement('span');
        textSpan.className = 'subtask-text' + (s.completed ? ' completed' : '');
        textSpan.textContent = s.text || '';
        textSpan.contentEditable = 'true';
        textSpan.spellcheck = false;
        // Delete button (icon)
        const delBtn = document.createElement('button');
        delBtn.className = 'subtask-delete-btn';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        // Wire events
        cb.addEventListener('change', async () => {
          try {
            await updateDoc(doc(subtasksCol, sid), {
              completed: cb.checked,
              completedAtMs: cb.checked ? Date.now() : null
            });
            if (cb.checked) {
              textSpan.classList.add('completed');
            } else {
              textSpan.classList.remove('completed');
            }
          } catch (e) {
            console.error('[Subtasks] Toggle failed:', e);
          }
        });
        textSpan.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            textSpan.blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            // Re-render will restore original via snapshot; just blur
            textSpan.blur();
          }
        });
        textSpan.addEventListener('blur', async () => {
          const newText = (textSpan.textContent || '').trim();
          const oldText = (s.text || '').trim();
          if (newText.length === 0) {
            textSpan.textContent = oldText;
            return;
          }
          if (newText !== oldText) {
            try {
              await updateDoc(doc(subtasksCol, sid), {
                text: newText,
                editedAtMs: Date.now()
              });
            } catch (e) {
              console.error('[Subtasks] Update text failed:', e);
            }
          }
        });
        delBtn.addEventListener('click', async () => {
          try {
            const confirmed = await showConfirmModal('Delete this subtask?');
            if (!confirmed) return;
            await deleteDoc(doc(subtasksCol, sid));
          } catch (e) {
            console.error('[Subtasks] Delete failed:', e);
          }
        });
        // Drag behavior
        li.addEventListener('dragstart', () => {
          li.classList.add('dragging');
        });
        li.addEventListener('dragend', async () => {
          li.classList.remove('dragging');
          await persistSubtasksOrder();
        });
        // Compose
        li.appendChild(cb);
        li.appendChild(textSpan);
        li.appendChild(delBtn);
        listEl.appendChild(li);
      });
    });
    // Drag-and-drop helpers (added once)
    if (!listEl.dataset.dnd) {
      listEl.dataset.dnd = '1';
      const getAfterElement = (y) => {
        const items = [...listEl.querySelectorAll('.subtask-item:not(.dragging)')];
        return items.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
          } else {
            return closest;
          }
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
      };
      listEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getAfterElement(e.clientY);
        const dragging = listEl.querySelector('.subtask-item.dragging');
        if (!dragging) return;
        if (afterElement == null) {
          listEl.appendChild(dragging);
        } else {
          listEl.insertBefore(dragging, afterElement);
        }
      });
    }
    // Persist order to Firestore according to current DOM order
    async function persistSubtasksOrder() {
      const items = [...listEl.querySelectorAll('.subtask-item')];
      let index = 0;
      for (const el of items) {
        const id = el.dataset.subtaskId;
        if (!id) continue;
        try {
          await updateDoc(doc(subtasksCol, id), { order: index++ });
        } catch (e) {
          console.error('[Subtasks] Persist order failed:', e);
        }
      }
    }
    // New input row handler
    function beginNewSubtaskInput() {
      // Avoid duplicates
      const existing = listEl.querySelector('li.subtask-new');
      if (existing) {
        const exInput = existing.querySelector('input.subtask-input');
        if (exInput) exInput.focus();
        return;
      }
      const li = document.createElement('li');
      li.className = 'subtask-item subtask-new';
      const spacer = document.createElement('span');
      spacer.className = 'subtask-spacer';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Add a subtask...';
      input.className = 'task-input subtask-input';
      const addBtn = document.createElement('button');
      addBtn.className = 'subtask-add-btn';
      addBtn.textContent = 'Add';
      li.appendChild(spacer); // spacer aligns with checkbox column
      li.appendChild(input);
      li.appendChild(addBtn);
      listEl.prepend(li);
      input.focus();
      const cleanup = () => { try { li.remove(); } catch(_) {} };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
        if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
      });
      addBtn.addEventListener('click', async () => {
        const text = (input.value || '').trim();
        if (!text) { input.focus(); return; }
        try {
          const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
          await addDoc(subtasksCol, {
            text,
            completed: false,
            order: Date.now(),
            createdAt: Timestamp.now(),
            createdAtMs: Date.now(),
            createdBy: currentUserName
          });
          cleanup();
        } catch (e) {
          console.error('[Subtasks] Create failed:', e);
        }
      });
    }
    if (addBtn) {
      addBtn.onclick = beginNewSubtaskInput;
    }
  } catch (e) {
    console.error('[Subtasks] Setup error:', e);
  }
}

// Upload a file attachment - Simple base64 storage in Firestore (no CORS needed!)
async function uploadFileAttachment(file, podId, subId, taskId) {
  try {
    // Validate file size (max 500KB to stay within Firestore limits)
    const maxSize = 500 * 1024; // 500KB
    if (file.size > maxSize) {
      alert(`File "${file.name}" is too large. Maximum size is 500KB.`);
      return;
    }
    
    // Add uploading indicator to the list
    const list = document.getElementById('attachmentsList');
    const uploadItem = document.createElement('div');
    uploadItem.className = 'attachment-upload-item';
    uploadItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; background: #f0f8ff; border-radius: 4px; margin-bottom: 0.5rem;">
        <i class="fas fa-spinner fa-spin" style="color: #2196F3;"></i>
        <span style="flex: 1; font-size: 0.9rem;">${file.name}</span>
        <span style="font-size: 0.85rem; color: #666;">Processing...</span>
      </div>
    `;
    list.appendChild(uploadItem);
    
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result;
        
        // Add to Firestore
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        
        // Get current attachments
        const taskSnap = await getDoc(taskRef);
        const currentAttachments = taskSnap.exists() ? (taskSnap.data().attachments || []) : [];
        
        // Add new attachment with base64 data
        const newAttachment = {
          name: file.name,
          data: base64Data, // Store base64 data directly
          size: file.size,
          type: file.type,
          uploadedAt: Date.now(),
          uploadedBy: localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown'
        };
        
        const updatedAttachments = [...currentAttachments, newAttachment];
        
        const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        
        await updateDoc(taskRef, {
          attachments: updatedAttachments,
          lastModifiedBy: currentUserName,
          lastModifiedByEmail: currentUserEmail,
          lastModifiedAt: Date.now()
        });
        
        // Replace upload indicator with actual file item
        uploadItem.remove();
        await refreshAttachmentsList(podId, subId, taskId);
        
        console.log('[Attachments] File uploaded successfully:', file.name);
        
      } catch (error) {
        console.error('[Attachments] Error saving attachment:', error);
        uploadItem.innerHTML = `
          <div style="padding: 0.75rem; background: #ffebee; border-radius: 4px; margin-bottom: 0.5rem; color: #c62828;">
            <i class="fas fa-exclamation-circle"></i> Failed to save: ${file.name}
            <div style="font-size: 0.8rem; margin-top: 0.25rem; opacity: 0.8;">${error.message || 'Unknown error'}</div>
          </div>
        `;
        setTimeout(() => uploadItem.remove(), 5000);
      }
    };
    
    reader.onerror = () => {
      uploadItem.innerHTML = `
        <div style="padding: 0.75rem; background: #ffebee; border-radius: 4px; margin-bottom: 0.5rem; color: #c62828;">
          <i class="fas fa-exclamation-circle"></i> Failed to read file: ${file.name}
        </div>
      `;
      setTimeout(() => uploadItem.remove(), 5000);
    };
    
    // Read file as base64
    reader.readAsDataURL(file);
    
  } catch (error) {
    console.error('[Attachments] Error uploading file:', error);
    alert(`Error uploading file: ${error.message || 'Unknown error'}`);
  }
}

// Delete a file attachment
async function deleteFileAttachment(podId, subId, taskId, attachment, index) {
  try {
    const confirmed = await showConfirmModal(`Delete "${attachment.name}"?`);
    if (!confirmed) return;
    
    // Remove from Firestore (base64 data is stored directly, no storage to delete)
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
      const currentAttachments = taskSnap.data().attachments || [];
      const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
      
      const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
      const currentUserEmail = localStorage.getItem('userEmail') || '';
      
      await updateDoc(taskRef, {
        attachments: updatedAttachments,
        lastModifiedBy: currentUserName,
        lastModifiedByEmail: currentUserEmail,
        lastModifiedAt: Date.now()
      });
      
      // Refresh the list
      await refreshAttachmentsList(podId, subId, taskId);
    }
    
  } catch (error) {
    console.error('[Attachments] Error deleting attachment:', error);
    alert(`Error deleting file: ${error.message}`);
  }
}

// Refresh the attachments list in the drawer
async function refreshAttachmentsList(podId, subId, taskId) {
  const list = document.getElementById('attachmentsList');
  if (!list) return;
  
  try {
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    
    if (!taskSnap.exists()) return;
    
    const attachments = taskSnap.data().attachments || [];
    
    // Clear current list (except upload progress items)
    const uploadItems = list.querySelectorAll('.attachment-upload-item');
    list.innerHTML = '';
    uploadItems.forEach(item => list.appendChild(item));
    
    // Render attachments
    attachments.forEach((att, index) => {
      const item = document.createElement('div');
      item.className = 'attachment-item';
      
      // Format file size
      const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      };
      
      // Get file icon based on type
      const getFileIcon = (type) => {
        if (type.startsWith('image/')) return 'fa-file-image';
        if (type.startsWith('video/')) return 'fa-file-video';
        if (type.startsWith('audio/')) return 'fa-file-audio';
        if (type.includes('pdf')) return 'fa-file-pdf';
        if (type.includes('word') || type.includes('document')) return 'fa-file-word';
        if (type.includes('excel') || type.includes('spreadsheet')) return 'fa-file-excel';
        if (type.includes('powerpoint') || type.includes('presentation')) return 'fa-file-powerpoint';
        if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return 'fa-file-archive';
        return 'fa-file';
      };
      
      const icon = getFileIcon(att.type || '');
      const size = formatSize(att.size || 0);
      
      // Create download link - use base64 data if available, otherwise use url (for backward compatibility)
      const downloadUrl = att.data ? att.data : (att.url || '#');
      const downloadAttr = att.data ? 'download' : 'target="_blank"';
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f9f9f9; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid #e0e0e0;">
          <i class="fas ${icon}" style="color: #2196F3; font-size: 1.5rem; width: 24px; text-align: center;"></i>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; font-size: 0.9rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${att.name}">${att.name}</div>
            <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">${size}${att.uploadedBy ? ` • ${att.uploadedBy}` : ''}</div>
          </div>
          <a href="${downloadUrl}" ${downloadAttr} download="${att.name}" style="padding: 0.5rem; color: #2196F3; text-decoration: none; border-radius: 4px; transition: background 0.2s;" title="Download">
            <i class="fas fa-download"></i>
          </a>
          <button class="attachment-delete-btn" data-index="${index}" style="padding: 0.5rem; background: none; border: none; color: #ff3b30; cursor: pointer; border-radius: 4px; transition: background 0.2s;" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      list.appendChild(item);
      
      // Add delete handler
      const deleteBtn = item.querySelector('.attachment-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          deleteFileAttachment(podId, subId, taskId, att, index);
        });
      }
    });
    
  } catch (error) {
    console.error('[Attachments] Error refreshing list:', error);
  }
}

// ---------- Comments Helpers ----------
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightMentions(text, mentions) {
  if (!text) return '';
  let safe = escapeHtml(text);
  if (Array.isArray(mentions)) {
    mentions.forEach(m => {
      const name = (m.name || m.email || '').trim();
      if (!name) return;
      // Match @Name (basic, case-insensitive, word-boundary after)
      const pattern = new RegExp(`@${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=\\b)`, 'gi');
      safe = safe.replace(pattern, (match) => `<span style="color:#2196F3; font-weight:600;">${escapeHtml(match)}</span>`);
    });
  }
  return safe;
}

async function setupCommentsForTask(podId, subId, taskId) {
  // Clean up previous
  if (typeof activeCommentsUnsubscribe === 'function') {
    try { activeCommentsUnsubscribe(); } catch(_) {}
    activeCommentsUnsubscribe = null;
  }
  const listEl = document.getElementById('commentsList');
  if (listEl) {
    listEl.innerHTML = '<div style="padding: 0.75rem; color:#666; text-align:center;">Loading comments...</div>';
  }
  if (!podId || !subId || !taskId) return;
  const podRef = doc(db, 'pods', podId);
  const subRef = doc(podRef, 'subprojects', subId);
  const taskRef = doc(subRef, 'tasks', taskId);
  const commentsCol = collection(taskRef, 'comments');
  const qy = query(commentsCol, orderBy('timestamp', 'asc'));
  activeCommentsUnsubscribe = onSnapshot(qy, (snapshot) => {
    const comments = [];
    snapshot.forEach(d => {
      const data = d.data() || {};
      comments.push({
        id: d.id,
        text: data.text || '',
        mentions: Array.isArray(data.mentions) ? data.mentions : [],
        createdByName: data.createdByName || 'Unknown',
        createdByEmail: data.createdByEmail || '',
        createdAt: data.createdAt || null,
        timestamp: data.timestamp || 0
      });
    });
    renderCommentsList(comments);
  }, (err) => {
    console.error('[Comments] Listener error:', err);
    if (listEl) {
      listEl.innerHTML = '<div style="padding: 0.75rem; color:#c62828; text-align:center;">Failed to load comments</div>';
    }
  });
}

function renderCommentsList(comments) {
  const listEl = document.getElementById('commentsList');
  if (!listEl) return;
  if (!comments || comments.length === 0) {
    listEl.innerHTML = '<div style="padding: 0.75rem; color:#666; text-align:center;">No comments yet</div>';
    return;
  }
  const currentUserEmail = localStorage.getItem('userEmail') || '';
  const html = comments.map(c => {
    let when = '';
    try {
      const dt = c.createdAt?.toDate?.() || (c.timestamp ? new Date(c.timestamp) : null);
      when = dt ? getTimeAgo(dt) : '';
    } catch(_) {}
    // Show edit/delete for all comments
    const canEdit = true;
    const avatarUrl = c.createdByPhotoURL || '';
    const initials = (c.createdByName || 'U').split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
    const avatarEl = avatarUrl 
      ? `<img src="${escapeHtml(avatarUrl)}" alt="avatar" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid #e0e0e0;" />`
      : `<div style="width:24px; height:24px; border-radius:50%; background:#e0e0e0; color:#555; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; border:1px solid #d0d0d0;">${escapeHtml(initials)}</div>`;
    return `
      <div class="comment-item" data-comment-id="${escapeHtml(c.id)}" style="padding: 0.65rem 0.5rem; border-bottom: 1px solid #eee;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom: 6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${avatarEl}
            <div style="display:flex; align-items:baseline; gap:8px;">
              <div style="font-weight:700; color:#333;">${escapeHtml(c.createdByName)}</div>
              <div style="color:#999; font-size:0.8rem; white-space:nowrap;">${escapeHtml(when)}</div>
            </div>
          </div>
          ${canEdit ? `
            <div style="display:flex; gap:6px;">
              <button class="comment-edit-btn" title="Edit" style="background:none; border:none; color:#2196F3; cursor:pointer; padding:4px;">
                <i class="fas fa-pen"></i>
              </button>
              <button class="comment-delete-btn" title="Delete" style="background:none; border:none; color:#e74c3c; cursor:pointer; padding:4px;">
                <i class="fas fa-trash"></i>
              </button>
            </div>` : ''}
        </div>
        <div class="comment-content" style="color:#222; line-height:1.6; word-break:break-word; font-size:0.95rem;">${highlightMentions(c.text, c.mentions)}</div>
      </div>
    `;
  }).join('');
  listEl.innerHTML = html;
  // Scroll to bottom on new comments
  listEl.scrollTop = listEl.scrollHeight;
  // Wire up edit/delete handlers
  listEl.querySelectorAll('.comment-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.comment-item');
      if (!item) return;
      startInlineCommentEdit(item);
    });
  });
  listEl.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.comment-item');
      if (!item) return;
      await deleteCommentById(item.getAttribute('data-comment-id'));
    });
  });
}

async function extractMentionsFromText(text) {
  const users = await loadAssignableUsers();
  const tokens = new Set();
  // Capture @word tokens (first name, username-ish)
  const re = /@([A-Za-z][\w'.-]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tokens.add(m[1].toLowerCase());
  }
  if (tokens.size === 0) return [];
  const matches = [];
  users.forEach(u => {
    const name = (u.name || '').trim();
    const first = name ? name.split(' ')[0] : '';
    const email = (u.email || '').split('@')[0];
    const candidates = [first, name, email].filter(Boolean).map(s => s.toLowerCase());
    const found = Array.from(tokens).some(t => candidates.some(c => c === t));
    if (found) {
      matches.push({ id: u.id, name: u.name || u.email || 'User', email: u.email || '' });
    }
  });
  // Deduplicate by email/id
  const seen = new Set();
  return matches.filter(mit => {
    const key = mit.email || mit.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getActiveMentionRange(text, caretIndex) {
  // Find the last '@' before caret that starts a mention and has no space until caret
  let i = caretIndex - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') {
      // ensure start boundary (start of line or whitespace before)
      if (i === 0 || /\s/.test(text[i - 1])) {
        const query = text.slice(i + 1, caretIndex);
        if (!/\s/.test(query)) {
          return { start: i, end: caretIndex, query };
        }
      }
      break;
    }
    if (/\s/.test(ch)) break;
    i--;
  }
  return null;
}

async function handleMentionSuggestions(e) {
  const textarea = e.target;
  const dropdown = document.getElementById('mentionSuggestions');
  if (!textarea || !dropdown) return;
  const value = textarea.value;
  const caret = textarea.selectionStart;
  const range = getActiveMentionRange(value, caret);
  if (!range || range.query.length === 0) {
    dropdown.style.display = 'none';
    return;
  }
  const users = await loadAssignableUsers();
  const q = range.query.toLowerCase();
  const results = users
    .filter(u => {
      const name = (u.name || '').toLowerCase();
      const first = name.split(' ')[0] || '';
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || first.includes(q) || email.includes(q);
    })
    .slice(0, 8);
  if (results.length === 0) {
    dropdown.style.display = 'none';
    return;
  }
  dropdown.innerHTML = results.map(u => `
    <div class="mention-option" data-user-id="${escapeHtml(u.id)}" data-user-name="${escapeHtml(u.name || u.email)}" 
         style="padding:8px 10px; cursor:pointer; display:flex; align-items:center; gap:8px;">
      <i class="fas fa-at" style="color:#2196F3;"></i>
      <div style="display:flex; flex-direction:column;">
        <span style="font-weight:600; color:#333;">${escapeHtml(u.name || u.email)}</span>
        ${u.email ? `<span style="font-size:0.8rem; color:#777;">${escapeHtml(u.email)}</span>` : ''}
      </div>
    </div>
  `).join('');
  // Position dropdown just above the buttons (already absolute with bottom)
  dropdown.style.display = 'block';
  // Attach click handlers
  dropdown.querySelectorAll('.mention-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const name = opt.getAttribute('data-user-name') || '';
      if (!name) {
        dropdown.style.display = 'none';
        return;
      }
      // Replace the active mention range with @Full Name + space
      const before = value.slice(0, range.start);
      const after = value.slice(range.end);
      const insert = '@' + name + ' ';
      textarea.value = before + insert + after;
      const newCaret = (before + insert).length;
      textarea.setSelectionRange(newCaret, newCaret);
      textarea.focus();
      dropdown.style.display = 'none';
    });
  });
}

async function postCurrentDrawerComment() {
  if (!currentDrawerContext) return;
  const { podId, subId, taskId } = currentDrawerContext;
  const textarea = document.getElementById('newCommentTextarea');
  const dropdown = document.getElementById('mentionSuggestions');
  if (!textarea || !podId || !subId || !taskId) return;
  const text = (textarea.value || '').trim();
  if (text.length === 0) return;
  try {
    // Resolve mentions from text
    const mentions = await extractMentionsFromText(text);
    // Resolve current user's photo
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    let createdByPhotoURL = localStorage.getItem('userPhotoURL') || '';
    try {
      const users = await loadAssignableUsers();
      const me = users.find(u => (u.email || '').toLowerCase() === currentUserEmail.toLowerCase());
      if (me && me.photoURL) createdByPhotoURL = me.photoURL;
    } catch(_) {}
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const commentsCol = collection(taskRef, 'comments');
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    await addDoc(commentsCol, {
      text,
      mentions,
      createdByName: currentUserName,
      createdByEmail: currentUserEmail,
      createdByPhotoURL,
      createdAt: Timestamp.now(),
      timestamp: Date.now()
    });
    // Slack: send a single channel message if others are mentioned
    if (Array.isArray(mentions) && mentions.length > 0) {
      try {
        const taskTitle = document.getElementById('drawerTaskTitle')?.textContent || 'Task';
        // Resolve friendly pod and subproject names
        const podEntry = (Array.isArray(podInfo) ? podInfo.find(p => p.id === podId) : null);
        const podName = podEntry ? (podEntry.title || podEntry.id) : (podId || '');
        const subprojectsForPod = podToProjects.get(podId) || [];
        const subEntry = subprojectsForPod.find(p => p.subprojectId === subId);
        let subprojectName = subEntry ? subEntry.name : '';
        // Fallback: fetch subproject name from Firestore if not found in memory
        if (!subprojectName) {
          try {
            const podRef = doc(db, 'pods', podId);
            const subRef = doc(podRef, 'subprojects', subId);
            const subSnap = await getDoc(subRef);
            if (subSnap.exists()) {
              const sd = subSnap.data() || {};
              if (sd.name) subprojectName = sd.name;
            }
          } catch (_) {}
        }
        if (!subprojectName) subprojectName = subId || '';
        // Fire-and-forget; do not block UI
        const sendNotify = async () => {
          const trySend = async (url) => {
            return await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text,
                mentions,
                taskTitle,
                podId,
                podName,
                subId,
                subprojectName,
                taskId,
                createdByName: currentUserName,
                createdByEmail: currentUserEmail,
                channelMessage: false
              })
            });
          };
          // Try extensionless (normal) first; if 404, fallback to .js
          let resp = await trySend('/api/notify-slack');
          if (resp && resp.status === 404) {
            resp = await trySend('/api/notify-slack.js');
          }
          return resp;
        };
        sendNotify()
          .then(async (resp) => {
            if (!resp.ok) {
              const bodyText = await (resp ? resp.text().catch(() => '') : '');
              console.warn('[Slack] notify failed:', resp ? resp.status : 'no-response', bodyText);
            } else {
              console.log('[Slack] notify ok');
            }
          })
          .catch((err) => {
            console.error('[Slack] notify error:', err);
          });
      } catch (_) {}
    }
    // Notify mentioned users (skip self)
    for (const m of mentions) {
      const targetUserId = m.email || m.id;
      if (targetUserId && targetUserId !== currentUserEmail) {
        createNotification({
          userId: targetUserId,
          type: 'task_commented',
          taskId,
          taskText: document.getElementById('drawerTaskTitle')?.textContent || 'Task',
          podId,
          subprojectId: subId,
          changeType: 'commented',
          changedBy: currentUserName,
          changes: { snippet: text.slice(0, 140) }
        });
      }
    }
    // Clear input and hide dropdown
    textarea.value = '';
    if (dropdown) dropdown.style.display = 'none';
  } catch (e) {
    console.error('[Comments] Error posting comment:', e);
    alert('Failed to post comment. Please try again.');
  }
}

async function openTaskDrawer({ podId, subId, taskId, title, longDescription = '', attachments = [] }) {
  const drawer = document.getElementById('taskDrawer');
  if (!drawer) return;
  
  // If drawer is already open, just close it and return
  if (!drawer.classList.contains('hidden')) {
    drawer.classList.add('hidden');
    currentDrawerContext = null;
    return;
  }
  
  currentDrawerContext = { podId, subId, taskId };
  document.getElementById('drawerTaskTitle').textContent = title || 'Task Details';
  
  // Load up-to-date details from Firestore
  try {
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const snap = await getDoc(taskRef);
    if (snap.exists()) {
      const data = snap.data();
      longDescription = data.longDescription || longDescription || '';
      attachments = data.attachments || attachments || [];
      const createdByInfoEl = document.getElementById('taskCreatedByInfo');
      const createdByNameEl = document.getElementById('taskCreatedByName');
      if (createdByInfoEl && createdByNameEl) {
        const createdByName = (data.createdBy || data.createdByName || data.lastModifiedBy || '').trim();
        if (createdByName) {
          createdByNameEl.textContent = createdByName;
          createdByInfoEl.style.display = 'block';
        } else {
          createdByInfoEl.style.display = 'none';
        }
      }
    }
  } catch (_) {}
  
  const desc = document.getElementById('drawerLongDescription');
  if (desc) desc.value = longDescription || '';
  
  // Load attachments using the new file-based system
  await refreshAttachmentsList(podId, subId, taskId);
  // Load comments and wire real-time updates
  await setupCommentsForTask(podId, subId, taskId);
  // Load subtasks and wire real-time updates
  await setupSubtasksForTask(podId, subId, taskId);
  // Reset comment composer UI
  const cta = document.getElementById('newCommentTextarea');
  const suggestions = document.getElementById('mentionSuggestions');
  if (cta) cta.value = '';
  if (suggestions) suggestions.style.display = 'none';
  
  drawer.classList.remove('hidden');
}

// Inline edit comment
function startInlineCommentEdit(commentItemEl) {
  const contentEl = commentItemEl.querySelector('.comment-content');
  if (!contentEl) return;
  const originalHtml = contentEl.innerHTML;
  const originalText = contentEl.textContent || '';
  // Build editor
  const editor = document.createElement('div');
  editor.style.marginTop = '6px';
  const textarea = document.createElement('textarea');
  textarea.style.width = '100%';
  textarea.style.minHeight = '70px';
  textarea.style.boxSizing = 'border-box';
  textarea.value = originalText;
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '6px';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'save-comment-btn';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-comment-btn';
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  editor.appendChild(textarea);
  editor.appendChild(actions);
  // Replace
  contentEl.innerHTML = '';
  contentEl.appendChild(editor);
  textarea.focus();
  // Handlers
  cancelBtn.addEventListener('click', () => {
    contentEl.innerHTML = originalHtml;
  });
  saveBtn.addEventListener('click', async () => {
    const newText = (textarea.value || '').trim();
    if (newText.length === 0) {
      contentEl.innerHTML = originalHtml;
      return;
    }
    const commentId = commentItemEl.getAttribute('data-comment-id');
    await updateCommentById(commentId, newText);
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      contentEl.innerHTML = originalHtml;
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    }
  });
}

async function updateCommentById(commentId, newText) {
  try {
    if (!currentDrawerContext) return;
    const { podId, subId, taskId } = currentDrawerContext;
    if (!podId || !subId || !taskId || !commentId) return;
    const mentions = await extractMentionsFromText(newText);
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const commentRef = doc(taskRef, 'comments', commentId);
    await updateDoc(commentRef, {
      text: newText,
      mentions,
      editedAt: Timestamp.now(),
      editedAtMs: Date.now()
    });
  } catch (e) {
    console.error('[Comments] Error updating comment:', e);
    alert('Failed to update comment. Please try again.');
  }
}

async function deleteCommentById(commentId) {
  try {
    if (!currentDrawerContext) return;
    const { podId, subId, taskId } = currentDrawerContext;
    if (!podId || !subId || !taskId || !commentId) return;
    const confirmed = await showConfirmModal('Delete this comment?');
    if (!confirmed) return;
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const commentRef = doc(taskRef, 'comments', commentId);
    await deleteDoc(commentRef);
  } catch (e) {
    console.error('[Comments] Error deleting comment:', e);
    alert('Failed to delete comment. Please try again.');
  }
}

// ============ MY TASKS FUNCTIONALITY ============

// Function to load tasks with optional user and project filters from visible tasks on the page
function loadMyTasks(filterUser = null, filterProject = null, dateFilter = null) {
  const myTasksList = [];
  
  // If no filter specified, use current user
  if (filterUser === null && !dateFilter) {
    const userName = localStorage.getItem('userName') || '';
    filterUser = userName.split(' ')[0];
  }
  
  console.log('[My Tasks] Filtering by user:', filterUser || 'All Users', 'project:', filterProject || 'All Projects', 'date:', dateFilter || 'All Dates');
  
  // Get ALL pod cards (not just visible ones) to allow filtering across all projects
  const allPods = Array.from(document.querySelectorAll('.pod-card'));
  
  console.log('[My Tasks] Checking all pods:', allPods.length);
  
  // Get today's date for date filtering
  const todayStr = getLocalTodayString();
  
  allPods.forEach(podCard => {
    const podId = podCard.dataset.podId;
    const podData = podInfo.find(p => p.id === podId);
    const podTitle = podData ? podData.title : podId;
    
    // Check if this pod matches the project filter
    if (filterProject && podId !== filterProject) {
      return; // Skip this pod if it doesn't match
    }
    
    // Get all subprojects in this pod
    const subprojects = podCard.querySelectorAll('.subproject-card');
    
    subprojects.forEach(subCard => {
      const subTitle = subCard.querySelector('.subproject-title')?.textContent || 'Untitled';
      const subId = subCard.dataset.subprojectId;
      
      // Get incomplete tasks from this subproject
      const taskList = subCard.querySelector('.task-list > ul:not(.completed-list)');
      if (!taskList) return;
      
      const tasks = taskList.querySelectorAll('li');
      
      tasks.forEach(taskLi => {
        // Skip hidden tasks (filtered out by My Tasks filter)
        const display = taskLi.style.display;
        if (display === 'none') {
          return;
        }
        
        const assigneeDisplay = taskLi.querySelector('.assignee-display');
        const taskText = taskLi.querySelector('.task-text')?.textContent || 'Untitled Task';
        const dateInput = taskLi.querySelector('.date-input');
        const timeDisplay = taskLi.querySelector('.time-display');
        const statusSelect = taskLi.querySelector('.status-select');
        
        const assigneeText = assigneeDisplay?.textContent || 'Unassigned';
        const dueDate = dateInput?.value || '';
        // Get time from data attribute
        const dueTime = timeDisplay?.getAttribute('data-time') || '';
        
        // Apply date filter if specified
        if (dateFilter === 'dueToday') {
          if (dueDate !== todayStr) {
            return; // Skip if not due today
          }
        } else if (dateFilter === 'overdue') {
          if (!dueDate || dueDate >= todayStr) {
            return; // Skip if not overdue
          }
        }
        
        // Check if this task matches the user filter
        // If filterUser is empty string, show all tasks
        // Otherwise, check if assignee includes the filter name
        const userMatches = !filterUser || assigneeText.includes(filterUser);
        
        if (userMatches) {
          // Get taskId from the task list item's data attribute
          const taskId = taskLi.dataset?.taskId || null;
          
          console.log('[My Tasks] Match found:', taskText, 'assignee:', assigneeText, 'pod:', podTitle, 'due:', dueDate, 'taskId:', taskId);
          
          myTasksList.push({
            podId,
            podTitle,
            subprojectId: subId,
            subTitle,
            taskId,
            text: taskText,
            dueDate: dueDate,
            dueTime: dueTime,
            status: statusSelect?.value || 'Open',
            assignee: assigneeText
          });
        }
      });
    });
  });
  
  console.log(`[My Tasks] Total matched: ${myTasksList.length}`);
  
  // Sort by due date
  myTasksList.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  return myTasksList;
}

// Function to render tasks in the modal
function renderTasksInModal(filterUser = null, filterProject = null, dateFilter = null, modalTitle = 'Tasks') {
  const content = document.getElementById('myTasksContent');
  const modalTitleEl = document.querySelector('#myTasksModal h2');
  
  if (!content) {
    console.error('Content element not found');
    return;
  }
  
  // Update modal title if provided
  if (modalTitleEl && modalTitle) {
    modalTitleEl.textContent = modalTitle;
  }
  
  try {
    console.log('[My Tasks] Loading tasks...');
    const myTasks = loadMyTasks(filterUser, filterProject, dateFilter);
    console.log('[My Tasks] Found tasks:', myTasks.length, myTasks);
    
    if (myTasks.length === 0) {
      let filterText = 'tasks';
      let projectName = '';
      if (filterProject) {
        const podData = podInfo.find(p => p.id === filterProject);
        projectName = podData ? podData.title : filterProject;
      }
      
      if (dateFilter === 'dueToday') {
        filterText = 'tasks due today';
      } else if (dateFilter === 'overdue') {
        filterText = 'overdue tasks';
      } else if (filterUser && filterProject) {
        filterText = `tasks assigned to <strong>${filterUser}</strong> in project <strong>${projectName}</strong>`;
      } else if (filterUser) {
        filterText = `tasks assigned to <strong>${filterUser}</strong>`;
      } else if (filterProject) {
        filterText = `tasks in project <strong>${projectName}</strong>`;
      }
      content.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #333;">
          <p style="margin-bottom: 0.5rem;">No ${filterText}.</p>
        </div>
      `;
      return;
    }
    
    const today = getLocalTodayString();
    
    let html = '';
    
    myTasks.forEach(task => {
      const isOverdue = task.dueDate && task.dueDate < today;
      const borderColor = isOverdue ? '#ff6b6b' : '#2196F3';
      const statusColor = getStatusColor(task.status);
      
      // Only make clickable if we have navigation data
      const isClickable = task.podId && task.subprojectId && task.taskId;
      const cursorStyle = isClickable ? 'cursor: pointer;' : '';
      const hoverStyle = isClickable ? 'transition: all 0.2s;' : '';
      
      html += `
        <div class="modal-task-item" 
             data-pod-id="${task.podId || ''}" 
             data-subproject-id="${task.subprojectId || ''}" 
             data-task-id="${task.taskId || ''}"
             style="background: #f9f9f9; padding: 1rem; border-radius: 8px; border-left: 4px solid ${borderColor}; margin-bottom: 0.75rem; ${cursorStyle} ${hoverStyle}"
             ${isClickable ? 'title="Click to view task in project"' : ''}>
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 0.25rem; color: #000;">
                ${task.text}
              </div>
              <div style="color: #666; font-size: 0.85rem;">
                ${task.podTitle} → ${task.subTitle}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.9rem; color: #333;">
            <div>
              <span style="color: #666;">Assigned to:</span>
              <span style="color: #000; font-weight: 500;">
                ${task.assignee || 'Unassigned'}
              </span>
            </div>
            <div>
              <span style="color: #666;">Due:</span>
              <span style="color: ${isOverdue ? '#ff6b6b' : '#000'}; font-weight: ${isOverdue ? 'bold' : 'normal'};">
                ${task.dueDate || 'No date'}${task.dueTime ? ' at ' + formatTimeDisplay(task.dueTime) : ''}
              </span>
              ${isOverdue ? '<span style="color: #ff6b6b; margin-left: 0.25rem;">(OVERDUE)</span>' : ''}
            </div>
            <div>
              <span style="color: #666;">Status:</span>
              <span style="color: ${statusColor}; font-weight: 500;">
                ${task.status}
              </span>
            </div>
          </div>
          ${isClickable ? `
            <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #eee; font-size: 0.85rem; color: #2196F3; text-align: center;">
              <i class="fas fa-arrow-right" style="margin-right: 0.5rem;"></i>Click to view task
            </div>
          ` : ''}
        </div>
      `;
    });
    
    content.innerHTML = html;
    
    // Add click handlers to task items
    if (content) {
      const taskItems = content.querySelectorAll('.modal-task-item');
      taskItems.forEach(item => {
        const podId = item.dataset.podId;
        const subprojectId = item.dataset.subprojectId;
        const taskId = item.dataset.taskId;
        
        if (podId && subprojectId && taskId) {
          item.addEventListener('click', () => {
            // Close the modal first
            const modal = document.getElementById('myTasksModal');
            if (modal) {
              modal.style.display = 'none';
            }
            
            // Navigate to the task
            console.log('[My Tasks] Navigating to task:', { podId, subprojectId, taskId });
            navigateToTask(podId, subprojectId, taskId);
          });
          
          // Add hover effect
          item.addEventListener('mouseenter', () => {
            if (podId && subprojectId && taskId) {
              item.style.backgroundColor = '#f0f8ff';
              item.style.transform = 'translateX(4px)';
              item.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.2)';
            }
          });
          
          item.addEventListener('mouseleave', () => {
            if (podId && subprojectId && taskId) {
              item.style.backgroundColor = '#f9f9f9';
              item.style.transform = 'translateX(0)';
              item.style.boxShadow = '';
            }
          });
        }
      });
    }
    
  } catch (error) {
    console.error('[My Tasks] Error rendering tasks:', error);
    content.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #ff6b6b;">
        <p>Error loading tasks. Please try again.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">${error.message}</p>
      </div>
    `;
  }
}

// Function to populate user filter dropdown
async function populateUserFilter() {
  const userFilter = document.getElementById('taskUserFilter');
  if (!userFilter) return;
  
  try {
    const users = await loadAssignableUsers();
    
    // Clear existing options except "All Users"
    userFilter.innerHTML = '<option value="">All Users</option>';
    
    // Add each user as an option (using first name for simplicity)
    users.forEach(user => {
      const firstName = user.name ? user.name.split(' ')[0] : user.email;
      const option = document.createElement('option');
      option.value = firstName;
      option.textContent = user.name || user.email;
      userFilter.appendChild(option);
    });
    
    // Add "Unassigned" option at the end
    const unassignedOption = document.createElement('option');
    unassignedOption.value = 'Unassigned';
    unassignedOption.textContent = 'Unassigned';
    userFilter.appendChild(unassignedOption);
    
    console.log('[My Tasks] Populated filter with', users.length, 'users');
  } catch (error) {
    console.error('[My Tasks] Error populating user filter:', error);
  }
}

// Function to populate project filter dropdown
function populateProjectFilter() {
  const projectFilter = document.getElementById('taskProjectFilter');
  if (!projectFilter) return;
  
  // Clear existing options
  projectFilter.innerHTML = '<option value="">All Projects</option>';
  
  // Use all pods from podInfo instead of just visible ones
  const pods = podInfo.map(pod => ({
    id: pod.id,
    title: pod.title
  }));
  
  // Sort pods alphabetically
  pods.sort((a, b) => a.title.localeCompare(b.title));
  
  // Add pods to dropdown
  pods.forEach(pod => {
    const option = document.createElement('option');
    option.value = pod.id;
    option.textContent = pod.title;
    projectFilter.appendChild(option);
  });
  
  console.log('[My Tasks] Populated project filter with', pods.length, 'main projects');
}

// Function to open the My Tasks modal
async function openMyTasksModal(dateFilter = null, modalTitle = 'Tasks', initialProjectId = null) {
  const modal = document.getElementById('myTasksModal');
  const userFilter = document.getElementById('taskUserFilter');
  const projectFilter = document.getElementById('taskProjectFilter');
  const modalTitleEl = document.querySelector('#myTasksModal h2');
  
  if (!modal) {
    console.error('Modal element not found');
    return;
  }
  
  // Update modal title
  if (modalTitleEl) {
    modalTitleEl.textContent = modalTitle;
  }
  
  // Populate user filter dropdown
  await populateUserFilter();
  
  // Populate project filter dropdown
  populateProjectFilter();
  
  // If date filter is set, hide user filter and show only project filter
  // Otherwise, show both filters
  const filterContainer = document.querySelector('#myTasksModal > div > div:first-child');
  if (filterContainer && dateFilter) {
    // For date filters, set user filter to "All Users" and project to "All Projects"
    if (userFilter) userFilter.value = '';
    if (projectFilter) {
      // Robustly preselect the current project in the dropdown
      const targetId = initialProjectId || '';
      if (targetId) {
        // Ensure an option exists for the project
        let existing = Array.from(projectFilter.options).find(o => o.value === targetId);
        if (!existing) {
          const pod = Array.isArray(podInfo) ? podInfo.find(p => p.id === targetId) : null;
          const title = pod ? (pod.title || targetId) : targetId;
          projectFilter.add(new Option(title, targetId));
        }
      }
      projectFilter.value = targetId;
      // Trigger change so UI reflects the selection in any custom styling
      projectFilter.dispatchEvent(new Event('change'));
    }
  } else {
    // Set user dropdown to current user by default for My Tasks
    if (userFilter && !dateFilter) {
      const userName = localStorage.getItem('userName') || '';
      const userFirstName = userName.split(' ')[0];
      userFilter.value = userFirstName;
    } else if (userFilter) {
      userFilter.value = '';
    }
    
    // Set project dropdown to "All Projects" by default
    if (projectFilter) {
      projectFilter.value = '';
    }
  }
  
  // Show modal
  modal.style.display = 'block';
  
  // Render tasks with current filters
  const effectiveProjectId = dateFilter ? (initialProjectId || (projectFilter ? projectFilter.value || '' : '')) : (projectFilter ? projectFilter.value || '' : '');
  renderTasksInModal(
    userFilter ? userFilter.value || null : null,
    effectiveProjectId || null,
    dateFilter,
    modalTitle
  );
}

// Function to open modal for tasks due today
async function openDueTodayModal() {
  const currentPodId = getCurrentVisiblePodId();
  const title = currentPodId ? `Tasks Due Today – ${getPodTitleById(currentPodId)}` : 'Tasks Due Today';
  await openMyTasksModal('dueToday', title, currentPodId);
}

// Function to open modal for overdue tasks
async function openOverdueModal() {
  const currentPodId = getCurrentVisiblePodId();
  const title = currentPodId ? `Overdue Tasks – ${getPodTitleById(currentPodId)}` : 'Overdue Tasks';
  await openMyTasksModal('overdue', title, currentPodId);
}

// Helper function to get status color
function getStatusColor(status) {
  const statusLower = (status || 'open').toLowerCase();
  switch (statusLower) {
    case 'open': return '#4CAF50';
    case 'recurring': return '#9C27B0';
    case 'on-hold': return '#FF9800';
    case 'waiting on client feedback': return '#FFC107';
    case 'in-progress': return '#2196F3';
    case 'awaiting front-end verification': return '#00BCD4';
    default: return '#9E9E9E';
  }
}

// Helper: determine the currently visible pod (project)
function getCurrentVisiblePodId() {
  const visiblePod = Array.from(document.querySelectorAll('.pod-card')).find(pod => {
    const style = pod.getAttribute('style');
    return !style || !style.includes('display: none');
  });
  return visiblePod ? visiblePod.dataset.podId : null;
}

function getPodTitleById(podId) {
  const pod = (Array.isArray(podInfo) ? podInfo.find(p => p.id === podId) : null);
  return pod ? (pod.title || pod.id) : (podId || 'Projects');
}

// Initialize My Tasks modal event listeners
function initMyTasksModal() {
  const myTasksKpi = document.getElementById('myTasksKpi');
  const closeMyTasksModal = document.getElementById('closeMyTasksModal');
  const modal = document.getElementById('myTasksModal');
  const userFilter = document.getElementById('taskUserFilter');
  const projectFilter = document.getElementById('taskProjectFilter');
  
  if (myTasksKpi) {
    myTasksKpi.addEventListener('click', openMyTasksModal);
  }
  
  if (closeMyTasksModal) {
    closeMyTasksModal.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }
  
  // Add event listener for user filter dropdown
  if (userFilter) {
    userFilter.addEventListener('change', (e) => {
      const userFilterValue = e.target.value;
      const projectFilterValue = projectFilter ? projectFilter.value : '';
      const modalTitleEl = document.querySelector('#myTasksModal h2');
      const modalTitle = modalTitleEl ? modalTitleEl.textContent : 'Tasks';
      
      // Determine date filter from modal title
      let dateFilter = null;
      const titleLc = (modalTitle || '').toLowerCase();
      if (titleLc.includes('tasks due today')) dateFilter = 'dueToday';
      else if (titleLc.includes('overdue tasks')) dateFilter = 'overdue';
      
      console.log('[My Tasks] User filter changed to:', userFilterValue || 'All Users');
      renderTasksInModal(userFilterValue || '', projectFilterValue || '', dateFilter, modalTitle);
    });
  }
  
  // Add event listener for project filter dropdown
  if (projectFilter) {
    projectFilter.addEventListener('change', (e) => {
      const userFilterValue = userFilter ? userFilter.value : '';
      const projectFilterValue = e.target.value;
      const modalTitleEl = document.querySelector('#myTasksModal h2');
      const modalTitle = modalTitleEl ? modalTitleEl.textContent : 'Tasks';
      
      // Determine date filter from modal title
      let dateFilter = null;
      const titleLc = (modalTitle || '').toLowerCase();
      if (titleLc.includes('tasks due today')) dateFilter = 'dueToday';
      else if (titleLc.includes('overdue tasks')) dateFilter = 'overdue';
      
      console.log('[My Tasks] Project filter changed to:', projectFilterValue || 'All Projects');
      renderTasksInModal(userFilterValue || '', projectFilterValue || '', dateFilter, modalTitle);
    });
  }
  
  // Add click handlers for Due Today and Overdue KPIs
  const dueTodayKpi = document.getElementById('dueTodayKpi');
  const overdueKpi = document.getElementById('overdueKpi');
  
  if (dueTodayKpi) {
    dueTodayKpi.addEventListener('click', openDueTodayModal);
  }
  
  if (overdueKpi) {
    overdueKpi.addEventListener('click', openOverdueModal);
  }
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
}

// ============ NOTIFICATION SYSTEM ============

let notificationListener = null;
let taskChangeListeners = new Map(); // Map of taskId -> unsubscribe function

// Create a notification in Firestore
async function createNotification({ userId, type, taskId, taskText, podId, subprojectId, changeType, changedBy, changes = {} }) {
  try {
    const notificationsCol = collection(db, 'notifications');
    const notification = {
      userId,
      type, // 'task_assigned', 'task_updated'
      taskId,
      taskText: taskText || 'Untitled Task',
      podId,
      subprojectId,
      changeType, // 'assigned', 'updated', 'status_changed', 'date_changed', etc.
      changedBy,
      changes,
      read: false,
      createdAt: Timestamp.now(),
      timestamp: Date.now()
    };
    
    await addDoc(notificationsCol, notification);
    console.log('[Notifications] Created notification:', notification);
  } catch (error) {
    console.error('[Notifications] Error creating notification:', error);
  }
}

// Initialize notification listener for current user
function initNotificationListener() {
  const currentUserEmail = localStorage.getItem('userEmail') || '';
  // Always use email as userId for consistency with notification creation
  const currentUserId = currentUserEmail || localStorage.getItem('userId');
  
  if (!currentUserId) {
    console.log('[Notifications] No user ID found, skipping notification listener');
    return;
  }
  
  console.log('[Notifications] Initializing listener for user:', currentUserId, '(email:', currentUserEmail, ')');
  
  // Listen for notifications for this user
  const notificationsCol = collection(db, 'notifications');
  const q = query(
    notificationsCol,
    where('userId', '==', currentUserId),
    orderBy('timestamp', 'desc')
  );
  
  let previousUnreadCount = 0;
  
  notificationListener = onSnapshot(q, (snapshot) => {
    const unreadCount = snapshot.docs.filter(d => !d.data().read).length;
    
    // Play sound if new unread notification arrived
    if (unreadCount > previousUnreadCount) {
      playNotificationSound();
      // Show browser notification if permission granted
      showBrowserNotification();
    }
    
    updateNotificationBadge(unreadCount);
    previousUnreadCount = unreadCount;
    
    console.log('[Notifications] Updated - Total:', snapshot.docs.length, 'Unread:', unreadCount);
  }, (error) => {
    console.error('[Notifications] Listener error:', error);
  });
}

// Update notification badge in the UI
function updateNotificationBadge(count) {
  const badge = document.getElementById('notificationBadge');
  const bell = document.getElementById('notificationBell');
  
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
      
      // Add pulse animation for new notifications
      if (bell) {
        bell.style.animation = 'none';
        setTimeout(() => {
          bell.style.animation = 'bellPulse 0.5s ease-in-out';
        }, 10);
      }
    } else {
      badge.style.display = 'none';
    }
  }
}

// Track task changes to generate notifications
function setupTaskChangeListener(podId, subId, taskId, taskData) {
  // Clean up existing listener if present
  if (taskChangeListeners.has(taskId)) {
    const oldUnsubscribe = taskChangeListeners.get(taskId);
    if (oldUnsubscribe) oldUnsubscribe();
    taskChangeListeners.delete(taskId);
  }
  
  const podRef = doc(db, 'pods', podId);
  const subRef = doc(podRef, 'subprojects', subId);
  const taskRef = doc(subRef, 'tasks', taskId);
  
  // Store the previous state
  let previousData = { ...taskData };
  let isFirstSnapshot = true; // Skip the first snapshot to avoid false notifications on load
  
  const unsubscribe = onSnapshot(taskRef, async (snapshot) => {
    if (!snapshot.exists()) return;
    
    const newData = snapshot.data();
    
    // Skip first snapshot (initial load)
    if (isFirstSnapshot) {
      console.log('[Notifications] First snapshot for task, skipping notifications:', newData.text);
      isFirstSnapshot = false;
      // Update previousData so we have the initial state for comparison
      previousData = { ...newData };
      return;
    }
    
    // Get who made the change from the task data (not localStorage!)
    const changedByName = newData.lastModifiedBy || 'Someone';
    const changedByEmail = newData.lastModifiedByEmail || '';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    
    console.log('[Notifications] Task snapshot received:', {
      taskId,
      taskText: newData.text,
      changedBy: changedByName,
      changedByEmail: changedByEmail,
      currentUserEmail: currentUserEmail,
      oldAssignees: previousData.assignees,
      newAssignees: newData.assignees
    });
    
    // CRITICAL: Only create notifications if THIS browser session made the change
    // This prevents duplicate notifications when multiple users have the page open
    if (changedByEmail !== currentUserEmail) {
      console.log('[Notifications] Change was made by another user, skipping notification creation on this client');
      previousData = { ...newData };
      return;
    }
    
    console.log('[Notifications] This client made the change, proceeding with notification creation');
    
    // Check for assignment changes
    const oldAssignees = Array.isArray(previousData.assignees) ? previousData.assignees : [];
    const newAssignees = Array.isArray(newData.assignees) ? newData.assignees : [];
    
    // Find newly assigned users
    const newlyAssigned = newAssignees.filter(newA => 
      !oldAssignees.some(oldA => oldA.id === newA.id)
    );
    
    // Create notifications for newly assigned users
    for (const assignee of newlyAssigned) {
      // Don't notify yourself OR the person who made the change
      if (assignee.email !== currentUserEmail && assignee.email !== changedByEmail) {
        // Use email as userId for consistency (same as what we check in listener)
        const targetUserId = assignee.email || assignee.id;
        
        console.log('[Notifications] Creating assignment notification', {
          targetUserId,
          taskText: newData.text,
          changedBy: changedByName,
          assignee
        });
        
        createNotification({
          userId: targetUserId,
          type: 'task_assigned',
          taskId,
          taskText: newData.text || 'Untitled Task',
          podId,
          subprojectId: subId,
          changeType: 'assigned',
          changedBy: changedByName,
          changes: {
            assignedTo: assignee.name || assignee.email
          }
        });
        // Also send Slack DM to the assignee (no channel message)
        try {
          const podEntry = (Array.isArray(podInfo) ? podInfo.find(p => p.id === podId) : null);
          const podName = podEntry ? (podEntry.title || podEntry.id) : (podId || '');
          const subprojectsForPod = podToProjects.get(podId) || [];
          const subEntry = subprojectsForPod.find(p => p.subprojectId === subId);
          let subprojectName = subEntry ? subEntry.name : '';
          if (!subprojectName) {
            try {
              const podRef = doc(db, 'pods', podId);
              const subRef = doc(podRef, 'subprojects', subId);
              const subSnap = await getDoc(subRef);
              if (subSnap.exists()) subprojectName = (subSnap.data() || {}).name || '';
            } catch (_) {}
          }
          fetch('/api/notify-slack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `Task assigned to you: ${newData.text || 'Task'}`,
              mentions: [{ name: assignee.name || '', email: assignee.email || '' }],
              taskTitle: newData.text || 'Task',
              podId,
              podName,
              subId,
              subprojectName: subprojectName || subId,
              taskId,
              createdByName: changedByName,
              createdByEmail: changedByEmail,
              channelMessage: false
            })
          }).catch(() => {});
        } catch (_) {}
      } else {
        console.log('[Notifications] Skipping self-notification for assignment', {
          assigneeEmail: assignee.email,
          currentUserEmail,
          changedByEmail
        });
      }
    }
    
    // Check for other changes that should notify assigned users
    const changedFields = [];
    
    if (previousData.text !== newData.text && previousData.text) {
      changedFields.push({ field: 'Task Name', old: previousData.text, new: newData.text });
    }
    if (previousData.dueDate !== newData.dueDate) {
      changedFields.push({ field: 'Due Date', old: previousData.dueDate || 'None', new: newData.dueDate || 'None' });
    }
    if (previousData.status !== newData.status && previousData.status) {
      changedFields.push({ field: 'Status', old: previousData.status, new: newData.status });
    }
    // Check for description changes - detect both additions and updates
    const oldDesc = (previousData.longDescription || '').trim();
    const newDesc = (newData.longDescription || '').trim();
    
    if (oldDesc !== newDesc) {
      // Only notify if there's actual content (not just clearing empty -> empty)
      if (oldDesc.length > 0 || newDesc.length > 0) {
        if (oldDesc.length === 0 && newDesc.length > 0) {
          changedFields.push({ field: 'Description', old: 'None', new: 'Added' });
        } else if (oldDesc.length > 0 && newDesc.length === 0) {
          changedFields.push({ field: 'Description', old: 'Removed', new: 'None' });
        } else {
          changedFields.push({ field: 'Description', old: 'Updated', new: 'Updated' });
        }
      }
    }
    
    // Check for attachment changes
    const oldAttachments = Array.isArray(previousData.attachments) ? previousData.attachments : [];
    const newAttachments = Array.isArray(newData.attachments) ? newData.attachments : [];
    
    if (oldAttachments.length !== newAttachments.length) {
      const oldCount = oldAttachments.length;
      const newCount = newAttachments.length;
      
      if (oldCount === 0 && newCount > 0) {
        changedFields.push({ field: 'Attachments', old: 'None', new: `${newCount} added` });
      } else if (oldCount > 0 && newCount === 0) {
        changedFields.push({ field: 'Attachments', old: `${oldCount} removed`, new: 'None' });
      } else {
        changedFields.push({ field: 'Attachments', old: `${oldCount}`, new: `${newCount}` });
      }
    }
    
    // If there are changes, notify all assigned users except the person who made the change
    if (changedFields.length > 0 && newAssignees.length > 0) {
      console.log('[Notifications] Task updated, notifying assignees', {
        changedFields,
        assigneeCount: newAssignees.length,
        taskText: newData.text,
        changedBy: changedByName
      });
      
      for (const assignee of newAssignees) {
        // Don't notify the person who made the change
        if (assignee.email !== changedByEmail) {
          // Use email as userId for consistency
          const targetUserId = assignee.email || assignee.id;
          
          console.log('[Notifications] Creating update notification', {
            targetUserId,
            changedBy: changedByName,
            changedFields: changedFields.map(f => f.field)
          });
          
          createNotification({
            userId: targetUserId,
            type: 'task_updated',
            taskId,
            taskText: newData.text || 'Untitled Task',
            podId,
            subprojectId: subId,
            changeType: 'updated',
            changedBy: changedByName,
            changes: { fields: changedFields }
          });
          // Also send Slack DM to the assignee (no channel message)
          try {
            const podEntry = (Array.isArray(podInfo) ? podInfo.find(p => p.id === podId) : null);
            const podName = podEntry ? (podEntry.title || podEntry.id) : (podId || '');
            const subprojectsForPod = podToProjects.get(podId) || [];
            const subEntry = subprojectsForPod.find(p => p.subprojectId === subId);
            let subprojectName = subEntry ? subEntry.name : '';
            if (!subprojectName) {
              try {
                const podRef = doc(db, 'pods', podId);
                const subRef = doc(podRef, 'subprojects', subId);
                const subSnap = await getDoc(subRef);
                if (subSnap.exists()) subprojectName = (subSnap.data() || {}).name || '';
              } catch (_) {}
            }
            const changeSummary = changedFields.map(f => `${f.field}: ${f.old || ''} → ${f.new || ''}`).slice(0, 3).join(' | ');
            fetch('/api/notify-slack', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `Task updated: ${newData.text || 'Task'}${changeSummary ? ' • ' + changeSummary : ''}`,
                mentions: [{ name: assignee.name || '', email: assignee.email || '' }],
                taskTitle: newData.text || 'Task',
                podId,
                podName,
                subId,
                subprojectName: subprojectName || subId,
                taskId,
                createdByName: changedByName,
                createdByEmail: changedByEmail,
                channelMessage: false
              })
            }).catch(() => {});
          } catch (_) {}
        } else {
          console.log('[Notifications] Skipping notification for person who made the change:', changedByName);
        }
      }
    }
    
    // Update previous data for next comparison
    previousData = { ...newData };
  }, (error) => {
    console.error('[Notifications] Task listener error:', error);
  });
  
  taskChangeListeners.set(taskId, unsubscribe);
}

// Clean up all task change listeners (for notifications)
function cleanupTaskListeners() {
  taskChangeListeners.forEach((unsubscribe, taskId) => {
    if (unsubscribe) unsubscribe();
  });
  taskChangeListeners.clear();
  console.log('[Notifications] Cleaned up all task change listeners');
}

// Clean up all real-time listeners
function cleanupAllRealTimeListeners() {
  // Clean up subproject listeners
  subprojectListeners.forEach((unsubscribe, podId) => {
    if (unsubscribe) unsubscribe();
  });
  subprojectListeners.clear();
  
  // Clean up task listeners
  taskListeners.forEach((unsubscribe, key) => {
    if (unsubscribe) unsubscribe();
  });
  taskListeners.clear();
  
  console.log('[Projects] Cleaned up all real-time listeners');
}

// Clean up listeners when page is unloaded
window.addEventListener('beforeunload', () => {
  cleanupAllRealTimeListeners();
  cleanupTaskListeners();
});

// Open notifications modal
async function openNotificationsModal() {
  const modal = document.getElementById('notificationsModal');
  const content = document.getElementById('notificationsContent');
  
  if (!modal || !content) return;
  
  const currentUserEmail = localStorage.getItem('userEmail') || '';
  // Always use email as userId for consistency
  const currentUserId = currentUserEmail || localStorage.getItem('userId');
  
  // Show modal
  modal.style.display = 'block';
  
  // Load notifications
  content.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">Loading notifications...</div>';
  
  try {
    const notificationsCol = collection(db, 'notifications');
    const q = query(
      notificationsCol,
      where('userId', '==', currentUserId),
      orderBy('timestamp', 'desc'),
      limit(10) // Only show last 10 notifications
    );
    
    const snapshot = await getDocs(q);
    
    // Delete any notifications beyond the 10 most recent
    const allNotificationsQuery = query(
      notificationsCol,
      where('userId', '==', currentUserId),
      orderBy('timestamp', 'desc')
    );
    const allSnapshot = await getDocs(allNotificationsQuery);
    
    // If more than 10, delete the excess
    if (allSnapshot.size > 10) {
      const toDelete = [];
      allSnapshot.forEach((doc, index) => {
        if (index >= 10) {
          toDelete.push(deleteDoc(doc.ref));
        }
      });
      
      if (toDelete.length > 0) {
        await Promise.all(toDelete);
        console.log(`[Notifications] Deleted ${toDelete.length} old notifications`);
      }
    }
    
    if (snapshot.empty) {
      content.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">No notifications yet.</div>';
      return;
    }
    
    let html = '';
    
    snapshot.forEach(notifDoc => {
      const notif = notifDoc.data();
      const isUnread = !notif.read;
      const timestamp = notif.createdAt?.toDate?.() || new Date(notif.timestamp);
      const timeAgo = getTimeAgo(timestamp);
      
      // Get pod and subproject names
      const podData = podInfo.find(p => p.id === notif.podId);
      const podTitle = podData ? podData.title : notif.podId;
      
      let changeText = '';
      if (notif.changeType === 'assigned') {
        changeText = `<strong>${notif.changedBy}</strong> assigned you to a task`;
      } else if (notif.changeType === 'commented') {
        changeText = `<strong>${notif.changedBy}</strong> commented on a task`;
      } else if (notif.changeType === 'updated' && notif.changes?.fields) {
        const fields = notif.changes.fields.map(f => f.field).join(', ');
        changeText = `<strong>${notif.changedBy}</strong> updated ${fields}`;
      } else {
        changeText = `<strong>${notif.changedBy}</strong> made changes`;
      }
      
      html += `
        <div class="notification-item ${isUnread ? 'notification-unread' : ''}" 
             data-notification-id="${notifDoc.id}" 
             data-pod-id="${notif.podId}" 
             data-subproject-id="${notif.subprojectId}" 
             data-task-id="${notif.taskId}"
             style="background: ${isUnread ? '#f0f8ff' : '#f9f9f9'}; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border-left: 4px solid ${isUnread ? '#2196F3' : '#ddd'}; cursor: pointer; transition: all 0.2s; position: relative;">
          <button class="notification-delete-btn" data-notification-id="${notifDoc.id}" style="position: absolute; top: 0.5rem; right: 0.5rem; background: none; border: none; color: #999; cursor: pointer; font-size: 1.1rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: all 0.2s; line-height: 1; z-index: 10;" title="Delete notification">
            <i class="fas fa-times"></i>
          </button>
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem; padding-right: 1.5rem;">
            <div style="flex: 1;">
              <div style="font-size: 0.95rem; margin-bottom: 0.25rem; color: #333;">
                ${changeText}
              </div>
              <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem; color: #000;">
                "${notif.taskText}"
              </div>
              <div style="color: #666; font-size: 0.85rem;">
                ${podTitle} • ${timeAgo}
              </div>
            </div>
            ${isUnread ? '<div style="width: 8px; height: 8px; background: #2196F3; border-radius: 50%; margin-left: 0.5rem; margin-top: 0.25rem;"></div>' : ''}
          </div>
          ${notif.changes?.fields ? `
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(33, 150, 243, 0.05); border-radius: 4px; font-size: 0.85rem;">
              <strong>Changes:</strong>
              ${notif.changes.fields.map(f => `
                <div style="margin-top: 0.25rem; color: #555;">
                  <span style="color: #2196F3;">${f.field}:</span> 
                  ${f.old !== 'Updated' ? `<span style="text-decoration: line-through; opacity: 0.6;">${f.old}</span> → ` : ''}
                  <span style="font-weight: 500;">${f.new}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #eee; font-size: 0.85rem; color: #2196F3; text-align: center;">
            <i class="fas fa-arrow-right" style="margin-right: 0.5rem;"></i>Click to view task
          </div>
        </div>
      `;
    });
    
    content.innerHTML = html;
    
    // Add click handlers for delete buttons
    content.querySelectorAll('.notification-delete-btn').forEach(deleteBtn => {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering the notification click
        
        const notifId = deleteBtn.dataset.notificationId;
        if (!notifId) return;
        
        // Add fade-out animation
        const notifItem = deleteBtn.closest('.notification-item');
        if (notifItem) {
          notifItem.style.opacity = '0';
          notifItem.style.transform = 'translateX(20px)';
          notifItem.style.transition = 'all 0.3s ease';
          
          // Wait for animation then delete
          setTimeout(async () => {
            try {
              const notifRef = doc(db, 'notifications', notifId);
              await deleteDoc(notifRef);
              console.log('[Notifications] Deleted notification:', notifId);
              
              // Remove from DOM
              notifItem.remove();
              
              // Check if there are any notifications left
              const remainingItems = content.querySelectorAll('.notification-item');
              if (remainingItems.length === 0) {
                content.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">No notifications yet.</div>';
              }
            } catch (error) {
              console.error('[Notifications] Error deleting notification:', error);
              // Restore opacity if delete failed
              notifItem.style.opacity = '1';
              notifItem.style.transform = 'translateX(0)';
            }
          }, 300);
        }
      });
    });
    
    // Add click handlers to navigate to task and mark as read
    content.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        // Don't navigate if clicking the delete button
        if (e.target.closest('.notification-delete-btn')) {
          return;
        }
        
        const notifId = item.dataset.notificationId;
        const podId = item.dataset.podId;
        const subprojectId = item.dataset.subprojectId;
        const taskId = item.dataset.taskId;
        
        // Mark as read immediately - provides visual feedback
        if (notifId) {
          try {
            const notifRef = doc(db, 'notifications', notifId);
            await updateDoc(notifRef, { read: true });
            console.log('[Notifications] Marked notification as read:', notifId);
            
            // Update the UI immediately to show it's read
            item.style.backgroundColor = '#f9f9f9';
            item.style.borderLeftColor = '#ddd';
            const unreadDot = item.querySelector('div[style*="width: 8px"]');
            if (unreadDot) unreadDot.remove();
          } catch (error) {
            console.error('[Notifications] Error marking as read:', error);
          }
        }
        
        // Close the notification modal
        if (modal) modal.style.display = 'none';
        
        // Navigate to the task and highlight it
        if (podId && subprojectId) {
          console.log('[Notifications] Navigating to task and will highlight:', { podId, subprojectId, taskId });
          navigateToTask(podId, subprojectId, taskId);
        }
      });
    });
    
  } catch (error) {
    console.error('[Notifications] Error loading notifications:', error);
    
    // Check if it's an index error
    if (error.message && error.message.includes('index')) {
      // Extract the index creation URL from the error
      const indexUrlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
      const indexUrl = indexUrlMatch ? indexUrlMatch[0] : null;
      
      content.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔧</div>
          <h3 style="color: #2196F3; margin-bottom: 1rem;">One-Time Setup Required</h3>
          <p style="color: #666; margin-bottom: 1.5rem; line-height: 1.6;">
            The notification system needs a Firestore index to work.<br/>
            This is a <strong>one-time setup</strong> that takes about 2 minutes.
          </p>
          
          <div style="background: #f0f8ff; border: 2px solid #2196F3; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: left;">
            <h4 style="color: #2196F3; margin-bottom: 0.75rem;">📋 Steps to Fix:</h4>
            <ol style="color: #333; line-height: 1.8; margin-left: 1.5rem;">
              <li>Click the button below to open Firebase Console</li>
              <li>Click <strong>"Create Index"</strong> button</li>
              <li>Wait 1-2 minutes for it to build</li>
              <li>Come back and refresh this page</li>
            </ol>
          </div>
          
          ${indexUrl ? `
            <a href="${indexUrl}" target="_blank" style="display: inline-block; background: #2196F3; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 1rem; transition: all 0.2s; box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);" onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">
              🚀 Create Index in Firebase
            </a>
            <br/>
          ` : ''}
          
          <p style="color: #999; font-size: 0.85rem; margin-top: 1rem;">
            Need help? Check the NOTIFICATIONS_GUIDE.md file
          </p>
        </div>
      `;
    } else {
      // Generic error
      content.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ff6b6b;">
          <p style="margin-bottom: 0.5rem;">Error loading notifications.</p>
          <p style="font-size: 0.85rem; color: #999;">${error.message || 'Unknown error'}</p>
        </div>
      `;
    }
  }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
  const currentUserEmail = localStorage.getItem('userEmail') || '';
  // Always use email as userId for consistency
  const currentUserId = currentUserEmail || localStorage.getItem('userId');
  
  try {
    const notificationsCol = collection(db, 'notifications');
    const q = query(
      notificationsCol,
      where('userId', '==', currentUserId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    
    const updatePromises = snapshot.docs.map(notifDoc => {
      const notifRef = doc(db, 'notifications', notifDoc.id);
      return updateDoc(notifRef, { read: true });
    });
    
    await Promise.all(updatePromises);
    
    // Refresh the modal
    await openNotificationsModal();
    
  } catch (error) {
    console.error('[Notifications] Error marking all as read:', error);
  }
}

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' year' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' month' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' day' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hour' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minute' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  
  return 'Just now';
}

// Play notification sound
function playNotificationSound() {
  // Check if sound is muted
  const isMuted = localStorage.getItem('soundsMuted') === 'true';
  if (isMuted) {
    console.log('[Notifications] Notification sound is muted');
    return;
  }
  
  try {
    const audio = new Audio('notification.mp3');
    audio.volume = 0.3; // Quieter for notifications
    audio.play().catch(e => {
      console.log('[Notifications] Could not play sound:', e);
    });
  } catch (e) {
    console.log('[Notifications] Error creating audio:', e);
  }
}

// Show browser notification
function showBrowserNotification() {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.log('[Notifications] Browser does not support notifications');
    return;
  }
  
  // Request permission if not already granted
  if (Notification.permission === 'granted') {
    // Show notification
    new Notification('CoreTrex - New Task Update', {
      body: 'You have a new task notification',
      icon: 'CORETREX_LOGO.png',
      badge: 'CORETREX_LOGO.png',
      tag: 'coretrex-notification',
      requireInteraction: false
    });
  } else if (Notification.permission !== 'denied') {
    // Request permission
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('CoreTrex - New Task Update', {
          body: 'You have a new task notification',
          icon: 'CORETREX_LOGO.png',
          badge: 'CORETREX_LOGO.png',
          tag: 'coretrex-notification',
          requireInteraction: false
        });
      }
    });
  }
}

// Navigate to a specific task
function navigateToTask(podId, subprojectId, taskId) {
  // Check if we're on the projects page
  const lastSegment = window.location.pathname.split('/').filter(Boolean).pop() || '';
  const currentSlug = (lastSegment || 'index').replace(/\.html$/i, '');
  
  if (currentSlug !== 'projects') {
    // Store navigation intent and redirect to projects page
    sessionStorage.setItem('navigateToTask', JSON.stringify({ podId, subprojectId, taskId }));
    window.location.href = 'projects';
    return;
  }
  
  // We're already on projects page - navigate to the task
  console.log('[Notifications] Showing task in UI:', { podId, subprojectId, taskId });
  
  // 1. Show only the target pod
  showOnlyPod(podId);
  
  // 2. Update the top links to highlight the correct pod
  const linksBar = document.getElementById('projectsTopLinks');
  if (linksBar) {
    linksBar.querySelectorAll('a').forEach(link => {
      if (link.dataset.podId === podId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
  
  // 3. Find and expand the subproject
  const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subprojectId}"]`);
  if (subprojectCard) {
    const taskContent = subprojectCard.querySelector('.task-list');
    const expandControl = subprojectCard.querySelector('.expand-control');
    
    // Expand if not already expanded
    if (taskContent && taskContent.classList.contains('hidden')) {
      expandControl?.click();
    }
    
    // 4. Wait a moment for expansion, then scroll to and highlight the task
    setTimeout(() => {
      // Scroll subproject into view first
      subprojectCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Find the specific task row by taskId
      if (taskId) {
        // Try to find the task in both incomplete and completed lists
        const taskLists = subprojectCard.querySelectorAll('ul');
        let taskRow = null;
        
        taskLists.forEach(list => {
          if (taskRow) return; // Already found
          const rows = list.querySelectorAll('li');
          rows.forEach(row => {
            if (row.dataset.taskId === taskId) {
              taskRow = row;
            }
          });
        });
        
        // If we found the task, scroll to it and highlight it
        if (taskRow) {
          setTimeout(() => {
            // Scroll task into view
            taskRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add prominent highlight with animation
            taskRow.style.backgroundColor = '#fff3cd';
            taskRow.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.5)';
            taskRow.style.transition = 'all 0.3s ease';
            
            // Pulse effect
            let pulseCount = 0;
            const pulseInterval = setInterval(() => {
              pulseCount++;
              if (pulseCount % 2 === 0) {
                taskRow.style.backgroundColor = '#fff3cd';
                taskRow.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.5)';
              } else {
                taskRow.style.backgroundColor = '#ffeb3b';
                taskRow.style.boxShadow = '0 0 0 5px rgba(255, 193, 7, 0.7)';
              }
              
              if (pulseCount >= 6) {
                clearInterval(pulseInterval);
                // Fade out the highlight
                setTimeout(() => {
                  taskRow.style.backgroundColor = '';
                  taskRow.style.boxShadow = '';
                }, 500);
              }
            }, 300);
            
            console.log('[Notifications] Task highlighted:', taskId);
          }, 400);
        } else {
          console.warn('[Notifications] Task row not found in DOM:', taskId);
          // Still highlight the subproject card if task not found
          subprojectCard.style.boxShadow = '0 0 0 3px rgba(33, 150, 243, 0.3)';
          subprojectCard.style.transition = 'box-shadow 0.3s ease';
          setTimeout(() => {
            subprojectCard.style.boxShadow = '';
          }, 2000);
        }
      }
    }, 300);
  } else {
    console.warn('[Notifications] Subproject not found:', subprojectId);
  }
  
  // Update the page header
  const pod = podInfo.find(p => p.id === podId);
  if (pod) {
    setProjectsHeader(pod.title, pod.icon);
  }
}

// Check for pending navigation on page load
function checkPendingNavigation() {
  const pendingNav = sessionStorage.getItem('navigateToTask');
  if (pendingNav) {
    sessionStorage.removeItem('navigateToTask');
    try {
      const { podId, subprojectId, taskId } = JSON.parse(pendingNav);
      // Wait for page to fully load before navigating
      setTimeout(() => {
        navigateToTask(podId, subprojectId, taskId);
      }, 1000);
    } catch (e) {
      console.error('[Notifications] Error parsing pending navigation:', e);
    }
  }
}

// Delete all notifications for current user
async function deleteAllNotifications() {
  const currentUserEmail = localStorage.getItem('userEmail') || '';
  const currentUserId = currentUserEmail || localStorage.getItem('userId');
  
  if (!confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
    return;
  }
  
  try {
    const notificationsCol = collection(db, 'notifications');
    const q = query(
      notificationsCol,
      where('userId', '==', currentUserId)
    );
    
    const snapshot = await getDocs(q);
    
    const deletePromises = snapshot.docs.map(notifDoc => {
      const notifRef = doc(db, 'notifications', notifDoc.id);
      return deleteDoc(notifRef);
    });
    
    await Promise.all(deletePromises);
    
    console.log(`[Notifications] Deleted all ${deletePromises.length} notifications`);
    
    // Refresh the modal to show empty state
    await openNotificationsModal();
    
  } catch (error) {
    console.error('[Notifications] Error deleting all notifications:', error);
    alert('Error deleting notifications. Please try again.');
  }
}

// Initialize notification modal event listeners
function initNotificationsModal() {
  const closeBtn = document.getElementById('closeNotificationsModal');
  const modal = document.getElementById('notificationsModal');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const deleteAllBtn = document.getElementById('deleteAllNotificationsBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }
  
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
  }
  
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', deleteAllNotifications);
  }
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
  
  // Set up click handler for notification bell (will be in navigation)
  // We need to wait for the navigation to be rendered
  setTimeout(() => {
    const bell = document.getElementById('notificationBell');
    if (bell) {
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Check if we're on the projects page
        const lastSegment = window.location.pathname.split('/').filter(Boolean).pop() || '';
        const currentSlug = (lastSegment || 'index').replace(/\.html$/i, '');
        if (currentSlug !== 'projects') {
          // Redirect to projects page to view notifications
          window.location.href = 'projects';
        } else {
          // Open modal if we're already on projects page
          openNotificationsModal();
        }
      });
    }
  }, 500);
}
