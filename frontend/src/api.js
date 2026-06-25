import axios from "axios";
import { ACCESS_TOKEN } from "./constants";
import { applyLocalVoOverrides } from "./utils/examComparison";

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
    const endpoint = patientId ? `/api/reports/${patientId}/` : "/api/reports/";
    const response = await api.get(endpoint);
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

export const deleteEchocardiogram = async (patientId, echoId) => {
  try {
    const response = await api.delete(`/api/patient/${patientId}/echocardiogram/${echoId}/delete/`);
    return response.data;
  } catch (error) {
    console.error("Error deleting echocardiogram:", error);
    throw error;
  }
};

export const getEchoResults = async (patientId, echoId) => {
  try {
    const response = await api.get(`/api/patient/${patientId}/echodata/`, {
      params: echoId ? { echo_id: echoId } : undefined,
    });
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

export const getClinicalReport = async (patientId, echoId) => {
  try {
    const response = await api.get(`/api/patient/${patientId}/echocardiogram/${echoId}/report/`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error("Error fetching clinical report:", error);
    throw error;
  }
};

export const getEchocardiogramFrames = async (patientId, echoId) => {
  try {
    const response = await api.get(`/api/patient/${patientId}/echocardiogram/${echoId}/frames/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching echocardiogram frames:", error);
    throw error;
  }
};

export const upsertClinicalReport = async (patientId, echoId, payload) => {
  try {
    const response = await api.post(`/api/patient/${patientId}/echocardiogram/${echoId}/report/`, payload);
    return response.data;
  } catch (error) {
    console.error("Error upserting clinical report:", error);
    throw error;
  }
};

export const saveClinicalReport = async (patientId, payload) => {
  try {
    const response = await api.post(`/api/reports/${patientId}/create/`, payload);
    return response.data;
  } catch (error) {
    console.error("Error saving clinical report:", error);
    throw error;
  }
};

export const createReport = async (formData, patientId) => saveClinicalReport(patientId, formData);

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
  const patients = applyLocalVoOverrides(await getPatients());
  const patient = patients.find((item) => String(item.id) === String(patientId));
  return patient?.echocardiograms || [];
};

export const getTemporalPanelData = async () => {
  try {
    const response = await api.get("/api/patients/temporal-panel/");
    return response.data;
  } catch (error) {
    console.error("Error fetching temporal panel data:", error);
    throw error;
  }
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

export const quantifyObjectiveVariable = async (patientId, echoId, results) => {
  const response = await api.post(
    `/api/patient/${patientId}/echocardiogram/${echoId}/objective-variable/`,
    { results }
  );
  return response.data;
};

export const submitExamAnalysis = async (patientId, echoId, payload) => {
  const response = await api.post(
    `/api/patient/${patientId}/echocardiogram/${echoId}/submit/`,
    payload
  );
  return response.data;
};

const extractFilenameFromDisposition = (contentDisposition) => {
  if (!contentDisposition) return null;
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] || null;
};

const parseBlobError = async (error) => {
  const blob = error?.response?.data;
  if (!(blob instanceof Blob)) {
    return error?.response?.data?.error || error.message;
  }

  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed?.error || parsed?.detail || text;
  } catch {
    return "O backend devolveu um erro ao exportar o PDF.";
  }
};

export const downloadClinicalReport = async (reportId, fallbackFilename) => {
  try {
    const response = await api.get(`/api/report/${reportId}/export/`, {
      responseType: "blob",
    });

    const contentType = response.headers["content-type"] || "";
    if (!contentType.includes("application/pdf")) {
      throw new Error("O conteúdo devolvido não é um PDF válido.");
    }

    const blob = response.data;
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("O ficheiro PDF devolvido está vazio.");
    }

    const filename =
      extractFilenameFromDisposition(response.headers["content-disposition"]) ||
      fallbackFilename ||
      `relatorio_${reportId}.pdf`;
    const normalizedFilename = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = normalizedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return normalizedFilename;
  } catch (error) {
    const message = await parseBlobError(error);
    throw new Error(message);
  }
};

export default api;
