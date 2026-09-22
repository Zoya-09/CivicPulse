import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Search,
  ThumbsUp,
  MapPin,
  Kanban,
  List,
  UserCheck,
  ShieldAlert,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  Camera,
  Database,
  Download,
  FileSpreadsheet,
  X,
  MessageSquare,
  Bell,
  Smartphone
} from 'lucide-react';
import { IssueReportSample } from '../types/civic';
import { CameraCapturePlaceholder, CapturedImageInfo } from './CameraCapturePlaceholder';
import { simulateSaveIncidentPhoto } from '../utils/civicMediaStorage';
import {
  CitizenNotificationSimulator,
  CitizenAlertMessage,
  generateAlertText
} from './CitizenNotificationSimulator';

interface DispatchQueueProps {
  incidents: IssueReportSample[];
  onUpvote: (id: string) => void;
  onStatusChange: (id: string, newStatus: IssueReportSample['status']) => void;
  onSelectOnMap: (id: string) => void;
  onOpenReportModal: () => void;
  onAttachPhoto?: (
    reportId: string,
    dataUrl: string,
    metadata?: IssueReportSample['imageStorageMetadata']
  ) => void;
  isDisasterMode: boolean;
}

export const DispatchQueue: React.FC<DispatchQueueProps> = ({
  incidents = [],
  onUpvote,
  onStatusChange,
  onSelectOnMap,
  onOpenReportModal,
  onAttachPhoto,
  isDisasterMode = false,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'priority' | 'upvotes' | 'daysOpen'>('priority');
  const [attachPhotoTargetReport, setAttachPhotoTargetReport] = useState<IssueReportSample | null>(null);
  const [pendingCapturedInfo, setPendingCapturedInfo] = useState<CapturedImageInfo | null>(null);
  const [modalPhoto, setModalPhoto] = useState<{
    url: string;
    reportTitle: string;
    reportId: string;
    bucket?: string;
    objectKey?: string;
  } | null>(null);

  // Citizen Alerts (SMS/WhatsApp) Simulation State
  const [isAlertsSimulationEnabled, setIsAlertsSimulationEnabled] = useState<boolean>(true);
  const [simulatorIncident, setSimulatorIncident] = useState<IssueReportSample | null>(null);
  const [simulatorTargetStatus, setSimulatorTargetStatus] = useState<IssueReportSample['status'] | undefined>(undefined);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [alertsHistory, setAlertsHistory] = useState<CitizenAlertMessage[]>([]);
  const [latestToastAlert, setLatestToastAlert] = useState<CitizenAlertMessage | null>(null);

  // Trigger automated or manual status change with citizen alert notification
  const handleStatusChangeWithAlert = (
    incidentId: string,
    newStatus: IssueReportSample['status']
  ) => {
    // Invoke parent status update (which persists in Firestore and React state)
    onStatusChange(incidentId, newStatus);

    // If citizen alerts simulation is toggled ON, generate alert record and trigger live notification
    if (isAlertsSimulationEnabled) {
      const targetInc = incidents.find((i) => i.id === incidentId);
      if (targetInc) {
        const channel: 'whatsapp' | 'sms' = 'whatsapp';
        const text = generateAlertText(targetInc, newStatus, channel);
        const newAlert: CitizenAlertMessage = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          incidentId: targetInc.id,
          incidentTitle: targetInc.title,
          recipientName: targetInc.reportedBy || 'Citizen',
          recipientPhone: '+91 98450 19284',
          channel,
          status: newStatus,
          content: text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          delivered: true,
          ward: targetInc.ward,
          city: targetInc.city,
        };

        setAlertsHistory((prev) => [newAlert, ...prev].slice(0, 50));
        setLatestToastAlert(newAlert);
        setTimeout(() => {
          setLatestToastAlert((curr) => (curr?.id === newAlert.id ? null : curr));
        }, 6500);
      }
    }
  };

  const handleManualTriggerSend = (
    incident: IssueReportSample,
    targetStatus: IssueReportSample['status'],
    channel: 'whatsapp' | 'sms'
  ) => {
    const text = generateAlertText(incident, targetStatus, channel);
    const newAlert: CitizenAlertMessage = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      incidentId: incident.id,
      incidentTitle: incident.title,
      recipientName: incident.reportedBy || 'Citizen',
      recipientPhone: '+91 98450 19284',
      channel,
      status: targetStatus,
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      delivered: true,
      ward: incident.ward,
      city: incident.city,
    };

    setAlertsHistory((prev) => [newAlert, ...prev].slice(0, 50));
    setLatestToastAlert(newAlert);
    setTimeout(() => {
      setLatestToastAlert((curr) => (curr?.id === newAlert.id ? null : curr));
    }, 6500);
  };

  // Available unique cities
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    (incidents || []).forEach((i) => {
      if (i.city) set.add(i.city);
    });
    return Array.from(set).sort();
  }, [incidents]);

  // Calculate dynamic priority score for each incident
  const enrichedIncidents = useMemo(() => {
    return (incidents || []).map((inc) => {
      // Base hazard multiplier
      let hazardWeight = inc.hazardWeight || 1.3;
      if (isDisasterMode) {
        // Disaster mode elevates flooding & electrical hazards to maximum urgency
        if (inc.category === 'drainage' || inc.category === 'streetlight') {
          hazardWeight *= 1.8;
        }
      }

      const baseScore = inc.severityScore * hazardWeight;
      const crowdMultiplier = 1 + Math.log(1 + inc.upvotes);
      const timeDecayFactor = 0.12;
      const timeMultiplier = 1 + inc.daysOpen * timeDecayFactor;
      const vulnerabilityIndex = inc.vulnerabilityFactor || 1.25;

      const raw = baseScore * crowdMultiplier * timeMultiplier * vulnerabilityIndex;
      const calculatedPriority = Math.min(100, Math.round(raw * 10) / 10);

      // Simulated SLA hours remaining (48h standard SLA minus daysOpen * 12)
      const slaRemainingHours = Math.max(2, Math.round(48 - inc.daysOpen * 8));

      return {
        ...inc,
        calculatedPriority,
        slaRemainingHours,
      };
    });
  }, [incidents, isDisasterMode]);

  // Filtered & Sorted incidents
  const filteredIncidents = useMemo(() => {
    return enrichedIncidents
      .filter((inc) => {
        const matchesCategory = categoryFilter === 'All' || inc.category === categoryFilter;
        const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;
        const matchesCity = cityFilter === 'All' || (inc.city && inc.city.toLowerCase().includes(cityFilter.toLowerCase()));
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          searchQuery === '' ||
          inc.id.toLowerCase().includes(query) ||
          inc.title.toLowerCase().includes(query) ||
          (inc.address && inc.address.toLowerCase().includes(query)) ||
          (inc.ward && inc.ward.toLowerCase().includes(query)) ||
          (inc.city && inc.city.toLowerCase().includes(query)) ||
          (inc.state && inc.state.toLowerCase().includes(query)) ||
          (inc.pincode && inc.pincode.toLowerCase().includes(query)) ||
          (inc.clusterLabel && inc.clusterLabel.toLowerCase().includes(query));

        return matchesCategory && matchesStatus && matchesCity && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return b.calculatedPriority - a.calculatedPriority;
        if (sortBy === 'upvotes') return b.upvotes - a.upvotes;
        if (sortBy === 'daysOpen') return b.daysOpen - a.daysOpen;
        return 0;
      });
  }, [enrichedIncidents, categoryFilter, statusFilter, cityFilter, searchQuery, sortBy]);

  // Priority tier helper
  const getPriorityTier = (score: number) => {
    if (score >= 70) return { label: 'CRITICAL', color: 'bg-red-50 text-red-700 border-red-200' };
    if (score >= 40) return { label: 'ELEVATED', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'ROUTINE', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const kanbanColumns: IssueReportSample['status'][] = [
    'Reported',
    'Corroborated',
    'Assigned',
    'In Progress',
    'Resolved',
  ];

  // Helper to escape and format CSV field values RFC 4180 style
  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) return '""';
    const stringified = String(field);
    return `"${stringified.replace(/"/g, '""')}"`;
  };

  // Export current triage ledger & incident data to CSV file
  const handleExportCsv = () => {
    // Columns to export covering complete triage, GIS, priority, and SLA details
    const headers = [
      'Ticket ID',
      'Title',
      'Category',
      'Status',
      'Calculated Priority Score',
      'Priority Tier',
      'Severity (1-10)',
      'Hazard Weight',
      'Vulnerability Factor',
      'Community Upvotes',
      'Days Open',
      'SLA Remaining (Hours)',
      'City',
      'State',
      'Ward',
      'Address',
      'Postal PIN',
      'Latitude',
      'Longitude',
      'Cluster Label',
      'Parent Cluster ID',
      'Reported At (ISO)',
      'Reported By',
      'Description',
      'Photo Evidence Stored'
    ];

    const rows = filteredIncidents.map((inc) => {
      const priorityTier = getPriorityTier(inc.calculatedPriority).label;
      const hasPhoto = inc.imagePreview ? 'Yes' : 'No';

      return [
        escapeCsvField(inc.id),
        escapeCsvField(inc.title),
        escapeCsvField(inc.category),
        escapeCsvField(inc.status),
        escapeCsvField(inc.calculatedPriority),
        escapeCsvField(priorityTier),
        escapeCsvField(inc.severityScore),
        escapeCsvField(inc.hazardWeight),
        escapeCsvField(inc.vulnerabilityFactor),
        escapeCsvField(inc.upvotes),
        escapeCsvField(inc.daysOpen),
        escapeCsvField(inc.slaRemainingHours),
        escapeCsvField(inc.city || ''),
        escapeCsvField(inc.state || ''),
        escapeCsvField(inc.ward || ''),
        escapeCsvField(inc.address || ''),
        escapeCsvField(inc.pincode || ''),
        escapeCsvField(inc.latitude),
        escapeCsvField(inc.longitude),
        escapeCsvField(inc.clusterLabel || ''),
        escapeCsvField(inc.parentClusterId || ''),
        escapeCsvField(inc.reportedAt || ''),
        escapeCsvField(inc.reportedBy || ''),
        escapeCsvField(inc.description || ''),
        escapeCsvField(hasPhoto)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsvField).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.setAttribute('download', `municipal_dispatch_triage_ledger_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Operations Header & Metrics */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-stone-900 text-white rounded-lg shadow-xs">
                <Activity className="w-5 h-5 text-emerald-400" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-stone-900">Municipal Dispatch &amp; Work Orders</h3>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg p-1 bg-stone-100 border border-stone-200 text-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Work Orders Table</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban Board</span>
              </button>
            </div>

            {/* Citizen SMS / WhatsApp Alerts Simulation Toggle */}
            <button
              id="btn-toggle-citizen-alerts"
              onClick={() => setIsAlertsSimulationEnabled(!isAlertsSimulationEnabled)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs ${
                isAlertsSimulationEnabled
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300/40'
                  : 'bg-stone-50 text-stone-600 border-stone-300 hover:bg-stone-100'
              }`}
              title="Toggle automated Citizen SMS & WhatsApp status notification simulation"
            >
              <MessageSquare className={`w-3.5 h-3.5 ${isAlertsSimulationEnabled ? 'text-emerald-600' : 'text-stone-400'}`} />
              <span>Citizen Alerts:</span>
              <span
                className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                  isAlertsSimulationEnabled ? 'bg-emerald-200 text-emerald-950' : 'bg-stone-200 text-stone-600'
                }`}
              >
                {isAlertsSimulationEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Alert Stream History Drawer Trigger */}
            <button
              id="btn-view-alerts-history"
              onClick={() => {
                setSimulatorIncident(incidents[0] || null);
                setSimulatorTargetStatus(incidents[0]?.status);
                setIsSimulatorOpen(true);
              }}
              className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-semibold rounded-lg border border-stone-300 flex items-center gap-1.5 shadow-2xs"
              title="Open Citizen SMS & WhatsApp notification simulator and delivery stream"
            >
              <Bell className="w-3.5 h-3.5 text-stone-600" />
              <span>Alerts</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-bold">
                {alertsHistory.length}
              </span>
            </button>

            {/* Export CSV Button */}
            <button
              id="btn-export-dispatch-csv"
              onClick={handleExportCsv}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-all border border-stone-300 flex items-center gap-1.5 shadow-2xs"
              title={`Export ${filteredIncidents.length} filtered incident work orders with triage scores and GIS coordinates to CSV for municipal reporting`}
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>Export CSV</span>
              <span className="text-[10px] font-mono bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full">
                {filteredIncidents.length}
              </span>
            </button>

            <button
              onClick={onOpenReportModal}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>+ New Incident</span>
            </button>
          </div>
        </div>

        {/* Operational Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-stone-100">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="text-[11px] font-medium text-stone-500">Total Active Incidents</div>
            <div className="text-xl font-bold text-stone-900 mt-0.5">{incidents.length}</div>
            <div className="text-[10px] text-stone-400 mt-0.5">Pan-India &amp; Major Metros</div>
          </div>
          <div className="p-3 bg-red-50/50 rounded-lg border border-red-100">
            <div className="text-[11px] font-medium text-red-700">Critical Priority (&gt;70)</div>
            <div className="text-xl font-bold text-red-800 mt-0.5">
              {enrichedIncidents.filter((i) => i.calculatedPriority >= 70).length}
            </div>
            <div className="text-[10px] text-red-600 mt-0.5">SLA response &lt; 8 hours</div>
          </div>
          <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-700">Corroborated Clusters</div>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">
              {incidents.filter((i) => i.status === 'Corroborated').length}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">DBSCAN deduplicated</div>
          </div>
          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <div className="text-[11px] font-medium text-blue-700">Dispatched / In Field</div>
            <div className="text-xl font-bold text-blue-800 mt-0.5">
              {incidents.filter((i) => i.status === 'Assigned' || i.status === 'In Progress').length}
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">Municipal field crews</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 mt-4 pt-4 border-t border-stone-100 items-center text-xs">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search by ID, street, ward, city, PIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400 font-medium"
            />
          </div>

          {/* City / State Filter */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <span className="text-stone-500 font-medium whitespace-nowrap">City:</span>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-800 font-medium focus:outline-none"
            >
              <option value="All">All Cities</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <span className="text-stone-500 font-medium whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-800 font-medium focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="pothole">Potholes</option>
              <option value="drainage">Drainage &amp; Floods</option>
              <option value="streetlight">Streetlights &amp; Wire</option>
              <option value="water_leak">Water Leaks</option>
              <option value="garbage">Waste Overflow</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <span className="text-stone-500 font-medium whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-800 font-medium focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Reported">Reported</option>
              <option value="Corroborated">Corroborated</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <span className="text-stone-500 font-medium whitespace-nowrap">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-800 font-medium focus:outline-none"
            >
              <option value="priority">Priority Score</option>
              <option value="upvotes">Upvotes</option>
              <option value="daysOpen">Days Open</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Ticket / ID</th>
                  <th className="py-3 px-4">Hazard &amp; Description</th>
                  <th className="py-3 px-4">Ward / Location</th>
                  <th className="py-3 px-4 text-center">Score / Tier</th>
                  <th className="py-3 px-4 text-center">SLA Clock</th>
                  <th className="py-3 px-4 text-center">Community</th>
                  <th className="py-3 px-4">Status &amp; Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400">
                      No matching work orders found. Try adjusting your filters or search query.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((incident) => {
                    const tier = getPriorityTier(incident.calculatedPriority);
                    const isAnchor = !incident.parentClusterId;

                    return (
                      <tr key={incident.id} className="hover:bg-stone-50/70 transition-colors">
                        {/* ID Column */}
                        <td className="py-3.5 px-4 font-mono font-bold text-stone-900 whitespace-nowrap align-top">
                          <div className="flex items-center gap-1.5">
                            <span>{incident.id}</span>
                            {isAnchor ? (
                              <span className="text-[9px] px-1.5 py-0.2 bg-stone-900 text-white rounded font-sans font-semibold">
                                ANCHOR
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded font-sans font-medium">
                                CORROB
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-400 font-normal font-sans mt-0.5">
                            {incident.daysOpen}d ago
                          </div>
                        </td>

                        {/* Title & Description */}
                        <td className="py-3.5 px-4 max-w-xs align-top">
                          <div className="font-semibold text-stone-900 text-xs leading-snug">
                            {incident.title}
                          </div>
                          {incident.description && (
                            <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">
                              {incident.description}
                            </div>
                          )}
                          {incident.clusterLabel && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              <span>Cluster:</span>
                              <span className="font-semibold">{incident.clusterLabel}</span>
                            </div>
                          )}

                          {incident.imagePreview && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <img
                                src={incident.imagePreview}
                                alt="Field photo"
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 object-cover rounded-md border border-stone-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() =>
                                  setModalPhoto({
                                    url: incident.imagePreview!,
                                    reportTitle: incident.title,
                                    reportId: incident.id,
                                    bucket: incident.imageStorageMetadata?.storageBucket,
                                    objectKey: incident.imageStorageMetadata?.objectKey,
                                  })
                                }
                              />
                              <div className="text-[10px] font-mono text-stone-500">
                                <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                                  <Camera className="w-3 h-3" />
                                  <span>Field Evidence</span>
                                </div>
                                <span className="text-stone-400 truncate max-w-[120px] block">
                                  {incident.imageStorageMetadata?.objectKey || 'capture.jpg'}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Location / Ward */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="font-semibold text-stone-900 text-xs flex items-center gap-1">
                            <span>{incident.city || incident.ward || 'Municipal Ward'}</span>
                            {incident.state && (
                              <span className="text-[10px] text-stone-400 font-normal">({incident.state})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500 max-w-[200px] truncate mt-0.5" title={incident.address}>
                            {incident.address || incident.ward}
                          </div>
                          {incident.pincode && (
                            <div className="text-[10px] font-mono text-stone-400">PIN: {incident.pincode}</div>
                          )}
                          <button
                            onClick={() => onSelectOnMap(incident.id)}
                            className="mt-1 text-[10.5px] text-stone-600 hover:text-stone-950 font-semibold flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3 text-red-500" />
                            <span>View on Map</span>
                          </button>
                        </td>

                        {/* Calculated Priority Score */}
                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                          <div className="font-mono font-bold text-base text-stone-900">
                            {incident.calculatedPriority}
                          </div>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mt-0.5 ${tier.color}`}
                          >
                            {tier.label}
                          </span>
                        </td>

                        {/* SLA Clock */}
                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 text-stone-700 font-mono font-medium">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{incident.slaRemainingHours}h left</span>
                          </div>
                          <div className="w-16 h-1.5 bg-stone-100 rounded-full mx-auto mt-1.5 overflow-hidden">
                            <div
                              className={`h-full ${
                                incident.slaRemainingHours < 12 ? 'bg-red-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (incident.slaRemainingHours / 48) * 100)}%` }}
                            />
                          </div>
                        </td>

                        {/* Community Upvotes */}
                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                          <button
                            onClick={() => onUpvote(incident.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 font-semibold transition-all hover:scale-105 active:scale-95"
                            title="Upvote / Corroborate this hazard"
                          >
                            <ThumbsUp className="w-3 h-3 text-stone-500" />
                            <span className="font-mono">{incident.upvotes}</span>
                          </button>
                        </td>

                        {/* Status & Action Select */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="space-y-1.5">
                            <select
                              value={incident.status}
                              onChange={(e) =>
                                handleStatusChangeWithAlert(incident.id, e.target.value as IssueReportSample['status'])
                              }
                              className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none ${
                                incident.status === 'Resolved'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : incident.status === 'In Progress'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : incident.status === 'Assigned'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : incident.status === 'Corroborated'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-stone-50 text-stone-800 border-stone-200'
                              }`}
                            >
                              <option value="Reported">Reported</option>
                              <option value="Corroborated">Corroborated</option>
                              <option value="Assigned">Assigned (Crew)</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                            </select>

                            <div className="text-[10px] text-stone-400">
                              By: {incident.reportedBy || 'Citizen'}
                            </div>

                            <div className="grid grid-cols-2 gap-1 pt-0.5">
                              {/* Add / Update Incident Photo Button */}
                              <button
                                id={`btn-queue-photo-${incident.id}`}
                                type="button"
                                onClick={() => {
                                  setAttachPhotoTargetReport(incident);
                                  setPendingCapturedInfo(null);
                                }}
                                className="text-[10px] px-1.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-semibold flex items-center justify-center gap-0.5 transition-colors active:scale-95"
                                title="Attach or update field evidence photo with Camera API"
                              >
                                <Camera className="w-2.5 h-2.5 text-blue-600" />
                                <span>{incident.imagePreview ? 'Photo' : '+Photo'}</span>
                              </button>

                              {/* Simulate Citizen Alert Button */}
                              <button
                                id={`btn-queue-alert-${incident.id}`}
                                type="button"
                                onClick={() => {
                                  setSimulatorIncident(incident);
                                  setSimulatorTargetStatus(incident.status);
                                  setIsSimulatorOpen(true);
                                }}
                                className="text-[10px] px-1.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-semibold flex items-center justify-center gap-0.5 transition-colors border border-emerald-200 active:scale-95"
                                title="Preview or test SMS / WhatsApp notification to citizen"
                              >
                                <MessageSquare className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Alert</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {kanbanColumns.map((colStatus) => {
            const colItems = filteredIncidents.filter((i) => i.status === colStatus);

            return (
              <div
                key={colStatus}
                className="bg-stone-100/80 rounded-xl p-3 border border-stone-200 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-200/80">
                  <div className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                    <span>{colStatus}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-bold">
                      {colItems.length}
                    </span>
                  </div>
                </div>

                {/* Column Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
                  {colItems.length === 0 ? (
                    <div className="text-center py-10 text-[11px] text-stone-400">
                      No reports in this state
                    </div>
                  ) : (
                    colItems.map((item) => {
                      const tier = getPriorityTier(item.calculatedPriority);

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-lg p-3 border border-stone-200 shadow-2xs hover:shadow-xs transition-shadow space-y-2"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold text-stone-800">{item.id}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border ${tier.color}`}
                            >
                              P:{item.calculatedPriority}
                            </span>
                          </div>

                          <h5 className="font-semibold text-stone-900 text-xs leading-snug line-clamp-2">
                            {item.title}
                          </h5>

                          <div className="text-[10.5px] text-stone-600 line-clamp-1">
                            <span className="font-semibold text-stone-800">{item.city ? `${item.city} • ` : ''}</span>
                            <span>{item.address || item.ward}</span>
                          </div>

                          {/* Kanban Photo Thumbnail if present */}
                          {item.imagePreview && (
                            <div
                              className="relative rounded overflow-hidden border border-stone-200 cursor-pointer group/kphoto"
                              onClick={() =>
                                setModalPhoto({
                                  url: item.imagePreview!,
                                  reportTitle: item.title,
                                  reportId: item.id,
                                  bucket: item.imageStorageMetadata?.storageBucket,
                                  objectKey: item.imageStorageMetadata?.objectKey,
                                })
                              }
                            >
                              <img
                                src={item.imagePreview}
                                alt="Field evidence"
                                referrerPolicy="no-referrer"
                                className="w-full h-24 object-cover group-hover/kphoto:opacity-90 transition-opacity"
                              />
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-stone-900/80 text-white rounded text-[9px] font-mono flex items-center gap-1">
                                <Camera className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Evidence</span>
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onUpvote(item.id)}
                                className="flex items-center gap-1 text-stone-600 hover:text-stone-900 font-mono text-[10.5px]"
                                title="Upvote"
                              >
                                <ThumbsUp className="w-3 h-3 text-stone-400" />
                                <span>{item.upvotes}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setAttachPhotoTargetReport(item);
                                  setPendingCapturedInfo(null);
                                }}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
                                title="Add or update photo"
                              >
                                <Camera className="w-3 h-3" />
                                <span>{item.imagePreview ? 'Photo' : 'Add Photo'}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Simulate Citizen Alert Quick Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSimulatorIncident(item);
                                  setSimulatorTargetStatus(item.status);
                                  setIsSimulatorOpen(true);
                                }}
                                className="text-[10px] text-emerald-700 hover:text-emerald-950 font-semibold flex items-center gap-0.5"
                                title="Simulate SMS/WhatsApp notification"
                              >
                                <MessageSquare className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Alert</span>
                              </button>

                              {/* Status Quick Progress Button */}
                              {colStatus !== 'Resolved' && (
                                <button
                                  onClick={() => {
                                    const nextIdx = kanbanColumns.indexOf(colStatus) + 1;
                                    if (nextIdx < kanbanColumns.length) {
                                      handleStatusChangeWithAlert(item.id, kanbanColumns[nextIdx]);
                                    }
                                  }}
                                  className="text-[10px] font-bold text-stone-700 hover:text-stone-950 flex items-center gap-0.5"
                                >
                                  <span>Advance</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incident Add/Update Photo Modal */}
      {attachPhotoTargetReport && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            setAttachPhotoTargetReport(null);
            setPendingCapturedInfo(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 leading-tight">
                    Add Photo Evidence to Incident
                  </h4>
                  <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                    {attachPhotoTargetReport.id} &bull; {attachPhotoTargetReport.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAttachPhotoTargetReport(null);
                  setPendingCapturedInfo(null);
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 text-xs flex items-center justify-between">
                <div>
                  <span className="text-stone-400 font-mono text-[10.5px]">Location:</span>
                  <p className="font-semibold text-stone-800 text-xs">
                    📍 {attachPhotoTargetReport.city ? `${attachPhotoTargetReport.city}, ` : ''}
                    {attachPhotoTargetReport.address || attachPhotoTargetReport.ward}
                  </p>
                </div>
                <span className="text-[10.5px] font-mono px-2 py-0.5 bg-white border border-stone-200 rounded text-stone-600">
                  {attachPhotoTargetReport.status}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  Take Photo or Upload Evidence
                </label>
                <CameraCapturePlaceholder
                  onImageCaptured={(info) => setPendingCapturedInfo(info)}
                  currentImage={pendingCapturedInfo?.dataUrl || attachPhotoTargetReport.imagePreview}
                  locationName={attachPhotoTargetReport.address || attachPhotoTargetReport.ward}
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setAttachPhotoTargetReport(null);
                    setPendingCapturedInfo(null);
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-lg transition-colors"
                >
                  Cancel
                </button>

                <button
                  id="btn-save-dispatch-photo"
                  type="button"
                  disabled={!pendingCapturedInfo}
                  onClick={() => {
                    if (pendingCapturedInfo) {
                      const mediaRecord = simulateSaveIncidentPhoto(
                        attachPhotoTargetReport.id,
                        pendingCapturedInfo.dataUrl,
                        {
                          deviceSource: pendingCapturedInfo.source,
                          resolution: pendingCapturedInfo.resolution,
                        }
                      );
                      const metadata = {
                        storageBucket: mediaRecord.storageBucket,
                        objectKey: mediaRecord.objectKey,
                        fileSizeBytes: mediaRecord.fileSizeBytes,
                        capturedAt: mediaRecord.capturedAt,
                        deviceSource: mediaRecord.deviceSource,
                        resolution: mediaRecord.resolution,
                      };
                      if (onAttachPhoto) {
                        onAttachPhoto(
                          attachPhotoTargetReport.id,
                          pendingCapturedInfo.dataUrl,
                          metadata
                        );
                      }
                      setAttachPhotoTargetReport(null);
                      setPendingCapturedInfo(null);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Save Photo to Incident</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Dialog */}
      {modalPhoto && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setModalPhoto(null)}
        >
          <div
            className="bg-stone-900 border border-stone-700 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white truncate max-w-[280px]">
                  {modalPhoto.reportTitle}
                </span>
              </div>
              <button
                onClick={() => setModalPhoto(null)}
                className="p-1 text-stone-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-stone-950/60 flex items-center justify-center max-h-[380px] overflow-hidden">
              <img
                src={modalPhoto.url}
                alt={modalPhoto.reportTitle}
                referrerPolicy="no-referrer"
                className="max-h-[360px] max-w-full rounded object-contain"
              />
            </div>
            <div className="p-3 bg-stone-950 border-t border-stone-800 text-[11px] font-mono text-stone-400 flex items-center justify-between">
              <span>{modalPhoto.objectKey || `incidents/${modalPhoto.reportId}/evidence.jpg`}</span>
              <button
                onClick={() => setModalPhoto(null)}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-white rounded text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Real-time Citizen Notification Toast */}
      {latestToastAlert && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm w-full bg-stone-900 text-white p-3.5 rounded-xl border border-stone-700 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                Citizen Alert Dispatched ({latestToastAlert.channel.toUpperCase()})
              </span>
            </div>
            <button
              onClick={() => setLatestToastAlert(null)}
              className="text-stone-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1.5 text-xs text-stone-200 line-clamp-2">
            #{latestToastAlert.incidentId}: Status updated to{' '}
            <span className="font-semibold text-white">{latestToastAlert.status}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-stone-800 flex items-center justify-between">
            <span className="text-[10px] text-stone-400 font-mono">
              Delivered to {latestToastAlert.recipientPhone}
            </span>
            <button
              onClick={() => {
                const targetInc = incidents.find((i) => i.id === latestToastAlert.incidentId);
                if (targetInc) {
                  setSimulatorIncident(targetInc);
                  setSimulatorTargetStatus(latestToastAlert.status);
                  setIsSimulatorOpen(true);
                  setLatestToastAlert(null);
                }
              }}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline"
            >
              View Message
            </button>
          </div>
        </div>
      )}

      {/* Citizen Notification Simulator Modal */}
      <CitizenNotificationSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        activeIncident={simulatorIncident}
        newStatus={simulatorTargetStatus}
        alertsHistory={alertsHistory}
        onClearHistory={() => setAlertsHistory([])}
        onTriggerSend={handleManualTriggerSend}
      />
    </div>
  );
};
