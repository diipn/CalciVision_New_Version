import { useRef, useState } from 'react';
import api from '../api';
import { buildModelWsUrl } from '../utils/ws';

export function useValveDetection() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState(null);
  const lastImageRef = useRef(null);

  const wsErrorMessage =
    'Não foi possível ligar ao serviço de IA. Verifique se o backend está activo.';
  const slowDetectionMessage =
    'A deteção está a demorar mais do que o esperado. Verifique se o worker Celery está activo.';

  const startDetection = async (image) => {
    if (!image) return;

    lastImageRef.current = image;
    setIsLoading(true);
    setError(null);
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
      const wsUrl = buildModelWsUrl(taskId);
      console.log('WS ValveDetection ->', wsUrl);
      if (!wsUrl) {
        setIsLoading(false);
        setError(wsErrorMessage);
        throw new Error('WebSocket URL inválido.');
      }
      const socket = new WebSocket(wsUrl);
      setSocket(socket);
      // A Promise impede que o fluxo do componente continue até ter um resolve ou reject
      return new Promise((resolve, reject) => {
        let settled = false;
        let receivedAnyMessage = false;
        const timeoutId = setTimeout(() => {
          if (!receivedAnyMessage) {
            setError(slowDetectionMessage);
          }
        }, 12000);
        socket.onmessage = function (event) {
          if (!receivedAnyMessage) {
            setError(null);
          }
          receivedAnyMessage = true;
          clearTimeout(timeoutId);
          const data = JSON.parse(event.data);
          setProgress(data.progress || 0);
          console.log('Mensagem recebida do WebSocket:', data);
          const resultsReady = data.results !== undefined;
          if (resultsReady) {
            settled = true;
            socket.close();
            setTimeout(() => {
              setIsLoading(false);
              setProgress(0);
              resolve(data.results);
            }, 500); // Pequeno delay para garantir que o loading é removido antes de mostrar os resultados
          }
        };
        socket.onerror = (error) => {
          clearTimeout(timeoutId);
          socket.close();
          if (!settled) {
            setIsLoading(false);
            setError(wsErrorMessage);
          }
          reject(error);
        };
        socket.onclose = () => {
          clearTimeout(timeoutId);
          console.log('Conexão WebSocket fechada.');
          if (!settled) {
            setIsLoading(false);
            setError(wsErrorMessage);
          }
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

  const retryDetection = () => {
    if (!lastImageRef.current) return;
    cancelDetection();
    return startDetection(lastImageRef.current);
  };

  return { progress, isLoading, error, startDetection, cancelDetection, retryDetection, slowDetectionMessage };
}
