// State Management
let user = JSON.parse(localStorage.getItem('growpay_user')) || {
    name: "",
    accNo: "",
    balance: 0,
    fixed: [],
    shares: [],
    history: []
};

// On Load
window.onload = () => {
    if (user.name) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        updateUI();
    }
};

// Auth Functions
function signup() {
    const name = document.getElementById('reg-name').value || document.getElementById('login-name').value;
    const pass = document.getElementById('reg-pass').value || document.getElementById('login-pass').value;

    // Password must be exactly 6 digits
    if (!/^\d{6}$/.test(pass)) return alert("Password must be exactly 6 numbers");
    if (!name) return alert("Please enter your name");

    if (!user.name) {
        user.name = name;
        user.accNo = Math.floor(1000000000 + Math.random() * 9000000000); // 10 Digit Acc
        user.balance = 0;
    }

    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

function updateUI() {
    document.getElementById('avail-bal').innerText = `₦${user.balance.toLocaleString()}`;
    document.getElementById('user-display').innerText = `${user.name} | ${user.accNo}`;
    renderFixedTable();
    renderSharesTable();
    renderHistory();
    localStorage.setItem('growpay_user', JSON.stringify(user));
}

// Transfer & Receipt Logic
function processTransfer() {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const name = document.getElementById('trans-name').value;
    if (amt > user.balance || amt <= 0) return alert("Insufficient balance");

    user.balance -= amt;
    // Generate 24 Random Numbers for Transaction ID
    const ref = Array.from({length: 24}, () => Math.floor(Math.random() * 10)).join('');
    
    const tx = {
        type: 'Transfer', 
        amount: amt, 
        recipient: name, 
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
    document.getElementById('r-sender').innerText = `${user.name} (${user.accNo})`;
    document.getElementById('r-remark').innerText = tx.remark;
    document.getElementById('r-ref').innerText = tx.ref;
    document.getElementById('r-date').innerText = tx.date;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

// Fixed Deposit Logic
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorEl = document.getElementById('fix-tenor');
    const days = parseInt(tenorEl.value);
    const rate = parseInt(tenorEl.options[tenorEl.selectedIndex].dataset.rate);

    if (amt > user.balance || amt <= 0) return alert("Insufficient funds");

    user.balance -= amt;
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + days);

    user.fixed.push({
        id: Date.now(),
        amount: amt,
        rate: rate,
        interest: (amt * (rate / 100)),
        expiry: maturity.toLocaleDateString(),
        tenure: days
    });
    updateUI();
}

function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = user.fixed.map(f => `
        <tr>
            <td>₦${f.amount.toLocaleString()}</td>
            <td>₦${f.interest.toLocaleString()} (${f.rate}%)</td>
            <td>${f.expiry}</td>
            <td>
                <button onclick="topUp(${f.id})" style="background:orange; padding:5px; margin-bottom:2px">Top-up</button>
                <button onclick="endFixed(${f.id})" style="background:red; padding:5px">End</button>
            </td>
        </tr>
    `).join('');
}

function topUp(id) {
    const add = parseFloat(prompt("Enter amount to add:"));
    if (add > user.balance || add <= 0) return alert("Insufficient funds");
    
    const item = user.fixed.find(f => f.id === id);
    user.balance -= add;
    item.amount += add;
    item.interest = (item.amount * (item.rate / 100)); // Recalculate
    updateUI();
}

function endFixed(id) {
    if (!confirm("Ending before maturity incurs 40% penalty on interest. Proceed?")) return;
    const idx = user.fixed.findIndex(f => f.id === id);
    const item = user.fixed[idx];
    const penalty = item.interest * 0.40;
    user.balance += (item.amount + (item.interest - penalty));
    user.fixed.splice(idx, 1);
    updateUI();
}

// Downloads
async function downloadReceipt(type) {
    const area = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(area);
    const imgData = canvas.toDataURL('image/png');

    if (type === 'image') {
        const link = document.createElement('a');
        link.download = 'receipt.png';
        link.href = imgData;
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 15, 15, 180, 0);
        pdf.save('receipt.pdf');
    }
}

// Shares & Utils
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * 500;
    if (cost > user.balance) return alert("Insufficient funds");
    user.balance -= cost;
    user.shares.push({ units: qty, value: cost, date: "12 Months" });
    updateUI();
}

function renderSharesTable() {
    document.getElementById('shares-list-body').innerHTML = user.shares.map(s => `
        <tr><td>${s.units} Units</td><td>₦${s.value.toLocaleString()}</td><td>${s.date}</td></tr>
    `).join('');
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = user.history.map(h => `
        <div style="border-bottom:1px solid #eee; padding:10px;">
            <small>${h.date}</small><br>
            <b>${h.type} to ${h.recipient}</b> <span style="float:right; color:red">-₦${h.amount}</span>
        </div>
    `).join('');
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    if (pin === "0000") {
        user.balance += parseFloat(document.getElementById('fund-amt').value);
        updateUI();
        document.getElementById('admin-modal').classList.add('hidden');
    }
}

function toggleFixedVisibility() {
    const el = document.getElementById('fixed-bal-text');
    const total = user.fixed.reduce((a, b) => a + b.amount, 0);
    el.innerText = el.innerText === "****" ? `₦${total.toLocaleString()}` : "****";
}

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function logout() { localStorage.clear(); location.reload(); }
