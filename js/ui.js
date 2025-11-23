import { state } from './state.js';
import * as logic from './logic.js';
import { getAccountName } from './utils.js';

export function updateAllMetrics() {
    if (!state.isAuthReady) return;
    
    const sales = logic.calculateSalesMetrics();
    const payroll = logic.calculatePayrollMetrics();
    const monthlyDep = logic.calculateMonthlyDepreciation();
    const expenses = logic.calculateExpensesMetrics(payroll.totalSalaryCost, monthlyDep);
    const inventory = logic.calculateInventoryStatus();
    const netProfit = sales.grossProfit - expenses;

    document.getElementById('kpi-revenue').innerText = `${state.CURRENCY_SYMBOL} ${sales.totalRevenue.toFixed(2)}`;
    document.getElementById('kpi-profit').innerText = `${state.CURRENCY_SYMBOL} ${sales.grossProfit.toFixed(2)}`;
    document.getElementById('kpi-net-profit').innerText = `${state.CURRENCY_SYMBOL} ${netProfit.toFixed(2)}`;
    document.getElementById('kpi-overhead-cost').innerText = `${state.CURRENCY_SYMBOL} ${expenses.toFixed(2)}`;

    renderCharts(sales, payroll);
    renderInventoryTable(inventory.stockLevels);
    renderFinancialReports();
}

export function renderCharts(salesMetrics, payrollMetrics) {
    // Profit Chart
    const ctx1 = document.getElementById('profit-chart-canvas');
    if (state.charts.profitChart) state.charts.profitChart.destroy();
    state.charts.profitChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(salesMetrics.categoryProfits),
            datasets: [{ data: Object.values(salesMetrics.categoryProfits), backgroundColor: ['#00BFA5', '#FF7043', '#29B6F6', '#66BB6A'] }]
        }
    });
}

export function renderInventoryTable(stockLevels) {
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.REF_DATA.products.forEach(p => {
        const current = stockLevels[p.id] || 0;
        const row = `<tr><td>${p.id}</td><td>${p.name}</td><td class="text-right">${current}</td><td><button onclick="window.openEditProductModal('${p.id}')" class="text-indigo-600">Edit</button></td></tr>`;
        tbody.innerHTML += row;
    });
}

export function renderFinancialReports() {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    if(startDate && endDate && state.currentReport === 'income') {
        const data = logic.generateIncomeStatement(startDate, endDate);
        const tbody = document.getElementById('income-statement-body');
        tbody.innerHTML = `
            <tr class="bg-gray-100 font-bold"><td colspan="2">REVENUE</td></tr>
            <tr><td>Sales (4000)</td><td class="text-right">${state.CURRENCY_SYMBOL} ${data.revenue.toFixed(2)}</td></tr>
            <tr class="bg-gray-100 font-bold"><td colspan="2">EXPENSES</td></tr>
            <tr><td>COGS</td><td class="text-right">(${state.CURRENCY_SYMBOL} ${data.cogs.toFixed(2)})</td></tr>
            <tr class="font-extrabold text-lg bg-teal-50"><td>NET PROFIT</td><td class="text-right">${state.CURRENCY_SYMBOL} ${data.netProfit.toFixed(2)}</td></tr>
        `;
    }
}