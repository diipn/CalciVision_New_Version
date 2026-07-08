export const normalizeVo = (vo) => {
  if (vo === null || vo === undefined) return null;
  return vo > 1 ? vo / 100 : vo;
};

export const formatVo = (vo) => {
  const normalized = normalizeVo(vo);
  return normalized !== null ? `${Math.round(normalized * 100)}%` : 'N/A';
};

export const getRiskBadge = (vo) => {
  const normalized = normalizeVo(vo);

  if (normalized === null) return null;
  if (normalized < 0.33) {
    return { label: 'Baixo', className: 'bg-green-600 text-white' };
  }
  if (normalized < 0.66) {
    return { label: 'Médio', className: 'bg-orange-500 text-white' };
  }
  return { label: 'Alto', className: 'bg-red text-white' };
};

export const formatExamDate = (dateValue) => {
  if (!dateValue) return '—';

  return new Date(dateValue).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getLocalVoOverride = (echoId) => {
  if (!echoId) return null;
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(`exam-settings-${echoId}`);
    if (!raw) return null;

    const settings = JSON.parse(raw);
    if (!settings?.voOverrideEnabled) return null;

    const value = Number(settings.voOverrideValue);
    if (!Number.isFinite(value)) return null;

    return value > 1 ? value / 100 : value;
  } catch {
    return null;
  }
};

export const applyLocalVoOverrides = (patients) =>
  (patients || []).map((patient) => ({
    ...patient,
    echocardiograms: (patient.echocardiograms || []).map((echo) => {
      const overrideVo = getLocalVoOverride(echo?.id);
      if (overrideVo === null || overrideVo === undefined) return echo;
      return { ...echo, vo: overrideVo };
    }),
  }));
