import { MMKV } from "react-native-mmkv";
const storage = new MMKV();

let baseURL = storage.getString("baseURL") || "https://erpsmt.in/";
// const baseURL = "http://192.168.1.18:9001/api/";

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

    salesInvoice: (from: string, to: string) =>
        `${baseURL}api/sales/salesInvoice?Fromdate=${from}&Todate=${to}&Retailer_Id=&Created_by=&VoucherType=&Cancel_status=`,

    salesOrderInvoice: (from: string, to: string) =>
        `${baseURL}api/sales/saleOrder?Fromdate=${from}&Todate=${to}`,

    purchaseReport: (from: string, to: string) =>
        `${baseURL}api/reports/PurchaseOrderReportCard?Report_Type=2&Fromdate=${from}&Todate=${to}`,

    purchaseOrderEntry: (from: string, to: string) =>
        `${baseURL}api/dataEntry/purchaseOrderEntry?Fromdate=${from}&Todate=${to}`,

    itemWiseStock: (from: string, to: string) =>
        `${baseURL}api/reports/storageStock/itemWise?Fromdate=${from}&Todate=${to}`,

    godownWiseStock: (from: string, to: string) =>
        `${baseURL}api/reports/storageStock/godownWise?Fromdate=${from}&Todate=${to}`,

    itemStockInfo: (reqDate: string) =>
        `${baseURL}api/reports/itemGroup/stockInfo?reqDate=${reqDate}`,
};
