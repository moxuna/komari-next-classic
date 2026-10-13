"use client";

import React, { Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Globe, Activity, ArrowUpRight, ArrowUp, ArrowDown, Zap, Calculator, Server, CloudOff } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import NodeDisplay from "@/components/NodeDisplay";
import { formatBytes } from "@/utils/unitHelper";
import { normalizeCurrency } from "@/utils/assetSummary";
import { useLiveData } from "@/contexts/LiveDataContext";
import { useNodeList } from "@/contexts/NodeListContext";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAssetSummary } from "@/contexts/AssetSummaryContext";
import Loading from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { usePingStats } from "@/hooks/usePingStats";
import { Callouts } from "@/components/DashboardCallouts";
import Flag from "@/components/Flag";

// Intelligent speed formatting function
const formatSpeed = (bytes: number): string => {
  if (bytes === 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  // Adaptive decimal places
  let decimals = 2;
  if (i >= 3) decimals = 1; // GB and above: 1 decimal
  if (i <= 1) decimals = 0; // B and KB: no decimals
  if (size >= 100) decimals = 0; // 100+ of any unit: no decimals

  return `${size.toFixed(decimals)} ${units[i]}`;
};

/** 短字节显示（速率环形中心使用）：单位表以 B 起始，避免下标错位 */
const formatBytesShort = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  const units = ["B", "K", "M", "G", "T"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const size = bytes / Math.pow(1024, i);
  const decimals = size >= 100 || i <= 1 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)}${units[i]}`;
};

/** 地区标识 → 展示简称：旗帜 emoji 转两字母代码；已是两字母则大写；否则原样 */
const getRegionLabel = (region?: string): string => {
  const raw = String(region || "").trim();
  if (!raw) return "UN";
  const emoji = raw.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0];
  const code = emoji
    ? (() => {
        const chars = Array.from(emoji);
        if (chars.length !== 2) return null;
        const a = chars[0].codePointAt(0);
        const b = chars[1].codePointAt(0);
        if (a == null || b == null || a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) return null;
        return String.fromCodePoint(a - 0x1f1e6 + 65) + String.fromCodePoint(b - 0x1f1e6 + 65);
      })()
    : null;
  return code || (/^[a-zA-Z]{2}$/.test(raw) ? raw.toUpperCase() : raw);
};

/** 状态卡片点击后的节点范围筛选 */
type NodeScope =
  | { kind: "all" }
  | { kind: "online" }
  | { kind: "offline" }
  | { kind: "region"; region: string };

type CardVariant = "time" | "online" | "region" | "traffic" | "speed" | "asset";

type SpeedTopNode = { uuid: string; name: string; up: number; down: number; total: number };

type CardMetrics = {
  onlineCount: number;
  totalCount: number;
  offlineCount: number;
  regionCounts: { region: string; count: number }[];
  activeRegionCount: number;
  trafficUp: number;
  trafficDown: number;
  speedUp: number;
  speedDown: number;
  speedTopNodes: SpeedTopNode[];
  assetTotal: number;
  assetCount: number;
};

/** 汇总状态卡片明细面板所需的全部指标（与原版口径一致：只统计在线节点） */
function computeCardMetrics(
  nodes: NodeBasicInfo[] | null | undefined,
  liveData: { online?: string[]; data?: Record<string, any> } | null | undefined,
  assetTotal: number,
  assetCount: number
): CardMetrics {
  const list = nodes || [];
  const onlineSet = new Set(liveData?.online || []);
  const dataMap = liveData?.data || {};

  const onlineNodes = list.filter((n) => onlineSet.has(n.uuid));
  const offlineNodes = list.filter((n) => !onlineSet.has(n.uuid));

  const regionMap = new Map<string, number>();
  for (const n of onlineNodes) {
    const region = String(n.region || "其他").trim() || "其他";
    regionMap.set(region, (regionMap.get(region) || 0) + 1);
  }
  const regionCounts = Array.from(regionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));

  const onlineEntries = Object.entries(dataMap).filter(([uuid]) => onlineSet.has(uuid));
  const sumOf = (pick: (node: any) => number) =>
    onlineEntries.reduce((acc, [, node]) => acc + (pick(node) || 0), 0);

  const trafficUp = sumOf((n) => n?.network?.totalUp);
  const trafficDown = sumOf((n) => n?.network?.totalDown);
  const speedUp = sumOf((n) => n?.network?.up);
  const speedDown = sumOf((n) => n?.network?.down);

  const nameMap = new Map(list.map((n) => [n.uuid, n.name]));
  const speedTopNodes: SpeedTopNode[] = onlineEntries
    .map(([uuid, node]) => {
      const up = node?.network?.up || 0;
      const down = node?.network?.down || 0;
      return { uuid, name: nameMap.get(uuid) || uuid, up, down, total: up + down };
    })
    .filter((n) => n.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    onlineCount: onlineNodes.length,
    totalCount: list.length,
    offlineCount: offlineNodes.length,
    regionCounts,
    activeRegionCount: regionCounts.length,
    trafficUp,
    trafficDown,
    speedUp,
    speedDown,
    speedTopNodes,
    assetTotal,
    assetCount,
  };
}

export default function DashboardContent() {
  const [t] = useTranslation();
  const { live_data } = useLiveData();
  const { publicInfo } = usePublicInfo();
  const { themeConfig, statusCardsVisibility } = useTheme();
  const { summary: sharedAssetSummary } = useAssetSummary();
  
  // Sync document title with backend-set custom title

  useEffect(() => {
    if (publicInfo?.sitename) {
      document.title = publicInfo.sitename;
    }
  }, [publicInfo?.sitename]);
  
  //#region 节点数据
  const { nodeList, isLoading, error, refresh } = useNodeList();
  const [fallbackAssetTotalCNY, setFallbackAssetTotalCNY] = React.useState(0);
  useEffect(() => {
    let cancelled = false;
    async function run(){
      const nodes = nodeList || [];
      const online = new Set(live_data?.data?.online || []);
      if (!nodes.length || !online.size) { if(!cancelled) setFallbackAssetTotalCNY(0); return; }
      const rateCache = new Map<string, number>();
      async function rate(curr: string){
        if (curr === "CNY") return 1;
        if (rateCache.has(curr)) return rateCache.get(curr)!;
        try { const r = await fetch(`https://open.er-api.com/v6/latest/${curr}`); const j = await r.json(); const v = Number(j?.rates?.CNY) || 1; rateCache.set(curr, v); return v; } catch { rateCache.set(curr, 1); return 1; }
      }
      let total = 0;
      for (const n of nodes) {
        if (!online.has(n.uuid)) continue;
        const raw = Number(n.price);
        const price = raw === -1 ? 0 : (Number.isFinite(raw) && raw > 0 ? raw : 0);
        total += price * await rate(normalizeCurrency(n.currency || "CNY"));
      }
      if(!cancelled) setFallbackAssetTotalCNY(total);
    }
    run();
    return () => { cancelled = true; };
  }, [nodeList, live_data?.data?.online]);

  usePingStats(nodeList?.[0]?.uuid || "", 24);

  const renderTrafficPair = (up: string, down: string) => {
    if (themeConfig.cardLayout === "modern") {
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>↑ {up}</span>
          <span className="text-muted-foreground">/</span>
          <span>↓ {down}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <div>↑ {up}</div>
        <div>↓ {down}</div>
      </div>
    );
  };

  //#region 状态卡片点击（明细面板 + 节点范围联动）
  const [selectedCardKey, setSelectedCardKey] = React.useState<string | null>(null);
  const [nodeScope, setNodeScope] = React.useState<NodeScope>({ kind: "all" });

  const assetTotalCNY = Number(
    sharedAssetSummary.count > 0 ? sharedAssetSummary.totalValueCNY : (fallbackAssetTotalCNY || 0)
  );

  const cardMetrics = React.useMemo(
    () =>
      computeCardMetrics(
        nodeList,
        live_data?.data,
        assetTotalCNY,
        sharedAssetSummary.count || 0
      ),
    [nodeList, live_data?.data, assetTotalCNY, sharedAssetSummary.count]
  );

  const scopedNodes = React.useMemo(() => {
    const list = nodeList || [];
    const onlineSet = new Set(live_data?.data?.online || []);
    if (nodeScope.kind === "online") return list.filter((n) => onlineSet.has(n.uuid));
    if (nodeScope.kind === "offline") return list.filter((n) => !onlineSet.has(n.uuid));
    if (nodeScope.kind === "region")
      return list.filter((n) => String(n.region || "其他") === nodeScope.region);
    return list;
  }, [nodeList, live_data?.data?.online, nodeScope]);

  const scopeLabel = React.useMemo(() => {
    if (nodeScope.kind === "online") return `在线机器 · ${scopedNodes.length}`;
    if (nodeScope.kind === "offline") return `离线机器 · ${scopedNodes.length}`;
    if (nodeScope.kind === "region") return `${nodeScope.region || "地区"} · ${scopedNodes.length}`;
    return "";
  }, [nodeScope, scopedNodes.length]);
  //#endregion

  // Status cards configuration
  const statusCards = [
    {
      key: "currentTime",
      variant: "time" as CardVariant,
      title: t("current_time"),
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => <DetailClock timeZone={themeConfig.selectedTimeZone} />,
      visible: statusCardsVisibility.currentTime,
      detail: <TimeDetail />,
    },
    {
      key: "currentOnline",
      variant: "online" as CardVariant,
      title: t("current_online"),
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      getValue: () =>
        `${live_data?.data?.online.length ?? 0} / ${nodeList?.length ?? 0}`,
      visible: statusCardsVisibility.currentOnline,
      detail: <OnlineDetail metrics={cardMetrics} nodeScope={nodeScope} onScopeChange={setNodeScope} />,
    },
    {
      key: "regionOverview",
      variant: "region" as CardVariant,
      title: t("region_overview"),
      icon: <Globe className="h-4 w-4 text-muted-foreground" />,
      getValue: () => {
        const onlineSet = new Set(live_data?.data?.online || []);
        return nodeList ? new Set(nodeList.filter(n => onlineSet.has(n.uuid)).map(n => n.region)).size : 0;
      },

      visible: statusCardsVisibility.regionOverview,
      detail: <RegionDetail metrics={cardMetrics} nodeScope={nodeScope} onScopeChange={setNodeScope} />,
    },
    {
      key: "trafficOverview",
      variant: "traffic" as CardVariant,
      title: t("traffic_overview"),
      icon: <ArrowUpRight className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => {
        const data = live_data?.data?.data;
        const online = live_data?.data?.online;
        if (!data || !online) return renderTrafficPair("0 B", "0 B");
        const onlineSet = new Set(online);
        const values = Object.entries(data)
          .filter(([uuid]) => onlineSet.has(uuid))
          .map(([, node]) => node);
        const up = values.reduce(
          (acc, node) => acc + (node.network.totalUp || 0),
          0
        );
        const down = values.reduce(
          (acc, node) => acc + (node.network.totalDown || 0),
          0
        );
        return `↑ ${formatBytes(up)}
↓ ${formatBytes(down)}`;
      },
      visible: statusCardsVisibility.trafficOverview,
      detail: <TrafficDetail metrics={cardMetrics} />,
    },
    {
      key: "networkSpeed",
      variant: "speed" as CardVariant,
      title: t("network_speed"),
      icon: <Zap className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => {
        const data = live_data?.data?.data;
        const online = live_data?.data?.online;
        if (!data || !online) return renderTrafficPair("0 B/s", "0 B/s");
        const onlineSet = new Set(online);
        const values = Object.entries(data)
          .filter(([uuid]) => onlineSet.has(uuid))
          .map(([, node]) => node);
        const up = values.reduce(
          (acc, node) => acc + (node.network.up || 0),
          0
        );
        const down = values.reduce(
          (acc, node) => acc + (node.network.down || 0),
          0
        );
        return `↑ ${formatSpeed(up)}
↓ ${formatSpeed(down)}`;
      },
      visible: statusCardsVisibility.networkSpeed,
      detail: <SpeedDetail metrics={cardMetrics} />,
    },
    {
      key: "assetOverview",
      variant: "asset" as CardVariant,
      title: t('asset_overview', { defaultValue: '资产统计' }),
      icon: <Calculator className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => `¥ ${Number(sharedAssetSummary.count > 0 ? sharedAssetSummary.totalValueCNY : (fallbackAssetTotalCNY || 0)).toFixed(2)}`,  
      visible: (statusCardsVisibility as any).assetOverview ?? true,
      detail: <AssetDetail metrics={cardMetrics} />,
    },
  ];

  const visibleStatusCards = statusCards.filter((card) => card.visible);
  const activeCard = visibleStatusCards.find((card) => card.key === selectedCardKey) || null;

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [nodeList, refresh]);

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  //#endregion

  // 标题栏高度砍掉 1/4（64→48 / 80→60），腾出的 16px / 20px 直接作为与下方卡片的间隔
  return (
    <div className="container mx-auto px-4 space-y-3 md:-mt-7">

      <div className="flex flex-col gap-4">

        <div className={`grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${visibleStatusCards.length >= 6 ? 'xl:grid-cols-6' : visibleStatusCards.length === 5 ? 'xl:grid-cols-5' : visibleStatusCards.length === 4 ? 'xl:grid-cols-4' : visibleStatusCards.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
          {visibleStatusCards.map((card) => (
              <TopCard
                key={card.key}
                cardKey={card.key}
                variant={card.variant}
                title={card.title}
                value={card.renderValue ? card.renderValue() : card.getValue?.()}
                icon={card.icon}
                layout={themeConfig.cardLayout}
                active={selectedCardKey === card.key}
                onClick={() => setSelectedCardKey((prev) => (prev === card.key ? null : card.key))}
              />
            ))}
        </div>

        {activeCard ? (
          <TopCardDetail
            title={activeCard.title}
            icon={activeCard.icon}
            onClose={() => setSelectedCardKey(null)}
          >
            {activeCard.detail}
          </TopCardDetail>
        ) : null}
      </div>

      <Callouts />

      {nodeScope.kind !== "all" ? (
        <div className="ds-node-scope-bar">
          <span>当前筛选：<strong>{scopeLabel}</strong></span>
          <button type="button" onClick={() => setNodeScope({ kind: "all" })}>显示全部</button>
        </div>
      ) : null}

      <Suspense fallback={<div className="p-4">Loading nodes...</div>}>
        <NodeDisplay
          nodes={scopedNodes}
          liveData={live_data?.data ?? { online: [], data: {} }}
        />
      </Suspense>
    </div>
  );
}

type TopCardProps = {
  cardKey: string;
  variant: CardVariant;
  title: string;
  value: string | number | React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  layout?: 'classic' | 'modern' | 'minimal' | 'detailed';
  active?: boolean;
  onClick?: () => void;
};

type DetailMiniStatProps = {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
  onClick?: () => void;
  active?: boolean;
  interactiveValue?: boolean;
  className?: string;
};

/** 明细面板里的小指标格（原版：可点击时渲染为 button 并带 is-active 态） */
function DetailMiniStat({ icon, label, value, tone, onClick, active, interactiveValue, className }: DetailMiniStatProps) {
  const cls = [
    'ds-detail-mini-stat',
    'ds-detail-mini-stat-corner',
    tone ? `tone-${tone}` : '',
    onClick ? 'is-clickable' : '',
    active ? 'is-active' : '',
    interactiveValue ? 'is-value-interactive' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="ds-detail-mini-head">
        <div className="ds-detail-mini-icon">{icon}</div>
        <span>{label}</span>
      </div>
      <div className="ds-detail-mini-value">
        <strong>{value}</strong>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}

/** 卡片下方的明细面板外壳（原版：标题 + 收起按钮 + 内容） */
function TopCardDetail({
  title,
  icon,
  onClose,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="ds-topcard-detail-card">
      <div className="ds-topcard-detail-head">
        <div className="ds-topcard-detail-title">
          <span>{icon}</span>
          <strong>{title}</strong>
        </div>
        <button type="button" className="ds-topcard-detail-close" onClick={onClose}>
          收起
        </button>
      </div>
      <div className="ds-topcard-detail-body">{children}</div>
    </div>
  );
}

/** 可选时区清单（原版原样） */
const TIMEZONE_OPTIONS = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Seoul',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

/** 时区下拉（原版功能：改时区会同时改卡片上的时钟） */
function TimezoneSelect({ value, onChange, ariaLabel }: { value: string; onChange: (timeZone: string) => void; ariaLabel?: string }) {
  return (
    <select
      className="ds-timezone-select"
      value={value || 'Asia/Shanghai'}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel || "选择时区"}
    >
      {TIMEZONE_OPTIONS.map((zone) => (
        <option key={zone} value={zone}>
          {zone}
        </option>
      ))}
    </select>
  );
}

/** 卡片与明细面板共用的实时时钟（原版 mh：zh-CN 24 小时制 + 未挂载时骨架屏） */
function DetailClock({ className, timeZone }: { className?: string; timeZone?: string }) {
  const [text, setText] = React.useState('');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const tick = () => {
      try {
        setText(new Date().toLocaleTimeString('zh-CN', timeZone ? { ...options, timeZone } : options));
      } catch {
        setText(new Date().toLocaleTimeString('zh-CN', options));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  if (!mounted) return <Skeleton className="h-6 w-24" />;
  return <span className={className}>{text}</span>;
}

function TimeDetail() {
  const [t] = useTranslation();
  const { themeConfig, setSelectedTimeZone } = useTheme();
  const timeZone = themeConfig.selectedTimeZone || 'Asia/Shanghai';

  return (
    <div className="ds-detail-grid ds-detail-grid-3">
      <DetailMiniStat
        icon={<Clock size={15} />}
        label="当前时间"
        value={<DetailClock className="ds-time-detail-value" timeZone={timeZone} />}
        tone="blue"
        className="ds-time-detail-current"
      />
      <DetailMiniStat
        icon={<Globe size={15} />}
        label="时区"
        value={<TimezoneSelect value={timeZone} onChange={setSelectedTimeZone} ariaLabel={t("common.selectTimezone", { defaultValue: "选择时区" })} />}
        tone="purple"
        interactiveValue
      />
      <DetailMiniStat icon={<Activity size={15} />} label="刷新机制" value="5 秒自动刷新" tone="green" />
    </div>
  );
}

function OnlineDetail({
  metrics,
  nodeScope,
  onScopeChange,
}: {
  metrics: CardMetrics;
  nodeScope: NodeScope;
  onScopeChange: (scope: NodeScope) => void;
}) {
  return (
    <div className="ds-detail-stack ds-detail-stack-compact">
      <div className="ds-detail-grid ds-detail-grid-3">
        <DetailMiniStat
          icon={<Server size={15} />}
          label="全部"
          value={metrics.totalCount}
          tone="blue"
          active={nodeScope.kind === 'all'}
          onClick={() => onScopeChange({ kind: 'all' })}
        />
        <DetailMiniStat
          icon={<Activity size={15} />}
          label="在线"
          value={metrics.onlineCount}
          tone="green"
          active={nodeScope.kind === 'online'}
          onClick={() => onScopeChange({ kind: 'online' })}
        />
        <DetailMiniStat
          icon={<CloudOff size={15} />}
          label="离线"
          value={metrics.offlineCount}
          tone="orange"
          active={nodeScope.kind === 'offline'}
          onClick={() => onScopeChange({ kind: 'offline' })}
        />
      </div>
    </div>
  );
}

function RegionDetail({
  metrics,
  nodeScope,
  onScopeChange,
}: {
  metrics: CardMetrics;
  nodeScope: NodeScope;
  onScopeChange: (scope: NodeScope) => void;
}) {
  return (
    <div className="ds-detail-stack">
      <div className="ds-detail-grid ds-detail-grid-2">
        <DetailMiniStat
          icon={<Globe size={15} />}
          label="点亮地区"
          value={metrics.activeRegionCount}
          tone="purple"
        />
        <DetailMiniStat
          icon={<Activity size={15} />}
          label="在线节点"
          value={metrics.onlineCount}
          tone="green"
          active={nodeScope.kind === 'online'}
          onClick={() => onScopeChange({ kind: 'online' })}
        />
      </div>
      <div className="ds-detail-section-title">选择地区查看对应机器</div>
      <div className="ds-region-pill-grid">
        {metrics.regionCounts.length ? (
          metrics.regionCounts.map((item) => (
            <button
              key={item.region}
              type="button"
              className={`ds-region-pill ${
                nodeScope.kind === 'region' && nodeScope.region === item.region ? 'is-active' : ''
              }`}
              onClick={() => onScopeChange({ kind: 'region', region: item.region })}
            >
              <span className="ds-region-pill-main">
                <span className="ds-region-pill-flag">
                  <Flag flag={item.region} size="5" />
                </span>
                <span className="ds-region-pill-name">{getRegionLabel(item.region)}</span>
              </span>
              <strong>{item.count}</strong>
            </button>
          ))
        ) : (
          <div className="ds-detail-empty">暂无在线地区</div>
        )}
      </div>
    </div>
  );
}

function TrafficDetail({ metrics }: { metrics: CardMetrics }) {
  return (
    <div className="ds-detail-grid ds-detail-grid-3">
      <DetailMiniStat
        icon={<ArrowUp size={15} />}
        label="累计上行"
        value={formatBytes(metrics.trafficUp)}
        tone="orange"
      />
      <DetailMiniStat
        icon={<ArrowDown size={15} />}
        label="累计下行"
        value={formatBytes(metrics.trafficDown)}
        tone="blue"
      />
      <DetailMiniStat
        icon={<ArrowUpRight size={15} />}
        label="累计合计"
        value={formatBytes(metrics.trafficUp + metrics.trafficDown)}
        tone="purple"
      />
    </div>
  );
}

/** 速率双环比（原版：外圈下载、内圈上传，圈长为相对活跃度） */
function SpeedDualRing({ up, down }: { up: number; down: number }) {
  const max = Math.max(10485760, up, down);
  const upPct = max ? Math.max(0, Math.min(100, (up / max) * 100)) : 0;
  const downPct = max ? Math.max(0, Math.min(100, (down / max) * 100)) : 0;

  return (
    <div
      className="ds-speed-card-visual ds-speed-card-visual-interactive"
      title={`下载 ${formatSpeed(down)} / 上传 ${formatSpeed(up)}。圆环为相对活跃度，不代表带宽上限占用。`}
    >
      <div className="ds-speed-dual-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ds-speed-ring-track ds-speed-ring-track-down" cx="50" cy="50" r="42" />
          <circle
            className="ds-speed-ring-value ds-speed-ring-value-down"
            cx="50"
            cy="50"
            r="42"
            pathLength={100}
            strokeDasharray={`${downPct} 100`}
          />
          <circle className="ds-speed-ring-track ds-speed-ring-track-up" cx="50" cy="50" r="31" />
          <circle
            className="ds-speed-ring-value ds-speed-ring-value-up"
            cx="50"
            cy="50"
            r="31"
            pathLength={100}
            strokeDasharray={`${upPct} 100`}
          />
        </svg>
        <div className="ds-speed-ring-center">
          <strong>↓ {formatBytesShort(down)}</strong>
          <span>↑ {formatBytesShort(up)}</span>
        </div>
      </div>
    </div>
  );
}

function SpeedDetail({ metrics }: { metrics: CardMetrics }) {
  return (
    <div className="ds-detail-stack">
      <div className="ds-speed-detail-layout">
        <SpeedDualRing up={metrics.speedUp} down={metrics.speedDown} />
        <div className="ds-detail-grid ds-detail-grid-2">
          <DetailMiniStat
            icon={<ArrowDown size={15} />}
            label="实时下载"
            value={formatSpeed(metrics.speedDown)}
            tone="blue"
          />
          <DetailMiniStat
            icon={<ArrowUp size={15} />}
            label="实时上传"
            value={formatSpeed(metrics.speedUp)}
            tone="orange"
          />
        </div>
      </div>
      <div className="ds-detail-section-title">速率 Top</div>
      <div className="ds-speed-node-list">
        {metrics.speedTopNodes.length ? (
          metrics.speedTopNodes.map((node) => (
            <div className="ds-speed-node-row" key={node.uuid}>
              <span>{node.name}</span>
              <strong>
                <ArrowDown size={11} />
                {formatSpeed(node.down)}
              </strong>
              <strong>
                <ArrowUp size={11} />
                {formatSpeed(node.up)}
              </strong>
            </div>
          ))
        ) : (
          <div className="ds-detail-empty">当前无明显网络速率</div>
        )}
      </div>
    </div>
  );
}

function AssetDetail({ metrics }: { metrics: CardMetrics }) {
  return (
    <div className="ds-detail-grid ds-detail-grid-3">
      <DetailMiniStat
        icon={<Calculator size={15} />}
        label="在线资产估值"
        value={`¥ ${metrics.assetTotal.toFixed(2)}`}
        tone="purple"
      />
      <DetailMiniStat
        icon={<Server size={15} />}
        label="资产条目"
        value={metrics.assetCount || metrics.onlineCount}
        tone="blue"
      />
      <DetailMiniStat
        icon={<Activity size={15} />}
        label="统计范围"
        value="在线节点"
        tone="green"
      />
    </div>
  );
}

function DashboardGauge({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="ds-mini-gauge">
      <div className="ds-mini-gauge-arc">
        <div className="ds-mini-gauge-fill" style={{ ['--pct' as any]: `${pct}%` }} />
        <div className="ds-mini-gauge-center">
          <div className="ds-mini-gauge-value">{Math.round(value)}</div>
          {label ? <div className="ds-mini-gauge-label">{label}</div> : null}
        </div>
      </div>
    </div>
  );
}

const TopCard: React.FC<TopCardProps> = ({ cardKey, variant, title, value, description, icon, active, onClick }) => {
  const [t] = useTranslation();
  const titleText = String(title);

  let body: React.ReactNode = <div className="ds-dashboard-topcard-value">{value}</div>;

  if (variant === 'time') {
    body = (
      <div className="ds-metric-time-panel">
        <div className="ds-metric-time-main">{value}</div>
        <div className="ds-metric-time-rail">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  } else if (variant === 'online') {
    const raw = typeof value === 'string' ? value : String(value);
    const parts = raw.split('/').map(s => s.trim());
    const online = Number(parts[0] || 0);
    const total = Number(parts[1] || 0);
    const pct = total ? (online / total) * 100 : 0;
    body = (
      <div className="ds-metric-online-panel">
        <div className="ds-dashboard-topcard-value">{raw}</div>
        <div className="ds-metric-line"><div className="ds-metric-line-fill online" style={{ width: `${pct}%` }} /></div>
        
      </div>
    );
  } else if (variant === 'region') {
    body = (
      <div className="ds-metric-region-panel">
        <div className="ds-dashboard-topcard-value">{value}</div>
        <div className="ds-metric-region-dots"><span /><span /><span /><span /><span /></div>
      </div>
    );
  } else if (variant === 'traffic') {
    body = <div className="ds-metric-traffic-panel" title={typeof value === 'string' ? value.replace(/\n/g, ' | ') : undefined}><div className="ds-metric-traffic-stack"><div className="ds-metric-traffic-lane up"><span className="tag">{t("common.up", { defaultValue: "上行" })}</span><strong>{typeof value === 'string' ? (value.split('\n')[0] || '').replace(/^↑\s*/, '') : value}</strong></div><div className="ds-metric-traffic-lane down"><span className="tag">{t("common.down", { defaultValue: "下行" })}</span><strong>{typeof value === 'string' ? (value.split('\n')[1] || '').replace(/^↓\s*/, '') : ''}</strong></div></div></div>;
  } else if (variant === 'asset') {
    const txt = typeof value === 'string' ? value : String(value);
    const m = txt.match(/([¥$€£])\s*([\d,]+)(?:\.(\d{2}))?/);
    const integer = m ? m[2] : txt;
    const decimal = m && m[3] ? m[3] : '00';
    body = (
      <div className="ds-asset-topcard">
        <div className="ds-asset-topcard-money">
          <span className="ds-asset-topcard-symbol">¥</span>
          <span className="ds-asset-topcard-int">{integer}</span>
          <span className="ds-asset-topcard-dec">.{decimal}</span>
        </div>
      </div>
    );
  } else if (variant === 'speed') {
    let up = 0, down = 0, unit = 'MB/s';
    const txt = typeof value === 'string' ? value.replace(/\n/g, ' ') : ''; 
    const m = txt.match(/↑\s*([\d.]+)\s*([A-Z/]+)[\s\S]*?↓\s*([\d.]+)\s*([A-Z/]+)/);
    if (m) {
      up = Number(m[1] || 0);
      down = Number(m[3] || 0);
      unit = m[2] || unit;
    }
    const gaugeVal = Math.max(up, down);
    body = (
      <div className="ds-metric-speed-panel" title={`实时上传 ${up || 0} ${unit} / 实时下载 ${down || 0} ${unit}`}>
        <DashboardGauge value={gaugeVal} max={Math.max(10, gaugeVal * 1.3)} label={unit.replace('/s','')} />
        <div className="ds-metric-speed-dual is-compact" title={`↑ ${up || 0} ${unit} / ↓ ${down || 0} ${unit}`}></div>
      </div>
    );
  }

  return (
    <Card
      className={`ds-dashboard-topcard ds-dashboard-topcard-clickable ${active ? 'is-active' : ''} overflow-hidden border shadow-sm bg-card select-none`}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`${titleText} 详情`}
      data-card-key={cardKey}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      <CardContent className="ds-dashboard-topcard-content ds-dashboard-topcard-content-lefthead">
        <div className="ds-dashboard-topcard-head ds-dashboard-topcard-head-corner">
          <div className="ds-dashboard-topcard-icon">{icon}</div>
          <div className="ds-dashboard-topcard-title">{title}</div>
        </div>
        <div className="ds-dashboard-topcard-body">{body}</div>
        {description ? <div className="ds-dashboard-topcard-desc">{description}</div> : null}
        <div className="ds-dashboard-topcard-hint">点击查看详情</div>
      </CardContent>
    </Card>
  );
};
