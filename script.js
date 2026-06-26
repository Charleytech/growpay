// Initialization
let currentUser = null;
let isFixedVisible = false;
const ADMIN_PIN = "4455";

// --- Auth Functions ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-pass').value;

    if (!name || !bvn || !address || !pass) return alert("All fields are required");

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

    if (userData) {
        const user = JSON.parse(userData);
        if (user.pass === pass) {
            currentUser = user;
            loadDashboard();
        } else { alert("Wrong Password"); }
    } else { alert("User not found. Use Account Number."); }
}

function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUser.name.split(' ')[0];
    updateUI();
}

function updateUI() {
    document.getElementById('avail-bal').innerText = `₦${currentUser.balance.toLocaleString()}`;
    document.getElementById('fixed-bal-text').innerText = isFixedVisible ? `₦${currentUser.fixedBalance.toLocaleString()}` : "****";
    document.getElementById('owned-shares').innerText = currentUser.shares;
    document.getElementById('share-value').innerText = `₦${(currentUser.shares * 500).toLocaleString()}`;

    const tbody = document.getElementById('fixed-table-body');
    tbody.innerHTML = "";
    currentUser.fixedHistory.forEach(item => {
        tbody.innerHTML += `<tr><td>₦${item.amt}</td><td>${item.tenor}d</td><td>₦${item.interest}</td><td>Locked</td></tr>`;
    });
}

function toggleFixedVisibility() {
    isFixedVisible = !isFixedVisible;
    updateUI();
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// --- Features ---

function processTransfer() {
    const name = document.getElementById('trans-name').value;
    const bank = document.getElementById('trans-bank').value;
    const acc = document.getElementById('trans-acc').value;
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const remark = document.getElementById('trans-remark').value;

    if (!amt || amt <= 0) return alert("Enter valid amount");
    if (amt > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= amt;
    saveData();
    updateUI();

    // Generate 24-digit random number
    let ref = "";
    for(let i=0; i<24; i++) {
        ref += Math.floor(Math.random() * 10);
    }

    // Fill Receipt
    document.getElementById('r-amount').innerText = `₦${amt.toLocaleString()}.00`;
    document.getElementById('r-recipient').innerText = `${name.toUpperCase()} | ${bank} | ${acc}`;
    document.getElementById('r-sender').innerText = `${currentUser.name.toUpperCase()} | ${currentUser.accNo}`;
    document.getElementById('r-remark').innerText = remark || "Transfer";
    document.getElementById('r-date').innerText = new Date().toLocaleString();
    document.getElementById('r-ref').innerText = ref;

    document.getElementById('receipt-overlay').classList.remove('hidden');
}

// Download Logic
async function downloadReceipt(type) {
    const element = document.getElementById('receipt-content');
    // Hide buttons during capture
    const actions = document.querySelector('.receipt-actions');
    actions.style.display = 'none';

    if (type === 'image') {
        const canvas = await html2canvas(element);
        const link = document.createElement('a');
        link.download = 'GROWPAY-Receipt.png';
        link.href = canvas.toDataURL();
        link.click();
    } else if (type === 'pdf') {
        const canvas = await html2canvas(element);
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        pdf.save('GROWPAY-Receipt.pdf');
    }
    
    actions.style.display = 'flex';
}

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    if (pin === ADMIN_PIN) {
        currentUser.balance += amt;
        saveData();
        updateUI();
        closeModal();
        alert("Wallet Funded!");
    } else { alert("Invalid PIN"); }
}

function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * 500;
    if (cost > currentUser.balance) return alert("Insufficient Balance");
    currentUser.balance -= cost;
    currentUser.shares += qty;
    saveData();
    updateUI();
    alert("Shares Bought!");
}

function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenor = parseInt(document.getElementById('fix-tenor').value);
    if (amt > currentUser.balance) return alert("Insufficient Balance");
    const interest = amt * (tenor === 30 ? 0.1 : tenor === 90 ? 0.15 : 0.25);
    
    currentUser.balance -= amt;
    currentUser.fixedBalance += amt;
    currentUser.fixedHistory.push({ amt, tenor, interest });
    saveData();
    updateUI();
    alert("Investment Locked!");
}

function saveData() { localStorage.setItem(currentUser.accNo, JSON.stringify(currentUser)); }
function logout() { location.reload(); }
function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function showSignup() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); }
function showLogin() { document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }
