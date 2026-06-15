import { API } from "../constants/api";

export const getShetList = async (date: string) => {
    try {
        const url = API.getIrReportUpload(date);
        // console.log("ShetSheet URL", url);
        const res = await fetch(url);
        const json = await res.json();

        if (json?.success && json?.data) {
            return json.data;
        }

        return null;
    } catch (err) {
        console.error("ShetSheet API Error:", err);
        return null;
    }
};
