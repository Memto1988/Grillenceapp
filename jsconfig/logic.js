import { state } from './state.js';

export function calculateMonthlyDepreciation() {
    let totalAnnualDepreciation = 0;
    state.REF_DATA.assets.forEach(asset => {
        const purchaseDate = new Date(asset.date);
        const today = new Date();
        if (purchaseDate < today) {
            const annualDepreciation = asset.cost * asset.depreciationRate;
            totalAnnualDepreciation += annualDepreciation;
        }
    });
    return totalAnnualDepreciation / 12;
}

export function calculateWeightedAverageCost(productId) {
    let totalValue = 0;
    let totalQuantity = 0;
    const productInflows = state.INVENTORY_LOG.filter(item => item.id === productId && item.qty > 0 && item.unitCost !== undefined);
    
    productInflows.forEach(item => {
         totalValue += item.qty * item.unitCost;
         totalQuantity += item.qty;
    });
    
    if (totalQuantity === 0) {
        return state.REF_DATA.products.find(p => p.id === productId)?.cost || 0; 
    }
    return totalValue / totalQuantity; 
}

export function calculateSalesMetrics() {
    let totalRevenue = 0;
    let totalCogs = 0;
    const categoryProfits = {};

    state.SALES_LOG.forEach(sale => {
        const product = state.REF_DATA.products.find(p => p.id === sale.id);
        if (product) {
            const revenue = sale.qty * product.price;
            const wac = calculateWeightedAverageCost(sale.id);
            const cogs = sale.qty * wac;
            
            totalRevenue += revenue;
            totalCogs += cogs;
            const profit = revenue - cogs;

            if (!categoryProfits[product.category]) categoryProfits[product.category] = 0;
            categoryProfits[product.category] += profit;
        }
    });

    return { totalRevenue, totalCogs, grossProfit: totalRevenue - totalCogs, categoryProfits };
}

export function calculatePayrollMetrics() {
    const monthlyHoursPerEmployee = {};
    state.PAYROLL_LOG.forEach(shift => {
        const startHour = shift.start;
        const endHour = shift.end > shift.start ? shift.end : shift.end + 24;
        const hours = endHour - startHour;
        if (!monthlyHoursPerEmployee[shift.id]) monthlyHoursPerEmployee[shift.id] = 0;
        monthlyHoursPerEmployee[shift.id] += hours;
    });
    
    let totalSalaryCost = 0;
    let totalHoursLogged = 0;
    let totalEstimatedMonthlyCost = 0; 
    let employeeDetails = {}; 
    const STANDARD_MONTHLY_HOURS = 160; 

    state.REF_DATA.employees.forEach(employee => {
         const empId = employee.id;
         const loggedHours = monthlyHoursPerEmployee[empId] || 0;
         const actualCost = loggedHours * employee.rate;
         const estimatedMonthlyCost = employee.rate * STANDARD_MONTHLY_HOURS; 
         
         totalSalaryCost += actualCost;
         totalHoursLogged += loggedHours;
         totalEstimatedMonthlyCost += estimatedMonthlyCost;

         employeeDetails[empId] = {
            name: employee.name,
            rate: employee.rate,
            loggedHours: loggedHours,
            actualCost: actualCost,
            estimatedMonthlyCost: estimatedMonthlyCost,
            leaveDays: 0, 
            leaveCost: 0 
        };
    });

    state.LEAVE_REQUESTS.filter(req => req.status === 'Approved').forEach(req => {
        if (employeeDetails[req.id]) {
            const hours = req.days * 8; 
            employeeDetails[req.id].leaveDays += req.days;
            employeeDetails[req.id].leaveCost += hours * employeeDetails[req.id].rate;
        }
    });
    
    const averageRate = totalHoursLogged > 0 ? totalSalaryCost / totalHoursLogged : 0;
    return { totalSalaryCost, monthlyHoursPerEmployee, totalHoursLogged, averageRate, totalEstimatedMonthlyCost, employeeDetails };
}

export function calculateExpensesMetrics(payrollCost, depreciationCost) {
    let totalOperatingExpenses = 0;
    state.REF_DATA.expensesLog.forEach(expense => totalOperatingExpenses += expense.amount);
    totalOperatingExpenses += payrollCost;
    totalOperatingExpenses += depreciationCost;
    return totalOperatingExpenses;
}

