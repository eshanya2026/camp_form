import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { MongoClient } from "mongodb";
import { normalizeCampRequest, validateCampRequest } from "./validation.js";

const port = Number(process.env.PORT || 2005);
const host = process.env.HOST || "0.0.0.0";
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:3005";
const databaseName = process.env.MONGO_DB_NAME || "camp_registration";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:1005";
const adminEmail = (process.env.ADMIN_EMAIL || "admin@hospital.local").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
const jwtSecret = process.env.JWT_SECRET || "replace-this-development-jwt-secret";

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    redact: ["req.headers.authorization", "req.body.requesterPhone"],
  },
  bodyLimit: 100 * 1024,
  trustProxy: true,
});

await app.register(cors, {
  origin: corsOrigin.split(",").map((origin) => origin.trim()),
  methods: ["GET", "POST", "PATCH"],
});

await app.register(jwt, { secret: jwtSecret });
await app.register(rateLimit, { global: false });

app.decorate("authenticateAdmin", async (request, reply) => {
  try {
    await request.jwtVerify();
    if (request.user?.role !== "admin") throw new Error("Invalid role");
  } catch {
    return reply.code(401).send({ success: false, message: "Admin authentication is required." });
  }
});

const client = new MongoClient(mongoUri, {
  maxPoolSize: 20,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
});

async function connectToMongo(attempts = 20) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.connect();
      return client.db(databaseName);
    } catch (error) {
      if (attempt === attempts) throw error;
      app.log.warn({ attempt }, "MongoDB is not ready; retrying");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error("Unable to connect to MongoDB");
}

const database = await connectToMongo();
const requests = database.collection("camp_requests");
const workflowStatuses = ["received", "under_review", "confirmed", "completed", "rejected"];
const allowedStatusTransitions = {
  received: ["under_review", "confirmed", "rejected"],
  under_review: ["confirmed", "rejected"],
  confirmed: ["completed"],
  completed: [],
  rejected: [],
};

await Promise.all([
  requests.createIndex({ requestId: 1 }, { unique: true }),
  requests.createIndex({ createdAt: -1 }),
  requests.createIndex({ campDate: 1, status: 1 }),
  requests.createIndex({ requesterPhone: 1 }),
]);

await requests.updateMany({ status: "reviewing" }, { $set: { status: "under_review", updatedAt: new Date() } });
await requests.updateMany({ status: "scheduled" }, { $set: { status: "confirmed", updatedAt: new Date() } });
await requests.updateMany(
  { status: { $nin: workflowStatuses } },
  { $set: { status: "under_review", updatedAt: new Date() } },
);

const requestSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "requesterName",
    "requesterAge",
    "designation",
    "requesterPhone",
    "village",
    "personCount",
    "campDate",
    "busRequired",
    "seatingRequired",
    "consent",
    "language",
  ],
  properties: {
    requesterName: { type: "string", maxLength: 120 },
    requesterAge: { type: "integer", minimum: 18, maximum: 120 },
    designation: { type: "string", maxLength: 120 },
    requesterPhone: { type: "string", pattern: "^[6-9][0-9]{9}$" },
    village: { type: "string", maxLength: 160 },
    taluk: { anyOf: [{ type: "string", maxLength: 120 }, { type: "null" }] },
    personCount: { type: "integer", minimum: 1, maximum: 10000 },
    campDate: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
    busRequired: { type: "boolean" },
    spaceAvailable: { anyOf: [{ type: "boolean" }, { type: "null" }] },
    parkingLocation: { anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }] },
    spaceLength: { anyOf: [{ type: "number", minimum: 1, maximum: 1000 }, { type: "null" }] },
    spaceWidth: { anyOf: [{ type: "number", minimum: 1, maximum: 1000 }, { type: "null" }] },
    seatingRequired: { type: "boolean" },
    seatingCapacity: { anyOf: [{ type: "integer", minimum: 1, maximum: 10000 }, { type: "null" }] },
    seatingRequirements: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
    additionalRemarks: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
    consent: { type: "boolean", const: true },
    language: { type: "string", enum: ["en", "ta"] },
  },
};

