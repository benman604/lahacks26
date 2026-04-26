import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ message: 'Hello from Next.js!' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dataUrl = body?.dataUrl;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return NextResponse.json({ error: 'missing dataUrl' }, { status: 400 });
    }

    const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) {
      return NextResponse.json({ error: 'invalid dataUrl' }, { status: 400 });
    }

    const mime = m[1];
    const b64 = m[2];
    const ext = mime.split('/')[1] || 'png';
    const buffer = Buffer.from(b64, 'base64');

    const filename = `screenshot-${Date.now()}.${ext}`;
    const outPath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(outPath, buffer);

    // open the file on the host
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${opener} "${outPath}"`, (err) => {
      if (err) console.error('failed to open image', err);
    });

    return NextResponse.json({ ok: true, path: outPath });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('POST /api/image failed', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
