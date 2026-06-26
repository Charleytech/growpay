// --- CONFIGURATION & STATE ---
const ADMIN_PIN = "1234"; 
let currentUser = null;
let users = JSON.parse(localStorage.getItem('growpay_pro_users')) || [];

// Share Market Variables
let marketPrice = 240.50;
let marketChange = 1.2;

// --- 1. AUTHENTICATION LOGIC ---

// Step: Generate Account from Phone Number
function generateAccount() {
    const phone = document.getElementById('phone-input').value;
    if (phone.length < 10) return alert("Please enter a valid phone number");

    // Generate 10-digit account starting with 309
    const accNo = "309" + Math.floor(1000000 + Math.random() * 9000000);
    
    const newUser = {
        phone: phone,
        accountNumber: accNo,
        balance: 0,
        fixedBalance: 0,
        investments: [],
        sharesHistory: [],
        history: [] // This will store every transaction
    };

    users.push(newUser);
    saveData();

    document.getElementById('generated-no').innerText = accNo;
    switchStep('generate-step', 'display-step');
}

// Step: Login with Account Number
function unlockWallet() {
    const accInput = document.getElementById('access-acc').value;
    const user = users.find(u => u.accountNumber === accInput);

    if (user) {
        currentUser = user;
        initializeApp();
        switchStep('auth-container', 'dashboard');
    } else {
        alert("Account number not found!");
    }
}

function logout() {
    currentUser = null;
    location.reload();
}

// --- 2. CORE APP INITIALIZATION ---

function initializeApp() {
    document.getElementById('user-acc-display').innerText = currentUser.accountNumber;
    updateUI();
    startMarket();
}

function updateUI() {
    // Balances
    const balElement = document.getElementById('avail-bal');
    const fixElement = document.getElementById('fixed-bal-text');
    
    // Check eye visibility (using a simple data attribute on the element)
    balElement.innerText = balElement.dataset.visible === "false" ? "****" : `₦${currentUser.balance.toLocaleString()}`;
    fixElement.innerText = fixElement.dataset.visible === "false" ? "****" : `₦${currentUser.fixedBalance.toLocaleString()}`;

    renderFixedTable();
    renderHistory(); // ACTIVATE HISTORY ON EVERY UI UPDATE
}

// Toggle Balances
function toggleVisibility(type) {
    const el = type === 'bal' ? document.getElementById('avail-bal') : document.getElementById('fixed-bal-text');
    const icon = document.getElementById(`eye-${type}`);
    
    const isVisible = el.dataset.visible !== "false";
    el.dataset.visible = !isVisible;
    icon.className = !isVisible ? "fas fa-eye" : "fas fa-eye-slash";
    updateUI();
}

// --- 3. TRANSACTION HISTORY SYSTEM (The Activated Feature) ---

function addTransaction(type, amount, status, details) {
    const tx = {
        txId: generateLongId(), // 24 digit ID
        date: new Date().toLocaleString(),
        type: type,
        amount: amount,
        status: status,
        details: details // Object containing bank, recipient, etc.
    };
    currentUser.history.unshift(tx); // Add to start of array
    saveData();
    renderHistory();
}

function generateLongId() {
    let id = "";
    for(let i=0; i<24; i++) id += Math.floor(Math.random()*10);
    return id;
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (currentUser.history.length === 0) {
        historyList.innerHTML = "<p style='text-align:center; color:gray;'>No transactions yet.</p>";
        return;
    }

    historyList.innerHTML = currentUser.history.map((tx, index) => `
        <div class="history-card" onclick="rePrintReceipt(${index})">
            <div class="history-info">
                <i class="fas ${tx.amount > 0 && tx.type.includes('Credit') ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                <div>
                    <span class="tx-type">${tx.type}</span><br>
                    <small>${tx.date}</small>
                </div>
            </div>
            <div class="history-amt ${tx.amount > 0 && tx.type.includes('Credit') ? 'positive' : 'negative'}">
                ${tx.amount > 0 && tx.type.includes('Credit') ? '+' : '-'}₦${Math.abs(tx.amount).toLocaleString()}
            </div>
        </div>
    `).join('');
}

// --- 4. FINANCIAL FUNCTIONS ---

// Admin Funding
function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amount = parseFloat(document.getElementById('fund-amt').value);

    if (pin !== ADMIN_PIN) return alert("Unauthorized PIN");
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");

    currentUser.balance += amount;
    
    addTransaction("Admin Credit", amount, "Success", {
        remark: "Wallet Funded by Admin",
        bank: "GrowPay Internal"
    });

    closeModal('admin-modal');
    updateUI();
    alert("Funding Successful");
}

// Transfers
function processTransfer() {
    const name = document.getElementById('trans-name').value;
    const bank = document.getElementById('trans-bank').value;
    const acc = document.getElementById('trans-acc').value;
    const amt = parseFloat(document.getElementById('trans-amount').value);

    if (amt > currentUser.balance) return alert("Insufficient Balance");
    if (!name || !bank || !acc || amt <= 0) return alert("Fill all fields correctly");

    currentUser.balance -= amt;

    const details = {
        recipient: name,
        bank: bank,
        accNo: acc,
        remark: "Transfer to " + name
    };

    addTransaction("Transfer", amt, "Success", details);
    updateUI();
    showReceipt(currentUser.history[0]); // Show latest receipt
}

