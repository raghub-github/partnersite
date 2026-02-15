"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronRight, Download, FileText, Loader2 } from "lucide-react";

export interface ContractData {
  storeName: string;
  parentName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  effectiveDate: string;
  contactPerson: string;
  bank?: {
    account_holder_name: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_type: string;
  };
}

const ANNEXURE_B_HEADERS = ["Beneficiary Name", "Bank Name", "Account Number", "IFSC Code", "Account Type"] as const;

/** Commission: first month 0%; thereafter 15% + GST (as per commercial terms). */
export const COMMISSION_FIRST_MONTH_PERCENT = 0;
export const COMMISSION_FROM_SECOND_MONTH_PERCENT = 15;

export interface StructuredContract {
  intro: { effectiveDate: string; storeName: string; ownerName: string; address: string; contactPerson: string; phone: string; email: string };
  definitions: { term: string; meaning: string }[];
  sections: { title: string; bullets?: string[]; paragraphs?: string[] }[];
  annexureA: { description: string; table: { headers: string[]; rows: string[][] } };
  annexureB: { headers: readonly string[]; rows: string[][] };
  certification: string;
  termsBody: string;
}

function buildStructuredContract(data: ContractData, termsBody: string): StructuredContract {
  const {
    storeName,
    ownerName,
    email,
    phone,
    address,
    effectiveDate,
    contactPerson,
    bank,
  } = data;

  const intro = {
    effectiveDate,
    storeName: storeName || "—",
    ownerName: ownerName || "—",
    address: address || "—",
    contactPerson: contactPerson || ownerName || "—",
    phone: phone || "—",
    email: email || "—",
  };

  const definitions: { term: string; meaning: string }[] = [
    { term: "Platform", meaning: "The food ordering and delivery platform operated by the Company, including its website, mobile applications, and associated services." },
    { term: "Restaurant Partner", meaning: "The legal entity (restaurant/outlet) that has agreed to list its menu and fulfil Orders through the Platform, as identified in this Form." },
    { term: "Customer", meaning: "An end-user who places an Order for food and/or beverages through the Platform." },
    { term: "Order", meaning: "A request placed by a Customer through the Platform for food and/or beverages to be supplied by the Restaurant Partner." },
    { term: "Order Value", meaning: "The amount payable by the Customer for an Order (including food, beverages, packaging, and applicable taxes), as received by the Platform." },
    { term: "Charges", meaning: "The commission and other fees payable by the Restaurant Partner to the Platform as set out in Annexure A and the Terms." },
    { term: "Services", meaning: "The services provided by the Platform to the Restaurant Partner as described in this Form and the Terms." },
    { term: "Terms", meaning: "The Terms and Conditions for food ordering and delivery services, as amended from time to time, and which are incorporated by reference into this Form." },
  ];

  const sections = [
    {
      title: "I. Services",
      bullets: [
        "Order placement and catalog hosting: The Platform provides the order placement mechanism for Customers to place Orders with the Restaurant Partners on a real-time basis and hosts the menu and price lists as provided by the Restaurant Partners.",
        "Demand generation and marketing: The Platform helps bring new Customers to Restaurant Partners through targeted marketing, discovery, and a seamless food ordering experience.",
        "Logistics: The Platform enables a reliable delivery ecosystem for fulfilling the Restaurant Partner's Orders.",
        "Support: A support team is available to help resolve issues for Customers and Restaurant Partners.",
        "Technology: The Platform builds and supports products including payment and order management infrastructure.",
      ],
    },
    {
      title: "II. Charges",
      paragraphs: [
        "For the Services above, the Restaurant Partner shall pay the applicable Charges as set out in Annexure A and the Terms. All amounts are subject to applicable taxes (including GST). The Platform shall raise tax invoices as per applicable law.",
      ],
    },
    {
      title: "III. Payment Settlement",
      paragraphs: [
        "The Platform shall transfer the Order Value received to the Restaurant Partner, after deduction of Charges, on a weekly basis. Settlement shall be made to the bank account details provided in Annexure B. The payment settlement day for Orders serviced from Monday to Sunday shall be on or before Thursday of the following week. If the settlement day falls on a bank holiday, it shall be the next working day.",
      ],
    },
    {
      title: "IV. Additional Terms",
      bullets: [
        "The Restaurant Partner shall not charge the Customer for anything other than food, beverages, and packaging on the Platform.",
        "The Restaurant Partner will maintain equal or lower prices for products on the Platform as compared to its direct channels.",
        "The Restaurant Partner will not send marketing material with Orders that discourages Customers from ordering via the Platform.",
        "This Form and its annexures, together with the Terms, constitute the entire agreement between the Parties and are legally binding.",
      ],
    },
    {
      title: "Declaration",
      paragraphs: [
        "I/We have read and understood this Form and the Terms. I/We accept and agree to be bound by the Terms. I/We represent and warrant that I/we are duly authorized to sign this Form on behalf of the Restaurant Partner.",
      ],
    },
  ];

  const annexureA = {
    description: "Commission and charges payable by the Restaurant Partner to the Platform for food ordering and delivery services:",
    table: {
      headers: ["Period", "Commission (on Order Value)", "Remarks"],
      rows: [
        ["First month from Go-Live", "0%", "No commission for the first calendar month from the date the restaurant goes live on the Platform."],
        ["From second month onwards", "15% + GST", "Fifteen per cent (15%) of the Order Value plus applicable GST. Subject to commercial terms communicated from time to time."],
      ],
    },
  };

  const annexureB = bank
    ? {
        headers: ANNEXURE_B_HEADERS,
        rows: [
          [
            bank.account_holder_name || "—",
            bank.bank_name || "—",
            bank.account_number || "—",
            bank.ifsc_code || "—",
            (bank.account_type || "SAVINGS").toUpperCase(),
          ],
        ],
      }
    : { headers: ANNEXURE_B_HEADERS, rows: [] };

  const certification =
    "I/We hereby certify that the details provided above are correct, that the bank account is an account legally opened and maintained by me/our organization, and that I/we shall be liable to the maximum extent possible under applicable law in the event any details provided above are found to be incorrect.";

  return { intro, definitions, sections, annexureA, annexureB, certification, termsBody };
}

