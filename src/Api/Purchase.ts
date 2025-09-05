import { API } from "../constants/api";

export const getPurchaseReport = async (
    from: Date | string,
    to: Date | string,
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
                Db: "1",
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
        // console.error("Error fetching sales invoice data:", error);
        throw error;
    }
};

export const getPurchaseOrderEntry = async (
    from: Date | string,
    to: Date | string,
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.purchaseOrderEntry(fromStr, toStr);
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
