import { useEffect, useMemo, useRef, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import AnnotationTool from '../components/AnnotationTool';
import AnalysisWizard from '../components/AnalysisWizard';
import FrameNavigator from '../components/FrameNavigator';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getExamSettings, updateExamSettings } from '../api';
import { useUnsavedStore } from '../store/useUnsavedStore';
import { defaultImageSettings } from '../constants';

export default function ManualAnnotation() {
  const [frames, setFrames] = useState([]);
  const [rects, setRects] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [calcification, setCalcification] = useState([]);
  const [framesLoading, setFramesLoading] = useState(true);
  // Histórico de previsões. Se a previsão de cálcio para uma área já foi feita, guarda neste array em vez de enviar para o modelo desnecessariamente
  const [predictionHistory, setPredictionHistory] = useState([]);
  // A posição do retângulo dada pelo modelo
  const [predictedValveBoxes, setPredictedValveBoxes] = useState([]);
  const [calcificationStatus, setCalcificationStatus] = useState(null);
  const [imageSettings, setImageSettings] = useState(defaultImageSettings);
  const annotationToolRef = useRef(null);

  const [patient, setPatient] = useState(null);
  const [exam, setExam] = useState(null);
  const { patientId, echoId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasUnsavedChanges, setUnsavedChanges } = useUnsavedStore();

  const analysisSequence = useMemo(() => {
    const rawSequence = searchParams.get('sequence');
    const parsedSequence = rawSequence
      ? rawSequence
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    const uniqueSequence = parsedSequence.filter(
      (value, index) => parsedSequence.indexOf(value) === index
    );

    if (!uniqueSequence.includes(String(echoId))) {
      uniqueSequence.unshift(String(echoId));
    }

    return uniqueSequence;
  }, [searchParams, echoId]);

  const currentExamSequenceIndex = Math.max(
    0,
    analysisSequence.findIndex((value) => value === String(echoId))
  );
  const hasPreviousExam = currentExamSequenceIndex > 0;
  const hasNextExam = currentExamSequenceIndex < analysisSequence.length - 1;

  const navigateToSequenceExam = (sequenceIndex) => {
    const nextEchoId = analysisSequence[sequenceIndex];
    if (!nextEchoId || nextEchoId === String(echoId)) return;

    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'Tens alterações por guardar neste exame. Desejas avançar mesmo assim?'
      );
      if (!confirmLeave) return;
      setUnsavedChanges(false);
    }

    const search =
      analysisSequence.length > 1 ? `?sequence=${analysisSequence.join(',')}` : '';
    navigate(`/analyse_aortic_valve/${patientId}/${nextEchoId}${search}`);
  };

  useEffect(() => {
    setFrames([]);
    setRects([]);
    setCurrentFrame(0);
    setCalcification([]);
    setPredictionHistory([]);
    setPredictedValveBoxes([]);
    setCalcificationStatus(null);
    setExam(null);
  }, [echoId]);

  useEffect(() => {
    let isActive = true;
    let retryTimeout = null;
    const maxAttempts = 12;
    const retryDelayMs = 2000;

    const fetchFrames = async (attempt = 0) => {
      try {
        const patientInfoResponse = await api.get(`/api/patient/${patientId}/`);
        if (patientInfoResponse.status === 200 && isActive) {
          setPatient(patientInfoResponse.data);
        }

        const echoFramesResponse = await api.get(
          `/api/patient/${patientId}/echocardiogram/${echoId}/frames/`
        );
        const data = echoFramesResponse.data;
        if (!isActive) return;

        if (!data?.length) {
          if (attempt < maxAttempts) {
            retryTimeout = setTimeout(() => fetchFrames(attempt + 1), retryDelayMs);
            return;
          }
          setFramesLoading(false);
          return;
        }

        // Atualiza os states principais
        const formattedFrames = data.map((frame) => ({
          id: frame.id,
          url: frame.image_url,
          name: frame.image_url.split('/').pop(),
        }));

        const formattedRects = data.map((frame, frameIndex) =>
          frame.data
            ? frame.data.map((rect, rectIndex) => ({
                id: `${frameIndex}.${rectIndex}`,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                is_annotation_generated: Boolean(rect.is_annotation_generated),
              }))
            : []
        );

        const formattedPredictedValveBoxes = data.map((frame) => {
          const generatedRect = frame.data?.find((rect) => rect.is_annotation_generated);
          if (!generatedRect) return null;
          return {
            x: generatedRect.x,
            y: generatedRect.y,
            width: generatedRect.width,
            height: generatedRect.height,
            id: 'prediction',
            is_annotation_generated: true,
          };
        });


        const formattedCalcification = data.map((frame) =>
          frame.data?.[0] && frame.data[0].is_calcified !== null
            ? {
                binary_classification: frame.data[0].is_calcified,
                confidence: frame.data[0].confidence,
                is_annotation_generated: Boolean(frame.data[0].is_calcification_generated),
              }
            : null
        );

        // Preenche o histórico com os dados de `data`
        const formattedPredictionHistory = data.map((frame) => {
          const rect = frame.data?.[0];
          if (rect) {
            return [
              {
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  is_annotation_generated: Boolean(rect.is_annotation_generated),
                },
                results:
                  frame.data[0].is_calcified !== null
                    ? {
                        binary_classification: rect.is_calcified,
                        confidence: rect.confidence,
                      }
                    : null,
              },
            ];
          }
          return [];
        });

        // Atualiza todos os states ao mesmo tempo
        setFrames(formattedFrames);
        const savedProgress = localStorage.getItem(`exam-progress-${echoId}`);
        if (savedProgress) {
          try {
            const parsed = JSON.parse(savedProgress);
            const savedRects = Array.isArray(parsed?.rects) ? parsed.rects : formattedRects;
            const savedCalcification = Array.isArray(parsed?.calcification)
              ? parsed.calcification
              : formattedCalcification;
            setRects(savedRects);
            setCalcification(savedCalcification);
          } catch {
            setRects(formattedRects);
            setCalcification(formattedCalcification);
          }
        } else {
          setRects(formattedRects);
          setCalcification(formattedCalcification);
        }
        setPredictedValveBoxes(formattedPredictedValveBoxes);
        setPredictionHistory(formattedPredictionHistory);

        const currentCalc =
          (savedProgress && (() => {
            try {
              const parsed = JSON.parse(savedProgress);
              return parsed?.calcification?.[0];
            } catch {
              return null;
            }
          })()) || formattedCalcification[0];
        if (currentCalc?.binary_classification !== null && currentCalc?.binary_classification !== undefined) {
          setCalcificationStatus(Boolean(currentCalc.binary_classification));
        }
        setFramesLoading(false);
      } catch (error) {
        if (!isActive) return;
        setFramesLoading(false);
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          navigate('/404');
        }
      }
    };
    setFramesLoading(true);
    fetchFrames();
    return () => {
      isActive = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [patientId, echoId]);

  useEffect(() => {
    if (patient) {
      const currentExam = patient.echocardiograms?.find((item) => item.id == echoId);
      setExam(currentExam || null);
    }
  }, [patient, echoId]);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getExamSettings(echoId);
      if (settings?.imageSettings) {
        setImageSettings(settings.imageSettings);
      } else {
        setImageSettings(defaultImageSettings);
      }
    };
    loadSettings();
  }, [echoId]);

  const handleImageSettingsChange = async (nextSettings) => {
    setImageSettings(nextSettings);
    await updateExamSettings(echoId, { imageSettings: nextSettings });
    setUnsavedChanges(true);
  };

  return (
    <MainLayout pageTitle={`Anotação da Válvula Aórtica — ${patient?.name || 'CalciVision'}`}>
      {analysisSequence.length > 1 && (
        <div className="mb-4 rounded-lg border border-green-pale bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sequência de análise
              </p>
              <h2 className="text-base font-semibold text-gray-900">
                Exame {currentExamSequenceIndex + 1} de {analysisSequence.length}
              </h2>
              <p className="text-sm text-gray-600">
                {exam?.description || `Ecocardiograma ${echoId}`}
              </p>
              {hasNextExam && (
                <p className="mt-1 text-xs text-gray-500">
                  Após submeter este exame, o próximo abre automaticamente.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm font-semibold text-green-dark disabled:opacity-40"
                onClick={() => navigateToSequenceExam(currentExamSequenceIndex - 1)}
                disabled={!hasPreviousExam}
              >
                Exame anterior
              </button>
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm font-semibold text-green-dark disabled:opacity-40"
                onClick={() => navigateToSequenceExam(currentExamSequenceIndex + 1)}
                disabled={!hasNextExam}
              >
                Próximo exame
              </button>
            </div>
          </div>
        </div>
      )}
      {framesLoading && (
        <div className="mb-4 rounded-lg border border-green-pale bg-green-light/40 px-4 py-3 text-sm text-green-dark">
          A carregar imagens do ecocardiograma. Isto pode demorar alguns segundos.
        </div>
      )}
      {!framesLoading && frames.length === 0 && (
        <div className="mb-4 rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          Não foi possível carregar os frames do ecocardiograma. Verifique o DICOM e tente novamente.
        </div>
      )}
      <AnalysisWizard
        annotationToolRef={annotationToolRef}
        frames={frames}
        rects={rects}
        calcification={calcification}
        calcificationStatus={calcificationStatus}
        setCalcificationStatus={setCalcificationStatus}
        predictionHistory={predictionHistory}
        patient={patient}
        exam={exam}
        echoId={echoId}
        imageSettings={imageSettings}
        onImageSettingsChange={handleImageSettingsChange}
        defaultImageSettings={defaultImageSettings}
        hasNextExam={hasNextExam}
        onAdvanceToNextExam={
          hasNextExam
            ? () => navigateToSequenceExam(currentExamSequenceIndex + 1)
            : undefined
        }
        renderCanvas={(handleAnnotationChanged) => (
          <>
            <AnnotationTool
              ref={annotationToolRef}
              frames={frames}
              currentFrame={currentFrame}
              rects={rects}
              setRects={setRects}
              calcificationStatus={calcificationStatus}
              setCalcificationStatus={setCalcificationStatus}
              predictedValveBoxes={predictedValveBoxes}
              setPredictedValveBoxes={setPredictedValveBoxes}
              calcification={calcification}
              setCalcification={setCalcification}
              predictionHistory={predictionHistory}
              setPredictionHistory={setPredictionHistory}
              imageSettings={imageSettings}
              onImageSettingsChange={handleImageSettingsChange}
              onAnnotationChange={handleAnnotationChanged}
            />
            <FrameNavigator
              frames={frames}
              rects={rects}
              currentFrame={currentFrame}
              setCurrentFrame={setCurrentFrame}
            />
          </>
        )}
      />
    </MainLayout>
  );
}
