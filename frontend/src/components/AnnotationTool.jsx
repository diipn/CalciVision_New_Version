import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Stage, Layer, Image, Rect, Transformer, Group } from "react-konva";
import useImage from "use-image";
import { useValveDetection } from "../hooks/useValveDetection";
import { useCalciumDetection } from "../hooks/useCalciumDetection";
import { useBatchValveDetection } from "../hooks/useBatchValveDetection";
import ProgressBar from "./ProgressBar";
import { useUnsavedStore } from "../store/useUnsavedStore";

const AnnotationTool = forwardRef(function AnnotationTool({ frames, currentFrame, rects, setRects, calcificationStatus, setCalcificationStatus, predictedValveBoxes, setPredictedValveBoxes, calcification, setCalcification, predictionHistory, setPredictionHistory, imageSettings, onImageSettingsChange, onAnnotationChange }, ref) {
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

    useImperativeHandle(ref, () => ({
        iniciarAnotacaoManual() {
            if (rects[currentFrame]?.length === 0) {
                setIsDrawing(true);
            }
        },
        cancelarAnotacaoManual() {
            setIsDrawing(false);
        },
        detetarValvulaIA() {
            return handleDetectValve();
        },
        detetarCalcificacaoIA() {
            return handleDetectCalcium();
        },
        ajustarManual() {
            setIsDrawing(true);
        },
        reporAnotacaoIA() {
            handleResetValvePosition();
        },
        limparAnotacoes() {
            handleClearAnnotations();
        },
        detetarEmLote() {
            return handleBatchValvesDetection();
        },
    }));

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
        onAnnotationChange?.();
    }

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
        onAnnotationChange?.();
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
            onAnnotationChange?.();
            return valveBox;

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
                onAnnotationChange?.();
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
        onAnnotationChange?.();
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
            onAnnotationChange?.();
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
        onAnnotationChange?.();
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
                onAnnotationChange?.();
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
                onAnnotationChange?.();
            }
        } catch(error) {
            console.error(error)
        }
    }

    return (
        <div className='w-full flex flex-col items-center rounded-lg overflow-hidden border border-green-pale bg-white shadow-sm'>
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
                                            onAnnotationChange?.();
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
                                            onAnnotationChange?.();
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
                                ? 'A identificar a válvula aórtica...' 
                                : isLoadingBatch
                                ? `${batchProgress[frames[currentFrame]?.name]?.phase || 'A aguardar resultados de outros frames'}...`
                                : 'A procurar depósitos de cálcio...'}
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
                            Cancelar
                        </button>
                        <div className='absolute inset-0 bg-green-400/10 backdrop-blur-xs' />
                    </div>
                )}

                {/* Caixa de texto com as coordenadas do retângulo selecionado */}
                {selectedRect && (
                    <div className='absolute bottom-2 left-2 bg-gray-pale rounded-md w-60 h-32 px-3 py-2'>
                        <h5 className='mb-4'>Delimitação</h5>
                        
                        <div className='absolute top-3 right-3 flex gap-2'>
                            {/* Botão para retomar à posição identificada pelo modelo */}
                            {predictedValveBoxes[currentFrame] && (
                                <button onClick={handleResetValvePosition} title='Repor anotação IA'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}><path d="M12 3a9 9 0 1 1-5.657 2"></path><path d="M3 4.5h4v4"></path></g></svg>
                                </button>
                            )}

                            {/* Botão para apagar a anotação selecionada */}
                            <button onClick={handleClearAnnotations} title="Limpar tudo">
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
        </div>
    );
});

export default AnnotationTool;
