import React from 'react';
import {
  FileText,
  Calendar,
  CloudSun,
  FileCheck2,
  CheckCircle2,
  Clock,
  AlertOctagon,
  AlertTriangle,
} from 'lucide-react';
import { StatCard } from '@/components/admin/common/StatCard';
import { FieldReportsTable } from '@/components/admin/fieldReports/FieldReportsTable';
import { ReportsLocationMap } from '@/components/admin/fieldReports/ReportsLocationMap';
import { ReportsByTypeChart } from '@/components/admin/fieldReports/ReportsByTypeChart';
import { ReportsTrendChart } from '@/components/admin/fieldReports/ReportsTrendChart';
import { ReportsByPriorityChart } from '@/components/admin/fieldReports/ReportsByPriorityChart';
import { RecentActivityFeed } from '@/components/admin/fieldReports/RecentActivityFeed';
import { useApp } from '@/contexts/AppContext';

export const FieldReportsPage = () => {
  const { reports, weather } = useApp();
  const rList = reports || [];
  const totalReports = rList.length;
  const resolved = rList.filter(r => r.status === 'Resolved').length;
  const pending = rList.filter(r => r.status === 'Pending').length;
  const inProgress = rList.filter(r => r.status === 'In Progress').length;

  return (
    <div className="field-reports-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <FileText size={24} color="#059669" />
            Field Reports
          </h1>
          <p>Manage, view and analyze all field reports submitted from the field.</p>
        </div>

        <div className="header-widgets-group">
          <div className="info-pill-card">
            <Calendar size={18} color="var(--text-muted)" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="info-pill-secondary">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="info-pill-card">
            <CloudSun size={20} color="#F59E0B" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{weather?.temp || '--'}</span>
              <span className="info-pill-secondary">{weather?.city || '--'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Required Banner when Reports are Pending */}
      {pending > 0 && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          backgroundColor: '#FFFBEB',
          border: '1.5px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#D97706" />
            <div>
              <strong style={{ fontSize: '13px', color: '#92400E' }}>
                ACTION REQUIRED: {pending} Field Incident Report{pending > 1 ? 's' : ''} Awaiting Admin Verification
              </strong>
              <div style={{ fontSize: '12px', color: '#B45309' }}>
                Ground field officers uploaded road damage / blockage evidence. Verify them to trigger automatic fleet rerouting.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5 KPI Stat Cards */}
      <div className="stat-card-grid">
        <StatCard
          title="Total Reports"
          value={totalReports}
          period="All Reports"
          icon={FileText}
          iconBg="#ECFDF5"
          iconColor="#059669"
        />

        <StatCard
          title="Reports This Month"
          value={inProgress}
          period="In Progress"
          icon={FileCheck2}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
        />

        <StatCard
          title="Resolved Reports"
          value={resolved}
          period="Resolved"
          icon={CheckCircle2}
          iconBg="#ECFDF5"
          iconColor="#059669"
        />

        <StatCard
          title="Pending Reports"
          value={pending}
          period="Pending Review"
          icon={Clock}
          iconBg="#FFFBEB"
          iconColor="#D97706"
        />

        <StatCard
          title="Overdue Reports"
          value={totalReports - resolved - pending - inProgress}
          period="Other"
          isDanger={true}
          icon={AlertOctagon}
          iconBg="#FEF2F2"
          iconColor="#EF4444"
        />
      </div>

      {/* Filter Toolbar & Data Table Section with Location Map & Reports by Type */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.8fr 1.2fr', marginBottom: '24px', alignItems: 'start' }}>
        <FieldReportsTable />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ReportsLocationMap />
          <ReportsByTypeChart />
        </div>
      </div>

      {/* Bottom Grid: Reports Trend, Reports by Priority, Recent Activity */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <ReportsTrendChart />
        <ReportsByPriorityChart />
        <RecentActivityFeed />
      </div>
    </div>
  );
};
