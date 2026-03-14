import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { deviceBaselinesTable } from "@workspace/db/schema";
import { SaveBaselineBody } from "@workspace/api-zod";
import { runPcapAnalysis, type DeviceFingerprint, type ExecError } from "../lib/pcap";

const router: IRouter = Router();

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".pcap", ".pcapng"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .pcap and .pcapng files are allowed"));
    }
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: "File upload failed" });
      return;
    }
    next();
  });
}

function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

type Verdict = "Normal" | "Suspicious" | "Possible Spoofing" | "No Baseline";

interface ComparisonResult {
  ip: string;
  verdict: Verdict;
  similarity_score: number | null;
  baseline_label: string | null;
  current_fingerprint: DeviceFingerprint;
  baseline_fingerprint: DeviceFingerprint | null;
  deviations: string[];
}

function compareFingerprints(
  current: DeviceFingerprint,
  baseline: DeviceFingerprint,
  baselineLabel: string | null,
): Omit<ComparisonResult, "ip"> {
  const deviations: string[] = [];

  const ttlDelta = Math.abs(current.avg_ttl - baseline.avg_ttl);
  const ttlScore = Math.max(0, 1 - ttlDelta / 64) * 100;
  if (ttlDelta > 5) {
    deviations.push(
      `TTL changed from ${baseline.avg_ttl.toFixed(1)} → ${current.avg_ttl.toFixed(1)} (${ttlDelta.toFixed(1)} difference — possible TTL spoofing)`,
    );
  }

  const protoSim = cosineSimilarity(
    current.protocol_distribution,
    baseline.protocol_distribution,
  ) * 100;
  if (protoSim < 90) {
    const baselineProtos = Object.entries(baseline.protocol_distribution)
      .map(([k, v]) => `${k}=${v}%`)
      .join(", ");
    const currentProtos = Object.entries(current.protocol_distribution)
      .map(([k, v]) => `${k}=${v}%`)
      .join(", ");
    deviations.push(`Protocol distribution changed: baseline [${baselineProtos}] → current [${currentProtos}]`);
  }

  const sizeDelta = Math.abs(current.avg_packet_size - baseline.avg_packet_size);
  const sizeRelative = baseline.avg_packet_size > 0 ? sizeDelta / baseline.avg_packet_size : 0;
  const sizeScore = Math.max(0, 1 - sizeRelative) * 100;
  if (sizeRelative > 0.2) {
    deviations.push(
      `Average packet size changed from ${baseline.avg_packet_size.toFixed(0)} → ${current.avg_packet_size.toFixed(0)} bytes (${(sizeRelative * 100).toFixed(1)}% deviation)`,
    );
  }

  const similarity = ttlScore * 0.4 + protoSim * 0.3 + sizeScore * 0.3;
  const similarityRounded = Math.round(similarity * 10) / 10;

  let verdict: Verdict;
  if (similarity >= 90) {
    verdict = "Normal";
  } else if (similarity >= 70) {
    verdict = "Suspicious";
  } else {
    verdict = "Possible Spoofing";
  }

  return {
    verdict,
    similarity_score: similarityRounded,
    baseline_label: baselineLabel,
    current_fingerprint: current,
    baseline_fingerprint: baseline,
    deviations,
  };
}

function parsePcapError(err: ExecError): string | null {
  if (err.stdout) {
    try {
      const parsed: unknown = JSON.parse(err.stdout);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof (parsed as { error: string }).error === "string"
      ) {
        return (parsed as { error: string }).error;
      }
    } catch {
      // not JSON
    }
  }
  return null;
}

router.get("/fingerprint/baselines", async (_req, res): Promise<void> => {
  try {
    const baselines = await db
      .select()
      .from(deviceBaselinesTable)
      .orderBy(deviceBaselinesTable.created_at);
    res.json(baselines);
  } catch (err: unknown) {
    console.error("List baselines error:", err);
    res.status(500).json({ error: "Failed to retrieve baselines." });
  }
});

router.post("/fingerprint/baselines", async (req, res): Promise<void> => {
  const parsed = SaveBaselineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { ip, label, fingerprint } = parsed.data;

  if (fingerprint.ip !== ip) {
    res.status(400).json({ error: `fingerprint.ip (${fingerprint.ip}) must match the top-level ip (${ip}).` });
    return;
  }

  try {
    const [saved] = await db
      .insert(deviceBaselinesTable)
      .values({
        ip,
        label: label ?? null,
        fingerprint: fingerprint as DeviceFingerprint,
      })
      .returning();

    res.status(201).json(saved);
  } catch (err: unknown) {
    console.error("Save baseline error:", err);
    res.status(500).json({ error: "Failed to save baseline." });
  }
});

router.delete("/fingerprint/baselines/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid baseline ID." });
    return;
  }

  try {
    const deleted = await db
      .delete(deviceBaselinesTable)
      .where(eq(deviceBaselinesTable.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Baseline not found." });
      return;
    }

    res.json({ error: `Baseline ${id} deleted.` });
  } catch (err: unknown) {
    console.error("Delete baseline error:", err);
    res.status(500).json({ error: "Failed to delete baseline." });
  }
});

router.post("/fingerprint/compare", handleUpload, async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded. Please select a .pcap or .pcapng file." });
    return;
  }

  const filePath = req.file.path;

  try {
    const [analysisResult, savedBaselines] = await Promise.all([
      runPcapAnalysis(filePath),
      // Fetch ordered latest-first so the Map keeps the most recent baseline per IP
      db
        .select()
        .from(deviceBaselinesTable)
        .orderBy(desc(deviceBaselinesTable.created_at)),
    ]);

    // Build map of IP → latest baseline (first entry wins because results are DESC)
    const baselinesByIp = new Map<string, typeof savedBaselines[number]>();
    for (const b of savedBaselines) {
      if (!baselinesByIp.has(b.ip)) {
        baselinesByIp.set(b.ip, b);
      }
    }

    const comparisons: ComparisonResult[] = analysisResult.fingerprints.map((current) => {
      const savedBaseline = baselinesByIp.get(current.ip);
      if (!savedBaseline) {
        return {
          ip: current.ip,
          verdict: "No Baseline" as Verdict,
          similarity_score: null,
          baseline_label: null,
          current_fingerprint: current,
          baseline_fingerprint: null,
          deviations: ["No baseline found for this device. Save a baseline first to enable detection."],
        };
      }

      const baselineFingerprint = savedBaseline.fingerprint as DeviceFingerprint;
      return {
        ip: current.ip,
        ...compareFingerprints(current, baselineFingerprint, savedBaseline.label ?? null),
      };
    });

    res.json({
      total_packets: analysisResult.features.length,
      comparisons,
    });
  } catch (err: unknown) {
    const e = err as ExecError & { isUserError?: boolean };

    if (e.isUserError) {
      res.status(400).json({ error: e.message });
      return;
    }

    const stdoutError = parsePcapError(e);
    if (stdoutError) {
      res.status(400).json({ error: stdoutError });
      return;
    }

    if (e.killed) {
      res.status(504).json({ error: "Analysis timed out. The file may be too large." });
      return;
    }

    console.error("Compare error:", e.message);
    res.status(500).json({ error: "Comparison failed. Please ensure the file is a valid packet capture." });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
