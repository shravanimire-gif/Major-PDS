import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockchainHealthCard from '../../components/admin/BlockchainHealthCard';
import Card from '../../components/ui/Card';
import useApiQuery from '../../hooks/useApiQuery';
import DonutChart from '../../design/patterns/DonutChart';
import { Card as DsCard, PanelHeader, Skeleton, EmptyState } from '../../design/primitives';

// Areas beyond the top 3 fold into a single "Other" slice — a donut puts
// every slice next to every other, and 3 is as many named categorical hues
// as the palette clears under that all-pairs comparison (see tokens.js
// `chart.series` / DonutChart's doc comment).
const MAX_NAMED_AREAS = 3;

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Dashboard — PDS Supervision';
  }, []);

  const { data: breakdown, loading: categoryLoading, error: categoryError } = useApiQuery(
    '/api/admin/analytics/category-breakdown'
  );
  const { data: areasData, loading: areasLoading, error: areasError } = useApiQuery('/api/admin/areas');

  const categoryChartData = useMemo(
    () => (breakdown?.categories || []).map((c) => ({ label: c.category, value: c.count })),
    [breakdown]
  );

  const areaChartData = useMemo(() => {
    const sorted = [...(areasData?.areas || [])].sort(
      (a, b) => Number(b.beneficiary_count || 0) - Number(a.beneficiary_count || 0)
    );
    const named = sorted.slice(0, MAX_NAMED_AREAS);
    const rest = sorted.slice(MAX_NAMED_AREAS);
    const restTotal = rest.reduce((sum, a) => sum + Number(a.beneficiary_count || 0), 0);

    return [
      ...named.map((a) => ({ id: a.id, label: a.name, value: Number(a.beneficiary_count || 0) })),
      ...(rest.length > 0 ? [{ label: 'Other', value: restTotal, isOther: true }] : []),
    ];
  }, [areasData]);

  const goToBeneficiaries = (state) => navigate('/admin/beneficiaries', { state });

  return (
    <>
      <PanelHeader title="Dashboard" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <BlockchainHealthCard />
        <Card header="Welcome">
          <p className="text-sm text-text-secondary">Manage your PDS system from here.</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DsCard>
          <PanelHeader
            title="Beneficiaries by Category"
            subtitle="Click a category to see that list"
          />
          {categoryLoading ? (
            <Skeleton shape="block" height="10rem" />
          ) : categoryError ? (
            <EmptyState title="Failed to load category breakdown" description={categoryError} />
          ) : (
            <DonutChart
              data={categoryChartData}
              totalLabel="Beneficiaries"
              onSliceClick={(slice) => goToBeneficiaries({ category: slice.label })}
            />
          )}
        </DsCard>

        <DsCard>
          <PanelHeader title="Beneficiaries by Area" subtitle="Click an area to see that list" />
          {areasLoading ? (
            <Skeleton shape="block" height="10rem" />
          ) : areasError ? (
            <EmptyState title="Failed to load areas" description={areasError} />
          ) : (
            <DonutChart
              data={areaChartData}
              totalLabel="Beneficiaries"
              onSliceClick={(slice) => goToBeneficiaries({ area_id: slice.id })}
            />
          )}
        </DsCard>
      </div>
    </>
  );
};

export default Dashboard;
