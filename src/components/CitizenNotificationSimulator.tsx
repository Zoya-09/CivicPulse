import React, { useState } from 'react';
import {
  MessageSquare,
  Smartphone,
  CheckCheck,
  Copy,
  Check,
  Send,
  X,
  Bell,
  ExternalLink,
  ShieldCheck,
  Clock,
  MapPin,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { IssueReportSample } from '../types/civic';

export interface CitizenAlertMessage {
  id: string;
  incidentId: string;
  incidentTitle: string;
  recipientName: string;
  recipientPhone: string;
  channel: 'whatsapp' | 'sms';
  status: IssueReportSample['status'];
  content: string;
  timestamp: string;
  delivered: boolean;
  ward?: string;
  city?: string;
}

interface CitizenNotificationSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  activeIncident: IssueReportSample | null;
  newStatus?: IssueReportSample['status'];
  alertsHistory: CitizenAlertMessage[];
  onClearHistory: () => void;
  onTriggerSend: (incident: IssueReportSample, targetStatus: IssueReportSample['status'], channel: 'whatsapp' | 'sms') => void;
}

export const generateAlertText = (
  incident: IssueReportSample,
  status: IssueReportSample['status'],
  channel: 'whatsapp' | 'sms'
): string => {
  const citizen = incident.reportedBy || 'Citizen';
  const location = incident.ward ? `${incident.ward}${incident.city ? `, ${incident.city}` : ''}` : (incident.city || 'Municipal Ward');
  const ticketRef = incident.id.startsWith('#') ? incident.id : `#${incident.id}`;
  const shortUrl = `civicpulse.gov.in/t/${incident.id.replace('#', '')}`;

  if (channel === 'whatsapp') {
    switch (status) {
      case 'Corroborated':
        return `*CivicPulse Municipal Update*\n\nNamaste *${citizen}*,\n\nYour civic report *${ticketRef}* (*${incident.title}* at ${location}) has received corroborating community reports and is escalated to *Elevated Priority*.\n\n*Ward*: ${location}\n*Community Confirmations*: ${incident.upvotes + 1}\n\nTrack progress: https://${shortUrl}`;
      case 'Assigned':
        return `*CivicPulse Municipal Dispatch*\n\nNamaste *${citizen}*,\n\nGood news! Your complaint *${ticketRef}* has been officially assigned to the *${incident.ward || 'Zone'} Public Works & Rapid Action Crew*.\n\n*Assigned Crew*: Team Delta-${incident.ward || 'Alpha'}\n*Estimated Response*: Within 24-48 hrs\n\nLive tracking: https://${shortUrl}`;
      case 'In Progress':
        return `*CivicPulse Field Operations*\n\nNamaste *${citizen}*,\n\nField technicians have arrived at *${incident.address || location}* and repair operations for *${ticketRef}* (*${incident.title}*) are actively *In Progress*.\n\nThank you for your patience while we restore civic infrastructure.\n\nDetails: https://${shortUrl}`;
      case 'Resolved':
        return `*CivicPulse - Complaint Resolved*\n\nNamaste *${citizen}*,\n\nYour reported issue *${ticketRef}* (*${incident.title}*) in ${location} has been successfully *RESOLVED* by the municipal contractor.\n\nThank you for being an active civic guardian! Tap below to verify quality and submit feedback:\nhttps://${shortUrl}/verify`;
      default: // Reported
        return `*CivicPulse Complaint Acknowledgement*\n\nNamaste *${citizen}*,\n\nYour civic complaint *${ticketRef}* for *${incident.title}* has been logged in the Municipal Triage System.\n\n*Ward*: ${location}\n*Initial SLA Target*: 48 hrs\n\nTrack live status: https://${shortUrl}`;
    }
  } else {
    // SMS Plain Format
    switch (status) {
      case 'Corroborated':
        return `[GOV-CIVIC] Update for ${ticketRef}: Multiple citizens corroborated your issue (${incident.title}) in ${location}. Priority boosted. Track: ${shortUrl}`;
      case 'Assigned':
        return `[GOV-CIVIC] Work Order #${ticketRef} (${incident.title}) is assigned to ${incident.ward || 'Ward'} Field Crew. Target response: 24h. Track: ${shortUrl}`;
      case 'In Progress':
        return `[GOV-CIVIC] Crew is on-site at ${incident.address || location} working on ${ticketRef}. Updates: ${shortUrl}`;
      case 'Resolved':
        return `[GOV-CIVIC] Your complaint ${ticketRef} (${incident.title}) has been marked RESOLVED by Municipal Works. Rate resolution: ${shortUrl}`;
      default:
        return `[GOV-CIVIC] Complaint ${ticketRef} registered for ${incident.title} at ${location}. SLA: 48h. Track: ${shortUrl}`;
    }
  }
};

