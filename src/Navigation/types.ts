interface SaleOrderInvoiceParams {
    branchId: any;
}

interface SaleInvoiceParams {
    branchId: any;
}

interface purchaseInvoiceParams {
    branchId: any;
}

interface PurchaseOrderParams {
    branchId: any;
}

interface paymentListParams {
    branchId: any;
}

interface receiptListParams  {
    branchId: any;
}

interface deliveryPendParams {
    branchId: any;
}

interface saleorderpendParams {
    branchId: any;
}

interface salependorderparams {
    branchId:any;
}

interface salependitemparams {
    branchId:any;
}

interface transactionparams {
    branchId:any;
}

interface debtorsparams {
    branchId:any;
}

interface expensesparams {
    branchId: any;
}

export type BottomTabParamList = {
    Home: undefined;
    Attendance: undefined;
    Settings: undefined;
    Stock: undefined;
};

export type DrawerParamList = {
    HomeTab: undefined;
    Profile: undefined;
    CompanySwitch: undefined;

    invoiceSale: SaleInvoiceParams;
    purchaseInvoice: purchaseInvoiceParams;
    saleOrderInvoice: undefined;
    Attendance: undefined;
};

export type RootStackParamList = {
    Splash: undefined;
    Login: undefined;
    MainDrawer: undefined;
    CompanySwitch: undefined;
    setting: undefined;
    profile: undefined;
    Home: undefined;
    Stock: undefined;
    Stockitem:undefined;
    Stockgodown:undefined;
    receiptList: receiptListParams;

    invoiceSale: SaleInvoiceParams;
    saleOrderInvoice: SaleOrderInvoiceParams;
    PurchaseReportSummary: undefined;
    purchaseOrder: PurchaseOrderParams;
    purchaseInvoice : purchaseInvoiceParams;
    ItemStack: undefined;
    paymentList: paymentListParams;
    deliveryPend: deliveryPendParams;
    saleorderpend: saleorderpendParams;
    saleorderpendorder: salependorderparams;
    saleorderpenditem: salependitemparams;
    transaction: transactionparams;
    transactionlist: undefined;
    debtors: debtorsparams;
    expenses: expensesparams;
    transactionlistexp:undefined;
};
