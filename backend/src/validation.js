const text = (value) => (typeof value === "string" ? value.trim() : "");

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return !Number.isNaN(parsed.getTime())
    && parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function validateCampRequest(payload) {
  const errors = [];
  const requiredText = [
    ["requesterName", 120],
    ["designation", 120],
    ["village", 160],
  ];

  requiredText.forEach(([field, maximum]) => {
    const value = text(payload[field]);
    if (!value) errors.push({ field, message: "This field is required." });
    else if (value.length > maximum) errors.push({ field, message: `Must be ${maximum} characters or fewer.` });
  });

  if (!Number.isInteger(payload.requesterAge) || payload.requesterAge < 18 || payload.requesterAge > 120) {
    errors.push({ field: "requesterAge", message: "Age must be a whole number between 18 and 120." });
  }

  if (!/^[6-9]\d{9}$/.test(text(payload.requesterPhone))) {
    errors.push({ field: "requesterPhone", message: "Enter a valid 10-digit Indian mobile number." });
  }

  if (!Number.isInteger(payload.personCount) || payload.personCount < 1 || payload.personCount > 10000) {
    errors.push({ field: "personCount", message: "Expected attendance must be between 1 and 10000." });
  }

  if (!isValidDate(text(payload.campDate)) || text(payload.campDate) < localDateString()) {
    errors.push({ field: "campDate", message: "Camp date must be today or a future date." });
  }

  if (typeof payload.busRequired !== "boolean") {
    errors.push({ field: "busRequired", message: "Select whether the mobile bus is required." });
  } else if (payload.busRequired) {
    if (typeof payload.spaceAvailable !== "boolean") {
      errors.push({ field: "spaceAvailable", message: "Select whether suitable bus space is available." });
    } else if (payload.spaceAvailable && !text(payload.parkingLocation)) {
      errors.push({ field: "parkingLocation", message: "Bus parking or camp location is required." });
    }
  }

  ["spaceLength", "spaceWidth"].forEach((field) => {
    const value = payload[field];
    if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 1 || value > 1000)) {
      errors.push({ field, message: "Space dimension must be between 1 and 1000 feet." });
    }
  });

  if (typeof payload.seatingRequired !== "boolean") {
    errors.push({ field: "seatingRequired", message: "Select whether seating is required." });
  } else if (payload.seatingRequired && (!Number.isInteger(payload.seatingCapacity) || payload.seatingCapacity < 1 || payload.seatingCapacity > 10000)) {
    errors.push({ field: "seatingCapacity", message: "Seating capacity must be between 1 and 10000." });
  }

  const boundedOptionalText = [
    ["taluk", 120],
    ["parkingLocation", 240],
    ["seatingRequirements", 500],
    ["additionalRemarks", 500],
  ];

  boundedOptionalText.forEach(([field, maximum]) => {
    if (text(payload[field]).length > maximum) errors.push({ field, message: `Must be ${maximum} characters or fewer.` });
  });

  if (payload.consent !== true) errors.push({ field: "consent", message: "Confirmation is required." });

  return errors;
}

export function normalizeCampRequest(payload) {
  const busRequired = payload.busRequired === true;
  const spaceAvailable = busRequired && typeof payload.spaceAvailable === "boolean" ? payload.spaceAvailable : null;
  const seatingRequired = payload.seatingRequired === true;

  return {
    requesterName: text(payload.requesterName),
    requesterAge: payload.requesterAge,
    designation: text(payload.designation),
    requesterPhone: text(payload.requesterPhone),
    village: text(payload.village),
    taluk: text(payload.taluk) || null,
    personCount: payload.personCount,
    campDate: text(payload.campDate),
    busRequired,
    spaceAvailable,
    parkingLocation: busRequired && spaceAvailable ? text(payload.parkingLocation) : null,
    spaceLength: busRequired && spaceAvailable ? payload.spaceLength ?? null : null,
    spaceWidth: busRequired && spaceAvailable ? payload.spaceWidth ?? null : null,
    seatingRequired,
    seatingCapacity: seatingRequired ? payload.seatingCapacity : null,
    seatingRequirements: seatingRequired ? text(payload.seatingRequirements) || null : null,
    additionalRemarks: text(payload.additionalRemarks) || null,
    language: payload.language === "ta" ? "ta" : "en",
    consent: true,
  };
}
