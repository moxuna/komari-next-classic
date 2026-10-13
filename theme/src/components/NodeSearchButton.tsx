"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNodeSearch } from "@/contexts/NodeSearchContext";

/** 判断事件来自输入类控件（避免 "/" 与 Esc 抢走正常输入） */
const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
};

/**
 * 导航栏右上角第一个按钮：节点搜索。
 * 点击后在按钮下方弹出小面板，输入即时过滤首页节点列表；再点按钮 / 点空白 / Esc 关闭。
 */
export default function NodeSearchButton() {
  const { t } = useTranslation();
  const { searchTerm, setSearchTerm, searchOpen, setSearchOpen, stats } = useNodeSearch();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pathname = usePathname() || "/";
  const router = useRouter();

  const label = t("search.button", { defaultValue: "搜索节点" });

  const openSearch = React.useCallback(() => {
    // 详情页没有节点列表，先回到首页再展开
    if (pathname !== "/") router.push("/");
    setSearchOpen(true);
  }, [pathname, router, setSearchOpen]);

  // 快捷键 "/" 打开搜索；Esc 的「先清空再关闭」交给 PopoverContent 的 onEscapeKeyDown（见下方面板）
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  return (
    <Popover open={searchOpen} onOpenChange={(open) => (open ? openSearch() : setSearchOpen(false))}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ds-node-search-btn h-9 w-9 shrink-0"
          aria-label={label}
          title={label}
        >
          <Search className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        onEscapeKeyDown={(event) => {
          // 先清空、再按一次才关闭（阻止 Radix 本次就关掉面板）
          if (searchTerm) {
            event.preventDefault();
            setSearchTerm("");
          }
        }}
        className="ds-node-search-panel"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="ds-node-search-field">
          <Search className="ds-node-search-field-icon" />
          <Input
            ref={inputRef}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("search.placeholder", {
              defaultValue: "按节点名称、地区、系统搜索…",
            })}
            aria-label={label}
            className="ds-node-search-input"
          />
          {searchTerm ? (
            <Button
              variant="ghost"
              size="icon"
              className="ds-node-search-clear"
              aria-label={t("common.clear", { defaultValue: "清空" })}
              onClick={() => {
                setSearchTerm("");
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="ds-node-search-meta">
          {stats.searching ? (
            <span>
              {t("search.results", {
                count: stats.filtered,
                total: stats.total,
                defaultValue: `Found ${stats.filtered} nodes`,
              })}
            </span>
          ) : (
            <span>
              {t("search.hint", {
                defaultValue: "支持名称、地区、系统、价格、状态",
              })}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
