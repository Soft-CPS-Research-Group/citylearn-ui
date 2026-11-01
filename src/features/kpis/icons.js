import {
  CircleDollarSign,
  Factory,
  Sun,
  Car,
  BatteryCharging,
  PlugZap,
  Building2,
  Table2,
  Database,
} from "lucide-react";

function resolveKpiFamilyIcon(family) {
  if (family === "cost") return CircleDollarSign;
  if (family === "emissions") return Factory;
  if (family === "solar_self_consumption") return Sun;
  if (family === "ev") return Car;
  if (family === "battery") return BatteryCharging;
  if (family === "electrical_service_phase" || family === "energy_grid") return PlugZap;
  if (family === "comfort_resilience") return Building2;
  if (family === "equity") return Table2;
  return Database;
}

export { resolveKpiFamilyIcon };
