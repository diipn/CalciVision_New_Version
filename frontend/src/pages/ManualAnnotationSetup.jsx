import MainLayout from "../layouts/MainLayout.jsx";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { createExamWithFrames } from "../api";

const formatDateLabel = (date = new Date()) => {
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

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

export default function ManualAnnotationSetup() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedEchoId, setSelectedEchoId] = useState("");
  const [echoMode, setEchoMode] = useState("existing");
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      const response = await api.get("/api/patients-with-ecos/");
      setPatients(response.data);
    };

    fetchPatients();
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === String(selectedPatientId)),
    [patients, selectedPatientId]
  );

  const handlePatientChange = (value) => {
    setSelectedPatientId(value);
    setSelectedEchoId("");
    setEchoMode("existing");
    setUploadedFiles([]);
    setUploadCount(0);
    setUploadError("");
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !selectedPatientId) return;
    setUploading(true);
    setUploadError("");
    try {
      const frames = await readFilesAsDataUrls(files);
      const description = `ECO TEE (${formatDateLabel()})`;
      const newExam = await createExamWithFrames(selectedPatientId, description, frames);
      setUploadedFiles(files);
      setUploadCount(files.length);
      setSelectedEchoId(newExam.id);
      setEchoMode("upload");
    } catch (error) {
      console.error(error);
      setUploadError("Não foi possível carregar os ficheiros. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const canProceed = Boolean(selectedPatientId && selectedEchoId);

  return (
    <MainLayout pageTitle="Iniciar análise - CalciVision">
      <div className="max-w-3xl space-y-6">
        <header className="space-y-2">
          <h3 className="text-xl font-semibold">Iniciar análise</h3>
          <p className="text-gray-600">Selecione o doente e o ecocardiograma a analisar.</p>
        </header>

        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">Doente</span>
            <select
              name="patient"
              className="px-4 py-2 border-2 border-green-dark rounded-md bg-white"
              onChange={(event) => handlePatientChange(event.target.value)}
              value={selectedPatientId}
            >
              <option value="">--- Selecionar doente ---</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-green-pale bg-green-light/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  echoMode === "existing"
                    ? "border border-green-dark bg-green-dark text-white"
                    : "border border-green-pale text-green-dark"
                }`}
                onClick={() => setEchoMode("existing")}
                disabled={!selectedPatientId}
              >
                Usar ecocardiograma existente
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  echoMode === "upload"
                    ? "border border-green-dark bg-green-dark text-white"
                    : "border border-green-pale text-green-dark"
                }`}
                onClick={() => setEchoMode("upload")}
                disabled={!selectedPatientId}
              >
                Carregar novo ecocardiograma
              </button>
            </div>

            {echoMode === "existing" && (
              <div className="mt-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">Ecocardiograma</span>
                  <select
                    name="echocardiogram"
                    className="px-4 py-2 border-2 border-green-dark rounded-md bg-white"
                    onChange={(event) => setSelectedEchoId(event.target.value)}
                    value={selectedEchoId}
                    disabled={!selectedPatientId}
                  >
                    <option value="">--- Selecionar ecocardiograma ---</option>
                    {selectedPatient?.echocardiograms?.map((echo) => (
                      <option key={echo.id} value={echo.id}>
                        {echo.description || `Ecocardiograma ${echo.id}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {echoMode === "upload" && (
              <div className="mt-4 space-y-3">
                <label className="inline-flex items-center gap-3">
                  <span className="rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white">
                    Carregar ficheiros DICOM
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".dcm,application/dicom,image/*"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={!selectedPatientId || uploading}
                  />
                </label>
                {uploading && <p className="text-sm text-gray-600">A carregar ficheiros...</p>}
                {uploadError && <p className="text-sm text-red">{uploadError}</p>}
                {uploadCount > 0 && (
                  <div className="rounded-md bg-white p-3 text-sm text-gray-700">
                    <p className="font-semibold">{uploadCount} ficheiros carregados</p>
                    <ul className="mt-2 list-disc pl-5 text-xs">
                      {uploadedFiles.map((file) => (
                        <li key={file.name}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={() => navigate(`/analyse_aortic_valve/${selectedPatientId}/${selectedEchoId}`)}
            disabled={!canProceed}
            className={`rounded-lg px-6 py-2 text-white ${
              canProceed ? "bg-green-dark" : "bg-gray-medium"
            }`}
          >
            Avançar
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
