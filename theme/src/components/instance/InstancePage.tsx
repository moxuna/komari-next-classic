"use client";

import { useEffect, useMemo, useState } from "react";
import { Cpu, MemoryStick, HardDrive, Wifi, ArrowUp, ArrowDown, Activity, ShieldCheck } from "lucide-react";
import { useLiveData } from "@/contexts/LiveDataContext";
import { useTranslation } from "react-i18next";
import type { Record } from "@/types/LiveData";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { useNodeList } from "@/contexts/NodeListContext";
import { liveDataToRecords } from "@/utils/RecordHelper";
import NetworkQualityPanel from "./NetworkQualityPanel";
import StatusCharts from "./StatusCharts";


interface InstancePageProps {
  uuid: string;
}

function getDtOsSlug(os: string): string | null {
  const s = String(os || "").toLowerCase();
  const map: { slug: string; keywords: string[] }[] = [
    { slug: "ubuntu", keywords: ["ubuntu"] },
    { slug: "debian", keywords: ["debian"] },
    { slug: "redhat", keywords: ["red hat", "redhat", "rhel"] },
    { slug: "centos", keywords: ["centos"] },
    { slug: "fedora", keywords: ["fedora"] },
    { slug: "opensuse", keywords: ["opensuse", "suse"] },
    { slug: "archlinux", keywords: ["arch linux", "arch"] },
    { slug: "alpinelinux", keywords: ["alpine linux", "alpine"] },
    { slug: "rockylinux", keywords: ["rocky linux", "rocky"] },
    { slug: "almalinux", keywords: ["alma linux", "alma"] },
    { slug: "linuxmint", keywords: ["linux mint", "mint"] },
    { slug: "freebsd", keywords: ["freebsd"] },
    { slug: "openbsd", keywords: ["openbsd"] },
    { slug: "windows", keywords: ["windows server", "windows"] },
    { slug: "apple", keywords: ["darwin", "macos", "mac", "osx", "apple"] },
    { slug: "android", keywords: ["android"] },
    { slug: "docker", keywords: ["docker"] },
    { slug: "linux", keywords: ["linux"] },
  ];
  for (const item of map) {
    if (item.keywords.some(k => s.includes(k))) return item.slug;
  }
  return null;
}

/**
 * 清洗 CPU 名称里的噪声词、保留型号数字（详情页展示用）。
 * 与首页卡片的 shortenCpuName 策略不同：首页要短（取前两词），详情页要全，
 * 因此这里不限制词数，超长部分交给 CSS ellipsis，完整原文放进 title。
 */
function cleanCpuName(raw?: string | null): string {
  const source = String(raw || "");
  if (!source.trim()) return "";
  return source
    .replace(/\((?:r|tm|c)\)/gi, " ")                    // Intel(R) / (TM)
    .replace(/(?:\bcpu\s*)?@\s*[\d.]+\s*GHz\b/gi, " ")   // CPU @ 2.50GHz / @ 2.40GHz
    .replace(/\b[\d.]+\s*GHz\b/gi, " ")                   // 残留的 2.50GHz
    .replace(/\b\d+\s*[- ]?\s*cores?\b/gi, " ")           // 64-Core / 16 Cores
    .replace(/\bcpu\b/gi, " ")                            // 与型号隔开的独立 CPU 字样
    .replace(/\bprocessors?\b/gi, " ")                    // Processor
    .replace(/\s+/g, " ")
    .trim();
}

function getDtOsIconUrl(os: string): string | null {
  const slug = getDtOsSlug(os);
  return slug ? `/img/os-logos/streamline/${slug}.svg` : null;
}

