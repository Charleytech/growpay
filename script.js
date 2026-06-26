let currentUser = null;
let isFixedVisible = false;
const ADMIN_PIN = "4455";
const SHARE_PRICE = 500;

// --- Authentication ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-pass').value;

    if (!name || bvn.length < 11 || !pass) return alert("Please fill all fields correctly.");

    const accNo = "30" + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 8);
    const user = {
        name, bvn, address, pass, accNo,
        balance: 0,
        fixedDeposits: [], // Array of objects
        shares: 0,
        transactions: []
    };

    localStorage.setItem(accNo, JSON.stringify(user));
    alert(`Account Created! Account Number: ${accNo}`);
    showLogin();
}

function login() {
    const id = document.getElementById('login-id').value;
    const pass = document.getElementById('login-pass').value;
    const userData = localStorage.getItem(id);

    if (userData) {
        const user = JSON.parse(userData);
        if (user.pass === pass) {
            currentUser = user;
            checkMaturities(); // Check for expired deposits on login
            loadDashboard();
        } else alert("Invalid Password");
    } else alert("User not found");
}

// --- Dashboard Logic ---
function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUser.name.split(' ')[0];
    updateUI();
}

function updateUI() {
    // Calculate total fixed balance
    const totalFixed = currentUser.fixedDeposits.reduce((sum, d) => sum + d.amount, 0);
    
    document.getElementById('avail-bal').innerText = `₦${currentUser.balance.toLocaleString()}`;
    document.getElementById('fixed-bal-text').innerText = isFixedVisible ? `₦${totalFixed.toLocaleString()}` : "****";
    
    renderFixedTable();
    renderSharesTable();
    renderHistory();
    saveData();
}

function checkMaturities() {
    const now = new Date().getTime();
    let updated = false;

    currentUser.fixedDeposits = currentUser.fixedDeposits.filter(deposit => {
        if (now >= deposit.expiry) {
            currentUser.balance += deposit.amount;
            currentUser.transactions.push({
                type: "Maturity Inflow",
                amount: deposit.amount,
                date: new Date().toLocaleString(),
                ref: "MAT-" + Date.now()
            });
            updated = true;
            return false; // Remove from fixed
        }
        return true;
    });

    if (updated) saveData();
}

// --- Fixed Deposit Feature ---
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorSelect = document.getElementById('fix-tenor');
    const days = parseInt(tenorSelect.value);
    const rate = parseInt(tenorSelect.options[tenorSelect.selectedIndex].dataset.rate);

    if (isNaN(amt) || amt < 500) return alert("Minimum fix amount is ₦500");
    if (amt > currentUser.balance) return alert("Insufficient Balance");

    const interest = amt * (rate / 100);
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + days);

    const newDeposit = {
        id: Date.now(),
        amount: amt,
        interest: interest,
        rate: rate,
        startDate: now.toLocaleDateString(),
        expiry: expiry.getTime(),
        expiryDate: expiry.toLocaleDateString()
    };

    // Logic: Deduct principal, add interest to available immediately
    currentUser.balance -= amt;
    currentUser.balance += interest;
    currentUser.fixedDeposits.push(newDeposit);

    currentUser.transactions.push({
        type: "Fixed Deposit",
        amount: amt,
        date: new Date().toLocaleString(),
        ref: "FIX-" + Date.now()
    });

    alert(`Success! ₦${interest} interest added to your wallet. Principal locked until ${newDeposit.expiryDate}`);
    updateUI();
}

