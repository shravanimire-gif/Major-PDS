import { useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import PanelHeader from '../../design/primitives/PanelHeader';
import EmptyState from '../../design/primitives/EmptyState';

const CommodityTolerances = () => {
    useEffect(() => { document.title = 'Commodity Tolerances — PDS Supervision'; }, []);

    return (
        <>
            <PanelHeader title="Commodity Tolerances" />
            <EmptyState
                icon={<SlidersHorizontal size={20} />}
                title="No standalone tolerance configuration yet"
                description="Weighing tolerance per commodity is currently a fixed value returned alongside each dispense session, not something configurable here. This page is ready for that once a tolerance-management endpoint exists."
            />
        </>
    );
};

export default CommodityTolerances;
