// --- STATE MANAGEMENT ---
let user = JSON.parse(localStorage.getItem('growpay_user')) || {
    name: "", balance: 0, fixed: [], shares: [], history: [], isFixedVisible: false
};

const save = () => localStorage.setItem('growpay_user', JSON.stringify(user));
const fmt = (amt) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amt);

// --- AUTH FUNCTIONS ---
function signup() {
    user.name = document.getElementById('reg-name').value;
    if (!user.name || document.getElementById('reg-bvn').value.length < 11) return alert("Invalid Details");
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}

function logout() {
    localStorage.removeItem('growpay_user');
    location.reload();
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// --- CORE LOUNGE ---
function updateUI() {
    document.getElementById('user-display').innerText = user.name || "User";
    document.getElementById('avail-bal').innerText = fmt(user.balance);
    
    // Fixed Balance Eye Toggle
    const totalFixed = user.fixed.reduce((a, b) => a + b.amount, 0);
    document.getElementById('fixed-bal-text').innerText = user.isFixedVisible ? fmt(totalFixed) : "****";
    
    renderFixed();
    renderShares();
    renderHistory();
    save();
}

function toggleFixedVisibility() {
    user.isFixedVisible = !user.isFixedVisible;
    updateUI();
}

// --- ADMIN FUNDING ---
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('admin-modal').classList.add('hidden'); }

function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amt = parseFloat(document.getElementById('fund-amt').value);
    if (pin === "1234" && amt > 0) {
        user.balance += amt;
        user.history.unshift({ type: 'Credit', amt, date: new Date().toLocaleString(), ref: 'ADMIN-FUND' });
        closeModal();
        updateUI();
    } else { alert("Wrong PIN or Amount"); }
}

// --- TRANSFER & RECEIPT ---
function processTransfer() {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const name = document.getElementById('trans-name').value;
    const bank = document.getElementById('trans-bank').value;
    const acc = document.getElementById('trans-acc').value;

    if (amt > user.balance || amt <= 0) return alert("Insufficient Funds");

    user.balance -= amt;
    const ref = Array.from({length: 24}, () => Math.floor(Math.random() * 10)).join('');
    const trans = { type: 'Debit', amt, name, bank, acc, ref, date: new Date().toLocaleString(), remark: document.getElementById('trans-remark').value || "None" };
    
    user.history.unshift(trans);
    showReceipt(trans);
    updateUI();
}

function showReceipt(t) {
    document.getElementById('r-amount').innerText = fmt(t.amt);
    document.getElementById('r-recipient').innerText = `${t.name} | ${t.bank} | ${t.acc}`;
    document.getElementById('r-sender').innerText = user.name;
    document.getElementById('r-ref').innerText = t.ref;
    document.getElementById('r-date').innerText = t.date;
    document.getElementById('r-remark').innerText = t.remark;
    document.getElementById('receipt-overlay').classList.remove('hidden');
}

function closeReceipt() { document.getElementById('receipt-overlay').classList.add('hidden'); }

async function downloadReceipt(type) {
    const area = document.getElementById('receipt-capture-area');
    const canvas = await html2canvas(area);
    if (type === 'image') {
        const link = document.createElement('a');
        link.download = 'GrowPay-Receipt.png';
        link.href = canvas.toDataURL();
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, 180, 160);
        pdf.save("GrowPay-Receipt.pdf");
    }
}

// --- FIXED DEPOSIT LOGIC ---
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const select = document.getElementById('fix-tenor');
    const days = parseInt(select.value);
    const rate = parseInt(select.options[select.selectedIndex].dataset.rate);

    if (amt > user.balance || amt < 500) return alert("Min Fix: ₦500");

    user.balance -= amt;
    const maturity = Date.now() + (days * 24 * 60 * 60 * 1000);
    user.fixed.push({ amt, rate, days, start: Date.now(), maturity, id: Date.now() });
    updateUI();
}

function renderFixed() {
    const body = document.getElementById('fixed-list-body');
    body.innerHTML = user.fixed.map((f, i) => {
        const interest = (f.amt * (f.rate / 100));
        const isMatured = Date.now() > f.maturity;
        return `<tr>
            <td>${fmt(f.amt)}</td>
            <td>${fmt(interest)} (${f.rate}%)</td>
            <td>${new Date(f.maturity).toLocaleDateString()}</td>
            <td><button onclick="liquidate(${i})">${isMatured ? 'Claim' : 'Withdraw'}</button></td>
        </tr>`;
    }).join('');
}

function liquidate(index) {
    const f = user.fixed[index];
    const isMatured = Date.now() > f.maturity;
    let interest = f.amt * (f.rate / 100);
    
    if (!isMatured) {
        if (!confirm("Early withdrawal attracts 40% penalty on interest. Proceed?")) return;
        interest = interest * 0.6;
    }

    user.balance += (f.amt + interest);
    user.fixed.splice(index, 1);
    user.history.unshift({ type: 'Credit', amt: f.amt + interest, date: new Date().toLocaleString(), ref: 'FIXED-REVERSE' });
    updateUI();
}

// --- SHARES & HISTORY ---
function buyShares() {
    const qty = parseInt(document.getElementById('share-qty').value);
    const cost = qty * 500;
    if (cost > user.balance) return alert("Insufficient Funds");
    
    user.balance -= cost;
    user.shares.push({ qty, value: cost, date: new Date().toLocaleDateString() });
    updateUI();
}

function renderShares() {
    document.getElementById('shares-list-body').innerHTML = user.shares.map(s => 
        `<tr><td>${s.qty} Units</td><td>${fmt(s.value)}</td><td>In 1 Year</td></tr>`
    ).join('');
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = user.history.map(h => 
        `<div class="history-item" style="border-bottom:1px solid #eee; padding:10px;">
            <strong>${h.type}: ${fmt(h.amt)}</strong> <br> <small>${h.date} | Ref: ${h.ref}</small>
        </div>`
    ).join('');
}

// Initialize
if(user.name) {
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateUI();
}
