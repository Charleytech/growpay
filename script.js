// Data State
let user = {
    name: "User",
    balance: 50000,
    fixed: [],
    shares: [],
    history: []
};

// Initialization
window.onload = () => {
    const saved = localStorage.getItem('growpay_user');
    if (saved) user = JSON.parse(saved);
    updateUI();
};

function updateUI() {
    document.getElementById('avail-bal').innerText = `₦${user.balance.toLocaleString()}`;
    document.getElementById('user-display').innerText = user.name;
    renderFixedTable();
    renderSharesTable();
    renderHistory();
    localStorage.setItem('growpay_user', JSON.stringify(user));
}

// Auth Mockup
function signup() {
    const name = document.getElementById('reg-name').value || document.getElementById('login-name').value;
    if (!name) return alert("Enter name");
    user.name = name;
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// Transfer Logic
function processTransfer() {
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const recipient = document.getElementById('trans-name').value;
    
    if (amount > user.balance || amount <= 0) return alert("Insufficient Funds");

    user.balance -= amount;
    const ref = "GP-" + Math.random().toString().slice(2, 14) + Math.random().toString().slice(2, 14); // 24 digits
    const date = new Date().toLocaleString();

    const tx = { type: 'Transfer', amount, recipient, ref, date, remark: document.getElementById('trans-remark').value || "None" };
    user.history.unshift(tx);
    
    showReceipt(tx);
    updateUI();
}

// Receipt Functions
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

// Download Receipt logic
async function downloadReceipt(type) {
    const area = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(area, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    if (type === 'image') {
        const link = document.createElement('a');
        link.download = 'GrowPay-Receipt.png';
        link.href = imgData;
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 10, 10, 100, 150);
        pdf.save('GrowPay-Receipt.pdf');
    }
}

// Fixed Deposit Logic
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const tenorSelect = document.getElementById('fix-tenor');
    const days = parseInt(tenorSelect.value);
    const rate = parseInt(tenorSelect.options[tenorSelect.selectedIndex].dataset.rate);

    if (amt > user.balance || amt <= 0) return alert("Check balance");

    user.balance -= amt;
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + days);

    user.fixed.push({
        id: Date.now(),
        amount: amt,
        rate: rate,
        interest: (amt * (rate/100)),
        maturity: maturity.toLocaleDateString(),
        rawDate: maturity
    });
    updateUI();
}

function renderFixedTable() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = user.fixed.map(f => `
        <tr>
            <td>₦${f.amount}</td>
            <td>₦${f.interest} (${f.rate}%)</td>
            <td>${f.maturity}</td>
            <td>
                <button onclick="topUpFixed(${f.id})" style="padding:4px; font-size:9px; background:orange">TopUp</button>
                <button onclick="liquidate(${f.id})" style="padding:4px; font-size:9px; background:red">End</button>
            </td>
        </tr>
    `).join('');
}

function liquidate(id) {
    if(!confirm("Early ending attracts 40% penalty on interest. Proceed?")) return;
    const idx = user.fixed.findIndex(f => f.id === id);
    const item = user.fixed[idx];
    const penalty = item.interest * 0.4;
    user.balance += (item.amount + (item.interest - penalty));
    user.fixed.splice(idx, 1);
    updateUI();
}

function topUpFixed(id) {
    const extra = parseFloat(prompt("Enter amount to add to this fix:"));
    if(extra > user.balance) return alert("Low balance");
    const item = user.fixed.find(f => f.id === id);
    user.balance -= extra;
    item.amount += extra;
    item.interest = (item.amount * (item.rate/100)); // Recalculate
    updateUI();
}

// Shares logic
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * 500;
    if(cost > user.balance) return alert("Check balance");
    
    user.balance -= cost;
    user.shares.push({ units: qty, value: cost, date: new Date().toLocaleDateString() });
    updateUI();
}

function renderSharesTable() {
    document.getElementById('shares-list-body').innerHTML = user.shares.map(s => `
        <tr><td>${s.units} Units</td><td>₦${s.value}</td><td>${s.date} (Locked)</td></tr>
    `).join('');
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = user.history.map(h => `
        <div style="border-bottom:1px solid #eee; padding:10px; font-size:12px;">
            <b>${h.type}</b> <span style="float:right; color:${h.type==='Transfer'?'red':'green'}">₦${h.amount}</span><br>
            <small>${h.date}</small>
        </div>
    `).join('');
}

// Admin / UI helpers
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }
function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    if(pin === "0000") { // Default PIN
        user.balance += amt;
        updateUI();
        closeModal();
    } else alert("Wrong Pin");
}

let fixedVisible = false;
function toggleFixedVisibility() {
    fixedVisible = !fixedVisible;
    const totalFixed = user.fixed.reduce((sum, f) => sum + f.amount, 0);
    document.getElementById('fixed-bal-text').innerText = fixedVisible ? `₦${totalFixed.toLocaleString()}` : "****";
    document.getElementById('toggle-eye').className = fixedVisible ? "fas fa-eye-slash" : "fas fa-eye";
}

function logout() { location.reload(); }