// Fixed Deposit
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const days = parseInt(document.getElementById('fix-duration').value);

    if (amt > currentUser.balance) return alert("Insufficient Balance");
    if (amt < 1000) return alert("Minimum lock is ₦1,000");

    const interest = amt * 0.08;
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + days);

    const investment = {
        id: Date.now(),
        amount: amt,
        interest: interest,
        expiryDate: maturity.toLocaleDateString(),
        rawExpiry: maturity.getTime(),
        duration: days,
        percentage: "8%"
    };

    currentUser.balance -= amt;
    currentUser.balance += interest; // Upfront interest
    currentUser.fixedBalance += amt;
    currentUser.investments.push(investment);

    addTransaction("Fixed Deposit", amt, "Locked", { remark: `Locked for ${days} days. Interest of ₦${interest} paid upfront.` });
    
    updateUI();
    alert(`Success! ₦${interest} interest added to your wallet.`);
}

function renderFixedTable() {
    const tableBody = document.getElementById('fixed-table-body');
    tableBody.innerHTML = currentUser.investments.map(inv => `
        <tr>
            <td>₦${inv.amount.toLocaleString()}</td>
            <td>8% (₦${inv.interest})</td>
            <td>${inv.expiryDate}</td>
            <td><button onclick="liquidateFixed(${inv.id})" class="liquid-btn">End</button></td>
        </tr>
    `).join('');
}

function liquidateFixed(id) {
    const index = currentUser.investments.findIndex(i => i.id === id);
    const inv = currentUser.investments[index];
    const now = new Date().getTime();

    if (now < inv.rawExpiry) {
        if (confirm("Penalty: Breaking before maturity will deduct the interest already paid from your capital. Proceed?")) {
            currentUser.balance += (inv.amount - inv.interest);
            currentUser.fixedBalance -= inv.amount;
            addTransaction("Early Withdrawal", inv.amount, "Penalty Applied", { remark: "Fixed deposit broken prematurely" });
            currentUser.investments.splice(index, 1);
        }
    } else {
        currentUser.balance += inv.amount;
        currentUser.fixedBalance -= inv.amount;
        addTransaction("Fixed Maturity", inv.amount, "Success", { remark: "Maturity reached" });
        currentUser.investments.splice(index, 1);
    }
    updateUI();
}

// --- 5. SHARE MARKET ---

function startMarket() {
    setInterval(() => {
        const flux = (Math.random() * 4 - 2); // -2 to +2
        marketPrice = Math.max(10, marketPrice + flux);
        marketChange = flux.toFixed(2);
        
        const marketDiv = document.getElementById('market-display');
        if (marketDiv) {
            marketDiv.innerHTML = `
                <div class="market-stat">
                    <span>Price: <strong>₦${marketPrice.toFixed(2)}</strong></span>
                    <span style="color:${marketChange >= 0 ? '#00ff88' : '#ff4444'}">
                        ${marketChange >= 0 ? '▲' : '▼'} ${marketChange}%
                    </span>
                    <br><small>Shares Available: ${Math.floor(Math.random()*50000)} units</small>
                </div>
            `;
        }
    }, 3000);
}

function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * marketPrice;

    if (cost > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= cost;
    const shareEntry = { date: new Date().toLocaleString(), qty, price: marketPrice.toFixed(2), total: cost };
    currentUser.sharesHistory.push(shareEntry);

    addTransaction("Equity Purchase", cost, "Success", { remark: `Bought ${qty} GrowPay Shares` });
    updateUI();
    alert("Shares Purchased!");
}

// --- 6. RECEIPTS & MODALS ---

function showReceipt(tx) {
    const modal = document.getElementById('receipt-modal');
    const content = document.getElementById('receipt-content');
    
    content.innerHTML = `
        <div class="opay-receipt-design">
            <div class="receipt-header">
                <div class="success-icon"><i class="fas fa-check-circle"></i></div>
                <h2>Transaction Successful</h2>
                <h1>₦${tx.amount.toLocaleString()}</h1>
            </div>
            <hr>
            <div class="receipt-row"><span>Recipient</span> <span>${tx.details.recipient || 'GrowPay User'}</span></div>
            <div class="receipt-row"><span>Bank</span> <span>${tx.details.bank || 'GrowPay'}</span></div>
            <div class="receipt-row"><span>Account No.</span> <span>${tx.details.accNo || '***'}</span></div>
            <div class="receipt-row"><span>Transaction No.</span> <span class="long-id">${tx.txId}</span></div>
            <div class="receipt-row"><span>Date</span> <span>${tx.date}</span></div>
            <div class="receipt-row"><span>Status</span> <span class="status-pill">COMPLETED</span></div>
            <div class="receipt-footer-btns">
                <button onclick="window.print()" class="print-btn">Download Receipt</button>
                <button onclick="closeModal('receipt-modal')" class="close-btn">Close</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function rePrintReceipt(index) {
    showReceipt(currentUser.history[index]);
}

// --- 7. UTILS ---

function switchStep(oldId, newId) {
    document.getElementById(oldId).classList.add('hidden');
    document.getElementById(newId).classList.remove('hidden');
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function saveData() {
    localStorage.setItem('growpay_pro_users', JSON.stringify(users));
}
