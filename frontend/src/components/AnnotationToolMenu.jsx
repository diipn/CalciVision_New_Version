import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { createReport, getEchoResults, getExamSettings, updateExamSettings } from "../api";
import { useUser } from "../contexts/UserContext";
import AlertDialog from "./AlertDialogMenu";
import { useUnsavedStore } from "../store/useUnsavedStore";
import { Switch, Tooltip } from "radix-ui";
import ReportPDF from "./ReportPDF";
import { pdf } from "@react-pdf/renderer";

const VO_THRESHOLD = 0.66;

const AnnotationToolMenu = ({ frames, currentFrame, rects, calcification, setCalcification, calcificationStatus, setCalcificationStatus, predictionHistory, patient, exam, echoId }) => {
  const [echoName, setEchoName] = useState("");
  const [autoReport, setAutoReport] = useState(true);
  const [voInfoOpen, setVoInfoOpen] = useState(false);
  const [classificationChoice, setClassificationChoice] = useState(null);
  const [classificationConfirmed, setClassificationConfirmed] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [reportText, setReportText] = useState("");
  const form = useRef(null);
  const { user } = useUser();
  const navigate = useNavigate();
  const { setUnsavedChanges, hasUnsavedChanges } = useUnsavedStore();

  const voValue = exam?.vo ?? null;
  const autoClassification = voValue !== null ? voValue >= VO_THRESHOLD : false;
  const activeClassification = classificationChoice === null ? autoClassification : classificationChoice;

  useEffect(() => {
    if (patient && exam) {
      setEchoName(exam.description);
    }
  }, [patient, exam]);

  useEffect(() => {
    const hydrateSettings = async () => {
      if (!echoId) return;
      const settings = await getExamSettings(echoId);
      if (settings) {
        setClassificationChoice(
          settings.classificationOverride !== undefined
            ? settings.classificationOverride
            : null
        );
        setClassificationConfirmed(Boolean(settings.classificationConfirmed));
        setIsValidated(Boolean(settings.validated));
        setReportText(settings.reportText || "");
      }
    };
    hydrateSettings();
  }, [echoId]);

  useEffect(() => {
    const rectList = rects[currentFrame];

    if (rectList && rectList.length > 0) {
      // Procura por uma anotação correspondente no histórico de previsões (independente do id)
      const { id, ...rect } = rectList[0];
      const savedPrediction = predictionHistory[currentFrame]?.find(
        (pred) => JSON.stringify(pred.rect) === JSON.stringify(rect)
      );

      if (savedPrediction) {
        // Atualiza o item correspondente no array
        setCalcification((prev) => {
          const updated = [...prev];
          updated[currentFrame] = savedPrediction.results;
          return updated;
        });

        // Se os resultados do cálcio já estiverem disponíveis, atualiza o status de calcificação
        savedPrediction.results?.binary_classification &&
          setCalcificationStatus(savedPrediction.results.binary_classification);
      } else {
        // Se não houver predição, limpa o valor
        setCalcification((prev) => {
          const updated = [...prev];
          updated[currentFrame] = null;
          return updated;
        });

        setCalcificationStatus(null);
      }
    } else {
      // Se não houver rects, limpa o valor também
      setCalcification((prev) => {
        const updated = [...prev];
        updated[currentFrame] = null;
        return updated;
      });

      setCalcificationStatus(null);
    }
  }, [rects[currentFrame], currentFrame]);

  /* Quando o médico submete, os dados do ecocardiograma e frames devem ser atualizados */
  const handleUpdateEcho = async (completed) => {
    try {
      const results = frames.map((frame, frameIndex) => {
        const frameRects = Array.isArray(rects?.[frameIndex]) ? rects[frameIndex] : [];
        const cleanedRects = frameRects
          .map((rect, rectIndex) => ({
            id: String(rect?.id ?? `${frame.id}-${rectIndex}`),
            x: Number(rect?.x),
            y: Number(rect?.y),
            width: Number(rect?.width),
            height: Number(rect?.height),
            is_annotation_generated: Boolean(rect?.is_annotation_generated),
          }))
          .filter(
            (rect) =>
              Number.isFinite(rect.x) &&
              Number.isFinite(rect.y) &&
              Number.isFinite(rect.width) &&
              Number.isFinite(rect.height)
          );

        const frameCalc = calcification?.[frameIndex];
        const calcValue = frameCalc?.binary_classification;
        const isCalcified =
          calcValue === null || calcValue === undefined
            ? typeof calcificationStatus === "boolean"
              ? calcificationStatus
              : null
            : Boolean(calcValue);
        const generatedCalcium =
          typeof frameCalc?.is_calcification_generated === "boolean"
            ? frameCalc.is_calcification_generated
            : null;

        return {
          frame_id: frame.id,
          rects: cleanedRects,
          is_calcified: isCalcified,
          generated_calcium: generatedCalcium,
        };
      });

      await api.post(
        `/api/patient/${patient.id}/echocardiogram/${echoId}/submit/`,
        { results, completed, echoName }
      );
      // Gera o relatório automaticamente
      if (autoReport && completed) {
        try {
          const echoData = await getEchoResults(patient.id);

          const pdfBlob = await generatePdfBlob(echoData, patient, user, reportText);
          const formData = new FormData();
          formData.append("pdf_file", pdfBlob, `report_${patient.id}.pdf`);
          await createReport(formData, patient.id);
        } catch (err) {
          console.error("Erro ao gerar o relatório:", err);
        }
      }

      setUnsavedChanges(false);
      completed && navigate(`/patients?patient=${patient.id}`);
    } catch (error) {
      console.error("Erro na submissão dos resultados", error);
    }
  };

  const generatePdfBlob = async (echoData, selectedPatient, user, reportText) => {
    const doc = (
      <ReportPDF
        data={echoData}
        patient={selectedPatient}
        medico={user}
        reportText={reportText}
      />
    );
    const asPdf = pdf([]);
    asPdf.updateContainer(doc);
    const blob = await asPdf.toBlob();
    return blob;
  };

  const updateCalcification = (binary_classification) => {
    setCalcificationStatus(binary_classification);
    setCalcification((prev) => {
      const updatedCalcification = [...prev];
      updatedCalcification[currentFrame] = {
        binary_classification: binary_classification,
        confidence: 1,
        is_calcification_generated: false,
      };
      return updatedCalcification;
    });
  };

  const framesWithValve = rects.filter((frameRects) => frameRects.length > 0).length;
  const framesCompleted = rects.filter(
    (frameRects, idx) => frameRects.length > 0 && calcification[idx] !== null
  ).length;
  const readyToSubmit = rects.some(
    (frameRects, idx) => frameRects.length > 0 && calcification[idx] !== null
  );

  const riskBadge = () => {
    if (voValue === null || voValue === undefined) return null;
    if (voValue < 0.33) {
      return { label: 'Baixo risco', className: 'bg-green-600 text-white' };
    }
    if (voValue < 0.66) {
      return { label: 'Risco moderado', className: 'bg-orange-500 text-white' };
    }
    return { label: 'Alto risco', className: 'bg-red text-white' };
  };

  const handleConfirmClassification = async () => {
    await updateExamSettings(echoId, {
      classificationOverride: classificationChoice,
      classificationConfirmed: true,
    });
    setClassificationConfirmed(true);
  };

  const handleEditClassification = async () => {
    await updateExamSettings(echoId, {
      classificationConfirmed: false,
    });
    setClassificationConfirmed(false);
  };

  const handleValidation = async () => {
    await updateExamSettings(echoId, { validated: true });
    setIsValidated(true);
  };

  const handleGenerateReport = async () => {
    if (!patient || !exam) return;
    const template = `RELATÓRIO AUTOMÁTICO - CALCIVISION\n\nPaciente: ${patient.name}\nData do exame: ${new Date(exam.date).toLocaleDateString('pt-PT')}\nVariável Objetiva (VO): ${
      voValue !== null ? (voValue * 100).toFixed(0) : 'N/A'
    }%\nClassificação: ${activeClassification ? 'Calcificada' : 'Não calcificada'}\n\nObservações automáticas:\n- Comparação longitudinal recomendada para acompanhar a progressão.\n- Este resultado é uma simulação e não substitui a decisão clínica.\n\nAssinatura: ${user?.first_name || 'Médico'} ${user?.last_name || ''}`;
    setReportText(template);
    await updateExamSettings(echoId, { reportText: template });
  };

  const handleReportChange = async (value) => {
    setReportText(value);
    await updateExamSettings(echoId, { reportText: value, reportUpdatedAt: new Date().toISOString() });
  };

  return (
    <div className="bg-gray-light p-3 rounded-lg w-full border-t-6 border-green-dark mb-4">
      <form id="form" ref={form} className="p-2">
        <div>
          <h3 className="mb-2">{patient?.name}</h3>
          <p>
            Select the area of interest on the image by drawing a box at the location of the valve.
          </p>
        </div>

        <label htmlFor="imageName" className="block my-4">
          <div className="mb-1 text-gray-medium">Echocardiogram</div>
          <input
            type="text"
            name="imageName"
            id="imageName"
            placeholder="Name this echocardiogram..."
            value={echoName}
            onChange={(e) => setEchoName(e.target.value)}
            className="block w-full border rounded-sm border-gray-dark bg-gray-soft py-1 px-3"
          />
        </label>

        <div className="space-y-4 text-sm text-gray-700">
          <h4 className="mt-6">Progress Overview</h4>
          <ul className="space-y-1">
            <li>
              <span className="text-gray-600">Total frames:</span>
              <span className="ml-2 font-medium text-gray-900">{frames.length}</span>
            </li>
            <li>
              <span className="text-gray-600">Valve identified:</span>
              <span className="ml-2 font-medium text-gray-900">{framesWithValve}</span>
            </li>
            <li>
              <span className="text-gray-600">Completed annotations:</span>
              <span className="ml-2 font-medium text-gray-900">{framesCompleted}</span>
            </li>
          </ul>

          {readyToSubmit && (
            <div
              className="flex items-center gap-2 rounded-md bg-green-50 p-2 text-green-700 ring-1 ring-green-200"
              role="alert"
            >
              <div className="p-1 rounded-full bg-green-100 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 1024 1024" fill="currentColor">
                  <path d="M512 64a448 448 0 1 1 0 896a448 448 0 0 1 0-896m-55.808 536.384l-99.52-99.584a38.4 38.4 0 1 0-54.336 54.336l126.72 126.72a38.27 38.27 0 0 0 54.336 0l262.4-262.464a38.4 38.4 0 1 0-54.272-54.336z" />
                </svg>
              </div>
              <span className="font-medium">Ready to submit.</span>
            </div>
          )}

          {hasUnsavedChanges && (
            <div
              className="flex items-center gap-2 rounded-md bg-orange-50 p-2 text-orange-700 ring-1 ring-orange-200"
              role="alert"
            >
              <div className="p-1 rounded-full bg-orange-100 text-orange-600">
                <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 1024 1024" fill="currentColor">
                  <path d="M512 64a448 448 0 1 1 0 896a448 448 0 0 1 0-896m0 192a58.43 58.43 0 0 0-58.24 63.744l23.36 256.384a35.072 35.072 0 0 0 69.76 0l23.296-256.384A58.43 58.43 0 0 0 512 256m0 512a51.2 51.2 0 1 0 0-102.4a51.2 51.2 0 0 0 0 102.4" />
                </svg>
              </div>
              <span className="font-medium">You have unsaved changes.</span>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4>Variável Objetiva (VO)</h4>
            <button
              type="button"
              className="text-green-dark text-sm font-medium"
              onClick={() => setVoInfoOpen(!voInfoOpen)}
            >
              O que é a VO?
            </button>
          </div>
          {voInfoOpen && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-900 ring-1 ring-green-100">
              A VO representa o grau estimado de calcificação e permite comparar exames ao longo do tempo.
              Este valor é simulado e não substitui a decisão clínica.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-semibold text-gray-900">
              {voValue !== null ? `${(voValue * 100).toFixed(0)}%` : 'N/A'}
            </span>
            {riskBadge() && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskBadge().className}`}>
                {riskBadge().label}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h4>Classificação da válvula</h4>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`h-12 rounded flex justify-center items-center border ${
                activeClassification
                  ? 'bg-green text-white border-green-dark'
                  : 'bg-gray-200 border-gray-medium-dark'
              }`}
              onClick={() => setClassificationChoice(true)}
            >
              Calcificada
            </button>
            <button
              type="button"
              className={`h-12 rounded flex justify-center items-center border ${
                !activeClassification
                  ? 'bg-green text-white border-green-dark'
                  : 'bg-gray-200 border-gray-medium-dark'
              }`}
              onClick={() => setClassificationChoice(false)}
            >
              Não calcificada
            </button>
          </div>
          <div className="flex items-center gap-3">
            {!classificationConfirmed ? (
              <button
                type="button"
                className="bg-green-dark text-white px-4 py-2 rounded"
                onClick={handleConfirmClassification}
              >
                Confirmar classificação
              </button>
            ) : (
              <>
                <span className="text-sm font-semibold text-green-dark">Classificação confirmada</span>
                <button
                  type="button"
                  className="text-sm text-green-dark underline"
                  onClick={handleEditClassification}
                >
                  Alterar classificação
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h4>Validação da deteção</h4>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`px-4 py-2 rounded ${
                isValidated
                  ? 'bg-green-100 text-green-900'
                  : 'bg-green-dark text-white'
              }`}
              onClick={handleValidation}
              disabled={isValidated}
            >
              {isValidated ? 'Deteção validada' : 'Validar deteção'}
            </button>
            <span className="text-sm text-gray-600">
              {isValidated
                ? 'Próximo passo desbloqueado.'
                : 'Valide para gerar relatório.'}
            </span>
          </div>
        </div>

        <h4 className="mt-4">Calcification</h4>
        <div className="grid grid-cols-2 justify-center gap-3 mt-4">
          <button
            type="button"
            className={`relative h-12 rounded flex justify-center items-center ${
              calcificationStatus === true
                ? 'bg-green text-white border border-gray-medium-dark'
                : 'bg-gray-200 border border-gray-medium-dark'
            }`}
            onClick={() => updateCalcification(true)}
          >
            {calcification?.[currentFrame]?.binary_classification === true &&
              (calcification[currentFrame]?.is_calcification_generated ? (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                    <g fill="currentColor"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path><path className={`${calcificationStatus === true ? "bg-gray-pale" : "bg-gray-medium-dark"}`} d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027A1 1 0 0 1 19 2"></path></g>
                  </svg>
                </div>
              ) : (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={15.75} height={18} viewBox="0 0 21 24">
                    <path fill="currentColor" d="m6.53 8.098l.14-.012a.3.3 0 0 0 .141-.053l-.001.001c.134.462.298.948.503 1.457c.263.666.522 1.213.812 1.741l-.04-.08c-.024.364-.053.738-.091 1.1a2.6 2.6 0 0 1-.129.627l.005-.018c-.012.005-.029 2.08-.029 2.08a2.87 2.87 0 0 0 2.198 2.787l.02.004a.38.38 0 0 1 .357-.246h.574a.39.39 0 0 1 .356.243l.001.003a2.88 2.88 0 0 0 2.229-2.789v-.001s-.035-2.066-.053-2.08a3 3 0 0 1-.122-.593l-.001-.015c-.035-.364-.058-.729-.091-1.1c.247-.446.506-.992.734-1.555l.038-.106c.205-.509.364-.994.503-1.457a.3.3 0 0 0 .139.053h.001l.141.012c.17.018.32-.122.334-.339l.152-1.931v-.002a.32.32 0 0 0-.279-.317h-.019a7.1 7.1 0 0 0-.242-2.999l.013.051A4.27 4.27 0 0 0 11.725.122l-.026-.004a6 6 0 0 0-.993-.112h-.021a5.5 5.5 0 0 0-1.038.118l.036-.006a4.3 4.3 0 0 0-3.114 2.419l-.011.027a7.05 7.05 0 0 0-.225 2.985l-.004-.037a.316.316 0 0 0-.282.313v.007l.152 1.931c.014.222.166.356.33.338z"></path><path fill="currentColor" d="M21.416 20.878c-.07-3.04-.374-3.728-.538-4.194c-.065-.187-.118-1.451-2.206-2.271c-1.28-.504-2.932-.514-4.33-1.105v1.644a3.63 3.63 0 0 1-2.944 3.56l-.023.004a.384.384 0 0 1-.374.32h-.018v1.24a2.194 2.194 0 1 0 4.388 0v-.866a1.248 1.248 0 1 1 .588-.055l-.009.003v.965a2.774 2.774 0 0 1-5.548 0v-.05v.002v-1.251a.38.38 0 0 1-.35-.318v-.002a3.635 3.635 0 0 1-2.954-3.556v-1.657c-1.404.603-3.066.615-4.353 1.12c-2.094.819-2.142 2.08-2.206 2.27c-.16.468-.468 1.153-.538 4.195c-.012.4 0 1.013 1.206 1.549c2.626 1.03 6.009 1.35 9.344 1.58h.32c3.342-.228 6.72-.547 9.344-1.58c1.201-.533 1.212-1.142 1.201-1.546zm-14.681-1.24H5.489v1.251h-.89v-1.247H3.353v-.89h1.246v-1.246h.89v1.246h1.246z"></path><path fill="currentColor" d="M16.225 17.965v-.001a.673.673 0 1 0 0 .001"></path>
                  </svg>
                </div>
              ))}
            Calcified
          </button>

          <button
            type="button"
            className={`relative h-12 rounded flex justify-center items-center ${
              calcificationStatus === false
                ? 'bg-green text-white border border-gray-medium-dark'
                : 'bg-gray-200 border border-gray-medium-dark'
            }`}
            onClick={() => updateCalcification(false)}
          >
            {calcification?.[currentFrame]?.binary_classification === false &&
              (calcification[currentFrame]?.is_calcification_generated ? (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                    <g fill="currentColor"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path><path className={`${calcificationStatus === true ? "bg-gray-pale" : "bg-gray-medium-dark"}`} d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027A1 1 0 0 1 19 2"></path></g>
                  </svg>
                </div>
              ) : (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={15.75} height={18} viewBox="0 0 21 24">
                    <path fill="currentColor" d="m6.53 8.098l.14-.012a.3.3 0 0 0 .141-.053l-.001.001c.134.462.298.948.503 1.457c.263.666.522 1.213.812 1.741l-.04-.08c-.024.364-.053.738-.091 1.1a2.6 2.6 0 0 1-.129.627l.005-.018c-.012.005-.029 2.08-.029 2.08a2.87 2.87 0 0 0 2.198 2.787l.02.004a.38.38 0 0 1 .357-.246h.574a.39.39 0 0 1 .356.243l.001.003a2.88 2.88 0 0 0 2.229-2.789v-.001s-.035-2.066-.053-2.08a3 3 0 0 1-.122-.593l-.001-.015c-.035-.364-.058-.729-.091-1.1c.247-.446.506-.992.734-1.555l.038-.106c.205-.509.364-.994.503-1.457a.3.3 0 0 0 .139.053h.001l.141.012c.17.018.32-.122.334-.339l.152-1.931v-.002a.32.32 0 0 0-.279-.317h-.019a7.1 7.1 0 0 0-.242-2.999l.013.051A4.27 4.27 0 0 0 11.725.122l-.026-.004a6 6 0 0 0-.993-.112h-.021a5.5 5.5 0 0 0-1.038.118l.036-.006a4.3 4.3 0 0 0-3.114 2.419l-.011.027a7.05 7.05 0 0 0-.225 2.985l-.004-.037a.316.316 0 0 0-.282.313v.007l.152 1.931c.014.222.166.356.33.338z"></path><path fill="currentColor" d="M21.416 20.878c-.07-3.04-.374-3.728-.538-4.194c-.065-.187-.118-1.451-2.206-2.271c-1.28-.504-2.932-.514-4.33-1.105v1.644a3.63 3.63 0 0 1-2.944 3.56l-.023.004a.384.384 0 0 1-.374.32h-.018v1.24a2.194 2.194 0 1 0 4.388 0v-.866a1.248 1.248 0 1 1 .588-.055l-.009.003v.965a2.774 2.774 0 0 1-5.548 0v-.05v.002v-1.251a.38.38 0 0 1-.35-.318v-.002a3.635 3.635 0 0 1-2.954-3.556v-1.657c-1.404.603-3.066.615-4.353 1.12c-2.094.819-2.142 2.08-2.206 2.27c-.16.468-.468 1.153-.538 4.195c-.012.4 0 1.013 1.206 1.549c2.626 1.03 6.009 1.35 9.344 1.58h.32c3.342-.228 6.72-.547 9.344-1.58c1.201-.533 1.212-1.142 1.201-1.546zm-14.681-1.24H5.489v1.251h-.89v-1.247H3.353v-.89h1.246v-1.246h.89v1.246h1.246z"></path><path fill="currentColor" d="M16.225 17.965v-.001a.673.673 0 1 0 0 .001"></path>
                  </svg>
                </div>
              ))}
            Not Calcified
          </button>
        </div>
        <div className="my-4">
          {/* Exibe a mensagem de acordo com o status de calcificação e se é gerado pelo algoritmo ou pelo médico */}
          {calcification[currentFrame]?.binary_classification !== undefined &&
            calcification[currentFrame]?.binary_classification !== null && // ou null
            (calcification[currentFrame]?.is_calcification_generated ? (
              calcification[currentFrame].binary_classification ? (
                <strong>The algorithm detected calcium deposits in the delimited area.</strong>
              ) : (
                <strong>The algorithm did not detect calcium deposits in the delimited area.</strong>
              )
            ) : calcification[currentFrame]?.binary_classification ? (
              <strong>Dr. {user?.first_name + " " + user?.last_name} marked the valve area as calcified.</strong>
            ) : (
              <strong>Dr. {user?.first_name + " " + user?.last_name} marked the valve area as not calcified.</strong>
            ))}
        </div>
      </form>

      <div className="flex items-center gap-4 py-2">
        <label className="leading-0" htmlFor="auto-report">
          Generate report automatically
        </label>

        <Switch.Root
          checked={autoReport}
          onCheckedChange={() => setAutoReport(!autoReport)}
          className="relative h-5 w-9 cursor-default rounded-full bg-green-dark outline-none data-[state=checked]:bg-green-800"
          id="auto-report"
          style={{ "-webkit-tap-highlight-color": "rgba(0, 0, 0, 0)" }}
        >
          <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_1px] shadow-green-950 transition-transform duration-150 ease-out will-change-transform data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>

        <Tooltip.Provider delayDuration={500}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="text-gray-medium-dark">
                <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M11.95 18q.525 0 .888-.363t.362-.887t-.362-.888t-.888-.362t-.887.363t-.363.887t.363.888t.887.362m-.9-3.85h1.85q0-.825.188-1.3t1.062-1.3q.65-.65 1.025-1.238T15.55 8.9q0-1.4-1.025-2.15T12.1 6q-1.425 0-2.312.75T8.55 8.55l1.65.65q.125-.45.563-.975T12.1 7.7q.8 0 1.2.438t.4.962q0 .5-.3.938t-.75.812q-1.1.975-1.35 1.475t-.25 1.825M12 22q-2.075 0-3.9-.787t-3.175-2.138T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"></path>
                </svg>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none max-w-82 rounded bg-white px-[15px] py-2.5 text-sm leading-none text-gray-medium-dark shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade"
                sideOffset={5}
              >
                Indicates whether or not the clinical report will be automatically generated when results are submitted.
                If so, the report will be available in Records and in the respective patient's menu.
                <Tooltip.Arrow className="fill-white" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h4>Relatório clínico</h4>
          <button
            type="button"
            className="text-green-dark text-sm font-medium"
            onClick={handleGenerateReport}
            disabled={!isValidated}
          >
            Gerar relatório
          </button>
        </div>
        <p className="text-sm text-gray-600">
          {isValidated
            ? 'Gerar automaticamente e ajustar observações antes de exportar.'
            : 'Valide a deteção para desbloquear o relatório.'}
        </p>
        <textarea
          className="w-full min-h-[180px] rounded border border-gray-pale p-3 text-sm bg-white"
          value={reportText}
          onChange={(event) => handleReportChange(event.target.value)}
          placeholder="Clique em 'Gerar relatório' para preencher o template."
          disabled={!isValidated}
        />
        <button
          type="button"
          className="bg-green-dark text-white px-4 py-2 rounded"
          onClick={async () => {
            const echoData = await getEchoResults(patient.id);
            const pdfBlob = await generatePdfBlob(echoData, patient, user, reportText);
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
          }}
          disabled={!reportText}
        >
          Exportar PDF
        </button>
      </div>

      <div className="w-full flex gap-2 mt-8">
        {/* Botão de cancelar análise e voltar atrás (com confirmação) */}
        <AlertDialog
          heading="Discard changes?"
          text="Are you sure you want to go back? Any unsaved data will be lost!"
          onConfirm={() => {
            setUnsavedChanges(false);
            navigate(`/select_echo?patient=${patient.id}&echo=${echoId}`);
          }}
        >
          <button className="grid place-items-center basis-24 border-green-dark border-2 rounded-lg py-2 text-gray-dark">
            Cancel
          </button>
        </AlertDialog>

        {/* Botão de salvar novos dados (com confirmação) */}
        <AlertDialog
          heading="Save new changes?"
          text="This action cannot be undone! The current annotation data will be overwritten with the new changes."
          onConfirm={() => handleUpdateEcho(false)}
        >
          <button className="grid place-items-center basis-24 bg-green rounded-lg py-2 text-white">
            Save
          </button>
        </AlertDialog>

        {/* Botão de salvar novos dados e marcar ecocardiograma como concluído (com confirmação) */}
        <AlertDialog
          heading="Submit echocardiography?"
          text={`This action will formalize ${patient?.name}'s analysis results and mark the echocardiography as complete.`}
          onConfirm={() => handleUpdateEcho(true)}
        >
          <button className="basis-50 flex items-center justify-center gap-2 ml-auto bg-green-dark rounded-lg py-2 px-6 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 16 16">
              <path fill="currentColor" fillRule="evenodd" d="M2 2.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V7h-1V3H3v10h2.005v1H2.5a.5.5 0 0 1-.5-.5zm11.994 6.832l-4.52 4.519a.5.5 0 0 1-.706 0l-2.51-2.51l.706-.708l2.157 2.157l4.166-4.166z" clipRule="evenodd"></path>
            </svg>
            Ready to Submit
          </button>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AnnotationToolMenu;
