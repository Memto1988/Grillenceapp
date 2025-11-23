import { db, firebaseConfig } from './config.js';
import { state } from './state.js';
import { getCollectionPath, getRolesCollectionPath, getAccountName } from './utils.js';
import { collection, onSnapshot, doc, addDoc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { updateAllMetrics } from './ui.js';

export async function fetchUserRole(uid) {
    if (!db || !uid) return;
    try {
        const userRoleDoc = doc(db, 'artifacts', firebaseConfig.projectId, 'userRoles', uid);
        const snapshot = await getDoc(userRoleDoc);
        if (snapshot.exists() && snapshot.data().role) {
            state.userRole = snapshot.data().role;
        } else {
            state.userRole = 'employee';
            await setDoc(userRoleDoc, { role: 'employee' });
        }
    } catch(e) {
        console.error("Error fetching role:", e);
        state.userRole = 'employee';
    }
}

export async function postJournalEntry(date, description, debitAccount, creditAccount, amount) {
    if (!db || !state.storeId || amount <= 0) return;
    const entry = {
        date, description, amount,
        debitAccount, debitAccountName: getAccountName(debitAccount),
        creditAccount, creditAccountName: getAccountName(creditAccount),
        timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, getCollectionPath('generalLedger', firebaseConfig.projectId, state.storeId)), entry);
}

let listenersInitializedCount = 0;
const TOTAL_LISTENERS = 14;

export function setupDataListeners() {
    if (!state.isAuthReady || !db || !state.storeId) return;
    listenersInitializedCount = 0;
    state.isDatabaseReady = false;
    
    const init = (colName, target) => {
        const path = colName === 'userRoles' ? getRolesCollectionPath(firebaseConfig.projectId) : getCollectionPath(colName, firebaseConfig.projectId, state.storeId);
        onSnapshot(collection(db, path), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Map data to specific state properties based on 'target' logic from original file
            if (target === 'products') state.REF_DATA.products = data;
            else if (target === 'employees') state.REF_DATA.employees = data;
            else if (target === 'suppliers') state.REF_DATA.suppliers = data;
            else if (target === 'assets') state.REF_DATA.assets = data;
            else if (target === 'salesLog') state.SALES_LOG = data;
            else if (target === 'inventoryLog') state.INVENTORY_LOG = data;
            else if (target === 'payrollLog') state.PAYROLL_LOG = data;
            else if (target === 'expensesLog') state.REF_DATA.expensesLog = data;
            else if (target === 'leaveRequests') state.LEAVE_REQUESTS = data;
            else if (target === 'hrDocuments') state.HR_DOCS = data;
            else if (target === 'purchaseOrders') state.PURCHASE_ORDERS = data;
            else if (target === 'supplierInvoices') state.SUPPLIER_INVOICES = data;
            else if (target === 'generalLedger') state.GENERAL_LEDGER = data;
            else if (target === 'userRoles') state.USER_ROLES_LIST = data;
            
            updateAllMetrics(); 
        });
    };

    init('products', 'products');
    init('employees', 'employees');
    init('suppliers', 'suppliers');
    init('salesLog', 'salesLog');
    init('inventoryLog', 'inventoryLog');
    init('payrollLog', 'payrollLog');
    init('expensesLog', 'expensesLog'); 
    init('fixedAssets', 'assets');
    init('leaveRequests', 'leaveRequests');
    init('hrDocuments', 'hrDocuments'); 
    init('purchaseOrders', 'purchaseOrders');
    init('supplierInvoices', 'supplierInvoices');
    init('generalLedger', 'generalLedger'); 
    init('userRoles', 'userRoles');
    
    // Simulation of readiness
    setTimeout(() => {
        state.isDatabaseReady = true;
        document.dispatchEvent(new Event('ui-update-needed'));
    }, 1500);
}