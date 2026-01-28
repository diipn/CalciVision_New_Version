import { useState } from 'react';
import api from '../api';
import { buildModelWsUrl } from '../utils/ws';

export function useCalciumDetection() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const wsErrorMessage =
    'Não foi possível ligar ao serviço de IA. Verifique se o backend está activo.';

  /**
   * Inicia a deteção de cálcio na válvula aórtica.
   */
  const startDetection = async (image, bbox) => {
    if (!image) return;

    setIsLoading(true);
    setError(null);
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
      const wsUrl = buildModelWsUrl(taskId);
      if (!wsUrl) {
        setIsLoading(false);
        setError(wsErrorMessage);
        throw new Error('WebSocket URL inválido.');
      }
      const socket = new WebSocket(wsUrl);

      // A Promise impede que o fluxo do componente continue até ter um resolve ou reject
      return new Promise((resolve, reject) => {
        let settled = false;
        socket.onmessage = function (event) {
          const data = JSON.parse(event.data);
          setProgress(data.progress || 0);
          console.log('Mensagem recebida do WebSocket:', data);
          const resultsReady = data.results !== undefined;
          if (resultsReady) {
            settled = true;
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
          if (!settled) {
            setIsLoading(false);
            setError(wsErrorMessage);
          }
          reject(error);
        };
        socket.onclose = () => {
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

  return { progress, isLoading, error, startDetection };
}
