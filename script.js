// --- CONFIGURATION & STATE ---
let currentUser = JSON.parse(localStorage.getItem('growpay_user')) || null;
const ADMIN_PIN = "1234"; // Admin PIN for funding

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    checkRememberMe();
    if (currentUser) {
        showDashboard();
    }
    // Background check for fixed deposit maturity every 5 seconds
    setInterval(processMaturityLogic, 5000);
});

// --- AUTHENTICATION ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-pass').value;

    if (pass.length !== 6 || isNaN(pass)) {
        alert("Password must be exactly 6 numbers.");
        return;
    }
    if (bvn.length !== 11) {
        alert("BVN/NIN must be 11 digits.");
        return;
    }

    const accNo = Math.floor(1000000000 + Math.random() * 9000000000);
    
    currentUser = {
        name,
        pass,
        accNo,
        balance: 0,
        fixedBalance: 0,
        fixedDeposits: [],
        shares: [],
        history: []
    };

    saveAndRefresh();
    showDashboard();
}

function login() {
    const name = document.getElementById('login-name').value;
    const pass = document.getElementById('login-pass').value;
    const remember = true; // Set to true for demo, or link to a checkbox

    if (currentUser && currentUser.name === name && currentUser.pass === pass) {
        if (remember) localStorage.setItem('growpay_remember', 'true');
        showDashboard();
    } else {
        alert("Invalid Credentials");
    }
}

function checkRememberMe() {
    const isRemembered = localStorage.getItem('growpay_remember');
    if (isRemembered === 'true' && currentUser) {
        showDashboard();
    }
}

function logout() {
    localStorage.removeItem('growpay_remember');
    location.reload();
}

// --- UI CONTROLS ---
function showDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('user-display').innerText = `${currentUser.name} | Acct: ${currentUser.accNo}`;
    updateUI();
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function updateUI() {
    document.getElementById('avail-bal').innerText = formatMoney(currentUser.balance);
    const fixedText = document.getElementById('fixed-bal-text');
    if (fixedText.innerText !== "****") {
        fixedText.innerText = formatMoney(currentUser.fixedBalance);
    }
    
    renderFixedTable();
    renderSharesTable();
    renderHistory();
    localStorage.setItem('growpay_user', JSON.stringify(currentUser));
}

function formatMoney(amt) {
    return '₦' + parseFloat(amt).toLocaleString(undefined, {minimumFractionDigits: 2});
}

// --- CORE BANKING FEATURES ---

// Admin Funding
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);

    if (pin === ADMIN_PIN && amt > 0) {
        currentUser.balance += amt;
        addHistory("Wallet Funding", amt, "Success");
        saveAndRefresh();
        closeModal();
        alert("Wallet Funded Successfully!");
    } else {
        alert("Incorrect Admin PIN");
    }
}

// Transfers
function processTransfer() {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const name = document.getElementById('trans-name').value;
    const remark = document.getElementById('trans-remark').value;

    if (amt > currentUser.balance) return alert("Insufficient Balance");
    if (amt <= 0) return alert("Enter valid amount");

    currentUser.balance -= amt;
    const ref = generateRef();
    addHistory(`Transfer to ${name}`, -amt, "Success", ref);
    
    showReceipt(name, amt, remark, ref);
    saveAndRefresh();
}

// Fixed Deposit Logic
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorDays = parseInt(document.getElementById('fix-tenor').value);
    
    if (amt > currentUser.balance) return alert("Insufficient Balance");
    
    const interest = amt * 0.08; // 8% fixed interest
    const maturityDate = new Date();
    maturityDate.setSeconds(maturityDate.getSeconds() + (tenorDays)); // Using seconds for demo, change to setDate for days

    const deposit = {
        id: Date.now(),
        amount: amt,
        interest: interest,
        tenor: tenorDays,
        startDate: new Date().toISOString(),
        expiry: maturityDate.toISOString(),
        status: 'Active'
    };

    currentUser.balance -= amt;
    currentUser.fixedBalance += amt;
    currentUser.fixedDeposits.push(deposit);
    saveAndRefresh();
}

