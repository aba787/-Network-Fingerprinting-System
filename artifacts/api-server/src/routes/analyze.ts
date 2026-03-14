import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execFileAsync = promisify(execFile);

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

const SCRIPT_PATH = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "scripts",
  "analyze_pcap.py"
);

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: any) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message || "File upload failed" });
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
    const { stdout, stderr } = await execFileAsync("python3", [SCRIPT_PATH, filePath], {
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024,
    });

    if (stderr) {
      console.error("Python stderr:", stderr);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      res.status(500).json({ error: "Failed to parse analysis output." });
      return;
    }

    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    if (!Array.isArray(parsed)) {
      res.status(500).json({ error: "Unexpected analysis output format." });
      return;
    }

    res.json({
      total_packets: parsed.length,
      features: parsed,
    });
  } catch (err: any) {
    if (err.stdout) {
      try {
        const errorOutput = JSON.parse(err.stdout);
        if (errorOutput.error) {
          res.status(400).json({ error: errorOutput.error });
          return;
        }
      } catch {
        // stdout wasn't valid JSON, fall through
      }
    }

    if (err.killed) {
      res.status(504).json({ error: "Analysis timed out. The file may be too large." });
      return;
    }

    console.error("Analysis error:", err.message);
    res.status(500).json({ error: "Analysis failed. Please ensure the file is a valid packet capture." });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
