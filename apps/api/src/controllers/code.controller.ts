import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../middleware/error';

// Wandbox API — free, no API key required
const WANDBOX_URL = 'https://wandbox.org/api/compile.json';

// Map language names to Wandbox compiler identifiers
const COMPILER_MAP: Record<string, { compiler: string; filename: string }> = {
  javascript: { compiler: 'nodejs-20.17.0', filename: 'main.js' },
  typescript: { compiler: 'typescript-5.6.2', filename: 'main.ts' },
  python: { compiler: 'cpython-3.14.0', filename: 'main.py' },
  java: { compiler: 'openjdk-jdk-22+36', filename: 'Main.java' },
  cpp: { compiler: 'gcc-13.2.0', filename: 'main.cpp' },
  c: { compiler: 'gcc-13.2.0-c', filename: 'main.c' },
  go: { compiler: 'go-1.23.2', filename: 'main.go' },
  rust: { compiler: 'rust-1.81.0', filename: 'main.rs' },
};

// ===== POST /code/submit — Submit code for execution =====
export async function submitCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { sourceCode, language, stdin } = req.body as {
      sourceCode: string;
      language: string;
      stdin?: string;
    };

    if (!sourceCode?.trim()) throw ApiError.badRequest('Source code is required');
    if (!language || !COMPILER_MAP[language]) {
      throw ApiError.badRequest('Unsupported language');
    }

    const { compiler } = COMPILER_MAP[language];

    const wandboxRes = await fetch(WANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: sourceCode,
        compiler,
        stdin: stdin || '',
        'compiler-option-raw': '',
        'runtime-option-raw': '',
        save: false,
      }),
    });

    if (!wandboxRes.ok) {
      const text = await wandboxRes.text().catch(() => 'Unknown error');
      throw ApiError.badRequest(`Code execution service error: ${wandboxRes.status} ${text}`);
    }

    const result = (await wandboxRes.json()) as any;

    // Wandbox response fields:
    //   status: exit code (0 = success)
    //   signal: signal name if killed
    //   compiler_output / compiler_error / compiler_message
    //   program_output / program_error / program_message

    const exitCode = Number(result.status ?? -1);
    const isSuccess = exitCode === 0 && !result.signal;

    let statusDesc = 'Unknown';
    if (result.signal) {
      statusDesc = `Runtime Error (${result.signal})`;
    } else if (result.compiler_error) {
      statusDesc = 'Compilation Error';
    } else if (isSuccess) {
      statusDesc = 'Accepted';
    } else {
      statusDesc = `Runtime Error (exit code ${exitCode})`;
    }

    res.json({
      token: '', // Wandbox is synchronous, no token needed
      status: statusDesc,
      stdout: result.program_output || '',
      stderr: result.program_error || '',
      compileOutput: result.compiler_message || result.compiler_output || '',
      time: null,
      memory: null,
    });
  } catch (error) {
    next(error);
  }
}

// ===== GET /code/status/:token — Poll for execution results =====
// Wandbox is synchronous so this just returns a completed status
export async function getSubmissionStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    // With Wandbox, results are returned synchronously in submitCode.
    // This endpoint is kept for API compatibility.
    res.json({
      token: req.params.token || '',
      status: 'Completed',
      stdout: '',
      stderr: '',
      compileOutput: '',
      time: null,
      memory: null,
    });
  } catch (error) {
    next(error);
  }
}

// ===== GET /code/languages — List available languages =====
export async function getLanguages(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({
      languages: Object.entries(COMPILER_MAP).map(([name, { compiler }]) => ({
        name,
        id: compiler,
      })),
    });
  } catch (error) {
    next(error);
  }
}
