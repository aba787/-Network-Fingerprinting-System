import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

export interface PacketFeature {
  src_ip: string;
  dst_ip: string;
  packet_size: number;
  ttl: number;
  protocol: number;
  time_delta: number;
}

export interface DeviceFingerprint {
  ip: string;
  packet_count: number;
  avg_packet_size: number;
  std_packet_size: number;
  avg_ttl: number;
  std_ttl: number;
  avg_time_delta: number;
  std_time_delta: number;
  protocol_distribution: Record<string, number>;
  unique_destinations: number;
}

export interface PcapAnalysisResult {
  features: PacketFeature[];
  fingerprints: DeviceFingerprint[];
}

interface PythonErrorOutput {
  error: string;
}

export interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  killed?: boolean;
  code?: number | null;
}

function isPythonErrorOutput(value: unknown): value is PythonErrorOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as PythonErrorOutput).error === "string"
  );
}

function isPcapAnalysisResult(value: unknown): value is PcapAnalysisResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "features" in value &&
    Array.isArray((value as PcapAnalysisResult).features) &&
    "fingerprints" in value &&
    Array.isArray((value as PcapAnalysisResult).fingerprints)
  );
}

function resolveScriptPath(): string {
  const candidates: string[] = [];

  if (typeof import.meta.dirname === "string") {
    candidates.push(
      path.resolve(import.meta.dirname, "..", "..", "scripts", "analyze_pcap.py"),
      path.resolve(import.meta.dirname, "..", "scripts", "analyze_pcap.py"),
    );
  }

  if (typeof __dirname === "string") {
    candidates.push(
      path.resolve(__dirname, "scripts", "analyze_pcap.py"),
      path.resolve(__dirname, "..", "scripts", "analyze_pcap.py"),
    );
  }

  candidates.push(
    path.resolve(process.cwd(), "artifacts", "api-server", "scripts", "analyze_pcap.py"),
    path.resolve(process.cwd(), "scripts", "analyze_pcap.py"),
  );

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export const SCRIPT_PATH = resolveScriptPath();

export async function runPcapAnalysis(filePath: string): Promise<PcapAnalysisResult> {
  const { stdout, stderr } = await execFileAsync("python3", [SCRIPT_PATH, filePath], {
    timeout: 60000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (stderr) {
    console.error("Python stderr:", stderr);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Failed to parse analysis output.");
  }

  if (isPythonErrorOutput(parsed)) {
    throw Object.assign(new Error(parsed.error), { isUserError: true });
  }

  if (!isPcapAnalysisResult(parsed)) {
    throw new Error("Unexpected analysis output format.");
  }

  return parsed;
}
