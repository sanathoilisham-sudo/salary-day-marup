const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- public routes ----------

// Get all data (anyone can view — password stripped)
app.get('/api/data', (req, res) => {
  const data = readData();
  const { adminPassword, ...publicData } = data;
  res.json(publicData);
});

// ---------- admin routes ----------

// Simple admin auth middleware — checks password header
function adminAuth(req, res, next) {
  const data = readData();
  const password = req.headers['x-admin-password'];
  if (password !== data.adminPassword) {
    return res.status(401).json({ error: 'Wrong admin password' });
  }
  next();
}

// Verify admin password
app.post('/api/admin/login', (req, res) => {
  const data = readData();
  if (req.body.password === data.adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// Toggle payment status
app.post('/api/admin/toggle-payment', adminAuth, (req, res) => {
  const { memberIndex, monthIndex } = req.body;
  const data = readData();

  if (memberIndex < 0 || memberIndex >= data.members.length) {
    return res.status(400).json({ error: 'Invalid member' });
  }
  if (monthIndex < 0 || monthIndex >= data.totalMonths) {
    return res.status(400).json({ error: 'Invalid month' });
  }

  // Toggle: paid <-> unpaid
  const current = data.members[memberIndex].payments[monthIndex];
  data.members[memberIndex].payments[monthIndex] = current ? 0 : 1;
  writeData(data);
  res.json({ success: true, data });
});

// Add a new member
app.post('/api/admin/add-member', adminAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const data = readData();
  data.members.push({
    name: name.trim(),
    payments: new Array(data.totalMonths).fill(0)
  });
  writeData(data);
  res.json({ success: true, data });
});

// Remove a member
app.post('/api/admin/remove-member', adminAuth, (req, res) => {
  const { memberIndex } = req.body;
  const data = readData();
  if (memberIndex < 0 || memberIndex >= data.members.length) {
    return res.status(400).json({ error: 'Invalid member' });
  }
  data.members.splice(memberIndex, 1);
  writeData(data);
  res.json({ success: true, data });
});

// Change admin password
app.post('/api/admin/change-password', adminAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const data = readData();
  data.adminPassword = newPassword;
  writeData(data);
  res.json({ success: true });
});

// Update settings (amount, start month, group name)
app.post('/api/admin/settings', adminAuth, (req, res) => {
  const data = readData();
  if (req.body.amountPerMonth) data.amountPerMonth = Number(req.body.amountPerMonth);
  if (req.body.startMonth) data.startMonth = req.body.startMonth;
  if (req.body.groupName) data.groupName = req.body.groupName;
  writeData(data);
  res.json({ success: true, data });
});

app.listen(PORT, () => {
  console.log(`Contribution Tracker running at http://localhost:${PORT}`);
});
