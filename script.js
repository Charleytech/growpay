:root {
    --primary: #00d285; /* OPay Green */
    --dark: #1a1a1a;
    --gray: #f4f7f6;
    --text-muted: #666;
}

body {
    font-family: 'Inter', sans-serif;
    background-color: var(--gray);
    margin: 0;
    color: var(--dark);
}

.container { max-width: 450px; margin: 0 auto; padding: 20px; }
.hidden { display: none !important; }

/* Auth & Cards */
.auth-card, .app-section, .card {
    background: white;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    margin-bottom: 20px;
}

input, select {
    width: 100%;
    padding: 12px;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-sizing: border-box;
}

button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: var(--primary);
    color: white;
    font-weight: bold;
    cursor: pointer;
}

/* Dashboard */
nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.logo { font-weight: 800; color: var(--primary); font-size: 22px; }
.balance-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.main-bal { background: var(--dark); color: white; }
.fixed-bal { border: 1px solid var(--primary); }

.quick-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 20px 0;
}
.quick-actions button {
    background: white;
    color: var(--dark);
    font-size: 11px;
    padding: 10px 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
.quick-actions i { display: block; font-size: 18px; margin-bottom: 5px; color: var(--primary); }

/* Tables */
.table-container { overflow-x: auto; margin-top: 15px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 10px; border-bottom: 1px solid #eee; }
.note { font-size: 10px; color: red; margin-top: 10px; }

/* Receipt Styling (OPay Style) */
#receipt-overlay {
    position: fixed; top:0; left:0; width:100%; height:100%;
    background: rgba(0,0,0,0.8); z-index: 1000;
    overflow-y: auto; padding: 20px 0;
}

#receipt-capture-area {
    background: white; width: 90%; max-width: 350px;
    margin: 0 auto; border-radius: 10px; padding: 20px;
}

.receipt-header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
.logo-area { color: var(--primary); font-weight: bold; font-size: 20px; }
.receipt-amount { text-align: center; padding: 20px 0; }
.status-badge { color: var(--primary); font-weight: bold; }
.receipt-details .row {
    display: flex; justify-content: space-between;
    margin-bottom: 12px; font-size: 13px;
}
.receipt-details .label { color: var(--text-muted); }
.receipt-details .val { font-weight: 600; text-align: right; }
.legal-text { font-size: 10px; text-align: center; color: #999; margin-top: 20px; }

.receipt-actions { width: 90%; max-width: 350px; margin: 15px auto; display: flex; flex-direction: column; gap: 10px; }
.img-btn { background: #555; }
.pdf-btn { background: #007bff; }
