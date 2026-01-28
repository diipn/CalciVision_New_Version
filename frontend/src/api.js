import axios from "axios";
import { ACCESS_TOKEN } from "./constants";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getPatients = async (params) => {
  try {
    const response = await api.get("/api/patients/", { params });
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
};

export const deleteReport = async (reportId) => {
  try {
    const response = await api.delete(`/api/report/${reportId}/delete/`);
    return response.data;
  } catch (error) {
    console.error("Error deleteing report:", error);
    throw error;
  }
};

export const getEchoResults = async (patientId) => {
  try {
    const response = await api.get(`/api/patient/${patientId}/echodata/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching echo results:", error);
    throw error;
  }
};

export const createPatient = async (patientData) => {
  try {
    // ⚠️ NÃO definir manualmente Content-Type quando é FormData.
    // O browser coloca o boundary correctamente.
    const response = await api.post("/api/patient/create/", patientData);
    return response.data;
  } catch (error) {
    console.error("Error creating patient:", error);
    throw error;
  }
};

export const createReport = async (formData, patientId) => {
  try {
    const response = await api.post(`/api/reports/${patientId}/create/`, formData);
    return response.data;
  } catch (error) {
    console.error("Error creating report:", error);
    throw error;
  }
};

export const createExamWithFrames = async (patientId, description, files) => {
  const formData = new FormData();
  formData.append("description", description);

  (files || []).forEach((file) => {
    formData.append("echoDicom", file);
  });

  // idem: não forçar Content-Type
  const response = await api.post(`/api/patient/${patientId}/echocardiogram/add/`, formData);
  return response.data;
};

export const getPatientExams = async (patientId) => {
  const patients = await getPatients();
  const patient = patients.find((item) => item.id === Number(patientId));
  return patient?.echocardiograms || [];
};

export const getExamSettings = async (examId) => {
  const cached = localStorage.getItem(`exam-settings-${examId}`);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
};

export const updateExamSettings = async (examId, updates) => {
  const next = {
    ...(await getExamSettings(examId)),
    ...updates,
  };
  localStorage.setItem(`exam-settings-${examId}`, JSON.stringify(next));
  return next;
};

export default api;