function processMaturityLogic() {
    if (!currentUser) return;
    let changed = false;
    const now = new Date();

    currentUser.fixedDeposits.forEach((dep, index) => {
        if (dep.status === 'Active' && now >= new Date(dep.expiry)) {
            const totalReturn = dep.amount + dep.interest;
            currentUser.balance += totalReturn;
            currentUser.fixedBalance -= dep.amount;
            dep.status = 'Completed';
            addHistory("Fixed Deposit Maturity", totalReturn, "Success");
            changed = true;
        }
    });

    if (changed) saveAndRefresh();
}

function liquidateEarly(id) {
    const idx = currentUser.fixedDeposits.findIndex(d => d.id === id);
    const dep = currentUser.fixedDeposits[idx];
    
    if (confirm("Early liquidation attracts 40% penalty on interest. Continue?")) {
        const penalty = dep.interest * 0.40;
        const payout = dep.amount + (dep.interest - penalty);
        
        currentUser.balance += payout;
        currentUser.fixedBalance -= dep.amount;
        currentUser.fixedDeposits.splice(idx, 1);
        addHistory("Early Liquidation", payout, "Success");
        saveAndRefresh();
    }
}

// Shares Logic
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const price = 500;
    const total = qty * price;

    if (total > currentUser.balance) return alert("Insufficient Balance");

    const maturity = new Date();
    maturity.setFullYear(maturity.getFullYear() + 1);

    currentUser.shares.push({
        units: qty,
        value: total,
        dividend: total * 0.12,
        maturity: maturity.toLocaleDateString()
    });

    currentUser.balance -= total;
    addHistory(`Bought ${qty} Shares`, -total, "Success");
    saveAndRefresh();
}

// --- RECEIPT & UTILS ---
function generateRef() {
    let ref = "";
    for(let i=0; i<24; i++) ref += Math.floor(Math.random()*10);
    return ref;
}

function showReceipt(name, amt, remark, ref) {
    document.getElementById('r-amount').innerText = formatMoney(amt);
    document.getElementById('r-recipient').innerText = name;
    document.getElementById('r-sender').innerText = currentUser.name;
    document.getElementById('r-remark').innerText = remark || "None";
    document.getElementById('r-ref').innerText = ref;
    document.getElementById('r-date').innerText = new Date().toLocaleString();
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }

async function downloadReceipt(type) {
    const element = document.getElementById('receipt-capture-area');
    if (type === 'image') {
        const canvas = await html2canvas(element);
        const link = document.createElement('a');
        link.download = `GrowPay-Receipt-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(element);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        pdf.addImage(imgData, 'PNG', 10, 10, 180, 150);
        pdf.save(`GrowPay-Receipt-${Date.now()}.pdf`);
    }
}

function toggleFixedVisibility() {
    const el = document.getElementById('fixed-bal-text');
    const eye = document.getElementById('toggle-eye');
    if (el.innerText === "****") {
        el.innerText = formatMoney(currentUser.fixedBalance);
        eye.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        el.innerText = "****";
        eye.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// --- RENDERERS ---
function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = currentUser.fixedDeposits.map(dep => `
        <tr>
            <td>${formatMoney(dep.amount)}</td>
            <td>8% (${formatMoney(dep.interest)})</td>
            <td>${new Date(dep.expiry).toLocaleDateString()}</td>
            <td>
                ${dep.status === 'Active' ? 
                `<button onclick="liquidateEarly(${dep.id})" style="background:red; color:white; border:none; padding:4px; font-size:10px;">End</button>` : 
                'Completed'}
            </td>
        </tr>
    `).join('');
}

function renderSharesTable() {
    const body = document.getElementById('shares-list-body');
    body.innerHTML = currentUser.shares.map(s => `
        <tr>
            <td>${s.units}</td>
            <td>${formatMoney(s.value)}</td>
            <td>${s.maturity} (Div: ${formatMoney(s.dividend)})</td>
        </tr>
    `).join('');
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = currentUser.history.map(h => `
        <div class="history-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
            <div>
                <small>${h.date}</small>
                <p><strong>${h.type}</strong></p>
            </div>
            <div style="text-align:right">
                <p style="color: ${h.amount < 0 ? 'red' : 'green'}">${formatMoney(h.amount)}</p>
                <small>${h.status}</small>
            </div>
        </div>
    `).reverse().join('');
}

function addHistory(type, amount, status, ref = "") {
    currentUser.history.push({
        date: new Date().toLocaleString(),
        type,
        amount,
        status,
        ref
    });
}

function saveAndRefresh() {
    localStorage.setItem('growpay_user', JSON.stringify(currentUser));
    updateUI();
}
