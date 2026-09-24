import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCampRequest, validateCampRequest } from "../src/validation.js";

function validPayload() {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return {
    requesterName: "முருகன்",
    requesterAge: 42,
    designation: "Village Head",
    requesterPhone: "9876543210",
    village: "Melur",
    taluk: null,
    personCount: 75,
    campDate: tomorrow,
    busRequired: true,
    spaceAvailable: true,
    parkingLocation: "Panchayat office ground",
    spaceLength: 40,
    spaceWidth: 20,
    seatingRequired: false,
    seatingCapacity: null,
    seatingRequirements: null,
    additionalRemarks: "தமிழ் மற்றும் English accepted",
    consent: true,
    language: "ta",
  };
}

test("accepts and preserves a valid bilingual camp request", () => {
  const payload = validPayload();
  assert.deepEqual(validateCampRequest(payload), []);
  const normalized = normalizeCampRequest(payload);
  assert.equal(normalized.requesterName, "முருகன்");
  assert.equal(normalized.additionalRemarks, "தமிழ் மற்றும் English accepted");
});

test("requires bus location only when suitable space is available", () => {
  const payload = validPayload();
  payload.parkingLocation = "";
  assert.equal(validateCampRequest(payload).some((error) => error.field === "parkingLocation"), true);

  payload.spaceAvailable = false;
  assert.equal(validateCampRequest(payload).some((error) => error.field === "parkingLocation"), false);
  assert.equal(normalizeCampRequest(payload).parkingLocation, null);
});

test("rejects invalid phone, counts, dates, and missing consent", () => {
  const payload = validPayload();
  payload.requesterPhone = "123";
  payload.personCount = 0;
  payload.campDate = "2020-01-01";
  payload.consent = false;
  const fields = validateCampRequest(payload).map((error) => error.field);
  assert.deepEqual(new Set(fields), new Set(["requesterPhone", "personCount", "campDate", "consent"]));
});
