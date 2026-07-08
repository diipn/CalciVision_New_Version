const buildReportDraftStorageKey = (patientId, echoId) =>
  `clinical-report-draft-${patientId}-${echoId}`;

export const readStoredClinicalReportDraft = (patientId, echoId) => {
  if (!patientId || !echoId) return null;

  const raw = localStorage.getItem(buildReportDraftStorageKey(patientId, echoId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writeStoredClinicalReportDraft = (patientId, echoId, report) => {
  if (!patientId || !echoId || !report) return;

  localStorage.setItem(
    buildReportDraftStorageKey(patientId, echoId),
    JSON.stringify({
      ...report,
      storedAt: new Date().toISOString(),
    })
  );
};

export const clearStoredClinicalReportDraft = (patientId, echoId) => {
  if (!patientId || !echoId) return;
  localStorage.removeItem(buildReportDraftStorageKey(patientId, echoId));
};
