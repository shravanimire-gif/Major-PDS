import { useEffect } from 'react';
import { Cpu } from 'lucide-react';
import PanelHeader from '../../design/primitives/PanelHeader';
import EmptyState from '../../design/primitives/EmptyState';

const Devices = () => {
    useEffect(() => { document.title = 'Devices — PDS Supervision'; }, []);

    return (
        <>
            <PanelHeader title="Devices" subtitle="Device registration. For live operational status, see Health / IoT Fleet." />
            <EmptyState
                icon={<Cpu size={20} />}
                title="No devices registered yet"
                description="Devices appear here after a shop provisions one."
            />
        </>
    );
};

export default Devices;
