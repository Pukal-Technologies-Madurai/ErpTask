import { API } from "../constants/api";

export const fetchPaymentList = async (
    from: Date | string,
    to: Date | string,
    userId : any,
    branchId: any
) => {
    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        // Use your new backend endpoint for branch-wise filtering
        const url = API.getPayment(fromStr, toStr, userId, branchId);

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
            throw new Error(json.message || "Failed to fetch payment data");
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching payment data:", error);
        throw error;
    }
};
