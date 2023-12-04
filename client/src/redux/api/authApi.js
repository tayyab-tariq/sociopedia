import { handleApiError } from "./utils";
import axios from 'axios';

export const signIn = async (formData) => {
  try {
    const res = await axios.post("/api/users/signin", formData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return { error: null, data: res.data };
  } catch (error) {
    return handleApiError(error);
  }
};

export const signUp = async (formData) => {
  try {
    const res = await axios.post("/api/users/signup", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return { error: null, data: res.data };
  } catch (error) {
    return {
      error: error.response.data.errors,
      data: null,
    };
  }
};