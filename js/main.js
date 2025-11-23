import { auth, db, firebaseConfig } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addDoc, collection, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { setupDataListeners, fetchUserRole, postJournalEntry } from './db.js';
// Import showToast correctly from UI
import { updateAllMetrics, showToast, setButtonLoading } from './ui.js'; 
import { getCollectionPath, getRolesCollectionPath } from './utils.js';
import * as logic from './logic.js';

// --- EXPOSE TO HTML ---
window.state = state;

// UI Helpers
window.changeView = (newView) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(newView);
    if(el) el.classList.remove('hidden');
    
    // Active Tab Styling
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-active', 'bg-teal-50', 'text-teal-700'));
    const activeBtn = document.querySelector(`.nav-item[data-view="${newView}"]`);
    if(activeBtn) activeBtn.classList.add('nav-active', 'bg-teal-50', 'text-teal-700');

    updateAllMetrics();
};

window.openModal = (id) => {
    document.getElementById(id).classList.remove('hidden');
    // Dynamic Dropdowns
    if(id === 'addSaleModal') populateDropdown('saleProductId', state.REF_DATA.products, 'name');
    if(id === 'editProductModal') populateDropdown('editProductIdDisplay', [], ''); 
};

window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

// Report Switching
window.showReport = (type) => {
    state.currentReport = type;
    document.getElementById('income-statement-view').classList.toggle('hidden', type !== 'income');
    document.getElementById('balance-sheet-view').classList.toggle('hidden', type !== 'balance');
    
    // Update Tab Styles
    document.getElementById('tab-income').className = type === 'income' ? 'report-tab-button px-4 py-2 border-b-2 border-teal-500 text-teal-600 font-semibold' : 'report-tab-button px-4 py-2 text-gray-600';
    document.getElementById('tab-balance').className = type === 'balance' ? 'report-tab-button px-4 py-2 border-b-2 border-teal-500 text-teal-600 font-semibold' : 'report-tab-button px-4 py-2 text-gray-600';
    
    updateAllMetrics();
}

function populateDropdown(id, data, labelField) {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = '<option value="">Select...</option>';
    data.forEach(item => {
        el.innerHTML += `<option value="${item.id}">${item[labelField]}</option>`;
    });
}

// --- CORE ACTIONS ---

// 1. PRODUCTS
window.addNewProduct = async function() {
    const id = document.getElementById('newProductId').value;
    const name = document.getElementById('newProductName').value;
    const price = parseFloat(document.getElementById('newProductPrice').value);
    const cost = parseFloat(document.getElementById('newProductCost').value);
    
    if(!id || !name) return showToast("Invalid Data", "error");
    
    setButtonLoading('btnSaveProduct', true); // Ensure button ID exists in HTML
    try {
        await setDoc(doc(db, getCollectionPath('products', firebaseConfig.projectId, state.storeId), id), {
            name, category: document.getElementById('newProductCategory').value, price, cost,
            reorder: parseInt(document.getElementById('newProductReorder').value)
        });
        await addDoc(collection(db, getCollectionPath('inventoryLog', firebaseConfig.projectId, state.storeId)), {
            date: new Date().toLocaleDateString('en-US'), id, type: 'Initial', qty: 0, unitCost: cost
        });
        window.closeModal('addProductModal');
        showToast("Product Added Successfully", "success");
        document.getElementById('addProductForm').reset();
    } catch(e) { showToast(e.message, "error"); }
    finally { setButtonLoading('btnSaveProduct', false); }
};

window.openEditProductModal = function(id) {
    const p = state.REF_DATA.products.find(x => x.id === id);
    if(!p) return;
    document.getElementById('editProductIdHidden').value = p.id;
    document.getElementById('editProductName').value = p.name;
    window.openModal('editProductModal');
};

window.updateProduct = async function() {
    const id = document.getElementById('editProductIdHidden').value;
    const name = document.getElementById('editProductName').value;
    
    try {
        await updateDoc(doc(db, getCollectionPath('products', firebaseConfig.projectId, state.storeId), id), { name: name });
        window.closeModal('editProductModal');
        showToast("Product Updated", "success");
    } catch(e) { showToast(e.message, "error"); }
};

// 2. SALES
window.logNewSale = async function() {
    const id = document.getElementById('saleProductId').value;
    const qty = parseInt(document.getElementById('saleQuantity').value);
    if(!id || !qty) return showToast("Invalid Input", "error");
    
    setButtonLoading('btnSaveSale', true);
    try {
        const product = state.REF_DATA.products.find(p => p.id === id);
        const revenue = qty * product.price;
        const today = new Date().toLocaleDateString('en-US');
        
        await addDoc(collection(db, getCollectionPath('salesLog', firebaseConfig.projectId, state.storeId)), { date: today, id, qty });
        await addDoc(collection(db, getCollectionPath('inventoryLog', firebaseConfig.projectId, state.storeId)), { date: today, id, type: 'Outflow', qty: -qty });
        await postJournalEntry(new Date().toISOString().split('T')[0], `Sale: ${product.name}`, 1000, 4000, revenue);
        
        window.closeModal('addSaleModal');
        showToast("Sale Logged Successfully", "success");
        document.getElementById('addSaleForm').reset();
    } catch(e) { showToast(e.message, "error"); } 
    finally { setButtonLoading('btnSaveSale', false); }
};

// 3. ADMIN & UTILS
window.updateAllMetrics = updateAllMetrics; // Expose update function

window.inviteNewUser = async function() {
    const email = document.getElementById('inviteEmail').value;
    const role = document.getElementById('inviteRole').value;
    try {
        const tempId = 'PRE_' + Date.now();
        await setDoc(doc(db, getRolesCollectionPath(firebaseConfig.projectId), tempId), { email, role });
        window.closeModal('inviteUserModal');
        showToast("User Invited", "success");
    } catch(e) { showToast(e.message, "error"); }
};

window.updateUserRole = async function(uid, newRole) {
    if(state.userRole !== 'admin') return showToast("Admins only", "error");
    try {
        await updateDoc(doc(db, getRolesCollectionPath(firebaseConfig.projectId), uid), { role: newRole });
        showToast("Role Updated", "success");
    } catch(e) { showToast(e.message, "error"); }
};

window.importDailySales = function() {
    const fileInput = document.getElementById('dailySalesFile');
    const file = fileInput.files[0];
    if(!file) return showToast("Please select a file", "error");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const salesData = JSON.parse(e.target.result);
            window.closeModal('importSalesModal');
            showToast(`Simulated import of ${salesData.length} items`, "success");
        } catch(err) { showToast("Invalid JSON File", "error"); }
    };
    reader.readAsText(file);
};

// --- AUTH LISTENERS ---
const btnLogin = document.getElementById('btnLogin');
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        setButtonLoading('btnLogin', true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch(e) { 
            showToast("Login Failed: " + e.message, "error"); 
            setButtonLoading('btnLogin', false); 
        }
    });
}

const btnSignup = document.getElementById('btnSignup');
if(btnSignup) {
    btnSignup.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        if(!email || !pass) return showToast("Enter email and password", "error");
        setButtonLoading('btnSignup', true);
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            showToast("Account Created!", "success");
        } catch(e) { 
            showToast(e.message, "error"); 
            setButtonLoading('btnSignup', false);
        }
    });
}

onAuthStateChanged(auth, (user) => {
    state.isAuthReady = true;
    if (user) {
        state.userId = user.uid;
        fetchUserRole(user.uid).then(() => {
            document.getElementById('loginModal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            setupDataListeners();
            showToast("Welcome to Grillence", "success");
        });
    } else {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
        setButtonLoading('btnLogin', false);
    }
});
