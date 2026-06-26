// --- STATE MANAGEMENT ---
let user = {
    name: "",
    accNo: "",
    password: "",
    balance: 0,
    fixed: [], // {id, amount, interest, expiryDate, rawExpiry}
    shares: [],
    history: []
};

// --- INITIALIZATION ---
window.onload = () => {
    const savedUser = localStorage.getItem('growpay_user');
    const remembered = localStorage.getItem('growpay_remember');

    if (remembered && savedUser) {
        user = JSON.parse(savedUser);
        goToDashboard();
    }
};

// --- AUTHENTICATION ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const pass = document.getElementById('reg-pass').value;
    const isLogin = !document.getElementById('login-form').classList.contains('hidden');

    if (isLogin) {
        handleLogin();
        return;
    }

    // Validation
    if (name.length < 3) return alert("Enter a valid name");
    if (pass.length !== 6 || isNaN(pass)) return alert("Password must be exactly 6 numbers");

    // Generate Account Number
    const generatedAcc = Math.floor(1000000000 + Math.random() * 9000000000);

    user = {
        name: name,
        accNo: generatedAcc,
        password: pass,
        balance: 0,
        fixed: [],
        shares: [],
        history: []
    };

    alert(`Account Created! Your Account Number is: ${generatedAcc}`);
    saveAndRefresh();
    goToDashboard();
}

function handleLogin() {
    const name = document.getElementById('login-name').value;
    const pass = document.getElementById('login-pass').value;
    const savedUser = JSON.parse(localStorage.getItem('growpay_user'));

    if (savedUser && name === savedUser.name && pass === savedUser.password) {
        user = savedUser;
        localStorage.setItem('growpay_remember', 'true');
        goToDashboard();
    } else {
        alert("Invalid Credentials");
    }
}

function logout() {
    localStorage.removeItem('growpay_remember');
    location.reload();
}

// --- NAVIGATION ---
function goToDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// --- CORE UPDATES ---
function updateUI() {
    checkMaturity(); // Auto-check if fixed deposits are done

    document.getElementById('avail-bal').innerText = `₦${user.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('user-display').innerHTML = `${user.name} <br> <small style="color:var(--primary)">${user.accNo}</small>`;
    
    renderFixedTable();
    renderSharesTable();
    renderHistory();
    localStorage.setItem('growpay_user', JSON.stringify(user));
}

function saveAndRefresh() {
    localStorage.setItem('growpay_user', JSON.stringify(user));
}

// --- FIXED DEPOSIT LOGIC (8% Interest) ---
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorDays = parseInt(document.getElementById('fix-tenor').value);

    if (isNaN(amt) || amt > user.balance || amt <= 0) return alert("Insufficient Balance");

    user.balance -= amt;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + tenorDays);

    const newFix = {
        id: Date.now(),
        amount: amt,
        interest: amt * 0.08, // Fixed at 8%
        expiryDate: expiryDate.toLocaleDateString(),
        rawExpiry: expiryDate.getTime()
    };

    user.fixed.push(newFix);
    user.history.unshift({ type: 'Fixed Deposit', amount: amt, date: new Date().toLocaleString() });
    updateUI();
}

function checkMaturity() {
    const now = new Date().getTime();
    let maturedCount = 0;

    user.fixed = user.fixed.filter(item => {
        if (now >= item.rawExpiry) {
            const totalReturn = item.amount + item.interest;
            user.balance += totalReturn;
            user.history.unshift({ type: 'Fixed Maturity', amount: totalReturn, date: new Date().toLocaleString() });
            maturedCount++;
            return false; // Remove from fixed list
        }
        return true;
    });

    if (maturedCount > 0) alert(`${maturedCount} Fixed Deposit(s) matured and paid to balance!`);
}

function liquidate(id) {
    if (!confirm("Early liquidation attracts 40% penalty on interest. Proceed?")) return;
    const idx = user.fixed.findIndex(f => f.id === id);
    const item = user.fixed[idx];
    
    // Penalty: 40% of the 8% interest is removed
    const penalty = item.interest * 0.4;
    const payout = item.amount + (item.interest - penalty);
    
    user.balance += payout;
    user.fixed.splice(idx, 1);
    updateUI();
}

function topUpFixed(id) {
    const extra = parseFloat(prompt("Enter amount to add to this fix:"));
    if (isNaN(extra) || extra > user.balance || extra <= 0) return alert("Invalid amount");
    
    const item = user.fixed.find(f => f.id === id);
    user.balance -= extra;
    item.amount += extra;
    item.interest = item.amount * 0.08; // Re-calculate 8%
    updateUI();
}

// --- TRANSFER & RECEIPT ---
function processTransfer() {
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const recipient = document.getElementById('trans-name').value;
    
    if (isNaN(amount) || amount > user.balance || amount <= 0) return alert("Invalid Transaction");

    user.balance -= amount;
    
    // Generate 24 random numbers
    let ref = "";
    for(let i=0; i<24; i++) ref += Math.floor(Math.random() * 10);

    const tx = {
        type: 'Transfer',
        amount: amount,
        recipient: recipient,
        ref: ref,
        date: new Date().toLocaleString(),
        remark: document.getElementById('trans-remark').value || "Transfer"
    };

    user.history.unshift(tx);
    showReceipt(tx);
    updateUI();
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

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }

async function downloadReceipt(type) {
    const area = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(area, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    if (type === 'image') {
        const link = document.createElement('a');
        link.download = `GrowPay-${Date.now()}.png`;
        link.href = imgData;
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 10, 10, 100, 150);
        pdf.save(`GrowPay-${Date.now()}.pdf`);
    }
}

// --- SHARES & WALLET ---
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * 500;
    if (isNaN(qty) || cost > user.balance) return alert("Check balance/input");
    
    user.balance -= cost;
    user.shares.push({ units: qty, value: cost, date: "1 Year Maturity" });
    updateUI();
}

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    if (pin === "0000" && !isNaN(amt)) {
        user.balance += amt;
        alert("Wallet Funded!");
        closeModal();
        updateUI();
    } else alert("Invalid PIN");
}

// --- RENDER HELPERS ---
function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = user.fixed.map(f => `
        <tr>
            <td>₦${f.amount.toLocaleString()}</td>
            <td>₦${f.interest.toLocaleString()}</td>
            <td>${f.expiryDate}</td>
            <td>
                <button onclick="topUpFixed(${f.id})" style="padding:4px; margin-bottom:2px; background:orange; font-size:10px">Top-Up</button>
                <button onclick="liquidate(${f.id})" style="padding:4px; background:red; font-size:10px">End</button>
            </td>
        </tr>
    `).join('');
}

function renderSharesTable() {
    document.getElementById('shares-list-body').innerHTML = user.shares.map(s => `
        <tr><td>${s.units}</td><td>₦${s.value}</td><td>${s.date}</td></tr>
    `).join('');
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = user.history.map(h => `
        <div style="border-bottom:1px solid #eee; padding:10px; display:flex; justify-content:space-between">
            <div><b>${h.type}</b><br><small>${h.date}</small></div>
            <div style="color:${h.type.includes('Transfer')?'red':'green'}">₦${h.amount.toLocaleString()}</div>
        </div>
    `).join('');
}

// UI Modals
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

let fixedVisible = false;
function toggleFixedVisibility() {
    fixedVisible = !fixedVisible;
    const total = user.fixed.reduce((sum, f) => sum + f.amount, 0);
    document.getElementById('fixed-bal-text').innerText = fixedVisible ? `₦${total.toLocaleString()}` : "****";
}
