// Initial State
let user = JSON.parse(localStorage.getItem('growpay_user')) || {
    name: "",
    password: "",
    accountNumber: "",
    balance: 0,
    fixed: [],
    shares: [],
    history: []
};

// Check for "Remember Me" on load
window.onload = () => {
    const remembered = localStorage.getItem('remembered_login');
    if (remembered === "true" && user.name) {
        showDashboard();
    }
    checkMaturity(); // Auto-check for interest payouts
    updateUI();
};

// --- AUTHENTICATION ---

function signup() {
    const name = document.getElementById('reg-name').value;
    const pass = document.getElementById('reg-pass').value;
    const rememberMe = true; // You can link this to a checkbox if added

    if (!name || pass.length !== 6 || isNaN(pass)) {
        alert("Name required and Password must be exactly 6 numbers.");
        return;
    }

    // Generate 10-digit account number
    const accNo = Math.floor(1000000000 + Math.random() * 9000000000);
    
    user.name = name;
    user.password = pass;
    user.accountNumber = accNo;
    
    localStorage.setItem('remembered_login', "true");
    saveAndRefresh();
    showDashboard();
}

function login() {
    const name = document.getElementById('login-name').value;
    const pass = document.getElementById('login-pass').value;

    if (user.name === name && user.password === pass) {
        localStorage.setItem('remembered_login', "true");
        showDashboard();
    } else {
        alert("Invalid credentials");
    }
}

function showDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

// --- CORE FUNCTIONALITY ---

function updateUI() {
    document.getElementById('avail-bal').innerText = `₦${user.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('user-display').innerText = `${user.name} (${user.accountNumber})`;
    
    renderFixedTable();
    renderSharesTable();
    renderHistory();
}

function saveAndRefresh() {
    localStorage.setItem('growpay_user', JSON.stringify(user));
    updateUI();
}

// Admin Funding
function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    if (pin === "0000" && amt > 0) {
        user.balance += amt;
        user.history.unshift({ type: 'Credit', amount: amt, date: new Date().toLocaleString(), recipient: 'Self' });
        saveAndRefresh();
        closeModal();
        alert("Wallet Funded Successfully");
    } else {
        alert("Invalid Admin PIN");
    }
}

// --- FIXED DEPOSIT SYSTEM ---

function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const days = parseInt(document.getElementById('fix-tenor').value);
    
    if (amt > user.balance || amt <= 0) return alert("Insufficient balance");

    user.balance -= amt;
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + days);

    const deposit = {
        id: Date.now(),
        principal: amt,
        interest: amt * 0.08, // Fixed 8%
        tenure: days,
        expiry: maturityDate.getTime(),
        status: 'active'
    };

    user.fixed.push(deposit);
    saveAndRefresh();
}

// Automatic Payout Logic
function checkMaturity() {
    const now = new Date().getTime();
    let updated = false;

    user.fixed.forEach((f, index) => {
        if (f.status === 'active' && now >= f.expiry) {
            // Maturity reached: Principal + Interest drops to balance
            user.balance += (f.principal + f.interest);
            f.status = 'matured';
            user.history.unshift({ 
                type: 'Fixed Payout', 
                amount: f.principal + f.interest, 
                date: new Date().toLocaleString(), 
                recipient: 'Main Wallet' 
            });
            updated = true;
        }
    });

    if (updated) saveAndRefresh();
}

function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = user.fixed.map(f => `
        <tr style="background: ${f.status === 'matured' ? '#e8f5e9' : 'white'}">
            <td>₦${f.principal.toLocaleString()}</td>
            <td>₦${f.interest.toLocaleString()} (8%)</td>
            <td>${new Date(f.expiry).toLocaleDateString()}</td>
            <td>
                ${f.status === 'active' ? 
                    `<button onclick="liquidate(${f.id})" style="padding:4px; background:red; font-size:10px">End</button>` : 
                    `<span style="color:green; font-weight:bold">Paid Out</span>`
                }
            </td>
        </tr>
    `).join('');
}

function liquidate(id) {
    if (!confirm("Ending early costs 40% of interest. Proceed?")) return;
    const idx = user.fixed.findIndex(f => f.id === id);
    const f = user.fixed[idx];
    const penalty = f.interest * 0.4;
    user.balance += (f.principal + (f.interest - penalty));
    user.fixed.splice(idx, 1);
    saveAndRefresh();
}

// --- TRANSFERS & RECEIPTS ---

function processTransfer() {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const recp = document.getElementById('trans-name').value;
    
    if (amt > user.balance || amt <= 0) return alert("Insufficient Funds");

    // 24 Random Numbers for Reference
    const ref = Array.from({length: 24}, () => Math.floor(Math.random() * 10)).join('');

    user.balance -= amt;
    const tx = {
        type: 'Transfer',
        amount: amt,
        recipient: recp,
        ref: ref,
        remark: document.getElementById('trans-remark').value || "None",
        date: new Date().toLocaleString()
    };

    user.history.unshift(tx);
    saveAndRefresh();
    showReceipt(tx);
}

function showReceipt(tx) {
    document.getElementById('r-amount').innerText = `₦${tx.amount.toLocaleString()}`;
    document.getElementById('r-recipient').innerText = tx.recipient;
    document.getElementById('r-sender').innerText = user.name;
    document.getElementById('r-ref').innerText = tx.ref;
    document.getElementById('r-date').innerText = tx.date;
    document.getElementById('r-remark').innerText = tx.remark;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

// Download Handlers
async function downloadReceipt(type) {
    const area = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(area, { scale: 3 });
    const imgData = canvas.toDataURL('image/png');

    if (type === 'image') {
        const link = document.createElement('a');
        link.download = `GP-Receipt-${Date.now()}.png`;
        link.href = imgData;
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('GrowPay-Receipt.pdf');
    }
}

// Shares/History Helper
function renderSharesTable() {
    document.getElementById('shares-list-body').innerHTML = user.shares.map(s => `
        <tr><td>${s.units}</td><td>₦${s.value}</td><td>${s.date}</td></tr>
    `).join('');
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = user.history.map(h => `
        <div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <b style="font-size:14px">${h.type}</b><br>
                <small>${h.date}</small>
            </div>
            <span style="color:${h.type === 'Credit' || h.type === 'Fixed Payout' ? 'green' : 'red'}; font-weight:bold">
                ${h.type === 'Credit' || h.type === 'Fixed Payout' ? '+' : '-'}₦${h.amount.toLocaleString()}
            </span>
        </div>
    `).join('');
}

// Misc UI
function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }
function logout() {
    localStorage.setItem('remembered_login', "false");
    location.reload();
}

function toggleFixedVisibility() {
    const text = document.getElementById('fixed-bal-text');
    const total = user.fixed.reduce((s, f) => s + (f.status === 'active' ? f.principal : 0), 0);
    text.innerText = text.innerText === "****" ? `₦${total.toLocaleString()}` : "****";
}
