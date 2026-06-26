// --- Configuration & State Management ---
let users = JSON.parse(localStorage.getItem('growpay_users')) || [];
let currentUser = JSON.parse(sessionStorage.getItem('growpay_session')) || null;
const ADMIN_PIN = "1234"; // Admin funding PIN

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showDashboard();
    }
});

// --- Helper Functions ---
const saveUsers = () => localStorage.setItem('growpay_users', JSON.stringify(users));
const updateSession = () => sessionStorage.setItem('growpay_session', JSON.stringify(currentUser));

const formatCurrency = (num) => "₦" + parseFloat(num).toLocaleString(undefined, { minimumFractionDigits: 2 });

const generateAccountNumber = () => Math.floor(Math.random() * 9000000000) + 1000000000;

const generateTransID = () => {
    let res = "";
    for (let i = 0; i < 24; i++) res += Math.floor(Math.random() * 10);
    return res;
};

// --- Auth Functions ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const addr = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-pass').value;

    if (!name || bvn.length !== 11 || !pass) {
        alert("Please fill all fields correctly. BVN/NIN must be 11 digits.");
        return;
    }

    const newUser = {
        name,
        pass,
        bvn,
        address: addr,
        accountNo: generateAccountNumber(),
        balance: 0,
        fixedBalance: 0,
        fixedDeposits: [],
        shares: [],
        history: []
    };

    users.push(newUser);
    saveUsers();
    currentUser = newUser;
    updateSession();
    showDashboard();
}

function login() {
    const name = document.getElementById('login-name').value;
    const pass = document.getElementById('login-pass').value;

    const user = users.find(u => u.name === name && u.pass === pass);
    if (user) {
        currentUser = user;
        updateSession();
        showDashboard();
    } else {
        alert("Invalid credentials");
    }
}

function logout() {
    sessionStorage.removeItem('growpay_session');
    location.reload();
}

// --- Navigation & UI ---
function showDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
}

