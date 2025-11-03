# Real-Time Synchronization Guide

## Overview

The CoreTrex Internal Dashboard now features **real-time synchronization** across all users. When one team member makes changes to tasks or projects, those changes appear **instantly** on everyone else's screens without requiring a page refresh.

## What's Synchronized in Real-Time?

### 1. **Tasks**
- ✅ New tasks appear instantly
- ✅ Task updates (name, assignee, due date, status, description) sync live
- ✅ Task deletions remove the task from everyone's view
- ✅ Task completion status updates immediately
- ✅ Task reassignments show up instantly for the new assignee

### 2. **Subprojects**
- ✅ New subprojects appear for all users
- ✅ Subproject renames update everywhere
- ✅ Subproject deletions sync across all users

### 3. **KPIs and Counters**
- ✅ Task counts update automatically
- ✅ "My Tasks" counter updates when you're assigned/unassigned
- ✅ "Due Today" and "Overdue" counters update in real-time
- ✅ Overdue indicators appear/disappear as dates change

## How It Works

### Technical Implementation

The system uses **Firestore's `onSnapshot` listeners** which provide real-time database synchronization:

```javascript
// Real-time task updates
onSnapshot(tasksCollection, (snapshot) => {
  // Automatically called whenever tasks change in the database
  // Updates are pushed from Firestore to all connected clients
});
```

### Key Features

1. **Efficient Updates**: Only changed data is transmitted, not entire page reloads
2. **Automatic Reconnection**: If connection is lost, it automatically reconnects when restored
3. **Optimistic UI**: Your own changes appear instantly, while others' changes sync shortly after
4. **Smart Rendering**: Updates existing elements rather than recreating everything

## Visual Indicators

### Live Connection Status
At the top of the Projects page, you'll see:
- 🟢 **"Live"** indicator - Shows the page is actively syncing

In the bottom-left corner:
- 🔊 **Sound Toggle** button (floating) - Click to mute/unmute task completion sounds

### Real-Time Indicators in Action
- Task counts update immediately when tasks are added/removed
- New tasks appear with a subtle animation
- Assignee changes reflect instantly
- Status changes update the colored badge immediately

## Use Cases

### 1. **Team Collaboration**
**Scenario**: Sarah assigns a task to John while he's viewing the projects page.
- ✅ John's screen updates instantly showing the new task under his name
- ✅ His "My Tasks" counter increases automatically
- ✅ He receives a notification bell alert

### 2. **Status Updates**
**Scenario**: Mike changes a task status from "Open" to "In-Progress"
- ✅ All team members see the status badge change color immediately
- ✅ The task's status dropdown updates without refresh

### 3. **Project Management**
**Scenario**: A manager creates a new subproject
- ✅ The entire team sees the new subproject appear instantly
- ✅ Team members can start adding tasks to it right away

### 4. **Task Completion**
**Scenario**: Jane completes a task
- ✅ The task moves to the completed section for everyone
- ✅ Task counters update across all screens
- ✅ Bobby fireworks animation plays on her screen only
- ✅ Completion sound plays (unless muted via sound toggle)

## Performance Considerations

### Optimizations
- **Listener Management**: Listeners are automatically cleaned up when not needed
- **Selective Updates**: Only visible pods/projects maintain active listeners
- **Smart Diffing**: UI elements are updated, not recreated, reducing flicker

### Resource Usage
- **Network**: Minimal - only changes are transmitted
- **Memory**: Efficient - old listeners are cleaned up properly
- **Battery**: Firestore uses WebSockets for efficient real-time updates

## Notification System

### Single Notification Per Change
The system is designed to ensure **only one notification** is created per change, even when multiple users have the page open simultaneously.

**How it works:**
- When you make a change (e.g., assign a task), your browser session creates the notification
- Other users' browsers detect the change for real-time UI updates but **do not** create duplicate notifications
- This is accomplished by checking if the current browser session is the one that made the change

**Example:**
- 3 people have the Projects page open: Alice, Bob, and Carol
- Alice assigns a task to Bob
- Alice's browser creates ONE notification for Bob
- Bob and Carol's browsers see the change (real-time sync) but don't create notifications
- Result: Bob receives exactly ONE notification ✅

## Troubleshooting

