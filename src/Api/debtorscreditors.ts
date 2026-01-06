import { API } from "../constants/api";

/* ================= TYPES ================= */

export type DebtorCreditor = {
  Acc_Id: string;
  Account_name: string;
  Retailer_Name: string;
  Retailer_Id: string;
  Group_Name: string;
  Group_Id: string;
  OB_Amount: string;
  Debit_Amt: number;
  Credit_Amt: number;
  Bal_Amount: number;
  CR_DR: "DR" | "CR";
  Dr_Amount: number;
  Cr_Amount: number;
  Account_Types: "Debtor" | "Creditor";
  Account_Name: string;
};

/* ================= API HELPER ================= */

export const fetchDebtorsCreditors = async (
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

    const url = API.getDebtorsCreditors(fromStr, toStr);
    console.log("DebtorsCreditors URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const text = await res.text(); // 👈 READ AS TEXT FIRST

    // 🔴 HTML RESPONSE DETECTED
    if (text.startsWith("<")) {
      console.error("HTML Response received:", text);
      throw new Error("API returned HTML instead of JSON");
    }

    const json = JSON.parse(text);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return json.data || [];
  } catch (error) {
    console.error("Error fetching debtors/creditors:", error);
    throw error;
  }
};

