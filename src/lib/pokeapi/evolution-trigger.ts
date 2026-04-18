import type { EvolutionDetail } from "./client";

function titleCaseKebab(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Render a single evolution step as a short Dutch-ish label.
 *
 * PokéAPI packs lots of conditional metadata per detail entry; we pick the
 * most informative combination and fall back to a generic label if we
 * don't recognise the trigger.
 */
function formatOne(d: EvolutionDetail): string {
  const trigger = d.trigger?.name ?? "";
  const parts: string[] = [];

  if (trigger === "level-up") {
    if (d.min_level != null) parts.push(`Lv. ${d.min_level}`);
    else if (d.min_happiness != null) parts.push("Vriendschap");
    else if (d.min_affection != null) parts.push("Affectie");
    else if (d.min_beauty != null) parts.push("Schoonheid");
    else if (d.known_move) parts.push(`Leer ${titleCaseKebab(d.known_move.name)}`);
    else if (d.known_move_type) parts.push(`Ken ${titleCaseKebab(d.known_move_type.name)}-move`);
    else parts.push("Level up");

    if (d.time_of_day === "day") parts.push("(dag)");
    else if (d.time_of_day === "night") parts.push("(nacht)");
    if (d.needs_overworld_rain) parts.push("(regen)");
    if (d.location) parts.push(`@ ${titleCaseKebab(d.location.name)}`);
    if (d.held_item) parts.push(`+ ${titleCaseKebab(d.held_item.name)}`);
  } else if (trigger === "use-item" && d.item) {
    parts.push(titleCaseKebab(d.item.name));
  } else if (trigger === "trade") {
    parts.push("Ruil");
    if (d.held_item) parts.push(`+ ${titleCaseKebab(d.held_item.name)}`);
  } else if (trigger === "shed") {
    parts.push("Shed");
  } else if (trigger === "spin") {
    parts.push("Spin");
  } else if (trigger === "tower-of-darkness" || trigger === "tower-of-waters") {
    parts.push("Toren-training");
  } else if (trigger === "three-critical-hits") {
    parts.push("3× Critical");
  } else if (trigger === "take-damage") {
    parts.push("Schade ontvangen");
  } else if (trigger === "agile-style-move" || trigger === "strong-style-move") {
    parts.push(titleCaseKebab(trigger));
  } else {
    parts.push(trigger ? titleCaseKebab(trigger) : "Onbekend");
  }

  return parts.join(" ");
}

/** Take the array on an evolution-chain node and produce one short label
 * describing how the parent evolves into this node. Returns null when the
 * node has no details (i.e. it's the root of the chain). */
export function formatEvolutionTrigger(details: EvolutionDetail[]): string | null {
  if (!details || details.length === 0) return null;
  // Prefer details that actually specify a level — they're the most
  // informative and are typical for primary evolutions. Fall back to the
  // first entry otherwise.
  const leveled = details.find((d) => d.min_level != null);
  return formatOne(leveled ?? details[0]);
}
