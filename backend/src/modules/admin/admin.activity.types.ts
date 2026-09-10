export interface AdminAuditLog {
  id: string;
  userId: string | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  severity: string;
  ipAddress: string | null;
  createdAt: Date;
}
