// Initialization
let currentUser = null;
let isFixedVisible = false;
const ADMIN_PIN = "4455"; // Programmer can change this here

// --- Auth Functions ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-pass').value;

    if(!name || !bvn || !address || !pass) return alert("All fields are required");

    const accNo = "30" + Math.floor(Math.random() * 100000000);
    const user = {
        name, bvn, address, pass, accNo,
        balance: 0,
        fixedBalance: 0,
        shares: 0,
        fixedHistory: []
    };

    localStorage.setItem(accNo, JSON.stringify(user));
    alert(`Account Created! Your Account Number is: ${accNo}`);
    showLogin();
}

function login() {
    const id = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    const userData = localStorage.getItem(id);
    if(userData) {
        const user = JSON.parse(userData);
        if(user.pass === pass) {
            currentUser = user;
            loadDashboard();
        } else { alert("Wrong Password"); }
    } else { alert("User not found. Use your Account Number to login."); }
}

function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUser.name;
    updateUI();
}

function updateUI() {
    document.getElementById('avail-bal').innerText = `₦${currentUser.balance.toLocaleString()}`;
    document.getElementById('fixed-bal-text').innerText = isFixedVisible ? `₦${currentUser.fixedBalance.toLocaleString()}` : "****";
    document.getElementById('owned-shares').innerText = currentUser.shares;
    document.getElementById('share-value').innerText = `₦${(currentUser.shares * 500).toLocaleString()}`;
    
    // Update Fixed Table
    const tbody = document.getElementById('fixed-table-body');
    tbody.innerHTML = "";
    currentUser.fixedHistory.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>₦${item.amt}</td>
                <td>${item.tenor} Days</td>
                <td>${item.expiry}</td>
                <td>₦${item.interest}</td>
                <td>Locked</td>
            </tr>
        `;
    });
}

function toggleFixedVisibility() {
    isFixedVisible = !isFixedVisible;
    updateUI();
}

// --- Features ---

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// Fixed Deposit Logic
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenor = parseInt(document.getElementById('fix-tenor').value);
    
    if(amt > currentUser.balance) return alert("Insufficient Balance");

    const interestRate = tenor === 30 ? 0.10 : tenor === 90 ? 0.15 : 0.25;
    const interest = amt * interestRate;
    
    currentUser.balance -= amt;
    currentUser.fixedBalance += amt;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + tenor);

    const deposit = {
        amt,
        tenor,
        interest,
        expiry: expiryDate.toLocaleDateString(),
        timestamp: Date.now()
    };

    currentUser.fixedHistory.push(deposit);
    saveData();
    updateUI();
    alert(`Success! ₦${interest} interest will be added upon expiration.`);
}

// Transfer & Receipt Logic
function processTransfer() {
    const name = document.getElementById('trans-name').value;
    const bank = document.getElementById('trans-bank').value;
    const acc = document.getElementById('trans-acc').value;
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const remark = document.getElementById('trans-remark').value;

    if(amt > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= amt;
    saveData();
    updateUI();

    // Generate Receipt
    document.getElementById('r-amount').innerText = `₦${amt.toLocaleString()}.00`;
    document.getElementById('r-recipient').innerText = `${name.toUpperCase()}\n${bank} | ${acc}`;
    document.getElementById('r-sender').innerText = `${currentUser.name.toUpperCase()}\nGPAY | ${currentUser.accNo}`;
    document.getElementById('r-remark').innerText = remark || "None";
    document.getElementById('r-date').innerText = new Date().toLocaleString();
    document.getElementById('r-ref').innerText = "260" + Math.floor(Math.random() * 1000000000000);
    
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

// Admin Funding
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);

    if(pin === ADMIN_PIN) {
        currentUser.balance += amt;
        saveData();
        updateUI();
        closeModal();
        alert("Wallet Funded Successfully");
    } else {
        alert("Invalid Admin PIN");
    }
}

function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const totalCost = qty * 500;
    if(totalCost > currentUser.balance) return alert("Insufficient Balance");
    
    currentUser.balance -= totalCost;
    currentUser.shares += qty;
    saveData();
    updateUI();
    alert("Shares purchased successfully!");
}

function saveData() {
    localStorage.setItem(currentUser.accNo, JSON.stringify(currentUser));
}

function logout() { location.reload(); }
function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function showSignup() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); }
function showLogin() { document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }