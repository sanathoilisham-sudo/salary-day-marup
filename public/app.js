let appData = null;
let isAdmin = false;
let adminPassword = '';

// ---------- Data ----------
async function fetchData() {
  const res = await fetch('/api/data');
  appData = await res.json();
  render();
}

// ---------- Auth ----------
function showLogin() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
  document.getElementById('loginError').classList.add('hidden');
  setTimeout(() => document.getElementById('passwordInput').focus(), 100);
}

async function login() {
  const pw = document.getElementById('passwordInput').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });

  if (res.ok) {
    isAdmin = true;
    adminPassword = pw;
    closeModal('loginModal');
    render();
  } else {
    document.getElementById('loginError').classList.remove('hidden');
  }
}

function logout() {
  isAdmin = false;
  adminPassword = '';
  render();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ---------- Admin Actions ----------
function showAddMember() {
  document.getElementById('addMemberModal').classList.remove('hidden');
  document.getElementById('newMemberName').value = '';
  setTimeout(() => document.getElementById('newMemberName').focus(), 100);
}

async function addMember() {
  const name = document.getElementById('newMemberName').value.trim();
  if (!name) return;

  const res = await fetch('/api/admin/add-member', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({ name })
  });

  if (res.ok) {
    appData = (await res.json()).data;
    closeModal('addMemberModal');
    render();
  }
}

async function removeMember(index) {
  const member = appData.members[index];
  if (!confirm(`Remove "${member.name}" from the group? This cannot be undone.`)) return;

  const res = await fetch('/api/admin/remove-member', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({ memberIndex: index })
  });

  if (res.ok) {
    appData = (await res.json()).data;
    render();
  }
}

async function togglePayment(memberIndex, monthIndex) {
  if (!isAdmin) return;

  const member = appData.members[memberIndex];
  const monthLabel = getMonthLabel(appData.startMonth, monthIndex);
  const currentlyPaid = member.payments[monthIndex];
  const action = currentlyPaid ? 'mark as UNPAID' : 'mark as PAID';

  if (!confirm(`${action.toUpperCase()} for ${member.name} — ${monthLabel}?`)) return;

  const res = await fetch('/api/admin/toggle-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({ memberIndex, monthIndex })
  });

  if (res.ok) {
    appData = (await res.json()).data;
    render();
  }
}

// ---------- Change Password ----------
function showChangePassword() {
  document.getElementById('changePasswordModal').classList.remove('hidden');
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  document.getElementById('changePasswordError').classList.add('hidden');
  setTimeout(() => document.getElementById('newPasswordInput').focus(), 100);
}

async function changePassword() {
  const newPw = document.getElementById('newPasswordInput').value;
  const confirmPw = document.getElementById('confirmPasswordInput').value;
  const errorEl = document.getElementById('changePasswordError');

  if (newPw.length < 4) {
    errorEl.textContent = 'Password must be at least 4 characters';
    errorEl.classList.remove('hidden');
    return;
  }

  if (newPw !== confirmPw) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }

  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({ newPassword: newPw })
  });

  if (res.ok) {
    adminPassword = newPw;
    closeModal('changePasswordModal');
    alert('Password changed successfully!');
  } else {
    errorEl.textContent = 'Failed to change password';
    errorEl.classList.remove('hidden');
  }
}

// ---------- Render ----------
function getMonthLabel(startMonth, offset) {
  const [year, month] = startMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames[date.getMonth()] + ' ' + date.getFullYear().toString().slice(-2);
}

