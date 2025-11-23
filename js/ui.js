import { state } from './state.js';
import * as logic from './logic.js';

// --- 1. Toast Function (Defined HERE and Exported) ---
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const icon = type === 'success' ? '✅' : '⚠️';
    
    // Design
    toast.className = `toast-message flex items-center p-4 rounded-lg min-w-[300px] mb-3 bg-white border border-gray-200 shadow-lg ${type === 'success' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`;
    
    toast.innerHTML = `
        <span class="text-xl mr-3">${icon}</span>
        <div class="flex-1 font-semibold text-sm text-gray-700">${message}</div>
    `;

    container.appendChild(toast);

    // Animation and Removal
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// --- 2. Button Loading Helper ---
export function setButtonLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (isLoading) {
        btn.classList.add('btn-loading', 'opacity-70', 'cursor-not-allowed');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading', 'opacity-70', 'cursor-not-allowed');
        btn.disabled = false;
    }
}

// --- 3. Metrics & Tables ---
export function updateAllMetrics() {
    if (!state.isAuthReady) return;
    
    const sales = logic.calculateSalesMetrics();
    const payroll = logic.calculatePayrollMetrics();
    const monthlyDep = logic.calculateMonthlyDepreciation();
    const expenses = logic.calculateExpensesMetrics(payroll.totalSalaryCost, monthlyDep);
    const inventory = logic.calculateInventoryStatus();
    const netProfit = sales.grossProfit - expenses;

    // Update KPIs safely
    safeText('kpi-revenue', `${state.CURRENCY_SYMBOL} ${sales.totalRevenue.toFixed(2)}`);
    safeText('kpi-profit', `${state.CURRENCY_SYMBOL} ${sales.grossProfit.toFixed(2)}`);
    safeText('kpi-net-profit', `${state.CURRENCY_SYMBOL} ${netProfit.toFixed(2)}`);
    safeText('kpi-overhead-cost', `${state.CURRENCY_SYMBOL} ${expenses.toFixed(2)}`);
    
    // Alerts
    const alertContainer = document.getElementById('low-stock-list');
    if (alertContainer) {
        alertContainer.innerHTML = '';
        if (inventory.lowStockAlerts.length === 0) {
            alertContainer.innerHTML = '<p class="text-gray-400 text-sm">✅ Stock is healthy</p>';
        } else {
            inventory.lowStockAlerts.forEach(alert => {
                alertContainer.innerHTML += `<div class="flex justify-between bg-red-50 text-red-800 p-3 rounded mb-2 border border-red-100"><span class="truncate font-medium">${alert.name}</span><span class="font-bold">${alert.current} / ${alert.reorder}</span></div>`;
            });
        }
    }

    renderCharts(sales);
    renderInventoryTable(inventory.stockLevels);
    renderFinancialReports();
    renderAdminTable();
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
}

export function renderCharts(salesMetrics) {
    const ctx = document.getElementById('profit-chart-canvas');
    if (ctx) {
        if (state.charts.profitChart) state.charts.profitChart.destroy();
        state.charts.profitChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(salesMetrics.categoryProfits),
                datasets: [{ data: Object.values(salesMetrics.categoryProfits), backgroundColor: ['#2dd4bf', '#fb923c', '#38bdf8', '#a78bfa'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

export function renderInventoryTable(stockLevels) {
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.REF_DATA.products.forEach(p => {
        const current = stockLevels[p.id] || 0;
        tbody.innerHTML += `<tr class="hover:bg-gray-50 border-b"><td class="px-6 py-4 font-medium">${p.id}</td><td class="px-6 py-4">${p.name}</td><td class="px-6 py-4 text-right font-bold text-teal-700">${current}</td><td class="px-6 py-4"><button onclick="window.openEditProductModal('${p.id}')" class="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button></td></tr>`;
    });
}

export function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.USER_ROLES_LIST.forEach(user => {
        const isMe = user.uid === state.userId;
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b">
                <td class="px-6 py-4 font-mono text-xs text-gray-500">${user.uid.substring(0, 8)}...</td>
                <td class="px-6 py-4">${user.email || 'N/A'}</td>
                <td class="px-6 py-4 font-bold text-teal-600">${user.role.toUpperCase()}</td>
                <td class="px-6 py-4">
                    <select onchange="window.updateUserRole('${user.uid}', this.value)" class="p-1 border rounded text-sm" ${isMe ? 'disabled' : ''}>
                        <option value="admin" ${user.role === 'admin'?'selected':''}>Admin</option>
                        <option value="manager" ${user.role === 'manager'?'selected':''}>Manager</option>
                        <option value="employee" ${user.role === 'employee'?'selected':''}>Employee</option>
                    </select>
                </td>
            </tr>`;
    });
}

export function renderFinancialReports() {
    const startDateEl = document.getElementById('report-start-date');
    const endDateEl = document.getElementById('report-end-date');
    
    // Default dates if empty
    if(startDateEl && !startDateEl.value) {
        const today = new Date();
        startDateEl.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDateEl.value = today.toISOString().split('T')[0];
    }

    if(!startDateEl || !endDateEl) return;

    const startDate = startDateEl.value;
    const endDate = endDateEl.value;

    if(state.currentReport === 'income') {
        const data = logic.generateIncomeStatement(startDate, endDate);
        const tbody = document.getElementById('income-statement-body');
        if(tbody) {
            tbody.innerHTML = `
                <tr class="bg-gray-100 font-bold"><td colspan="2" class="px-4 py-2 text-gray-600">REVENUE</td></tr>
                <tr class="border-b"><td class="px-6 py-4">Sales Revenue</td><td class="px-6 py-4 text-right font-medium">${state.CURRENCY_SYMBOL} ${data.revenue.toFixed(2)}</td></tr>
                <tr class="bg-gray-100 font-bold"><td colspan="2" class="px-4 py-2 text-gray-600">EXPENSES</td></tr>
                <tr class="border-b"><td class="px-6 py-4">Cost of Goods Sold (COGS)</td><td class="px-6 py-4 text-right text-red-600 font-medium">(${state.CURRENCY_SYMBOL} ${data.cogs.toFixed(2)})</td></tr>
                <tr class="border-b"><td class="px-6 py-4">Operating Expenses</td><td class="px-6 py-4 text-right text-red-600 font-medium">(${state.CURRENCY_SYMBOL} ${data.totalOperatingExpenses.toFixed(2)})</td></tr>
                <tr class="font-extrabold text-lg bg-teal-50 border-t-2 border-teal-200"><td class="px-6 py-4 text-teal-900">NET PROFIT</td><td class="px-6 py-4 text-right text-teal-900">${state.CURRENCY_SYMBOL} ${data.netProfit.toFixed(2)}</td></tr>
            `;
        }
    }
}
