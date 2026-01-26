import { useState } from 'react';
import api from '../api'

export function useCalciumDetection() {

    const [progress, setProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Inicia a deteção de cálcio na válvula aórtica. Aceita a imagem inteira + retângulo ou imagem recortada
     * Ou seja, se bbox for recebido (coordenadas do retângulo), então a task vai considerar que a imagem recebida é a imagem INTEIRA (e sem retângulo)
     * E se bbox NÃO for recebido, então significa que a imagem recebida já está recortada (não é preciso as coordenadas) porque a imagem já está pronta
     * @param {string} image - A imagem inteira ou recortada
     * @param {Array} bbox - As coordenadas do retângulo (se existirem). Estão no formato [x, y, width, height]
     * @returns {Promise} - Só retorna quando os resultados ("Com cálcio" ou "Sem cálcio") forem recebidos
     */
    const startDetection = async (image, bbox) => {
        if(!image) return
        setIsLoading(true)
        try {
            // Converter a imagem num BLOB (formato binário)
            let blob
            if(image instanceof File) {
                blob = image
            } else if(image instanceof HTMLElement) {
                const imageFetch = await fetch(image.src);
                blob = await imageFetch.blob() 
            } else {
                throw new Error('The image sent is not valid.')
            }
            console.log('blob', blob)
            
            const formData = new FormData()
            // Adicionar o BLOB ao formData, que será enviado no corpo da requisição
            formData.append('image', blob)
            // Se bbox existir, significa que a imagem ainda não está recortada (recorte + deteção), senão a imagem já está recortada (detetar cálcio apenas)
            formData.append('action', bbox ? 'full' : 'detect_only')
            // Se bbox existir, adiciona-o ao formData
            bbox && formData.append('bbox', JSON.stringify(bbox))

            // Enviar para a view de identificação da válvula do Django
            const response = await api.post(import.meta.env.VITE_API_URL + '/api/model/calcium/', formData)
            if(response.status != 202) throw new Error('Error initializing the model prediction.')
            const taskId = response.data.task_id;
            console.log("Task ID:", taskId);
            
            // Criação de uma conexão WebSocket para ir recebendo o progresso e os resultados
            const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL + `model/${taskId}/`);

            // A Promise impede que o fluxo do componente continue até ter um resolve ou reject
            return new Promise((resolve, reject) => {
                socket.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    setProgress(data.progress || 0);
                    console.log("Mensagem recebida do WebSocket:", data);
                    const resultsReady = data.results !== undefined;
                    if(resultsReady) {
                        socket.close();
                        data.results.binary_classification = Boolean(data.results.binary_classification)
                        setTimeout(() => {
                            setIsLoading(false);
                            setProgress(0);
                            resolve(data.results);
                        }, 500) // Pequeno delay para garantir que o loading é removido antes de mostrar os resultados
                    }
                }
                socket.onerror = (error) => { 
                    socket.close();
                    reject(error);
                };
                socket.onclose = () => {
                    console.log("Conexão WebSocket fechada.");
                };
            });
        } catch(error) { 
            throw error 
        }
    }

    return { progress, isLoading, startDetection }
}