import { useEffect, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import AnnotationTool from '../components/AnnotationTool';
import AnnotationToolMenu from '../components/AnnotationToolMenu';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import api from '../api';

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
  const [valveConfirmations, setValveConfirmations] = useState([]);
  const [calciumScore, setCalciumScore] = useState(null);
  const [reportText, setReportText] = useState("");

  const [patient, setPatient] = useState(null);
  const { patientId, echoId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFrames = async () => {
      try {
        const patientInfoResponse = await api.get(`/api/patient/${patientId}/`)
        patientInfoResponse.status === 200 && setPatient(patientInfoResponse.data) 
        
        const echoFramesResponse = await api.get(`/api/patient/${patientId}/echocardiogram/${echoId}/frames/`)
        const data = echoFramesResponse.data

        // Atualiza os states principais
        const formattedFrames = data.map(frame => ({
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
            ? frame.data.map(rect => {
                if(rect.is_annotation_generated)
                  return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    id: 'prediction',
                    is_annotation_generated: true,
                  }
              })
            : []
        })

        const formattedCalcification = data.map(frame =>
          frame.data?.[0] && frame.data[0].is_calcified !== null
            ? {
                binary_classification: frame.data[0].is_calcified,
                confidence: frame.data[0].confidence,
                is_annotation_generated: Boolean(frame.data[0].is_calcification_generated),
              }
            : null
        );

        // Preenche o histórico com os dados de `data`
        const formattedPredictionHistory = data.map(frame => {
          const rect = frame.data?.[0];
          if(rect) {
            return [
              {
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  is_annotation_generated: Boolean(rect.is_annotation_generated),
                },
                results: frame.data[0].is_calcified !== null 
                  ? {
                    binary_classification: rect.is_calcified,
                    confidence: rect.confidence,
                  } : null,
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
        setValveConfirmations(formattedFrames.map(() => false));

        const storedReportText = localStorage.getItem(`reportText:${patientId}:${echoId}`);
        setReportText(
          storedReportText ||
            "Relatório automático gerado pelo protótipo. Edite conforme necessário."
        );
        
        const currentBinary = formattedCalcification[currentFrame]?.binary_classification;
        if (currentBinary !== null && currentBinary !== undefined) {
          setCalcificationStatus(Boolean(currentBinary));
        }

      } catch(error) {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          navigate('/404');
        }
      }
    }
    fetchFrames()
  }, [patientId, echoId]);

  useEffect(() => {
    if (!frames.length) return;
    const storedScore = localStorage.getItem(`calciumScore:${patientId}:${echoId}`) || localStorage.getItem(`calciumScore:${patientId}`);
    if (storedScore) {
      setCalciumScore(Number(storedScore));
      return;
    }

    const results = calcification.filter(
      item => item?.binary_classification !== null && item?.binary_classification !== undefined
    );
    if (results.length > 0) {
      const calcified = results.filter(item => item.binary_classification).length;
      setCalciumScore(Number((calcified / results.length).toFixed(2)));
      return;
    }

    if (calciumScore === null) {
      setCalciumScore(Number((Math.random() * 0.4 + 0.3).toFixed(2)));
    }
  }, [calcification, frames.length, patientId, echoId, calciumScore]);

  return (
    <MainLayout pageTitle={`${patient && patient.name} Analysis - CalciVision`}>

      {/* Annotation tool and menu */}
      <div className="w-full mb-8 grid grid-cols-[auto_1fr] grid-rows-1 gap-5 justify-items-start">
        <AnnotationTool 
          frames={frames} 
          currentFrame={currentFrame} 
          setCurrentFrame={setCurrentFrame}
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
          valveConfirmations={valveConfirmations}
          setValveConfirmations={setValveConfirmations}
        />
        <AnnotationToolMenu 
          frames={frames}
          currentFrame={currentFrame} 
          setCurrentFrame={setCurrentFrame}
          rects={rects} 
          calcificationStatus={calcificationStatus}
          setCalcificationStatus={setCalcificationStatus}
          calcification={calcification}
          setCalcification={setCalcification}
          predictionHistory={predictionHistory}
          patient={patient}
          echoId={echoId}
          valveConfirmations={valveConfirmations}
          calciumScore={calciumScore}
          reportText={reportText}
          setReportText={setReportText}
        />
      </div>
    </MainLayout>
  );
};
