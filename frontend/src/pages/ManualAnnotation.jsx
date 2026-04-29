import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AnnotationTool from '../components/AnnotationTool';
import AnalysisWizard from '../components/AnalysisWizard';
import FrameNavigator from '../components/FrameNavigator';
import api, { getExamSettings, updateExamSettings } from '../api';
import { useUnsavedStore } from '../store/useUnsavedStore';
import { defaultImageSettings } from '../constants';

const createEmptyExamState = (exam = null) => ({
  exam,
  frames: [],
  rects: [],
  currentFrame: 0,
  calcification: [],
  framesLoading: true,
  loadError: '',
  predictionHistory: [],
  predictedValveBoxes: [],
  calcificationStatus: null,
  imageSettings: defaultImageSettings,
});

const hasAdjustedImageSettings = (settings) =>
  ['brightness', 'contrast', 'blur', 'zoom'].some(
    (key) => (settings?.[key] ?? defaultImageSettings[key]) !== defaultImageSettings[key]
  );

export default function ManualAnnotation() {
  const [examStates, setExamStates] = useState({});
  const [patient, setPatient] = useState(null);
  const annotationToolRef = useRef(null);

  const { patientId, echoId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUnsavedChanges } = useUnsavedStore();

  const activeExamId = String(echoId);

  const analysisSequence = useMemo(() => {
    const rawSequence = searchParams.get('sequence');
    const parsedSequence = rawSequence
      ? rawSequence
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [activeExamId];

    const uniqueSequence = parsedSequence.filter(
      (value, index) => parsedSequence.indexOf(value) === index
    );

    if (!uniqueSequence.includes(activeExamId)) {
      uniqueSequence.unshift(activeExamId);
    }

    return uniqueSequence;
  }, [searchParams, activeExamId]);

  const selectedExamFromQuery = searchParams.get('selected');
  const initialSelectedExamId =
    selectedExamFromQuery && analysisSequence.includes(selectedExamFromQuery)
      ? selectedExamFromQuery
      : analysisSequence.length === 1
      ? activeExamId
      : null;

  const [selectedExamId, setSelectedExamId] = useState(initialSelectedExamId);

  useEffect(() => {
    setSelectedExamId(initialSelectedExamId);
  }, [initialSelectedExamId]);

  useEffect(() => {
    setExamStates((prev) => {
      const next = {};
      analysisSequence.forEach((examId) => {
        next[examId] = prev[examId] || createEmptyExamState();
      });
      return next;
    });
  }, [analysisSequence]);

  useEffect(() => {
    let isActive = true;
    const retryTimeouts = [];
    const maxAttempts = 12;
    const retryDelayMs = 2000;

    const mergeExamState = (examId, nextPartial) => {
      if (!isActive) return;
      setExamStates((prev) => {
        const currentState = prev[examId] || createEmptyExamState();
        return {
          ...prev,
          [examId]: {
            ...currentState,
            ...nextPartial,
          },
        };
      });
    };

    const loadExamFrames = async (examId, patientInfo, attempt = 0) => {
      const examMeta =
        patientInfo?.echocardiograms?.find((item) => String(item.id) === examId) || null;

      try {
        const echoFramesResponse = await api.get(
          `/api/patient/${patientId}/echocardiogram/${examId}/frames/`
        );
        const data = echoFramesResponse.data;
        if (!isActive) return;

        if (!data?.length) {
          if (attempt < maxAttempts) {
            const timeoutId = setTimeout(
              () => loadExamFrames(examId, patientInfo, attempt + 1),
              retryDelayMs
            );
            retryTimeouts.push(timeoutId);
            return;
          }

          mergeExamState(examId, {
            exam: examMeta,
            framesLoading: false,
            loadError:
              'Não foi possível carregar os frames deste ecocardiograma. Verifique o DICOM e tente novamente.',
          });
          return;
        }

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

        const savedProgress = localStorage.getItem(`exam-progress-${examId}`);
        let nextRects = formattedRects;
        let nextCalcification = formattedCalcification;

        if (savedProgress) {
          try {
            const parsed = JSON.parse(savedProgress);
            if (Array.isArray(parsed?.rects)) {
              nextRects = parsed.rects;
            }
            if (Array.isArray(parsed?.calcification)) {
              nextCalcification = parsed.calcification;
            }
          } catch {
            nextRects = formattedRects;
            nextCalcification = formattedCalcification;
          }
        }

        const savedSettings = await getExamSettings(examId);
        if (!isActive) return;

        const currentCalc =
          (savedProgress &&
            (() => {
              try {
                const parsed = JSON.parse(savedProgress);
                return parsed?.calcification?.[0];
              } catch {
                return null;
              }
            })()) ||
          formattedCalcification[0];

        mergeExamState(examId, {
          exam: examMeta,
          frames: formattedFrames,
          rects: nextRects,
          currentFrame: 0,
          calcification: nextCalcification,
          framesLoading: false,
          loadError: '',
          predictionHistory: formattedPredictionHistory,
          predictedValveBoxes: formattedPredictedValveBoxes,
          calcificationStatus:
            currentCalc?.binary_classification === null ||
            currentCalc?.binary_classification === undefined
              ? null
              : Boolean(currentCalc.binary_classification),
          imageSettings: savedSettings?.imageSettings || defaultImageSettings,
        });
      } catch (error) {
        if (!isActive) return;
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          navigate('/404');
          return;
        }

        mergeExamState(examId, {
          exam: examMeta,
          framesLoading: false,
          loadError:
            'Não foi possível carregar os frames deste ecocardiograma. Verifique o DICOM e tente novamente.',
        });
      }
    };

    const fetchPatientAndCandidates = async () => {
      try {
        const patientInfoResponse = await api.get(`/api/patient/${patientId}/`);
        if (!isActive) return;

        setPatient(patientInfoResponse.data);
        setExamStates((prev) => {
          const next = { ...prev };
          analysisSequence.forEach((examId) => {
            const examMeta =
              patientInfoResponse.data.echocardiograms?.find(
                (item) => String(item.id) === examId
              ) || null;
            next[examId] = {
              ...(prev[examId] || createEmptyExamState()),
              exam: examMeta,
            };
          });
          return next;
        });

        analysisSequence.forEach((examId) => {
          loadExamFrames(examId, patientInfoResponse.data);
        });
      } catch (error) {
        if (!isActive) return;
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          navigate('/404');
        }
      }
    };

    fetchPatientAndCandidates();

    return () => {
      isActive = false;
      retryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [patientId, analysisSequence, navigate]);

  const activeExamState = examStates[activeExamId] || createEmptyExamState();
  const activeExam =
    activeExamState.exam ||
    patient?.echocardiograms?.find((item) => String(item.id) === activeExamId) ||
    null;

  const updateExamField = (examId, field, updater) => {
    setExamStates((prev) => {
      const currentState = prev[examId] || createEmptyExamState();
      const nextValue =
        typeof updater === 'function' ? updater(currentState[field]) : updater;

      if (Object.is(nextValue, currentState[field])) {
        return prev;
      }

      return {
        ...prev,
        [examId]: {
          ...currentState,
          [field]: nextValue,
        },
      };
    });
  };

  const handleImageSettingsChange = async (nextSettings) => {
    updateExamField(activeExamId, 'imageSettings', nextSettings);
    await updateExamSettings(activeExamId, { imageSettings: nextSettings });
    setUnsavedChanges(true);
  };

  const buildAnalysisPath = (nextExamId, nextSelectedExamId = selectedExamId) => {
    const params = new URLSearchParams();

    if (analysisSequence.length > 1) {
      params.set('sequence', analysisSequence.join(','));
    }

    if (nextSelectedExamId) {
      params.set('selected', nextSelectedExamId);
    }

    const queryString = params.toString();
    return `/analyse_aortic_valve/${patientId}/${nextExamId}${
      queryString ? `?${queryString}` : ''
    }`;
  };

  const handleActiveExamChange = (nextExamId) => {
    if (!nextExamId || nextExamId === activeExamId) return;
    navigate(buildAnalysisPath(nextExamId), { replace: true });
  };

  const handleSelectCurrentExam = () => {
    setSelectedExamId(activeExamId);
    navigate(buildAnalysisPath(activeExamId, activeExamId), { replace: true });
  };

  const comparisonCandidates = useMemo(
    () =>
      analysisSequence.map((examId, index) => {
        const state = examStates[examId] || createEmptyExamState();
        const examMeta =
          state.exam ||
          patient?.echocardiograms?.find((item) => String(item.id) === examId) ||
          null;

        const hasAnnotation = state.rects.some((frameRects) => frameRects?.length > 0);
        const hasDetectionTested =
          state.predictedValveBoxes.some(Boolean) ||
          state.rects.some((frameRects) =>
            frameRects?.some((rect) => rect?.is_annotation_generated)
          );

        const rawDate = examMeta?.date || examMeta?.uploaded_at;
        const dateLabel = rawDate
          ? new Date(rawDate).toLocaleDateString('pt-PT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : null;

        return {
          id: examId,
          orderLabel: `DICOM ${index + 1}`,
          label: examMeta?.description || `Ecocardiograma ${examId}`,
          dateLabel,
          thumbnailUrl: state.frames[0]?.url || null,
          framesCount: state.frames.length,
          isLoading: state.framesLoading,
          loadError: state.loadError,
          isActive: examId === activeExamId,
          isSelected: examId === selectedExamId,
          hasAnnotation,
          hasDetectionTested,
          hasImageAdjustments: hasAdjustedImageSettings(state.imageSettings),
        };
      }),
    [analysisSequence, examStates, patient, activeExamId, selectedExamId]
  );

  return (
    <MainLayout pageTitle={`Anotação da Válvula Aórtica — ${patient?.name || 'CalciVision'}`}>
      {activeExamState.framesLoading && (
        <div className="mb-4 rounded-lg border border-green-pale bg-green-light/40 px-4 py-3 text-sm text-green-dark">
          A carregar imagens do ecocardiograma selecionado. Isto pode demorar alguns segundos.
        </div>
      )}
      {!activeExamState.framesLoading && activeExamState.loadError && (
        <div className="mb-4 rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          {activeExamState.loadError}
        </div>
      )}

      <AnalysisWizard
        annotationToolRef={annotationToolRef}
        frames={activeExamState.frames}
        currentFrame={activeExamState.currentFrame}
        currentFrameSrc={activeExamState.frames[activeExamState.currentFrame]?.url}
        rects={activeExamState.rects}
        calcification={activeExamState.calcification}
        calcificationStatus={activeExamState.calcificationStatus}
        setCalcificationStatus={(value) =>
          updateExamField(activeExamId, 'calcificationStatus', value)
        }
        predictionHistory={activeExamState.predictionHistory}
        patient={patient}
        exam={activeExam}
        echoId={activeExamId}
        imageSettings={activeExamState.imageSettings}
        onImageSettingsChange={handleImageSettingsChange}
        defaultImageSettings={defaultImageSettings}
        comparisonCandidates={comparisonCandidates}
        activeExamId={activeExamId}
        selectedExamId={selectedExamId}
        onActiveExamChange={handleActiveExamChange}
        onSelectCurrentExam={handleSelectCurrentExam}
        renderCanvas={(handleAnnotationChanged) => (
          <AnnotationTool
            key={activeExamId}
            ref={annotationToolRef}
            frames={activeExamState.frames}
            currentFrame={activeExamState.currentFrame}
            rects={activeExamState.rects}
            setRects={(updater) => updateExamField(activeExamId, 'rects', updater)}
            calcificationStatus={activeExamState.calcificationStatus}
            setCalcificationStatus={(value) =>
              updateExamField(activeExamId, 'calcificationStatus', value)
            }
            predictedValveBoxes={activeExamState.predictedValveBoxes}
            setPredictedValveBoxes={(updater) =>
              updateExamField(activeExamId, 'predictedValveBoxes', updater)
            }
            calcification={activeExamState.calcification}
            setCalcification={(updater) =>
              updateExamField(activeExamId, 'calcification', updater)
            }
            predictionHistory={activeExamState.predictionHistory}
            setPredictionHistory={(updater) =>
              updateExamField(activeExamId, 'predictionHistory', updater)
            }
            imageSettings={activeExamState.imageSettings}
            onImageSettingsChange={handleImageSettingsChange}
            onAnnotationChange={handleAnnotationChanged}
          />
        )}
        renderCanvasFooter={() => (
          <FrameNavigator
            key={`navigator-${activeExamId}`}
            frames={activeExamState.frames}
            rects={activeExamState.rects}
            currentFrame={activeExamState.currentFrame}
            setCurrentFrame={(value) =>
              updateExamField(activeExamId, 'currentFrame', value)
            }
          />
        )}
      />
    </MainLayout>
  );
}
