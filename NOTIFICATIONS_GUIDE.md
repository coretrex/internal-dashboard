# Notification System Guide

## Overview
The CoreTrex internal dashboard now includes a real-time notification system that alerts team members when:
- They are assigned to a task
- Someone updates a task they're assigned to

## Features

### 🔔 Notification Bell
- Located in the top-right corner next to "Welcome, [Name]"
- Shows a red badge with the number of unread notifications
- Pulses/animates when a new notification arrives
- Click to view all notifications

### 📋 Notification Types

#### Task Assignment
When someone assigns you to a task, you'll receive a notification showing:
- Who assigned you
- The task name
- Which project/pod it's in
- When it was assigned

#### Task Updates
When someone updates a task you're assigned to, you'll see:
- Who made the change
- What changed (e.g., Task Name, Due Date, Status, Description)
- The old and new values
- Task name and project

### 🔊 Notification Alerts
- **Sound Alert**: A subtle sound plays when you receive a new notification
- **Browser Notification**: Desktop/browser notifications appear (if you grant permission)
- **Visual Badge**: Red badge on the bell icon shows unread count

### 📖 Notification Modal
Click the notification bell to open the notification panel:
- View all recent notifications (up to 50)
- Unread notifications are highlighted in light blue with a pulse effect
- Click any notification to mark it as read
- Click "Mark all as read" to clear all unread notifications
- Each notification shows:
  - Who made the change
  - What changed
  - Task name
  - Project name
  - Time ago

## How It Works

### Real-Time Updates
The system uses Firestore real-time listeners to detect changes immediately:
1. When you assign someone to a task, a notification is created in Firestore
2. The assigned user's browser is listening for new notifications
3. As soon as the notification is created, it appears in their notification bell
4. A sound plays and browser notification appears (if enabled)

### Change Tracking
The system tracks the following changes:
- **Assignments**: When users are added to the assignee list
- **Task Name**: When the task title is changed
- **Due Date**: When the due date is set or changed
- **Status**: When the task status changes (Open, In-Progress, etc.)
- **Description**: When the long description is updated

### Smart Notifications
- You won't receive notifications for changes you make yourself
- Only team members assigned to a task receive update notifications
- Duplicate listeners are prevented to avoid excessive notifications
- The first load of tasks doesn't trigger notifications (prevents false alerts)

## Firestore Setup

### Required Collection
The system creates a `notifications` collection in Firestore with documents containing:
```javascript
{
  userId: "user@example.com",
  type: "task_assigned" | "task_updated",
  taskId: "task123",
  taskText: "Task name",
  podId: "pod1",
  subprojectId: "sub123",
  changeType: "assigned" | "updated",
  changedBy: "John Doe",
  changes: { /* change details */ },
  read: false,
  createdAt: Timestamp,
  timestamp: 1234567890
}
```

### Required Index
You may need to create a composite index in Firestore for the notifications query:
- Collection: `notifications`
- Fields indexed:
  - `userId` (Ascending)
  - `timestamp` (Descending)

If you see an error in the console about a missing index, Firestore will provide a direct link to create it automatically.

## Usage Tips

### For Administrators
1. Ensure all users have their email properly set in the system
2. Users should grant browser notification permissions for best experience
3. The notification system works automatically - no manual setup needed

### For Team Members
1. Click the bell icon to check your notifications
2. Unread notifications are highlighted - click to mark as read
3. Enable browser notifications for alerts even when the tab isn't active
4. Sound can be helpful when working in the dashboard

### Best Practices
- Regularly check and clear notifications
- Use meaningful task names so notifications are clear
- Grant browser notification permission for important updates
- Don't worry about missing notifications - they're stored and won't disappear

## Troubleshooting

### Bell Icon Not Showing
- Refresh the page
- Check that you're logged in
- Verify the navigation component is loaded

### No Notifications Appearing
- Check that other users are making changes
- Verify you're assigned to tasks
- Check the browser console for any errors
- Ensure you have proper Firestore permissions

### Sound Not Playing
- Check your browser's autoplay settings
- Ensure sound is enabled in your browser
- Try clicking around the page first (browsers block autoplay until user interaction)

### Browser Notifications Not Working
- Check your browser settings for notification permissions
- Click "Allow" when prompted
- Check your OS notification settings

## Technical Details

### Files Modified
- `projects.js`: Main notification logic
- `projects.html`: Notification modal UI
- `navigation.js`: Notification bell in header
- `style.css`: Notification styling and animations

### Key Functions
- `createNotification()`: Creates a new notification in Firestore
- `initNotificationListener()`: Sets up real-time listener for current user
- `setupTaskChangeListener()`: Tracks changes to individual tasks
- `openNotificationsModal()`: Displays notification panel
- `markAllNotificationsAsRead()`: Clears all unread notifications

### Dependencies
- Firestore real-time listeners (onSnapshot)
- Browser Notification API
- Web Audio API for sound

## Future Enhancements
Possible improvements for future versions:
- Filter notifications by project
- Notification preferences/settings
- Email notifications for offline users
- Task completion notifications
- Comment/mention notifications
- Notification archiving
- Search/filter in notification panel


