// js/ui.js
import { state } from './state.js';
import * as logic from './logic.js';
import { getAccountName } from './utils.js';

// --- NEW: Toast Notification System ---
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Guard clause

    const toast = document.createElement('div');
    
    // Icon selection
    const icon = type === 'success' ? '✅' : '⚠️';
    
    toast.className = `toast-message flex items-center p-4 rounded-lg shadow-lg min-w-[300px] mb-3 bg-white ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    toast.innerHTML = `
        <span class="text-xl mr-3">${icon}</span>
        <div class="flex-1 text-sm font-semibold">${message}</div>
    `;

    container.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// --- NEW: Button Loading Helper ---
export function setButtonLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (isLoading) {
        btn.classList.add('btn-loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

// --- Existing Functions ---

export function updateAllMetrics() {
    if (!state.isAuthReady) return;
    
    const sales = logic.calculateSalesMetrics();
    const payroll = logic.calculatePayrollMetrics();
    const monthlyDep = logic.calculateMonthlyDepreciation();
    const expenses = logic.calculateExpensesMetrics(payroll.totalSalaryCost, monthlyDep);
    const inventory = logic.calculateInventoryStatus();
    const netProfit = sales.grossProfit - expenses;

    const elRevenue = document.getElementById('kpi-revenue');
    if(elRevenue) elRevenue.innerText = `${state.CURRENCY_SYMBOL} ${sales.totalRevenue.toFixed(2)}`;
    
    const elProfit = document.getElementById('kpi-profit');
    if(elProfit) elProfit.innerText = `${state.CURRENCY_SYMBOL} ${sales.grossProfit.toFixed(2)}`;

    const elNet = document.getElementById('kpi-net-profit');
    if(elNet) elNet.innerText = `${state.CURRENCY_SYMBOL} ${netProfit.toFixed(2)}`;
    
    const elOverhead = document.getElementById('kpi-overhead-cost');
    if(elOverhead) elOverhead.innerText = `${state.CURRENCY_SYMBOL} ${expenses.toFixed(2)}`;

    renderCharts(sales, payroll);
    renderInventoryTable(inventory.stockLevels);
    renderFinancialReports();
}

export function renderCharts(salesMetrics, payrollMetrics) {
    const ctx1 = document.getElementById('profit-chart-canvas');
    if (!ctx1) return;

    if (state.charts.profitChart) state.charts.profitChart.destroy();
    
    state.charts.profitChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(salesMetrics.categoryProfits),
            datasets: [{ data: Object.values(salesMetrics.categoryProfits), backgroundColor: ['#00BFA5', '#FF7043', '#29B6F6', '#66BB6A'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

export function renderInventoryTable(stockLevels) {
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.REF_DATA.products.forEach(p => {
        const current = stockLevels[p.id] || 0;
        const row = `<tr class="hover:bg-gray-50">
            <td class="px-6 py-4">${p.id}</td>
            <td class="px-6 py-4">${p.name}</td>
            <td class="px-6 py-4 text-right font-bold">${current}</td>
            <td class="px-6 py-4"><button onclick="window.openEditProductModal('${p.id}')" class="text-indigo-600 hover:text-indigo-800">Edit</button></td>
        </tr>`;
        tbody.innerHTML += row;
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
        if(!tbody) return;
        
        tbody.innerHTML = `
            <tr class="bg-gray-100 font-bold"><td colspan="2" class="px-4 py-2">REVENUE</td></tr>
            <tr><td class="px-6 py-4">Sales Revenue (4000)</td><td class="px-6 py-4 text-right">${state.CURRENCY_SYMBOL} ${data.revenue.toFixed(2)}</td></tr>
            <tr class="bg-gray-100 font-bold"><td colspan="2" class="px-4 py-2">EXPENSES</td></tr>
            <tr><td class="px-6 py-4">Cost of Goods Sold (COGS)</td><td class="px-6 py-4 text-right text-red-600">(${state.CURRENCY_SYMBOL} ${data.cogs.toFixed(2)})</td></tr>
            <tr class="font-extrabold text-lg bg-teal-50 border-t border-teal-200">
                <td class="px-6 py-4">NET PROFIT</td>
                <td class="px-6 py-4 text-right">${state.CURRENCY_SYMBOL} ${data.netProfit.toFixed(2)}</td>
            </tr>
        `;
    }
}