function buildContractText(data: ContractData, termsBody: string): string {
  const structured = buildStructuredContract(data, termsBody);
  const { intro, definitions, sections, annexureA, annexureB, certification } = structured;
  const lines: string[] = [
    "RESTAURANT PARTNER ENROLMENT FORM (\"FORM\") FOR FOOD ORDERING AND DELIVERY SERVICES",
    "",
    `Effective Date: ${intro.effectiveDate}`,
    `Restaurant Name: ${intro.storeName}`,
    `Legal Entity Name ("Restaurant Partner"): ${intro.ownerName}`,
    `Legal Entity Address: ${intro.address}`,
    `Contact Person: ${intro.contactPerson}`,
    `Phone: ${intro.phone}`,
    `Email ID: ${intro.email}`,
    "",
    "Definitions",
    ...definitions.map((d) => `${d.term}: ${d.meaning}`),
    "",
  ];
  sections.forEach((sec) => {
    lines.push(sec.title + ":");
    if (sec.bullets) sec.bullets.forEach((b) => lines.push("• " + b));
    if (sec.paragraphs) sec.paragraphs.forEach((p) => lines.push(p));
    lines.push("");
  });
  lines.push("Annexure A - " + annexureA.description);
  lines.push(annexureA.table.headers.join(" | "));
  annexureA.table.rows.forEach((row) => lines.push(row.join(" | ")));
  lines.push("");
  lines.push("Annexure B - Bank Details");
  lines.push(annexureB.headers.join(" | "));
  annexureB.rows.forEach((row) => lines.push(row.join(" | ")));
  if (annexureB.rows.length === 0) lines.push("To be provided or as per application.");
  lines.push("");
  lines.push(certification);
  lines.push("");
  lines.push("---");
  lines.push(termsBody);
  return lines.join("\n");
}

interface AgreementContractPageProps {
  step1: any;
  step2: any;
  documents: any;
  parentInfo: any;
  termsContent: string;
  /** Optional URL for platform/company logo to embed in the PDF (e.g. from public folder or CDN). */
  logoUrl?: string | null;
  onBack: () => void;
  onContinue: (contractText: string) => void;
  actionLoading?: boolean;
}

