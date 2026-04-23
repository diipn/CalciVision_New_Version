import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import api, { getPatientExams, getPatients } from '../api';
import { formatExamDate, formatVo, getRiskBadge, normalizeVo } from '../utils/examComparison';

function matchesExamId(exam, examId) {
  return String(exam?.id) === String(examId);
}

function PreviewState({ src, loading, label }) {
  if (src) {
    return (
      <img
        src={src}
        alt={`DICOM do ${label.toLowerCase()}`}
        className="h-full w-full object-contain"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col justify-between bg-green-light/40 p-5">
        <div className="h-4 w-32 rounded bg-white/70" />
        <div className="h-28 rounded-xl bg-white/70" />
        <div className="h-4 w-48 rounded bg-white/70" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-center bg-green-light/30 p-6 text-left">
      <p className="text-sm font-semibold text-gray-900">Pré-visualização indisponível</p>
      <p className="mt-2 text-sm text-gray-600">
        Não foi possível carregar o DICOM deste exame. Pode continuar a comparar data, risco, VO e estado.
      </p>
    </div>
  );
}

function CompareExamCard({ exam, label, previewState }) {
  const risk = getRiskBadge(exam?.vo);

  return (
    <section className="rounded-xl border border-green-pale bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <h4 className="mt-1 text-lg font-semibold text-gray-900">
            {exam?.description || 'Exame sem descrição'}
          </h4>
          <p className="mt-2 inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-dark">
            Data do exame: {formatExamDate(exam?.date || exam?.uploaded_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-green-pale bg-white px-3 py-1 text-xs font-semibold text-green-dark">
            VO {formatVo(exam?.vo)}
          </span>
          {risk ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${risk.className}`}>
              Risco {risk.label}
            </span>
          ) : (
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-medium-dark">
              Risco —
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-green-pale bg-gray-50">
        <PreviewState src={previewState?.src} loading={previewState?.loading} label={label} />
      </div>

      <div className="mt-4 rounded-lg bg-green-light/20 px-4 py-3 text-sm text-gray-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</p>
        <p className="mt-1 font-medium">{formatStatus(exam?.status)}</p>
      </div>
    </section>
  );
}

function formatStatus(status) {
  if (!status) return 'Por definir';

  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function CompareExams() {
  const { patientId, examIdA, examIdB } = useParams();
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState('');
  const [exams, setExams] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [previewFrames, setPreviewFrames] = useState({
    [examIdA]: { src: null, loading: true },
    [examIdB]: { src: null, loading: true },
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setMetadataLoading(true);
      setLoadError('');

      try {
        const [patientExams, patients] = await Promise.all([
          getPatientExams(patientId),
          getPatients(),
        ]);

        if (!isMounted) return;

        setExams(patientExams || []);
        const patient = patients.find((item) => item.id === Number(patientId));
        setPatientName(patient?.name || 'Paciente');
      } catch (error) {
        if (!isMounted) return;
        console.error('Erro ao carregar comparação de exames:', error);
        setLoadError('Não foi possível carregar os exames para comparação.');
      } finally {
        if (isMounted) {
          setMetadataLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [patientId]);

  useEffect(() => {
    let isMounted = true;
    const targetExamIds = [examIdA, examIdB];

    setPreviewFrames({
      [examIdA]: { src: null, loading: true },
      [examIdB]: { src: null, loading: true },
    });

    const loadPreview = async (examId) => {
      try {
        const response = await api.get(`/api/patient/${patientId}/echocardiogram/${examId}/frames/`);
        const firstFrame = response?.data?.[0]?.image_url || null;

        if (!isMounted) return;

        setPreviewFrames((prev) => ({
          ...prev,
          [examId]: { src: firstFrame, loading: false },
        }));
      } catch (error) {
        if (!isMounted) return;

        setPreviewFrames((prev) => ({
          ...prev,
          [examId]: { src: null, loading: false },
        }));
      }
    };

    targetExamIds.forEach((examId) => {
      if (examId) {
        loadPreview(examId);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [patientId, examIdA, examIdB]);

  const examA = useMemo(
    () => exams.find((exam) => matchesExamId(exam, examIdA)),
    [exams, examIdA]
  );
  const examB = useMemo(
    () => exams.find((exam) => matchesExamId(exam, examIdB)),
    [exams, examIdB]
  );

  const voA = normalizeVo(examA?.vo);
  const voB = normalizeVo(examB?.vo);
  const hasVoComparison = voA !== null && voB !== null;
  const diff = hasVoComparison ? Math.abs(voB - voA) : null;
  const diffPercent =
    hasVoComparison && voA
      ? `${((Math.abs(voB - voA) / voA) * 100).toFixed(1)}%`
      : 'N/A';
  const trend = !hasVoComparison ? 'sem dados' : voB > voA ? 'pioria' : voB < voA ? 'melhoria' : 'estável';
  const examsReady = Boolean(examA) && Boolean(examB);

  return (
    <MainLayout pageTitle="Comparar Exames - CalciVision">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="mb-2">Comparação de exames</h3>
            <p className="text-sm text-gray-medium-dark">
              {patientName ? `${patientName} · ` : ''}
              Compare dois exames do mesmo paciente.
            </p>
          </div>
          <button
            className="rounded-lg bg-green-dark px-4 py-2 text-white"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </div>

        {metadataLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="animate-pulse rounded-xl border border-green-pale bg-white p-5 shadow-sm">
                <div className="h-5 w-32 rounded bg-green-light/50" />
                <div className="mt-3 h-4 w-56 rounded bg-green-light/50" />
                <div className="mt-6 aspect-video rounded-xl bg-green-light/50" />
                <div className="mt-4 h-16 rounded-lg bg-green-light/40" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red/20 bg-red/5 p-6 text-center">
            <p className="text-sm font-semibold text-red">Comparação indisponível</p>
            <p className="mt-2 text-sm text-gray-700">{loadError}</p>
          </div>
        ) : !examsReady ? (
          <div className="rounded-xl border border-green-pale bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Os exames selecionados não estão disponíveis.</p>
            <p className="mt-2 text-sm text-gray-600">
              Volte à lista do doente, confirme a seleção e tente novamente.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <CompareExamCard exam={examA} label="Exame A" previewState={previewFrames[examIdA]} />
              <CompareExamCard exam={examB} label="Exame B" previewState={previewFrames[examIdB]} />
            </div>

            <section className="rounded-xl border border-green-pale bg-green-light/30 p-6">
              <h4 className="text-lg font-semibold text-gray-900">Resumo da comparação</h4>
              <p className="mt-2 text-sm text-gray-600">
                Compare os dois exames escolhidos pelo DICOM, data, risco e diferença de VO.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Diferença absoluta de VO</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">
                    {diff !== null ? `${(diff * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Diferença percentual</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">{diffPercent}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Tendência</p>
                  <p className="mt-2 text-xl font-semibold capitalize text-gray-900">{trend}</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
