import { useState } from 'react';
import api, { useMockApi } from '../api';

export function useCalciumDetection() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Inicia a deteção de cálcio na válvula aórtica.
   */
  const startDetection = async (image, bbox) => {
    if (!image) return;
    if (useMockApi) {
      setIsLoading(true);
      setProgress(45);
      return new Promise((resolve) => {
        setTimeout(() => {
          const binary = Math.random() > 0.5;
          setProgress(100);
          setIsLoading(false);
          resolve({
            binary_classification: binary,
            confidence: binary ? 0.82 : 0.18,
            is_calcification_generated: true,
          });
          setProgress(0);
        }, 650);
      });
    }

    setIsLoading(true);
    try {
      // Converter a imagem num BLOB (formato binário)
      let blob;
      if (image instanceof File) {
        blob = image;
      } else if (image instanceof HTMLElement) {
        const imageFetch = await fetch(image.src);
        blob = await imageFetch.blob();
      } else {
        throw new Error('The image sent is not valid.');
      }
      console.log('blob', blob);

      const formData = new FormData();
      // Adicionar o BLOB ao formData, que será enviado no corpo da requisição
      formData.append('image', blob);
      // Se bbox existir, significa que a imagem ainda não está recortada (recorte + deteção), senão a imagem já está recortada (detetar cálcio apenas)
      formData.append('action', bbox ? 'full' : 'detect_only');
      // Se bbox existir, adiciona-o ao formData
      bbox && formData.append('bbox', JSON.stringify(bbox));

      // Enviar para a view de identificação da válvula do Django
      const response = await api.post(
        import.meta.env.VITE_API_URL + '/api/model/calcium/',
        formData
      );
      if (response.status != 202) throw new Error('Error initializing the model prediction.');
      const taskId = response.data.task_id;
      console.log('Task ID:', taskId);

      // Criação de uma conexão WebSocket para ir recebendo o progresso e os resultados
      const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL + `model/${taskId}/`);

      // A Promise impede que o fluxo do componente continue até ter um resolve ou reject
      return new Promise((resolve, reject) => {
        socket.onmessage = function (event) {
          const data = JSON.parse(event.data);
          setProgress(data.progress || 0);
          console.log('Mensagem recebida do WebSocket:', data);
          const resultsReady = data.results !== undefined;
          if (resultsReady) {
            socket.close();
            data.results.binary_classification = Boolean(data.results.binary_classification);
            setTimeout(() => {
              setIsLoading(false);
              setProgress(0);
              resolve(data.results);
            }, 500); // Pequeno delay para garantir que o loading é removido antes de mostrar os resultados
          }
        };
        socket.onerror = (error) => {
          socket.close();
          reject(error);
        };
        socket.onclose = () => {
          console.log('Conexão WebSocket fechada.');
        };
      });
    } catch (error) {
      throw error;
    }
  };

  return { progress, isLoading, startDetection };
}
