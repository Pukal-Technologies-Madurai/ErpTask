import CryptoJS from "react-native-crypto-js";
import { API } from "../constants/api";

export const fetchCompanyInfo = async (userName: string) => {
    try {
        const url = `${API.userPortal()}${userName}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();
        if (data.success) {
            return data.data;
        }
    } catch (error) {
        console.error("FetchCompanyInfo Error: ", error);
    }
};

export const postLogin = async (
    username: any,
    password: any,
    selectedCompany: any,
) => {
    try {
        const url = API.userPortalLogin();

        const passHash = CryptoJS.AES.encrypt(
            password,
            "ly4@&gr$vnh905RyB>?%#@-(KSMT",
        ).toString();

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                Global_User_ID: selectedCompany.Global_User_ID,
                username: username,
                Password: passHash,

                Company_Name: selectedCompany.Company_Name,
                Global_Id: selectedCompany.Global_Id,
                Local_Id: selectedCompany.Local_Id,
                Web_Api: selectedCompany.Web_Api,
            }),
        });

        const data = await response.json();
        // console.log("PostLogin Response: ", data);
        if (data.success) {
            getUserAuthToken(data.data.Autheticate_Id);
            return data.data;
        }
    } catch (err) {
        console.error("PostLogin Error: ", err);
    }
};

export const getUserAuthToken = async (token: any) => {
    try {
        const url = `${API.getUserAuthInfo()}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            return data.data;
        }
    } catch (err) {
        console.error("GetUserAuthToken Error: ", err);
    }
};
