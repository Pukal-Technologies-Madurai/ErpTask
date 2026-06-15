import { API } from "../constants/api"; 

export const fetchExpenses = async (
  from: Date | string,
  to: Date | string
) => {
  try {
    const fromStr =
      typeof from === "string"
        ? from
        : from.toISOString().split("T")[0];

    const toStr =
      typeof to === "string"
        ? to
        : to.toISOString().split("T")[0];

    const url = API.getExpenses(fromStr, toStr);
    console.log("Expenses URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const text = await res.text(); // 👈 read as text first

    // 🔴 HTML RESPONSE DETECTION (login / error pages)
    if (text.startsWith("<")) {
      console.error("HTML Response received:", text);
      throw new Error("API returned HTML instead of JSON");
    }

    const json = JSON.parse(text);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    // API returns: { data: [...] }
    return json.data || [];
  } catch (error) {
    console.error("Error fetching expenses:", error);
    throw error;
  }
};
