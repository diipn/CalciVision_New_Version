import { useState } from 'react';
import api, { useMockApi } from '../api';

export function useValveDetection() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  const startDetection = async (image) => {
    if (!image) return;
    if (useMockApi) {
      setIsLoading(true);
      setProgress(40);
      return new Promise((resolve) => {
        setTimeout(() => {
          setProgress(100);
          setIsLoading(false);
          resolve({ bbox: [120, 90, 260, 210] });
          setProgress(0);
        }, 600);
      });
    }

    setIsLoading(true);
    try {
      let blob;
      if (image instanceof File) {
        blob = image;
      } else if (image instanceof HTMLElement) {
        const imageFetch = await fetch(image.src);
        blob = await imageFetch.blob();
      } else {
        throw new Error('The image sent is not valid.');
      }

      const formData = new FormData();
      formData.append('image', blob);

      // Enviar para a view de identificação da válvula do Django
      const response = await api.post(
        import.meta.env.VITE_API_URL + '/api/model/valve/',
        formData
      );
      if (response.status != 202) throw new Error('Error initializing the model prediction.');
      const taskId = response.data.task_id;

      // Criação de uma conexão WebSocket para ir recebendo o progresso e os resultados
      const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL + `model/${taskId}/`);
      setSocket(socket);
      // A Promise impede que o fluxo do componente continue até ter um resolve ou reject
      return new Promise((resolve, reject) => {
        socket.onmessage = function (event) {
          const data = JSON.parse(event.data);
          setProgress(data.progress || 0);
          console.log('Mensagem recebida do WebSocket:', data);
          const resultsReady = data.results !== undefined;
          if (resultsReady) {
            socket.close();
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

  const cancelDetection = () => {
    socket?.close?.();
    setIsLoading(false);
  };

  return { progress, isLoading, startDetection, cancelDetection };
}
