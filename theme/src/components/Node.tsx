import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Calendar as CalendarDays,
  ArrowUp,
  ArrowDown,
  Clock,
  ChartPie,
  Cloud,
  Activity,
  Wifi,
} from "lucide-react";
import type { TFunction } from "i18next";

import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData, Record } from "../types/LiveData";
import { formatBytes, stringToBytes } from "@/utils/unitHelper";

import Flag from "./Flag";
import { usePingBlocks } from "@/hooks/usePingBlocks";

// ── Helpers ──

export function formatUptime(seconds: number, t: TFunction): string {
  if (!seconds || seconds < 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}${t("nodeCard.time_day", { defaultValue: 'd' })}`;
  if (h > 0) return `${h}${t("nodeCard.time_hour", { defaultValue: 'h' })} ${m}${t("nodeCard.time_minute", { defaultValue: 'm' })}`;
  return `${m}${t("nodeCard.time_minute", { defaultValue: 'm' })}`;
}

function formatBytesInt(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB','GB','TB','PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = bytes / Math.pow(k, i);
  return `${Math.round(v)} ${sizes[i]}`;
}

function formatSpeed(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 1)) + " " + sizes[i];
}

function getExpiryDays(expiredAt: string | undefined): number | null {
  if (!expiredAt) return null;
  const exp = new Date(expiredAt);
  if (isNaN(exp.getTime())) return null;
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

function formatExpiry(expiredAt: string | undefined): string {
  const diffDays = getExpiryDays(expiredAt);
  if (diffDays == null) return "--";
  if (diffDays < 0) return 'expired';
  return `${diffDays}天`;
}

function getExpiryClass(expiredAt: string | undefined): string {
  const days = getExpiryDays(expiredAt);
  if (days == null) return "";
  if (days < 3) return "ds-exp-red";
  if (days <= 10) return "ds-exp-yellow";
  return "";
}

function ell(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "..." : s || "";
}

function formatLatencyMs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return `${Math.round(value)} ms`;
}

function formatPacketLoss(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "--";
  return `${value.toFixed(1)}%`;
}

function pingBlockClass(latency: number, loss: boolean, empty: boolean, mode: "latency" | "loss") {
  if (empty) return "ds-pb ds-pb-none";
  if (mode === "loss") return `ds-pb ${loss ? "ds-pb-bad" : "ds-pb-good"}`;
  if (loss || latency < 0) return "ds-pb ds-pb-bad";
  if (latency >= 200) return "ds-pb ds-pb-bad";
  if (latency >= 100) return "ds-pb ds-pb-warn";
  return "ds-pb ds-pb-good";
}

function PingBlocksStrip({
  blocks,
  mode,
}: {
  blocks: { latency: number; time: string; loss: boolean }[];
  mode: "latency" | "loss";
}) {
  return (
    <div className="ds-pblocks" aria-label={mode === "latency" ? "latency samples" : "packet loss samples"}>
      {blocks.map((b, i) => {
        const empty = !b.time;
        const title = empty
          ? "no data"
          : mode === "loss"
            ? (b.loss ? "loss" : "ok")
            : (b.loss || b.latency < 0 ? "loss" : `${b.latency.toFixed(1)} ms`);
        return <span key={`${b.time || "empty"}-${i}`} className={pingBlockClass(b.latency, b.loss, empty, mode)} title={title} />;
      })}
    </div>
  );
}


function shortenCpuName(raw: string): string {
  const cleaned = String(raw || "")
    .replace(/\((?:R|TM|C)\)/gi, " ")
    .replace(/\bcpu\s*@\s*[\d.]+ghz/gi, " ")
    .replace(/\b(?:processor|cpu|cores?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // 只保留前两个词（AMD EPYC / Intel Xeon / Apple M1），避免撑破卡片布局
  return cleaned.split(" ").filter(Boolean).slice(0, 2).join(" ");
}

function toBytes(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return 0;
    // 兼容 "2G" / "512 MB" 这类带单位的字符串
    if (/[a-zA-Z,*\s]/.test(s)) return stringToBytes(s);
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

function formatBytesShort(value: unknown): string {
  const bytes = toBytes(value);
  if (bytes <= 0) return "0";
  const k = 1024;
  const sizes = ["B", "K", "M", "G", "T", "P"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const v = bytes / Math.pow(k, i);
  return `${v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))}${sizes[i]}`;
}

function getDtOsSlug(os: string): string | null {
  const s = String(os || "").toLowerCase();
  const map: { slug: string; keywords: string[] }[] = [
    { slug: 'ubuntu', keywords: ['ubuntu'] },
    { slug: 'debian', keywords: ['debian'] },
    { slug: 'redhat', keywords: ['red hat','redhat','rhel'] },
    { slug: 'centos', keywords: ['centos'] },
    { slug: 'fedora', keywords: ['fedora'] },
    { slug: 'opensuse', keywords: ['opensuse','suse'] },
    { slug: 'archlinux', keywords: ['arch linux','arch'] },
    { slug: 'alpinelinux', keywords: ['alpine linux','alpine'] },
    { slug: 'rockylinux', keywords: ['rocky linux','rocky'] },
    { slug: 'almalinux', keywords: ['alma linux','alma'] },
    { slug: 'linuxmint', keywords: ['linux mint','mint'] },
    { slug: 'freebsd', keywords: ['freebsd'] },
    { slug: 'openbsd', keywords: ['openbsd'] },
    { slug: 'windows', keywords: ['windows server','windows'] },
    { slug: 'apple', keywords: ['darwin','macos','mac','osx','apple'] },
    { slug: 'android', keywords: ['android'] },
    { slug: 'docker', keywords: ['docker'] },
    { slug: 'linux', keywords: ['linux'] },
  ];
  for (const item of map) {
    if (item.keywords.some(k => s.includes(k))) return item.slug;
  }
  return null;
}

function getDtOsIconUrl(os: string): string | null {
  const slug = getDtOsSlug(os);
  if (!slug) return null;
  return `/img/os-logos/streamline/${slug}.svg`;
}

// ── Progress Bar ──
function Bar({ value, cls }: { value: number; cls: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="ds-track">
      <div className={`ds-fill ${cls}`} style={{ width: `${v}%` }} />
    </div>
  );
}

// ── Metric Row ──
function MetricRow({
  icon,
  label,
  value,
  barCls,
  barValue,
  middle,
  midTitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  barCls?: string;
  barValue?: number;
  middle?: React.ReactNode;
  midTitle?: string;
}) {
  return (
    <div className="ds-mr">
      <div className="ds-mr-top">
        <span className="ds-mr-icon">{icon}</span>
        <span className="ds-mr-label">{label}</span>
        {middle != null ? <span className="ds-mr-mid" title={midTitle}>{middle}</span> : null}
        <span className="ds-mr-val">{value}</span>
      </div>
      {barCls != null && barValue != null && <Bar value={barValue} cls={barCls} />}
    </div>
  );
}

// ── Footer item ──
function FootItem({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className="ds-fi">
      <span className="ds-fi-icon">{icon}</span>
      <span className="ds-fi-label">{label}</span>
      <span className={`ds-fi-val ${className}`}>{value}</span>
    </div>
  );
}

// ── Node Card ──
interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
}

type NodeCardVisibility = {
  cpu: boolean; memory: boolean; disk: boolean; monthlyTraffic: boolean;
  latency: boolean; packetLoss: boolean;
  downloadSpeed: boolean; uploadSpeed: boolean; downloadTotal: boolean; uploadTotal: boolean;
  expire: boolean; uptime: boolean; ipBadges: boolean; osIcon: boolean; regionFlag: boolean;
};
const DEFAULT_NODE_CARD_VISIBILITY: NodeCardVisibility = {
  cpu: true, memory: true, disk: true, monthlyTraffic: true,
  latency: true, packetLoss: true,
  downloadSpeed: true, uploadSpeed: true, downloadTotal: true, uploadTotal: true,
  expire: true, uptime: true, ipBadges: true, osIcon: true, regionFlag: true,
};

const Node = ({ basic, live, online }: NodeProps) => {
  const [t] = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pingBlocks = usePingBlocks(basic.uuid);
  useEffect(() => { fetch("/api/me").then(r => r.ok ? r.json() : null).then(me => setIsLoggedIn(!!me?.logged_in)).catch(() => setIsLoggedIn(false)); }, []);
  const visibility = DEFAULT_NODE_CARD_VISIBILITY;
  const cpuUsage = live?.cpu?.usage ?? 0;
  const memUsed = live?.ram?.used ?? 0;
  const memTotal = basic.mem_total ?? 1;
  const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
  const diskUsed = live?.disk?.used ?? 0;
  const diskTotal = basic.disk_total ?? 1;
  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  const totalUp = live?.network?.totalUp ?? 0;
  const totalDown = live?.network?.totalDown ?? 0;
  const trafficLimitType = basic.traffic_limit_type ?? "sum";
  const trafficUsed =
    trafficLimitType === "up" ? totalUp :
    trafficLimitType === "down" ? totalDown :
    trafficLimitType === "max" ? Math.max(totalUp, totalDown) :
    trafficLimitType === "min" ? Math.min(totalUp, totalDown) :
    totalUp + totalDown;
  const monthlyPct = basic.traffic_limit > 0 ? (trafficUsed / basic.traffic_limit) * 100 : 0;

  const netUp = live?.network?.up ?? 0;
  const netDown = live?.network?.down ?? 0;
  const uptime = live?.uptime ?? 0;
  const recentPingBlocks = pingBlocks.blocks.slice(-10);
  const recentLatencyValues = recentPingBlocks
    .filter((b) => b.time && !b.loss && b.latency >= 0)
    .map((b) => b.latency);
  const recentLatencyAvg = recentLatencyValues.length
    ? recentLatencyValues.reduce((sum, value) => sum + value, 0) / recentLatencyValues.length
    : 0;
  const cpuModel = useMemo(() => shortenCpuName(String(basic.cpu_name || basic.arch || "")), [basic.cpu_name, basic.arch]);
  const cpuCores = basic.cpu_cores > 0 ? basic.cpu_cores : 0;
  const isOffline = !online || !live;
  const memTotalBytes = toBytes(memTotal);
  const diskTotalBytes = toBytes(diskTotal);
  const memUsedBytes = toBytes(memUsed);
  const diskUsedBytes = toBytes(diskUsed);
  const memMid = isOffline || memTotalBytes <= 0 ? "--/--" : `${formatBytesShort(memUsedBytes)}/${formatBytesShort(memTotalBytes)}`;
  const diskMid = isOffline || diskTotalBytes <= 0 ? "--/--" : `${formatBytesShort(diskUsedBytes)}/${formatBytesShort(diskTotalBytes)}`;
  const memMidTitle = `${formatBytes(memUsedBytes)} / ${formatBytes(memTotalBytes)}`;
  const diskMidTitle = `${formatBytes(diskUsedBytes)} / ${formatBytes(diskTotalBytes)}`;


  return (
    <div className={`ds-card2 ${!online ? "ds-card2-off" : ""}`}>
      {!online && (
        <div className="ds-off-mask">
          <span className="ds-off-pill">⏻ {t("nodeCard.offline", "离线")}</span>
        </div>
      )}

      {/* ─ Header ─ */}
      <div className="ds-hdr2">
        <div className="ds-hdr2-left">
          {visibility.regionFlag ? <span className="ds-hdr-flag"><Flag flag={basic.region} /></span> : null}
          <Link href={`/instance/${basic.uuid}`} className="ds-hdr-name" title={basic.name}>
            {ell(basic.name, 16)}
          </Link>
          
        </div>
        <div className="ds-hdr2-right">
          {visibility.osIcon && getDtOsIconUrl(basic.os) && (
            <img className="ds-hdr-os2" src={getDtOsIconUrl(basic.os)!} alt={basic.os} />
          )}
          {visibility.ipBadges && isLoggedIn && basic.ipv4 && <span className="ds-hdr-badge">IPv4</span>}
          {visibility.ipBadges && isLoggedIn && basic.ipv6 && <span className="ds-hdr-badge">IPv6</span>}
          <span className={`ds-hdr-dot ${online ? "on" : "off"}`} />
        </div>
      </div>

      {/* ─ Two-column body ─ */}
      <div className="ds-body">
        {/* LEFT COLUMN */}
        <div className="ds-col">
          {visibility.cpu ? <MetricRow
            icon={<Cpu className="w-3.5 h-3.5" />}
            label="CPU"
            value={`${cpuUsage.toFixed(1)}%`}
            barCls="ds-fill-cpu"
            barValue={cpuUsage}
            midTitle={cpuModel ? `${cpuModel}${cpuCores > 0 ? ` x${cpuCores}` : ""}` : undefined}
            middle={cpuModel ? (
              <>
                <span className="ds-mr-mid-name">{ell(cpuModel, 12)}</span>
                {cpuCores > 0 ? <span className="ds-mr-mid-cores">x{cpuCores}</span> : null}
              </>
            ) : undefined}
          /> : null}
          {visibility.disk ? <MetricRow
            icon={<HardDrive className="w-3.5 h-3.5" />}
            label={t("nodeCard.disk", "磁盘")}
            value={`${diskPct.toFixed(1)}%`}
            barCls="ds-fill-disk"
            barValue={diskPct}
            midTitle={diskMidTitle}
            middle={diskMid}
          /> : null}

          {/* Download speed */}
          {visibility.downloadSpeed ? <div className="ds-sr">
            <ArrowDown className="w-3.5 h-3.5 ds-c-blue" />
            <span className="ds-sr-label">{t("nodeCard.download", "下载")}</span>
            <span className="ds-sr-val">{formatSpeed(netDown)}</span>
          </div> : null}

          {/* Download total */}
          {visibility.downloadTotal ? <div className="ds-sr">
            <Cloud className="w-3.5 h-3.5 ds-c-muted" />
            <span className="ds-sr-label">{t("nodeCard.downloadTotal", "下载流量")}</span>
            <span className="ds-sr-val">{formatBytes(totalDown)}</span>
          </div> : null}

          {/* Latency（与原版同一位置：左列延迟；有监测点时按监测点分行显示） */}
          {visibility.latency ? <div className="ds-ping-mini">
            <div className="ds-sr">
              <Activity className="w-3.5 h-3.5 ds-c-blue" />
              <span className="ds-sr-label">{t("nodeCard.latency", { defaultValue: "延迟" })}</span>
              <span className="ds-sr-val">{pingBlocks.hasData ? formatLatencyMs(recentLatencyAvg) : "--"}</span>
            </div>
            {pingBlocks.hasTasks ? (
              <div className="ds-ping-tasks" aria-label={t("nodeCard.ping_tasks_title", { defaultValue: "网络监测" })}>
                {pingBlocks.rows.slice(0, 3).map((row) => (
                  <div
                    className="ds-pt-row"
                    key={row.id}
                    title={`${row.name} · ${t("nodeCard.latency", { defaultValue: "延迟" })} ${formatLatencyMs(row.latest)}`}
                  >
                    <span className="ds-pt-name" title={row.name}>{row.name}</span>
                    <PingBlocksStrip blocks={row.blocks} mode="latency" />
                    <span className="ds-pt-val">{formatLatencyMs(row.latest)}</span>
                  </div>
                ))}
                {pingBlocks.rows.length > 3 ? (
                  <div
                    className="ds-pt-more"
                    title={pingBlocks.rows.slice(3).map((r) => `${r.name}: ${formatLatencyMs(r.latest)}`).join("\n")}
                  >
                    {t("nodeCard.ping_more", { count: pingBlocks.rows.length - 3, defaultValue: `… 还有 ${pingBlocks.rows.length - 3} 个监测点` })}
                  </div>
                ) : null}
              </div>
            ) : (
              <PingBlocksStrip blocks={recentPingBlocks} mode="latency" />
            )}
          </div> : null}

          {/* Expiry（与原版一致：左列延迟下方） */}
          {visibility.expire ? <FootItem icon={<CalendarDays className="w-3.5 h-3.5" />} label={t("nodeCard.expire", "到期")} className={getExpiryClass(basic.expired_at)} value={formatExpiry(basic.expired_at) === 'expired' ? t('nodeCard.expired', { defaultValue: '已过期' }) : formatExpiry(basic.expired_at)} /> : null}

        </div>

        {/* RIGHT COLUMN */}
        <div className="ds-col">
          {visibility.memory ? <MetricRow
            icon={<MemoryStick className="w-3.5 h-3.5" />}
            label={t("nodeCard.memory", "内存")}
            value={`${memPct.toFixed(1)}%`}
            barCls="ds-fill-mem"
            barValue={memPct}
            midTitle={memMidTitle}
            middle={memMid}
          /> : null}
          {visibility.monthlyTraffic ? <MetricRow
            icon={<ChartPie className="w-3.5 h-3.5" />}
            label={t("nodeCard.monthly", "月度")}
            value={basic.traffic_limit > 0 ? `${formatBytesInt(trafficUsed)}/${formatBytesInt(basic.traffic_limit)}` : "--"}
            barCls="ds-fill-monthly"
            barValue={monthlyPct}
          /> : null}

          {/* Upload speed */}
          {visibility.uploadSpeed ? <div className="ds-sr">
            <ArrowUp className="w-3.5 h-3.5 ds-c-green" />
            <span className="ds-sr-label">{t("nodeCard.upload", "上传")}</span>
            <span className="ds-sr-val">{formatSpeed(netUp)}</span>
          </div> : null}

          {/* Upload total */}
          {visibility.uploadTotal ? <div className="ds-sr">
            <Cloud className="w-3.5 h-3.5 ds-c-muted" />
            <span className="ds-sr-label">{t("nodeCard.uploadTotal", "上传流量")}</span>
            <span className="ds-sr-val">{formatBytes(totalUp)}</span>
          </div> : null}

          {/* Packet loss（与原版同一位置：右列丢包；有监测点时按监测点分行显示） */}
          {visibility.packetLoss ? <div className="ds-ping-mini">
            <div className="ds-sr">
              <Wifi className="w-3.5 h-3.5 ds-c-muted" />
              <span className="ds-sr-label">{t("chart.lossRate", { defaultValue: "丢包" })}</span>
              <span className="ds-sr-val">{pingBlocks.hasData ? formatPacketLoss(pingBlocks.avgLoss) : "--"}</span>
            </div>
            {pingBlocks.hasTasks ? (
              <div className="ds-ping-tasks">
                {pingBlocks.rows.slice(0, 3).map((row) => {
                  const lossText = row.loss == null ? "--" : `${row.loss.toFixed(1)}%`;
                  return (
                    <div
                      className="ds-pt-row"
                      key={row.id}
                      title={`${row.name} · ${t("nodeCard.ping_loss_label", { defaultValue: "丢包" })} ${lossText}`}
                    >
                      <span className="ds-pt-name" title={row.name}>{row.name}</span>
                      <PingBlocksStrip blocks={row.blocks} mode="loss" />
                      <span className="ds-pt-val">{lossText}</span>
                    </div>
                  );
                })}
                {pingBlocks.rows.length > 3 ? (
                  <div
                    className="ds-pt-more"
                    title={pingBlocks.rows.slice(3).map((r) => `${r.name}: ${r.loss == null ? "--" : `${r.loss.toFixed(1)}%`}`).join("\n")}
                  >
                    {t("nodeCard.ping_more", { count: pingBlocks.rows.length - 3, defaultValue: `… 还有 ${pingBlocks.rows.length - 3} 个监测点` })}
                  </div>
                ) : null}
              </div>
            ) : (
              <PingBlocksStrip blocks={recentPingBlocks} mode="loss" />
            )}
          </div> : null}

          {/* Uptime（与原版一致：右列丢包下方） */}
          {visibility.uptime ? <FootItem icon={<Clock className="w-3.5 h-3.5" />} label={t("nodeCard.uptime", "运行时间")} value={formatUptime(uptime, t)} /> : null}

        </div>
      </div>

    </div>
  );
};

export default Node;

// ── NodeGrid ──
type NodeGridProps = { nodes: NodeBasicInfo[]; liveData: LiveData };
export const NodeGrid = ({ nodes, liveData }: NodeGridProps) => {
  const onlineNodes = liveData?.online ?? [];
  const sorted = [...nodes].sort((a, b) => {
    const aOn = onlineNodes.includes(a.uuid);
    const bOn = onlineNodes.includes(b.uuid);
    if (aOn !== bOn) return aOn ? -1 : 1;
    return a.weight - b.weight;
  });
  return (
    <div className="ds-card-grid">
      {sorted.map((n) => (
        <Node key={n.uuid} basic={n} live={liveData?.data?.[n.uuid]} online={onlineNodes.includes(n.uuid)} />
      ))}
    </div>
  );
};