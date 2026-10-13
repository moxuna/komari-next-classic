import { useEffect, useState, useRef, useCallback } from 'react';
import { useRPC2Call } from '@/contexts/RPC2Context';

export interface PingBlock {
  latency: number; // ms, -1 = timeout/loss
  time: string;
  loss: boolean;
}

/** 单个监测点的展示数据 */
export interface PingTaskRow {
  id: number;
  /** 监测点名称（后台设置名） */
  name: string;
  /** 丢包率 %；后端可能缺省该字段，缺省时为 undefined */
  loss?: number;
  /** 最新延迟 ms；非有限值归一化为 -1 */
  latest: number;
  /** 该监测点最近 PER_TASK_BLOCKS 个样本（不足时左侧补空块） */
  blocks: PingBlock[];
}

export interface PingBlocksResult {
  /** 按监测点分组的数据（有 ping 任务时使用） */
  rows: PingTaskRow[];
  /** 是否取到监测点列表 */
  hasTasks: boolean;
  /** —— 以下为混合统计，供「无监测点」节点回退使用 —— */
  blocks: PingBlock[];
  avgLatency: number;
  avgLoss: number;
  hasData: boolean;
}

const BLOCK_COUNT = 20; // 混合回退使用的样本数
const PER_TASK_BLOCKS = 8; // 每个监测点一行显示的样本数（一行式紧凑布局）
const REFRESH_MS = 30_000; // 30 seconds

function toBlock(value: unknown, time: unknown): PingBlock {
  const v = Number(value);
  const ok = Number.isFinite(v) && v >= 0;
  return { latency: ok ? v : -1, time: typeof time === 'string' ? time : '', loss: !ok };
}

function emptyBlock(): PingBlock {
  return { latency: -1, time: '', loss: true };
}

export function usePingBlocks(uuid: string): PingBlocksResult {
  const { call } = useRPC2Call();
  const [result, setResult] = useState<PingBlocksResult>({
    rows: [],
    hasTasks: false,
    blocks: [],
    avgLatency: 0,
    avgLoss: 0,
    hasData: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPing = useCallback(async () => {
    if (!uuid) return;
    try {
      const resp = await call<any, any>('common:getRecords', {
        uuid,
        type: 'ping',
        hours: 24, // 与 usePingStats / NetworkQualityPanel 保持一致，不改变丢包统计口径
      });

      const records: { task_id?: number; value: unknown; time: unknown }[] = resp?.records || [];
      const tasks: any[] = resp?.tasks || [];

      // ── 混合统计（回退用，保持原有行为）──
      const recent = records.slice(-BLOCK_COUNT);
      const blocks: PingBlock[] = recent.map((r) => toBlock(r.value, r.time));
      while (blocks.length < BLOCK_COUNT) blocks.unshift(emptyBlock());

      const valid = blocks.filter((b) => b.latency >= 0);
      const avgLatency = valid.length > 0
        ? valid.reduce((s, b) => s + b.latency, 0) / valid.length
        : 0;

      const total = blocks.filter((b) => b.time !== '').length;
      const lost = blocks.filter((b) => b.time !== '' && b.loss).length;
      const avgLoss = total > 0 ? (lost / total) * 100 : 0;

      // ── 按 task_id 分组 ──
      const grouped = new Map<number, { value: unknown; time: unknown }[]>();
      for (const r of records) {
        const id = Number(r?.task_id);
        if (!Number.isFinite(id)) continue;
        const bucket = grouped.get(id);
        if (bucket) bucket.push(r);
        else grouped.set(id, [r]);
      }

      // ── 组合每个监测点一行 ──
      const rows: PingTaskRow[] = [];
      for (const task of tasks) {
        const id = Number(task?.id);
        if (!Number.isFinite(id)) continue;

        const samples = grouped.get(id) || [];
        const perTask: PingBlock[] = samples.slice(-PER_TASK_BLOCKS).map((r) => toBlock(r.value, r.time));
        while (perTask.length < PER_TASK_BLOCKS) perTask.unshift(emptyBlock());

        const rawName = typeof task?.name === 'string' ? task.name.trim() : '';
        // loss / latest 可能缺省，必须归一化，避免 UI 层 toFixed 抛错导致整张卡片崩溃
        const rawLoss = Number(task?.loss);
        const rawLatest = Number(task?.latest);

        rows.push({
          id,
          name: rawName || `#${id}`,
          loss: Number.isFinite(rawLoss) ? rawLoss : undefined,
          latest: Number.isFinite(rawLatest) ? rawLatest : -1,
          blocks: perTask,
        });
      }

      setResult({
        rows,
        hasTasks: rows.length > 0,
        blocks,
        avgLatency,
        avgLoss,
        hasData: recent.length > 0,
      });
    } catch {
      // keep previous state on error
    }
  }, [uuid, call]);

  useEffect(() => {
    fetchPing();
    timerRef.current = setInterval(fetchPing, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchPing]);

  return result;
}
