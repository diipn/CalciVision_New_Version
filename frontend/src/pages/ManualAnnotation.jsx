import { useEffect, useRef, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import AnnotationTool from '../components/AnnotationTool';
import AnalysisWizard from '../components/AnalysisWizard';
import FrameNavigator from '../components/FrameNavigator';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
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
  const { setUnsavedChanges } = useUnsavedStore();

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
          frame.data
            ? frame.data.map((rect) => {
                if (rect.is_annotation_generated)
                  return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    id: 'prediction',
                    is_annotation_generated: true,
                  };
              })
            : [];
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
              return parsed?.calcification?.[currentFrame];
            } catch {
              return null;
            }
          })()) || formattedCalcification[currentFrame];
        if (currentCalc?.binary_classification !== null && currentCalc?.binary_classification !== undefined) {
          setCalcificationStatus(currentCalc.binary_classification === 1);
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
