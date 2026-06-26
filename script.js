// --- INITIALIZATION & DATA HANDLING ---
let users = JSON.parse(localStorage.getItem('growpay_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('growpay_current_user')) || null;

const ADMIN_PIN = "1234"; // Default Admin PIN for funding

// Run on page load
window.onload = () => {
    if (currentUser) {
        showDashboard();
    }
};

// --- AUTHENTICATION ---

function signup() {
    const name = document.getElementById('reg-name').value.trim();
    const bvn = document.getElementById('reg-bvn').value.trim();
    const address = document.getElementById('reg-address').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();

    if (!name || !bvn || !address || !pass) return alert("Please fill all fields");
    if (bvn.length !== 11) return alert("BVN/NIN must be 11 digits");

    // Check for existing user
    const existingUser = users.find(u => u.name === name || u.bvn === bvn);
    if (existingUser) return alert("User with this Name or BVN already exists!");

    const newUser = {
        name: name,
        bvn: bvn,
        address: address,
        password: pass,
        accountNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        balance: 0,
        fixedBalance: 0,
        history: [],
        fixedDeposits: [],
        shares: []
    };

    users.push(newUser);
    saveData();
    alert("Account Created Successfully! Please login.");
    location.reload();
}

function login() {
    const name = document.getElementById('login-name').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    const user = users.find(u => u.name === name && u.password === pass);

    if (user) {
        currentUser = user;
        localStorage.setItem('growpay_current_user', JSON.stringify(currentUser));
        showDashboard();
    } else {
        alert("Invalid Name or Password");
    }
}

// Override the inline onclick for login button in HTML if needed
document.querySelector('#login-form button').onclick = login;

function logout() {
    localStorage.removeItem('growpay_current_user');
    location.reload();
}

// --- UI NAVIGATION ---

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
    if (!currentUser) return;

    document.getElementById('user-display').innerText = `${currentUser.name} | Acct: ${currentUser.accountNumber}`;
    document.getElementById('avail-bal').innerText = `₦${currentUser.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    const fixedText = document.getElementById('fixed-bal-text');
    if (fixedText.innerText !== "****") {
        fixedText.innerText = `₦${currentUser.fixedBalance.toLocaleString()}`;
    }

    renderHistory();
    renderFixedTable();
    renderShares();
}

function saveData() {
    localStorage.setItem('growpay_users', JSON.stringify(users));
    if (currentUser) {
        // Update current user in the main users array
        const index = users.findIndex(u => u.accountNumber === currentUser.accountNumber);
        if (index !== -1) users[index] = currentUser;
        localStorage.setItem('growpay_users', JSON.stringify(users));
        localStorage.setItem('growpay_current_user', JSON.stringify(currentUser));
    }
}

// --- CORE FEATURES ---

// Admin Funding
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amount = parseFloat(document.getElementById('fund-amt').value);

    if (pin !== ADMIN_PIN) return alert("Incorrect Admin PIN");
    if (isNaN(amount) || amount <= 0) return alert("Enter valid amount");

    currentUser.balance += amount;
    addHistory("Credit", `Admin Funding`, amount);
    
    saveData();
    updateUI();
    closeModal();
    alert("Wallet Funded Successfully!");
}

// Transfer logic
function processTransfer() {
    const recipient = document.getElementById('trans-name').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const remark = document.getElementById('trans-remark').value || "Transfer";

    if (!recipient || isNaN(amount) || amount <= 0) return alert("Fill all details correctly");
    if (amount > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= amount;
    const ref = generateRef();
    addHistory("Debit", `To: ${recipient}`, amount, ref);
    
    saveData();
    updateUI();
    showReceipt(recipient, amount, remark, ref);
}

// Fixed Deposit
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenor = parseInt(document.getElementById('fix-tenor').value);
    const rate = parseInt(document.getElementById('fix-tenor').selectedOptions[0].getAttribute('data-rate'));

    if (isNaN(amt) || amt < 1000) return alert("Minimum fixed amount is ₦1,000");
    if (amt > currentUser.balance) return alert("Insufficient Balance");

    const interest = (amt * rate) / 100;
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + tenor);

    const deposit = {
        id: Date.now(),
        amount: amt,
        interest: interest,
        tenor: tenor,
        maturity: maturityDate.toISOString(),
        status: "Active"
    };

    currentUser.balance -= amt;
    currentUser.fixedBalance += amt;
    // Instruction: drop interest into available balance immediately
    currentUser.balance += interest; 

    currentUser.fixedDeposits.push(deposit);
    addHistory("Fixed Deposit", `Fixed ₦${amt} for ${tenor} days`, amt);
    
    saveData();
    updateUI();
    alert(`Success! Interest of ₦${interest} added to your balance.`);
}

function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = "";
    currentUser.fixedDeposits.forEach(d => {
        const isMatured = new Date() > new Date(d.maturity);
        body.innerHTML += `
            <tr>
                <td>₦${d.amount}</td>
                <td>₦${d.interest}</td>
                <td>${new Date(d.maturity).toLocaleDateString()}</td>
                <td>
                    <button onclick="liquidate(${d.id})" class="${isMatured ? 'matured-btn' : 'early-btn'}">
                        ${isMatured ? 'Withdraw' : 'End Early'}
                    </button>
                </td>
            </tr>
        `;
    });
}

function liquidate(id) {
    const index = currentUser.fixedDeposits.findIndex(d => d.id === id);
    const dep = currentUser.fixedDeposits[index];
    const isMatured = new Date() > new Date(dep.maturity);

    if (!isMatured) {
        const penalty = dep.interest * 0.40;
        if (!confirm(`Early liquidation attracts 40% penalty on interest (₦${penalty}). Proceed?`)) return;
        currentUser.balance -= penalty; // Deduct penalty because interest was already paid
    }

    currentUser.balance += dep.amount;
    currentUser.fixedBalance -= dep.amount;
    currentUser.fixedDeposits.splice(index, 1);
    
    addHistory("Liquidation", `Closed Fix: ₦${dep.amount}`, dep.amount);
    saveData();
    updateUI();
}

// Shares
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const pricePerUnit = 500; 
    const total = qty * pricePerUnit;

    if (isNaN(qty) || qty <= 0) return alert("Enter valid units");
    if (total > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= total;
    currentUser.shares.push({
        units: qty,
        price: pricePerUnit,
        total: total,
        date: new Date().toISOString(),
        dividend: "12% Annually"
    });

    addHistory("Investment", `Bought ${qty} share units`, total);
    saveData();
    updateUI();
    alert("Shares purchased successfully!");
}

function renderShares() {
    const body = document.getElementById('shares-list-body');
    body.innerHTML = "";
    currentUser.shares.forEach(s => {
        body.innerHTML += `
            <tr>
                <td>${s.units}</td>
                <td>₦${s.total}</td>
                <td>${new Date().toLocaleDateString()}</td>
            </tr>
        `;
    });
}

// --- HELPERS ---

function generateRef() {
    // Generate 24 digit OPay style transaction number
    return Math.random().toString().slice(2, 14) + Math.random().toString().slice(2, 14);
}

function addHistory(type, desc, amt, ref = null) {
    currentUser.history.unshift({
        type, 
        desc, 
        amt, 
        ref: ref || generateRef().slice(0,10),
        date: new Date().toLocaleString()
    });
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = currentUser.history.length === 0 ? "<p>No transactions yet</p>" : "";
    currentUser.history.forEach(h => {
        container.innerHTML += `
            <div class="history-item">
                <div class="h-info">
                    <strong>${h.type}: ${h.desc}</strong>
                    <small>${h.date}</small>
                </div>
                <div class="h-amt ${h.type === 'Credit' || h.type === 'Liquidation' ? 'txt-green' : 'txt-red'}">
                    ${h.type === 'Credit' || h.type === 'Liquidation' ? '+' : '-'}₦${h.amt.toLocaleString()}
                </div>
            </div>
        `;
    });
}

function toggleFixedVisibility() {
    const eye = document.getElementById('toggle-eye');
    const text = document.getElementById('fixed-bal-text');
    if (text.innerText === "****") {
        text.innerText = `₦${currentUser.fixedBalance.toLocaleString()}`;
        eye.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        text.innerText = "****";
        eye.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// --- RECEIPT & DOWNLOADS ---

function showReceipt(to, amt, remark, ref) {
    document.getElementById('r-amount').innerText = `₦${amt.toLocaleString()}`;
    document.getElementById('r-recipient').innerText = to;
    document.getElementById('r-sender').innerText = currentUser.name;
    document.getElementById('r-remark').innerText = remark;
    document.getElementById('r-ref').innerText = ref;
    document.getElementById('r-date').innerText = new Date().toLocaleString();
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }

async function downloadReceipt(type) {
    const element = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    if (type === 'image') {
        const link = document.createElement('a');
        link.download = `GrowPay-Receipt-${Date.now()}.png`;
        link.href = imgData;
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        pdf.save(`GrowPay-Receipt-${Date.now()}.pdf`);
    }
}
