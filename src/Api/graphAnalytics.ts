import axios from "axios";
import { API } from "../constants/api";
import dayjs from "dayjs";

/* ================= TYPES ================= */

export interface GraphRow {
    Date: string;
    Invoice_Count: number;
    Tonnage: number;
    Invoice_Value: number;
}

/* ================= URL BUILDER ================= */

const buildUrl = (
    type: "SALES" | "PURCHASE" | "STOCK",
    from: string,
    to: string,
    companyId?: number
) => {
    if (type === "SALES") return API.dashboardsalesgraph(from, to, companyId);
    if (type === "PURCHASE") return API.dashboardpurchasegraph(from, to, companyId);
    return API.dashboardstockvaluegraph(from, to, companyId);
};

/* ================= MAIN FUNCTION ================= */

export const fetchGraphicalAnalysis = async (
    type: "SALES" | "PURCHASE" | "STOCK",
    _fromDate: Date,
    _toDate: Date,
    companyId?: number
): Promise<GraphRow[]> => {
    try {
        /* ✅ DATE RANGE (Current Month) */
        const from = dayjs(_fromDate).format("YYYY-MM-DD");
        const to = dayjs(_toDate).format("YYYY-MM-DD");

        console.log("DATE RANGE 👉", { from, to });

        const res = await axios.get(buildUrl(type, from, to, companyId));
        const api = res?.data;

        if (!api?.success) return [];

        const dayWise = api?.data?.DayWise || [];
        const tonnageArr = api?.data?.DayWiseTonnage || [];

        /* ================= MAP ================= */

        const map: Record<string, GraphRow> = {};

        /* 🔹 HANDLE DAYWISE (COUNT + VALUE) */
        dayWise.forEach((item: any) => {
            const rawDate =
                item?.Date ||
                item?.date ||
                item?.Invoice_Date ||
                item?.invoice_date ||
                item?.Trans_Date; // ✅ for Stock API

            if (!rawDate) return;

            const key = dayjs(rawDate).format("YYYY-MM-DD");

            if (!map[key]) {
                map[key] = {
                    Date: key,
                    Invoice_Count: 0,
                    Invoice_Value: 0,
                    Tonnage: 0,
                };
            }

            /* ✅ COUNT */
            map[key].Invoice_Count += Number(
                item?.Invoice_Count ??
                item?.invoice_count ??
                item?.Group_Count ?? // ✅ for Stock API
                0
            );

            /* ✅ VALUE */
            map[key].Invoice_Value += Number(
                item?.Total_Invoice_value ?? // ✅ Sales/Purchase
                item?.Total_value ??         // ✅ Stock
                item?.Invoice_Value ??
                item?.invoice_value ??
                item?.Value ??
                item?.Total ??
                0
            );
        });

        /* 🔹 HANDLE TONNAGE */
        tonnageArr.forEach((item: any) => {
            const rawDate =
                item?.Date ||
                item?.date ||
                item?.Invoice_Date ||
                item?.Trans_Date; // ✅ for Stock API

            if (!rawDate) return;

            const key = dayjs(rawDate).format("YYYY-MM-DD");

            if (!map[key]) {
                map[key] = {
                    Date: key,
                    Invoice_Count: 0,
                    Invoice_Value: 0,
                    Tonnage: 0,
                };
            }

            /* ✅ TONNAGE */
            map[key].Tonnage += Number(
                item?.Total_Tons ??   // ✅ MAIN FIX
                item?.Tonnage ??
                item?.tonnage ??
                0
            );
        });

        /* ================= FINAL SORT ================= */

        const finalData = Object.values(map).sort(
            (a, b) => dayjs(a.Date).unix() - dayjs(b.Date).unix()
        );

        console.log("✅ FINAL GRAPH DATA 👉", finalData);

        return finalData;

    } catch (err) {
        console.error("❌ GRAPH ERROR:", err);
        return [];
    }
};