export const CitizenNotificationSimulator: React.FC<CitizenNotificationSimulatorProps> = ({
  isOpen,
  onClose,
  activeIncident,
  newStatus,
  alertsHistory,
  onClearHistory,
  onTriggerSend,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');
  const [copied, setCopied] = useState<boolean>(false);
  const [recipientPhone, setRecipientPhone] = useState<string>('+91 98450 19284');

  if (!isOpen || !activeIncident) return null;

  const currentStatus = newStatus || activeIncident.status;
  const messageContent = generateAlertText(activeIncident, currentStatus, selectedChannel);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendNow = () => {
    onTriggerSend(activeIncident, currentStatus, selectedChannel);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">
                  Citizen Alert Simulator
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SMS &amp; WhatsApp
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Simulated automated status dispatch for #{activeIncident.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Preview vs History) */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-stone-200 bg-stone-50 text-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('preview')}
              className={`pb-2.5 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Live Phone Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Sent Alerts Stream</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700">
                {alertsHistory.length}
              </span>
            </button>
          </div>

          {/* Channel Selector: WhatsApp vs SMS */}
          {activeTab === 'preview' && (
            <div className="inline-flex rounded-lg p-0.5 bg-stone-200 text-[11px] font-semibold mb-2">
              <button
                onClick={() => setSelectedChannel('whatsapp')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                  selectedChannel === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-950'
                }`}
              >
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => setSelectedChannel('sms')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                  selectedChannel === 'sms'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-950'
                }`}
              >
                <span>SMS</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'preview' ? (
            <div className="space-y-4">
              {/* Incident & Recipient Context Pill */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-stone-900 bg-stone-200 px-2 py-0.5 rounded">
                    #{activeIncident.id}
                  </span>
                  <span className="font-semibold text-stone-800 truncate max-w-[200px]">
                    {activeIncident.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-stone-600">
                  <span>Target Status:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      currentStatus === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : currentStatus === 'In Progress'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : currentStatus === 'Assigned'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {currentStatus}
                  </span>
                </div>
              </div>

              {/* Recipient Phone Input */}
              <div className="flex items-center justify-between text-xs gap-3">
                <label className="text-stone-600 font-medium whitespace-nowrap">
                  Citizen Mobile Number:
                </label>
                <div className="flex-1 max-w-[220px]">
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                  />
                </div>
              </div>

              {/* PHONE MOCKUP / MESSAGE CONTAINER */}
              {selectedChannel === 'whatsapp' ? (
                /* WHATSAPP MOCKUP */
                <div className="rounded-xl border border-stone-300 overflow-hidden shadow-sm bg-[#EFEAE2]">
                  {/* WhatsApp Header */}
                  <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white shadow-inner">
                        CP
                      </div>
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1 leading-tight">
                          <span>CivicPulse Municipal Corp</span>
                          <span className="w-3 h-3 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center text-[8px] font-bold">
                            ✓
                          </span>
                        </div>
                        <div className="text-[10px] text-emerald-100 font-normal">Official Verified Account</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-100 font-mono">Today, Just Now</div>
                  </div>

                  {/* WhatsApp Message Bubble */}
                  <div className="p-3.5 space-y-2">
                    <div className="bg-white rounded-lg rounded-tl-xs p-3 shadow-xs max-w-[92%] border border-stone-200/60 relative">
                      <div className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed font-sans">
                        {messageContent}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-stone-400 font-mono">
                        <span>12:42 PM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Simulated Action Footer */}
                  <div className="bg-stone-100 border-t border-stone-200 px-3 py-2 flex items-center justify-between text-[11px] text-stone-600">
                    <span className="flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>End-to-end encrypted notification</span>
                    </span>
                    <span className="font-mono text-[10px] text-stone-500">Gateway: Gupshup / Twilio</span>
                  </div>
                </div>
              ) : (
                /* SMS MOCKUP */
                <div className="rounded-xl border border-stone-300 overflow-hidden shadow-sm bg-stone-100">
                  {/* SMS Header */}
                  <div className="bg-stone-800 text-white px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-xs font-mono text-stone-200">
                        SMS
                      </div>
                      <div>
                        <div className="font-bold text-xs font-mono">GOV-CIVIC</div>
                        <div className="text-[10px] text-stone-300">National Civic Gateway</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">Carrier: SMS-DND Exempt</div>
                  </div>

                  {/* SMS Bubble */}
                  <div className="p-3.5">
                    <div className="bg-white rounded-xl p-3 border border-stone-200 text-xs text-stone-800 whitespace-pre-wrap leading-relaxed font-mono shadow-2xs">
                      {messageContent}
                      <div className="mt-2 text-[10px] text-stone-400 text-right">
                        Sent to {recipientPhone} • Delivered
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-50 border-t border-stone-200 px-3 py-1.5 text-[10.5px] text-stone-500 flex items-center justify-between">
                    <span>Standard rate alerts</span>
                    <span className="font-mono text-[10px]">Route: Trans-Gov-Priority</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* HISTORY / SENT ALERTS STREAM */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700">Recent Dispatched Alerts</span>
                {alertsHistory.length > 0 && (
                  <button
                    onClick={onClearHistory}
                    className="text-stone-500 hover:text-red-600 transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear stream</span>
                  </button>
                )}
              </div>

              {alertsHistory.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-500 text-xs">
                  <Bell className="w-6 h-6 mx-auto mb-2 text-stone-400 opacity-60" />
                  <p className="font-semibold text-stone-700">No simulated alerts sent yet</p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Change ticket status or click &quot;Dispatch Simulated Alert&quot; to test the citizen delivery stream.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {alertsHistory.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              alert.channel === 'whatsapp'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-800'
                            }`}
                          >
                            {alert.channel}
                          </span>
                          <span className="font-mono font-bold text-stone-900">
                            #{alert.incidentId}
                          </span>
                          <span className="font-semibold text-stone-800 truncate max-w-[150px]">
                            {alert.incidentTitle}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {alert.timestamp}
                        </span>
                      </div>

                      <p className="text-stone-700 text-[11.5px] leading-relaxed line-clamp-3 bg-white p-2 rounded border border-stone-100">
                        {alert.content}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1">
                        <span className="flex items-center gap-1">
                          <CheckCheck className="w-3 h-3 text-blue-500" />
                          <span>Delivered to {alert.recipientPhone}</span>
                        </span>
                        <span className="font-semibold text-stone-700">
                          Status: {alert.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
            <span>{copied ? 'Copied' : 'Copy Message Text'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSendNow}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispatch Simulated Alert</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
