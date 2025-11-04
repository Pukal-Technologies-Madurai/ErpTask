import { API } from "../constants/api";

export const salesInvoice = async (from: Date | string, to: Date | string , userId: any,
    branchId: any,) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.salesInvoice(fromStr, toStr, userId, branchId);
        console.log("salesInvoice url", url)
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
                json.message || "Failed to fetch sales invoice data",
            );
        }
        return json.data || [];
    } catch (error) {
        console.error("Error fetching sales invoice data:", error);
        throw error;
    }
};

export const salesOrderInvoice = async (
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

        const url = API.salesOrderInvoice(fromStr, toStr, userId, branchId);
        // console.log(url)
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
                json.message || "Failed to fetch sales invoice data",
            );
        }
        return json.data || [];
    } catch (error) {
        console.error("Error fetching sales invoice data:", error);
        throw error;
    }
};
