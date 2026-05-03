import axios, { AxiosInstance } from "axios"

const pistonBaseUrl = (import.meta.env.VITE_BACKEND_URL || "") + "/api/v2/piston"

const instance: AxiosInstance = axios.create({
    baseURL: pistonBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
})

export default instance
