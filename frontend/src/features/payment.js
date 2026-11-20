import api from "@/api";

export const createPayment = async (plan) => {
  try {
    const { data } = await api.post("/api/payment/create", { plan });
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};

export const verify = async (body) => {
  try {
    const { data } = await api.post("/api/payment/verify", body);
    console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};