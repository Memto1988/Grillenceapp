import { auth, db, firebaseConfig } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addDoc, collection, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { setupDataListeners, fetchUserRole, postJournalEntry } from './db.js';
import { updateAllMetrics } from './ui.js';
import { getCollectionPath, getRolesCollectionPath } from './utils.js';

// --- GLOBAL WINDOW EXPORTS (For HTML onclicks) ---
window.state = state;

window.changeView = (newView) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(newView).classList.remove('hidden');
    state.currentView = newView;
    updateAllMetrics();
};

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

window.showReport = (type) => {
    state.currentReport = type;
    document.getElementById('income-statement-view').classList.toggle('hidden', type !== 'income');
    document.getElementById('balance-sheet-view').classList.toggle('hidden', type !== 'balance');
    updateAllMetrics();
};

// --- AUTH HANDLERS ---
document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Login Failed: " + e.message); }
});

document.getElementById('btnConfirmLogout').addEventListener('click', async () => {
    await signOut(auth);
    window.closeModal('logoutConfirmModal');
});

// --- AUTH STATE LISTENER ---
onAuthStateChanged(auth, (user) => {
    state.isAuthReady = true;
    if (user) {
        state.userId = user.uid;
        fetchUserRole(user.uid).then(() => {
            document.getElementById('loginModal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            if (state.userRole === 'admin') document.body.classList.add('admin-full-access');
            setupDataListeners();
            updateUIState();
        });
    } else {
        state.userId = null;
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
    }
});

// --- EXAMPLE DATA ENTRY FUNCTION (Mapped to Window) ---
window.logNewSale = async function() {
    const id = document.getElementById('saleProductId').value;
    const qty = parseInt(document.getElementById('saleQuantity').value);
    if(!id || qty <= 0) return alert("Invalid Input");
    
    const product = state.REF_DATA.products.find(p => p.id === id);
    const revenue = qty * product.price;
    const today = new Date().toLocaleDateString('en-US');
    const todayISO = new Date().toISOString().split('T')[0];

    await addDoc(collection(db, getCollectionPath('salesLog', firebaseConfig.projectId, state.storeId)), { date: today, id, qty });
    await addDoc(collection(db, getCollectionPath('inventoryLog', firebaseConfig.projectId, state.storeId)), { date: today, id, type: 'Outflow', qty: -qty });
    await postJournalEntry(todayISO, `Sale: ${id}`, 1000, 4000, revenue);
    
    window.closeModal('addSaleModal');
    alert("Sale Logged");
};

function updateUIState() {
    const roleDisplay = document.getElementById('user-role-display');
    if(roleDisplay) roleDisplay.innerText = state.userRole.toUpperCase();
    
    // Populate Dropdowns (Simplified)
    const productSelect = document.getElementById('saleProductId');
    if(productSelect) {
        productSelect.innerHTML = '<option value="">Select Product</option>';
        state.REF_DATA.products.forEach(p => {
            productSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    }
}
document.addEventListener('ui-update-needed', updateUIState);