function updateUI() {
    document.getElementById('user-display').innerText = `${currentUser.name} (${currentUser.accountNo})`;
    document.getElementById('avail-bal').innerText = formatCurrency(currentUser.balance);
    
    // Update Fixed Table
    const tbody = document.getElementById('fixed-list-body');
    tbody.innerHTML = '';
    currentUser.fixedDeposits.forEach((fd, index) => {
        const row = `<tr>
            <td>${formatCurrency(fd.amount)}</td>
            <td>${fd.rate}%</td>
            <td>${fd.expiry}</td>
            <td><button onclick="liquidateFixed(${index})" class="close-btn" style="padding:2px 5px; font-size:10px">End</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });

    // Update Shares Table
    const shareBody = document.getElementById('shares-list-body');
    shareBody.innerHTML = '';
    currentUser.shares.forEach(s => {
        shareBody.innerHTML += `<tr>
            <td>${s.units}</td>
            <td>${formatCurrency(s.cost)}</td>
            <td>${s.date}</td>
        </tr>`;
    });

    // Update History
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = currentUser.history.slice().reverse().map(h => `
        <div class="card" style="margin-bottom:10px; border-left: 4px solid ${h.type === 'Credit' ? '#2ecc71' : '#e74c3c'}">
            <p><strong>${h.type}: ${formatCurrency(h.amount)}</strong></p>
            <p style="font-size:12px">${h.remark} | ${h.date}</p>
        </div>
    `).join('');
}

// --- Admin Funding ---
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);

    if (pin === ADMIN_PIN && amt > 0) {
        currentUser.balance += amt;
        currentUser.history.push({
            type: 'Credit',
            amount: amt,
            remark: 'Admin Funding',
            date: new Date().toLocaleString()
        });
        saveAndUpdate();
        closeModal();
        alert("Wallet Funded Successfully");
    } else {
        alert("Invalid PIN or Amount");
    }
}

// --- Transfers ---
function processTransfer() {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const recipient = document.getElementById('trans-name').value;
    const remark = document.getElementById('trans-remark').value;

    if (amt > 0 && currentUser.balance >= amt) {
        currentUser.balance -= amt;
        const ref = generateTransID();
        const date = new Date().toLocaleString();
        
        currentUser.history.push({
            type: 'Debit',
            amount: amt,
            remark: `Transfer to ${recipient}`,
            date: date
        });

        saveAndUpdate();
        showReceipt(amt, recipient, remark, ref, date);
    } else {
        alert("Insufficient funds or invalid amount");
    }
}

// --- Fixed Deposit ---
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorSelect = document.getElementById('fix-tenor');
    const days = parseInt(tenorSelect.value);
    const rate = parseInt(tenorSelect.options[tenorSelect.selectedIndex].dataset.rate);

    if (amt > 0 && currentUser.balance >= amt) {
        const interest = (amt * (rate / 100));
        
        // Deduction and immediate interest drop
        currentUser.balance -= amt; 
        currentUser.balance += interest;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        currentUser.fixedDeposits.push({
            amount: amt,
            interestEarned: interest,
            rate: rate,
            expiry: expiryDate.toLocaleDateString(),
            expiryRaw: expiryDate.getTime(),
            status: 'Active'
        });

        currentUser.history.push({
            type: 'Fixed Deposit',
            amount: amt,
            remark: `Fixed for ${days} days (+${formatCurrency(interest)} interest added)`,
            date: new Date().toLocaleString()
        });

        saveAndUpdate();
        alert(`Fixed successfully! ${formatCurrency(interest)} interest has been added to your balance.`);
    } else {
        alert("Insufficient balance");
    }
}

function liquidateFixed(index) {
    const fd = currentUser.fixedDeposits[index];
    const now = new Date().getTime();
    let refundAmount = fd.amount;

    if (now < fd.expiryRaw) {
        const penalty = fd.interestEarned * 0.40;
        alert(`Early liquidation! A 40% penalty (${formatCurrency(penalty)}) will be deducted from your balance.`);
        currentUser.balance -= penalty;
    }

    currentUser.balance += fd.amount;
    currentUser.fixedDeposits.splice(index, 1);
    
    currentUser.history.push({
        type: 'Credit',
        amount: fd.amount,
        remark: 'Fixed Deposit Liquidated',
        date: new Date().toLocaleString()
    });

    saveAndUpdate();
}

// --- Shares ---
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const pricePerUnit = 500;
    const total = qty * pricePerUnit;

    if (qty > 0 && currentUser.balance >= total) {
        currentUser.balance -= total;
        currentUser.shares.push({
            units: qty,
            cost: total,
            date: new Date().toLocaleString()
        });
        
        currentUser.history.push({
            type: 'Debit',
            amount: total,
            remark: `Bought ${qty} share units`,
            date: new Date().toLocaleString()
        });

        saveAndUpdate();
        alert("Shares purchased successfully!");
    } else {
        alert("Insufficient funds or invalid quantity");
    }
}

// --- Receipt Management ---
function showReceipt(amt, recipient, remark, ref, date) {
    document.getElementById('r-amount').innerText = formatCurrency(amt);
    document.getElementById('r-recipient').innerText = recipient;
    document.getElementById('r-sender').innerText = currentUser.name;
    document.getElementById('r-remark').innerText = remark || "None";
    document.getElementById('r-ref').innerText = ref;
    document.getElementById('r-date').innerText = date;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }

async function downloadReceipt(type) {
    const element = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(element);
    
    if (type === 'image') {
        const link = document.createElement('a');
        link.download = 'GrowPay-Receipt.png';
        link.href = canvas.toDataURL();
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 15, 180, 160);
        pdf.save("GrowPay-Receipt.pdf");
    }
}

// --- Utility: Save and Refresh ---
function saveAndUpdate() {
    const userIdx = users.findIndex(u => u.accountNo === currentUser.accountNo);
    users[userIdx] = currentUser;
    saveUsers();
    updateSession();
    updateUI();
}

// --- Toggle Eye ---
let fixedVisible = false;
function toggleFixedVisibility() {
    fixedVisible = !fixedVisible;
    const eye = document.getElementById('toggle-eye');
    const text = document.getElementById('fixed-bal-text');
    
    if (fixedVisible) {
        const totalFixed = currentUser.fixedDeposits.reduce((sum, fd) => sum + fd.amount, 0);
        text.innerText = formatCurrency(totalFixed);
        eye.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        text.innerText = "****";
        eye.classList.replace('fa-eye-slash', 'fa-eye');
    }
}
