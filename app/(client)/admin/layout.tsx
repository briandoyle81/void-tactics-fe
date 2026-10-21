import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ops Console",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
