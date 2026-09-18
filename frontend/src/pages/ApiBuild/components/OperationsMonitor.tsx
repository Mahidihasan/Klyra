import React from 'react';
import { Activity, X } from 'lucide-react';
import { OperationRecord, OPERATION_META, isOperationTerminal } from '../../../types/operations';

/**
 * OperationsMonitor — persistent status bar shown while any backend operation
 * is still running. Renders real executor progress (never simulated), and
 * collapses to a compact summary. Clicking anywhere expands the drawer.
 */
interface OperationsMonitorProps {
  operations: OperationRecord[];
  onSelect: (op: OperationRecord) => void;
  onOpenAll: () => void;
}

