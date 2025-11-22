// js/main.js
import { auth, db, firebaseConfig } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { setupDataListeners, fetchUserRole, postJournalEntry } from './db.js';
// import UI helpers
import { updateAllMetrics, showToast, setButtonLoading } from './ui.js'; 
import { getCollectionPath } from './utils.js';

// --- GLOBAL WINDOW EXPORTS ---
window.state = state;

window.changeView = (newView) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const view = document.getElementById(newView);
    if(view) view.classList.remove('hidden');
    
    // Update active nav state
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.querySelector(`.nav-item[data-view="${newView}"]`);
    if(activeBtn) activeBtn.classList.add('nav-active');

    state.currentView = newView;
    updateAllMetrics();
};

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('hidden');
    // Populate dropdowns if needed (Simplified logic)
    if(id === 'addSaleModal') {
         const productSelect = document.getElementById('saleProductId');
         if(productSelect && state.REF_DATA.products) {
            productSelect.innerHTML = '<option value="">-- Select Product --</option>';
            state.REF_DATA.products.forEach(p => {
                productSelect.innerHTML += `<option value="${p.id}">${p.name} (${p.price})</option>`;
            });
         }
    }
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('hidden');
};

window.showReport = (type) => {
    state.currentReport = type;
    const incomeView = document.getElementById('income-statement-view');
    const balanceView = document.getElementById('balance-sheet-view');
    
    if(incomeView) incomeView.classList.toggle('hidden', type !== 'income');
    if(balanceView) balanceView.classList.toggle('hidden', type !== 'balance');
    
    // Tab styling update (simplified)
    document.getElementById('tab-income').classList.toggle('border-teal-500', type === 'income');
    document.getElementById('tab-balance').classList.toggle('border-teal-500', type === 'balance');

    updateAllMetrics();
};

// --- AUTH HANDLERS ---
const btnLogin = document.getElementById('btnLogin');
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        if(!email || !pass) return showToast("Please enter email and password", "error");
        
        // Loading state for login button
        setButtonLoading('btnLogin', true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // Auth listener handles the rest
        } catch (e) { 
            showToast("Login Failed: " + e.message, "error");
            setButtonLoading('btnLogin', false);
        }
    });
}

const btnConfirmLogout = document.getElementById('btnConfirmLogout');
if(btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', async () => {
        await signOut(auth);
        window.closeModal('logoutConfirmModal');
        showToast("Logged out successfully", "success");
    });
}

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
            showToast(`Welcome back!`, "success");
        });
    } else {
        state.userId = null;
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
        setButtonLoading('btnLogin', false); // Reset login button if needed
    }
});

// --- DATA ENTRY FUNCTION (UPDATED WITH UI ENHANCEMENTS) ---
window.logNewSale = async function() {
    const id = document.getElementById('saleProductId').value;
    const qtyInput = document.getElementById('saleQuantity');
    const qty = parseInt(qtyInput.value);
    
    if(!id || qty <= 0) {
        showToast("Please select a product and valid quantity", "error");
        return;
    }
    
    // Activate Spinner
    const btnId = 'btnSaveSale'; 
    setButtonLoading(btnId, true);

    try {
        const product = state.REF_DATA.products.find(p => p.id === id);
        if (!product) throw new Error("Product not found in memory");

        const revenue = qty * product.price;
        const today = new Date().toLocaleDateString('en-US');
        const todayISO = new Date().toISOString().split('T')[0];

        // 1. Log Sale
        await addDoc(collection(db, getCollectionPath('salesLog', firebaseConfig.projectId, state.storeId)), { date: today, id, qty });
        
        // 2. Update Inventory Log
        await addDoc(collection(db, getCollectionPath('inventoryLog', firebaseConfig.projectId, state.storeId)), { date: today, id, type: 'Outflow', qty: -qty });
        
        // 3. Post to GL
        await postJournalEntry(todayISO, `Sale: ${product.name}`, 1000, 4000, revenue);
        
        window.closeModal('addSaleModal');
        showToast(`Successfully sold ${qty} units of ${product.name}`, "success");
        
        // Reset Form
        document.getElementById('saleProductId').value = "";
        qtyInput.value = "";

    } catch (error) {
        console.error("Error logging sale:", error);
        showToast("Failed to save sale. Please try again.", "error");
    } finally {
        // Deactivate Spinner
        setButtonLoading(btnId, false);
    }
};


function updateUIState() {
    const roleDisplay = document.getElementById('user-role-display');
    if(roleDisplay) {
        roleDisplay.innerText = state.userRole.toUpperCase();
        // Add appropriate class based on role
        roleDisplay.className = 'user-role-tag role-tag'; // Reset
        if(state.userRole === 'admin') roleDisplay.classList.add('tag-admin');
        else if(state.userRole === 'manager') roleDisplay.classList.add('tag-manager');
        else roleDisplay.classList.add('tag-employee');
    }
}

document.addEventListener('ui-update-needed', updateUIState);