### Duplicate Notifications?

**Issue**: Receiving multiple notifications for the same change  
**Cause**: This was an issue in earlier versions where all connected clients created notifications  
**Solution**: Already fixed! Each change now creates only one notification regardless of how many users are online

If you still see duplicates:
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to clear cached code
2. Ensure all team members have refreshed to the latest version
3. Check browser console for "[Notifications]" messages to verify correct behavior

### Changes Not Appearing?

1. **Check Connection**: Look for the green "Live" indicator at the top
2. **Refresh Page**: If indicator is missing, refresh the page
3. **Check Console**: Open browser DevTools and look for `[Projects]` log messages
4. **Network Issues**: Ensure stable internet connection

### Console Logging

The system logs real-time events for debugging:
```
[Projects] Subprojects snapshot received for pod: pod1, count: 5
[Projects] Tasks snapshot received for subproject: abc123, count: 12
[Projects] New subproject detected: New Project Name
[Projects] Updated task element: Task Name
```

### Common Issues

**Issue**: Page seems slow or laggy
- **Solution**: Close and reopen browser tab to reset listeners

**Issue**: Updates appear delayed
- **Solution**: Check internet connection speed; Firestore requires stable connection

**Issue**: Duplicate tasks appearing
- **Solution**: Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

## Best Practices

### For Users
1. ✅ Keep your browser tab open for instant updates
2. ✅ Use modern browsers (Chrome, Firefox, Safari, Edge)
3. ✅ Maintain stable internet connection
4. ✅ Close tabs you're not actively using to free up resources

### For Developers
1. ✅ Always clean up listeners when components unmount
2. ✅ Use `data-task-id` attributes to track elements for updates
3. ✅ Test with multiple browser tabs open simultaneously
4. ✅ Monitor console for listener creation/cleanup logs

## Limitations

### Current Limitations
- **Browser Tab Must Be Open**: Updates only sync when the page is loaded
- **No Offline Support**: Requires active internet connection
- **Browser Compatibility**: Requires modern browser with WebSocket support

### Future Enhancements
- 🔜 Offline mode with sync when reconnected
- 🔜 Visual indicator showing who else is viewing the same project
- 🔜 Conflict resolution for simultaneous edits
- 🔜 Real-time typing indicators

## Technical Details

### Listener Architecture

```
┌─────────────────┐
│  Firestore DB   │
└────────┬────────┘
         │ WebSocket Connection
         │
    ┌────▼─────────────────┐
    │   onSnapshot API     │
    │  (Real-time Stream)  │
    └────┬─────────────────┘
         │
    ┌────▼──────────────────┐
    │  Listener Manager     │
    │  - subprojectListeners│
    │  - taskListeners      │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │  UI Update Engine     │
    │  - Create/Update/Delete│
    │  - Smart Diffing      │
    └───────────────────────┘
```

### Code Structure

**Key Files**:
- `projects.js` - Contains all real-time sync logic
- `projects.html` - Displays live indicator

**Key Functions**:
- `loadSubprojectsInto()` - Sets up real-time subproject sync
- `loadTasksInto()` - Sets up real-time task sync
- `updateTaskElement()` - Updates existing task elements
- `cleanupAllRealTimeListeners()` - Cleanup on page unload

**Key Variables**:
```javascript
const subprojectListeners = new Map(); // Tracks subproject listeners by podId
const taskListeners = new Map();       // Tracks task listeners by podId_subId
```

### Data Flow

1. **User Action** → User assigns task to teammate
2. **Firestore Update** → Task document updated in database
3. **Snapshot Triggered** → All connected clients receive update event
4. **UI Update** → Task element updates on all screens
5. **Notification** → Assigned user receives notification

## Security

- ✅ **Firestore Rules**: Real-time updates respect existing security rules
- ✅ **User Authentication**: Only authenticated users receive updates
- ✅ **Data Validation**: Updates validated before applying to UI

## Support

For issues or questions about real-time synchronization:
1. Check the browser console for error messages
2. Review this guide's troubleshooting section
3. Contact your system administrator

---

**Last Updated**: November 3, 2025  
**Feature Status**: ✅ Active  
**Supported Browsers**: Chrome, Firefox, Safari, Edge (latest versions)

