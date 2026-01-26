import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Image, Rect, Transformer, Group } from "react-konva";
import useImage from "use-image";
import { useValveDetection } from "../hooks/useValveDetection";
import { useCalciumDetection } from "../hooks/useCalciumDetection";
import { useBatchValveDetection } from "../hooks/useBatchValveDetection";
import AnnotationToolSlider from "./AnnotationToolSlider";
import ProgressBar from "./ProgressBar";
import AnnotationDropdown from "./AnnotationDropdown";
import { useUnsavedStore } from "../store/useUnsavedStore";

export default function AnnotationTool({ frames, currentFrame, setCurrentFrame, rects, setRects, calcificationStatus, setCalcificationStatus, predictedValveBoxes, setPredictedValveBoxes, calcification, setCalcification, predictionHistory, setPredictionHistory, imageSettings, onImageSettingsChange }) {
    const [frame] = useImage(frames[currentFrame]?.url)
    // Referências ao stage (a área de desenho) e ao group (o conjunto da imagem com as anotações)
    const stageRef = useRef(null);
    const groupRef = useRef(null);
    // Referência ao transformador, que permite redimensionar e mover um objeto (vai estar associado à anotação selecionada)
    const transformerRef = useRef(null);
    // A anotação que está a ser desenhada no momento
    const [currentRect, setCurrentRect] = useState(null);
    // O id da anotação que foi selecionada (para depois redimensionar ou mover)
    const [selectedRect, setSelectedRect] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isOverRect, setIsOverRect] = useState(false);

    // Lazy Initialization. A função só executa NA PRIMEIRA RENDERIZAÇÃO
    const [scales, setScales] = useState(() => Array(frames.length).fill(1))
    const [framePositions, setFramePositions] = useState(() => Array(frames.length).fill({ x: 0, y: 0 }))

    const currentScale = scales[currentFrame] || 1
    const currentPosition = framePositions[currentFrame] || { x: 0, y: 0 }

    // Controla qual é o tipo de ponteiro do rato com base no que o utilizador está a fazer
    const [cursorType, setCursorType] = useState('default');

    const brightness = imageSettings?.brightness ?? 1;
    const contrast = imageSettings?.contrast ?? 1;
    const blur = imageSettings?.blur ?? 0;
    const zoom = imageSettings?.zoom ?? 1;

    // Um hook personalizado para iniciar a identificação da válvula de UMA ÚNICA imagem
    const { progress: valveProgress, isLoading: isLoadingValve, startDetection: startSingleDetection, cancelDetection: cancelSingleDetection } = useValveDetection();
    
    // Um hook personalizado para iniciar a medição da calcificação de UMA ÚNICA imagem
    const { progress: calciumProgress, isLoading: isLoadingCalcium, startDetection: startCalciumDetection } = useCalciumDetection();

    // Um hook personalizado para iniciar a identificação da válvula de MÚLTIPLAS imagens em batch de forma eficiente
    const { progress: batchProgress, isLoading: isLoadingBatch, startDetection: startBatchDetection } = useBatchValveDetection();

    const { setUnsavedChanges } = useUnsavedStore();

    /////////////////////////////////////////////////////////

    // Ajusta o transformer quando uma anotação é selecionada
    useEffect(() => {
        if(selectedRect && transformerRef.current) {
            // Procura a anotação selecionada pelo id e associa o transformer
            const node = stageRef.current.findOne('#' + selectedRect);
            transformerRef.current.nodes([node]);
        } else if(transformerRef.current) {
            // Se não houver nenhuma anotação selecionada, não associa nada ao transformer
            transformerRef.current.nodes([]);
        }
        stageRef.current.batchDraw();
    }, [selectedRect]);

    // Deseleciona o retângulo selecionado quando se troca de imagem
    useEffect(() => {
        setSelectedRect(null)
    }, [currentFrame]);

    // Centraliza a imagem quando ela carrega
    useEffect(() => {
        if (frame && frame.width && frame.height) {
            // Valores fixos para teste
            const centeredX = 88; // Posição fixa para a esquerda(a mão)
            const centeredY = 0;  // Posição fixa para cima(a mão)
            const optimalScale = 0.9;
            
            setScales(prev => {
                const updatedScales = [...prev];
                updatedScales[currentFrame] = optimalScale;
                return updatedScales;
            });
            
            setFramePositions(prev => {
                const updatedPositions = [...prev];
                updatedPositions[currentFrame] = { x: centeredX, y: centeredY };
                return updatedPositions;
            });
        }
    }, [frame, currentFrame]);

    useEffect(() => {
        if (zoom && Math.abs(zoom - currentScale) > 0.01) {
            handleZoom(zoom);
        }
    }, [zoom]);

    // Função para verificar se as coordenadas estão dentro da imagem
    const isWithinImageBounds = (x, y) => {
        if (!frame) return false;
        return x >= 0 && y >= 0 && x <= frame.width && y <= frame.height;
    };

    // Começa a desenhar uma nova anotação
    const handleMouseDown = (e) => {
        // Se o desenho não está ativo, retorna sem fazer nada
        if(!isDrawing) return
        
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();

        //const x = (pointerPosition.x - stagePosition.x - currentPosition.x * currentScale) / currentScale;
        //const y = (pointerPosition.y - stagePosition.y - currentPosition.y * currentScale) / currentScale;
        const x = (pointerPosition.x - currentPosition.x) / currentScale;
        const y = (pointerPosition.y - currentPosition.y) / currentScale;

        if (isWithinImageBounds(x, y)) {
            setCurrentRect({
                x,
                y,
                width: 0,
                height: 0,
                id: Date.now(), // ID único para cada anotação
            });
        }
    };

    // Atualiza o tamanho da seleção
    const handleMouseMove = (e) => {
        if (!isDrawing || !currentRect) return;

        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();

        const x = (pointerPosition.x - currentPosition.x) / currentScale;
        const y = (pointerPosition.y - currentPosition.y) / currentScale;

        setCurrentRect({
            ...currentRect,
            width: x - currentRect.x,
            height: y - currentRect.y,
        });
    };

    // Finaliza a seleção
    const handleMouseUp = () => {
        if(!isDrawing) return
        // Se a anotação não passar do limite máximo de comprimento e altura...
        if (currentRect && (Math.abs(currentRect.width) > 5 || Math.abs(currentRect.height) > 5)) {
            // Atualiza rects, mas mantendo todas as anotações que não foram mexidas iguais
            setRects(prevRects => {
                const updatedRects = [...prevRects]
                if(!updatedRects[currentFrame])
                    updatedRects[currentFrame] = []
                updatedRects[currentFrame] = [
                    {
                        ...currentRect,
                        width: Math.abs(currentRect.width),
                        height: Math.abs(currentRect.height),
                        // Se o retângulo tem comprimento/altura negativa, significa que o retângulo foi desenhado para baixo e esquerda. Ajusta a posição inicial nestes casos
                        x: currentRect.width < 0 ? currentRect.x + currentRect.width : currentRect.x,
                        y: currentRect.height < 0 ? currentRect.y + currentRect.height : currentRect.y
                    },
                    // Espalha os restantes retângulos da imagem
                    ...updatedRects[currentFrame]
                ]
                return updatedRects
            });
        }
        setCurrentRect(null);
        setIsDrawing(false);
        setUnsavedChanges(true);
    }

    // Zoom In (aumenta 20%)
    const handleZoomIn = () => currentScale < 5 && handleZoom(currentScale * 1.2);

    // Zoom Out (diminui 20%)
    const handleZoomOut = () => currentScale > 0.5 && handleZoom(currentScale / 1.2);

    const handleZoom = (newScale) => {

        const stage = stageRef.current;
        if (!stage) return;
        const pointerPosition = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };

        const mouseX = (pointerPosition.x - currentPosition.x) / currentScale;
        const mouseY = (pointerPosition.y - currentPosition.y) / currentScale;

        const newX = pointerPosition.x - mouseX * newScale;
        const newY = pointerPosition.y - mouseY * newScale;

        setScales(prev => {
            const updatedScales = [...prev]
            updatedScales[currentFrame] = newScale
            return updatedScales
        })
        setFramePositions(prev => {
            const updatedPositions = [...prev]
            updatedPositions[currentFrame] = { x: newX, y: newY }
            return updatedPositions
        })
    }

    const handleImageSettingChange = (key, value) => {
        const nextSettings = {
            ...(imageSettings || {}),
            [key]: value,
        };
        onImageSettingsChange?.(nextSettings);
        if (key === 'zoom') {
            handleZoom(value);
        }
    };

    // Função para limpar anotações
    const handleClearAnnotations = () => {
        setRects(prevRects => {
            const updatedRects = [...prevRects]
            updatedRects[currentFrame] = []
            return updatedRects
        });
        setPredictedValveBoxes(prev => {
            const updatedPred = [...prev]
            updatedPred[currentFrame] = null
            return updatedPred
        });
        setSelectedRect(null);
        setUnsavedChanges(true);
    };

    // Função para ativar/desativar o modo de desenho
    const toggleDrawingMode = () => {
        if(isDrawing) 
            setIsDrawing(false)
        else if(rects[currentFrame]?.length == 0) 
            setIsDrawing(true)
    };

    // Função para começar a deteção da válvula através do hook personalizado
    const handleDetectValve = async () => {
        try {
            const valveData = await startSingleDetection(frame);
            
            const bbox = valveData.bbox;
            if(bbox.length != 4) throw new Error('Unexpected number of coordinates received.');
            const [x1, y1, x2, y2] = bbox;
            const valveBox = {
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x1 - x2),
                height: Math.abs(y1 - y2),
                id: 'prediction',
                is_annotation_generated: true,
            }
            setPredictedValveBoxes(prev => {
                const updatedPred = [...prev]
                updatedPred[currentFrame] = valveBox
                return updatedPred
            });
            setRects(prevRects => {
                const updatedRects = [...prevRects]
                updatedRects[currentFrame] = [valveBox]
                return updatedRects
            });
            setUnsavedChanges(true);

        } catch(error) {
            console.error("Erro na deteção:", error);
        }
    }

    // Handler para quando o utilizador clicar no botão de batch
    const handleBatchValvesDetection = async () => {
        try {
            // Função para filtrar os dados relevantes para o batch (não tem anotação OU tem anotação e não tem previsão)
            const filterData = (arr) => arr.filter((_, idx) => rects[idx]?.length === 0 || (rects[idx]?.length > 0 && !predictedValveBoxes[idx]));

            // Seleciona os frames que ainda não têm anotações ou previsões
            const batchImages = filterData(frames)
            // Seleciona os rects dos frames que ainda não têm anotações ou previsões
            const batchRects = filterData(rects)

            await startBatchDetection(batchImages, batchRects)

        } catch(error) {
            console.error("Erro na deteção:", error);
        }
    }

    // Acionado quando o status do batch é atualizado, ou seja, quando houver progressos da análise de alguma imagem
    useEffect(() => {
        const updatedRects = [...rects]
        const updatedPreds = [...predictedValveBoxes]
        const updatedCalcification = [...calcification]
        const updatedHistory = [...predictionHistory]

        // Para cada imagem, verifica se já tem resultados disponíveis
        frames.forEach((img, idx) => {
            const imageName = img.name
            const data = batchProgress?.[imageName]

            if(data?.results && (!updatedPreds[idx] || !updatedCalcification[idx])) {

                const valveResults = data.results?.bbox ? data.results : null;
                const calciumResults = data.results?.binary_classification !== undefined ? data.results : null;
                
                // Converte a classificação numérica para booleana
                calciumResults?.binary_classification && (
                    calciumResults.binary_classification = Boolean(calciumResults?.binary_classification)
                )
                
                let valveBox = null

                if(valveResults && !updatedPreds[idx]) {
                    const bbox = valveResults.bbox;
                    if(bbox.length != 4) return
                    const [x1, y1, x2, y2] = bbox;
                    valveBox = {
                        x: Math.min(x1, x2),
                        y: Math.min(y1, y2),
                        width: Math.abs(x1 - x2),
                        height: Math.abs(y1 - y2),
                        id: 'prediction',
                        is_annotation_generated: true,
                    }
                    updatedPreds[idx] = valveBox
                    const existingRects = (updatedRects[idx] || []).filter(r => r.id !== 'prediction');
                    updatedRects[idx] = [ valveBox, ...existingRects ];
                }

                if(calciumResults && !updatedCalcification[idx]) {
                    updatedCalcification[idx] = {
                        binary_classification: calciumResults.binary_classification,
                        classification: calciumResults.classification,
                        confidence: calciumResults.confidence,
                    }
                }

                // Ajustar o histórico para atualizar com rects e results
                if (valveBox || calciumResults) {
                    const { id, ...rect } = valveBox || (updatedHistory[idx]?.[0]?.rect ?? null);
                    if (rect) {
                        updatedHistory[idx] = [
                            {
                                rect,
                                results: calciumResults || null
                            }
                        ];
                    }
                }
                setUnsavedChanges(true)
            }
        })

        setRects(updatedRects)
        setPredictedValveBoxes(updatedPreds)
        setCalcification(updatedCalcification)
        setPredictionHistory(updatedHistory)
        setCalcificationStatus(updatedCalcification[currentFrame]?.binary_classification ? updatedCalcification[currentFrame].binary_classification : null)

    }, [batchProgress])

    // Coloca a anotação gerada pelo modelo na sua posição original
    const handleResetValvePosition = () => {
        setRects(prevRects => {
            const updatedRects = [...prevRects];
            if (!updatedRects[currentFrame]) {
                updatedRects[currentFrame] = [];
            }
            // Remove qualquer rect com id 'prediction'
            updatedRects[currentFrame] = updatedRects[currentFrame].filter(rect => rect.id !== 'prediction');

            // Adiciona o rect previsto
            if (predictedValveBoxes[currentFrame]) {
                updatedRects[currentFrame] = [
                    { ...predictedValveBoxes[currentFrame], is_annotation_generated: true },
                    ...updatedRects[currentFrame],
                ];
            }
            return updatedRects;
        });
        setUnsavedChanges(true);
    };

    // Apaga a anotação selecionada (selectedRect)
    const deleteSelectedRect = useCallback(() => {
        if(selectedRect) {
            // Filtra rects para ter todas as anotações menos a que será apagada
            setRects(prevRects => {
                const updatedRects = [...prevRects]
                updatedRects[currentFrame] = updatedRects[currentFrame].filter(
                    (rect) => rect.id !== selectedRect
                )
                return updatedRects
            });
            // Se a anotação selecionada foi a gerada pelo modelo, altera predictedValveBox para null
            if(selectedRect === 'prediction') {
                setPredictedValveBoxes(prev => {
                    const updatedPred = [...prev]
                    updatedPred[currentFrame] = null
                    return updatedPred
                });
            }
            setSelectedRect(null);
            setUnsavedChanges(true);
        }
    }, [selectedRect])

    const handleInputPositionChange = (e) => {
        if(!selectedRect) return
        const inputId = e.target.id
        const value = parseInt(e.target.value)
        if(isNaN(value)) return

        setRects(prevRects => {
            const updatedRects = [...prevRects]
            updatedRects[currentFrame] = updatedRects[currentFrame].map(rect => {
                if(rect.id === selectedRect) {
                    switch(inputId) {
                        case 'x0':
                            return { ...rect, x: value, is_annotation_generated: false }
                        case 'y0':
                            return { ...rect, y: value, is_annotation_generated: false }
                        case 'x1':
                            return { ...rect, width: value - rect.x, is_annotation_generated: false }
                        case 'y1':
                            return { ...rect, height: value - rect.y, is_annotation_generated: false }
                    }
                }
            })
            return updatedRects
        })
        setUnsavedChanges(true);
    }

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Quando o utilizador tenta apagar uma anotação (del)
            if(e.key === 'Delete') {
                e.preventDefault();
                deleteSelectedRect();
            }
            // Quando o utilizador tenta desselecionar uma anotação (esc)
            if(e.key === 'Escape') {
                e.preventDefault();
                setSelectedRect(null);
            }
            if(e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                setRects(prevRects => {
                    const updatedRects = [...prevRects]
                    updatedRects[currentFrame] = updatedRects[currentFrame].map(rect => {
                        if(rect.id === selectedRect) {
                            switch(e.key) {
                                case 'ArrowLeft':
                                    return { ...rect, x: rect.x - 1, is_annotation_generated: false }
                                case 'ArrowRight':
                                    return { ...rect, x: rect.x + 1, is_annotation_generated: false }
                                case 'ArrowUp':
                                    return { ...rect, y: rect.y - 1, is_annotation_generated: false }
                                case 'ArrowDown':
                                    return { ...rect, y: rect.y + 1, is_annotation_generated: false }
                            }
                        }
                        return rect
                    })
                    return updatedRects
                })
                setUnsavedChanges(true);
            }
        }
        // Adiciona um event listener de digitação (keydown) para quando o utilizador tenta fazer alguma ação
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteSelectedRect])

    // Handler para quando o utilizador clica no botão de deteção de cálcio do modelo
    const handleDetectCalcium = async () => {
        console.log('Iniciando detecção de cálcio para o frame:', currentFrame)
        try {
            if(!rects[currentFrame][0]) return

            const imageFetch = await fetch(frames[currentFrame]?.url);
            const blob = await imageFetch.blob();
            const imageFile = new File([blob], `valve_${currentFrame}.jpg`);
            
            // Começa a previsão do modelo através do hook useCalciumDetection
            // frames[currentFrame] corresponde à imagem original (sem retângulo) e rects[currentFrame][0] tem as informações do retângulo (área da válvula identificada)
            const calciumResults = await startCalciumDetection(imageFile, rects[currentFrame][0])
            calciumResults.is_calcification_generated = Boolean(calciumResults.is_calcification_generated)

            console.log('Resultados do cálcio:', calciumResults)
            if(calciumResults) {
                setCalcification(prev => {
                    const updated = [...prev];
                    updated[currentFrame] = calciumResults;
                    return updated;
                });
                setCalcificationStatus(calciumResults.binary_classification);

                const { id, ...rect } = rects[currentFrame][0]
                setPredictionHistory(prevHistory => {
                    const updatedHistory = [...prevHistory]
                    updatedHistory[currentFrame] = [
                        { rect: rect, results: calciumResults },
                        ...(updatedHistory[currentFrame] || [])
                    ]
                    return updatedHistory
                })
                setUnsavedChanges(true);
            }
        } catch(error) {
            console.error(error)
        }
    }

    return (
        <div className='w-[750px] flex flex-col items-center rounded-lg overflow-hidden'>
            {/* Cabeçalho (com os botões) */}
            <div className='relative bg-green text-white w-full flex items-center px-6 py-3'>
                <h5 className='mr-4'>Manual Annotation</h5>

                <div className='flex ml-auto'>
                    <button onClick={handleZoomIn} className='p-1 rounded-sm' title="Zoom In">
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14m.5-7H9v2H7v1h2v2h1v-2h2V9h-2z"></path></svg>
                    </button>

                    <button onClick={handleZoomOut} className='p-1 rounded-sm' title="Zoom Out">
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14M7 9h5v1H7z"></path></svg>
                    </button>
                </div>

                <div className='flex gap-2 ml-auto text-white'>

                    {/* Botão de cancelar a anotação manual; Botão de retomar posição identificada pelo modelo; Botão de dropdown com os dois tipos de anotação da válvula */}
                    {isDrawing ? (
                        <button 
                            onClick={toggleDrawingMode} 
                            className='flex items-center bg-green-dark rounded-lg py-2 px-4 space-x-2 text-white'
                            title='Cancel Manual Annotation'
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M18.66 2c-.26 0-.5.09-.69.28l-1.84 1.85l3.75 3.75l1.84-1.85c.39-.39.39-1.03 0-1.4l-2.34-2.35c-.2-.19-.47-.28-.72-.28M3.28 4L2 5.28l6.5 6.47l-4.5 4.5V20h3.75l4.5-4.5l6.47 6.5L20 20.72l-6.5-6.47l-3.75-3.75zm11.78 1.19l-4.03 4.03l3.75 3.75l4.03-4.03z"></path></svg>
                            <span role='tooltip'>Cancel Annotation</span>
                        </button>
                    ) : predictedValveBoxes[currentFrame] ? (
                        <button 
                            onClick={handleResetValvePosition} 
                            className='p-2 rounded-sm flex items-center gap-4 transition-colors bg-green-dark disabled:hidden'
                            title='Reset AI Annotation'
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}><path d="M12 3a9 9 0 1 1-5.657 2"></path><path d="M3 4.5h4v4"></path></g></svg>
                            <span role='tooltip'>Reset Position</span>
                        </button>
                    ) : (
                        <AnnotationDropdown
                            handleDectectValve={handleDetectValve}
                            toggleDrawingMode={toggleDrawingMode}
                            annotated={rects[currentFrame]?.length > 0}
                        >
                            <button 
                                className='flex items-center bg-green-dark rounded-lg py-2 px-4 space-x-2 text-white'
                                title="AI Valve Detection Tool"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" fillRule="evenodd"><path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"></path><path fill="currentColor" d="M20.131 3.16a3 3 0 0 0-4.242 0l-.707.708l4.95 4.95l.706-.707a3 3 0 0 0 0-4.243l-.707-.707Zm-1.414 7.072l-4.95-4.95l-9.09 9.091a1.5 1.5 0 0 0-.401.724l-1.029 4.455a1 1 0 0 0 1.2 1.2l4.456-1.028a1.5 1.5 0 0 0 .723-.401z"></path></g></svg>
                                <span role='tooltip'>Annotate Valve</span>
                            </button>
                        </AnnotationDropdown>
                    )}

                    {/* Botão de deteção do cálcio */}
                    <button 
                        onClick={handleDetectCalcium} 
                        className='flex items-center bg-green-dark rounded-lg py-2 px-4 space-x-2 text-white'
                        title='AI Calcium Detection Tool'
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path><path fill="currentColor" d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027a1 1 0 0 1-1.845.117l-.048-.117l-.35-1.026l-1.027-.35a1 1 0 0 1-.118-1.845l.118-.048l1.026-.35l.35-1.027A1 1 0 0 1 19 2"></path></g></svg>
                        <span role='tooltip'>Detect Calcium</span>
                    </button>
                </div>
            </div>
            {/* Área de seleção */}
            <div className="w-full bg-green-soft border-y border-green-pale px-6 py-3 text-sm text-gray-dark">
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                        <span className="font-medium">Luminosidade ({brightness.toFixed(2)})</span>
                        <input
                            type="range"
                            min="0.7"
                            max="1.6"
                            step="0.05"
                            value={brightness}
                            onChange={(event) => handleImageSettingChange('brightness', Number(event.target.value))}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="font-medium">Contraste ({contrast.toFixed(2)})</span>
                        <input
                            type="range"
                            min="0.7"
                            max="1.6"
                            step="0.05"
                            value={contrast}
                            onChange={(event) => handleImageSettingChange('contrast', Number(event.target.value))}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="font-medium">Redução de ruído ({blur.toFixed(1)}px)</span>
                        <input
                            type="range"
                            min="0"
                            max="4"
                            step="0.2"
                            value={blur}
                            onChange={(event) => handleImageSettingChange('blur', Number(event.target.value))}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="font-medium">Zoom ({zoom.toFixed(2)}x)</span>
                        <input
                            type="range"
                            min="0.6"
                            max="2.4"
                            step="0.05"
                            value={zoom}
                            onChange={(event) => handleImageSettingChange('zoom', Number(event.target.value))}
                        />
                    </label>
                </div>
            </div>
            <div className={`grid-texture relative w-full h-[560px] overflow-hidden bg-gray-soft`}>
                <Stage
                    width={Math.max(720, window.innerWidth * 2 / 3)} // 840
                    height={560}
                    ref={stageRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onClick={() => setSelectedRect(null)}
                    style={{ cursor: cursorType, filter: `brightness(${brightness}) contrast(${contrast}) blur(${blur}px)` }}
                >
                    <Layer>
                        <Group 
                            ref={groupRef}
                            x={currentPosition.x}
                            y={currentPosition.y}
                            scaleX={currentScale}
                            scaleY={currentScale}
                            draggable={!isDrawing}
                            onMouseEnter={() => setCursorType(!isDrawing? 'grab' : 'crosshair')}
                            onDragStart={() => !isDrawing && !isOverRect && setCursorType('grabbing')}
                            onDragEnd={(e) => {
                                !isOverRect && setCursorType('grab')
                                if(selectedRect) return
                                const { x, y } = e.target.position();
                                setFramePositions(prev => {
                                    const updatedPositions = [...prev]
                                    updatedPositions[currentFrame] = { x, y }
                                    return updatedPositions
                                })
                            }}
                            onClick={() => setSelectedRect(null)}
                        >
                            {frame && (
                                <Image
                                    image={frame}
                                    width={frame?.width || 0} 
                                    height={frame?.height || 0}
                                    x={0} // Força a imagem a ficar na posição 0,0 relativa ao Group
                                    y={0}
                                />
                            )}

                            {/* Anotações */}
                            {rects[currentFrame]?.map((rect) => {
                                const isBoxPrediction = predictedValveBoxes[currentFrame] && rect.x === predictedValveBoxes[currentFrame].x && rect.y === predictedValveBoxes[currentFrame].y && rect.width === predictedValveBoxes[currentFrame].width && rect.height === predictedValveBoxes[currentFrame].height;
                                const strokeColor = isBoxPrediction ? 'yellow' : 'orange';
                                return (
                                    <Rect
                                        key={rect.id}
                                        id={rect.id.toString()}
                                        x={rect.x}
                                        y={rect.y}
                                        width={rect.width}
                                        height={rect.height}
                                        stroke={strokeColor}
                                        strokeWidth={3}
                                        strokeScaleEnabled={false}
                                        draggable={!isDrawing && selectedRect === rect.id}
                                        onClick={(e) => {
                                            e.cancelBubble = true;
                                            setSelectedRect(rect.id);
                                        }}
                                        onMouseEnter={() => {
                                            setIsOverRect(true);
                                            setCursorType(!isDrawing ? 'move' : 'crosshair');
                                        }}
                                        onMouseLeave={() => {
                                            setIsOverRect(false);
                                            setCursorType(!isDrawing? 'grab' : 'crosshair');
                                        }}
                                        onDragStart={() => setCursorType('move')}
                                        onDragEnd={(e) => {
                                            setRects(prevRects => 
                                                prevRects.map((imageRects, imageIndex) => {
                                                    if(imageIndex !== currentFrame)
                                                        return imageRects
                                                    // Atualiza apenas o retângulo arrastado na imagem atual
                                                    return imageRects.map(r =>
                                                        r.id === rect.id ? {
                                                            ...r,
                                                            x: e.target.x(),
                                                            y: e.target.y(),
                                                            is_annotation_generated: false,
                                                        } : r
                                                    )
                                                })
                                            )
                                            setUnsavedChanges(true);
                                        }}
                                        onTransformEnd={() => {
                                            const node = transformerRef.current?.node?.();
                                            if (!node || !rect) return;

                                            // Captura a escala antes de redefinir
                                            const scaleX = node.scaleX();
                                            const scaleY = node.scaleY();

                                            // Restaura a escala para evitar comportamento acumulativo
                                            node.scaleX(1);
                                            node.scaleY(1);
                                            
                                            setRects(prevRects => {
                                                const updatedRects = [...prevRects]
                                                if(!updatedRects[currentFrame]) {
                                                    updatedRects[currentFrame] = [];
                                                }

                                                updatedRects[currentFrame] = updatedRects[currentFrame].map(r => {
                                                    // Atualiza apenas o retângulo transformado na imagem atual
                                                    if(r && rect && r.id === rect.id) {
                                                        return {
                                                            ...r,
                                                            x: node.x(),
                                                            y: node.y(),
                                                            width: Math.max(5, node.width() * scaleX), // Largura máxima é 5
                                                            height: Math.max(5, node.height() * scaleY), // Altura máxima é 5
                                                            is_annotation_generated: false,
                                                        }
                                                    }
                                                    return r;
                                                })

                                                return updatedRects
                                            })
                                            setUnsavedChanges(true)
                                        }}
                                    />
                                )
                            })}

                            {/* Seleção que está a ser desenhada (se houver) */}
                            {currentRect && (
                                <Rect
                                    x={currentRect.x}
                                    y={currentRect.y}
                                    width={currentRect.width}
                                    height={currentRect.height}
                                    stroke="blue"
                                    strokeWidth={2}
                                    dash={[5, 5]}
                                />
                            )}
                        </Group>
                        
                        {/* Transformer (permite redimensionamento) */}
                        {selectedRect && (
                            <Transformer 
                                ref={transformerRef}
                                rotateEnabled={false}
                                ignoreStroke={true}
                                draggable
                                boundBoxFunc={(oldBox, newBox) => {
                                    // Limita o tamanho mínimo
                                    if(newBox.width < 5 || newBox.height < 5) return oldBox;
                                    return newBox;
                                }}
                            />
                        )}
                    </Layer>
                </Stage>
                
                {/* Indicador de carregamento (loading) */}
                {(isLoadingValve || isLoadingCalcium || batchProgress[frames[currentFrame]?.name]?.status === 'PROGRESS') && (
                    <div className='absolute inset-0 flex flex-col justify-center items-center'>
                        <p className='relative z-5 text-white text-xl font-semibold mb-8'>
                            {isLoadingValve 
                                ? 'Identifying Aortic Valve Area...' 
                                : isLoadingBatch
                                ? `${batchProgress[frames[currentFrame]?.name]?.phase || 'Waiting for results from other frames'}...`
                                : 'Searching for Calcium Deposits...'}
                        </p>

                        {/* Barra de progresso */}
                        <div className='z-5 mb-4' role='status'>
                            <ProgressBar progress={
                                isLoadingBatch
                                ? batchProgress[frames[currentFrame]?.name]?.progress
                                : isLoadingCalcium
                                ? calciumProgress
                                : isLoadingValve
                                ? valveProgress
                                : 0
                            } />
                        </div>
                        
                        <button 
                            className='relative z-5 w-24 py-1 mt-4 text-center rounded-sm text-lg font-medium bg-green-dark text-white'
                            onClick={() => cancelSingleDetection()}
                        >
                            Cancel
                        </button>
                        <div className='absolute inset-0 bg-green-400/10 backdrop-blur-xs' />
                    </div>
                )}

                {/* Caixa de texto com as coordenadas do retângulo selecionado */}
                {selectedRect && (
                    <div className='absolute bottom-2 left-2 bg-gray-pale rounded-md w-60 h-32 px-3 py-2'>
                        <h5 className='mb-4'>Bounding Box</h5>
                        
                        <div className='absolute top-3 right-3 flex gap-2'>
                            {/* Botão para retomar à posição identificada pelo modelo */}
                            {predictedValveBoxes[currentFrame] && (
                                <button onClick={handleResetValvePosition} title='Reset AI Annotation'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}><path d="M12 3a9 9 0 1 1-5.657 2"></path><path d="M3 4.5h4v4"></path></g></svg>
                                </button>
                            )}

                            {/* Botão para apagar a anotação selecionada */}
                            <button onClick={handleClearAnnotations} title="Clear All">
                                <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M8.106 2.553A1 1 0 0 1 9 2h6a1 1 0 0 1 .894.553L17.618 6H20a1 1 0 1 1 0 2h-1v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8H4a1 1 0 0 1 0-2h2.382zM14.382 4l1 2H8.618l1-2zM11 11a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0zm4 0a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0z" clipRule="evenodd"></path></svg>
                            </button>
                        </div>

                        <div className='grid grid-cols-2 grid-rows-2 gap-y-2 pr-5'>
                            <div className='flex items-center gap-2'>
                                <label htmlFor='x0' className='w-5'>X<sub>0</sub></label>
                                <input 
                                    type='number' 
                                    max={999} 
                                    id='x0' 
                                    value={selectedRect ? rects[currentFrame]?.find(rect => rect.id === selectedRect)?.x : ''}
                                    onChange={handleInputPositionChange} 
                                    className='w-12 p-px bg-white rounded-sm outline-1' 
                                />
                            </div>
                            <div className='flex items-center gap-2'>
                                <label htmlFor='y0' className='w-5'>Y<sub>0</sub></label>
                                <input 
                                    type='number' 
                                    max={999} 
                                    id='y0' 
                                    value={selectedRect ? rects[currentFrame]?.find(rect => rect.id === selectedRect)?.y : ''}
                                    onChange={handleInputPositionChange} 
                                    className='w-12 p-px bg-white rounded-sm outline-1' 
                                />
                            </div>
                            <div className='flex items-center gap-2'>
                                <label htmlFor='x1' className='w-5'>X<sub>1</sub></label>
                                <input 
                                    type='number' 
                                    max={999} 
                                    id='x1' 
                                    value={selectedRect ? rects[currentFrame]?.find(rect => rect.id === selectedRect)?.x + rects[currentFrame]?.find(rect => rect.id === selectedRect)?.width : ''}
                                    onChange={handleInputPositionChange} 
                                    className='w-12 p-px bg-white rounded-sm outline-1' 
                                />
                            </div>
                            <div className='flex items-center gap-2'>
                                <label htmlFor='y1' className='w-5'>Y<sub>1</sub></label>
                                <input 
                                    type='number' 
                                    max={999} 
                                    id='y1' 
                                    value={selectedRect ? rects[currentFrame]?.find(rect => rect.id === selectedRect)?.y + rects[currentFrame]?.find(rect => rect.id === selectedRect)?.height : ''}
                                    onChange={handleInputPositionChange} 
                                    className='w-12 p-px bg-white rounded-sm outline-1' 
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className='w-full h-28 grid grid-cols-[72%_auto] gap-3 rounded-b-xl bg-green'>
                {/* Slider com as imagens do paciente */}
                <AnnotationToolSlider 
                    frames={frames} 
                    rects={rects} 
                    currentFrame={currentFrame} 
                    setCurrentFrame={setCurrentFrame} 
                    batchStatus={batchProgress}
                />

                <div className='flex flex-col justify-center gap-2 pr-4 text-white'>
                    {/* Botão de deteção das válvulas em batch */}
                    <button 
                        onClick={handleBatchValvesDetection}
                        className='p-2 rounded-sm flex items-center justify-center gap-4 transition-colors bg-green-dark disabled:hidden'
                        title="Batch Valve Identification Tool"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth={2} d="M19 15h4V1H9v4m6 14h4V5H5v4M1 23h14V9H1z"></path></svg>
                        <span role='tooltip'>Batch Analysis</span>
                    </button>
                    <em className="text-sm text-gray-light leading-4">* Both valve identification and calcium detection.</em>
                </div>
            </div>
        </div>
    );
};