export default function InstancePage({ uuid }: InstancePageProps) {
  const { t } = useTranslation();
  const { onRefresh, live_data } = useLiveData();
  const [recent, setRecent] = useState<Record[]>([]);
  const { nodeList } = useNodeList();
  const length = 30 * 5;
  const [chartView, setChartView] = useState<"status" | "quality">("status");
  
  // Find the node
  const node = nodeList?.find((n) => n.uuid === uuid);
  const latest = recent.length > 0 ? recent[recent.length - 1] : undefined;
  const isOnline = !!live_data?.data?.online?.includes(uuid);

  // 「处理器」卡片补充信息：型号 · 核数 · 架构 / 虚拟化 · 操作系统
  const cpuSpecLine = useMemo(() => {
    const parts = [
      cleanCpuName(node?.cpu_name),
      Number(node?.cpu_cores) > 0 ? `${node?.cpu_cores} 核` : "",
      node?.arch || "",
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "--";
  }, [node?.cpu_name, node?.cpu_cores, node?.arch]);

  const cpuEnvLine = useMemo(
    () => [node?.virtualization, node?.os].filter(Boolean).join(" · "),
    [node?.virtualization, node?.os]
  );

  const cpuEnvHint = useMemo(
    () => [node?.virtualization, node?.os, node?.kernel_version].filter(Boolean).join(" · ") || undefined,
    [node?.virtualization, node?.os, node?.kernel_version]
  );

  // Initial data loading
  useEffect(() => {
    if (!uuid) return;
    
    fetch(`/api/recent/${uuid}`)
      .then((res) => res.json())
      .then((data) => setRecent(data.data.slice(-length)))
      .catch((err) => console.error("Failed to fetch recent data:", err));
  }, [uuid, length]);

  // Dynamic data updates
  useEffect(() => {
    const unsubscribe = onRefresh((resp) => {
      if (!uuid) return;
      const data = resp.data.data[uuid];
      if (!data) return;

      setRecent((prev) => {
        const newRecord: Record = data;
        // Check if record with same timestamp already exists
        const exists = prev.some(
          (item) => item.updated_at === newRecord.updated_at
        );
        if (exists) {
          return prev;
        }

        // Append new record and maintain FIFO with length limit
        const updated = [...prev, newRecord].slice(-length);
        return updated;
      });
    });

    return unsubscribe;
  }, [onRefresh, uuid, length]);

  return (
    <div className="ds-inst flex flex-col items-center gap-6 p-4 w-full max-w-[1400px] mx-auto">
      {/* Header Section */}
      <div className="ds-inst-header w-full">
        <div className="ds-inst-top">
          <div className="ds-inst-top-row">
            <div className="ds-inst-top-left">
              <span className="ds-inst-os">
                {getDtOsIconUrl(node?.os || "") ? <img className="ds-inst-os-img" src={getDtOsIconUrl(node?.os || "")!} alt={node?.os || "os"} /> : null}
              </span>
              <h1 className="ds-inst-name">{node?.name ?? uuid}</h1>
            </div>
            <div className="ds-inst-top-right">
              {node?.ipv4 && <span className="ds-pill">IPv4</span>}
              {node?.ipv6 && <span className="ds-pill">IPv6</span>}
            </div>
          </div>
          <div className="ds-inst-pills">
            <span className="ds-pill">{node?.region ?? ""}</span>
            <span className={`ds-pill ${isOnline ? "ds-pill-ok" : ""}`}>{isOnline ? t("nodeCard.online", "在线") : t("nodeCard.offline", "离线")}</span>
            <span className="ds-pill">{node?.uuid}</span>
          </div>
        </div>
      </div>


      {/* Charts Section */}
      <div className="w-full space-y-6">
        <div className="ds-tabbar w-full">
          <div className="ds-tabbar-inner">
            <SegmentedControl
              value={chartView}
              onValueChange={(value) => setChartView(value as any)}
            >
              <SegmentedControlItem value="status" className="capitalize ds-top-tab-item"><Activity size={15} /><span>{t("status", "状态")}</span></SegmentedControlItem>
              <SegmentedControlItem value="quality" className="capitalize ds-top-tab-item"><ShieldCheck size={15} /><span>{t("netQuality", "网络质量")}</span></SegmentedControlItem>
            </SegmentedControl>
          </div>
        </div>

        {chartView === "status" ? (
          <div className="ds-inst-section">
            
            <div className="ds-inst-section-body">
              <div className="ds-ov-grid">

                <div className="ds-kpi-card">
                  <div className="ds-kpi-left">
                    <div className="ds-kpi-hdr">
                      <span className="ds-kpi-ico"><Cpu size={16} /></span>
                      <span className="ds-kpi-title">处理器</span>
                    </div>
                    <div className="ds-kpi-main">
                      <span className="ds-kpi-big">{latest ? `${latest.cpu.usage.toFixed(2)}%` : "--"}</span>
                      <span className="ds-kpi-sub">利用率</span>
                    </div>
                    <div className="ds-kpi-lines ds-kpi-spec">
                      <div className="ds-kpi-spec-line" title={node?.cpu_name || undefined}>{cpuSpecLine}</div>
                      {cpuEnvLine ? <div className="ds-kpi-spec-line" title={cpuEnvHint}>{cpuEnvLine}</div> : null}
                    </div>
                  </div>
                  <div className="ds-kpi-ring ds-kpi-ring-hover" title={latest ? `CPU 利用率 ${latest.cpu.usage.toFixed(2)}%` : "--"}>
                    <svg viewBox="0 0 36 36" className="ds-ring-svg">
                      <path className="ds-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="ds-ring-fg ds-ring-fg-cpu" strokeDasharray={latest ? `${Math.min(Math.max(latest.cpu.usage,0),100)}, 100` : "0, 100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="ds-ring-center"><div className="ds-ring-center-label">CPU</div></div>
                  </div>
                </div>

                <div className="ds-kpi-card">
                  <div className="ds-kpi-left">
                    <div className="ds-kpi-hdr">
                      <span className="ds-kpi-ico"><MemoryStick size={16} /></span>
                      <span className="ds-kpi-title">内存</span>
                    </div>
                    <div className="ds-kpi-main">
                      <span className="ds-kpi-big">{latest && node ? `${((latest.ram.used/node.mem_total)*100).toFixed(1)}%` : "--"}</span>
                      <div className="ds-kpi-lines">
                        <div>RAM: {latest && node ? `${(latest.ram.used/1024/1024/1024).toFixed(2)} / ${(node.mem_total/1024/1024/1024).toFixed(2)} GB` : "--"}</div>
                        <div>Swap: {latest && node ? `${(latest.swap.used/1024/1024/1024).toFixed(2)} / ${(node.swap_total/1024/1024/1024).toFixed(2)} GB` : "--"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="ds-kpi-ring ds-kpi-ring-dual ds-kpi-ring-hover" title={latest && node ? `RAM ${(((latest.ram.used / node.mem_total) * 100).toFixed(1))}% | Swap ${node.swap_total > 0 ? (((latest.swap.used / node.swap_total) * 100).toFixed(1)) : "0.0"}%` : "--"}>
                    <svg viewBox="0 0 36 36" className="ds-ring-svg">
                      <path className="ds-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="ds-ring-fg ds-ring-fg-ram" strokeDasharray={latest && node ? `${Math.min(Math.max((latest.ram.used/node.mem_total)*100,0),100)}, 100` : "0, 100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    {(node?.swap_total ?? 0) > 0 ? (
                      <svg viewBox="0 0 36 36" className="ds-ring-svg ds-ring-svg-inner">
                        <path className="ds-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="ds-ring-fg ds-ring-fg-swap" strokeDasharray={latest && node ? `${Math.min(Math.max((latest.swap.used/node.swap_total)*100,0),100)}, 100` : "0, 100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                    ) : null}
                    <div className="ds-ring-center"><div className="ds-ring-center-label">RAM</div></div>
                  </div>
                </div>

                <div className="ds-kpi-card">
                  <div className="ds-kpi-left">
                    <div className="ds-kpi-hdr">
                      <span className="ds-kpi-ico"><HardDrive size={16} /></span>
                      <span className="ds-kpi-title">硬盘</span>
                    </div>
                    <div className="ds-kpi-main">
                      <span className="ds-kpi-big">{latest && node ? `${((latest.disk.used/node.disk_total)*100).toFixed(1)}%` : "--"}</span>
                      <div className="ds-kpi-lines">
                        <div>{latest && node ? `${(latest.disk.used/1024/1024/1024).toFixed(2)} / ${(node.disk_total/1024/1024/1024).toFixed(2)} GB` : "--"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="ds-kpi-ring ds-kpi-ring-hover" title={latest && node ? `磁盘占用 ${((latest.disk.used/node.disk_total)*100).toFixed(1)}%` : "--"}>
                    <svg viewBox="0 0 36 36" className="ds-ring-svg">
                      <path className="ds-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="ds-ring-fg ds-ring-fg-disk" strokeDasharray={latest && node ? `${Math.min(Math.max((latest.disk.used/node.disk_total)*100,0),100)}, 100` : "0, 100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="ds-ring-center"><div className="ds-ring-center-label">DISK</div></div>
                  </div>
                </div>

                <div className="ds-kpi-card">
                  <div className="ds-kpi-left">
                    <div className="ds-kpi-hdr">
                      <span className="ds-kpi-ico"><Wifi size={16} /></span>
                      <span className="ds-kpi-title">网络</span>
                    </div>
                    <div className="ds-kpi-main">
                      <span className="ds-kpi-big">{latest ? `${(((latest.network.up + latest.network.down) * 8) / 1e6).toFixed(2)} Mbps` : "--"}</span>
                      <div className="ds-kpi-lines">
                        <div><ArrowUp size={12} /> {latest ? `${latest.network.up.toFixed(0)} B/s` : "--"}</div>
                        <div><ArrowDown size={12} /> {latest ? `${latest.network.down.toFixed(0)} B/s` : "--"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="ds-kpi-ring ds-kpi-ring-hover">
                    <svg viewBox="0 0 36 36" className="ds-ring-svg">
                      <path className="ds-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="ds-ring-fg ds-ring-fg-net" strokeDasharray={latest ? `${Math.min((((latest.network.up + latest.network.down) * 8) / 1e6), 100)}, 100` : "0, 100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="ds-ring-center"><div className="ds-ring-center-label">{latest ? `${(((latest.network.up + latest.network.down)*8)/1e6).toFixed(1)}M` : "--"}</div></div>
                  </div>
                </div>
              </div>

              <StatusCharts uuid={uuid ?? ""} realtimeData={liveDataToRecords(uuid ?? "", recent)} memTotal={node?.mem_total || 0} swapTotal={node?.swap_total || 0} />
            </div>
          </div>
        ) : (
          <div className="ds-inst-section">
            <div className="ds-inst-section-body">
              <NetworkQualityPanel uuid={uuid ?? ""} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}