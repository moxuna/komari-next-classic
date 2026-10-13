"use client";

import * as React from "react";

/** 首页节点列表的搜索/筛选统计，供右上角的搜索面板显示「找到 N 个 / 共 M 个」。 */
export type NodeSearchStats = {
  /** 当前命中的节点数 */
  filtered: number;
  /** 参与筛选的节点总数 */
  total: number;
  /** 是否处于搜索状态 */
  searching: boolean;
};

type NodeSearchContextType = {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  stats: NodeSearchStats;
  publishStats: (stats: NodeSearchStats) => void;
  /** 清空统计（离开首页时调用），避免详情页的搜索面板显示上一次的命中数 */
  resetStats: () => void;
};

const EMPTY_STATS: NodeSearchStats = { filtered: 0, total: 0, searching: false };

const NodeSearchContext = React.createContext<NodeSearchContextType | undefined>(undefined);

/**
 * 节点搜索状态。
 * 搜索入口在导航栏右上角（NodeSearchButton），实际过滤发生在首页的节点列表（NodeDisplay），
 * 两者通过这个上下文共享：搜索词 + 面板开合 + 列表回传的命中统计。
 */
export const NodeSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [stats, setStats] = React.useState<NodeSearchStats>(EMPTY_STATS);

  // 三项都没变时返回旧对象，React 会跳过重渲染，避免「列表渲染 → 回传统计 → 列表重渲染」的死循环
  const publishStats = React.useCallback((next: NodeSearchStats) => {
    setStats((prev) =>
      prev.filtered === next.filtered && prev.total === next.total && prev.searching === next.searching
        ? prev
        : next
    );
  }, []);

  const resetStats = React.useCallback(() => setStats(EMPTY_STATS), []);

  const value = React.useMemo(
    () => ({ searchTerm, setSearchTerm, searchOpen, setSearchOpen, stats, publishStats, resetStats }),
    [searchTerm, searchOpen, stats, publishStats, resetStats]
  );

  return <NodeSearchContext.Provider value={value}>{children}</NodeSearchContext.Provider>;
};

export const useNodeSearch = () => {
  const context = React.useContext(NodeSearchContext);
  if (context === undefined) throw new Error("useNodeSearch must be used within a NodeSearchProvider");
  return context;
};

export default NodeSearchContext;
