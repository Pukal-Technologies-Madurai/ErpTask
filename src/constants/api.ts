import { MMKV } from "react-native-mmkv";
const storage = new MMKV();

// let baseURL = storage.getString("baseURL") || "http://192.168.3.115:9001/";
export let baseURL = "http://192.168.3.112:9001/";
// const baseURL = "http://192.168.1.18:9001/api/";

export const baseurl = (url: any) => {
    baseURL = url;
    console.log("baseurl", baseURL);
    // storage.set("baseURL", url);
};

export const API = {
    getUserAuthInfo: () => `${baseURL}api/authorization/userAuth`,
    userPortal: () => `${baseURL}api/authorization/userPortal/accounts?username=`,
    userPortalLogin: () => `${baseURL}api/authorization/userPortal/login`,
    getUserAuthMob: () => `${baseURL}api/authorization/userAuthmobile`,

    getEmpDeptWiseAttendance: (from: string, to: string) =>
        `${baseURL}api/empAttendance/departmentwise?FromDate=${from}&ToDate=${to}`,

    salesInvoice: (from: string, to: string, userId: number, branchId?: number) =>
        `${baseURL}api/sales/salesInvoiceMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${branchId || ''}`,

    salesOrderInvoice: (from: string, to: string, userId: number, branchId?: number) =>
        `${baseURL}api/sales/saleOrderMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${branchId || ''}`,

    purchaseReport: (from: string, to: string) =>
        `${baseURL}api/reports/PurchaseOrderReportCard?Report_Type=2&Fromdate=${from}&Todate=${to}`,

    purchaseOrderEntry: (from: string, to: string, userId: number | string, branchId?: number) =>
        `${baseURL}api/dataEntry/purchaseOrderMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${branchId || ''}`,

    itemWiseStock: (from: string, to: string) =>
        `${baseURL}api/reports/storageStock/itemWise?Fromdate=${from}&Todate=${to}`,

    godownWiseStock: (from: string, to: string) =>
        `${baseURL}api/reports/storageStock/godownWise?Fromdate=${from}&Todate=${to}`,

    itemStockInfo: (reqDate: string) =>
        `${baseURL}api/reports/itemGroup/stockInfo?reqDate=${reqDate}`,

    getUserBranch: (uID: number) =>
        `${baseURL}api/authorization/userBranches?UserId=${uID}`,

    receiptCollection: (from: string, to: string, userId: number, branchId?: number) =>
        `${baseURL}api/receipt/receiptMasterMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${branchId || ''}`,

    getPurchaseInvoice: (from: string, to: string, userId: number, branchId?: number) =>
        `${baseURL}api/purchase/purchaseInvoiceMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${branchId || ''}`,

    getPayment: (from: string, to: string, userId: number, branchId?: number) =>
        `${baseURL}api/payment/paymentMasterMobile?Fromdate=${from}&Todate=${to}&User_Id=${userId}&Branch_Id=${branchId || ''}`,

    salesinvoiceFilter: () =>
        `${baseURL}api/sales/salesFilterDropdown?reportName=${encodeURIComponent("Sales Invoice")}`,
};
