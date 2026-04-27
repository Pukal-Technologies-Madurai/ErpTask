import { API } from "../constants/api";

// ✅ Fetch Purchase Report (no change)
export const getPurchaseReport = async (
    from: Date | string,
    to: Date | string,
    dbId: string,
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.purchaseReport(fromStr, toStr);
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Db: dbId.toString(),
            },
        });

        const json = await res.json();
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        if (!json.success)
            throw new Error(
                json.message || "Failed to fetch purchase report data",
            );

        return json.data || [];
    } catch (error) {
        throw error;
    }
};

// ✅ Enhanced Purchase Order Entry (Mobile with branch/user access)
export const getPurchaseOrderEntry = async (
    from: Date | string,
    to: Date | string,
    userId?: number | string,
    branchId?: number,
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.purchaseOrderEntry(
            fromStr,
            toStr,
            userId !== undefined ? parseInt(userId as string) || userId : "",
            branchId,
        );
        console.log("Purchase Order Entry URL:", url);

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const json = await res.json();
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        if (!json.success)
            throw new Error(
                json.message || "Failed to fetch purchase order data",
            );

        return json.data || [];
    } catch (error) {
        console.error("Error fetching purchase order data:", error);
        throw error;
    }
};

//purchaseInvoice//
export const getpurchaseInvoiceEntry = async (
    from: Date | string,
    to: Date | string,
    userId: any,
    branchId: any,
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.getPurchaseInvoice(fromStr, toStr, userId, branchId);
        // console.log("url", url);

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
                json.message || "Failed to fetch purchase invoice data",
            );
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching purchase invoice data:", error);
        throw error;
    }
};
