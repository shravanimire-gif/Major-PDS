import { useEffect, useState } from 'react';
import { ScrollText, FileJson } from 'lucide-react';
import { Button, IconButton, Card, PanelHeader, EmptyState, Input, Select } from '../../design/primitives';
import Drawer from '../../design/primitives/Drawer';
import ResponsiveTable from '../../design/patterns/ResponsiveTable';
import RelativeTime from '../../design/patterns/RelativeTime';
import { useFilterParams } from '../../hooks/useFilterParams';
import useToast from '../../components/ui/useToast';
import { copyToClipboard } from '../../lib/hash';

const PAGE_SIZE = 50;

// Stable identity across renders — useFilterParams keys its memoization off
// this object, so a fresh literal on every render would defeat that.
const FILTER_DEFAULTS = { actor: '', action: '', from: '', to: '' };

/**
 * Audit Log — genuinely empty today, confirmed by reading pds-backend/src
 * directly rather than assuming:
 *
 * `iot_audit` (migrations/018_create_iot_audit.js: actor_type, actor_id,
 * action, target, at_time, meta_json) IS written to today — via
 * services/auditLogService.js#record(), called from iotController.js
 * (actions "rotate_token", "recalibrate_device"), anomalyController.js
 * ("resolve_anomaly_flag"), and dispenseSessionController.js
 * ("cancel_session"). But nothing reads it back: auditLogService exports
 * only `record`, no controller in src/controllers queries iot_audit, and no
 * router (admin.js, iotRoutes.js, anomalyRoutes.js, or any other) exposes a
 * GET route for it. There is also no separate audit/history/activity_log/
 * event_log table or endpoint anywhere else in the backend — the closest
 * thing, GET /api/admin/activity/feed (activityFeedService.js), is a
 * synthesized dispense/anchor/anomaly/health-change feed with no actor or
 * discrete action fields, not this table, so it doesn't fit the
 * actor/action/target shape this page needs.
 *
 * The structure below (filters, table, drawer, pagination) is still built
 * per the full spec so it only needs a real fetch wired in once a read
 * endpoint exists. The filters are intentionally disabled rather than
 * removed or faked — there is no endpoint to enumerate real actor/action
 * values from, and pretending otherwise would misrepresent what's actually
 * wired up.
 */
const AuditLog = () => {
    const toast = useToast();
    const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
    const [inspecting, setInspecting] = useState(null);

    useEffect(() => {
        document.title = 'Audit Log — PDS Supervision';
    }, []);

    // No backend read endpoint exists (see file header) — nothing to fetch,
    // so this is a plain empty list rather than a loading/error state.
    const events = [];

    const columns = [
        { key: 'at', header: 'When', render: (row) => <RelativeTime value={row.at} /> },
        {
            key: 'actor',
            header: 'Actor',
            render: (row) => `${row.actorType}${row.actorId ? ` · ${row.actorId}` : ''}`,
        },
        { key: 'action', header: 'Action', mono: true },
        { key: 'target', header: 'Target', mono: true },
        {
            key: 'meta',
            header: 'Meta',
            render: (row) => (
                <IconButton
                    icon={<FileJson size={14} />}
                    ariaLabel="View JSON"
                    variant="ghost"
                    size="sm"
                    onClick={() => setInspecting(row)}
                />
            ),
        },
    ];

    const handleCopy = async () => {
        const succeeded = await copyToClipboard(JSON.stringify(inspecting?.meta ?? {}, null, 2));
        if (succeeded) toast.success('Copied to clipboard');
    };

    return (
        <>
            <PanelHeader
                title="Audit Log"
                subtitle="Admin actions are already written to an audit trail, but no endpoint yet exists to read it back — filters and pagination below are wired up for when one does."
            />
            <div className="space-y-4">
                <Card className="flex flex-wrap items-end gap-4">
                    <Select
                        label="Actor"
                        className="w-40"
                        value={filters.actor}
                        onChange={(event) => setFilters({ actor: event.target.value })}
                        disabled
                        helperText="No actor list available yet"
                    >
                        <option value="">All actors</option>
                    </Select>
                    <Select
                        label="Action"
                        className="w-44"
                        value={filters.action}
                        onChange={(event) => setFilters({ action: event.target.value })}
                        disabled
                        helperText="No action list available yet"
                    >
                        <option value="">All actions</option>
                    </Select>
                    <Input
                        label="From"
                        type="date"
                        value={filters.from}
                        onChange={(event) => setFilters({ from: event.target.value })}
                        disabled
                    />
                    <Input
                        label="To"
                        type="date"
                        value={filters.to}
                        onChange={(event) => setFilters({ to: event.target.value })}
                        disabled
                    />
                </Card>

                <ResponsiveTable
                    columns={columns}
                    data={events}
                    getRowKey={(row) => row.id}
                    emptyState={
                        <EmptyState
                            icon={<ScrollText size={20} />}
                            title="No audit events recorded yet"
                            description="Admin actions — resolving an anomaly, rotating a device token, triggering a recalibration, cancelling a session — are already written to an audit trail, but no endpoint exists yet to read it back. This page will list those events, newest first, once one does."
                        />
                    }
                />

                {/* Cursor-style "Load older" pagination: unreachable while `events`
                    is hardcoded to [] (always under PAGE_SIZE), so intentionally
                    not rendered rather than shown as a dead button — see file
                    header for why there's nothing to page through yet. */}
                {events.length >= PAGE_SIZE ? (
                    <div className="flex justify-center">
                        <Button variant="secondary" size="sm">
                            Load older
                        </Button>
                    </div>
                ) : null}
            </div>

            <Drawer
                open={Boolean(inspecting)}
                onClose={() => setInspecting(null)}
                title="Audit event"
                footer={
                    <Button variant="secondary" onClick={handleCopy}>
                        Copy
                    </Button>
                }
            >
                <pre className="font-mono-ds text-ds-mono-sm whitespace-pre-wrap break-all text-ds-text-primary">
                    {JSON.stringify(inspecting?.meta ?? {}, null, 2)}
                </pre>
            </Drawer>
        </>
    );
};

export default AuditLog;
