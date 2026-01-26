import { useRef, useState } from "react";
import api, { useMockApi } from "../api";
import { useBatchProgressStore } from '../store/useBatchProgressStore';

export function usePatientScreening() {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState({});
  const progressRef = useRef({});
  const sockets = useRef({});
  const { activeBatches, removeBatch, setBatches: setBatchesGlobalState } = useBatchProgressStore();

  const setAndTrackProgress = (task_id, updates) => {
    progressRef.current[task_id] = {
      ...progressRef.current[task_id],
      ...updates,
    };
    setBatches({ ...progressRef.current });
  };

  const startScreening = async () => {
    setLoading(true);
    setBatches({});
    try {
      const response = await api.get('/api/model/patient-screening/');

      if (response.status !== 202) throw new Error('Erro ao iniciar patient screening');

      // Adiciona os batches ao estado global de progresso
      setBatchesGlobalState(response.data.batches);
      setLoading(false);
      return batches;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const connectPatientScreening = async () => {
    if (useMockApi) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Atualiza os dados mais recentes dos batches
    await fetchBatchProgress(activeBatches);

    activeBatches.forEach(({ task_id, echo, patient, frame_id }) => {
      if (sockets.current[task_id]) return; // Já está conectado

      const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL + `model/${task_id}/`);

      if (!sockets.current) sockets.current = {};
      sockets.current[task_id] = socket;

      socket.onopen = () => {
        console.log('Conectado ao WebSocket para o task_id:', task_id);
        socket.send(JSON.stringify({ type: 'get_status' })); // Solicita o status atual da task
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Mensagem recebida do WebSocket:', data);
        setAndTrackProgress(task_id, { ...data, echo, patient, frame_id });
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          socket.close();
          removeBatch(task_id); // Remove o batch do estado global
        }
      };

      socket.onerror = () => {
        socket.close();
        removeBatch(task_id);
        delete sockets.current[task_id];
      };

      socket.onclose = () => {
        removeBatch(task_id);
        delete sockets.current[task_id];
        if (Object.keys(sockets.current).length === 0) {
          setLoading(false);
        }
      };
    });
  };

  const fetchBatchProgress = async (batches) => {
    const updated = {};
    await Promise.all(
      Object.values(batches).map(async (batch) => {
        try {
          const response = await api.get(`/api/model/patient-screening/status/${batch.task_id}/`);
          updated[batch.task_id] = { ...batch, ...response.data };
        } catch (error) {
          updated[batch.task_id] = batch;
        }
      })
    );
    setBatches(updated);
    progressRef.current = updated;
  };

  const acceptPatientScreening = async () => {
    const results = Object.entries(batches).map(([task_id, batch]) => {
      const progress = progressRef.current[task_id]?.results || {};
      return {
        patient_id: batch.patient.id,
        echo_id: batch.echo.id,
        frame_id: batch.frame_id,
        rect: progress.bbox,
        is_calcified: progress.binary_classification,
        classification: progress.classification,
        confidence: parseFloat(progress.confidence) / 100,
      };
    });

    try {
      const response = await api.post('/api/model/patient-screening/accept/', { results });
      setBatches({});
      return response.data;
    } catch (error) {
      console.error('Error accepting patient screening:', error);
    }
  };

  const cancelPatientScreening = () => {
    Object.values(sockets.current).forEach((socket) => socket.close());
    sockets.current = {};
    progressRef.current = {};
    setBatches({});
    setLoading(false);
  };

  return {
    loading,
    batches,
    activeBatches,
    startScreening,
    connectPatientScreening,
    acceptPatientScreening,
    cancelPatientScreening,
  };
}
