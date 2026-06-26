// --- App State Management ---
let users = JSON.parse(localStorage.getItem('growpay_users')) || [];
let currentUser = JSON.parse(sessionStorage.getItem('growpay_session')) || null;
const ADMIN_PIN = "1234"; 

// Initialize App on Load
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showDashboard();
    }
});

// --- Helper Functions ---
const saveUsers = () => localStorage.setItem('growpay_users', JSON.stringify(users));
const updateSession = () => sessionStorage.setItem('growpay_session', JSON.stringify(currentUser));
const formatCurrency = (num) => "₦" + parseFloat(num).toLocaleString(undefined, { minimumFractionDigits: 2 });
const generateAccountNumber = () => Math.floor(1000000000 + Math.random() * 9000000000); // 10 Digits
const generateTransID = () => { // 24 Digits
    let res = "";
    for (let i = 0; i < 24; i++) res += Math.floor(Math.random() * 10);
    return res;
};

// --- Authentication Logic ---

function signup() {
    const name = document.getElementById('reg-name').value.trim();
    const bvn = document.getElementById('reg-bvn').value.trim();
    const addr = document.getElementById('reg-address').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();

    if (!name || bvn.length !== 11 || !pass || !addr) {
        alert("Please fill all fields. BVN/NIN must be 11 digits.");
        return;
    }

    // Check if User already exists (Unique Name or BVN/NIN)
    const existingUser = users.find(u => u.name.toLowerCase() === name.toLowerCase() || u.bvn === bvn);
    if (existingUser) {
        alert("An account with this Name or BVN/NIN already exists on this device.");
        return;
    }

    const newUser = {
        name,
        bvn,
        address: addr,
        pass,
        accountNo: generateAccountNumber(),
        balance: 0,
        fixedDeposits: [],
        shares: [],
        history: []
    };

    users.push(newUser);
    saveUsers();
    alert("Account created successfully! Please login.");
    location.reload(); // Refresh to login page
}

function login() {
    const nameInput = document.getElementById('login-name').value.trim();
    const passInput = document.getElementById('login-pass').value.trim();

    const user = users.find(u => u.name.toLowerCase() === nameInput.toLowerCase() && u.pass === passInput);

    if (user) {
        currentUser = user;
        updateSession();
        showDashboard();
    } else {
        alert("Invalid Full Name or Password.");
    }
}

function logout() {
    sessionStorage.removeItem('growpay_session');
    location.reload();
}

// --- Navigation & UI Updates ---

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
    document.getElementById('user-display').innerText = `${currentUser.name} | Acc: ${currentUser.accountNo}`;
    document.getElementById('avail-bal').innerText = formatCurrency(currentUser.balance);
    
    // Update Fixed Table
    const tbody = document.getElementById('fixed-list-body');
    tbody.innerHTML = '';
    currentUser.fixedDeposits.forEach((fd, index) => {
        tbody.innerHTML += `<tr>
            <td>${formatCurrency(fd.amount)}</td>
            <td>${fd.rate}%</td>
            <td>${fd.expiry}</td>
            <td><button onclick="liquidateFixed(${index})" style="background:red; color:white; border:none; padding:4px; cursor:pointer">End</button></td>
        </tr>`;
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
        <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between">
            <div>
                <strong style="color:${h.type === 'Credit' ? 'green' : 'red'}">${h.type}</strong><br>
                <small>${h.remark}</small><br>
                <small style="color:gray; font-size:10px">${h.date}</small>
            </div>
            <div><strong>${formatCurrency(h.amount)}</strong></div>
        </div>
    `).join('');
}

// --- Features Logic ---

// 1. Admin Funding
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
            remark: 'Admin Wallet Funding',
            date: new Date().toLocaleString()
        });
        saveAndUpdate();
        closeModal();
        alert("Success! Wallet Funded.");
    } else {
        alert("Invalid PIN or Amount");
    }
}

// 2. Bank Transfer & Receipt
function processTransfer() {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const recipient = document.getElementById('trans-name').value;
    const remark = document.getElementById('trans-remark').value || "Transfer";

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
        alert("Insufficient balance.");
    }
}

// 3. Fixed Deposit (Instant Interest Logic)
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorSelect = document.getElementById('fix-tenor');
    const days = parseInt(tenorSelect.value);
    const rate = parseInt(tenorSelect.options[tenorSelect.selectedIndex].dataset.rate);

    if (amt > 0 && currentUser.balance >= amt) {
        const interest = (amt * (rate / 100));
        
        // Deduction of principal + Immediate drop of interest
        currentUser.balance -= amt; 
        currentUser.balance += interest;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        currentUser.fixedDeposits.push({
            amount: amt,
            interestEarned: interest,
            rate: rate,
            expiry: expiryDate.toLocaleDateString(),
            expiryRaw: expiryDate.getTime()
        });

        currentUser.history.push({
            type: 'Fixed Deposit',
            amount: amt,
            remark: `Fixed ${amt} for ${days} days. Interest of ${interest} added to balance.`,
            date: new Date().toLocaleString()
        });

        saveAndUpdate();
        alert(`Fixed successful! Interest of ${formatCurrency(interest)} added to your balance.`);
    } else {
        alert("Insufficient balance.");
    }
}

function liquidateFixed(index) {
    const fd = currentUser.fixedDeposits[index];
    const now = new Date().getTime();
    
    // Penalty logic: If before expiry, charge 40% of the interest already dropped
    if (now < fd.expiryRaw) {
        const penalty = fd.interestEarned * 0.40;
        alert(`Note: Early liquidation before expiry date. A penalty of 40% of earned interest (${formatCurrency(penalty)}) has been deducted.`);
        currentUser.balance -= penalty;
    }

    currentUser.balance += fd.amount; // Refund principal
    currentUser.fixedDeposits.splice(index, 1);
    
    currentUser.history.push({
        type: 'Credit',
        amount: fd.amount,
        remark: 'Fixed Principal Returned',
        date: new Date().toLocaleString()
    });

    saveAndUpdate();
}

// 4. Shares Investment
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const pricePerUnit = 500; // Fixed price for logic
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
            remark: `Purchased ${qty} shares units`,
            date: new Date().toLocaleString()
        });

        saveAndUpdate();
        alert("Shares purchased successfully!");
    } else {
        alert("Insufficient balance or invalid quantity.");
    }
}

// --- UI Receipt and Saving Logic ---

function showReceipt(amt, recipient, remark, ref, date) {
    document.getElementById('r-amount').innerText = formatCurrency(amt);
    document.getElementById('r-recipient').innerText = recipient;
    document.getElementById('r-sender').innerText = currentUser.name;
    document.getElementById('r-remark').innerText = remark;
    document.getElementById('r-ref').innerText = ref;
    document.getElementById('r-date').innerText = date;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }

function saveAndUpdate() {
    const idx = users.findIndex(u => u.accountNo === currentUser.accountNo);
    users[idx] = currentUser;
    saveUsers();
    updateSession();
    updateUI();
}

let fixedVisible = false;
function toggleFixedVisibility() {
    fixedVisible = !fixedVisible;
    const text = document.getElementById('fixed-bal-text');
    if (fixedVisible) {
        const total = currentUser.fixedDeposits.reduce((s, f) => s + f.amount, 0);
        text.innerText = formatCurrency(total);
    } else {
        text.innerText = "****";
    }
}
