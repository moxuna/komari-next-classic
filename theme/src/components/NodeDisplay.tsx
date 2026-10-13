import React, { useMemo, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "../types/LiveData";
import { NodeGrid } from "./Node";
import { isRegionMatch } from "@/utils/regionHelper";
import { useNodeSearch } from "@/contexts/NodeSearchContext";
import "./NodeDisplay.css";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getGroupLabel = (group: string, t: (key: string, opts?: any) => string) => {
  const map: Record<string, string> = {
    all: t('groups.all', { defaultValue: '全部' }),
    '主力': t('groups.primary', { defaultValue: '主力' }),
    '大善人': t('groups.sponsor', { defaultValue: '大善人' }),
    '玩具': t('groups.toy', { defaultValue: '玩具' }),
    '落地机': t('groups.edge', { defaultValue: '落地机' }),
  };
  return map[group] || group;
};


interface NodeDisplayProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
}

const NodeDisplay: React.FC<NodeDisplayProps> = ({ nodes, liveData }) => {
  const [t] = useTranslation();
  // 搜索词来自右上角的搜索按钮（NodeSearchButton）
  const { searchTerm, publishStats, resetStats } = useNodeSearch();
  const [selectedGroup, setSelectedGroup] = useLocalStorage<string>(
    "nodeSelectedGroup",
    "all"
  );

  // 获取所有的分组
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.group && node.group.trim()) {
        groupSet.add(node.group);
      }
    });
    return Array.from(groupSet).sort();
  }, [nodes]);

  // 判断是否显示分组选择器
  const showGroupSelector = groups.length >= 1;

  // 历史版本可能存了翻译后的分组名，认不出就回落到「全部」
  const activeGroup = selectedGroup === "all" || groups.includes(selectedGroup) ? selectedGroup : "all";

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // 先按分组过滤
    if (activeGroup !== "all") {
      result = result.filter((node) => node.group === activeGroup);
    }

    // 再按搜索条件过滤
    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase().trim();
    return result.filter((node) => {
      // 基本信息搜索
      const basicMatch =
        node.name.toLowerCase().includes(term) ||
        node.os.toLowerCase().includes(term) ||
        node.arch.toLowerCase().includes(term);

      // 地区搜索（支持emoji和地区名称）
      const regionMatch = isRegionMatch(node.region, term);

      // 价格搜索（如果输入数字）
      const priceMatch =
        !isNaN(Number(term)) && node.price.toString().includes(term);

      // 状态搜索
      const isOnline = liveData?.online?.includes(node.uuid) || false;
      const statusMatch =
        ((term === "online" || term === "在线") && isOnline) ||
        ((term === "offline" || term === "离线") && !isOnline);

      return basicMatch || regionMatch || priceMatch || statusMatch;
    });
  }, [nodes, searchTerm, liveData, activeGroup]);

  const searching = Boolean(searchTerm.trim());
  const onlineInGroup = useMemo(
    () => filteredNodes.filter((node) => liveData?.online?.includes(node.uuid)).length,
    [filteredNodes, liveData]
  );

  // 把命中数量回传给右上角的搜索面板（数量不变时上下文会跳过更新，不会循环渲染）
  useEffect(() => {
    publishStats({ filtered: filteredNodes.length, total: nodes.length, searching });
  }, [filteredNodes.length, nodes.length, searching, publishStats]);

  // 离开首页（比如进详情页）时清空统计，免得搜索面板显示上一次的命中数
  useEffect(() => () => resetStats(), [resetStats]);

  return (
    <div className="w-full space-y-2">
      {/* 轻量工具栏：左边统计，右边分组下拉（不再是一张大卡片） */}
      <div className="ds-node-bar">
        <div className="ds-node-bar-stat">
          <span className="ds-node-bar-dot" />
          {searching ? (
            <span>
              {t("search.results", {
                count: filteredNodes.length,
                total: nodes.length,
                defaultValue: `Found ${filteredNodes.length} nodes`,
              })}
            </span>
          ) : activeGroup === "all" ? (
            <span>
              {t("nodeCard.totalNodes", {
                total: nodes.length,
                online: liveData?.online?.length || 0,
                defaultValue: `${liveData?.online?.length || 0} Online / ${nodes.length} Total`,
              })}
            </span>
          ) : (
            <span>
              {t("nodeCard.groupNodes", {
                group: getGroupLabel(activeGroup, t),
                total: filteredNodes.length,
                online: onlineInGroup,
                defaultValue: `${onlineInGroup} Online in ${activeGroup}`,
              })}
            </span>
          )}
        </div>

        {showGroupSelector ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ds-node-bar-group"
                aria-label={t("common.group", { defaultValue: "分组" })}
              >
                <span className="ds-node-bar-group-label">
                  {t("common.group", { defaultValue: "分组" })}
                </span>
                <strong>{getGroupLabel(activeGroup, t)}</strong>
                <ChevronDown className="ds-node-bar-group-caret" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="ds-node-bar-menu">
              {["all", ...groups].map((group) => {
                const label = getGroupLabel(group, t);
                return (
                  <DropdownMenuItem
                    key={group}
                    className="ds-node-bar-menu-item"
                    onSelect={() => setSelectedGroup(group)}
                  >
                    <span>{label}</span>
                    {activeGroup === group ? <Check className="ds-node-bar-menu-check" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Node Display Area */}
      {filteredNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-lg border border-dashed">
          <span className="text-lg text-muted-foreground mb-2">
            {searching
              ? t("search.no_results", { defaultValue: "No matching nodes found" })
              : t("nodes.empty", { defaultValue: "No node data" })}
          </span>
          {searching && (
            <span className="text-sm text-muted-foreground">
              {t("search.try_different", {
                defaultValue: "Try different keywords",
              })}
            </span>
          )}
        </div>
      ) : (
        <>
          <NodeGrid nodes={filteredNodes} liveData={liveData} />
        </>
      )}
    </div>
  );
};

export default NodeDisplay;
