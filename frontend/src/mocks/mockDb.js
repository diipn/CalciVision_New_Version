import patientsSeed from './patients.json';
import examsSeed from './exams.json';
import reportsSeed from './reports.json';

const STORAGE_KEY = 'calciVisionMockDb';

const defaultImageSettings = {
  brightness: 1,
  contrast: 1,
  blur: 0,
  zoom: 1,
};

const seedDb = () => ({
  patients: patientsSeed,
  exams: examsSeed,
  reports: reportsSeed,
  examSettings: {},
});

const readDb = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  const seeded = seedDb();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
};

const writeDb = (db) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

const ensureExamSettings = (db, examId) => {
  if (!db.examSettings[examId]) {
    db.examSettings[examId] = {
      classificationOverride: null,
      classificationConfirmed: false,
      validated: false,
      imageSettings: { ...defaultImageSettings },
      reportText: '',
      reportUpdatedAt: null,
    };
  }
  return db.examSettings[examId];
};

const ensureExamFrames = (db, exam) => {
  if (exam.framesData) {
    return exam.framesData;
  }
  const frames = (exam.frames || ['/calcivision_logo.png']).map((imageUrl, index) => ({
    id: `${exam.id}-${index + 1}`,
    image_url: imageUrl,
    data: exam.hasUploadedFrames
      ? []
      : [
          {
            x: 80 + index * 12,
            y: 70 + index * 8,
            width: 110,
            height: 90,
            is_annotation_generated: true,
            is_calcified: exam.vo >= 0.66 ? 1 : 0,
            confidence: Math.round(exam.vo * 100),
            is_calcification_generated: true,
          },
        ],
  }));
  exam.framesData = frames;
  return frames;
};