export function calculateInventoryStatus() {
    const stockLevels = {};
    const lowStockAlerts = [];

    state.INVENTORY_LOG.forEach(item => {
        if (!stockLevels[item.id]) stockLevels[item.id] = 0;
        stockLevels[item.id] += item.qty;
    });

    state.SALES_LOG.forEach(sale => {
        if (!stockLevels[sale.id]) stockLevels[sale.id] = 0;
        stockLevels[sale.id] -= sale.qty;
    });
    
    state.REF_DATA.products.forEach(product => {
        const currentStock = stockLevels[product.id] || 0;
        if (product.reorder !== 9999 && currentStock < product.reorder) {
            lowStockAlerts.push({ id: product.id, name: product.name, current: currentStock, reorder: product.reorder });
        }
        stockLevels[product.id] = currentStock;
    });

    return { stockLevels, lowStockAlerts };
}

export function calculateGLBalances() {
    const balances = {};
    state.GENERAL_LEDGER.forEach(entry => {
        if (balances[entry.debitAccount] === undefined) balances[entry.debitAccount] = 0;
        if (balances[entry.creditAccount] === undefined) balances[entry.creditAccount] = 0;
        balances[entry.debitAccount] += entry.amount;
        balances[entry.creditAccount] -= entry.amount;
    });
    return balances;
}

export function generateIncomeStatement(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const periodData = state.GENERAL_LEDGER.filter(entry => {
        const d = new Date(entry.date);
        return d >= start && d <= end;
    });

    let revenue = 0, cogs = 0, operatingExpenses = 0, payrollExpense = 0;
    
    const periodDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const monthlyDepreciation = calculateMonthlyDepreciation(); 
    const depreciationExpense = monthlyDepreciation * (periodDays / 30.44);

    periodData.forEach(entry => {
        const debitCode = parseInt(entry.debitAccount);
        const creditCode = parseInt(entry.creditAccount);
        
        if (creditCode >= 4000 && creditCode < 5000) revenue += entry.amount;
        if (debitCode >= 5000 && debitCode < 6000) cogs += entry.amount;
        if (debitCode >= 6000 && debitCode < 7000) {
            if (debitCode === 6000) payrollExpense += entry.amount; 
            else if (debitCode !== 6400) operatingExpenses += entry.amount;
        }
    });
    
    const totalOperatingExpenses = payrollExpense + operatingExpenses + depreciationExpense;
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - totalOperatingExpenses;
    
    return { startDate, endDate, revenue, cogs, grossProfit, payrollExpense, operatingExpenses, depreciationExpense, totalOperatingExpenses, netProfit };
}

export function generateBalanceSheet() {
    const fullBalances = calculateGLBalances();
    const salesMetrics = calculateSalesMetrics();
    const payrollMetrics = calculatePayrollMetrics();
    const monthlyDepreciation = calculateMonthlyDepreciation(); 
    const expensesMetrics = calculateExpensesMetrics(payrollMetrics.totalSalaryCost, monthlyDepreciation);
    const totalNetProfitProxy = salesMetrics.grossProfit - expensesMetrics; 

    const assets = { total: 0, details: [] };
    const liabilities = { total: 0, details: [] };
    const equity = { total: 0, details: [] };
    
    for (const code in fullBalances) {
        const balance = fullBalances[code];
        const codePrefix = parseInt(code.toString().substring(0, 1));
        if (Math.abs(balance) < 0.01) continue; 

        if (codePrefix === 1) { 
            assets.total += balance;
            assets.details.push({ code, balance });
        } else if (codePrefix === 2) {
             const absBalance = Math.abs(balance);
             liabilities.total += absBalance;
             liabilities.details.push({ code, balance: absBalance });
        } else if (codePrefix === 3) {
            if (code === '3000') {
                 const absBalance = Math.abs(balance);
                 equity.total += absBalance;
                 equity.details.push({ code, balance: absBalance });
            } else if (code === '3100') {
                 equity.total -= balance; 
                 equity.details.push({ code, balance: balance * -1 }); 
            }
        }
    }
    equity.total += totalNetProfitProxy;
    equity.details.push({ code: '3999', balance: totalNetProfitProxy });
    const check = assets.total - (liabilities.total + equity.total); 
    return { assets, liabilities, equity, check };
}