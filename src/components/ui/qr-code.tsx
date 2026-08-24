"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Skeleton } from "@/components/ui/skeleton";

export function QrCode({
  url,
  size = 168,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      margin: 1,
      width: size,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0b", light: "#ffffff" },
    })
      .then((data) => alive && setSrc(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url, size]);

  if (!src) return <Skeleton className={className} style={{ width: size, height: size }} />;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR code" className={className} />;
}
