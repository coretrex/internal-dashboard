# Notification System - Testing Guide

## 🐛 Debugging Changes Made

I've added extensive logging and fixed a critical **userId matching issue**. The system now:
- ✅ Uses **email consistently** as the userId (previously mixed `id` and `email`)
- ✅ Logs every notification creation attempt
- ✅ Logs every task change detection
- ✅ Shows detailed assignee information

## 🔍 How to Test Notifications

### Setup Required
1. **Create Firestore Index** (one-time):
   - Click the notification bell
   - Click the blue "Create Index in Firebase" button
   - Wait 1-2 minutes for index to build
   - Refresh the page

2. **Two Different Users Required**:
   - You need TWO separate user accounts to test
   - Option A: Two different browsers (Chrome + Firefox)
   - Option B: Regular + Incognito mode (same browser)
   - Option C: Two different computers

### Test 1: Task Assignment Notification 📋

**Setup:**
- User A and User B both logged in on projects page
- Open browser console (F12) on both browsers

**Steps:**
1. **User A**: Assign User B to a task
   - Click on a task's assignee dropdown
   - Check User B's name
   - Click outside to save

2. **Check User B's console** - You should see:
   ```
   [Notifications] Task snapshot received: { taskId: "...", taskText: "...", ... }
   [Notifications] Creating assignment notification { targetUserId: "userB@email.com", ... }
   [Notifications] Created notification: { ... }
   [Notifications] Updated - Total: 1, Unread: 1
   ```

3. **Check User B's UI** - You should see:
   - ✅ Bell badge appears with "1"
   - ✅ Bell shakes/pulses
   - ✅ Sound plays
   - ✅ Browser notification pops up (if enabled)

4. **User B**: Click the bell icon
   - Should show notification: "User A assigned you to a task 'Task Name'"

### Test 2: Task Update Notification 📝

**Setup:**
- User A and User B both assigned to the same task

**Steps:**
1. **User A**: Change the task's due date
2. **Check User B's console** - Should see:
   ```
   [Notifications] Task updated, notifying assignees { changedFields: ["Due Date"], ... }
   [Notifications] Creating update notification { targetUserId: "userB@email.com", ... }
   ```

3. **User B**: Bell badge increases, click to see:
   - "User A updated Due Date"
   - Shows old date → new date

### Test 3: Self-Notification Check ❌

**Steps:**
1. Assign yourself to a task
2. Check console - Should see:
   ```
   [Notifications] Skipping self-notification for assignment
   ```
3. You should NOT receive a notification

## 🔍 Console Debugging Commands

Open browser console (F12) and run these to check your setup:

```javascript
// Check your userId
console.log('UserEmail:', localStorage.getItem('userEmail'));
console.log('UserId:', localStorage.getItem('userId'));
console.log('UserName:', localStorage.getItem('userName'));

// Check if listeners are active
console.log('Active task listeners:', taskChangeListeners?.size || 0);

// Manually check for notifications
const email = localStorage.getItem('userEmail');
console.log('Querying notifications for:', email);
```

## 🚨 Common Issues & Solutions

### Issue: "No notification received"

**Check 1: Are you testing with the same user?**
- ❌ Same user in two tabs → Won't work (self-notification blocked)
- ✅ Two different users → Should work

**Check 2: Check console logs**
On the user making the change, look for:
```
[Notifications] Creating assignment notification
```

On the user receiving notification, look for:
```
[Notifications] Updated - Total: X, Unread: Y
```

**Check 3: Verify userId matching**
In BOTH browsers, run:
```javascript
console.log(localStorage.getItem('userEmail'));
```

These must be DIFFERENT emails. If they're the same, you're testing with the same user.

**Check 4: Check Firestore**
1. Go to Firebase Console → Firestore
2. Check `notifications` collection
3. Look for documents with:
   - `userId` = the recipient's email
   - `read` = false
   - `createdAt` = recent timestamp

If notifications exist but badge doesn't show:
- Refresh the page
- Check if listener is running (see console logs)

### Issue: "Listener errors in console"

**Error: "Missing index"**
- Click the link in the error to create the index
- Wait 1-2 minutes
- Refresh the page

**Error: "Permission denied"**
- Check Firestore security rules
- Ensure users can read/write to `notifications` collection

### Issue: "Badge shows wrong count"

Run this in console to check:
```javascript
// This will show all your notifications
const email = localStorage.getItem('userEmail');
console.log('Your email:', email);
```

Then check Firestore to see if `userId` in notifications matches your email exactly.

## 📊 Expected Console Output

### When Assigning a User

**User A (assigner) console:**
```
[Notifications] Task snapshot received: {...}
[Notifications] Creating assignment notification {
  targetUserId: "userb@example.com",
  taskText: "Fix login bug",
  changedBy: "User A",
  assignee: {id: "userb@example.com", name: "User B", email: "userb@example.com"}
}
[Notifications] Created notification: {...}
```

**User B (assignee) console:**
```
[Notifications] Initializing listener for user: userb@example.com (email: userb@example.com)
[Notifications] Updated - Total: 1, Unread: 1
```

### When Updating a Task

**User A (updater) console:**
```
[Notifications] Task updated, notifying assignees {
  changedFields: [{field: "Due Date", old: "2024-01-01", new: "2024-01-05"}],
  assigneeCount: 2,
  taskText: "Fix login bug"
}
[Notifications] Creating update notification {
  targetUserId: "userb@example.com",
  changedFields: ["Due Date"]
}
```

## 🎯 Quick Test Checklist

Use this checklist to verify everything works:

- [ ] Firestore index created and enabled
- [ ] Two different user accounts available
- [ ] Both users logged in on projects page
- [ ] Browser console open on both (F12)
- [ ] User A assigns User B to task
- [ ] User B sees console log: "Updated - Total: 1, Unread: 1"
- [ ] User B sees bell badge with "1"
- [ ] User B hears notification sound
- [ ] User B clicks bell and sees notification
- [ ] Notification shows correct details
- [ ] User B clicks notification to mark as read
- [ ] Badge disappears
- [ ] User A changes task (with both assigned)
- [ ] User B gets update notification
- [ ] Console shows "Creating update notification"

## 💡 Pro Tips

1. **Keep console open** while testing to see real-time logs
2. **Test with real emails** - Don't use test/fake accounts
3. **Wait a moment** after assignment for listener to fire (should be instant but allow 1-2 seconds)
4. **Clear Firestore** if you want to start fresh:
   ```
   Go to Firebase Console → Firestore → notifications collection → Delete all documents
   ```
5. **Check network tab** - Look for Firestore requests if nothing happens

## 🎬 Video Test Demo Script

Follow this script for a complete test:

1. **Setup** (30 seconds)
   - Open Chrome, login as User A
   - Open Firefox, login as User B
   - Navigate both to Projects page
   - Open console on both (F12)

2. **Test Assignment** (1 minute)
   - User A: Create new task "Test Notification"
   - User A: Assign User B to the task
   - Wait 2 seconds
   - User B: Check console for logs
   - User B: Check bell icon for badge
   - User B: Click bell to view notification

3. **Test Update** (1 minute)
   - User A: Change task due date
   - User B: Check for new notification
   - User B: Click to view details

4. **Verify** (30 seconds)
   - User B: Mark all as read
   - Badge should disappear
   - ✅ Test complete!

---

## Still Not Working?

If you've followed all steps and it's still not working, please provide:

1. **Console logs** from both users (copy the [Notifications] lines)
2. **Screenshot** of Firestore notifications collection
3. **User emails** being used (from `localStorage.getItem('userEmail')`)
4. **Exact steps** you took

I can then help debug the specific issue! 🐛


