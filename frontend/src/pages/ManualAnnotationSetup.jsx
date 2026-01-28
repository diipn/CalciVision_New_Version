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

const MAX_FILE_SIZE_MB = 25;

const isValidDicomFile = (file) => {
  if (!file) return false;
  if (file.type === "application/dicom") return true;
  if (file.type?.startsWith("image/")) return true;
  return file.name?.toLowerCase().endsWith(".dcm");
};

export default function ManualAnnotationSetup() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedEchoId, setSelectedEchoId] = useState("");
  const [echoMode, setEchoMode] = useState("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const navigate = useNavigate();

  const fetchPatients = async () => {
    const response = await api.get("/api/patients-with-ecos/");
    setPatients(response.data);
    return response.data;
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === String(selectedPatientId)),
    [patients, selectedPatientId]
  );

  const handlePatientChange = (value) => {
    setSelectedPatientId(value);
    setSelectedEchoId("");
    setEchoMode("upload");
    setUploadedFiles([]);
    setUploadCount(0);
    setUploadError("");
  };

  const handleEchoModeChange = (mode) => {
    if (mode === echoMode) return;
    setEchoMode(mode);
    setSelectedEchoId("");
    setUploadedFiles([]);
    setUploadCount(0);
    setUploadError("");
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!selectedPatientId) {
      setUploadError("Seleccione um doente antes de carregar o ecocardiograma.");
      return;
    }
    if (!files.length) {
      setUploadError("Seleccione pelo menos um ficheiro DICOM.");
      return;
    }
    const invalidFiles = files.filter((file) => !isValidDicomFile(file));
    if (invalidFiles.length) {
      setUploadError("Formato inválido. Carregue apenas ficheiros DICOM ou imagens suportadas.");
      return;
    }
    const oversizedFiles = files.filter((file) => file.size / 1024 / 1024 > MAX_FILE_SIZE_MB);
    if (oversizedFiles.length) {
      setUploadError(`Cada ficheiro deve ter no máximo ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const description = `ECO TEE (${formatDateLabel()})`;
      await createExamWithFrames(selectedPatientId, description, files);
      const refreshedPatients = await fetchPatients();
      const updatedPatient = refreshedPatients.find(
        (patient) => String(patient.id) === String(selectedPatientId)
      );
      const latestEcho = [...(updatedPatient?.echocardiograms || [])].sort((a, b) => {
        const dateA = a?.uploaded_at ? new Date(a.uploaded_at) : 0;
        const dateB = b?.uploaded_at ? new Date(b.uploaded_at) : 0;
        return dateB - dateA;
      })[0];
      setUploadedFiles(files);
      setUploadCount(files.length);
      setSelectedEchoId(latestEcho?.id ? String(latestEcho.id) : "");
    } catch (error) {
      console.error(error);
      setUploadError("Erro ao carregar o ecocardiograma. Tente novamente.");
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const canProceed = Boolean(selectedPatientId && selectedEchoId && !uploading);

  return (
    <MainLayout pageTitle="Iniciar análise - CalciVision">
      <div className="max-w-lg space-y-6">
        <header className="space-y-2">
          <h3 className="text-xl font-semibold">Iniciar análise</h3>
          <p className="text-gray-600">Seleccione o doente e o ecocardiograma a analisar.</p>
        </header>

        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">Doente</span>
            <select
              name="patient"
              className="w-full max-w-md px-4 py-2 border-2 border-green-dark rounded-md bg-white"
              onChange={(event) => handlePatientChange(event.target.value)}
              value={selectedPatientId}
            >
              <option value="">--- Seleccionar doente ---</option>
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
                className={`w-fit rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                  echoMode === "upload"
                    ? "border border-green-dark bg-green-dark text-white"
                    : "border border-green-pale text-green-dark"
                }`}
                onClick={() => handleEchoModeChange("upload")}
                disabled={!selectedPatientId}
              >
                Carregar novo ecocardiograma
              </button>
              <button
                type="button"
                className={`w-fit rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                  echoMode === "existing"
                    ? "border border-green-dark bg-green-dark text-white"
                    : "border border-green-pale text-green-dark"
                }`}
                onClick={() => handleEchoModeChange("existing")}
                disabled={!selectedPatientId}
              >
                Usar ecocardiograma existente
              </button>
            </div>

            {echoMode === "existing" && (
              <div className="mt-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">Ecocardiograma</span>
                  <select
                    name="echocardiogram"
                    className="w-full max-w-md px-4 py-2 border-2 border-green-dark rounded-md bg-white"
                    onChange={(event) => setSelectedEchoId(event.target.value)}
                    value={selectedEchoId}
                    disabled={!selectedPatientId}
                  >
                    <option value="">--- Seleccionar ecocardiograma ---</option>
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
                <label
                  htmlFor="echocardiogram-upload"
                  className={`inline-flex items-center gap-3 ${
                    selectedPatientId && !uploading ? "cursor-pointer" : "cursor-not-allowed"
                  }`}
                >
                  <span className={`w-fit rounded-md px-4 py-2 text-sm font-semibold text-white ${
                    selectedPatientId && !uploading ? "bg-green-dark" : "bg-gray-medium"
                  }`}>
                    Carregar novo ecocardiograma
                  </span>
                  <input
                    id="echocardiogram-upload"
                    type="file"
                    multiple
                    accept=".dcm,application/dicom,image/*"
                    className="sr-only"
                    onChange={handleUpload}
                    disabled={!selectedPatientId || uploading}
                  />
                </label>
                {!selectedPatientId && (
                  <p className="text-sm text-gray-600">Seleccione um doente para activar o carregamento.</p>
                )}
                {uploading && <p className="text-sm text-gray-600">A carregar ficheiros...</p>}
                {uploadError && <p className="text-sm text-red">{uploadError}</p>}
                {uploadCount > 0 && (
                  <div className="rounded-md bg-white p-3 text-sm text-gray-700 max-w-md">
                    <p className="font-semibold">{uploadCount} ficheiro(s) carregado(s)</p>
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
