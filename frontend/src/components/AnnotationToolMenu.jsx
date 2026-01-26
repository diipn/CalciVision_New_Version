import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { createReport, getEchoResults } from "../api";
import { useUser } from "../contexts/UserContext";
import AlertDialog from "./AlertDialogMenu";
import { useUnsavedStore } from "../store/useUnsavedStore";
import { Switch, Tooltip } from "radix-ui";
import ReportPDF from "./ReportPDF";
import { pdf } from "@react-pdf/renderer";

const AnnotationToolMenu = ({ frames, currentFrame, setCurrentFrame, rects, calcification, setCalcification, calcificationStatus, setCalcificationStatus, predictionHistory, patient, echoId, valveConfirmations, calciumScore, reportText, setReportText }) => {
  const [echoName, setEchoName] = useState("");
  const [autoReport, setAutoReport] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const form = useRef(null);
  const { user } = useUser();
  const navigate = useNavigate();
  const { setUnsavedChanges, hasUnsavedChanges } = useUnsavedStore();

  useEffect(() => {
    if (hasUnsavedChanges) {
      setStatusMessage(null);
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (patient) {
      setEchoName(
        patient.echocardiograms.find((echo) => echo.id == echoId).description
      );
    }
  }, [patient]);

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
        if (savedPrediction.results?.binary_classification !== undefined && savedPrediction.results?.binary_classification !== null) {
          setCalcificationStatus(savedPrediction.results.binary_classification);
        }

        console.log("encontrado no histórico");
      } else {
        // Se não houver predição, limpa o valor
        setCalcification((prev) => {
          const updated = [...prev];
          updated[currentFrame] = null;
          return updated;
        });

        setCalcificationStatus(null);
        console.log("não encontrado no histórico");
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
      const results = frames.map((frame, frameIndex) => ({
        frame_id: frame.id,
        rects: [...rects[frameIndex]],
        is_calcified: calcificationStatus,
        generated_calcium:
          calcification[frameIndex]?.is_calcification_generated,
      }));

      await api.post(
        `/api/patient/${patient.id}/echocardiogram/${echoId}/submit/`,
        { results, completed, echoName }
      );

      if (calciumScore !== null && calciumScore !== undefined) {
        const scoreValue = Number(calciumScore);
        localStorage.setItem(`calciumScore:${patient.id}`, scoreValue.toFixed(2));
        localStorage.setItem(`calciumScore:${patient.id}:${echoId}`, scoreValue.toFixed(2));
      }

      if (reportText) {
        localStorage.setItem(`reportText:${patient.id}:${echoId}`, reportText);
      }

      // Gera o relatório automaticamente
      if (autoReport && completed) {
        try {
          const echoData = await getEchoResults(patient.id);

          const pdfBlob = await generatePdfBlob(echoData, patient, user, calciumScore, reportText);
          const formData = new FormData();
          formData.append("pdf_file", pdfBlob, `report_${patient.id}.pdf`);

          await createReport(formData, patient.id);
        } catch (err) {
          console.error("Erro ao gerar o relatório:", err);
        }
      }

      setUnsavedChanges(false);
      setStatusMessage("saved");
      completed && navigate(`/patients?patient=${patient.id}`);
    } catch (error) {
      console.error("Erro na submissão dos resultados", error);
    }
  };

  const generatePdfBlob = async (echoData, selectedPatient, user, scoreValue, notes) => {
    const doc = (
      <ReportPDF data={echoData} patient={selectedPatient} medico={user} calciumScore={scoreValue} reportText={notes} />
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
    setUnsavedChanges(true);
  };

  const framesWithValve = rects.filter(
    (frameRects) => frameRects.length > 0
  ).length;
  const framesCompleted = rects.filter(
    (frameRects, idx) => frameRects.length > 0 && calcification[idx] !== null
  ).length;
  const readyToSubmit = rects.some(
    (frameRects, idx) => frameRects.length > 0 && calcification[idx] !== null
  );
  const aiResult = calcification[currentFrame];
  const aiHasResult = aiResult?.is_calcification_generated && aiResult?.binary_classification !== undefined && aiResult?.binary_classification !== null;
  const valveIdentified = rects[currentFrame]?.length > 0;
  const valveConfirmed = valveConfirmations?.[currentFrame] === true;
  const calcificationDone = calcification[currentFrame]?.binary_classification !== undefined && calcification[currentFrame]?.binary_classification !== null;

  return (
    <div className="bg-gray-light p-3 rounded-lg w-full border-t-6 border-red-dark mb-4">
      <form id="form" ref={form} className="p-2">
        <div>
          <h3 className="mb-2">{patient?.name}</h3>
          <p className="text-sm text-gray-700">
            Identifique a válvula aórtica, confirme o contorno e valide a calcificação.
          </p>
        </div>

        <label htmlFor="imageName" className="block my-4">
          <div className="mb-1 text-gray-medium">Ecodoppler</div>
          <input
            type="text"
            name="imageName"
            id="imageName"
            placeholder="Nome do exame..."
            value={echoName}
            onChange={(e) => setEchoName(e.target.value)}
            className="block w-full border rounded-sm border-gray-dark bg-gray-soft py-1 px-3"
          />
        </label>

        <div className="space-y-4 text-sm text-gray-700">
          <h4 className="mt-6">Resumo de progresso</h4>
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <span>{valveIdentified ? "✔" : "⏳"}</span>
              <span>Válvula identificada</span>
            </li>
            <li className="flex items-center gap-2">
              <span>{valveConfirmed ? "✔" : "⏳"}</span>
              <span>Anotação concluída</span>
            </li>
            <li className="flex items-center gap-2">
              <span>{calcificationDone ? "✔" : "⏳"}</span>
              <span>{calcificationDone ? "Calcificação analisada" : "Calcificação por analisar"}</span>
            </li>
          </ul>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>Total de imagens: <strong className="text-gray-900">{frames.length}</strong></div>
            <div>Imagens com válvula: <strong className="text-gray-900">{framesWithValve}</strong></div>
            <div>Anotações completas: <strong className="text-gray-900">{framesCompleted}</strong></div>
            <div>
              Imagem atual:
              <select
                className="ml-2 rounded border border-gray-pale bg-white px-2 py-1"
                value={currentFrame}
                onChange={(e) => setCurrentFrame(Number(e.target.value))}
              >
                {frames.map((_, index) => (
                  <option key={index} value={index}>{`Frame ${index + 1}`}</option>
                ))}
              </select>
            </div>
          </div>

          {(statusMessage === "saved" || hasUnsavedChanges || readyToSubmit) && (
            <div
              className={`flex items-center gap-2 rounded-md p-2 ring-1 ${
                statusMessage === "saved"
                  ? "bg-green-50 text-green-700 ring-green-200"
                  : hasUnsavedChanges
                  ? "bg-orange-50 text-orange-700 ring-orange-200"
                  : "bg-green-50 text-green-700 ring-green-200"
              }`}
              role="alert"
            >
              <div className={`p-1 rounded-full ${statusMessage === "saved" ? "bg-green-100 text-green-600" : hasUnsavedChanges ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 1024 1024" fill="currentColor">
                  {statusMessage === "saved" ? (
                    <path d="M512 64a448 448 0 1 1 0 896a448 448 0 0 1 0-896m-55.808 536.384l-99.52-99.584a38.4 38.4 0 1 0-54.336 54.336l126.72 126.72a38.27 38.27 0 0 0 54.336 0l262.4-262.464a38.4 38.4 0 1 0-54.272-54.336z" />
                  ) : (
                    <path d="M512 64a448 448 0 1 1 0 896a448 448 0 0 1 0-896m0 192a58.43 58.43 0 0 0-58.24 63.744l23.36 256.384a35.072 35.072 0 0 0 69.76 0l23.296-256.384A58.43 58.43 0 0 0 512 256m0 512a51.2 51.2 0 1 0 0-102.4a51.2 51.2 0 0 0 0 102.4" />
                  )}
                </svg>
              </div>
              <span className="font-medium">
                {statusMessage === "saved"
                  ? "Análise guardada com sucesso"
                  : hasUnsavedChanges
                  ? "Alterações não guardadas"
                  : "Pronto para guardar"}
              </span>
            </div>
          )}
        </div>

        <h4 className="mt-6">Calcificação</h4>
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-gray-pale bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Resultado da IA</p>
                <strong className="text-base">
                  {aiHasResult
                    ? aiResult.binary_classification
                      ? "Calcificada"
                      : "Não calcificada"
                    : "Sem resultado automático"}
                </strong>
              </div>
              <div className="text-right text-sm" title="Valor quantitativo indicativo do grau de calcificação (protótipo)">
                <span className="text-gray-500">Calcium score: </span>
                <strong>
                  {Number.isFinite(calciumScore) ? calciumScore.toFixed(2) : "--"}
                </strong>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-gray-pale bg-white p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">Confirmação clínica</p>
            <div className="grid grid-cols-2 justify-center gap-3">
          <button
            type="button"
            className={`relative h-12 rounded flex justify-center items-center ${
              calcificationStatus === true
                ? "bg-red text-white border border-gray-medium-dark"
                : "bg-gray-200 border border-gray-medium-dark"
            }`}
            onClick={() => updateCalcification(true)}
          >
            {calcification?.[currentFrame]?.binary_classification === true &&
              (calcification[currentFrame]?.is_calcification_generated ? (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                    <g fill="currentColor"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path><path className={`${calcificationStatus === true ? "bg-gray-pale" : "bg-gray-medium-dark"}`} d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027a1 1 0 0 1-1.845.117l-.048-.117l-.35-1.026l-1.027-.35a1 1 0 0 1-.118-1.845l.118-.048l1.026-.35l.35-1.027A1 1 0 0 1 19 2"></path></g>
                  </svg>
                </div>
              ) : (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={15.75} height={18} viewBox="0 0 21 24">
                    <path fill="currentColor" d="m6.53 8.098l.14-.012a.3.3 0 0 0 .141-.053l-.001.001c.134.462.298.948.503 1.457c.263.666.522 1.213.812 1.741l-.04-.08c-.024.364-.053.738-.091 1.1a2.6 2.6 0 0 1-.129.627l.005-.018c-.012.005-.029 2.08-.029 2.08a2.87 2.87 0 0 0 2.198 2.787l.02.004a.38.38 0 0 1 .357-.246h.574a.39.39 0 0 1 .356.243l.001.003a2.88 2.88 0 0 0 2.229-2.789v-.001s-.035-2.066-.053-2.08a3 3 0 0 1-.122-.593l-.001-.015c-.035-.364-.058-.729-.091-1.1c.247-.446.506-.992.734-1.555l.038-.106c.205-.509.364-.994.503-1.457a.3.3 0 0 0 .139.053h.001l.141.012c.17.018.32-.122.334-.339l.152-1.931v-.002a.32.32 0 0 0-.279-.317h-.019a7.1 7.1 0 0 0-.242-2.999l.013.051A4.27 4.27 0 0 0 11.725.122l-.026-.004a6 6 0 0 0-.993-.112h-.021a5.5 5.5 0 0 0-1.038.118l.036-.006a4.3 4.3 0 0 0-3.114 2.419l-.011.027a7.05 7.05 0 0 0-.225 2.985l-.004-.037a.316.316 0 0 0-.282.313v.007l.152 1.931c.014.222.166.356.33.338z"></path><path fill="currentColor" d="M21.416 20.878c-.07-3.04-.374-3.728-.538-4.194c-.065-.187-.118-1.451-2.206-2.271c-1.28-.504-2.932-.514-4.33-1.105v1.644a3.63 3.63 0 0 1-2.944 3.56l-.023.004a.384.384 0 0 1-.374.32h-.018v1.24a2.194 2.194 0 1 0 4.388 0v-.866a1.248 1.248 0 1 1 .588-.055l-.009.003v.965a2.774 2.774 0 0 1-5.548 0v-.05v.002v-1.251a.38.38 0 0 1-.35-.318v-.002a3.635 3.635 0 0 1-2.954-3.556v-1.657c-1.404.603-3.066.615-4.353 1.12c-2.094.819-2.142 2.08-2.206 2.27c-.16.468-.468 1.153-.538 4.195c-.012.4 0 1.013 1.206 1.549c2.626 1.03 6.009 1.35 9.344 1.58h.32c3.342-.228 6.72-.547 9.344-1.58c1.201-.533 1.212-1.142 1.201-1.546zm-14.681-1.24H5.489v1.251h-.89v-1.247H3.353v-.89h1.246v-1.246h.89v1.246h1.246z"></path><path fill="currentColor" d="M16.225 17.965v-.001a.673.673 0 1 0 0 .001"></path>
                  </svg>
                </div>
              ))}
            Calcificada
          </button>

          <button
            type="button"
            className={`relative h-12 rounded flex justify-center items-center ${
              calcificationStatus === false
                ? "bg-red text-white border border-gray-medium-dark"
                : "bg-gray-200 border border-gray-medium-dark"
            }`}
            onClick={() => updateCalcification(false)}
          >
            {calcification?.[currentFrame]?.binary_classification === false &&
              (calcification[currentFrame]?.is_calcification_generated ? (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                    <g fill="currentColor"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path><path className={`${calcificationStatus === true ? "bg-gray-pale" : "bg-gray-medium-dark"}`} d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027a1 1 0 0 1-1.845.117l-.048-.117l-.35-1.026l-1.027-.35a1 1 0 0 1-.118-1.845l.118-.048l1.026-.35l.35-1.027A1 1 0 0 1 19 2"></path></g>
                  </svg>
                </div>
              ) : (
                <div className="absolute top-2 left-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width={15.75} height={18} viewBox="0 0 21 24">
                    <path fill="currentColor" d="m6.53 8.098l.14-.012a.3.3 0 0 0 .141-.053l-.001.001c.134.462.298.948.503 1.457c.263.666.522 1.213.812 1.741l-.04-.08c-.024.364-.053.738-.091 1.1a2.6 2.6 0 0 1-.129.627l.005-.018c-.012.005-.029 2.08-.029 2.08a2.87 2.87 0 0 0 2.198 2.787l.02.004a.38.38 0 0 1 .357-.246h.574a.39.39 0 0 1 .356.243l.001.003a2.88 2.88 0 0 0 2.229-2.789v-.001s-.035-2.066-.053-2.08a3 3 0 0 1-.122-.593l-.001-.015c-.035-.364-.058-.729-.091-1.1c.247-.446.506-.992.734-1.555l.038-.106c.205-.509.364-.994.503-1.457a.3.3 0 0 0 .139.053h.001l.141.012c.17.018.32-.122.334-.339l.152-1.931v-.002a.32.32 0 0 0-.279-.317h-.019a7.1 7.1 0 0 0-.242-2.999l.013.051A4.27 4.27 0 0 0 11.725.122l-.026-.004a6 6 0 0 0-.993-.112h-.021a5.5 5.5 0 0 0-1.038.118l.036-.006a4.3 4.3 0 0 0-3.114 2.419l-.011.027a7.05 7.05 0 0 0-.225 2.985l-.004-.037a.316.316 0 0 0-.282.313v.007l.152 1.931c.014.222.166.356.33.338z"></path><path fill="currentColor" d="M21.416 20.878c-.07-3.04-.374-3.728-.538-4.194c-.065-.187-.118-1.451-2.206-2.271c-1.28-.504-2.932-.514-4.33-1.105v1.644a3.63 3.63 0 0 1-2.944 3.56l-.023.004a.384.384 0 0 1-.374.32h-.018v1.24a2.194 2.194 0 1 0 4.388 0v-.866a1.248 1.248 0 1 1 .588-.055l-.009.003v.965a2.774 2.774 0 0 1-5.548 0v-.05v.002v-1.251a.38.38 0 0 1-.35-.318v-.002a3.635 3.635 0 0 1-2.954-3.556v-1.657c-1.404.603-3.066.615-4.353 1.12c-2.094.819-2.142 2.08-2.206 2.27c-.16.468-.468 1.153-.538 4.195c-.012.4 0 1.013 1.206 1.549c2.626 1.03 6.009 1.35 9.344 1.58h.32c3.342-.228 6.72-.547 9.344-1.58c1.201-.533 1.212-1.142 1.201-1.546zm-14.681-1.24H5.489v1.251h-.89v-1.247H3.353v-.89h1.246v-1.246h.89v1.246h1.246z"></path><path fill="currentColor" d="M16.225 17.965v-.001a.673.673 0 1 0 0 .001"></path>
                  </svg>
                </div>
              ))}
            Não calcificada
          </button>
            </div>
          </div>
        </div>
        <div className="my-4">
          {/* Exibe a mensagem de acordo com o status de calcificação e se é gerado pelo algoritmo ou pelo médico */}
          {calcification[currentFrame]?.binary_classification !== undefined &&
            calcification[currentFrame]?.binary_classification !== null && // ou null
            (calcification[currentFrame]?.is_calcification_generated ? (
              calcification[currentFrame].binary_classification ? (
                <strong>
                  A IA detetou calcificação na área delimitada.
                </strong>
              ) : (
                <strong>
                  A IA não detetou calcificação na área delimitada.
                </strong>
              )
            ) : calcification[currentFrame]?.binary_classification ? (
              <strong>
                Dr. {user?.first_name + " " + user?.last_name} confirmou a válvula como calcificada.
              </strong>
            ) : (
              <strong>
                Dr. {user?.first_name + " " + user?.last_name} confirmou a válvula como não calcificada.
              </strong>
            ))}
        </div>

        <div className="mt-6">
          <h4 className="mb-2">Relatório (rascunho)</h4>
          <textarea
            rows={4}
            value={reportText}
            onChange={(e) => {
              setReportText(e.target.value);
              setUnsavedChanges(true);
            }}
            placeholder="Escreva observações clínicas ou edite o texto sugerido..."
            className="w-full rounded border border-gray-pale bg-white p-3 text-sm"
          />
          <button
            type="button"
            className="mt-3 rounded-lg bg-red-dark px-4 py-2 text-white"
            onClick={async () => {
              if (!patient) return;
              const echoData = await getEchoResults(patient.id);
              const blob = await generatePdfBlob(echoData, patient, user, calciumScore, reportText);
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `relatorio_${patient.id}.pdf`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exportar PDF (simulado)
          </button>
        </div>
      </form>

      <div className="flex items-center gap-4 py-2">
        <label className="leading-0" htmlFor="auto-report">
          Gerar relatório automaticamente
        </label>

        <Switch.Root
          checked={autoReport}
          onCheckedChange={() => setAutoReport(!autoReport)}
          className="relative h-5 w-9 cursor-default rounded-full bg-red-dark outline-none data-[state=checked]:bg-green-800"
          id="auto-report"
          style={{ "-webkit-tap-highlight-color": "rgba(0, 0, 0, 0)" }}
        >
          <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_1px] shadow-red-950 transition-transform duration-150 ease-out will-change-transform data-[state=checked]:translate-x-[18px]" />
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
                Indica se o relatório clínico será gerado automaticamente ao
                submeter os resultados. Ficará disponível em Registos e no menu
                do respetivo paciente.
                <Tooltip.Arrow className="fill-white" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      <div className="w-full flex gap-2 mt-8">
        {/* Botão de cancelar análise e voltar atrás (com confirmação) */}
        <AlertDialog
          heading="Descartar alterações?"
          text="Tem a certeza de que quer sair? As alterações não guardadas serão perdidas."
          onConfirm={() => {
            setUnsavedChanges(false);
            navigate(`/select_echo?patient=${patient.id}&echo=${echoId}`);
          }}
        >
          <button className="grid place-items-center basis-24 border-red border-2 rounded-lg py-2 text-gray-dark">
            Cancelar
          </button>
        </AlertDialog>

        {/* Botão de salvar novos dados (com confirmação) */}
        <AlertDialog
          heading="Guardar alterações?"
          text="Esta ação irá substituir os dados atuais de anotação."
          onConfirm={() => handleUpdateEcho(false)}
        >
          <button className="grid place-items-center basis-24 bg-red rounded-lg py-2 text-white">
            Guardar
          </button>
        </AlertDialog>

        {/* Botão de salvar novos dados e marcar ecocardiograma como concluído (com confirmação) */}
        <AlertDialog
          heading="Submeter ecocardiograma?"
          text={`Esta ação finaliza a análise de ${patient?.name} e marca o exame como concluído.`}
          onConfirm={() => handleUpdateEcho(true)}
        >
          <button className="basis-50 flex items-center justify-center gap-2 ml-auto bg-red-dark rounded-lg py-2 px-6 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 16 16">
              <path fill="currentColor" fillRule="evenodd" d="M2 2.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V7h-1V3H3v10h2.005v1H2.5a.5.5 0 0 1-.5-.5zm11.994 6.832l-4.52 4.519a.5.5 0 0 1-.706 0l-2.51-2.51l.706-.708l2.157 2.157l4.166-4.166z" clipRule="evenodd"></path>
            </svg>
            Confirmar & Guardar
          </button>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AnnotationToolMenu;
