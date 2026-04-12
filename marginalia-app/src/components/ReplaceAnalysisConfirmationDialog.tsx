import { useState, useCallback } from "react";
import type { Suggestion } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface ReplaceAnalysisConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acceptedSuggestions: Suggestion[];
  pendingCount: number;
  rejectedCount: number;
  onConfirm: () => void;
}

/**
 * Builds the primary summary line shown in the alert.
 * Describes what will be discarded and what will be merged.
 */
export function buildSummaryMessage(
  acceptedCount: number,
  pendingCount: number,
  rejectedCount: number,
): string {
  // Build the "discarded" part from non-accepted counts
  const discardParts: string[] = [];
  if (pendingCount > 0) {
    discardParts.push(`${pendingCount} pending`);
  }
  if (rejectedCount > 0) {
    discardParts.push(`${rejectedCount} rejected`);
  }

  const discardLabel = discardParts.length > 0
    ? discardParts.join(" and ")
    : null;

  const plural = (n: number) => (n !== 1 ? "s" : "");

  if (acceptedCount > 0 && discardLabel) {
    return `Your ${acceptedCount} accepted suggestion${plural(acceptedCount)} will be merged into the manuscript. The ${discardLabel} suggestion${plural(pendingCount + rejectedCount)} will be discarded.`;
  }

  if (acceptedCount > 0) {
    return `Your ${acceptedCount} accepted suggestion${plural(acceptedCount)} will be merged into the manuscript before re-analysis.`;
  }

  if (discardLabel) {
    return `All ${discardLabel} suggestion${plural(pendingCount + rejectedCount)} will be discarded and replaced with new analysis results.`;
  }

  return "All existing suggestions will be replaced with new analysis results.";
}

export function ReplaceAnalysisConfirmationDialog({
  open,
  onOpenChange,
  acceptedSuggestions,
  pendingCount,
  rejectedCount,
  onConfirm,
}: ReplaceAnalysisConfirmationDialogProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const summary = buildSummaryMessage(
    acceptedSuggestions.length,
    pendingCount,
    rejectedCount,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        aria-describedby="replace-analysis-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Replace Analysis?
          </DialogTitle>
          <DialogDescription id="replace-analysis-dialog-description">
            This document has been analyzed before.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertDescription className="text-amber-900 dark:text-amber-100">
              <div className="font-medium mb-1">
                {summary}
              </div>
            </AlertDescription>
          </Alert>

          {acceptedSuggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm font-medium text-left"
              >
                <span>
                  Accepted Suggestions to Merge ({acceptedSuggestions.length})
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 opacity-50" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                )}
              </button>

              {isExpanded && (
                <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                  <div className="flex flex-col divide-y bg-muted/30">
                    {acceptedSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <Badge className="mt-0.5 shrink-0" variant="secondary">
                            #{acceptedSuggestions.indexOf(suggestion) + 1}
                          </Badge>
                        </div>
                        <p className="text-xs line-clamp-2 text-muted-foreground">
                          {suggestion.proposedChange}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Replace & Analyze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

