import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { runPcapAnalysis, type ExecError } from "../lib/pcap";

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

router.post("/analyze", handleUpload, async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded. Please select a .pcap or .pcapng file." });
    return;
  }

  const filePath = req.file.path;

  try {
    const result = await runPcapAnalysis(filePath);
    res.json({
      total_packets: result.features.length,
      features: result.features,
      fingerprints: result.fingerprints,
    });
  } catch (err: unknown) {
    const e = err as ExecError & { isUserError?: boolean };

    if (e.isUserError) {
      res.status(400).json({ error: e.message });
      return;
    }

    if (e.stdout) {
      try {
        const errorOutput: unknown = JSON.parse(e.stdout);
        if (
          typeof errorOutput === "object" &&
          errorOutput !== null &&
          "error" in errorOutput &&
          typeof (errorOutput as { error: string }).error === "string"
        ) {
          res.status(400).json({ error: (errorOutput as { error: string }).error });
          return;
        }
      } catch {
        // stdout wasn't valid JSON, fall through
      }
    }

    if (e.killed) {
      res.status(504).json({ error: "Analysis timed out. The file may be too large." });
      return;
    }

    console.error("Analysis error:", e.message);
    res.status(500).json({ error: "Analysis failed. Please ensure the file is a valid packet capture." });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
