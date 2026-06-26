let currentUser = null;
let isFixedVisible = false;
const ADMIN_PIN = "4455";

// --- Auth ---
function signup() {
    const name = document.getElementById('reg-name').value;
    const bvn = document.getElementById('reg-bvn').value;
    const address = document.getElementById('reg-address').value;
    const pass = document.getElementById('reg-pass').value;

    if (!name || !bvn || !address || !pass) return alert("All fields are required");

    const accNo = "30" + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 8);
    const user = {
        name, bvn, address, pass, accNo,
        balance: 0,
        fixedBalance: 0,
        shares: 0,
        transactions: [] // Stores all history
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
    renderHistory();
    saveData();
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = "";
    
    // Show latest transactions first
    const history = [...currentUser.transactions].reverse();

    if (history.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999;'>No transactions yet.</p>";
        return;
    }

    history.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="details">
                <h4>${tx.type}</h4>
                <p>${tx.date}</p>
                <p><strong>₦${tx.amount.toLocaleString()}</strong></p>
            </div>
            <button class="view-btn" onclick="reDownload('${tx.ref}')">Receipt</button>
        `;
        container.appendChild(item);
    });
}

// --- Logic ---
function processTransfer() {
    const name = document.getElementById('trans-name').value;
    const bank = document.getElementById('trans-bank').value;
    const acc = document.getElementById('trans-acc').value;
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const remark = document.getElementById('trans-remark').value || "Transfer";

    if (!name || !amt || amt <= 0) return alert("Fill all fields correctly");
    if (amt > currentUser.balance) return alert("Insufficient Balance");

    // 24 Digit Random Number
    let ref = "";
    for(let i=0; i<24; i++) ref += Math.floor(Math.random() * 10);

    const tx = {
        type: "Transfer",
        amount: amt,
        recipient: `${name} | ${bank} | ${acc}`,
        sender: `${currentUser.name} | ${currentUser.accNo}`,
        remark: remark,
        date: new Date().toLocaleString(),
        ref: ref
    };

    currentUser.balance -= amt;
    currentUser.transactions.push(tx);
    
    showReceipt(tx);
    updateUI();
}

function showReceipt(tx) {
    document.getElementById('r-amount').innerText = `₦${tx.amount.toLocaleString()}.00`;
    document.getElementById('r-recipient').innerText = tx.recipient;
    document.getElementById('r-sender').innerText = tx.sender;
    document.getElementById('r-remark').innerText = tx.remark;
    document.getElementById('r-date').innerText = tx.date;
    document.getElementById('r-ref').innerText = tx.ref;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function reDownload(ref) {
    const tx = currentUser.transactions.find(t => t.ref === ref);
    if (tx) showReceipt(tx);
}

async function downloadReceipt(type) {
    const element = document.getElementById('receipt-capture-area');
    
    if (type === 'image') {
        const canvas = await html2canvas(element, { scale: 2 });
        const link = document.createElement('a');
        link.download = `GROWPAY-Receipt-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    } else if (type === 'pdf') {
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        pdf.save(`GROWPAY-Receipt-${Date.now()}.pdf`);
    }
}

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    if (pin === ADMIN_PIN && amt > 0) {
        currentUser.balance += amt;
        currentUser.transactions.push({
            type: "Deposit",
            amount: amt,
            recipient: "Wallet",
            sender: "Admin",
            remark: "Funding",
            date: new Date().toLocaleString(),
            ref: Math.random().toString().slice(2, 11) + Math.random().toString().slice(2, 17)
        });
        updateUI();
        closeModal();
        alert("Wallet Funded!");
    } else { alert("Invalid PIN or Amount"); }
}

function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * 500;
    if (cost > currentUser.balance) return alert("Insufficient Balance");
    currentUser.balance -= cost;
    currentUser.shares += qty;
    currentUser.transactions.push({
        type: "Share Purchase",
        amount: cost,
        date: new Date().toLocaleString(),
        ref: "SHR" + Date.now()
    });
    updateUI();
    alert("Shares Bought!");
}

function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    if (amt > currentUser.balance) return alert("Insufficient Balance");
    currentUser.balance -= amt;
    currentUser.fixedBalance += amt;
    currentUser.transactions.push({
        type: "Fixed Deposit",
        amount: amt,
        date: new Date().toLocaleString(),
        ref: "FIX" + Date.now()
    });
    updateUI();
    alert("Funds Locked!");
}

// --- Helpers ---
function saveData() { localStorage.setItem(currentUser.accNo, JSON.stringify(currentUser)); }
function logout() { location.reload(); }
function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function showSignup() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); }
function showLogin() { document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }
function toggleFixedVisibility() { isFixedVisible = !isFixedVisible; updateUI(); }
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
