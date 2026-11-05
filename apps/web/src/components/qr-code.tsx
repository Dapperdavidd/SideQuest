import QRCode from "qrcode";

type QrCodeProps = {
  value: string;
  size?: number;
  label: string;
  className?: string;
};

/** Server-rendered QR code (error correction level M) as inline SVG. */
export async function QrCode({ value, size = 160, label, className = "" }: QrCodeProps) {
  const svg = await QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#111111", light: "#ffffff" } });
  return (
    <span role="img" aria-label={label} className={`block bg-white [&>svg]:h-full [&>svg]:w-full ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
