import axios from "axios"
import { ACCESS_TOKEN } from "./constants"

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// Interceptor para adicionar o token de autenticação antes de cada requisição
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem(ACCESS_TOKEN);
        if(token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
)


export const getPatients = async (params) => { // params é passado para filtrar os pacientes
    try {
        const response = await api.get('/api/patients/', { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching patients:", error);
        throw error;
    }
};

export const getReports = async (patientId) => {
    try {
        const response = await api.get(`/api/reports/${patientId}/`);
        return response.data;
    } catch (error) {
        console.error("Error fetching reports:", error);
        throw error;
    }
};

export const deletePatient = async (patientId) => {
    try {
        const response = await api.delete(`/api/patient/${patientId}/delete/`);
        return response.data;
    } catch (error) {
        console.error("Error deleting patient:", error);
        throw error;
    }
}

export const deleteReport = async (reportId) => {
    try {
        const response = await api.delete(`/api/report/${reportId}/delete/`)
        return response.data;
    } catch {
        console.error("Error deleteing report:", error);
        throw error;
    }
}

export const getEchoResults = async (patientId) => {
    try {
        const response = await api.get(`/api/patient/${patientId}/echodata/`);
        return response.data;
    } catch (error) {
        console.error("Error fetching echo results:", error);
        throw error;
    }
}

export const createPatient = async (patientData) => {
    try {
        let config = {};
        if (patientData instanceof FormData) {
            config.headers = { "Content-Type": "multipart/form-data" };
        }
        const response = await api.post('/api/patient/create/', patientData, config);
        return response.data;
    } catch (error) {
        console.error("Error creating patient:", error);
        throw error;
    }
};

export const createReport = async (formData, patientId) => {
    try {
        let config = {};
        if (formData instanceof FormData) {
            config.headers = { "Content-Type": "multipart/form-data" };
        }
        const response = await api.post(`/api/reports/${patientId}/create/`, formData, config);
        return response.data;
    } catch (error) {
        console.error("Error creating report:", error);
        throw error;
    }
}

export default api;