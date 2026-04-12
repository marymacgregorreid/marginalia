import type { Suggestion, Paragraph } from "@/types";

/**
 * Builds a map of paragraph ID → accepted/modified suggestion (first match wins).
 */
function buildAcceptedMap(
  suggestions: readonly Suggestion[]
): Map<string, Suggestion> {
  const map = new Map<string, Suggestion>();
  for (const s of suggestions) {
    if (
      (s.status === "Accepted" || s.status === "Modified") &&
      !map.has(s.paragraphId)
    ) {
      map.set(s.paragraphId, s);
    }
  }
  return map;
}

/**
 * Returns the replacement text for an accepted or modified suggestion.
 */
function replacementText(s: Suggestion): string {
  return s.status === "Modified" && s.userSteeringInput
    ? s.userSteeringInput
    : s.proposedChange;
}

/**
 * Applies accepted/modified suggestions to paragraphs and returns new Paragraph
 * objects with merged text. Pending and rejected suggestions are ignored.
 */
export function mergeAcceptedSuggestionsToParagraphs(
  paragraphs: readonly Paragraph[],
  suggestions: readonly Suggestion[]
): Paragraph[] {
  const accepted = buildAcceptedMap(suggestions);
  return paragraphs.map((p) => {
    const s = accepted.get(p.id);
    return s ? { ...p, text: replacementText(s) } : p;
  });
}

/**
 * Applies accepted suggestions to paragraphs and returns the transformed full text.
 * Each accepted suggestion replaces the text of its target paragraph.
 */
export function applyAcceptedSuggestions(
  paragraphs: readonly Paragraph[],
  suggestions: readonly Suggestion[]
): string {
  return mergeAcceptedSuggestionsToParagraphs(paragraphs, suggestions)
    .map((p) => p.text)
    .join("\n\n");
}

export function getAcceptedSuggestionsCharacterCount(
  paragraphs: readonly Paragraph[],
  suggestions: readonly Suggestion[]
): number {
  return applyAcceptedSuggestions(paragraphs, suggestions).length;
}