function createRequestId() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `MMC-${day}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, Buffer.alloc(leftBuffer.length));
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.get("/api/health", async (_request, reply) => {
  await database.command({ ping: 1 });
  return reply.send({ status: "ok", service: "mammography-camp-api" });
});

app.post(
  "/api/admin/login",
  {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 160 },
          password: { type: "string", minLength: 8, maxLength: 200 },
        },
      },
    },
  },
  async (request, reply) => {
    const suppliedEmail = request.body.email.trim().toLowerCase();
    const authenticated = secureEqual(suppliedEmail, adminEmail) && secureEqual(request.body.password, adminPassword);

    if (!authenticated) {
      return reply.code(401).send({ success: false, message: "Invalid email or password." });
    }

    const token = app.jwt.sign({ sub: adminEmail, role: "admin" }, { expiresIn: "8h" });
    return reply.send({ success: true, token, admin: { email: adminEmail }, expiresIn: 28800 });
  },
);

app.get(
  "/api/admin/summary",
  { preHandler: app.authenticateAdmin },
  async (_request, reply) => {
    const today = new Date().toISOString().slice(0, 10);
    const upcomingCampFilter = { status: "confirmed", campDate: { $gte: today } };
    const [total, pendingReview, upcoming, attendance] = await Promise.all([
      requests.countDocuments(),
      requests.countDocuments({ status: { $in: ["received", "under_review"] } }),
      requests.countDocuments(upcomingCampFilter),
      requests.aggregate([
        { $match: upcomingCampFilter },
        { $group: { _id: null, count: { $sum: "$personCount" } } },
      ]).next(),
    ]);

    return reply.send({
      total,
      pendingReview,
      upcoming,
      expectedAttendance: attendance?.count || 0,
    });
  },
);

app.get(
  "/api/admin/requests",
  {
    preHandler: app.authenticateAdmin,
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: { type: "integer", minimum: 1, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          search: { type: "string", maxLength: 100, default: "" },
          status: { type: "string", enum: [...workflowStatuses, ""], default: "" },
          campDate: { type: "string", enum: ["today", "upcoming", "past", ""], default: "" },
        },
      },
    },
  },
  async (request, reply) => {
    const { page, limit, status, campDate } = request.query;
    const search = request.query.search.trim();
    const filter = {};
    const today = new Date().toISOString().slice(0, 10);

    if (status) filter.status = status;
    if (campDate === "today") filter.campDate = today;
    if (campDate === "upcoming") filter.campDate = { $gt: today };
    if (campDate === "past") filter.campDate = { $lt: today };
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { requestId: expression },
        { requesterName: expression },
        { requesterPhone: expression },
        { village: expression },
      ];
    }

    const [items, total] = await Promise.all([
      requests.find(filter, {
        projection: {
          _id: 0, requestId: 1, requesterName: 1, requesterPhone: 1, designation: 1,
          village: 1, taluk: 1, personCount: 1, campDate: 1, busRequired: 1,
          seatingRequired: 1, status: 1, language: 1, createdAt: 1,
        },
      }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      requests.countDocuments(filter),
    ]);

    return reply.send({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  },
);

app.patch(
  "/api/admin/requests/:requestId/status",
  {
    preHandler: app.authenticateAdmin,
    schema: {
      params: { type: "object", required: ["requestId"], properties: { requestId: { type: "string", pattern: "^MMC-[0-9]{8}-[A-F0-9]{6}$" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["status"],
        properties: { status: { type: "string", enum: workflowStatuses } },
      },
    },
  },
  async (request, reply) => {
    const current = await requests.findOne(
      { requestId: request.params.requestId },
      { projection: { _id: 0, status: 1 } },
    );
    if (!current) return reply.code(404).send({ success: false, message: "Camp request was not found." });

    if (!allowedStatusTransitions[current.status]?.includes(request.body.status)) {
      return reply.code(409).send({ success: false, message: `This request cannot move from ${current.status} to ${request.body.status}.` });
    }

    const changedAt = new Date();
    const timestampField = {
      under_review: "reviewedAt",
      confirmed: "confirmedAt",
      completed: "completedAt",
      rejected: "rejectedAt",
    }[request.body.status];
    const result = await requests.updateOne(
      { requestId: request.params.requestId, status: current.status },
      { $set: { status: request.body.status, updatedAt: changedAt, [timestampField]: changedAt } },
    );
    if (!result.matchedCount) return reply.code(409).send({ success: false, message: "The request changed. Refresh and try again." });

    const document = await requests.findOne({ requestId: request.params.requestId }, { projection: { _id: 0 } });
    return reply.send({ success: true, item: document });
  },
);

app.get(
  "/api/admin/requests/:requestId",
  {
    preHandler: app.authenticateAdmin,
    schema: { params: { type: "object", required: ["requestId"], properties: { requestId: { type: "string", pattern: "^MMC-[0-9]{8}-[A-F0-9]{6}$" } } } },
  },
  async (request, reply) => {
    const document = await requests.findOne({ requestId: request.params.requestId }, { projection: { _id: 0 } });
    if (!document) return reply.code(404).send({ success: false, message: "Camp request was not found." });
    return reply.send({ item: document });
  },
);

app.post(
  "/api/camp-requests",
  { schema: { body: requestSchema } },
  async (request, reply) => {
    const errors = validateCampRequest(request.body);
    if (errors.length) {
      return reply.code(400).send({
        success: false,
        message: "Please correct the submitted camp request.",
        errors,
      });
    }

    const requestId = createRequestId();
    const document = {
      requestId,
      ...normalizeCampRequest(request.body),
      status: "received",
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "public-web-form",
    };

    await requests.insertOne(document);

    return reply.code(201).send({
      success: true,
      requestId,
      message: "Camp request received successfully.",
    });
  },
);

app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.code(400).send({
      success: false,
      message: "The submitted data is invalid.",
      errors: error.validation.map((item) => ({
        field: item.instancePath.replace(/^\//, "") || item.params?.missingProperty || "form",
        message: item.message,
      })),
    });
  }

  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ success: false, message: error.message });
  }

  request.log.error(error);
  return reply.code(500).send({
    success: false,
    message: "Unable to save the camp request right now. Please try again.",
  });
});

app.addHook("onClose", async () => {
  await client.close();
});

const shutdown = async (signal) => {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
