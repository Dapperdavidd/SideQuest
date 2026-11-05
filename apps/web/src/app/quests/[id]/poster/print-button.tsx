"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="sq-btn sq-btn-lime print:hidden"><Printer size={17} aria-hidden="true" />Print or save as PDF</button>;
}
