export const MOCK_REPORTS = [
  {
    id: 'rep-001',
    apiId: '98e2c34a-9c71-464a-95b7-78152345d1fe',
    apiName: 'Finance Data Firehose',
    apiLogoUrl: null,
    reporterId: 'usr-900',
    reporterName: 'SecScanner Bot',
    reasonTag: 'Malicious Payload',
    description: 'Automated scan detected SQL injection vectors in the /v1/query endpoint parameters. Potential data exfiltration risk.',
    reportCount: 3,
    status: 'Open',
    severity: 'Critical',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rep-002',
    apiId: 'c2e2f34b-8d72-465b-96c8-89263456e2gf',
    apiName: 'Weather Maps Pro',
    apiLogoUrl: null,
    reporterId: 'usr-443',
    reporterName: 'Alice Johnson',
    reasonTag: 'Non-functional',
    description: 'The API consistently returns 502 Bad Gateway for the past 48 hours. I cannot use this for my app.',
    reportCount: 12,
    status: 'Investigating',
    severity: 'Medium',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'rep-003',
    apiId: 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',
    apiName: 'Fake User Generator',
    apiLogoUrl: null,
    reporterId: 'usr-112',
    reporterName: 'Bob Smith',
    reasonTag: 'Terms Violation',
    description: 'Provider is generating realistic PII which violates Klyra terms of service section 4.1 regarding synthetic data guidelines.',
    reportCount: 1,
    status: 'Open',
    severity: 'Low',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  }
];

export function getMockReports() {
  return MOCK_REPORTS.filter(r => r.status === 'Open' || r.status === 'Investigating');
}

export function resolveMockReportByApiId(apiId: string) {
  const report = MOCK_REPORTS.find(r => r.apiId === apiId);
  if (report) {
    report.status = 'Resolved';
  }
}
