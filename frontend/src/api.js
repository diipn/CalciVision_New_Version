import axios from "axios";
import { ACCESS_TOKEN } from "./constants";
import { mockApi, mockDb } from "./mocks/mockDb";

const useMocks = import.meta.env.VITE_USE_MOCKS === "true";

const api = useMocks
  ? mockApi
  : axios.create({
      baseURL: import.meta.env.VITE_API_URL,
    });

const readFilesAsDataUrls = (files) => {
  const readers = files.map(
    (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      })
  );
  return Promise.all(readers);
};

if (!useMocks) {
  // Interceptor para adicionar o token de autenticação antes de cada requisição
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
}

export const getPatients = async (params) => {
  // params é passado para filtrar os pacientes
  try {
    if (useMocks) {
      return mockDb.getPatients();
    }
    const response = await api.get("/api/patients/", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching patients:", error);
    throw error;
  }
};

export const getReports = async (patientId) => {
  try {
    if (useMocks) {
      return mockDb.getReports(patientId);
    }
    const response = await api.get(`/api/reports/${patientId}/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching reports:", error);
    throw error;
  }
};

export const deletePatient = async (patientId) => {
  try {
    if (useMocks) {
      mockDb.deletePatient(patientId);
      return { ok: true };
    }
    const response = await api.delete(`/api/patient/${patientId}/delete/`);
    return response.data;
  } catch (error) {
    console.error("Error deleting patient:", error);
    throw error;
  }
};

export const deleteReport = async (reportId) => {
  try {
    if (useMocks) {
      mockDb.deleteReport(reportId);
      return { ok: true };
    }
    const response = await api.delete(`/api/report/${reportId}/delete/`);
    return response.data;
  } catch (error) {
    console.error("Error deleteing report:", error);
    throw error;
  }
};

export const getEchoResults = async (patientId) => {
  try {
    if (useMocks) {
      return mockDb.getEchoResults(patientId);
    }
    const response = await api.get(`/api/patient/${patientId}/echodata/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching echo results:", error);
    throw error;
  }
};

export const createPatient = async (patientData) => {
  try {
    if (useMocks) {
      return mockDb.createPatient(patientData);
    }
    let config = {};
    if (patientData instanceof FormData) {
      config.headers = { "Content-Type": "multipart/form-data" };
    }
    const response = await api.post("/api/patient/create/", patientData, config);
    return response.data;
  } catch (error) {
    console.error("Error creating patient:", error);
    throw error;
  }
};

export const createReport = async (formData, patientId, examId) => {
  try {
    if (useMocks) {
      const reportText = formData instanceof FormData ? formData.get("reportText") : formData?.reportText;
      return mockDb.createReport({ patientId, examId, reportText: reportText || "" });
    }
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
};

export const createExamWithFrames = async (patientId, description, frames) => {
  if (useMocks) {
    const shouldConvert =
      typeof File !== "undefined" &&
      Array.isArray(frames) &&
      frames.some((frame) => frame instanceof File);
    const payload = shouldConvert ? await readFilesAsDataUrls(frames) : frames;
    return mockDb.addExamWithFrames(patientId, description, payload);
  }
  const formData = new FormData();
  frames.forEach((frame) => {
    formData.append("echoDicom", frame);
  });
  const response = await api.post(`/api/patient/${patientId}/echocardiogram/add/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getPatientExams = async (patientId) => {
  if (useMocks) {
    return mockDb.getPatientExams(patientId);
  }
  const patients = await getPatients();
  const patient = patients.find((item) => item.id === Number(patientId));
  return patient?.echocardiograms || [];
};

export const getExamSettings = async (examId) => {
  if (useMocks) {
    return mockDb.getExamSettings(examId);
  }
  const cached = localStorage.getItem(`exam-settings-${examId}`);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
};

export const updateExamSettings = async (examId, updates) => {
  if (useMocks) {
    return mockDb.updateExamSettings(examId, updates);
  }
  const next = {
    ...(await getExamSettings(examId)),
    ...updates,
  };
  localStorage.setItem(`exam-settings-${examId}`, JSON.stringify(next));
  return next;
};

export const useMockApi = useMocks;

export default api;
