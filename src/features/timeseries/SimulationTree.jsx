import {
  Building2,
  Car,
  CircleDollarSign,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { useState } from "react";
import { isBauReference } from "./chart-presentation.js";

function SimulationTree({
  tree,
  communityItem,
  communityLabel,
  isCommunityActive,
  selectedItem,
  selectedBuildingIds,
  expanded,
  onSelectCommunity,
  onSelectBuilding,
  onSelectItem,
  onToggle,
  episodes,
  selectedEpisode,
  onEpisodeChange,
}) {
  const [query, setQuery] = useState("");
  const matchingBuildings = tree.buildings.filter((building) =>
    `${building.id} ${building.label}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const other = tree.other.filter((item) => !isBauReference(item));
  return (
    <aside className="result-tree-panel sim-tree-panel">
      <header className="sim-tree-head">
        {episodes.length > 1 && (
          <label className="select-field compact tree-episode-select">
            <span>Episode</span>
            <select
              value={selectedEpisode}
              onChange={(event) => onEpisodeChange(event.target.value)}
            >
              {episodes.map((episode) => (
                <option key={episode} value={episode}>
                  {episode ? `Episode ${episode.replace(/ep/i, "")}` : "All data"}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="sim-tree-headline">
          <small>Buildings & equipment</small>
          <span
            className="sim-tree-help"
            title="Ctrl/Cmd or Shift + click buildings to compare side by side."
          >
            ?
          </span>
        </div>
        <button
          type="button"
          className={isCommunityActive ? "sim-tree-context-btn is-active" : "sim-tree-context-btn"}
          onClick={onSelectCommunity}
          title="Show community charts"
        >
          <Building2 size={14} aria-hidden="true" />
          <span className="sim-tree-context-label">{communityItem?.label || communityLabel}</span>
        </button>
        <label className="tree-search search-box">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label="Find building"
            placeholder="Find building…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <ul className="sim-tree-list">
        {matchingBuildings.map((building) => (
          <TreeBuildingNode
            key={building.id}
            building={building}
            selectedItem={selectedItem}
            selectedBuildingIds={selectedBuildingIds}
            expanded={expanded}
            onSelectBuilding={onSelectBuilding}
            onSelectItem={onSelectItem}
            onToggle={onToggle}
          />
        ))}
        {query.trim() && !matchingBuildings.length && (
          <li className="tree-empty">No buildings match this search.</li>
        )}
        {tree.vehicles.length > 0 && (
          <TreeGroupNode
            id="vehicles"
            label="Electric vehicles"
            icon={Car}
            items={tree.vehicles}
            selectedItem={selectedItem}
            expanded={expanded}
            onSelectItem={onSelectItem}
            onToggle={onToggle}
          />
        )}
        {tree.pricing.length > 0 && (
          <TreeGroupNode
            id="pricing"
            label="Pricing"
            icon={CircleDollarSign}
            items={tree.pricing}
            selectedItem={selectedItem}
            expanded={expanded}
            onSelectItem={onSelectItem}
            onToggle={onToggle}
          />
        )}
        {other.length > 0 && (
          <TreeGroupNode
            id="other"
            label="Other"
            icon={FileSpreadsheet}
            items={other}
            selectedItem={selectedItem}
            expanded={expanded}
            onSelectItem={onSelectItem}
            onToggle={onToggle}
          />
        )}
      </ul>
    </aside>
  );
}

function TreeBuildingNode({
  building,
  selectedItem,
  selectedBuildingIds,
  expanded,
  onSelectBuilding,
  onSelectItem,
  onToggle,
}) {
  const isExpanded = expanded.has(building.id);
  const isCompared = selectedBuildingIds.has(building.id);
  const isSelected = selectedItem?.buildingId === building.id || isCompared;

  return (
    <li>
      <div
        className={`sim-tree-row is-root-level ${isSelected ? "is-selected" : ""} ${isCompared ? "is-compared" : ""}`}
      >
        <button
          type="button"
          className="sim-tree-toggle"
          onClick={() => onToggle(building.id)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          type="button"
          className="sim-tree-label"
          onClick={(event) =>
            onSelectBuilding(building.id, event.ctrlKey || event.metaKey || event.shiftKey)
          }
          title={building.label}
        >
          <span className="sim-tree-icon">
            <Building2 size={14} />
          </span>
          <span>{building.label}</span>
        </button>
      </div>

      {isExpanded ? (
        <ul className="sim-tree-list">
          {building.items.map((item) => (
            <TreeLeaf
              key={item.id}
              item={item}
              selectedItem={selectedItem}
              onSelect={onSelectItem}
            />
          ))}
          {building.chargers.map((item) => (
            <TreeLeaf
              key={item.id}
              item={item}
              selectedItem={selectedItem}
              onSelect={onSelectItem}
            />
          ))}
          {building.batteries.map((item) => (
            <TreeLeaf
              key={item.id}
              item={item}
              selectedItem={selectedItem}
              onSelect={onSelectItem}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeGroupNode({
  id,
  label,
  icon: Icon,
  items,
  selectedItem,
  expanded,
  onSelectItem,
  onToggle,
}) {
  const isOpen = expanded.has(id);

  return (
    <li>
      <div className="sim-tree-row is-group">
        <button className="sim-tree-toggle" type="button" onClick={() => onToggle(id)}>
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button className="sim-tree-label" type="button" onClick={() => onToggle(id)}>
          <span className="sim-tree-icon">
            <Icon size={14} />
          </span>
          <span>{label}</span>
        </button>
      </div>
      {isOpen && (
        <ul className="sim-tree-list">
          {items.map((item) => (
            <TreeLeaf
              key={item.id}
              item={item}
              selectedItem={selectedItem}
              onSelect={onSelectItem}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeLeaf({ item, selectedItem, onSelect }) {
  const Icon = item.icon;
  return (
    <li>
      <div className={selectedItem?.id === item.id ? "sim-tree-row is-selected" : "sim-tree-row"}>
        <span className="sim-tree-toggle is-spacer" />
        <button
          className="sim-tree-label"
          type="button"
          onClick={() => onSelect(item)}
          title={item.series.relativePath}
        >
          <span className="sim-tree-icon">
            <Icon size={14} />
          </span>
          <span>{item.label}</span>
        </button>
      </div>
    </li>
  );
}

export { SimulationTree };
