export const COA = {
    1000: 'Cash',
    1100: 'Inventory',
    1200: 'Fixed Assets',
    2000: 'Accounts Payable',
    3000: 'Owner\'s Equity',
    3100: 'Owner\'s Draws',
    4000: 'Sales Revenue',
    5000: 'Cost of Goods Sold (COGS)',
    6000: 'Payroll Expense',
    6100: 'Utilities Expense',
    6200: 'Rent Expense',
    6300: 'Maintenance Expense',
    6400: 'Depreciation Expense', 
    6500: 'Franchise Fees Expense',
    9999: 'Suspense/Other Expense',
};

export const getAccountName = (code) => COA[code] || 'Unknown Account';

export function getCollectionPath(name, projectId, storeId) {
    if (!storeId) return null;
    return `artifacts/${projectId}/stores/${storeId}/${name}`; 
}

export function getRolesCollectionPath(projectId) {
     return `artifacts/${projectId}/userRoles`; 
}