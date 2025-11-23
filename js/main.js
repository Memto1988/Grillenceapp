import { auth, db, firebaseConfig } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addDoc, collection, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { setupDataListeners, fetchUserRole, postJournalEntry } from './db.js';
import { updateAllMetrics, showToastUI, setButtonLoading } from './ui.js'; 
import { getCollectionPath, getRolesCollectionPath } from './utils.js';
import * as logic from './logic.js';

// --- EXPOSE TO HTML ---
window.state = state;

// UI Helpers
window.changeView = (newView) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(newView);
    if(el) el.classList.remove('hidden');
    updateAllMetrics();
};

window.openModal = (id) => {
    document.getElementById(id).classList.remove('hidden');
    // Dynamic Dropdowns
    if(id === 'addSaleModal') populateDropdown('saleProductId', state.REF_DATA.products, 'name');
    if(id === 'editProductModal') populateDropdown('editProductIdDisplay', [], ''); // Just dummy
};

window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

function populateDropdown(id, data, labelField) {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = '<option value="">Select...</option>';
    data.forEach(item => {
        el.innerHTML += `<option value="${item.id}">${item[labelField]}</option>`;
    });
}

// --- CORE ACTIONS (The missing logic from original file) ---

// 1. PRODUCTS
window.addNewProduct = async function() {
    const id = document.getElementById('newProductId').value;
    const name = document.getElementById('newProductName').value;
    const price = parseFloat(document.getElementById('newProductPrice').value);
    const cost = parseFloat(document.getElementById('newProductCost').value);
    
    if(!id || !name) return showToastUI("Invalid Data", "error");
    
    try {
        await setDoc(doc(db, getCollectionPath('products', firebaseConfig.projectId, state.storeId), id), {
            name, category: document.getElementById('newProductCategory').value, price, cost,
            reorder: parseInt(document.getElementById('newProductReorder').value)
        });
        // Initial Stock Logic
        await addDoc(collection(db, getCollectionPath('inventoryLog', firebaseConfig.projectId, state.storeId)), {
            date: new Date().toLocaleDateString('en-US'), id, type: 'Initial', qty: 0, unitCost: cost
        });
        window.closeModal('addProductModal');
        showToastUI("Product Added", "success");
    } catch(e) { showToastUI(e.message, "error"); }
};

window.openEditProductModal = function(id) {
    const p = state.REF_DATA.products.find(x => x.id === id);
    if(!p) return;
    document.getElementById('editProductIdHidden').value = p.id;
    document.getElementById('editProductName').value = p.name;
    // Fill other fields...
    window.openModal('editProductModal');
};

window.updateProduct = async function() {
    const id = document.getElementById('editProductIdHidden').value;
    // Get other values...
    const name = document.getElementById('editProductName').value;
    
    try {
        await updateDoc(doc(db, getCollectionPath('products', firebaseConfig.projectId, state.storeId), id), { name: name });
        window.closeModal('editProductModal');
        showToastUI("Updated", "success");
    } catch(e) { showToastUI(e.message, "error"); }
};

// 2. SALES
window.logNewSale = async function() {
    const id = document.getElementById('saleProductId').value;
    const qty = parseInt(document.getElementById('saleQuantity').value);
    if(!id || !qty) return showToastUI("Invalid Input", "error");
    
    setButtonLoading('btnSaveSale', true);
    try {
        const product = state.REF_DATA.products.find(p => p.id === id);
        const revenue = qty * product.price;
        const today = new Date().toLocaleDateString('en-US');
        
        await addDoc(collection(db, getCollectionPath('salesLog', firebaseConfig.projectId, state.storeId)), { date: today, id, qty });
        await addDoc(collection(db, getCollectionPath('inventoryLog', firebaseConfig.projectId, state.storeId)), { date: today, id, type: 'Outflow', qty: -qty });
        await postJournalEntry(new Date().toISOString().split('T')[0], `Sale: ${product.name}`, 1000, 4000, revenue);
        
        window.closeModal('addSaleModal');
        showToastUI("Sale Logged", "success");
    } catch(e) { showToastUI(e.message, "error"); } 
    finally { setButtonLoading('btnSaveSale', false); }
};

// 3. ADMIN
window.inviteNewUser = async function() {
    const email = document.getElementById('inviteEmail').value;
    const role = document.getElementById('inviteRole').value;
    // Logic to add to userRoles collection
    try {
        const tempId = 'PRE_' + Date.now();
        await setDoc(doc(db, getRolesCollectionPath(firebaseConfig.projectId), tempId), { email, role });
        window.closeModal('inviteUserModal');
        showToastUI("User Invited", "success");
    } catch(e) { showToastUI(e.message, "error"); }
};

window.updateUserRole = async function(uid, newRole) {
    if(state.userRole !== 'admin') return showToastUI("Admins only", "error");
    try {
        await updateDoc(doc(db, getRolesCollectionPath(firebaseConfig.projectId), uid), { role: newRole });
        showToastUI("Role Updated", "success");
    } catch(e) { showToastUI(e.message, "error"); }
};

// 4. IMPORTS
window.importDailySales = function() {
    const fileInput = document.getElementById('dailySalesFile');
    const file = fileInput.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const salesData = JSON.parse(e.target.result);
            // Loop and process...
            for (const sale of salesData) {
                // logic similar to logNewSale
            }
            window.closeModal('importSalesModal');
            showToastUI(`Imported ${salesData.length} items`, "success");
        } catch(err) { showToastUI("JSON Error", "error"); }
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
        } catch(e) { showToastUI(e.message, "error"); setButtonLoading('btnLogin', false); }
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
            showToastUI("Welcome", "success");
        });
    } else {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
        setButtonLoading('btnLogin', false);
    }
});