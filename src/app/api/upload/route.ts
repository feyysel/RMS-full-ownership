import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    if (file.size > 4 * 1024 * 1024)
      return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 });

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const allowed = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
    if (!allowed.includes(ext))
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      console.log("[upload] using vercel blob");
      const blob = await put(`uploads/${randomUUID()}.${ext}`, buffer, {
        access: "public",
        contentType: file.type || undefined,
      });
      return NextResponse.json({ url: blob.url });
    }

    console.log("[upload] no BLOB_READ_WRITE_TOKEN, falling back to local disk");

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("upload error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
