import { API } from "../constants/api";

/**
 * Fetch Retailers with optional filters
 */
export const getRetailers = async (
  from: Date | string,
  to: Date | string,
  filters: Record<string, any> = {}
) => {
  try {
    const fromStr = typeof from === "string" ? from : from.toISOString().split("T")[0];
    const toStr = typeof to === "string" ? to : to.toISOString().split("T")[0];

    // Base URL from API config
    let url = API.geRetailers(fromStr, toStr);

    // Append dynamic filters
    const filterParams = Object.entries(filters)
      .filter(([_, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    if (filterParams) {
      url += (url.includes("?") ? "&" : "?") + filterParams;
    }

    console.log("getRetailers url:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    if (!json.success) {
      throw new Error(json.message || "Failed to fetch retailers");
    }

    return json.data || [];
  } catch (error) {
    console.error("Error fetching retailers:", error);
    throw error;
  }
};
