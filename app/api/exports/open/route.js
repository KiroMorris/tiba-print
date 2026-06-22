import { exec } from 'node:child_process';
import { EXPORTS_DIR } from '@/lib/db';

export const runtime = 'nodejs';

// Reveal the exports folder in the OS file manager (local app convenience).
export async function POST() {
  const cmd =
    process.platform === 'darwin'
      ? `open "${EXPORTS_DIR}"`
      : process.platform === 'win32'
      ? `explorer "${EXPORTS_DIR}"`
      : `xdg-open "${EXPORTS_DIR}"`;
  return new Promise((resolve) => {
    exec(cmd, (err) => {
      resolve(Response.json({ ok: !err, dir: EXPORTS_DIR, error: err ? String(err) : null }));
    });
  });
}
