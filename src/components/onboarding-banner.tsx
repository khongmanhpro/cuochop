"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cuochop_onboarding_dismissed_v1";

export function OnboardingBanner({
  hasMeetings,
}: {
  hasMeetings: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasMeetings) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore
    }
    setVisible(true);
  }, [hasMeetings]);

  if (!visible || hasMeetings) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <section className="rounded-xl border border-brand-coral/40 bg-canvas p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
            Bắt đầu nhanh
          </p>
          <h2 className="mt-2 text-[24px] font-semibold text-ink">
            3 bước để có việc sau họp
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-[1.50] text-slate">
            <li>Upload file ghi âm (MP3/MP4/WAV/M4A) hoặc dùng file demo.</li>
            <li>Tạo notes → rà soát action AI, bỏ việc ảo.</li>
            <li>Theo dõi trên Action Board (Việc của tôi) đến khi xong.</li>
          </ol>
          <p className="mt-4 text-[14px] text-steel">
            File audio chỉ lưu tạm trên máy chủ của bạn để phiên âm; notes và
            action lưu trong database local. Chi tiết tại Account → Quyền riêng
            tư.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <a href="#new-meeting" className="button-primary h-11 px-5 text-center">
            Tạo notes đầu tiên
          </a>
          <a
            href="/demo/sample.mp3"
            download
            className="button-tertiary h-11 px-5 text-center"
          >
            Tải file demo (.mp3)
          </a>
          <Link
            href="/settings/account"
            className="button-tertiary h-11 px-5 text-center"
          >
            Backup & quyền riêng tư
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="text-[14px] font-medium text-steel hover:text-ink"
          >
            Ẩn hướng dẫn
          </button>
        </div>
      </div>
    </section>
  );
}
