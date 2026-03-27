import type { ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div className="tabs" data-testid="tabs">
      <div className="tabs__list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tabs__tab ${tab.key === activeTab ? "tabs__tab--active" : ""}`}
            data-testid={`tab-${tab.key}`}
            role="tab"
            aria-selected={tab.key === activeTab}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs__content" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
