import { MMKV } from "react-native-mmkv";
const storage = new MMKV();

let baseURL = storage.getString("baseURL") || "https://erpsmt.in/";
// const baseURL = "http://192.168.1.6:9001/api/";

export const baseurl = (url: any) => {
    baseURL = url;
    storage.set("baseURL", url);
};

export const API = {
    getUserAuthInfo: () => `${baseURL}api/authorization/userAuth`,
    userPortal: () =>
        `${baseURL}api/authorization/userPortal/accounts?username=`,
    userPortalLogin: () => `${baseURL}api/authorization/userPortal/login`,
    getUserAuthMob: () => `${baseURL}api/authorization/userAuthmobile`,

    getEmpDeptWiseAttendance: (from: string, to: string) =>
        `${baseURL}api/empAttendance/departmentwise?FromDate=${from}&ToDate=${to}`,

    salesInvoice: (
        from: string,
        to: string,
        userId: number,
        branchId?: number,
    ) =>
        `${baseURL}api/sales/salesInvoiceMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    salesInvoiceMobileFilter: (
        from: string,
        to: string,
        userId: number,
        branchId?: number,
    ) =>
        `${baseURL}api/sales/salesInvoiceMobileFilter?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    salesOrderInvoice: (
        from: string,
        to: string,
        userId: number,
        branchId?: number,
    ) =>
        `${baseURL}api/sales/saleOrder?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    deliveryPending: (
        from: string,
        to: string,
        userId: number,
        branchId?: number,
    ) =>
        `${baseURL}api/delivery/deliveryOrderListDataMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    saleorderPendingItem: (
        from: string,
        to: string,
        userId: number | string,
        branchId?: number | string,
    ) =>
        `${baseURL}api/reports/reportsNonconvert/salesMobileItem?Fromdate=${from}&User_Id=${userId}&Todate=${to}&Branch_Id=${
            branchId || ""
        }`,

    purchaseReport: (from: string, to: string) =>
        `${baseURL}api/reports/PurchaseOrderReportCard?Report_Type=2&Fromdate=${from}&Todate=${to}`,

    purchaseOrderEntry: (
        from: string,
        to: string,
        userId: number | string,
        branchId?: number,
    ) =>
        `${baseURL}api/dataEntry/purchaseOrderMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    itemWiseStock: (from: string, to: string) =>
        `${baseURL}api/reports/storageStock/itemWiseMobile?Fromdate=${from}&Todate=${to}`,

    godownWiseStock: (from: string, to: string) =>
        `${baseURL}api/reports/storageStock/godownWiseMobile?Fromdate=${from}&Todate=${to}`,

    getReportFilters: (reportName: string) =>
        `${baseURL}api/sales/salesFilterDropdown?reportName=${encodeURIComponent(
            reportName,
        )}`,

    godownitemwisetransaction: (
        from: string,
        to: string,
        Product_Id?: number,
        Godown_Id?: number,
    ) =>
        `${baseURL}api/reports/godownexpenseReport?fromDate=${from}&toDate=${to}&Product_Id=${Product_Id}&Godown_Id=${Godown_Id}`,

    getIrReportUpload: (reqDate: string) => `${baseURL}api/sales/lrreportUpload?reqDate=${reqDate}`,
    postIrReportUpload: () => `${baseURL}api/sales/lrreportUpload`,
    putIrReportUpdate: () => `${baseURL}api/sales/lrreportUpdate`,

    getDebtorsCreditors: (from: string, to: string) =>
        `${baseURL}api/payment/getDebtorDetails?fromDate=${from}&toDate=${to}`,

    getTransactionReports: (from: string, to: string, AccId?: number) =>
        `${baseURL}api/payment/transactions?fromDate=${from}&toDate=${to}&Acc_Id=${
            AccId || ""
        }`,

    itemStockInfo: (reqDate: string) =>
        `${baseURL}api/reports/itemGroup/stockInfoMobile?reqDate=${reqDate}`,

    getUserBranch: (uID: number) =>
        `${baseURL}api/authorization/userBranches?UserId=${uID}`,

    receiptCollection: (
        from: string,
        to: string,
        userId: number,
        branchId?: number,
    ) =>
        `${baseURL}api/receipt/receiptMasterMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    getPurchaseInvoice: (
        from: string,
        to: string,
        userId: number,
        branchId?: number,
    ) =>
        `${baseURL}api/purchase/purchaseInvoiceMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${
            branchId || ""
        }`,

    geRetailers: (from: string, to: string) =>
        `${baseURL}api/masters/retailersPaginated?`,

    getExpenses: (from: string, to: string) =>
        `${baseURL}api/reports/expenseReport?fromDate=${from}&toDate=${to}`,

    expensesbyId: () => `${baseURL}/api/reports/expenseByAccId`,

    itemtransaction: (from: string, to: string, Product_Id?: number) =>
        `${baseURL}api/reports/itemexpenseReport?fromDate=${from}&toDate=${to}&Product_Id=${Product_Id}`,

    dashboardsalesgraph: (from: string, to: string, Company_Id?: number) =>
        `${baseURL}api/reports/externalAPI/SalesGraph?Fromdate=${from}&Todate=${to}&Company_Id=${Company_Id}`,

    dashboardpurchasegraph: (from: string, to: string, Company_Id?: number) =>
        `${baseURL}api/reports/externalAPI/PurchaseGraph?Fromdate=${from}&Todate=${to}&Company_Id=${Company_Id}`,

    dashboardstockvaluegraph: (from: string, to: string, Company_Id?: number) =>
        `${baseURL}api/reports/externalAPI/StockValueGraph?Fromdate=${from}&Todate=${to}&Company_Id=${Company_Id}`,

    // Not Used API Endpoints
    saleorderPending: (
        from: string,
        to: string,
        userId: number | string,
        branchId?: number | string,
    ) =>
        `${baseURL}api/reports/reportsNonconvert/salesMobile?Fromdate=${from}&User_Id=${userId}&Todate=${to}&Branch_Id=${
            branchId || ""
        }`,
};
