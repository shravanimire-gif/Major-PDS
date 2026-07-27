import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PanelHeader from '../../design/primitives/PanelHeader';
import LiveWeightTile from '../../components/admin/LiveWeightTile';

const ShopLiveWeight = () => {
    const { shopId } = useParams();

    useEffect(() => {
        document.title = 'Live Weight — PDS Supervision';
    }, []);

    return (
        <>
            <PanelHeader title="Live Weight" />
            <div className="max-w-md">
                <LiveWeightTile key={shopId} shopId={shopId} />
            </div>
        </>
    );
};

export default ShopLiveWeight;
