import { useEffect, useRef, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import AnnotationTool from '../components/AnnotationTool';
import AnalysisWizard from '../components/AnalysisWizard';
import FrameNavigator from '../components/FrameNavigator';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import api, { getExamSettings, updateExamSettings } from '../api';
import { useUnsavedStore } from '../store/useUnsavedStore';
import { defaultImageSettings } from '../mocks/mockDb';

export default function ManualAnnotation() {
  const [frames, setFrames] = useState([]);
  const [rects, setRects] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [calcification, setCalcification] = useState([]);
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
    const fetchFrames = async () => {
      try {
        const patientInfoResponse = await api.get(`/api/patient/${patientId}/`);
        patientInfoResponse.status === 200 && setPatient(patientInfoResponse.data);

        const echoFramesResponse = await api.get(
          `/api/patient/${patientId}/echocardiogram/${echoId}/frames/`
        );
        const data = echoFramesResponse.data;

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
        setRects(formattedRects);
        setPredictedValveBoxes(formattedPredictedValveBoxes);
        setCalcification(formattedCalcification);
        setPredictionHistory(formattedPredictionHistory);

        formattedCalcification[currentFrame]?.binary_classification !== null &&
          formattedCalcification[currentFrame]?.binary_classification !== undefined &&
          setCalcificationStatus(
            formattedCalcification[currentFrame].binary_classification === 1
          );
      } catch (error) {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          navigate('/404');
        }
      }
    };
    fetchFrames();
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
