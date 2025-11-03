// CoreTrex Projects - Firestore-backed project, subproject, and task management
import { initializeFirebase } from './firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
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

let app, db;
let cachedUsers = null; // [{id, name, email, photoURL}]
// Track tasks that were just marked completed to prevent flicker reappearance
const pendingCompletedTaskIds = new Set();
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
  { id: 'sales', title: 'Sales', icon: 'fa-chart-line' }
];

// In-memory registry of subprojects keyed by pod id
const podToProjects = new Map();

// Helper function to update task count for a subproject
function updateTaskCount(subprojectCard) {
  const incompleteUl = subprojectCard.querySelector('ul:not(.completed-list)');
  const taskCount = incompleteUl ? incompleteUl.querySelectorAll('li').length : 0;
  const countSpan = subprojectCard.querySelector('.task-count');
  if (countSpan) {
    countSpan.textContent = taskCount;
    // Hide count if there are no tasks
    countSpan.style.display = taskCount > 0 ? 'inline-flex' : 'none';
    
    // Check if any tasks are overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    let hasOverdue = false;
    if (incompleteUl) {
      const tasks = incompleteUl.querySelectorAll('li');
      tasks.forEach(taskLi => {
        const dateInput = taskLi.querySelector('.date-input');
        if (dateInput && dateInput.value && dateInput.value < todayStr) {
          hasOverdue = true;
        }
      });
    }
    
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
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
  
  // Get incomplete tasks only from visible pods
  visiblePodsList.forEach(pod => {
    const incompleteTasks = pod.querySelectorAll('.task-list > ul:not(.completed-list) > li');
    
    incompleteTasks.forEach(taskLi => {
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
    <div>Assignee</div>
    <div>Due date</div>
    <div>Status</div>
  `;
  taskContent.appendChild(headerRow);
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
    const text = 'New Task';
    const subId = wrapper.dataset.subprojectId;
    if (!subId) return;
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const tasksCol = collection(subRef, 'tasks');
    await addDoc(tasksCol, { text: text, completed: false, createdAt: Date.now(), assignee: '', dueDate: '', status: 'Open' });
    // Reload tasks to maintain sorted order
    await loadTasksInto(podId, subId, taskUl);
    updateCompletedToggleText(taskUl);
    // ensure open to show the new task
    if (taskContent.classList.contains('hidden')) header.querySelector('.expand-control').click();
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
  const isRecurring = taskData.recurring && taskData.recurring.isRecurring;
  li.innerHTML = `
    <div class="task-checkbox-cell"><input type="checkbox" class="task-toggle" ${isCompleted ? 'checked' : ''}></div>
    <div class="task-name-cell">
      <span class="task-text">${safe(taskData.text)}</span>
      ${isRecurring ? `<span class=\"recurring-badge\" title=\"This task repeats ${taskData.recurring.frequency}\"><i class=\"fas fa-rotate\"></i></span>` : ''}
      ${hasDesc || hasAtch ? `<span class=\"task-comment-indicator\" title=\"This task has additional details\"><i class=\"fas fa-comment-dots\"></i></span>` : ''}
    </div>
    <div class="task-assignee">
      <div class="assignee-multiselect" tabindex="0">
        <div class="assignee-display">${Array.isArray(taskData.assignees) && taskData.assignees.length ? safe(taskData.assignees.map(a=>a.name||a.email).join(', ')) : (safe(taskData.assignee) || 'Unassigned')}</div>
        <div class="assignee-menu hidden"></div>
      </div>
    </div>
    <div class="task-date">
      <input class="task-input date-input" type="date" value="${safe(taskData.dueDate)}" />
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
    <div class="task-actions">
      <button class="action-btn delete-btn" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
    </div>
  `;
  const checkbox = li.querySelector('.task-toggle');
  const textSpan = li.querySelector('.task-text');
  const assigneeMulti = li.querySelector('.assignee-multiselect');
  const dateInput = li.querySelector('.date-input');
  const statusSelect = li.querySelector('.status-select');
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
      if (latestTaskData.recurring && latestTaskData.recurring.isRecurring) {
        // Calculate from TODAY's date, not the task's original due date
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const nextDueDate = calculateNextRecurringDate(todayStr, latestTaskData.recurring);
        if (nextDueDate && podId && subId) {
          // Create a new task with the next due date
          const podRef = doc(db, 'pods', podId);
          const subRef = doc(podRef, 'subprojects', subId);
          const tasksCol = collection(subRef, 'tasks');
          await addDoc(tasksCol, {
            text: latestTaskData.text,
            completed: false,
            assignee: latestTaskData.assignee || '',
            assignees: latestTaskData.assignees || [],
            dueDate: nextDueDate,
            status: latestTaskData.status || 'Open',
            longDescription: latestTaskData.longDescription || '',
            attachments: latestTaskData.attachments || [],
            recurring: latestTaskData.recurring,
            createdAt: Date.now()
          });
          // Reload tasks to show the new recurring instance
          await loadTasksInto(podId, subId, incompleteUl);
        }
      }
      
      // Move to completed list immediately and rely on toggle visibility
      if (completedUl) {
        li.style.display = '';
        // Remove hide class when moving to completed list
        li.classList.remove('task-done-status');
        completedUl.appendChild(li);
        // Ensure completed list stays hidden (user must toggle to view)
        completedUl.classList.add('hidden');
        console.log('[Projects] Moved task to completed list', { taskId });
        // Keep partitioning strict
        partitionTasks(parentListContainer);
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
      // move back to incomplete list
      if (incompleteUl) incompleteUl.appendChild(li);
      console.log('[Projects] Moved task back to incomplete list', { taskId });
      // Keep partitioning strict
      partitionTasks(parentListContainer);
      updateCompletedToggleText(incompleteUl);
      // Update task count
      const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
      if (subprojectCard) updateTaskCount(subprojectCard);
      // Update KPIs
      updateKPIs();
      
      // Persist unchecked status
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
        } catch (_) {}
      }
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
  function openMenu() { assigneeMulti.querySelector('.assignee-menu').classList.remove('hidden'); }
  function closeMenu() { assigneeMulti.querySelector('.assignee-menu').classList.add('hidden'); }
  assigneeMulti.addEventListener('click', (e) => {
    const menu = assigneeMulti.querySelector('.assignee-menu');
    if (e.target.tagName === 'INPUT') return; // checkbox click
    menu.classList.toggle('hidden');
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
  dateInput.addEventListener('change', () => {
    quickSave('dueDate', dateInput.value);
    updateKPIs();
  });
  
  // Add recurring icon button next to date input
  const dateCell = dateInput.parentElement;
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
      });
    }
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
  return li;
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
  
  if (!toggleBtn || !globalSection) return;
  
  // Update the toggle button and section visibility
  function updateGlobalToggle() {
    const allCompletedLists = document.querySelectorAll('.completed-list');
    let totalCount = 0;
    allCompletedLists.forEach(list => {
      totalCount += list.querySelectorAll('li').length;
    });
    
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
  
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const allCompletedLists = document.querySelectorAll('.completed-list');
    const allHidden = Array.from(allCompletedLists).every(list => list.classList.contains('hidden'));
    
    // Toggle all completed lists
    allCompletedLists.forEach(list => {
      if (allHidden) {
        // Show the completed list
        list.classList.remove('hidden');
        // Ensure all tasks in the completed list are visible (remove hide class)
        list.querySelectorAll('li.task-done-status').forEach(li => {
          li.classList.remove('task-done-status');
        });
      } else {
        // Hide the completed list
        list.classList.add('hidden');
      }
    });
    
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
  const isMuted = localStorage.getItem('completionSoundMuted') === 'true';
  
  // Update button appearance based on mute state
  function updateSoundIcon() {
    const icon = soundToggle.querySelector('i');
    const isMuted = localStorage.getItem('completionSoundMuted') === 'true';
    
    if (isMuted) {
      icon.className = 'fas fa-volume-mute';
      soundToggle.style.color = '#999';
      soundToggle.style.borderColor = '#ccc';
      soundToggle.title = 'Sound muted - Click to unmute';
    } else {
      icon.className = 'fas fa-volume-up';
      soundToggle.style.color = '#4CAF50';
      soundToggle.style.borderColor = '#4CAF50';
      soundToggle.title = 'Sound on - Click to mute';
    }
  }
  
  // Set initial state
  updateSoundIcon();
  
  // Toggle mute on click
  soundToggle.addEventListener('click', (e) => {
    const currentlyMuted = localStorage.getItem('completionSoundMuted') === 'true';
    const newMutedState = !currentlyMuted;
    
    localStorage.setItem('completionSoundMuted', String(newMutedState));
    updateSoundIcon();
    
    // Show a subtle feedback animation
    soundToggle.style.transform = 'scale(0.9)';
    setTimeout(() => {
      soundToggle.style.transform = 'scale(1)';
    }, 100);
    
    console.log('[Projects] Completion sound', newMutedState ? 'muted' : 'unmuted');
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

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    await initializeFirebaseApp();
    await ensureDefaultPods();
    renderPods();
    initFilters();
    initTaskDrawer();
    initGlobalCompletedSection();
    initRecurringModal();
    initMyTasksModal();
    initNotificationsModal();
    initNotificationListener();
    initSoundToggle();
    // Check if we need to navigate to a task from a notification
    checkPendingNavigation();
  })();
});

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
  
  // Use onSnapshot for real-time updates
  const unsubscribe = onSnapshot(tasksCol, (snapshot) => {
    console.log('[Projects] Tasks snapshot received for subproject:', subId, 'count:', snapshot.size);
    
    // Track existing task elements by task ID
    const existingTasks = new Map();
    if (listEl) {
      listEl.querySelectorAll('li').forEach(li => {
        // We need to find the task ID somehow - we'll store it as data attribute
        const taskId = li.dataset?.taskId;
        if (taskId) existingTasks.set(taskId, li);
      });
    }
    if (completedUl) {
      completedUl.querySelectorAll('li').forEach(li => {
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
        status: data.status || 'Open',
        longDescription: data.longDescription || '',
        attachments: data.attachments || [],
        recurring: data.recurring || null
      });
    });
    
    // Sort by due date ascending (empty due dates at bottom)
    function parseDate(s) {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    items.sort((a, b) => {
      const da = parseDate(a.dueDate);
      const db = parseDate(b.dueDate);
      if (da && db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return 0;
    });
    
    // Clear lists
    if (listEl) listEl.innerHTML = '';
    if (completedUl) completedUl.innerHTML = '';
    
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
          status: d.status,
          longDescription: d.longDescription,
          attachments: d.attachments,
          recurring: d.recurring
        });
      }
      
      // Tasks that are completed go to completed list
      if (d.completed) {
        if (completedUl) {
          completedUl.appendChild(li);
        }
      } else {
        // Incomplete tasks go to the main active list
        // Skip rendering items we just marked complete but server hasn't caught up yet
        if (!pendingCompletedTaskIds.has(d.id)) {
          if (listEl) listEl.appendChild(li);
        }
      }
    });
    
    // Remove deleted tasks
    existingTasks.forEach((li) => {
      console.log('[Projects] Task deleted, removing from UI');
      li.remove();
    });
    
    // Defensive sweep: ensure completed rows reside in completed list
    if (listEl.parentElement) {
      enforceCompletedHidden(listEl.parentElement, /*doNotHide*/ true);
      partitionTasks(listEl.parentElement);
    }
    
    // Ensure completed list is hidden by default after loading
    if (completedUl) {
      // Keep hidden state if it was already hidden
      if (!completedUl.classList.contains('hidden')) {
        // Only set to hidden on first load
        const isFirstLoad = completedUl.dataset.initialized !== 'true';
        if (isFirstLoad) {
          completedUl.classList.add('hidden');
          completedUl.dataset.initialized = 'true';
        }
      }
    }
    
    updateCompletedToggleText(listEl);
    
    // Update task count for this subproject
    const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
    if (subprojectCard) {
      updateTaskCount(subprojectCard);
    }
    
    // Update KPIs
    updateKPIs();
  });
  
  // Store unsubscribe function
  taskListeners.set(listenerKey, unsubscribe);
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
  if (dateInput && dateInput.value !== taskData.dueDate) {
    dateInput.value = taskData.dueDate || '';
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
    if (icon) {
      h1.innerHTML = `<i class="fas ${icon}"></i> ${title || 'Projects'}`;
    } else {
      h1.textContent = title || 'Projects';
    }
  }
}

function updateCompletedToggleText(incompleteUl) {
  // Update the global completed toggle instead of per-project toggles
  if (window.updateGlobalCompletedToggle) {
    window.updateGlobalCompletedToggle();
  }
}

// Defensive rule: ensure completed tasks are not visible in the main list and
// the completed section stays hidden unless explicitly toggled open
function enforceCompletedHidden(containerEl, doNotHide = false) {
  const incompleteUl = containerEl.querySelector('ul');
  const completedUl = containerEl.querySelector('.completed-list');
  if (!incompleteUl || !completedUl) return;
  
  // CRITICAL: Remove ALL completed tasks from incomplete list
  const tasksToMove = Array.from(incompleteUl.children).filter(li => {
    const cb = li.querySelector('.task-toggle');
    return cb && cb.checked;
  });
  
  tasksToMove.forEach(li => {
    incompleteUl.removeChild(li);
    if (!completedUl.contains(li)) {
      completedUl.appendChild(li);
    }
  });
  
  // Optionally avoid forcing hidden state so user toggle works
  if (!doNotHide) {
    if (!completedUl.classList.contains('hidden')) completedUl.classList.add('hidden');
  }
  updateCompletedToggleText(incompleteUl);
}

// Always keep lists partitioned: completed items in completedUl, others in incompleteUl
function partitionTasks(containerEl) {
  const incompleteUl = containerEl.querySelector('ul');
  const completedUl = containerEl.querySelector('.completed-list');
  if (!incompleteUl || !completedUl) return;
  
  // CRITICAL: Move ALL completed tasks from incompleteUl to completedUl
  const tasksToMove = Array.from(incompleteUl.children).filter(li => {
    const cb = li.querySelector('.task-toggle');
    return cb && cb.checked;
  });
  
  tasksToMove.forEach(li => {
    incompleteUl.removeChild(li);
    if (!completedUl.contains(li)) {
      completedUl.appendChild(li);
    }
  });
  
  // Move non-completed tasks back to incompleteUl
  Array.from(completedUl.children).forEach(li => {
    const cb = li.querySelector('.task-toggle');
    // Only move back if not completed
    if (!(cb && cb.checked)) {
      completedUl.removeChild(li);
      incompleteUl.appendChild(li);
    }
  });
  
  updateCompletedToggleText(incompleteUl);
}

// (Removed) global completed visibility controls; per-project toggle only

// Play completion sound
function playCompletionSound() {
  // Check if sound is muted
  const isMuted = localStorage.getItem('completionSoundMuted') === 'true';
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
function initTaskDrawer() {
  const drawer = document.getElementById('taskDrawer');
  const closeBtn = document.getElementById('closeTaskDrawer');
  const cancelBtn = document.getElementById('cancelTaskDetailsBtn');
  const saveBtn = document.getElementById('saveTaskDetailsBtn');
  const addAttachmentBtn = document.getElementById('addAttachmentBtn');
  if (!drawer) return;
  function close() {
    drawer.classList.add('hidden');
    currentDrawerContext = null;
  }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (addAttachmentBtn) addAttachmentBtn.addEventListener('click', () => {
    const list = document.getElementById('attachmentsList');
    const li = document.createElement('li');
    li.innerHTML = `<input type="text" placeholder="Attachment URL" class="attachment-url"/><input type="text" placeholder="Label (optional)" class="attachment-label"/>`;
    list.appendChild(li);
  });
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    if (!currentDrawerContext) return;
    const { podId, subId, taskId } = currentDrawerContext;
    const longDescription = document.getElementById('drawerLongDescription').value;
    const list = document.getElementById('attachmentsList');
    const attachments = [];
    list.querySelectorAll('li').forEach(li => {
      const url = li.querySelector('.attachment-url')?.value?.trim();
      const label = li.querySelector('.attachment-label')?.value?.trim();
      if (url) attachments.push({ url, label: label || url });
    });
    const podRef = doc(db, 'pods', podId);
    const subRef = doc(podRef, 'subprojects', subId);
    const taskRef = doc(subRef, 'tasks', taskId);
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Unknown User';
    const currentUserEmail = localStorage.getItem('userEmail') || '';
    await updateDoc(taskRef, { 
      longDescription, 
      attachments,
      lastModifiedBy: currentUserName,
      lastModifiedByEmail: currentUserEmail,
      lastModifiedAt: Date.now()
    });
    // refresh the task list to update detail icons
    const container = document.querySelector(`.subproject-card[data-subproject-id="${subId}"] ul`);
    if (container) await loadTasksInto(podId, subId, container);
    close();
  });
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
    }
  } catch (_) {}
  const desc = document.getElementById('drawerLongDescription');
  if (desc) desc.value = longDescription || '';
  const list = document.getElementById('attachmentsList');
  list.innerHTML = '';
  (attachments || []).forEach(att => {
    const li = document.createElement('li');
    li.innerHTML = `<input type="text" value="${att.url || ''}" placeholder="Attachment URL" class="attachment-url"/><input type="text" value="${att.label || ''}" placeholder="Label (optional)" class="attachment-label"/>`;
    list.appendChild(li);
  });
  drawer.classList.remove('hidden');
}

// ============ MY TASKS FUNCTIONALITY ============

// Function to load tasks with optional user and project filters from visible tasks on the page
function loadMyTasks(filterUser = null, filterProject = null) {
  const myTasksList = [];
  
  // If no filter specified, use current user
  if (filterUser === null) {
    const userName = localStorage.getItem('userName') || '';
    filterUser = userName.split(' ')[0];
  }
  
  console.log('[My Tasks] Filtering by user:', filterUser || 'All Users', 'project:', filterProject || 'All Projects');
  
  // Get ALL pod cards (not just visible ones) to allow filtering across all projects
  const allPods = Array.from(document.querySelectorAll('.pod-card'));
  
  console.log('[My Tasks] Checking all pods:', allPods.length);
  
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
        const assigneeDisplay = taskLi.querySelector('.assignee-display');
        const taskText = taskLi.querySelector('.task-text')?.textContent || 'Untitled Task';
        const dateInput = taskLi.querySelector('.date-input');
        const statusSelect = taskLi.querySelector('.status-select');
        
        if (!assigneeDisplay) return;
        
        const assigneeText = assigneeDisplay.textContent;
        
        // Check if this task matches the user filter
        // If filterUser is empty string, show all tasks
        // Otherwise, check if assignee includes the filter name
        const userMatches = !filterUser || assigneeText.includes(filterUser);
        
        if (userMatches) {
          console.log('[My Tasks] Match found:', taskText, 'assignee:', assigneeText, 'pod:', podTitle);
          
          myTasksList.push({
            podTitle,
            subTitle,
            text: taskText,
            dueDate: dateInput?.value || '',
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
function renderTasksInModal(filterUser = null, filterProject = null) {
  const content = document.getElementById('myTasksContent');
  
  if (!content) {
    console.error('Content element not found');
    return;
  }
  
  try {
    console.log('[My Tasks] Loading tasks...');
    const myTasks = loadMyTasks(filterUser, filterProject);
    console.log('[My Tasks] Found tasks:', myTasks.length, myTasks);
    
    if (myTasks.length === 0) {
      let filterText = 'tasks';
      let projectName = '';
      if (filterProject) {
        const podData = podInfo.find(p => p.id === filterProject);
        projectName = podData ? podData.title : filterProject;
      }
      if (filterUser && filterProject) {
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
    
    const today = new Date().toISOString().split('T')[0];
    
    let html = '';
    
    myTasks.forEach(task => {
      const isOverdue = task.dueDate && task.dueDate < today;
      const borderColor = isOverdue ? '#ff6b6b' : '#2196F3';
      const statusColor = getStatusColor(task.status);
      
      html += `
        <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; border-left: 4px solid ${borderColor}; margin-bottom: 0.75rem;">
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
                ${task.dueDate || 'No date'}
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
        </div>
      `;
    });
    
    content.innerHTML = html;
    
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
async function openMyTasksModal() {
  const modal = document.getElementById('myTasksModal');
  const userFilter = document.getElementById('taskUserFilter');
  const projectFilter = document.getElementById('taskProjectFilter');
  
  if (!modal) {
    console.error('Modal element not found');
    return;
  }
  
  // Populate user filter dropdown
  await populateUserFilter();
  
  // Populate project filter dropdown
  populateProjectFilter();
  
  // Set user dropdown to current user by default
  if (userFilter) {
    const userName = localStorage.getItem('userName') || '';
    const userFirstName = userName.split(' ')[0];
    userFilter.value = userFirstName;
  }
  
  // Set project dropdown to "All Projects" by default
  if (projectFilter) {
    projectFilter.value = '';
  }
  
  // Show modal
  modal.style.display = 'block';
  
  // Render tasks with current filters
  renderTasksInModal(
    userFilter ? userFilter.value : null,
    projectFilter ? projectFilter.value : null
  );
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
      console.log('[My Tasks] User filter changed to:', userFilterValue || 'All Users');
      renderTasksInModal(userFilterValue || '', projectFilterValue || '');
    });
  }
  
  // Add event listener for project filter dropdown
  if (projectFilter) {
    projectFilter.addEventListener('change', (e) => {
      const userFilterValue = userFilter ? userFilter.value : '';
      const projectFilterValue = e.target.value;
      console.log('[My Tasks] Project filter changed to:', projectFilterValue || 'All Projects');
      renderTasksInModal(userFilterValue || '', projectFilterValue || '');
    });
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
  
  const unsubscribe = onSnapshot(taskRef, (snapshot) => {
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
    newlyAssigned.forEach(assignee => {
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
      } else {
        console.log('[Notifications] Skipping self-notification for assignment', {
          assigneeEmail: assignee.email,
          currentUserEmail,
          changedByEmail
        });
      }
    });
    
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
      
      newAssignees.forEach(assignee => {
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
        } else {
          console.log('[Notifications] Skipping notification for person who made the change:', changedByName);
        }
      });
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
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  if (currentPage !== 'projects.html') {
    // Store navigation intent and redirect to projects page
    sessionStorage.setItem('navigateToTask', JSON.stringify({ podId, subprojectId, taskId }));
    window.location.href = 'projects.html';
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
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage !== 'projects.html') {
          // Redirect to projects page to view notifications
          window.location.href = 'projects.html';
        } else {
          // Open modal if we're already on projects page
          openNotificationsModal();
        }
      });
    }
  }, 500);
}
