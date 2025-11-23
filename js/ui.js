import { state } from './state.js';
import * as logic from './logic.js';
import { showToast } from './main.js'; // Use helper from Main if needed, or duplicate logic

export function showToastUI(message, type = 'success') {
    // Same Toast logic as before...
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const icon = type === 'success' ? '✅' : '⚠️';
    toast.className = `toast-message flex items-center p-4 rounded-lg min-w-[300px] mb-3 bg-white ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    toast.innerHTML = `<span class="text-xl mr-3">${icon}</span><div class="flex-1 font-semibold text-sm">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

export function updateAllMetrics() {
    if (!state.isAuthReady) return;
    
    const sales = logic.calculateSalesMetrics();
    const payroll = logic.calculatePayrollMetrics();
    const monthlyDep = logic.calculateMonthlyDepreciation();
    const expenses = logic.calculateExpensesMetrics(payroll.totalSalaryCost, monthlyDep);
    const inventory = logic.calculateInventoryStatus();
    const netProfit = sales.grossProfit - expenses;

    // Update KPIs
    safeText('kpi-revenue', `${state.CURRENCY_SYMBOL} ${sales.totalRevenue.toFixed(2)}`);
    safeText('kpi-profit', `${state.CURRENCY_SYMBOL} ${sales.grossProfit.toFixed(2)}`);
    safeText('kpi-net-profit', `${state.CURRENCY_SYMBOL} ${netProfit.toFixed(2)}`);
    safeText('kpi-overhead-cost', `${state.CURRENCY_SYMBOL} ${expenses.toFixed(2)}`);
    
    // Alerts
    const alertContainer = document.getElementById('low-stock-list');
    if (alertContainer) {
        alertContainer.innerHTML = '';
        inventory.lowStockAlerts.forEach(alert => {
            alertContainer.innerHTML += `<div class="flex justify-between bg-red-100 text-red-800 p-3 rounded mb-2"><span class="truncate">${alert.name}</span><span>${alert.current}/${alert.reorder}</span></div>`;
        });
    }

    renderCharts(sales, payroll);
    renderInventoryTable(inventory.stockLevels);
    renderFinancialReports();
    renderAdminTable();
    // Add other renderers here if needed (Supplier Table, PO Table, etc.)
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
}

export function renderCharts(salesMetrics, payrollMetrics) {
    const ctx = document.getElementById('profit-chart-canvas');
    if (ctx) {
        if (state.charts.profitChart) state.charts.profitChart.destroy();
        state.charts.profitChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(salesMetrics.categoryProfits),
                datasets: [{ data: Object.values(salesMetrics.categoryProfits), backgroundColor: ['#00BFA5', '#FF7043', '#29B6F6', '#66BB6A'] }]
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
        tbody.innerHTML += `<tr class="hover:bg-gray-50"><td class="px-6 py-4">${p.id}</td><td class="px-6 py-4">${p.name}</td><td class="px-6 py-4 text-right font-bold">${current}</td><td class="px-6 py-4"><button onclick="window.openEditProductModal('${p.id}')" class="text-indigo-600">Edit</button></td></tr>`;
    });
}

export function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.USER_ROLES_LIST.forEach(user => {
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">${user.email || 'N/A'}</td>
                <td class="px-6 py-4 font-bold text-teal-600">${user.role.toUpperCase()}</td>
                <td class="px-6 py-4">
                    <select onchange="window.updateUserRole('${user.uid}', this.value)" class="p-1 border rounded">
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
    if(!startDateEl || !endDateEl) return;

    const startDate = startDateEl.value;
    const endDate = endDateEl.value;

    if(startDate && endDate && state.currentReport === 'income') {
        const data = logic.generateIncomeStatement(startDate, endDate);
        const tbody = document.getElementById('income-statement-body');
        if(tbody) {
            tbody.innerHTML = `
                <tr class="bg-gray-100 font-bold"><td colspan="2" class="px-4 py-2">REVENUE</td></tr>
                <tr><td class="px-6 py-4">Sales Revenue</td><td class="px-6 py-4 text-right">${state.CURRENCY_SYMBOL} ${data.revenue.toFixed(2)}</td></tr>
                <tr class="bg-gray-100 font-bold"><td colspan="2" class="px-4 py-2">EXPENSES</td></tr>
                <tr><td class="px-6 py-4">COGS</td><td class="px-6 py-4 text-right text-red-600">(${state.CURRENCY_SYMBOL} ${data.cogs.toFixed(2)})</td></tr>
                <tr><td class="px-6 py-4">Operating Expenses</td><td class="px-6 py-4 text-right text-red-600">(${state.CURRENCY_SYMBOL} ${data.totalOperatingExpenses.toFixed(2)})</td></tr>
                <tr class="font-extrabold text-lg bg-teal-50"><td class="px-6 py-4">NET PROFIT</td><td class="px-6 py-4 text-right">${state.CURRENCY_SYMBOL} ${data.netProfit.toFixed(2)}</td></tr>
            `;
        }
    }
}