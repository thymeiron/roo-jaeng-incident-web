"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PageSizeSelect({ value }: { value: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updatePageSize(pageSize: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.set("page_size", pageSize);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: 700 }}>
      Rows per page
      <select
        aria-label="Tickets per page"
        value={value}
        onChange={(event) => updatePageSize(event.target.value)}
        style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a" }}
      >
        <option value="50">50</option>
        <option value="100">100</option>
        <option value="200">200</option>
      </select>
    </label>
  );
}
