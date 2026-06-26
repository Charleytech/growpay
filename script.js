// Initial Data State
let user = JSON.parse(localStorage.getItem('growpay_user')) || {
    name: "",
    password: "",
    accountNumber: "",
    balance: 0,
    fixed: [],
    shares: [],
    history: []
};

window.onload = () => {
    if (user.name && user.accountNumber) {
        showDashboard();
    }
};

// --- AUTHENTICATION ---

function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const pass = document.getElementById('reg-pass').value;

    if (name.length < 3) return alert("Enter a valid name");
    if (bvn.length !== 11) return alert("BVN/NIN must be 11 digits");
    
    // Password Validation: Must be exactly 6 digits
    if (!/^\d{6}$/.test(pass)) {
        return alert("Password must be exactly 6 numbers");
    }

    // Generate 10-digit Account Number
    const generatedAcc = Math.floor(Math.random() * 9000000000) + 1000000000;

    user = {
        name: name,
        password: pass,
        accountNumber: generatedAcc,
        balance: 0,
        fixed: [],
        shares: [],
        history: []
    };

    saveAndRefresh();
    showDashboard();
}

function login() {
    const name = document.getElementById('login-name').value;
    const pass = document.getElementById('login-pass').value;

    if (user.name === name && user.password === pass) {
        showDashboard();
    } else {
        alert("Invalid Login Credentials");
    }
}

function showDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

// --- CORE UI UPDATES ---

function updateUI() {
    document.getElementById('avail-bal').innerText = `₦${user.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('user-display').innerHTML = `
        <div style="text-align:right">
            <strong>${user.name}</strong><br>
            <small style="color:var(--primary)">${user.accountNumber}</small>
        </div>
    `;
    renderFixedTable();
    renderSharesTable();
    renderHistory();
}

function saveAndRefresh() {
    localStorage.setItem('growpay_user', JSON.stringify(user));
}

// --- FUNDING WALLET ---

function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);

    if (pin !== "0000") return alert("Wrong Admin PIN!"); // Default Admin PIN
    if (isNaN(amt) || amt <= 0) return alert("Enter valid amount");

    user.balance += amt;
    user.history.unshift({
        type: 'Wallet Funding',
        amount: amt,
        recipient: 'Self',
        ref: generateRef(),
        date: new Date().toLocaleString(),
        remark: 'Admin Credit'
    });

    saveAndRefresh();
    updateUI();
    closeModal();
    alert(`Successfully funded ₦${amt}`);
}

// --- TRANSFER & RECEIPTS ---

function generateRef() {
    // Generates exactly 24 random numbers
    let ref = "";
    for(let i=0; i<24; i++) ref += Math.floor(Math.random() * 10);
    return ref;
}

function processTransfer() {
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const recipient = document.getElementById('trans-name').value;
    
    if (amount > user.balance || isNaN(amount)) return alert("Insufficient Balance");

    user.balance -= amount;
    const tx = {
        type: 'Transfer',
        amount: amount,
        recipient: recipient,
        ref: generateRef(),
        date: new Date().toLocaleString(),
        remark: document.getElementById('trans-remark').value || "Transfer"
    };

    user.history.unshift(tx);
    saveAndRefresh();
    updateUI();
    showReceipt(tx);
}

function showReceipt(tx) {
    document.getElementById('r-amount').innerText = `₦${tx.amount.toLocaleString()}`;
    document.getElementById('r-recipient').innerText = tx.recipient;
    document.getElementById('r-sender').innerText = user.name;
    document.getElementById('r-remark').innerText = tx.remark;
    document.getElementById('r-ref').innerText = tx.ref;
    document.getElementById('r-date').innerText = tx.date;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

// --- FIXED DEPOSIT LOGIC ---

function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorSelect = document.getElementById('fix-tenor');
    const days = parseInt(tenorSelect.value);
    const rate = parseInt(tenorSelect.options[tenorSelect.selectedIndex].dataset.rate);

    if (amt > user.balance || isNaN(amt)) return alert("Insufficient Funds");

    user.balance -= amt;
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + days);

    user.fixed.push({
        id: Date.now(),
        amount: amt,
        rate: rate,
        interest: (amt * (rate/100)),
        tenor: days,
        expiry: maturityDate.toLocaleDateString()
    });

    saveAndRefresh();
    updateUI();
}

function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = user.fixed.map(f => `
        <tr>
            <td>₦${f.amount}</td>
            <td>₦${f.interest} (${f.rate}%)</td>
            <td>${f.expiry}</td>
            <td>
                <button onclick="topUpFixed(${f.id})" style="background:orange; padding:5px; font-size:10px;">Top-Up</button>
                <button onclick="liquidate(${f.id})" style="background:red; padding:5px; font-size:10px; margin-top:2px;">End</button>
            </td>
        </tr>
    `).join('');
}

function topUpFixed(id) {
    const extra = parseFloat(prompt("Enter amount to add to this fixed deposit:"));
    if (extra > user.balance) return alert("Insufficient balance");
    
    const item = user.fixed.find(f => f.id === id);
    user.balance -= extra;
    item.amount += extra;
    item.interest = (item.amount * (item.rate/100)); // Recalculate interest
    saveAndRefresh();
    updateUI();
}

function liquidate(id) {
    if (!confirm("Ending early attracts 40% penalty on interest. Continue?")) return;
    const idx = user.fixed.findIndex(f => f.id === id);
    const item = user.fixed[idx];
    
    const penalty = item.interest * 0.40;
    const payout = item.amount + (item.interest - penalty);
    
    user.balance += payout;
    user.fixed.splice(idx, 1);
    saveAndRefresh();
    updateUI();
}

// --- SHARES & HISTORY ---

function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const total = qty * 500;
    if (total > user.balance) return alert("Insufficient Funds");

    user.balance -= total;
    user.shares.push({ units: qty, value: total, maturity: "12 Months" });
    saveAndRefresh();
    updateUI();
}

function renderSharesTable() {
    document.getElementById('shares-list-body').innerHTML = user.shares.map(s => `
        <tr><td>${s.units} Units</td><td>₦${s.value}</td><td>${s.maturity}</td></tr>
    `).join('');
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = user.history.map(h => `
        <div style="border-bottom:1px solid #eee; padding:10px; font-size:12px;">
            <strong>${h.type}</strong> <span style="float:right; color:${h.type.includes('Transfer')?'red':'green'}">₦${h.amount.toLocaleString()}</span><br>
            <small>${h.date} • ${h.recipient}</small>
        </div>
    `).join('');
}

// --- DOWNLOADS ---

async function downloadReceipt(type) {
    const area = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(area);
    const imgData = canvas.toDataURL('image/png');

    if (type === 'image') {
        const link = document.createElement('a');
        link.download = 'GrowPay-Receipt.png';
        link.href = imgData;
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 15, 15, 100, 150);
        pdf.save('GrowPay-Receipt.pdf');
    }
}

// UI Helpers
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function logout() { localStorage.clear(); location.reload(); }
function toggleFixedVisibility() {
    const txt = document.getElementById('fixed-bal-text');
    const total = user.fixed.reduce((sum, f) => sum + f.amount, 0);
    txt.innerText = txt.innerText === "****" ? `₦${total.toLocaleString()}` : "****";
}
