import { useRef, useState } from 'react';
import api from '../api';
import { buildModelWsUrl } from '../utils/ws';

export function useBatchValveDetection() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({});
  const progressRef = useRef({});
  const sockets = useRef({});
  const [error, setError] = useState(null);

  const wsErrorMessage =
    'Não foi possível ligar ao serviço de IA. Verifique se o backend está activo.';

  const setAndTrackProgress = (newData) => {
    for (const [imageName, updates] of Object.entries(newData)) {
      if (!progressRef.current[imageName]) progressRef.current[imageName] = {};
      progressRef.current[imageName] = {
        ...progressRef.current[imageName],
        ...updates,
      };
    }
    setProgress({ ...progressRef.current });
  };

  const startDetection = async (images, bboxs) => {
    if (!images || images.length == 0) return;
    setIsLoading(true);
    setProgress({});
    setError(null);

    try {
      const formData = new FormData();

      // Faz fetch de todas as imagens do batch e adiciona-as ao formulário
      await Promise.all(
        images.map(async ({ name, url }, idx) => {
          try {
            const imageFetch = await fetch(url);
            if (!imageFetch.ok) throw new Error(`Erro no fetch da imagem ${name}`);
            const blob = await imageFetch.blob();
            formData.append('images', blob, name);
            formData.append('bboxs', JSON.stringify(bboxs[idx] || {}));
          } catch (error) {
            console.error(`Erro ao processar ${name}:`, error);
            throw error;
          }
        })
      );

      // Enviar para a view de identificação da válvula do Django
      const response = await api.post(
        import.meta.env.VITE_API_URL + '/api/model/valve-batch/',
        formData
      );
      if (response.status != 202) throw new Error('Error initializing the model prediction.');
      const batchId = response.data.task_id;

      // Criação de uma conexão WebSocket para ir recebendo o progresso e os resultados
      const wsUrl = buildModelWsUrl(batchId);
      if (!wsUrl) {
        setIsLoading(false);
        setError(wsErrorMessage);
        throw new Error('WebSocket URL inválido.');
      }
      const socket = new WebSocket(wsUrl);
      console.log('Conectado ao WebSocket para o batchId:', batchId);

      // A Promise impede que o fluxo do componente continue até ter um resolve
      return new Promise((resolve) => {
        let settled = false;
        socket.onmessage = function (event) {
          const data = JSON.parse(event.data);
          console.log('Mensagem recebida do WebSocket:', data);
          if (data.image_name === undefined)
            console.warn('Mensagem recebida sem image_name:', data);

          setAndTrackProgress({
            [data.image_name]: {
              status: data.status,
              progress: data.progress,
              phase: data.phase,
              results: data.results,
              error: data.error,
            },
          });

          const allDone = Object.values(progressRef.current).every(
            (item) =>
              Object.keys(progressRef.current).length === images.length &&
              (item?.status === 'SUCCESS' || item?.status === 'FAILURE')
          );

          console.log(progressRef.current);

          if (allDone) {
            settled = true;
            socket.close();
            setIsLoading(false);
            resolve(progressRef.current);
          }
        };
        socket.onerror = (error) => {
          socket.close();
          setIsLoading(false);
          if (!settled) setError(wsErrorMessage);
          throw error;
        };
        socket.onclose = () => {
          console.log('Conexão WebSocket fechada.');
          if (!settled) {
            setIsLoading(false);
            setError(wsErrorMessage);
          }
        };

        sockets.current[batchId] = socket;
      });
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const cancelDetection = () => {
    Object.values(sockets.current).forEach((socket) => socket.close());
    sockets.current = {};
    setIsLoading(false);
  };

  return { isLoading, progress, error, startDetection, cancelDetection };
}