export default function AgreementContractPage({
  step1,
  step2,
  documents,
  parentInfo,
  termsContent,
  logoUrl,
  onBack,
  onContinue,
  actionLoading = false,
}: AgreementContractPageProps) {
  const [agreedToRead, setAgreedToRead] = useState(false);
  const [contractText, setContractText] = useState("");
  const [structured, setStructured] = useState<StructuredContract | null>(null);

  const contractData: ContractData = {
    storeName: step1?.store_name || "—",
    parentName: parentInfo?.name ?? step1?.parent_merchant_id ?? "—",
    ownerName: step1?.owner_full_name || "—",
    email: step1?.store_email || "—",
    phone: step1?.store_phones?.[0] || "—",
    address: step2?.full_address || "—",
    effectiveDate: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    contactPerson: step1?.owner_full_name || "—",
    bank: documents?.bank
      ? {
          account_holder_name: documents.bank.account_holder_name || "",
          bank_name: documents.bank.bank_name || "",
          account_number: documents.bank.account_number || "",
          ifsc_code: documents.bank.ifsc_code || "",
          account_type: documents.bank.account_type || "savings",
        }
      : undefined,
  };

  useEffect(() => {
    const s = buildStructuredContract(contractData, termsContent);
    setStructured(s);
    setContractText(buildContractText(contractData, termsContent));
  }, [step1, step2, documents, parentInfo, termsContent]);

  const handleDownloadPdf = useCallback(async () => {
    if (!structured) return;
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      let y = margin;
      const lineH = 5.5;
      const smallH = 5;
      const headH = 7;

      const checkNewPage = (need: number) => {
        if (y + need > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      let logoSrc = "";
      if (typeof logoUrl === "string" && logoUrl.trim()) {
        if (logoUrl.startsWith("http") || logoUrl.startsWith("data:")) {
          logoSrc = logoUrl;
        } else if (typeof window !== "undefined") {
          logoSrc = window.location.origin + (logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl);
        }
      }
      if (logoSrc) {
        try {
          doc.addImage(logoSrc, "PNG", margin, y, 35, 12);
          y += 16;
        } catch {
          y += 2;
        }
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RESTAURANT PARTNER ENROLMENT FORM", margin, y);
      doc.text("(\"FORM\") FOR FOOD ORDERING AND DELIVERY SERVICES", margin, y + 6);
      y += 14;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const introLines = [
        `Effective Date: ${structured.intro.effectiveDate}`,
        `Restaurant Name: ${structured.intro.storeName}`,
        `Legal Entity Name ("Restaurant Partner"): ${structured.intro.ownerName}`,
        `Legal Entity Address: ${structured.intro.address}`,
        `Contact Person: ${structured.intro.contactPerson}`,
        `Phone: ${structured.intro.phone}`,
        `Email ID: ${structured.intro.email}`,
      ];
      introLines.forEach((line) => {
        checkNewPage(lineH);
        doc.text(line, margin, y);
        y += lineH;
      });
      y += 4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Definitions", margin, y);
      y += headH;
      doc.setFont("helvetica", "normal");
      structured.definitions.forEach((d) => {
        const defLine = d.term + ": " + d.meaning;
        const wrapped = doc.splitTextToSize(defLine, pageW - margin * 2 - 2);
        wrapped.forEach((line: string) => {
          checkNewPage(smallH);
          doc.text(line, margin + 2, y);
          y += smallH;
        });
        y += 1;
      });
      y += 3;

      structured.sections.forEach((sec) => {
        checkNewPage(headH + 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(sec.title, margin, y);
        y += headH;
        doc.setFont("helvetica", "normal");
        if (sec.bullets) {
          sec.bullets.forEach((b) => {
            const wrapped = doc.splitTextToSize("• " + b, pageW - margin * 2 - 4);
            wrapped.forEach((line: string) => {
              checkNewPage(smallH);
              doc.text(line, margin + 4, y);
              y += smallH;
            });
          });
        }
        if (sec.paragraphs) {
          sec.paragraphs.forEach((p) => {
            const wrapped = doc.splitTextToSize(p, pageW - margin * 2);
            wrapped.forEach((line: string) => {
              checkNewPage(smallH);
              doc.text(line, margin, y);
              y += smallH;
            });
          });
        }
        y += 2;
      });

      checkNewPage(headH + 20);
      doc.setFont("helvetica", "bold");
      doc.text("Annexure A - Commission and Charges", margin, y);
      y += headH;
      doc.setFont("helvetica", "normal");
      doc.text(structured.annexureA.description, margin, y);
      y += lineH + 2;
      const aHeaders = structured.annexureA.table.headers;
      const aRows = structured.annexureA.table.rows;
      const aColCount = aHeaders.length;
      const aColW = (pageW - margin * 2) / aColCount;
      const aRowH = 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let x = margin;
      aHeaders.forEach((h) => {
        doc.rect(x, y - 4, aColW, aRowH);
        doc.text(h, x + 2, y + 0.5);
        x += aColW;
      });
      y += aRowH;
      doc.setFont("helvetica", "normal");
      aRows.forEach((row) => {
        checkNewPage(aRowH);
        x = margin;
        row.forEach((cell) => {
          doc.rect(x, y - 4, aColW, aRowH);
          const text = doc.splitTextToSize(cell, aColW - 4);
          doc.text(text[0] || "—", x + 2, y + 0.5);
          x += aColW;
        });
        y += aRowH;
      });
      y += 4;

      checkNewPage(headH + 15);
      doc.setFont("helvetica", "bold");
      doc.text("Annexure B - Bank Details", margin, y);
      y += headH;

      const tableHeaders = structured.annexureB.headers as string[];
      const tableRows = structured.annexureB.rows;
      const colCount = tableHeaders.length;
      const colW = (pageW - margin * 2) / colCount;
      const rowH = 7;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      x = margin;
      tableHeaders.forEach((h) => {
        doc.rect(x, y - 4, colW, rowH);
        doc.text(h, x + 2, y + 0.5);
        x += colW;
      });
      y += rowH;
      doc.setFont("helvetica", "normal");
      tableRows.forEach((row) => {
        checkNewPage(rowH);
        x = margin;
        row.forEach((cell) => {
          doc.rect(x, y - 4, colW, rowH);
          const text = doc.splitTextToSize(cell, colW - 4);
          doc.text(text[0] || "—", x + 2, y + 0.5);
          x += colW;
        });
        y += rowH;
      });
      if (tableRows.length === 0) {
        doc.rect(margin, y - 4, pageW - margin * 2, rowH);
        doc.text("To be provided or as per application.", margin + 2, y + 0.5);
        y += rowH;
      }
      y += 4;

      checkNewPage(12);
      doc.setFont("helvetica", "italic");
      const certLines = doc.splitTextToSize(structured.certification, pageW - margin * 2);
      certLines.forEach((line: string) => {
        checkNewPage(smallH);
        doc.text(line, margin, y);
        y += smallH;
      });
      y += 4;

      doc.setFont("helvetica", "normal");
      const termsLines = doc.splitTextToSize(structured.termsBody, pageW - margin * 2);
      termsLines.slice(0, 80).forEach((line: string) => {
        checkNewPage(smallH);
        doc.text(line, margin, y);
        y += smallH;
      });

      const filename = `partner-agreement-${(step1?.store_name || "store").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("PDF download failed:", err);
      const blob = new Blob([contractText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `partner-agreement-${step1?.store_name || "store"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [structured, contractText, step1?.store_name, logoUrl]);

  const canContinue = agreedToRead;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-2 py-1.5 sm:px-4 sm:py-2 shrink-0 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs sm:text-sm font-medium transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-w-4xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-col">
        <div className="mb-2 sm:mb-3 shrink-0">
          <h1 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
            Partner Agreement & Contract
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Merchant Partner Agreement — Version v1. Please read the entire contract below. Your store name and details are included.
          </p>
        </div>

        <article className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-4 pb-28 sm:pb-32 hide-scrollbar">
            {structured ? (
              <div className="space-y-3 sm:space-y-4 text-slate-800 text-sm font-[family-name:var(--font-geist-sans)]">
                <header className="border-b border-slate-100 pb-2 sm:pb-3">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                    Restaurant Partner Enrolment Form (&quot;Form&quot;) for Food Ordering and Delivery Services
                  </h2>
                  <dl className="mt-2 sm:mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1 sm:gap-y-1.5 text-xs sm:text-sm">
                    <div><dt className="text-slate-500 font-medium">Effective Date</dt><dd className="font-medium text-slate-900">{structured.intro.effectiveDate}</dd></div>
                    <div><dt className="text-slate-500 font-medium">Restaurant Name</dt><dd className="font-medium text-slate-900">{structured.intro.storeName}</dd></div>
                    <div><dt className="text-slate-500 font-medium">Legal Entity Name (Restaurant Partner)</dt><dd className="font-medium text-slate-900">{structured.intro.ownerName}</dd></div>
                    <div><dt className="text-slate-500 font-medium">Legal Entity Address</dt><dd className="font-medium text-slate-900">{structured.intro.address}</dd></div>
                    <div><dt className="text-slate-500 font-medium">Contact Person</dt><dd className="font-medium text-slate-900">{structured.intro.contactPerson}</dd></div>
                    <div><dt className="text-slate-500 font-medium">Phone</dt><dd className="font-medium text-slate-900">{structured.intro.phone}</dd></div>
                    <div><dt className="text-slate-500 font-medium">Email ID</dt><dd className="font-medium text-slate-900">{structured.intro.email}</dd></div>
                  </dl>
                </header>

                <section>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Definitions</h3>
                  <dl className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
                    {structured.definitions.map((d, i) => (
                      <div key={i}>
                        <dt className="font-semibold text-slate-800">{d.term}</dt>
                        <dd className="text-slate-600 pl-2 mt-0.5">{d.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {structured.sections.map((sec, idx) => (
                  <section key={idx}>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">{sec.title}</h3>
                    {sec.bullets && (
                      <ul className="list-disc pl-4 sm:pl-5 space-y-0.5 sm:space-y-1 text-xs sm:text-sm leading-snug sm:leading-relaxed">
                        {sec.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {sec.paragraphs && (
                      <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm leading-snug sm:leading-relaxed">
                        {sec.paragraphs.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                <section>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1.5 sm:mb-2">Annexure A — Commission and Charges</h3>
                  <p className="text-xs sm:text-sm leading-snug sm:leading-relaxed text-slate-700 mb-2 sm:mb-3">{structured.annexureA.description}</p>
                  <div className="overflow-x-auto -mx-1 sm:mx-0 rounded-lg sm:rounded-xl border border-slate-200">
                    <table className="w-full min-w-[260px] sm:min-w-[400px] text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {structured.annexureA.table.headers.map((h, i) => (
                            <th key={i} className="text-left font-semibold text-slate-700 px-2 sm:px-4 py-1.5 sm:py-2 border-r border-slate-200 last:border-r-0 break-words">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {structured.annexureA.table.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-slate-100">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 sm:px-4 py-1.5 sm:py-2 border-r border-slate-100 last:border-r-0 text-slate-800 break-words">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1.5 sm:mb-2">Annexure B — Bank Details</h3>
                  <div className="overflow-x-auto -mx-1 sm:mx-0 rounded-lg sm:rounded-xl border border-slate-200">
                    <table className="w-full min-w-[280px] sm:min-w-[520px] text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {structured.annexureB.headers.map((h, i) => (
                            <th key={i} className="text-left font-semibold text-slate-700 px-2 sm:px-4 py-1.5 sm:py-2 border-r border-slate-200 last:border-r-0 break-words">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {structured.annexureB.rows.length > 0 ? (
                          structured.annexureB.rows.map((row, ri) => (
                            <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50/50">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-2 sm:px-4 py-1.5 sm:py-2 border-r border-slate-100 last:border-r-0 text-slate-800 break-words">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={structured.annexureB.headers.length} className="px-2 sm:px-4 py-1.5 sm:py-2 text-slate-500 italic">
                              To be provided or as per application.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-snug sm:leading-relaxed text-slate-600 italic border-l-4 border-indigo-200 pl-3 sm:pl-4 py-0.5">
                    {structured.certification}
                  </p>
                </section>

                <section className="pt-1.5 border-t border-slate-100">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Terms and Conditions</h3>
                  <div className="text-xs sm:text-sm leading-snug sm:leading-relaxed text-slate-600 whitespace-pre-line">
                    {structured.termsBody}
                  </div>
                </section>
              </div>
            ) : (
              <p className="text-slate-500">Loading contract...</p>
            )}
          </div>
        </article>
      </div>

      {/* Checkbox + Navigation - Fixed bottom; left offset so sidebar Help button does not overlap */}
      <div
        className="fixed bottom-0 left-14 sm:left-[13rem] md:left-56 lg:left-60 right-0 z-20 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] py-2 sm:py-3 px-2 sm:px-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        <div className="max-w-4xl mx-auto space-y-2">
          <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group w-full">
            <input
              type="checkbox"
              checked={agreedToRead}
              onChange={(e) => setAgreedToRead(e.target.checked)}
              className="mt-0.5 h-4 w-4 min-w-[1rem] rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
              aria-label="I agree to the contract and terms"
            />
            <span className="text-xs sm:text-sm text-slate-700 group-hover:text-slate-900 leading-snug">
              I have read the entire contract and agreement details above. I understand the terms, charges, payment settlement process, and bank details. I am ready to proceed to digital signature.
            </span>
          </label>
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={actionLoading}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium text-xs sm:text-base px-3 py-2 sm:px-5 sm:py-2.5 border border-slate-300 rounded-lg sm:rounded-xl hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-spin" /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 rotate-180" />}
              Back
            </button>
            <button
              type="button"
              onClick={() => onContinue(contractText)}
              disabled={!canContinue || actionLoading}
              className="px-4 py-2.5 sm:px-8 sm:py-3 bg-indigo-600 text-white font-semibold text-sm sm:text-base rounded-lg sm:rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-200 transition"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {actionLoading ? 'Loading...' : 'Continue to Digital Signature'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { buildContractText, buildStructuredContract };
