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
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let app, db;
let cachedUsers = null; // [{id, name, email, photoURL}]
// Track tasks that were just marked completed to prevent flicker reappearance
const pendingCompletedTaskIds = new Set();
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
  { id: 'pod1', title: 'Pod 1' },
  { id: 'pod2', title: 'Pod 2' },
  { id: 'pod3', title: 'Pod 3' },
  { id: 'sales', title: 'Sales' }
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
  const kpiDueTodayEl = document.getElementById('kpiDueToday');
  const kpiOverdueEl = document.getElementById('kpiOverdue');
  const kpiTotalEl = document.getElementById('kpiTotal');
  
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
  const safe = (v) => (v == null ? '' : v);
  const statusLower = (taskData.status || 'Open').toLowerCase();
  const isDone = statusLower === 'done';
  // Tasks with "Done" status should be treated as completed
  const isCompleted = taskData.completed || isDone;
  const hasDesc = !!(taskData.longDescription && String(taskData.longDescription).trim().length > 0);
  const hasAtch = Array.isArray(taskData.attachments) && taskData.attachments.length > 0;
  // (deprecated) detailsIcons removed in favor of a single comment icon
  li.innerHTML = `
    <div class="task-checkbox-cell"><input type="checkbox" class="task-toggle" ${isCompleted ? 'checked' : ''}></div>
    <div class="task-name-cell">
      <span class="task-text">${safe(taskData.text)}</span>
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
        <option value="Pending" ${statusLower==='pending' ? 'selected' : ''}>Pending</option>
        <option value="Blocked" ${statusLower==='blocked' ? 'selected' : ''}>Blocked</option>
        <option value="Done" ${statusLower==='done' ? 'selected' : ''}>Done</option>
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
    }
    // Persist then reload to ensure proper placement and dedupe
    if (podId && subId && taskId) {
      const podRef = doc(db, 'pods', podId);
      const subRef = doc(podRef, 'subprojects', subId);
      const taskRef = doc(subRef, 'tasks', taskId);
      try {
        await updateDoc(taskRef, { completed: checkbox.checked });
      } catch (_) {}
      // Do NOT reload lists here; we already moved the item. A later full reload (e.g., expanding again) will reconcile.
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
  // style status select based on value
  function applyStatusStyle() {
    const val = (statusSelect.value || 'Open').toLowerCase();
    statusSelect.classList.remove('status-open', 'status-pending', 'status-blocked', 'status-done');
    if (val === 'open') statusSelect.classList.add('status-open');
    else if (val === 'pending') statusSelect.classList.add('status-pending');
    else if (val === 'blocked') statusSelect.classList.add('status-blocked');
    else if (val === 'done') statusSelect.classList.add('status-done');
  }
  applyStatusStyle();
  statusSelect.addEventListener('change', async () => {
    applyStatusStyle();
    const value = statusSelect.value;
    
    // If status is set to Done, immediately hide and move to completed
    if (value === 'Done') {
      // Mark with CSS class for hiding
      li.classList.add('task-done-status');
      
      // Update database first
      if (podId && subId && taskId) {
        const podRef = doc(db, 'pods', podId);
        const subRef = doc(podRef, 'subprojects', subId);
        const taskRef = doc(subRef, 'tasks', taskId);
        await updateDoc(taskRef, { completed: true, status: 'Done' });
      }
      
      checkbox.checked = true;
      // Ensure visual strike-through immediately
      textSpan.classList.add('task-completed');
      const parentListContainer = li.closest('.task-list');
      const incompleteUl = parentListContainer?.querySelector('ul');
      const completedUl = parentListContainer?.querySelector('.completed-list');
      
      // FORCE REMOVE from incomplete list
      if (incompleteUl && incompleteUl.contains(li)) {
        incompleteUl.removeChild(li);
      }
      
      // Add to completed list
      if (completedUl) {
        li.classList.remove('task-done-status'); // Remove hide class in completed list
        completedUl.appendChild(li);
        completedUl.classList.add('hidden');
      }
      
      // Update toggle
      if (incompleteUl) {
        updateCompletedToggleText(incompleteUl);
      }
      // Update task count
      const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
      if (subprojectCard) updateTaskCount(subprojectCard);
      // Update KPIs
      updateKPIs();
      return; // Exit early, don't save status again
    } else {
      // Remove done-status class if changing away from Done
      li.classList.remove('task-done-status');
    }
    
    // For non-Done status changes, save normally
    quickSave('status', value);
    if (value !== 'Done' && checkbox.checked) {
      await handleCompletionToggle(false);
    }
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
        updateDoc(taskRef, { text: next });
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
      updateDoc(taskRef, { [field]: value });
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
    a.textContent = pod.title;
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
      setProjectsHeader(pod.title);
    });
    linksBar.appendChild(a);
  });

  // Initial view: first pod and first project
  const firstPodId = podInfo[0].id;
  showOnlyPod(firstPodId);
  // Set header to first pod name by default
  const firstPodTitle = podInfo[0].title;
  setProjectsHeader(firstPodTitle);
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

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    await initializeFirebaseApp();
    await ensureDefaultPods();
    renderPods();
    initFilters();
    initTaskDrawer();
    initGlobalCompletedSection();
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
  containerEl.innerHTML = '';
  const podRef = doc(db, 'pods', podId);
  const subCol = collection(podRef, 'subprojects');
  const subs = await getDocs(subCol);
  const projects = [];
  subs.forEach(s => {
    const data = s.data();
    const name = data.name || 'Untitled';
    const subEl = createSubProjectElement(name, podId, s.id);
    containerEl.appendChild(subEl);
    registerSubproject(podId, name, subEl, s.id);
    projects.push({ id: s.id, name, el: subEl, order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER, createdAt: data.createdAt || 0 });
  });
  // Sort by saved order first, then createdAt
  projects.sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  // Re-append in sorted order
  projects.forEach(p => containerEl.appendChild(p.el));
  // Load tasks for each subproject
  for (const p of projects) {
    await loadTasksInto(podId, p.id, p.el.querySelector('ul'));
  }
}

async function loadTasksInto(podId, subId, listEl) {
  listEl.innerHTML = '';
  const completedUl = listEl.parentElement?.querySelector('.completed-list');
  if (completedUl) completedUl.innerHTML = '';
  const podRef = doc(db, 'pods', podId);
  const subRef = doc(podRef, 'subprojects', subId);
  const tasksCol = collection(subRef, 'tasks');
  let tasks;
  try {
    tasks = await getDocsFromServer(tasksCol);
  } catch (_) {
    tasks = await getDocs(tasksCol);
  }
  const items = [];
  tasks.forEach(t => {
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
      attachments: data.attachments || []
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
  items.forEach(d => {
    const li = createTaskItem({
      text: d.text,
      completed: d.completed,
      assignee: d.assignee,
      assignees: d.assignees,
      dueDate: d.dueDate,
      status: d.status,
      longDescription: d.longDescription,
      attachments: d.attachments
    }, podId, subId, d.id);
    // Tasks with status "Done" or completed (checkbox checked) go to completed list
    const isDone = (d.status || 'Open').toLowerCase() === 'done';
    if (d.completed || isDone) {
      if (completedUl) {
        // Remove hide class when adding to completed list
        li.classList.remove('task-done-status');
        completedUl.appendChild(li);
        console.log('[Projects] Appended completed task to completed list', { podId, subId, taskId: d.id, isDone });
      }
    } else {
      // Incomplete tasks go to the main active list
      // Skip rendering items we just marked complete but server hasn't caught up yet
      if (!pendingCompletedTaskIds.has(d.id)) {
        listEl.appendChild(li);
      }
    }
    
    // Add CSS class to hide "Done" tasks if they somehow end up in incomplete list
    if (isDone) {
      li.classList.add('task-done-status');
    }
  });
  // Defensive sweep: ensure completed rows reside in completed list
  enforceCompletedHidden(listEl.parentElement, /*doNotHide*/ true);
  // Ensure partitioning is correct on load - run multiple times to catch edge cases
  partitionTasks(listEl.parentElement);
  // Run again after a tiny delay to ensure all "Done" tasks are caught
  setTimeout(() => {
    partitionTasks(listEl.parentElement);
    enforceCompletedHidden(listEl.parentElement, /*doNotHide*/ true);
  }, 50);
  
  // Ensure completed list is hidden by default after loading
  const comp = listEl.parentElement?.querySelector('.completed-list');
  if (comp) {
    // Always hide completed list by default on load (user can toggle to show)
    comp.classList.add('hidden');
    console.log('[Projects] Completed list visibility after load', {
      podId,
      subId,
      hidden: comp.classList.contains('hidden'),
      count: comp.querySelectorAll('li').length
    });
  }
  updateCompletedToggleText(listEl);
  
  // Update task count for this subproject
  const subprojectCard = document.querySelector(`.subproject-card[data-subproject-id="${subId}"]`);
  if (subprojectCard) {
    updateTaskCount(subprojectCard);
  }
  
  // Update KPIs
  updateKPIs();
}

function refreshTopLinksSelection(podId, projectName) {
  // If current visible pod matches, just update header; keep all subprojects visible
  const activeLink = document.querySelector('.projects-top-links a.active');
  if (activeLink && activeLink.dataset.podId === podId) {
    setProjectsHeader(projectName || activeLink.textContent || 'Projects');
  }
}

function setProjectsHeader(title) {
  const h1 = document.querySelector('.page-content h1');
  if (h1) h1.textContent = title || 'Projects';
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
  
  // CRITICAL: Remove ALL "Done" tasks and completed tasks from incomplete list
  const tasksToMove = Array.from(incompleteUl.children).filter(li => {
    const status = li.querySelector('.status-select')?.value;
    const cb = li.querySelector('.task-toggle');
    const isDone = status === 'Done';
    // Add hide class immediately if it's Done
    if (isDone) {
      li.classList.add('task-done-status');
    }
    return isDone || (cb && cb.checked);
  });
  
  tasksToMove.forEach(li => {
    incompleteUl.removeChild(li);
    if (!completedUl.contains(li)) {
      li.classList.remove('task-done-status'); // Remove hide class when in completed list
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
  
  // CRITICAL: Move ALL "Done" tasks and completed tasks from incompleteUl to completedUl
  const tasksToMove = Array.from(incompleteUl.children).filter(li => {
    const status = li.querySelector('.status-select')?.value;
    const cb = li.querySelector('.task-toggle');
    const isDone = status === 'Done';
    // Add hide class immediately if it's Done
    if (isDone) {
      li.classList.add('task-done-status');
    }
    return isDone || (cb && cb.checked);
  });
  
  tasksToMove.forEach(li => {
    incompleteUl.removeChild(li);
    if (!completedUl.contains(li)) {
      li.classList.remove('task-done-status'); // Remove hide class when in completed list
      completedUl.appendChild(li);
    }
  });
  
  // Move non-completed, non-Done tasks back to incompleteUl
  Array.from(completedUl.children).forEach(li => {
    const status = li.querySelector('.status-select')?.value;
    const cb = li.querySelector('.task-toggle');
    // Never move "Done" tasks back to incomplete
    if (status === 'Done') {
      return;
    }
    // Only move back if not completed
    if (!(cb && cb.checked)) {
      completedUl.removeChild(li);
      incompleteUl.appendChild(li);
    }
  });
  
  updateCompletedToggleText(incompleteUl);
}

// (Removed) global completed visibility controls; per-project toggle only

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
    await updateDoc(taskRef, { longDescription, attachments });
    // refresh the task list to update detail icons
    const container = document.querySelector(`.subproject-card[data-subproject-id="${subId}"] ul`);
    if (container) await loadTasksInto(podId, subId, container);
    close();
  });
}

async function openTaskDrawer({ podId, subId, taskId, title, longDescription = '', attachments = [] }) {
  const drawer = document.getElementById('taskDrawer');
  if (!drawer) return;
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
