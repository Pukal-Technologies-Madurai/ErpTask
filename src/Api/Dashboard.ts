import { API } from "../constants/api";

export const getSalesGraph = async (
    from: string,
    to: string,
    companyId?: number,
) => {
    try {
        const url = API.dashboardsalesgraph(from, to);
        // console.log("Dashboard URL", url);
        const res = await fetch(url);
        const json = await res.json();

        // ✅ FIX: return actual data object
        if (json?.success && json?.data) {
            return json.data;
        }

        return null;
    } catch (err) {
        console.error("SalesGraph API Error:", err);
        return null;
    }
};