function renderFixedTable() {
    const tbody = document.getElementById('fixed-list-body');
    tbody.innerHTML = "";

    currentUser.fixedDeposits.forEach(d => {
        const row = `<tr>
            <td>₦${d.amount}</td>
            <td>₦${d.interest} (${d.rate}%)</td>
            <td>${d.expiryDate}</td>
            <td><button class="fund-btn" style="background:#ff5252" onclick="liquidate(${d.id})">End</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function liquidate(id) {
    if (!confirm("Liquidation attracts 40% interest penalty. Continue?")) return;

    const idx = currentUser.fixedDeposits.findIndex(d => d.id === id);
    const deposit = currentUser.fixedDeposits[idx];
    
    const penalty = deposit.interest * 0.4;
    const refund = deposit.amount - penalty;

    currentUser.balance += refund;
    currentUser.fixedDeposits.splice(idx, 1);
    
    alert(`Liquidation successful. ₦${penalty} was charged. ₦${refund} returned to wallet.`);
    updateUI();
}

// --- Shares Feature ---
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    if (isNaN(qty) || qty <= 0) return alert("Enter valid quantity");
    
    const totalCost = qty * SHARE_PRICE;
    if (totalCost > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= totalCost;
    currentUser.shares += qty;

    currentUser.transactions.push({
        type: "Shares Purchase",
        amount: totalCost,
        date: new Date().toLocaleString(),
        ref: "SHR-" + Date.now()
    });

    updateUI();
}

function renderSharesTable() {
    const tbody = document.getElementById('shares-list-body');
    const value = currentUser.shares * SHARE_PRICE;
    const dividend = value * 0.12; // 12% yearly

    tbody.innerHTML = `<tr>
        <td>${currentUser.shares} Units</td>
        <td>₦${value.toLocaleString()}</td>
        <td>₦${(dividend/12).toFixed(2)} (Monthly)</td>
    </tr>`;
}

// --- Admin & Utils ---
function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    
    if (pin === ADMIN_PIN && amt > 0) {
        currentUser.balance += amt;
        currentUser.transactions.push({
            type: "Wallet Funding",
            amount: amt,
            recipient: "Wallet",
            sender: "Admin",
            remark: "Funding",
            date: new Date().toLocaleString(),
            ref: "ADM-" + Math.random().toString(36).substr(2, 9).toUpperCase()
        });
        updateUI();
        closeModal();
    } else alert("Invalid PIN");
}

function processTransfer() {
    const name = document.getElementById('trans-name').value;
    const amt = parseFloat(document.getElementById('trans-amount').value);
    
    if (amt > currentUser.balance) return alert("Insufficient Funds");
    if (!name || amt <= 0) return alert("Invalid inputs");

    currentUser.balance -= amt;
    const tx = {
        type: "Transfer",
        amount: amt,
        recipient: name,
        sender: currentUser.name,
        remark: document.getElementById('trans-remark').value || "None",
        date: new Date().toLocaleString(),
        ref: "TX-" + Math.random().toString(36).substr(2, 12).toUpperCase()
    };
    
    currentUser.transactions.push(tx);
    showReceipt(tx);
    updateUI();
}

function showReceipt(tx) {
    document.getElementById('r-amount').innerText = `₦${tx.amount.toLocaleString()}`;
    document.getElementById('r-recipient').innerText = tx.recipient;
    document.getElementById('r-sender').innerText = tx.sender;
    document.getElementById('r-remark').innerText = tx.remark;
    document.getElementById('r-date').innerText = tx.date;
    document.getElementById('r-ref').innerText = tx.ref;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = "";
    [...currentUser.transactions].reverse().forEach(tx => {
        container.innerHTML += `<div class="history-item">
            <div>
                <h4>${tx.type}</h4>
                <p>${tx.date}</p>
            </div>
            <div style="text-align:right">
                <p><strong>₦${tx.amount.toLocaleString()}</strong></p>
                <p style="color:var(--accent)">Success</p>
            </div>
        </div>`;
    });
}

// Helpers
function saveData() { localStorage.setItem(currentUser.accNo, JSON.stringify(currentUser)); }
function showSignup() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); }
function showLogin() { document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }
function logout() { location.reload(); }
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }
function toggleFixedVisibility() { isFixedVisible = !isFixedVisible; updateUI(); }
function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

async function downloadReceipt(type) {
    const element = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(element);
    const link = document.createElement('a');
    link.download = `GrowPay-Receipt-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}
