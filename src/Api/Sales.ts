import { API } from "../constants/api";
import SaleInvoice from "../Screens/Sales/SaleInvoice";

/**
 * Fetch Sales Invoice data with optional filters
 */
export const salesInvoice = async (
    from: Date | string,
    to: Date | string,
    userId: any,
    branchId: any,
    filters: Record<string, any> = {},
    // filter1: any,
    // filter2: any,
    // filter3: any
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        // Base URL from API config
        let url = API.salesInvoice(fromStr, toStr, userId, branchId);

        // ✅ Append dynamic filters (if provided)
        const filterParams = Object.entries(filters)
            .filter(([_, v]) => v !== "" && v !== null && v !== undefined)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");

        if (filterParams) {
            url += (url.includes("?") ? "&" : "?") + filterParams;
        }

        console.log("salesInvoice url", url);

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        if (!json.success) {
            throw new Error(
                json.message || "Failed to fetch sales invoice data"
            );
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching sales invoice data:", error);
        throw error;
    }
};

/**
 * Fetch Sales Order Invoice data (unchanged, no filters)
 */
export const salesOrderInvoice = async (
    from: Date | string,
    to: Date | string,
    userId: any,
    branchId: any
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.salesOrderInvoice(fromStr, toStr, userId, branchId);
        console.log("API URL =", url);

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        if (!json.success) {
            throw new Error(
                json.message || "Failed to fetch sales invoice data"
            );
        }
        return json.data || [];
    } catch (error) {
        console.error("Error fetching sales order invoice data:", error);
        throw error;
    }
};

export const fetchSalesInvoiceFilters = async () => {
    try {
        const url = API.getReportFilters("Sales Invoice");
        console.log("Fetching filters from:", url);

        const res = await fetch(url);

        const text = await res.text();

        if (text.trim().startsWith("<")) {
            throw new Error("Received HTML instead of JSON");
        }

        const json = JSON.parse(text);

        if (!json.success) {
            throw new Error("Failed to fetch filters");
        }

        return json.data || [];

    } catch (err) {
        console.error("Error fetching filters:", err);
        throw err;
    }
};

export const DeliveryPendingList = async (
    from: Date | string,
    to: Date | string,
    userId: any,
    branchId: any
) => {
    try {
        const fromStr = typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr = typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.deliveryPending(fromStr, toStr, userId, branchId);

        const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        const json = await res.json();

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        if (!json.success)
            throw new Error(json.message || "Failed to fetch delivery data");

        return json.data || [];
    } catch (error) {
        console.error("Error fetching delivery data:", error);
        throw error;
    }

};

export const salesOrderPendingList = async (
    from: Date | string,
    to: Date | string,
    userId: any,
    branchId: number | string,
    filters?: Record<string, string>
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        // Base URL (same as before)
        let url = API.saleorderPending(fromStr, toStr, userId, branchId);

        // ✅ APPEND DYNAMIC FILTERS
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    url += `&${key}=${encodeURIComponent(value)}`;
                }
            });
        }

        console.log("API URL =", url);

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const json = await res.json();

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        if (!json.success) {
            throw new Error(
                json.message || "Failed to fetch sale order pending data"
            );
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching sale order pending data:", error);
        throw error;
    }
};

export const salesOrderPendingItemList = async (
    from: Date | string,
    to: Date | string,
    userId: any,
    branchId: number | string,
    filters?: Record<string, string>
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        // Base URL (same as before)
        let url = API.saleorderPendingItem(fromStr, toStr, userId, branchId);

        // ✅ APPEND DYNAMIC FILTERS
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    url += `&${key}=${encodeURIComponent(value)}`;
                }
            });
        }

        console.log("API URL =", url);

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const json = await res.json();

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        if (!json.success) {
            throw new Error(
                json.message || "Failed to fetch sale order pending data"
            );
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching sale order pending data:", error);
        throw error;
    }
};


export const getFilterColumnName = async () => {
    try {
        
        const url = API.getReportFilters("Sales Invoice"); 
        console.log("getFilterColumnName url", url);

        const res = await fetch(url, { 
            method: "GET", 
            headers: { "Content-Type": "application/json" } 
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Failed to fetch filter column name");
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching filter column name:", error);
        throw error;
    }
    
};

export const getFilterSaleorderPending = async () => {
    try {
        
        const url = API.getReportFilters("SalesReturn"); 
        console.log("getFilterColumnName url", url);

        const res = await fetch(url, { 
            method: "GET", 
            headers: { "Content-Type": "application/json" } 
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Failed to fetch filter column name");
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching filter column name:", error);
        throw error;
    }
    
};