const buildPatientPayload = (db, patient) => {
  const exams = db.exams
    .filter((exam) => exam.patientId === patient.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const echocardiograms = exams.map((exam) => ({
    id: exam.id,
    description: exam.description,
    status: exam.status,
    uploaded_at: exam.uploaded_at,
    date: exam.date,
    type: exam.type,
    vo: exam.vo,
    frames: exam.frames,
  }));

  const reports = db.reports.filter((report) => report.patientId === patient.id);

  return {
    ...patient,
    echocardiograms,
    reports,
    has_report: reports.length > 0,
  };
};

export const mockDb = {
  getPatients: () => {
    const db = readDb();
    return db.patients.map((patient) => buildPatientPayload(db, patient));
  },
  getPatient: (patientId) => {
    const db = readDb();
    const patient = db.patients.find((item) => item.id === Number(patientId));
    if (!patient) return null;
    return buildPatientPayload(db, patient);
  },
  getPatientExams: (patientId) => {
    const db = readDb();
    return db.exams.filter((exam) => exam.patientId === Number(patientId));
  },
  getExam: (examId) => {
    const db = readDb();
    return db.exams.find((exam) => exam.id === Number(examId));
  },
  getExamFrames: (patientId, examId) => {
    const db = readDb();
    const exam = db.exams.find(
      (item) => item.patientId === Number(patientId) && item.id === Number(examId)
    );
    if (!exam) return [];
    const frames = ensureExamFrames(db, exam);
    writeDb(db);
    return frames;
  },
  updateExamSubmission: ({ patientId, examId, results, completed, echoName }) => {
    const db = readDb();
    const exam = db.exams.find(
      (item) => item.patientId === Number(patientId) && item.id === Number(examId)
    );
    if (!exam) return null;
    if (echoName) {
      exam.description = echoName;
    }
    exam.status = completed ? 'EVALUATED' : 'IN_PROGRESS';
    const frames = ensureExamFrames(db, exam);
    frames.forEach((frame, index) => {
      if (results[index]) {
        frame.data = results[index].rects?.length
          ? results[index].rects.map((rect) => ({
              ...rect,
              is_annotation_generated: rect.is_annotation_generated ?? false,
              is_calcified: results[index].is_calcified ? 1 : 0,
              confidence: 92,
              is_calcification_generated: results[index].generated_calcium ?? false,
            }))
          : [];
      }
    });
    writeDb(db);
    return exam;
  },
  getEchoResults: (patientId) => {
    const db = readDb();
    const exams = db.exams
      .filter((exam) => exam.patientId === Number(patientId))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const exam = exams[0];
    if (!exam) return [];
    const frames = ensureExamFrames(db, exam);
    return frames.map((frame) => ({
      frame: frame.id,
      rects: frame.data?.[0]
        ? {
            x: frame.data[0].x,
            y: frame.data[0].y,
            width: frame.data[0].width,
            height: frame.data[0].height,
          }
        : null,
      is_calcified: frame.data?.[0]?.is_calcified === 1,
      confidence: frame.data?.[0]?.confidence ?? null,
    }));
  },
  getReports: (patientId) => {
    const db = readDb();
    return db.reports.filter((report) => report.patientId === Number(patientId));
  },
  createReport: ({ patientId, examId, reportText }) => {
    const db = readDb();
    const exam =
      db.exams.find((item) => item.id === Number(examId)) ||
      db.exams.find((item) => item.patientId === Number(patientId));
    const newReport = {
      id: Date.now(),
      patientId: Number(patientId),
      patient: Number(patientId),
      examId: Number(exam?.id || examId),
      created_at: new Date().toISOString(),
      reportText,
      pdf_name: `report_${patientId}_${Date.now()}.pdf`,
      pdf_size: 256,
      report_url: 'https://example.com/report.pdf',
      hasCalcification: exam ? exam.vo >= 0.66 : false,
    };
    db.reports.push(newReport);
    writeDb(db);
    return newReport;
  },
  deleteReport: (reportId) => {
    const db = readDb();
    db.reports = db.reports.filter((report) => report.id !== Number(reportId));
    writeDb(db);
  },
  deletePatient: (patientId) => {
    const db = readDb();
    db.patients = db.patients.filter((patient) => patient.id !== Number(patientId));
    db.exams = db.exams.filter((exam) => exam.patientId !== Number(patientId));
    db.reports = db.reports.filter((report) => report.patientId !== Number(patientId));
    writeDb(db);
  },
  createPatient: (patientData) => {
    const db = readDb();
    const payload = patientData instanceof FormData
      ? Object.fromEntries(patientData.entries())
      : patientData;
    const newPatient = {
      id: Date.now(),
      name: payload?.name || 'Novo doente',
      age: payload?.age || 60,
      sex: payload?.sex || payload?.gender || 'F',
      email: payload?.email || 'novo@example.com',
      address: payload?.address || 'Rua Simulada 1',
      status: 'PENDING',
      updated_at: new Date().toISOString(),
      has_report: false,
    };
    db.patients.push(newPatient);
    writeDb(db);
    return newPatient;
  },
  addExam: (patientId, description) => {
    const db = readDb();
    const newExam = {
      id: Date.now(),
      patientId: Number(patientId),
      date: new Date().toISOString().split('T')[0],
      type: 'Eco transtorácico',
      description: description || 'Novo ecocardiograma',
      status: 'IN_PROGRESS',
      uploaded_at: new Date().toISOString(),
      vo: 0.45,
      frames: ['/calcivision_logo.png', '/grid-texture.png', '/calcivision_logo.png'],
    };
    db.exams.push(newExam);
    writeDb(db);
    return newExam;
  },
  addExamWithFrames: (patientId, description, frames) => {
    const db = readDb();
    const newExam = {
      id: Date.now(),
      patientId: Number(patientId),
      date: new Date().toISOString().split('T')[0],
      type: 'Eco transtorácico',
      description: description || 'Novo ecocardiograma',
      status: 'IN_PROGRESS',
      uploaded_at: new Date().toISOString(),
      vo: 0,
      frames,
      hasUploadedFrames: true,
    };
    newExam.framesData = frames.map((imageUrl, index) => ({
      id: `${newExam.id}-${index + 1}`,
      image_url: imageUrl,
      data: [],
    }));
    db.exams.push(newExam);
    writeDb(db);
    return newExam;
  },
  getExamSettings: (examId) => {
    const db = readDb();
    const settings = ensureExamSettings(db, examId);
    writeDb(db);
    return settings;
  },
  updateExamSettings: (examId, updates) => {
    const db = readDb();
    const settings = ensureExamSettings(db, examId);
    db.examSettings[examId] = {
      ...settings,
      ...updates,
      imageSettings: {
        ...settings.imageSettings,
        ...updates.imageSettings,
      },
    };
    writeDb(db);
    return db.examSettings[examId];
  },
  getMockUser: () => ({
    id: 1,
    first_name: 'Helena',
    last_name: 'Carvalho',
    medical_speciality: 'Cardiologia',
  }),
};

const buildResponse = (data, status = 200) => Promise.resolve({ status, data });

export const mockApi = {
  get: (url) => {
    if (url.startsWith('/api/patients-with-ecos/')) {
      return buildResponse(mockDb.getPatients());
    }
    if (url.startsWith('/api/patients/')) {
      return buildResponse(mockDb.getPatients());
    }
    if (url.startsWith('/api/reports/')) {
      const patientId = url.split('/api/reports/')[1]?.split('/')[0];
      return buildResponse(mockDb.getReports(patientId));
    }
    if (url.startsWith('/api/patient/') && url.endsWith('/echodata/')) {
      const patientId = url.split('/api/patient/')[1]?.split('/')[0];
      return buildResponse(mockDb.getEchoResults(patientId));
    }
    if (url.startsWith('/api/patient/') && url.includes('/echocardiogram/') && url.endsWith('/frames/')) {
      const [patientId, examId] = url
        .split('/api/patient/')[1]
        .split('/echocardiogram/');
      const examClean = examId.replace('/frames/', '');
      return buildResponse(mockDb.getExamFrames(patientId, examClean));
    }
    if (url.startsWith('/api/patient/')) {
      const patientId = url.split('/api/patient/')[1]?.split('/')[0];
      return buildResponse(mockDb.getPatient(patientId));
    }
    if (url.startsWith('/api/model/patient-screening/status/')) {
      return buildResponse({ status: 'SUCCESS', progress: 100, results: {} });
    }
    if (url.startsWith('/api/model/patient-screening/')) {
      const patients = mockDb.getPatients();
      const batches = patients.flatMap((patient) =>
        patient.echocardiograms.slice(0, 1).map((echo) => ({
          task_id: `${patient.id}-${echo.id}`,
          patient,
          echo,
          frame_id: `${echo.id}-1`,
        }))
      );
      return buildResponse({ batches }, 202);
    }
    if (url.startsWith('/me/')) {
      return buildResponse(mockDb.getMockUser());
    }
    return buildResponse({});
  },
  post: (url, payload) => {
    if (url.includes('/api/token/refresh/')) {
      return buildResponse({ access: 'mock-access', refresh: 'mock-refresh' });
    }
    if (url.includes('/api/token/')) {
      return buildResponse({ access: 'mock-access', refresh: 'mock-refresh' });
    }
    if (url.startsWith('/api/patient/create/')) {
      return buildResponse(mockDb.createPatient(payload), 201);
    }
    if (url.includes('/echocardiogram/add/')) {
      const patientId = url.split('/api/patient/')[1]?.split('/')[0];
      return buildResponse(mockDb.addExam(patientId, payload?.get?.('description')), 201);
    }
    if (url.includes('/submit/')) {
      const [patientId, examId] = url
        .split('/api/patient/')[1]
        .split('/echocardiogram/');
      return buildResponse(
        mockDb.updateExamSubmission({
          patientId,
          examId: examId.split('/')[0],
          ...payload,
        })
      );
    }
    if (url.startsWith('/api/reports/') && url.endsWith('/create/')) {
      const patientId = url.split('/api/reports/')[1]?.split('/')[0];
      return buildResponse(
        mockDb.createReport({
          patientId,
          examId: payload?.examId,
          reportText: payload?.reportText,
        })
      );
    }
    if (url.startsWith('/api/model/')) {
      return buildResponse({ task_id: 'mock-task' }, 202);
    }
    if (url.startsWith('/api/model/patient-screening/accept/')) {
      return buildResponse({ ok: true });
    }
    return buildResponse({});
  },
  delete: (url) => {
    if (url.includes('/echocardiogram/') && url.endsWith('/delete/')) {
      return buildResponse({});
    }
    if (url.includes('/api/patient/') && url.endsWith('/delete/')) {
      const patientId = url.split('/api/patient/')[1]?.split('/')[0];
      mockDb.deletePatient(patientId);
      return buildResponse({});
    }
    if (url.includes('/api/report/') && url.endsWith('/delete/')) {
      const reportId = url.split('/api/report/')[1]?.split('/')[0];
      mockDb.deleteReport(reportId);
      return buildResponse({});
    }
    return buildResponse({});
  },
};

export { defaultImageSettings };
