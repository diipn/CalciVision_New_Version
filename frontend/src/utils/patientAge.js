export const calculateAgeFromBirthDate = (birthDate, referenceDate = new Date()) => {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const reference =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && reference.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return Math.max(age, 0);
};

export const getPatientAge = (patient, referenceDate = new Date()) => {
  const calculatedAge = calculateAgeFromBirthDate(
    patient?.birth_date,
    referenceDate
  );

  if (calculatedAge !== null) {
    return calculatedAge;
  }

  const fallbackAge = Number(patient?.age);
  return Number.isFinite(fallbackAge) ? fallbackAge : null;
};
