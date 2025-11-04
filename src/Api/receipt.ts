import { API } from "../constants/api";

export const fetchReceiptList = async (
    from: Date | string,
    to: Date | string,
    userId : any,
    branchId : any
) => {

    try {
        const fromStr =
            typeof from === "string" ? from : from.toISOString().split("T")[0];
        const toStr =
            typeof to === "string" ? to : to.toISOString().split("T")[0];

        const url = API.receiptCollection(fromStr, toStr,userId,branchId );
        // console.log("Receipt List URL:", url);

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
            throw new Error(json.message || "Failed to fetch receipt data");
        }

        return json.data || [];
    } catch (error) {
        console.error("Error fetching receipt data:", error);
        throw error;
    }
};