function render() {
  if (!appData) return;

  // Header
  document.getElementById('groupName').textContent = appData.groupName || 'Contribution Tracker';
  document.getElementById('subInfo').textContent =
    `Rs ${appData.amountPerMonth.toLocaleString()} per month x ${appData.totalMonths} months | ${appData.members.length} members`;

  // Admin buttons
  document.getElementById('adminBtn').classList.toggle('hidden', isAdmin);
  document.getElementById('logoutBtn').classList.toggle('hidden', !isAdmin);
  document.getElementById('adminControls').classList.toggle('hidden', !isAdmin);

  // Current month calculation
  const [sy, sm] = appData.startMonth.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, 1);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  const currentMonthIdx = Math.max(0, Math.min(monthsDiff, appData.totalMonths - 1));

  document.getElementById('totalMembers').textContent = appData.members.length;
  document.getElementById('currentMonth').textContent = getMonthLabel(appData.startMonth, currentMonthIdx);

  // Monthly collection helper
  function getMonthStats(monthIdx) {
    let paid = 0;
    let unpaid = 0;
    appData.members.forEach(m => {
      if (m.payments[monthIdx]) paid++;
      else unpaid++;
    });
    return {
      collected: paid * appData.amountPerMonth,
      pending: unpaid * appData.amountPerMonth,
      paidCount: paid,
      total: appData.members.length
    };
  }

  // Current month stats
  const curStats = getMonthStats(currentMonthIdx);
  document.getElementById('monthCollected').textContent = 'Rs ' + curStats.collected.toLocaleString();
  document.getElementById('monthPending').textContent =
    `${curStats.paidCount}/${curStats.total} paid | Rs ${curStats.pending.toLocaleString()} pending`;

  // Month selector dropdown
  const selector = document.getElementById('monthSelector');
  const prevSelected = selector.value;
  selector.innerHTML = '';
  for (let i = 0; i < appData.totalMonths; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = getMonthLabel(appData.startMonth, i);
    if (prevSelected !== '' && Number(prevSelected) === i) opt.selected = true;
    else if (prevSelected === '' && i === currentMonthIdx) opt.selected = true;
    selector.appendChild(opt);
  }

  // Selected month stats
  const selectedIdx = Number(selector.value);
  const selStats = getMonthStats(selectedIdx);
  document.getElementById('selectedCollected').textContent = 'Rs ' + selStats.collected.toLocaleString();
  document.getElementById('selectedPending').textContent =
    `${selStats.paidCount}/${selStats.total} paid | Rs ${selStats.pending.toLocaleString()} pending`;

  // Table header
  const thead = document.getElementById('tableHead');
  let headHTML = '<tr><th>Member</th><th>Receives</th>';
  for (let i = 0; i < appData.totalMonths; i++) {
    const isCurrent = i === currentMonthIdx;
    headHTML += `<th style="${isCurrent ? 'background:#0f3460;' : ''}">${getMonthLabel(appData.startMonth, i)}</th>`;
  }
  headHTML += '<th>Paid</th>';
  if (isAdmin) headHTML += '<th></th>';
  headHTML += '</tr>';
  thead.innerHTML = headHTML;

  // Table body
  const tbody = document.getElementById('tableBody');
  let bodyHTML = '';

  appData.members.forEach((member, mi) => {
    const paidCount = member.payments.filter(p => p).length;
    const roleTag = member.role ? `<span class="role-tag">${escapeHtml(member.role)}</span>` : '';
    let phoneStr = '';
    if (member.phone) {
      const cleanPhone = member.phone.replace(/\D/g, '');
      const waPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
      phoneStr = `<div class="member-phone-row">
        <span class="member-phone">${escapeHtml(member.phone)}</span>
        <a href="tel:+91${cleanPhone}" class="phone-action call" title="Call">&#128222;</a>
        <a href="https://wa.me/${waPhone}" target="_blank" class="phone-action wa" title="WhatsApp">&#128172;</a>
      </div>`;
    }

    bodyHTML += '<tr>';
    bodyHTML += `<td>
      <div class="member-name-cell">
        <span class="member-number">${mi + 1}.</span>
        <div class="member-info">
          <div class="member-name-line">${escapeHtml(member.name)} ${roleTag}</div>
          ${phoneStr}
        </div>
      </div>
    </td>`;

    // Receiving month & amount column
    const recvMonth = member.receivingMonth || '-';
    const recvAmt = member.receivingAmount ? 'Rs ' + member.receivingAmount.toLocaleString() : '';
    bodyHTML += `<td class="receiving-cell">
      <div class="recv-month">${escapeHtml(recvMonth)}</div>
      <div class="recv-amount">${recvAmt}</div>
    </td>`;

    for (let mj = 0; mj < appData.totalMonths; mj++) {
      const paid = member.payments[mj];
      const cellClass = paid ? 'cell-paid' : 'cell-unpaid';
      const clickable = isAdmin ? 'cell-clickable' : '';
      const onclick = isAdmin ? `onclick="togglePayment(${mi}, ${mj})"` : '';
      const label = paid ? 'Paid' : '-';
      bodyHTML += `<td class="${cellClass} ${clickable}" ${onclick}>${label}</td>`;
    }

    bodyHTML += `<td class="member-paid-count">${paidCount} / ${appData.totalMonths}</td>`;
    if (isAdmin) {
      bodyHTML += `<td><button class="btn btn-danger" onclick="removeMember(${mi})">Remove</button></td>`;
    }
    bodyHTML += '</tr>';
  });

  tbody.innerHTML = bodyHTML;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Init ----------
fetchData();
