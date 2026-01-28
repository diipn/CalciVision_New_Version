import MainLayout from "../layouts/MainLayout.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { createExamWithFrames } from "../api";

const formatDateLabel = (date = new Date()) => {
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function ManualAnnotationSetup() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedEchoId, setSelectedEchoId] = useState("");

  // DEFAULT: "upload" (Carregar novo ecocardiograma)
  const [echoMode, setEchoMode] = useState("upload"); // "upload" | "existing"

  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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

  const resetUploadState = () => {
    setSelectedFiles([]);
    setUploadCount(0);
    setUploadError("");
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePatientChange = (value) => {
    setSelectedPatientId(value);
    setSelectedEchoId("");

    // DEFAULT sempre para upload quando se muda de doente
    setEchoMode("upload");

    resetUploadState();
  };

  const handleModeChange = (mode) => {
    if (!selectedPatientId || uploading) return;
    setEchoMode(mode);
    setSelectedEchoId("");
    setUploadError("");
    setUploadSuccess(false);
    if (mode === "existing") {
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (uploadSuccess) {
      setSelectedEchoId("");
      setUploadSuccess(false);
      setUploadCount(0);
    }

    const nextFiles = uploadSuccess ? files : [...selectedFiles, ...files];
    setSelectedFiles(nextFiles);
    setUploadError("");
    setSelectedEchoId("");

    try {
      await handleUpload(nextFiles);
    } catch (error) {
      // erro já tratado no handleUpload
    }
  };

  const handleRemoveSelectedFile = (indexToRemove) => {
    setSelectedFiles((prev) => {
      const next = prev.filter((_, index) => index !== indexToRemove);
      if (!next.length && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return next;
    });
    setUploadSuccess(false);
    setSelectedEchoId("");
    setUploadCount(0);
  };

  const handleUpload = async (files) => {
    if (!selectedPatientId) {
      setUploadError("Seleccione primeiro um doente.");
      return;
    }
    if (!files?.length) {
      setUploadError("Seleccione ficheiros DICOM antes de carregar.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const description = `ECO TEE (${formatDateLabel()})`;

      const newExam = await createExamWithFrames(selectedPatientId, description, files);
      if (newExam?.errors?.length) {
        setUploadError("Alguns ficheiros não foram processados. Tente novamente.");
      }

      let echoIdFromResponse =
        newExam?.echo_id ||
        newExam?.echoId ||
        newExam?.id ||
        (Array.isArray(newExam?.echo_ids) ? newExam.echo_ids[newExam.echo_ids.length - 1] : null);

      if (!echoIdFromResponse) {
        const patientResponse = await api.get(`/api/patient/${selectedPatientId}/`);
        const echos = patientResponse?.data?.echocardiograms || [];
        const sorted = [...echos].sort((a, b) => {
          const dateA = new Date(a.uploaded_at || a.date || 0).getTime();
          const dateB = new Date(b.uploaded_at || b.date || 0).getTime();
          return dateB - dateA;
        });
        echoIdFromResponse = sorted[0]?.id || null;
      }

      if (!echoIdFromResponse) {
        throw new Error("Não foi possível obter o ID do ecocardiograma.");
      }

      setUploadCount(files.length);
      setSelectedEchoId(echoIdFromResponse);
      setUploadSuccess(true);

      // mantém no modo upload
      setEchoMode("upload");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(error);
      const status = error?.response?.status;
      if (status) {
        if (status === 401) {
          setUploadError("Sessão expirada. Inicie sessão novamente.");
        } else if (status === 400) {
          const serverError =
            error?.response?.data?.error ||
            error?.response?.data?.errors?.[0]?.error ||
            null;
          setUploadError(
            serverError
              ? `Não foi possível processar o DICOM. ${serverError}`
              : "Não foi possível processar o DICOM. Verifique o ficheiro e tente novamente."
          );
        } else {
          setUploadError(
            `Erro ao carregar ficheiros (HTTP ${status}). Tente novamente.`
          );
        }
      } else {
        setUploadError("Não foi possível carregar os ficheiros. Tente novamente.");
      }
    } finally {
      setUploading(false);
    }
  };

  const canProceed = Boolean(selectedPatientId && selectedEchoId && !uploading);

  const tabsDisabled = !selectedPatientId || uploading;
  const hasExistingEchos = Boolean(selectedPatient?.echocardiograms?.length);

  return (
    <MainLayout pageTitle="Iniciar análise - CalciVision">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <header className="space-y-2">
              <h3 className="text-2xl font-semibold text-gray-900">Iniciar análise</h3>
              <p className="text-sm text-gray-600">
                Escolha o doente e o ecocardiograma a analisar.
              </p>
            </header>

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Passo 1 — Seleccionar doente
                </p>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">Doente</span>
                  <select
                    name="patient"
                    className="w-full max-w-md rounded-md border-2 border-green-dark bg-white px-4 py-2"
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
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Passo 2 — Seleccionar ecocardiograma
                </p>
                <div
                  className={`rounded-xl border border-green-pale bg-green-light/40 p-4 ${
                    !selectedPatientId ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`flex flex-wrap rounded-lg border border-green-pale bg-white/80 p-1 ${
                        tabsDisabled ? "opacity-60" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                          echoMode === "upload"
                            ? "bg-green-dark text-white"
                            : "text-green-dark"
                        }`}
                        onClick={() => handleModeChange("upload")}
                        disabled={tabsDisabled}
                      >
                        Carregar novo ecocardiograma
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                          echoMode === "existing"
                            ? "bg-green-dark text-white"
                            : "text-green-dark"
                        }`}
                        onClick={() => handleModeChange("existing")}
                        disabled={tabsDisabled}
                      >
                        Usar ecocardiograma existente
                      </button>
                    </div>
                    {!selectedPatientId && (
                      <span className="text-xs font-semibold text-gray-500">
                        Seleccione primeiro um doente.
                      </span>
                    )}
                  </div>

                  {echoMode === "existing" && (
                    <div className="mt-4 space-y-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Ecocardiograma
                        </span>
                        <select
                          name="echocardiogram"
                          className="w-full max-w-md rounded-md border-2 border-green-dark bg-white px-4 py-2"
                          onChange={(event) => {
                            setSelectedEchoId(event.target.value);
                            setUploadSuccess(false);
                          }}
                          value={selectedEchoId}
                          disabled={!selectedPatientId || uploading}
                        >
                          <option value="">--- Selecionar ecocardiograma ---</option>
                          {selectedPatient?.echocardiograms?.map((echo) => (
                            <option key={echo.id} value={echo.id}>
                              {echo.description || `Ecocardiograma ${echo.id}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!hasExistingEchos && selectedPatientId && (
                        <p className="text-sm text-gray-600">
                          Não existem ecocardiogramas registados para este doente.
                        </p>
                      )}
                    </div>
                  )}

                  {echoMode === "upload" && (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center gap-3 rounded-lg border border-green-pale bg-white p-3"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-light/60 text-green-dark">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M4 7h16M4 12h16M4 17h10" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-gray-700">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">Ficheiro DICOM</p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-semibold text-red"
                              onClick={() => handleRemoveSelectedFile(index)}
                              disabled={uploading}
                            >
                              X
                            </button>
                          </div>
                        ))}

                        <label
                          htmlFor="dicomUpload"
                          className={`flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-green-pale bg-white px-4 py-3 text-center transition ${
                            !selectedPatientId || uploading ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-green-dark text-green-dark">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </span>
                          <span className="text-xs font-semibold text-gray-600">
                            Adicionar ficheiros DICOM
                          </span>
                          <input
                            id="dicomUpload"
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".dcm,application/dicom"
                            className="hidden"
                            onChange={handleFileSelection}
                            disabled={!selectedPatientId || uploading}
                          />
                        </label>
                      </div>

                      {uploading && (
                        <p className="text-sm text-gray-600">A carregar ficheiros...</p>
                      )}
                      {uploadError && <p className="text-sm text-red">{uploadError}</p>}

                      {uploadSuccess && uploadCount > 0 && (
                        <div className="rounded-md border border-green-pale bg-white p-3 text-sm text-gray-700">
                          <p className="font-semibold">
                            {uploadCount} ficheiros carregados com sucesso
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() =>
                  navigate(`/analyse_aortic_valve/${selectedPatientId}/${selectedEchoId}`)
                }
                disabled={!canProceed}
                className={`rounded-lg px-6 py-2 text-white ${
                  canProceed ? "bg-green-dark" : "bg-gray-medium"
                }`}
              >
                Avançar
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
